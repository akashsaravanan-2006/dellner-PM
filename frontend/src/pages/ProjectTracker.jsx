import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Users, Play, CircleCheck, Search } from 'lucide-react';
import { api } from '../api';

const pad = (n) => String(n).padStart(2, '0');
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

const STATUS = { current: 'Ongoing', upcoming: 'Upcoming', completed: 'Completed' };
const RANK = { current: 0, upcoming: 1, completed: 2 };
const SERVICES = ['New project', 'Service project', 'R&D project'];
const BLANK = {
  name: '', client: '', project_no: '', service: 'New project', quantity: '', members: '',
  description: '', status: 'upcoming', progress: 0, start_date: '', due_date: '',
};
const names = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);
const uname = (u) => u.full_name || u.username;

export default function ProjectTracker({ user, start = 'all' }) {
  const isAdmin = user.role === 'admin';
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState(start);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [formErr, setFormErr] = useState('');
  const [err, setErr] = useState('');

  const load = () => api.get('/projects').then(setProjects).catch((x) => setErr(x.message));
  useEffect(() => { load(); api.get('/users').then(setUsers).catch(() => {}); }, []);

  const count = (s) => projects.filter((p) => p.status === s).length;
  const ql = q.trim().toLowerCase();
  const shown = projects
    .filter((p) => filter === 'all' || p.status === filter)
    .filter((p) => !ql || [p.name, p.client, p.project_no].some((v) => (v || '').toLowerCase().includes(ql)))
    .sort((a, b) => RANK[a.status] - RANK[b.status]);
  const today = todayStr();

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const toggleMember = (n) => {
    const l = names(form.members);
    setForm({ ...form, members: (l.includes(n) ? l.filter((x) => x !== n) : [...l, n]).join(', ') });
  };

  const openAdd = () => {
    setEditId(null); setFormErr('');
    setForm({ ...BLANK, status: filter !== 'all' ? filter : 'upcoming' });
  };
  const openEdit = (p) => {
    setEditId(p.id); setFormErr('');
    setForm({
      name: p.name || '', client: p.client || '', project_no: p.project_no || '', service: p.service || '',
      quantity: p.quantity ?? '', members: p.members || '', description: p.description || '',
      status: p.status || 'upcoming', progress: p.progress ?? 0, start_date: p.start_date || '', due_date: p.due_date || '',
    });
  };
  const close = () => setForm(null);

  const save = async (e) => {
    e.preventDefault();
    if (form.start_date && form.due_date && form.due_date < form.start_date) return setFormErr('End date is before start date');
    const progress = form.status === 'completed' ? 100 : form.status === 'upcoming' ? 0 : Math.min(100, Math.max(0, +form.progress || 0));
    const body = { ...form, progress };
    try {
      if (editId) await api.put('/projects/' + editId, body);
      else await api.post('/projects', body);
      close(); setErr(''); load();
    } catch (x) { setFormErr(x.message); }
  };

  const move = async (p, status) => {
    try { await api.put('/projects/' + p.id, { status, progress: status === 'completed' ? 100 : p.progress }); setErr(''); load(); }
    catch (x) { setErr(x.message); }
  };
  const remove = async (p) => {
    if (!window.confirm('Delete the project "' + p.name + '"? This cannot be undone.')) return;
    try { await api.del('/projects/' + p.id); setErr(''); load(); }
    catch (x) { setErr(x.message); }
  };

  const tabs = [
    ['current', 'Ongoing', count('current')],
    ['upcoming', 'Upcoming', count('upcoming')],
    ['completed', 'Completed', count('completed')],
    ['all', 'All projects', projects.length],
  ];

  return (
    <div>
      <div className="page-head">
        <h1>Projects</h1>
        <button className="btn" onClick={openAdd}><Plus size={16} /> Add project</button>
      </div>

      <div className="pj-stats">
        {tabs.map(([k, label, n]) => (
          <button key={k} className={'panel pj-stat ' + k + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>
            <b>{n}</b>{label}
          </button>
        ))}
      </div>

      <div className="pj-search">
        <Search size={16} />
        <input placeholder="Search by project name, customer or project number" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {err && <p className="error">{err}</p>}

      {shown.length === 0 && (
        <p className="muted">{projects.length === 0 ? 'No projects yet. Click "Add project" to create the first one.' : 'No projects match this filter.'}</p>
      )}

      <div className="pj-list">
        {shown.map((p) => {
          const late = p.status === 'current' && p.due_date && p.due_date < today;
          return (
            <div key={p.id} className={'panel pj-card ' + p.status + (late ? ' late' : '')}>
              <div className="pj-top">
                <div>
                  <b className="pj-name">{p.name}</b>
                  <div className="pj-sub">{[p.project_no && 'No. ' + p.project_no, p.client].filter(Boolean).join(' · ') || 'No customer yet'}</div>
                </div>
                <span className={'pj-status ' + p.status}>{late ? 'Overdue' : STATUS[p.status] || p.status}</span>
              </div>

              <div className="pj-facts">
                {p.service ? <span className="pj-tag">{p.service}</span> : null}
                {p.quantity != null ? <span>Quantity: <b>{p.quantity}</b></span> : null}
                <span>Start: <b>{p.start_date || 'TBD'}</b></span>
                <span>End: <b>{p.due_date || 'TBD'}</b></span>
              </div>

              {p.members ? <div className="pj-members"><Users size={14} /> {p.members}</div> : null}
              {p.description ? <p className="pj-desc">{p.description}</p> : null}

              <div className="pj-bar"><span style={{ width: (p.progress || 0) + '%' }} /></div>
              <div className="pj-foot">
                <small className="muted">{p.progress || 0}% done</small>
                <div className="pj-actions">
                  {p.status === 'upcoming' && <button className="btn ghost" onClick={() => move(p, 'current')}><Play size={14} /> Start</button>}
                  {p.status === 'current' && <button className="btn ghost" onClick={() => move(p, 'completed')}><CircleCheck size={14} /> Complete</button>}
                  <button className="btn ghost" onClick={() => openEdit(p)}><Pencil size={14} /> Edit</button>
                  {isAdmin && <button className="btn ghost pj-del" onClick={() => remove(p)}><Trash2 size={14} /> Delete</button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {form && (
        <div className="modal-bg" onClick={close}>
          <form className="modal panel pj-modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{editId ? 'Edit project' : 'Add project'}</h2>
            <div className="pj-grid">
              <label className="full">Project name
                <input value={form.name} onChange={set('name')} required autoFocus />
              </label>
              <label>Customer
                <input value={form.client} onChange={set('client')} />
              </label>
              <label>Project number
                <input value={form.project_no} onChange={set('project_no')} />
              </label>
              <label>Service
                <select value={form.service} onChange={set('service')}>
                  <option value="">Select service</option>
                  {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label>Quantity
                <input type="number" min="0" step="1" value={form.quantity} onChange={set('quantity')} />
              </label>
              <label>Status
                <select value={form.status} onChange={set('status')}>
                  <option value="upcoming">Upcoming</option>
                  <option value="current">Ongoing</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
              {form.status === 'current' && (
                <label>Progress (%)
                  <input type="number" min="0" max="100" value={form.progress} onChange={set('progress')} />
                </label>
              )}
              <label>Start date (optional)
                <input type="date" value={form.start_date} onChange={set('start_date')} />
              </label>
              <label>End date (optional)
                <input type="date" value={form.due_date} onChange={set('due_date')} />
              </label>
              <div className="full pj-who">
                <span>Add members</span>
                <div className="pj-chips">
                  {users.map((u) => (
                    <button type="button" key={u.id} className={'pj-chip' + (names(form.members).includes(uname(u)) ? ' on' : '')} onClick={() => toggleMember(uname(u))}>{uname(u)}</button>
                  ))}
                </div>
              </div>
              <label className="full">Description
                <textarea rows={3} value={form.description} onChange={set('description')} />
              </label>
            </div>
            {formErr && <p className="error">{formErr}</p>}
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={close}>Cancel</button>
              <button className="btn">{editId ? 'Save changes' : 'Add project'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}