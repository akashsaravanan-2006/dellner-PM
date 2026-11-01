import { useEffect, useState } from 'react';
import { api } from '../api';
import './LeaveInformation.css';

const pad = (n) => String(n).padStart(2, '0');
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

export default function LeaveInformation({ user }) {
  const isAdmin = user.role === 'admin';
  const blank = { user_id: user.id, day_type: 'full', from_date: '', to_date: '', reason: '' };
  const [leaves, setLeaves] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(blank);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const load = () => api.get('/leaves').then(setLeaves);
  useEffect(() => {
    load();
    if (isAdmin) api.get('/users').then(setUsers);
    // refresh every 30 seconds so leaves informed by others appear
    const i = setInterval(() => { load().catch(() => {}); }, 30000);
    return () => clearInterval(i);
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const add = async (e) => {
    e.preventDefault();
    try {
      await api.post('/leaves', form);
      setForm(blank);
      setMsg({ type: 'success', text: 'Leave informed. The whole team can see it.' });
      load();
    } catch (x) { setMsg({ type: 'error', text: x.message }); }
  };

  const t = todayStr();
  const nameOf = (l) => l.full_name || l.username;
  const state = (l) => (l.to_date < t ? 'Past' : l.from_date <= t ? 'On leave now' : 'Upcoming');
  const days = (l) => Math.round((new Date(l.to_date + 'T00:00:00') - new Date(l.from_date + 'T00:00:00')) / 86400000) + 1;
  const away = leaves.filter((l) => l.from_date <= t && l.to_date >= t);
  const half = form.day_type === 'half';

  return (
    <div>
      <div className="page-head"><h1>Leave information</h1><span className="muted">All team members</span></div>

      <form className="panel leave-form" onSubmit={add}>
        {isAdmin ? (
          <select value={form.user_id} onChange={set('user_id')} required>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.username}</option>)}
          </select>
        ) : <input value={user.full_name || user.username} disabled />}
        <select value={form.day_type} onChange={set('day_type')} aria-label="Leave type">
          <option value="full">Full day</option>
          <option value="half">Half day</option>
        </select>
        <input type="date" value={form.from_date} onChange={set('from_date')} required aria-label="From date" />
        {!half && <input type="date" value={form.to_date} onChange={set('to_date')} required aria-label="To date" />}
        <input placeholder="Reason" value={form.reason} onChange={set('reason')} />
        <button className="btn">Inform leave</button>
      </form>
      {msg.text && <p className={msg.type}>{msg.text}</p>}

      <div className="panel leave-today">
        <h2>On leave today</h2>
        {away.length === 0
          ? <p className="muted">Everyone is available today.</p>
          : away.map((l) => (
            <div key={l.id}>
              <b>{nameOf(l)}</b>{l.day_type === 'half' ? ' (half day)' : ''}
              {days(l) > 1 && <span className="muted"> · {l.from_date} to {l.to_date}</span>}
            </div>
          ))}
      </div>

      <div className="panel">
        <h2>Team leave list</h2>
        {leaves.length === 0 ? <p className="muted">No leave recorded.</p> : (
          <table>
            <thead><tr><th>Member</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th><th /></tr></thead>
            <tbody>
              {leaves.map((l) => (
                <tr key={l.id} className={l.user_id === user.id ? 'my-leave' : ''}>
                  <td>{nameOf(l)}{l.user_id === user.id && ' (you)'}</td>
                  <td>{l.day_type === 'half' ? 'Half day' : 'Full day'}</td>
                  <td>{l.from_date}</td>
                  <td>{l.to_date}</td>
                  <td>{l.day_type === 'half' ? '0.5' : days(l)}</td>
                  <td>{l.reason}</td>
                  <td><b className={state(l) === 'On leave now' ? 'leave-now' : 'muted'}>{state(l)}</b></td>
                  <td>{(isAdmin || l.user_id === user.id) && <button className="btn ghost" onClick={() => api.del('/leaves/' + l.id).then(load)}>Remove</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}