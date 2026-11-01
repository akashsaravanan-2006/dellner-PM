import { useEffect, useState } from 'react';
import { Cake, AlarmClock, Circle, CircleCheck, BellRing, MapPin, Users } from 'lucide-react';
import { api } from '../api';
import { nm } from '../components/Avatar';
import './Dashboard.css';

const pad = (n) => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const t12 = (t) => { const h = +t.slice(0, 2); return `${h % 12 || 12}:${t.slice(3, 5)} ${h < 12 ? 'AM' : 'PM'}`; };
const ALERT_MIN = 15; // alert when a meeting is this many minutes away or less

export default function Dashboard({ user, go }) {
  const [projects, setProjects] = useState([]);
  const [todos, setTodos] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [bdays, setBdays] = useState([]);
  const [stats, setStats] = useState({ upcoming: 0, current: 0, completed: 0 });
  const [text, setText] = useState('');
  const [done, setDone] = useState([]);
  const [err, setErr] = useState('');
  const [, setTick] = useState(0);

  const load = () => {
    api.get('/projects?status=current').then(setProjects);
    api.get('/todos').then(setTodos);
    api.get('/meetings').then(setMeetings);
    api.get('/leaves').then(setLeaves);
    api.get('/stats').then(setStats);
    api.get('/birthdays').then(setBdays);
  };
  useEffect(() => { load(); }, []);

  // every 30 seconds: refresh the clock, meetings and leaves booked by others
  useEffect(() => {
    const i = setInterval(() => {
      setTick((n) => n + 1);
      api.get('/meetings').then(setMeetings).catch(() => {});
      api.get('/leaves').then(setLeaves).catch(() => {});
    }, 30000);
    return () => clearInterval(i);
  }, []);

  const t = today();
  const leaveName = (l) => l.full_name || l.username;
  // everyone whose leave covers today (works for all days of a 10-day leave)
  const away = leaves.filter((l) => l.from_date <= t && l.to_date >= t);
  const daysLeft = (d) => Math.round((new Date(d + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000);
  const leaveTotal = (l) => Math.round((new Date(l.to_date + 'T00:00:00') - new Date(l.from_date + 'T00:00:00')) / 86400000) + 1;
  const leaveDay = (l) => leaveTotal(l) - daysLeft(l.to_date);
  const isLate = (p) => p.due_date && daysLeft(p.due_date) <= 7;
  const due = projects.filter(isLate).sort((a, b) => a.due_date.localeCompare(b.due_date));

  const todays = meetings.filter((x) => x.meet_date === t);
  const minsTo = (x) => Math.ceil((new Date(`${x.meet_date}T${x.meet_time}`) - new Date()) / 60000);
  const soon = todays.filter((x) => { const d = minsTo(x); return d >= 0 && d <= ALERT_MIN; });
  const tag = (x) => { const d = minsTo(x); return d < 0 ? ['Started', 'started'] : d <= ALERT_MIN ? ['Soon', 'soon'] : ['Upcoming', '']; };

  const addTodo = async (e) => {
    e.preventDefault();
    try { await api.post('/todos', { text }); setText(''); setErr(''); load(); }
    catch (x) { setErr(x.message); }
  };

  // tick = strike through, then erase
  const finish = (id) => {
    if (done.includes(id)) return;
    setDone((d) => [...d, id]);
    setTimeout(async () => {
      try { await api.del('/todos/' + id); } catch (x) { setErr(x.message); }
      setDone((d) => d.filter((x) => x !== id));
      load();
    }, 450);
  };

  return (
    <div>
      <div className="page-head"><h1>Welcome, {nm(user)}</h1><span className="muted">{new Date().toDateString()}</span></div>

      {away.length > 0 && (
        <div className="leave-alert">
          <div>
            <b>Team leave information</b>
            {away.map((l) => {
              const total = leaveTotal(l);
              const isMe = l.user_id === user.id;
              return (
                <div key={l.id}>
                  {isMe ? 'You are' : `${leaveName(l)} is`} on {l.day_type === 'half' ? 'half-day' : 'leave'} today
                  {total > 1 && ` (day ${leaveDay(l)} of ${total}, ${l.from_date} to ${l.to_date})`}
                  {l.reason ? ` - ${l.reason}` : ''}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {soon.length > 0 && (
        <div className="meeting-alert">
          <BellRing size={24} />
          <div>
            <b>Meeting reminder</b>
            {soon.map((x) => {
              const d = minsTo(x);
              return (
                <div key={x.id}>
                  {x.title} {d === 0 ? 'is starting now' : `starts in ${d} minute${d > 1 ? 's' : ''}`} ({t12(x.meet_time)}{x.place ? ', ' + x.place : ''}), booked by {x.creator}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {bdays.length > 0 && (
        <div className="bday">
          <Cake size={26} />
          <div>
            <b>{bdays.map(nm).join(' and ')}{bdays.some((b) => b.id === user.id) ? ' (that is you!)' : ''}</b>
            <div>Today is our team birthday. Wish them a happy birthday!</div>
          </div>
        </div>
      )}

      {due.length > 0 && (
        <div className="deadline">
          <AlarmClock size={24} />
          <div>
            <b>Deadline alert</b>
            {due.map((p) => {
              const n = daysLeft(p.due_date);
              return <div key={p.id}>{p.name}: {n < 0 ? `overdue by ${-n} day${n < -1 ? 's' : ''}` : n === 0 ? 'due today' : `due in ${n} day${n > 1 ? 's' : ''}`} ({p.due_date})</div>;
            })}
          </div>
        </div>
      )}

      <div className="dash-stats">
        <button className="panel stat" onClick={() => go('current')}><b>{stats.current}</b>Current projects</button>
        <button className="panel stat" onClick={() => go('upcoming')}><b>{stats.upcoming}</b>Upcoming projects</button>
        <button className="panel stat" onClick={() => go('completed')}><b>{stats.completed}</b>Completed projects</button>
        <div className="panel stat"><b>{away.length}</b>On leave today{away.length > 0 && <small>{away.map((a) => leaveName(a) + (a.day_type === 'half' ? ' (half day)' : '')).join(', ')}</small>}</div>
      </div>

      <section className="panel meet-panel">
        <div className="row"><h2>Today's meetings</h2><button className="btn ghost" onClick={() => go('notes')}>Book a meeting</button></div>
        {todays.length === 0 && <p className="muted">No meetings today.</p>}
        {todays.map((x) => {
          const [label, cls] = tag(x);
          return (
            <div key={x.id} className={'meet-item ' + cls}>
              <div className="meet-time">{t12(x.meet_time)}</div>
              <div className="meet-info">
                <b>{x.title}</b>
                <small className="muted">
                  Booked by {x.creator}
                  {x.place && <span className="meta"><MapPin size={12} /> {x.place}</span>}
                  {x.attendees && <span className="meta"><Users size={12} /> {x.attendees}</span>}
                </small>
              </div>
              <span className={'meet-tag ' + cls}>{label}</span>
            </div>
          );
        })}
      </section>

      <div className="dash-cols">
        <section className="panel">
          <h2>Projects in progress</h2>
          {projects.length === 0 && <p className="muted">No current projects.</p>}
          {projects.map((p) => (
            <div key={p.id} className={'dash-proj' + (isLate(p) ? ' late' : '')}>
              <div className="row"><b>{p.name}</b><span className="muted">{p.progress}%</span></div>
              <div className="muted">{[p.owner, p.due_date && 'due ' + p.due_date].filter(Boolean).join(' · ')}</div>
              <div className="bar"><span style={{ width: p.progress + '%' }} /></div>
            </div>
          ))}
        </section>

        <section className="panel">
          <h2>To-do list</h2>
          <form className="note-form" onSubmit={addTodo}>
            <input placeholder="Add a to-do" value={text} onChange={(e) => setText(e.target.value)} required />
            <button className="btn">Add</button>
          </form>
          {err && <p className="error">{err}</p>}
          {todos.length === 0 && <p className="muted">Nothing to do. Enjoy!</p>}
          {todos.map((n) => {
            const isDone = done.includes(n.id);
            return (
              <div key={n.id} className={'todo-item' + (isDone ? ' done' : '')}>
                <button type="button" className="todo-check" onClick={() => finish(n.id)} aria-label="Mark as completed">
                  {isDone ? <CircleCheck size={22} /> : <Circle size={22} />}
                </button>
                <div className="todo-text"><span>{n.text}</span></div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}