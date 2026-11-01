import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Users, Play, CircleCheck, Search } from 'lucide-react';
import { api } from '../api';
import './ProjectTracker.css';

const pad = (n) => String(n).padStart(2, '0');
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

const STATUS = { current: 'Ongoing', upcoming: 'Upcoming', completed: 'Completed' };
const RANK = { current: 0, upcoming: 1, completed: 2 };
const STATUS_FILTERS = [['all', 'All status'], ['current', 'Ongoing'], ['completed', 'Completed'], ['upcoming', 'Upcoming']];
const SERVICES = ['New project', 'Service project', 'R&D project'];
const BLANK = {
  name: '', client: '', project_no: '', service: 'New project', quantity: '', members: '',
  description: '', status: 'upcoming', progress: 0, start_date: '', due_date: '',
};
const names = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);
const uname = (u) => u.full_name || u.username;
const clampPct = (v) => Math.min(100, Math.max(0, Math.round(+v || 0)));

// small box where you type the work progress (for example 5, 10, 15) and press Update
function ProgressEntry({ value, onSave }) {
  const [v, setV] = useState(String(value));
  useEffect(() => { setV(String(value)); }, [value]);
  const submit = (e) => { e.preventDefault(); onSave(clampPct(v)); };
  return (
    <form className="pj-enter" onSubmit={submit}>
      <label>
        <span>Enter work progress (%)</span>
        <input type="number" min="0" max="100" value={v} onChange={(e) => setV(e.target.value)} placeholder="e.g. 5, 10, 15" />
      </label>
      <button className="btn" type="submit">Update</button>
    </form>
  );
}

