import { useState } from 'react';
import { api } from '../api';
import './Settings.css';

export default function Settings() {
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [msg, setMsg] = useState({ type: '', text: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (f.next !== f.confirm) return setMsg({ type: 'error', text: 'New passwords do not match' });
    try {
      await api.post('/change-password', { current: f.current, next: f.next });
      setF({ current: '', next: '', confirm: '' });
      setMsg({ type: 'success', text: 'Password changed' });
    } catch (x) { setMsg({ type: 'error', text: x.message }); }
  };

  return (
    <div>
      <div className="page-head"><h1>Settings</h1></div>
      <form className="panel settings-form" onSubmit={submit}>
        <h2>Change password</h2>
        <input type="password" placeholder="Current password" value={f.current} onChange={set('current')} required />
        <input type="password" placeholder="New password (6+ characters)" value={f.next} onChange={set('next')} required />
        <input type="password" placeholder="Confirm new password" value={f.confirm} onChange={set('confirm')} required />
        {msg.text && <p className={msg.type}>{msg.text}</p>}
        <button className="btn">Save password</button>
      </form>
    </div>
  );
}
