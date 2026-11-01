import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Trash2, MapPin, Clock, Users } from 'lucide-react';
import { api } from '../api';
import './NotesCalendar.css';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`; // local date, no timezone shift
const t12 = (t) => {
  const h = +String(t).slice(0, 2);
  return `${h % 12 || 12}:${String(t).slice(3, 5)} ${h < 12 ? 'AM' : 'PM'}`;
};
const del = (url) => (api.delete ? api.delete(url) : api.del(url));

export default function NotesCalendar({ user }) {
  const today = new Date();
  const todayStr = ymd(today.getFullYear(), today.getMonth(), today.getDate());

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [sel, setSel] = useState(todayStr);
  const [meetings, setMeetings] = useState([]);
  const [users, setUsers] = useState([]);
  const [err, setErr] = useState('');

  const [title, setTitle] = useState('');
  const [time, setTime] = useState('10:00');
  const [place, setPlace] = useState('');
  const [who, setWho] = useState([]);

  const loadMeetings = () => api.get('/meetings').then(setMeetings).catch((x) => setErr(x.message));

  useEffect(() => {
    loadMeetings();
    api.get('/users').then(setUsers).catch(() => {});
  }, []);

  // calendar cells
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const countOn = (d) => meetings.filter((m) => m.meet_date === d).length;
  const dayMeetings = meetings.filter((m) => m.meet_date === sel);

  const prev = () => (month === 0 ? (setMonth(11), setYear(year - 1)) : setMonth(month - 1));
  const next = () => (month === 11 ? (setMonth(0), setYear(year + 1)) : setMonth(month + 1));

  const toggleWho = (name) => setWho((w) => (w.includes(name) ? w.filter((x) => x !== name) : [...w, name]));

  const book = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await api.post('/meetings', {
        title, meet_date: sel, meet_time: time, place, attendees: who.join(', '),
      });
      setTitle(''); setPlace(''); setWho([]);
      await loadMeetings();
    } catch (x) { setErr(x.message); }
  };

  const remove = async (id) => {
    try {
      await del('/meetings/' + id);
      await loadMeetings();
    } catch (x) { setErr(x.message); }
  };

  // the server also checks this, so showing the button to everyone is safe
  const canDelete = (m) => !user || user.role === 'admin' || user.id === m.user_id;

  return (
    <div>
      <div className="page-head"><h1>Meeting calendar</h1></div>
      {err && <p className="error">{err}</p>}

      <div className="cal-wrap">
        {/* LEFT: month calendar */}
        <section className="panel">
          <div className="cal-head">
            <button type="button" className="btn ghost" onClick={prev}><ChevronLeft size={16} /></button>
            <h2>{MONTHS[month]} {year}</h2>
            <button type="button" className="btn ghost" onClick={next}><ChevronRight size={16} /></button>
          </div>
          <div className="cal-grid">
            {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
            {cells.map((d, i) => {
              if (!d) return <div key={'b' + i} />;
              const key = ymd(year, month, d);
              const n = countOn(key);
              return (
                <button
                  type="button"
                  key={key}
                  className={'cal-day' + (key === todayStr ? ' today' : '') + (key === sel ? ' sel' : '')}
                  onClick={() => setSel(key)}
                >
                  <span>{d}</span>
                  {n > 0 && <em className="cal-dot">{n}</em>}
                </button>
              );
            })}
          </div>
        </section>

        {/* RIGHT: two separate cards */}
        <div className="cal-side">
          {/* Card 1: booking form */}
          <section className="panel">
            <h2 className="side-title">Book a meeting</h2>
            <p className="side-sub">{sel}</p>

            <form className="meet-form" onSubmit={book}>
              <label className="fld">
                <span>Title</span>
                <input placeholder="Meeting title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </label>

              <div className="fld-row">
                <label className="fld fld-time">
                  <span>Time</span>
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
                </label>
                <label className="fld fld-place">
                  <span>Place / link</span>
                  <input placeholder="Room or meeting link" value={place} onChange={(e) => setPlace(e.target.value)} />
                </label>
              </div>

              {users.length > 0 && (
                <div className="fld">
                  <span>Who should attend?</span>
                  <div className="chips">
                    {users.map((u) => {
                      const name = u.full_name || u.username;
                      return (
                        <button
                          type="button"
                          key={u.id}
                          className={'chip' + (who.includes(name) ? ' on' : '')}
                          onClick={() => toggleWho(name)}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <button className="btn meet-submit" type="submit">Book meeting</button>
            </form>
          </section>

          {/* Card 2: meetings of the selected day */}
          <section className="panel">
            <h2 className="side-title">Meetings on this day</h2>
            <p className="side-sub">{sel}</p>

            {dayMeetings.length === 0 && <p className="muted">No meetings on this day.</p>}

            <div className="meet-list">
              {dayMeetings.map((m) => (
                <div key={m.id} className="meet-item">
                  <div className="meet-info">
                    <strong>{m.title}</strong>
                    <div className="meet-meta">
                      <span className="meta"><Clock size={14} /> {t12(m.meet_time)}</span>
                      {m.place && <span className="meta"><MapPin size={14} /> {m.place}</span>}
                      {m.attendees && <span className="meta"><Users size={14} /> {m.attendees}</span>}
                    </div>
                    <small className="muted">Booked by {m.creator}</small>
                  </div>
                  {canDelete(m) && (
                    <button type="button" className="meet-del" title="Delete meeting" onClick={() => remove(m.id)}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}