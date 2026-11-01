import { LogOut } from 'lucide-react';
import Avatar, { nm } from './Avatar';

export default function Topbar({ user, onLogout, go }) {
  return (
    <header className="topbar">
      <span className="hello">Dellner Chennai · Project management team</span>
      <div className="who">
        <button className="who-chip" onClick={() => go('profile')}>
          <Avatar u={user} size={34} />
          <span>{nm(user)}<small>{user.role === 'admin' ? 'Admin' : user.job_role || 'Member'}</small></span>
        </button>
        <button className="btn ghost" onClick={onLogout}><LogOut size={16} /> Log out</button>
      </div>
    </header>
  );
}
