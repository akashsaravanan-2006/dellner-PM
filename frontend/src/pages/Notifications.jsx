import { useEffect, useState } from 'react';
import { Cake, StickyNote, MessageCircle, Briefcase, Plane, AlarmClock } from 'lucide-react';
import { api } from '../api';
import './Notifications.css';

const ICON = { birthday: Cake, reminder: StickyNote, deadline: AlarmClock, chat: MessageCircle, leave: Plane };

export default function Notifications() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get('/notifications').then(setItems); }, []);
  const now = items.filter((i) => !i.at);
  const recent = items.filter((i) => i.at);

  const Row = ({ i }) => {
    const Icon = ICON[i.kind] || Briefcase;
    return (
      <div className={'notif ' + i.kind}>
        <span className="notif-ico"><Icon size={18} /></span>
        <span>{i.text}</span>
        {i.at && <small className="muted">{i.at.slice(0, 16)}</small>}
      </div>
    );
  };

  return (
    <div>
      <div className="page-head"><h1>Notifications</h1></div>
      <section className="panel">
        <h2>Today</h2>
        {now.length === 0 && <p className="muted">You are all caught up. Birthdays, reminders and unread chats show here.</p>}
        {now.map((i, k) => <Row key={k} i={i} />)}
      </section>
      <section className="panel notif-recent">
        <h2>Recent activity</h2>
        {recent.length === 0 && <p className="muted">Project progress and leave updates will appear here.</p>}
        {recent.map((i, k) => <Row key={k} i={i} />)}
      </section>
    </div>
  );
}
