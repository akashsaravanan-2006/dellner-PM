import { useEffect, useState } from 'react';
import { api } from '../api';
import './AccessManagement.css';

const DEFAULT_PW = 'Dellner@PO';
const EMPTY = { full_name: '', username: '', password: DEFAULT_PW, role: 'member' };

export default function AccessManagement({ user }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const load = () => api.get('/users').then(setUsers);
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const add = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', form);
      setMsg({ type: 'success', text: `Added. Login: username "${form.username}", password "${form.password || DEFAULT_PW}"` });
      setForm(EMPTY); load();
    } catch (x) { setMsg({ type: 'error', text: x.message }); }
  };
  const run = async (fn, ok) => {
    try { await fn(); setMsg({ type: 'success', text: ok }); load(); }
    catch (x) { setMsg({ type: 'error', text: x.message }); }
  };
  const reset = (u) => {
    const password = window.prompt('New password for ' + u.username + ' (6+ characters)', DEFAULT_PW);
    if (password) run(() => api.put('/users/' + u.id + '/password', { password }), 'Password reset for ' + u.username);
  };
  const remove = (u) => window.confirm('Remove ' + u.username + '?') && run(() => api.del('/users/' + u.id), u.username + ' removed');

  return (
    <div>
      <div className="page-head"><h1>Access management</h1></div>
      <form className="panel access-form" onSubmit={add}>
        <input placeholder="Full name" value={form.full_name} onChange={set('full_name')} />
        <input placeholder="Username" value={form.username} onChange={set('username')} required />
        <input placeholder="Password" value={form.password} onChange={set('password')} />
        <select value={form.role} onChange={set('role')}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button className="btn">Add employee</button>
      </form>
      <p className="muted">New employees get the default password {DEFAULT_PW}. They can change it in Settings after logging in.</p>
      {msg.text && <p className={msg.type}>{msg.text}</p>}
      <div className="panel">
        <table>
          <thead><tr><th>Name</th><th>Username</th><th>Role</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.full_name || u.username}</td><td>{u.username}</td><td>{u.role}</td>
                <td className="access-actions">
                  <button className="btn ghost" onClick={() => reset(u)}>Reset password</button>
                  {u.id !== user.id && <button className="btn ghost" onClick={() => remove(u)}>Remove</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
