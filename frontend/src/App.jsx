import { useCallback, useEffect, useState } from 'react';
import './App.css';
import { api } from './api';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NotesCalendar from './pages/NotesCalendar';
import TeamChat from './pages/TeamChat';
import ProjectTracker from './pages/ProjectTracker';
import LeaveInformation from './pages/LeaveInformation';
import Workout from './pages/Workout';
import Notifications from './pages/Notifications';
import MyProfile from './pages/MyProfile';
import AccessManagement from './pages/AccessManagement';
import Settings from './pages/Settings';

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(sessionStorage.getItem('user') || 'null'));
  const [page, setPage] = useState('dashboard');
  const [badge, setBadge] = useState(0);

  const refreshMe = useCallback(() => api.get('/me').then((m) => setUser((u) => ({ ...u, ...m }))).catch(() => {}), []);

  useEffect(() => {
    if (!user) return;
    refreshMe();
    const poll = () => api.get('/notifications').then((l) => setBadge(l.filter((i) => !i.at).length)).catch(() => {});
    poll();
    const t = setInterval(poll, 20000);
    return () => clearInterval(t);
  }, [user?.id]);

  if (!user) return <Login onLogin={setUser} />;

  const logout = () => { sessionStorage.clear(); setUser(null); setPage('dashboard'); };
  const pages = {
    dashboard: <Dashboard user={user} go={setPage} />,
    notes: <NotesCalendar user={user} />,
    chat: <TeamChat user={user} />,
    projects: <ProjectTracker key="projects" user={user} start="all" />,
    current: <ProjectTracker key="current" user={user} start="current" />,
    upcoming: <ProjectTracker key="upcoming" user={user} start="upcoming" />,
    completed: <ProjectTracker key="completed" user={user} start="completed" />,
    leave: <LeaveInformation user={user} />,
    workout: <Workout />,
    notifications: <Notifications />,
    profile: <MyProfile user={user} onUpdate={refreshMe} />,
    access: user.role === 'admin' ? <AccessManagement user={user} /> : null,
    settings: <Settings />,
  };

  return (
    <div className="shell dpm">
      <Sidebar page={page} setPage={setPage} user={user} badge={badge} onLogout={logout} />
      <div className="main">
        <Topbar user={user} onLogout={logout} go={setPage} />
        <div className={'content' + (page === 'chat' ? ' wide' : '')}>{pages[page]}</div>
      </div>
    </div>
  );
}