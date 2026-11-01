import { useEffect, useRef, useState } from 'react';
import { Send, Users, UserPlus, Paperclip, X, Trash2, Pencil, MoreVertical, FileText, Download, Check } from 'lucide-react';
import { api } from '../api';
import Avatar, { nm } from '../components/Avatar';
import './TeamChat.css';

// same address logic as api.js (needed for sending and opening files)
const BASE = import.meta.env.PROD ? (import.meta.env.VITE_API || '/api') : 'http://localhost:5000/api';
const authH = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const fsize = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
const getBlob = async (chat, m) => {
  const r = await fetch(`${BASE}/chats/${chat}/messages/${m.id}/file`, { headers: authH() });
  if (!r.ok) throw new Error('Could not open the file');
  return r.blob();
};

const GroupIcon = () => <span className="avatar grp" style={{ width: 42, height: 42 }}><Users size={20} /></span>;

function ChatImage({ chat, m }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let off = false;
    let u = '';
    getBlob(chat, m).then((b) => { if (!off) { u = URL.createObjectURL(b); setUrl(u); } }).catch(() => {});
    return () => { off = true; if (u) URL.revokeObjectURL(u); };
  }, [chat, m.id]);
  return url
    ? <img className="msg-img" src={url} alt={m.file_name} onClick={() => window.open(url, '_blank')} />
    : <div className="msg-img ph">Loading photo...</div>;
}