export default function ProjectTracker({ user, start = 'all' }) {
  const isAdmin = user.role === 'admin';
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [statusF, setStatusF] = useState(start);
  const [typeF, setTypeF] = useState('all');
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [formErr, setFormErr] = useState('');
  const [err, setErr] = useState('');

  const load = () => api.get('/projects').then(setProjects).catch((x) => setErr(x.message));
  useEffect(() => { load(); api.get('/users').then(setUsers).catch(() => {}); }, []);

  const countStatus = (s) => (s === 'all' ? projects.length : projects.filter((p) => p.status === s).length);
  const countType = (t) => (t === 'all' ? projects.length : projects.filter((p) => p.service === t).length);

  const ql = q.trim().toLowerCase();
  const shown = projects
    .filter((p) => statusF === 'all' || p.status === statusF)
    .filter((p) => typeF === 'all' || p.service === typeF)
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
    setForm({
      ...BLANK,
      status: statusF !== 'all' ? statusF : 'upcoming',
      service: typeF !== 'all' ? typeF : 'New project',
    });
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
    let status = form.status;
    const progress = status === 'completed' ? 100 : status === 'upcoming' ? 0 : clampPct(form.progress);
    if (status === 'current' && progress >= 100) status = 'completed';
    try {
      const body = { ...form, status, progress: status === 'completed' ? 100 : progress };
      if (editId) await api.put('/projects/' + editId, body);
      else await api.post('/projects', body);
      close(); setErr(''); load();
    } catch (x) { setFormErr(x.message); }
  };

  // Start button: upcoming -> ongoing
  const startProject = async (p) => {
    try { await api.put('/projects/' + p.id, { status: 'current' }); setErr(''); load(); }
    catch (x) { setErr(x.message); }
  };
  const complete = async (p) => {
    try { await api.put('/projects/' + p.id, { status: 'completed', progress: 100 }); setErr(''); load(); }
    catch (x) { setErr(x.message); }
  };
  // typed progress: 100 moves the project to Completed
  const saveProgress = async (p, v) => {
    try {
      await api.put('/projects/' + p.id, v >= 100 ? { progress: 100, status: 'completed' } : { progress: v });
      setErr(''); load();
    } catch (x) { setErr(x.message); }
  };
  const remove = async (p) => {
    if (!window.confirm('Delete the project "' + p.name + '"? This cannot be undone.')) return;
    try { await api.del('/projects/' + p.id); setErr(''); load(); }
    catch (x) { setErr(x.message); }
  };

  const cards = [
    ['all', 'Total', countStatus('all')],
    ['current', 'Ongoing', countStatus('current')],
    ['completed', 'Completed', countStatus('completed')],
    ['upcoming', 'Upcoming', countStatus('upcoming')],
  ];

  return (
    <div>
      <div className="page-head">
        <h1>Projects</h1>
        <button className="btn" onClick={openAdd}><Plus size={16} /> Add project</button>
      </div>

      {/* TOP: Total / Ongoing / Completed / Upcoming */}
      <div className="pj-top-stats">
        {cards.map(([k, label, n]) => (
          <button key={k} type="button" className={'panel pj-tile ' + k + (statusF === k ? ' on' : '')} onClick={() => setStatusF(k)}>
            <b>{n}</b>
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="pj-layout">
        {/* LEFT: two filters */}
        <aside className="panel pj-side">
          <h3>Project type</h3>
          <button type="button" className={'pj-filter' + (typeF === 'all' ? ' on' : '')} onClick={() => setTypeF('all')}>
            <span className="pj-filter-name">All types</span><b className="pj-filter-n">{countType('all')}</b>
          </button>
          {SERVICES.map((s) => (
            <button key={s} type="button" className={'pj-filter' + (typeF === s ? ' on' : '')} onClick={() => setTypeF(s)}>
              <span className="pj-filter-name">{s}</span><b className="pj-filter-n">{countType(s)}</b>
            </button>
          ))}

          <h3 className="pj-h3-gap">Status</h3>
          {STATUS_FILTERS.map(([k, label]) => (
            <button key={k} type="button" className={'pj-filter ' + k + (statusF === k ? ' on' : '')} onClick={() => setStatusF(k)}>
              <i className="pj-dot" />
              <span className="pj-filter-name">{label}</span>
              <b className="pj-filter-n">{countStatus(k)}</b>
            </button>
          ))}
        </aside>

        {/* RIGHT: search + project cards */}
        <div className="pj-main">
          <div className="pj-search">
            <Search size={16} />
            <input placeholder="Search by project name, customer or project number" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {err && <p className="error">{err}</p>}

          {shown.length === 0 && (
            <p className="muted">{projects.length === 0 ? 'No projects yet. Click "Add project" to create the first one.' : 'No projects match these filters.'}</p>
          )}

          <div className="pj-list">
            {shown.map((p) => {
              const late = p.status === 'current' && p.due_date && p.due_date < today;
              return (
                <div key={p.id} className={'panel pj-card ' + p.status + (late ? ' late' : '')}>
                  <div className="pj-head">
                    <div className="pj-title">
                      <b className="pj-name">{p.name}</b>
                      <div className="pj-sub">{[p.project_no && 'No. ' + p.project_no, p.client].filter(Boolean).join(' · ') || 'No customer yet'}</div>
                    </div>
                    <span className={'pj-status ' + p.status}>{late ? 'Overdue' : STATUS[p.status] || p.status}</span>
                  </div>

                  <div className="pj-facts">
                    <div className="pj-fact"><small>Project type</small><b>{p.service || '-'}</b></div>
                    <div className="pj-fact"><small>Quantity</small><b>{p.quantity || '-'}</b></div>
                    <div className="pj-fact"><small>Start</small><b>{p.start_date || 'TBD'}</b></div>
                    <div className="pj-fact"><small>End</small><b>{p.due_date || 'TBD'}</b></div>
                  </div>

                  {p.members ? <div className="pj-members"><Users size={14} /> {p.members}</div> : null}
                  {p.description ? <p className="pj-desc">{p.description}</p> : null}

                  <div className="pj-progress">
                    <div className="pj-bar"><span style={{ width: (p.progress || 0) + '%' }} /></div>
                    <b className="pj-pct">{p.progress || 0}%</b>
                  </div>

                  {p.status === 'current' && <ProgressEntry value={p.progress || 0} onSave={(v) => saveProgress(p, v)} />}

                  <div className="pj-actions">
                    {p.status === 'upcoming' && <button className="btn ghost" onClick={() => startProject(p)}><Play size={14} /> Start</button>}
                    {p.status === 'current' && <button className="btn ghost" onClick={() => complete(p)}><CircleCheck size={14} /> Complete</button>}
                    <button className="btn ghost" onClick={() => openEdit(p)}><Pencil size={14} /> Edit</button>
                    {isAdmin && <button className="btn ghost pj-del" onClick={() => remove(p)}><Trash2 size={14} /> Delete</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {form && (
        <div className="pj-overlay" onClick={close}>
          <form className="pj-dialog" onClick={(e) => e.stopPropagation()} onSubmit={save}>
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
              <label>Project type
                <select value={form.service} onChange={set('service')}>
                  <option value="">Select type</option>
                  {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label>Quantity
                <input value={form.quantity} onChange={set('quantity')} placeholder="e.g. 10 nos, 5 sets" maxLength={40} />
              </label>
              <label>Status
                <select value={form.status} onChange={set('status')}>
                  <option value="upcoming">Upcoming</option>
                  <option value="current">Ongoing</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
              {form.status === 'current' ? (
                <label>Work progress (%)
                  <input type="number" min="0" max="100" value={form.progress} onChange={set('progress')} placeholder="e.g. 5, 10, 15" />
                </label>
              ) : <div className="pj-spacer" />}
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
            <div className="pj-dialog-actions">
              <button type="button" className="btn ghost" onClick={close}>Cancel</button>
              <button className="btn">{editId ? 'Save changes' : 'Add project'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}