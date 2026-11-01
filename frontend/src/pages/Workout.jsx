import { useEffect, useRef, useState } from 'react';
import { FileText, StickyNote, Paperclip, Download, Trash2, Lock, Image as ImageIcon, Upload, X } from 'lucide-react';
import { api } from '../api';
import './Workout.css';

// same address logic as api.js (needed here for file save, preview and download)
const BASE = import.meta.env.PROD ? (import.meta.env.VITE_API || '/api') : 'http://localhost:5000/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const MAX = 10 * 1024 * 1024;

const size = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');

// shows a saved image from the database
function Pic({ id, className, onClick }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let link = '';
    let gone = false;
    fetch(BASE + '/workout/' + id + '/download?view=1', { headers: auth() })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => { if (!gone) { link = URL.createObjectURL(b); setUrl(link); } })
      .catch(() => {});
    return () => { gone = true; if (link) URL.revokeObjectURL(link); };
  }, [id]);
  return url ? <img src={url} alt="" className={className} onClick={onClick} /> : <div className={'wk-pic-wait ' + (className || '')} />;
}

const TYPES = [
  ['note', 'Note', StickyNote],
  ['doc', 'Document', FileText],
  ['image', 'Image', ImageIcon],
];

export default function Workout() {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('all');
  const [type, setType] = useState('note');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [open, setOpen] = useState(null);
  const [view, setView] = useState(null); // image opened in big view
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const load = () => api.get('/workout').then(setItems).catch((x) => setMsg({ type: 'error', text: x.message }));
  useEffect(() => { load(); }, []);

  // small preview of the image you chose
  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) { setPreview(''); return undefined; }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const clearFile = () => { setFile(null); if (inputRef.current) inputRef.current.value = ''; };

  const changeType = (k) => {
    setType(k);
    setMsg({ type: '', text: '' });
    clearFile();
  };

  const choose = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > MAX) {
      setMsg({ type: 'error', text: 'File is too big (max 10 MB)' });
      clearFile();
      return;
    }
    setMsg({ type: '', text: '' });
    setFile(f);
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (type === 'note') {
        await api.post('/workout/note', { title, content });
      } else {
        if (!file) throw new Error(type === 'image' ? 'Choose an image first' : 'Choose a document first');
        const fd = new FormData();
        fd.append('title', title);
        fd.append('file', file);
        const r = await fetch(BASE + '/workout/file', { method: 'POST', headers: auth(), body: fd });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Save failed');
        clearFile();
      }
      setTitle('');
      setContent('');
      setMsg({ type: 'success', text: 'Saved' });
      load();
    } catch (x) { setMsg({ type: 'error', text: x.message }); }
    setBusy(false);
  };

  const download = async (it) => {
    try {
      const r = await fetch(BASE + '/workout/' + it.id + '/download', { headers: auth() });
      if (!r.ok) throw new Error('Download failed');
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url; a.download = it.file_name || 'file'; a.click();
      URL.revokeObjectURL(url);
    } catch (x) { setMsg({ type: 'error', text: x.message }); }
  };

  const remove = async (it) => {
    if (!window.confirm('Delete "' + it.title + '"?')) return;
    await api.del('/workout/' + it.id);
    load();
  };

  const TABS = [['all', 'All'], ['note', 'Notes'], ['doc', 'Documents'], ['image', 'Images']];
  const shown = items.filter((i) => {
    if (tab === 'all') return true;
    if (tab === 'doc') return i.kind === 'doc' || i.kind === 'file';
    return i.kind === tab;
  });

  return (
    <div>
      <div className="page-head"><h1>Workout</h1><span className="muted"><Lock size={13} /> Private. Only you can see these.</span></div>

      <form className="panel wk-save" onSubmit={save}>
        <h2>Save to Workout</h2>
        <div className="wk-types">
          {TYPES.map(([k, l, Icon]) => (
            <button key={k} type="button" className={'btn ghost' + (type === k ? ' on' : '')} onClick={() => changeType(k)}>
              <Icon size={15} /> {l}
            </button>
          ))}
        </div>

        <input placeholder={type === 'note' ? 'Title' : 'Title (optional)'} value={title}
          onChange={(e) => setTitle(e.target.value)} required={type === 'note'} />

        {type === 'note' && (
          <textarea rows={4} placeholder="Write your note" value={content} onChange={(e) => setContent(e.target.value)} />
        )}

        {type !== 'note' && (
          <div className="wk-file-row">
            <label className="wk-pick">
              <input type="file" hidden ref={inputRef} onChange={choose}
                accept={type === 'image' ? 'image/*' : '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv'} />
              <span className="btn ghost"><Upload size={15} /> Choose {type === 'image' ? 'image' : 'document'}</span>
            </label>
            <span className="wk-file-name">{file ? file.name + ' · ' + size(file.size) : 'No file chosen'}</span>
            {file && <button type="button" className="wk-clear" onClick={clearFile} aria-label="Remove chosen file"><X size={16} /></button>}
          </div>
        )}
        {type !== 'note' && preview && <img src={preview} alt="" className="wk-preview" />}
        {type !== 'note' && (
          <small className="muted">
            {type === 'image' ? 'JPG, PNG or any image, up to 10 MB.' : 'PDF, Word, Excel, PowerPoint or text file, up to 10 MB.'}
          </small>
        )}

        <div className="wk-save-row">
          <button className="btn" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
          {msg.text && <span className={'wk-msg ' + msg.type}>{msg.text}</span>}
        </div>
      </form>

      <div className="panel">
        <div className="wk-tabs">
          {TABS.map(([k, l]) => (
            <button key={k} className={'btn ghost' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        {shown.length === 0 && <p className="muted">Nothing saved here yet.</p>}
        {shown.map((it) => (
          <div key={it.id} className="wk-item">
            {it.kind === 'image'
              ? <Pic id={it.id} className="wk-thumb" onClick={() => setView(it)} />
              : <div className="wk-icon">{it.kind === 'note' ? <StickyNote size={20} /> : it.kind === 'doc' ? <FileText size={20} /> : <Paperclip size={20} />}</div>}
            <div className="wk-body">
              <b>{it.title}</b>
              <small className="muted">
                {it.kind === 'note' ? 'Note' : it.file_name + ' · ' + size(it.size)} · {it.created_at.slice(0, 16)}
              </small>
              {it.kind === 'note' && it.content && (
                <p className={'wk-text' + (open === it.id ? ' full' : '')} onClick={() => setOpen(open === it.id ? null : it.id)}>{it.content}</p>
              )}
            </div>
            <div className="wk-actions">
              {it.kind !== 'note' && <button className="btn ghost" onClick={() => download(it)} aria-label="Download"><Download size={16} /></button>}
              <button className="btn ghost" onClick={() => remove(it)} aria-label="Delete"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      {view && (
        <div className="wk-viewer" onClick={() => setView(null)}>
          <button type="button" className="wk-close" onClick={() => setView(null)} aria-label="Close"><X size={22} /></button>
          <Pic id={view.id} className="wk-big" />
        </div>
      )}
    </div>
  );
}