export default function TeamChat({ user }) {
  const [chats, setChats] = useState([]);
  const [people, setPeople] = useState([]);
  const [active, setActive] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(false);
  const [gname, setGname] = useState('');
  const [picked, setPicked] = useState([]);
  const [err, setErr] = useState('');
  const [file, setFile] = useState(null);
  const [prev, setPrev] = useState('');
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(null);
  const [menu, setMenu] = useState(null);
  const end = useRef(null);
  const fileRef = useRef(null);

  const loadChats = () => api.get('/chats').then((c) => { setChats(c); setActive((a) => a ?? c[0]?.id ?? null); }).catch(() => {});
  const loadMsgs = () => { if (active) api.get(`/chats/${active}/messages`).then(setMsgs).catch(() => {}); };

  useEffect(() => { api.get('/users').then(setPeople); loadChats(); const t = setInterval(loadChats, 4000); return () => clearInterval(t); }, []);
  useEffect(() => { setMsgs([]); loadMsgs(); const t = setInterval(loadMsgs, 3000); return () => clearInterval(t); }, [active]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs.length, active]);
  useEffect(() => { setEditing(null); setMenu(null); setFile(null); setErr(''); }, [active]);
  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) { setPrev(''); return; }
    const u = URL.createObjectURL(file);
    setPrev(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const title = (c) => (c.is_group ? c.name : nm(c.other));
  const cur = chats.find((c) => c.id === active);
  const ql = q.toLowerCase();
  const shown = chats.filter((c) => title(c).toLowerCase().includes(ql));
  const others = people.filter((p) => p.id !== user.id && nm(p).toLowerCase().includes(ql));
  const canDeleteChat = cur && !cur.is_team && (!cur.is_group || cur.created_by === user.id || user.role === 'admin');

  const startDm = async (id) => { const r = await api.post('/chats/dm', { user_id: id }); await loadChats(); setActive(r.id); };

  const pickFile = (e) => {
    const f = e.target.files[0];
    if (f) {
      if (f.size > 10 * 1024 * 1024) setErr('File is too big (max 10 MB)');
      else { setFile(f); setErr(''); }
    }
    e.target.value = '';
  };

  const send = async (e) => {
    e.preventDefault();
    if (!active || sending || (!text.trim() && !file)) return;
    setSending(true);
    try {
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('text', text.trim());
        const r = await fetch(`${BASE}/chats/${active}/file`, { method: 'POST', headers: authH(), body: fd });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Upload failed');
        setFile(null);
      } else {
        await api.post(`/chats/${active}/messages`, { text });
      }
      setText(''); setErr(''); loadMsgs(); loadChats();
    } catch (x) { setErr(x.message); }
    setSending(false);
  };

  const saveEdit = async () => {
    try {
      await api.put(`/chats/${active}/messages/${editing.id}`, { text: editing.text });
      setEditing(null); setErr(''); loadMsgs(); loadChats();
    } catch (x) { setErr(x.message); }
  };
  const delMsg = async (m) => {
    setMenu(null);
    if (!window.confirm('Delete this message for everyone?')) return;
    try { await api.del(`/chats/${active}/messages/${m.id}`); loadMsgs(); loadChats(); }
    catch (x) { setErr(x.message); }
  };
  const delChat = async () => {
    const msg = cur.is_group
      ? `Delete the group "${cur.name}" and all its messages for everyone?`
      : `Delete this chat with ${nm(cur.other)}? All messages will be removed for both of you.`;
    if (!window.confirm(msg)) return;
    try { await api.del('/chats/' + active); setActive(null); setMsgs([]); await loadChats(); }
    catch (x) { setErr(x.message); }
  };
  const saveFile = async (m) => {
    try {
      const url = URL.createObjectURL(await getBlob(active, m));
      const a = document.createElement('a');
      a.href = url; a.download = m.file_name; a.click();
      URL.revokeObjectURL(url);
    } catch (x) { setErr(x.message); }
  };

  const createGroup = async (e) => {
    e.preventDefault();
    try {
      const r = await api.post('/chats/group', { name: gname, member_ids: picked });
      setModal(false); setGname(''); setPicked([]); setErr('');
      await loadChats(); setActive(r.id);
    } catch (x) { setErr(x.message); }
  };
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="wa">
      <aside className="wa-side">
        <div className="wa-top">
          <h2>Chats</h2>
          <button className="btn" onClick={() => setModal(true)}><UserPlus size={16} /> New group</button>
        </div>
        <input className="wa-search" placeholder="Search people or groups" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="wa-list">
          {shown.map((c) => (
            <button key={c.id} className={'wa-item' + (c.id === active ? ' on' : '')} onClick={() => setActive(c.id)}>
              {c.is_group ? <GroupIcon /> : <Avatar u={c.other} size={42} />}
              <div className="wa-meta">
                <b>{title(c)}</b>
                <span className="muted">{c.last_text || (c.is_group ? c.member_count + ' members' : 'Say hello')}</span>
              </div>
              {c.unread > 0 && c.id !== active && <b className="badge">{c.unread}</b>}
            </button>
          ))}
          <div className="wa-label">Team members</div>
          {others.map((p) => (
            <button key={p.id} className="wa-item" onClick={() => startDm(p.id)}>
              <Avatar u={p} size={42} />
              <div className="wa-meta">
                <b>{nm(p)}</b>
                <span className="muted">{p.job_role || (p.role === 'admin' ? 'Admin' : 'Member')}</span>
                <span className="wa-phone">{p.mobile ? 'Mobile: ' + p.mobile : 'No mobile number'}</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="wa-main">
        {cur ? (
          <>
            <div className="wa-head">
              {cur.is_group ? <GroupIcon /> : <Avatar u={cur.other} size={42} />}
              <div className="grow"><b>{title(cur)}</b><div className="muted">{cur.is_group ? cur.member_count + ' members' : cur.other?.username}</div></div>
              {canDeleteChat && <button className="btn ghost" onClick={delChat} aria-label="Delete chat" title="Delete chat"><Trash2 size={18} /></button>}
            </div>
            <div className="wa-msgs" onClick={() => setMenu(null)}>
              {msgs.length === 0 && <p className="muted">No messages yet.</p>}
              {msgs.map((m) => {
                const mine = m.user_id === user.id;
                const isImg = m.file_name && (m.file_mime || '').startsWith('image/');
                const canEdit = mine && !m.deleted;
                const canDel = !m.deleted && (mine || user.role === 'admin');
                const isEditing = editing?.id === m.id;
                return (
                  <div key={m.id} className={'msg' + (mine ? ' mine' : '') + (m.deleted ? ' gone' : '') + ((canEdit || canDel) && !isEditing ? ' hasmenu' : '')}>
                    {!!cur.is_group && !mine && <small className="who-name">{m.full_name || m.username}</small>}
                    {m.deleted ? <p className="gone-text">This message was deleted</p> : (
                      <>
                        {isImg && <ChatImage chat={active} m={m} />}
                        {m.file_name && !isImg && (
                          <div className="msg-file">
                            <FileText size={26} />
                            <div className="msg-file-info"><b>{m.file_name}</b><span>{fsize(m.file_size)}</span></div>
                            <button type="button" className="msg-file-dl" onClick={() => saveFile(m)} aria-label="Download"><Download size={18} /></button>
                          </div>
                        )}
                        {isEditing ? (
                          <div className="edit-box">
                            <input
                              autoFocus
                              value={editing.text}
                              onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(null); }}
                            />
                            <button type="button" className="btn" onClick={saveEdit} aria-label="Save edit"><Check size={16} /></button>
                            <button type="button" className="btn ghost" onClick={() => setEditing(null)} aria-label="Cancel edit"><X size={16} /></button>
                          </div>
                        ) : (m.text ? <p>{m.text}</p> : null)}
                      </>
                    )}
                    <small>{m.edited && !m.deleted ? 'edited · ' : ''}{m.created_at.slice(11, 16)}</small>
                    {(canEdit || canDel) && !isEditing && (
                      <div className="msg-menu-wrap">
                        <button type="button" className="msg-dots" onClick={(e) => { e.stopPropagation(); setMenu(menu === m.id ? null : m.id); }} aria-label="Message options"><MoreVertical size={16} /></button>
                        {menu === m.id && (
                          <div className="msg-menu" onClick={(e) => e.stopPropagation()}>
                            {canEdit && <button type="button" onClick={() => { setEditing({ id: m.id, text: m.text }); setMenu(null); }}><Pencil size={14} /> Edit</button>}
                            {canDel && <button type="button" onClick={() => delMsg(m)}><Trash2 size={14} /> Delete</button>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={end} />
            </div>
            {err && <p className="error">{err}</p>}
            {file && (
              <div className="wa-attach">
                {prev ? <img src={prev} alt="" /> : <FileText size={34} />}
                <div className="wa-attach-info"><b>{file.name}</b><span className="muted">{fsize(file.size)}</span></div>
                <button type="button" className="btn ghost" onClick={() => setFile(null)} aria-label="Remove attachment"><X size={16} /></button>
              </div>
            )}
            <form className="wa-form" onSubmit={send}>
              <input type="file" ref={fileRef} hidden onChange={pickFile} />
              <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()} aria-label="Attach photo or file" title="Attach photo or file"><Paperclip size={18} /></button>
              <input placeholder={file ? 'Add a caption (optional)' : 'Type a message'} value={text} onChange={(e) => setText(e.target.value)} />
              <button className="btn" aria-label="Send" disabled={sending}><Send size={18} /></button>
            </form>
          </>
        ) : <p className="muted wa-empty">Pick a person or group to start chatting.</p>}
      </section>

      {modal && (
        <div className="modal-bg" onClick={() => setModal(false)}>
          <form className="modal panel" onClick={(e) => e.stopPropagation()} onSubmit={createGroup}>
            <h2>New group</h2>
            <input placeholder="Group name" value={gname} onChange={(e) => setGname(e.target.value)} required />
            <div className="pick-list">
              {people.filter((p) => p.id !== user.id).map((p) => (
                <label key={p.id} className="pick">
                  <input type="checkbox" checked={picked.includes(p.id)} onChange={() => toggle(p.id)} />
                  <Avatar u={p} size={30} /> {nm(p)}
                </label>
              ))}
            </div>
            {err && <p className="error">{err}</p>}
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn">Create group</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}