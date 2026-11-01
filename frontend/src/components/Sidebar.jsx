import { LayoutDashboard, StickyNote, MessageCircle, Briefcase, Plane, Bell, UserRound, ShieldCheck, FolderLock, Settings, LogOut } from 'lucide-react';
import logo from '../img/logo.jfif?url';

const ITEMS = [
  ['dashboard', 'Dashboard', LayoutDashboard],
  ['notes', 'Meeting calendar', StickyNote],
  ['chat', 'Team chat', MessageCircle],
  ['projects', 'Projects', Briefcase],
  ['leave', 'Leave information', Plane],
  ['workout', 'Workout', FolderLock],
  ['notifications', 'Notifications', Bell],
  ['profile', 'My profile', UserRound],
  ['access', 'Access management', ShieldCheck, true],
  ['settings', 'Settings', Settings],
];
const PROJECT_PAGES = ['projects', 'current', 'upcoming', 'completed'];

export default function Sidebar({ page, setPage, user, badge, onLogout }) {
  const isOn = (key) => (key === 'projects' ? PROJECT_PAGES.includes(page) : page === key);
  return (
    <aside className="sidebar">
      <div className="brand">
        <img src={logo} alt="Dellner" />
        <span>Dellner PM</span>
      </div>
      <nav className="nav">
        {ITEMS.filter(([, , , adminOnly]) => !adminOnly || user.role === 'admin').map(([key, label, Icon]) => (
          <button key={key} className={'nav-btn' + (isOn(key) ? ' active' : '')} onClick={() => setPage(key)}>
            <Icon size={18} />
            <span>{label}</span>
            {key === 'notifications' && badge > 0 && <b className="badge">{badge}</b>}
          </button>
        ))}
      </nav>
      <button className="nav-btn logout" onClick={onLogout}><LogOut size={18} /><span>Log out</span></button>
    </aside>
  );
}