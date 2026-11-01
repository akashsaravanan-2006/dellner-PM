import { useEffect, useState } from 'react';
import { CalendarDays, CircleCheck, MessageCircle, Bell, Trash2 } from 'lucide-react';
import { api } from '../api';
import './Notifications.css';

const ICON = { meeting: CalendarDays, todo: CircleCheck, chat: MessageCircle };

export default function Notifications({ onChange }) {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.get('/notifications').then(setItems).catch((x) => setErr(x.message));

  useEffect(() => {
    load();
    // refresh every 30 seconds so new meetings, messages and reminders appear
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, []);

  // Clear all: remove every notification now shown
  const clearAll = async () => {
    setBusy(true);
    try {
      await api.post('/notifications/clear');
      setItems([]);
      setErr('');
      if (onChange) onChange(); // lets the sidebar number refresh
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };

  return (
    <div>
      <div className="page-head">
        <h1>Notifications</h1>
        <button className="btn ghost nt-clear" onClick={clearAll} disabled={busy || items.length === 0}>
          <Trash2 size={16} /> Clear all
        </button>
      </div>

      {err && <p className="error">{err}</p>}

      <div className="panel">
        {items.length === 0 && <p className="muted">No new notifications.</p>}
        {items.map((n, i) => {
          const Icon = ICON[n.kind] || Bell;
          return (
            <div key={i} className={'nt-item ' + n.kind}>
              <div className="nt-icon"><Icon size={20} /></div>
              <div className="nt-body">
                <span>{n.text}</span>
                {n.at && <small className="muted">{String(n.at).slice(0, 16).replace('T', ' ')}</small>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}