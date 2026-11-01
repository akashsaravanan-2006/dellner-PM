import { useEffect, useState } from 'react';
import { api } from '../api';
import './ProjectsView.css';

const daysLeft = (d) => Math.round((new Date(d + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000);
const EMPTY = { name: '', client: '', owner: '', start_date: '', due_date: '', description: '' };

export default function ProjectsView({ status, title, empty, user }) {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');

  const load = () => api.get('/projects?status=' + status).then(setList).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [status]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const add = async (e) => {
    e.preventDefault();
    try {
      await api.post('/projects', { ...form, status, progress: 0 });
      setForm(EMPTY); setOpen(false); setErr(''); load();
    } catch (x) { setErr(x.message); }
  };
  const update = (id, body) => api.put('/projects/' + id, body).then(load);
  const remove = (id) => window.confirm('Delete this project?') && api.del('/projects/' + id).then(load);

  return (
    <div>
      <div className="page-head">
        <h1>{title}</h1>
        {status !== 'completed' && (
          <button className="btn" onClick={() => setOpen(!open)}>{open ? 'Close' : 'Add project'}</button>
        )}
      </div>
      {err && <p className="error">{err}</p>}

      {open && (
        <form className="panel pv-form" onSubmit={add}>
          <input placeholder="Project name" value={form.name} onChange={set('name')} required />
          <input placeholder="Client" value={form.client} onChange={set('client')} />
          <input placeholder="Owner (team member)" value={form.owner} onChange={set('owner')} />
          <label>Start<input type="date" value={form.start_date} onChange={set('start_date')} /></label>
          <label>Due<input type="date" value={form.due_date} onChange={set('due_date')} /></label>
          <textarea placeholder="Description" value={form.description} onChange={set('description')} />
          <button className="btn">Save project</button>
        </form>
      )}

      {list.length === 0 && <p className="muted">{empty}</p>}
      <div className="pv-grid">
        {list.map((p) => (
          <article key={p.id} className={'panel pv-card' + (p.status === 'current' && p.due_date && daysLeft(p.due_date) <= 7 ? ' late' : '')}>
            <h3>{p.name}</h3>
            <p className="muted">{[p.client, p.owner && 'Owner: ' + p.owner].filter(Boolean).join(' · ')}</p>
            {p.description && <p>{p.description}</p>}
            <p className="muted due">{p.start_date || 'No start date'} to {p.due_date || 'No due date'}</p>
            <div className="bar"><span style={{ width: p.progress + '%' }} /></div>
            <small>{p.progress}% done</small>
            {status === 'current' && (
              <input type="range" min="0" max="100" step="5" defaultValue={p.progress}
                onMouseUp={(e) => update(p.id, { progress: +e.target.value })}
                onTouchEnd={(e) => update(p.id, { progress: +e.target.value })} />
            )}
            <div className="pv-actions">
              {status === 'upcoming' && <button className="btn" onClick={() => update(p.id, { status: 'current' })}>Start project</button>}
              {status === 'current' && <button className="btn" onClick={() => update(p.id, { status: 'completed', progress: 100 })}>Mark completed</button>}
              {user?.role === 'admin' && <button className="btn ghost" onClick={() => remove(p.id)}>Delete</button>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
