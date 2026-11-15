require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(cors());
app.use(express.json({ limit: '3mb' }));
app.use(async (req, res, next) => {
  try {
    await initPromise;
    next();
  } catch (error) {
    console.error('Database initialization failed:', error);
    res.status(500).json({ error: 'Database initialization failed' });
  }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB per file

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 4000),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
 ssl: {
  ca: process.env.DB_CA_CERT_BASE64
    ? Buffer.from(process.env.DB_CA_CERT_BASE64, 'base64')
    : fs.readFileSync(path.join(__dirname, 'ca.pem')),
},
  dateStrings: true,
  connectionLimit: 10,
});
const SECRET = process.env.JWT_SECRET || 'change-me';

const auth = async (req, res, next) => {
  try {
    const t = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET);
    const [[u]] = await db.query('SELECT id, username, role FROM users WHERE id=?', [t.id]);
    if (!u) throw new Error('gone');
    req.user = u;
    next();
  } catch {
    res.status(401).json({ error: 'Please log in again' });
  }
};
const admin = (req, res, next) =>
  req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Only admin can do this' });
const wrap = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    console.error(e);
    res.status(500).json({ error: e.code === 'ER_DUP_ENTRY' ? 'That username already exists' : 'Server error' });
  });
const clean = (v) => (v === '' || v === undefined ? null : v);
const log = (kind, text) => db.query('INSERT INTO activity (kind,text) VALUES (?,?)', [kind, text]).catch(() => {});
const teamChatId = async () => (await db.query('SELECT id FROM chats WHERE is_group=1 ORDER BY id LIMIT 1'))[0][0]?.id;
const t12 = (t) => { const h = +t.slice(0, 2); return `${h % 12 || 12}:${t.slice(3, 5)} ${h < 12 ? 'AM' : 'PM'}`; };

// ---------- Auth ----------
app.post('/api/login', wrap(async (req, res) => {
  const { username, password } = req.body;
  const [[u]] = await db.query('SELECT * FROM users WHERE username=?', [username || '']);
  if (!u || !(await bcrypt.compare(password || '', u.password_hash)))
    return res.status(401).json({ error: 'Wrong username or password' });
  const user = { id: u.id, username: u.username, role: u.role };
  res.json({ token: jwt.sign(user, SECRET, { expiresIn: '12h' }), user });
}));

app.post('/api/change-password', auth, wrap(async (req, res) => {
  const { current, next } = req.body;
  if (!next || next.length < 6) return res.status(400).json({ error: 'New password needs at least 6 characters' });
  const [[u]] = await db.query('SELECT * FROM users WHERE id=?', [req.user.id]);
  if (!(await bcrypt.compare(current || '', u.password_hash)))
    return res.status(400).json({ error: 'Current password is wrong' });
  await db.query('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(next, 10), u.id]);
  res.json({ ok: true });
}));

// ---------- Users / Access (admin) ----------
app.get('/api/users', auth, wrap(async (req, res) => {
  const [r] = await db.query('SELECT id, username, role, full_name, job_role, mobile, photo, created_at FROM users ORDER BY COALESCE(full_name, username)');
  res.json(r);
}));
app.post('/api/users', auth, admin, wrap(async (req, res) => {
  const { username, password, role, full_name, job_role } = req.body;
  const pw = password || 'Dellner@PM';
  if (!username?.trim() || pw.length < 6)
    return res.status(400).json({ error: 'Enter a username (password must be 6+ characters)' });
  const [r] = await db.query('INSERT INTO users (username,password_hash,role,full_name,job_role) VALUES (?,?,?,?,?)',
    [username.trim(), await bcrypt.hash(pw, 10), role === 'admin' ? 'admin' : 'member', clean(full_name) || username.trim(), clean(job_role)]);
  const tc = await teamChatId();
  if (tc) await db.query('INSERT IGNORE INTO chat_members (chat_id,user_id) VALUES (?,?)', [tc, r.insertId]);
  log('team', `${req.user.username} gave access to new member "${username.trim()}"`);
  res.json({ ok: true });
}));
app.put('/api/users/:id/role', auth, admin, wrap(async (req, res) => {
  if (+req.params.id === req.user.id) return res.status(400).json({ error: 'You cannot change your own role' });
  await db.query('UPDATE users SET role=? WHERE id=?', [req.body.role === 'admin' ? 'admin' : 'member', req.params.id]);
  res.json({ ok: true });
}));
app.put('/api/users/:id/password', auth, admin, wrap(async (req, res) => {
  if (!req.body.password || req.body.password.length < 6)
    return res.status(400).json({ error: 'Password needs at least 6 characters' });
  await db.query('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(req.body.password, 10), req.params.id]);
  res.json({ ok: true });
}));
app.delete('/api/users/:id', auth, admin, wrap(async (req, res) => {
  const id = +req.params.id;
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });
  await db.query('DELETE FROM chat_members WHERE user_id=?', [id]);
  await db.query('DELETE FROM todos WHERE user_id=?', [id]);
  await db.query('DELETE FROM workout_items WHERE user_id=?', [id]);
  await db.query('DELETE FROM meetings WHERE user_id=?', [id]);
  await db.query('DELETE FROM notes WHERE user_id=?', [id]);
  await db.query('DELETE FROM leaves WHERE user_id=?', [id]);
  await db.query('DELETE FROM notif_clear WHERE user_id=?', [id]);
  await db.query('DELETE FROM users WHERE id=?', [id]);
  res.json({ ok: true });
}));

// ---------- Projects (one page: upcoming / current (ongoing) / completed) ----------
const PROJECT_FIELDS = ['name', 'client', 'project_no', 'service', 'quantity', 'owner', 'members', 'description', 'status', 'progress', 'start_date', 'due_date'];
const STATUSES = ['upcoming', 'current', 'completed'];
const SERVICES = ['New project', 'Service project', 'R&D project'];
const projectValue = (k, v) => {
  if (k === 'progress') return Math.min(100, Math.max(0, parseInt(v, 10) || 0));

  if (k === 'service') return SERVICES.includes(v) ? v : null;
  return clean(typeof v === 'string' ? v.trim() : v);
};
app.get('/api/projects', auth, wrap(async (req, res) => {
  const { status } = req.query;
  const [r] = status
    ? await db.query('SELECT * FROM projects WHERE status=? ORDER BY (due_date IS NULL), due_date', [status])
    : await db.query('SELECT * FROM projects ORDER BY (due_date IS NULL), due_date');
  res.json(r);
}));
app.post('/api/projects', auth, wrap(async (req, res) => {
  const b = req.body;
  if (!b.name?.trim()) return res.status(400).json({ error: 'Project name is required' });
  if (b.start_date && b.due_date && b.due_date < b.start_date) return res.status(400).json({ error: 'End date is before start date' });
  const status = STATUSES.includes(b.status) ? b.status : 'upcoming';
  const [r] = await db.query(
    'INSERT INTO projects (name,client,project_no,service,quantity,members,description,status,progress,start_date,due_date) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [b.name.trim(), projectValue('client', b.client), projectValue('project_no', b.project_no), projectValue('service', b.service),
      projectValue('quantity', b.quantity), projectValue('members', b.members), projectValue('description', b.description),
      status, projectValue('progress', b.progress), clean(b.start_date), clean(b.due_date)]);
  log('project', `${req.user.username} added project "${b.name.trim()}" (${status})`);
  res.json({ id: r.insertId });
}));
app.put('/api/projects/:id', auth, wrap(async (req, res) => {
  const b = req.body;
  const f = PROJECT_FIELDS.filter((k) => k in b);
  if (!f.length) return res.json({ ok: true });
  if ('status' in b && !STATUSES.includes(b.status)) return res.status(400).json({ error: 'Choose a valid status' });
  if ('name' in b && !String(b.name || '').trim()) return res.status(400).json({ error: 'Project name is required' });
  if (b.start_date && b.due_date && b.due_date < b.start_date) return res.status(400).json({ error: 'End date is before start date' });
  await db.query(`UPDATE projects SET ${f.map((k) => k + '=?').join(',')} WHERE id=?`,
    [...f.map((k) => projectValue(k, b[k])), req.params.id]);
  const [[p]] = await db.query('SELECT name, progress, status FROM projects WHERE id=?', [req.params.id]);
  if (p && ('progress' in b || 'status' in b))
    log('progress', `${req.user.username} updated "${p.name}": ${p.progress}% done, ${p.status}`);
  res.json({ ok: true });
}));
app.delete('/api/projects/:id', auth, admin, wrap(async (req, res) => {
  await db.query('DELETE FROM projects WHERE id=?', [req.params.id]);
  res.json({ ok: true });
}));

app.get('/api/stats', auth, wrap(async (req, res) => {
  const [r] = await db.query('SELECT status, COUNT(*) AS n FROM projects GROUP BY status');
  const out = { upcoming: 0, current: 0, completed: 0 };
  r.forEach((x) => (out[x.status] = x.n));
  res.json(out);
}));

// ---------- Meetings (calendar booking, visible to everyone) ----------
app.get('/api/meetings', auth, wrap(async (req, res) => {
  const [r] = await db.query(
    `SELECT m.id, m.user_id, m.title, m.meet_date, m.meet_time, m.place, m.attendees,
            COALESCE(u.full_name, u.username) AS creator
     FROM meetings m JOIN users u ON u.id=m.user_id
     WHERE m.meet_date >= DATE_SUB(CURDATE(), INTERVAL 62 DAY)
     ORDER BY m.meet_date, m.meet_time, m.id`);
  res.json(r);
}));
app.post('/api/meetings', auth, wrap(async (req, res) => {
  const { title, meet_date, meet_time, place, attendees } = req.body;
  if (!title?.trim() || !meet_date || !meet_time)
    return res.status(400).json({ error: 'Enter the meeting title, date and time' });
  await db.query('INSERT INTO meetings (user_id,title,meet_date,meet_time,place,attendees) VALUES (?,?,?,?,?,?)',
    [req.user.id, title.trim(), meet_date, meet_time, clean(place), clean(attendees)]);
  log('meeting', `${req.user.username} booked "${title.trim()}" on ${meet_date} at ${t12(meet_time.length === 5 ? meet_time + ':00' : meet_time)}`);
  res.json({ ok: true });
}));
app.delete('/api/meetings/:id', auth, wrap(async (req, res) => {
  await db.query('DELETE FROM meetings WHERE id=? AND (user_id=? OR ?)', [req.params.id, req.user.id, req.user.role === 'admin']);
  res.json({ ok: true });
}));

// ---------- Profile ----------
app.get('/api/me', auth, wrap(async (req, res) => {
  const [[u]] = await db.query('SELECT id, username, role, full_name, dob, gender, job_role, mobile, email, photo FROM users WHERE id=?', [req.user.id]);
  res.json(u);
}));
app.put('/api/me', auth, wrap(async (req, res) => {
  const b = req.body;
  const mobile = (b.mobile || '').trim();
  const email = (b.email || '').trim();
  if (mobile && !/^\+?[0-9 ()-]{7,20}$/.test(mobile)) return res.status(400).json({ error: 'Enter a valid mobile number' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email ID' });
  await db.query('UPDATE users SET full_name=?, dob=?, gender=?, job_role=?, mobile=?, email=?, photo=? WHERE id=?',
    [clean(b.full_name), clean(b.dob), clean(b.gender), clean(b.job_role), clean(mobile), clean(email), clean(b.photo), req.user.id]);
  res.json({ ok: true });
}));

app.get('/api/birthdays', auth, wrap(async (req, res) => {
  const [r] = await db.query(`SELECT id, username, full_name, photo FROM users
    WHERE dob IS NOT NULL AND DATE_FORMAT(dob,'%m-%d') = DATE_FORMAT(CURDATE(),'%m-%d')`);
  res.json(r);
}));

// ---------- Notifications (meetings, to-do reminders at 1 PM and 4 PM, chat messages) ----------
app.get('/api/notifications', auth, wrap(async (req, res) => {
  const uid = req.user.id;
  const out = [];
  const [[cl]] = await db.query('SELECT cleared_at FROM notif_clear WHERE user_id=?', [uid]);
  const since = cl ? cl.cleared_at : '1970-01-01 00:00:01';

  // 1. meeting updates
  const [mt] = await db.query(
    "SELECT text, created_at FROM activity WHERE kind='meeting' AND created_at > ? ORDER BY id DESC LIMIT 20", [since]);
  mt.forEach((x) => out.push({ kind: 'meeting', text: x.text, at: x.created_at }));

  // 2. to-do reminder: only from 1 PM and from 4 PM, only if something is not completed
  const d = new Date();
  const hour = d.getHours() >= 16 ? 16 : d.getHours() >= 13 ? 13 : null;
  if (hour) {
    const p = (n) => String(n).padStart(2, '0');
    const slot = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(hour)}:00:00`;
    if (since < slot) {
      const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM todos WHERE user_id=?', [uid]);
      if (n > 0) out.push({ kind: 'todo', text: `${hour === 13 ? '1 PM' : '4 PM'} reminder: you have ${n} to-do${n > 1 ? 's' : ''} not completed`, at: slot });
    }
  }

  // 3. chat messages sent to you
  const [c] = await db.query(
    `SELECT c.is_group, COALESCE(c.name, (SELECT COALESCE(u.full_name,u.username) FROM chat_members x JOIN users u ON u.id=x.user_id
       WHERE x.chat_id=c.id AND x.user_id<>?)) AS title, COUNT(m.id) AS n, MAX(m.created_at) AS at
     FROM chats c JOIN chat_members cm ON cm.chat_id=c.id AND cm.user_id=?
     JOIN messages m ON m.chat_id=c.id AND m.id>cm.last_read AND m.user_id<>? AND m.deleted=0 AND m.created_at > ?
     GROUP BY c.id, c.name, c.is_group`, [uid, uid, uid, since]);
  c.forEach((x) => out.push({ kind: 'chat', at: x.at,
    text: x.is_group ? `${x.n} new message${x.n > 1 ? 's' : ''} in ${x.title}` : `${x.title} sent you ${x.n} new message${x.n > 1 ? 's' : ''}` }));

  out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  res.json(out);
}));

// Clear button: hide everything shown so far
app.post('/api/notifications/clear', auth, wrap(async (req, res) => {
  await db.query('INSERT INTO notif_clear (user_id, cleared_at) VALUES (?, NOW()) ON DUPLICATE KEY UPDATE cleared_at=NOW()', [req.user.id]);
  res.json({ ok: true });
}));

// ---------- Chats (direct + group, with edit, delete and file sharing) ----------
const isMember = async (chatId, userId) =>
  (await db.query('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?', [chatId, userId]))[0].length > 0;

app.get('/api/chats', auth, wrap(async (req, res) => {
  const uid = req.user.id;
  const tc = await teamChatId();
  const [chats] = await db.query(
    `SELECT c.id, c.name, c.is_group, c.created_by,
       (SELECT COUNT(*) FROM chat_members x WHERE x.chat_id=c.id) AS member_count,
       (SELECT COUNT(*) FROM messages m WHERE m.chat_id=c.id AND m.id>cm.last_read AND m.user_id<>? AND m.deleted=0) AS unread,
       (SELECT CASE WHEN m.deleted=1 THEN 'Message deleted'
                    WHEN m.file_name IS NOT NULL THEN IF(m.file_mime LIKE 'image/%', 'Photo', CONCAT('File: ', m.file_name))
                    ELSE m.text END
          FROM messages m WHERE m.chat_id=c.id ORDER BY m.id DESC LIMIT 1) AS last_text,
       (SELECT m.created_at FROM messages m WHERE m.chat_id=c.id ORDER BY m.id DESC LIMIT 1) AS last_at
     FROM chats c JOIN chat_members cm ON cm.chat_id=c.id AND cm.user_id=?
     ORDER BY last_at DESC, c.id`, [uid, uid]);
  for (const c of chats) {
    c.is_team = c.id === tc;
    if (!c.is_group) {
      const [[o]] = await db.query(
        'SELECT u.id, u.username, u.full_name, u.photo FROM chat_members cm JOIN users u ON u.id=cm.user_id WHERE cm.chat_id=? AND cm.user_id<>?',
        [c.id, uid]);
      c.other = o || null;
    }
  }
  res.json(chats);
}));

app.post('/api/chats/dm', auth, wrap(async (req, res) => {
  const other = +req.body.user_id;
  if (!other || other === req.user.id) return res.status(400).json({ error: 'Choose a team member' });
  const [[ex]] = await db.query(
    `SELECT c.id FROM chats c WHERE c.is_group=0
       AND EXISTS (SELECT 1 FROM chat_members WHERE chat_id=c.id AND user_id=?)
       AND EXISTS (SELECT 1 FROM chat_members WHERE chat_id=c.id AND user_id=?) LIMIT 1`, [req.user.id, other]);
  if (ex) return res.json({ id: ex.id });
  const [r] = await db.query('INSERT INTO chats (is_group, created_by) VALUES (0, ?)', [req.user.id]);
  await db.query('INSERT INTO chat_members (chat_id,user_id) VALUES (?,?),(?,?)', [r.insertId, req.user.id, r.insertId, other]);
  res.json({ id: r.insertId });
}));

app.post('/api/chats/group', auth, wrap(async (req, res) => {
  const { name, member_ids } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Give the group a name' });
  const ids = [...new Set([req.user.id, ...(member_ids || []).map(Number)])];
  if (ids.length < 2) return res.status(400).json({ error: 'Pick at least one member' });
  const [r] = await db.query('INSERT INTO chats (name, is_group, created_by) VALUES (?,1,?)', [name.trim(), req.user.id]);
  for (const id of ids) await db.query('INSERT IGNORE INTO chat_members (chat_id,user_id) VALUES (?,?)', [r.insertId, id]);
  res.json({ id: r.insertId });
}));

// delete a whole chat (one-to-one: removed for both people; group: creator or admin only)
app.delete('/api/chats/:id', auth, wrap(async (req, res) => {
  const id = +req.params.id;
  if (!(await isMember(id, req.user.id))) return res.status(403).json({ error: 'You are not in this chat' });
  const [[c]] = await db.query('SELECT id, is_group, created_by FROM chats WHERE id=?', [id]);
  if (!c) return res.json({ ok: true });
  if (id === (await teamChatId())) return res.status(400).json({ error: 'The team group cannot be deleted' });
  if (c.is_group && c.created_by !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Only the group creator or an admin can delete this group' });
  await db.query('DELETE FROM messages WHERE chat_id=?', [id]);
  await db.query('DELETE FROM chat_members WHERE chat_id=?', [id]);
  await db.query('DELETE FROM chats WHERE id=?', [id]);
  res.json({ ok: true });
}));

app.get('/api/chats/:id/messages', auth, wrap(async (req, res) => {
  if (!(await isMember(req.params.id, req.user.id))) return res.status(403).json({ error: 'You are not in this chat' });
  const [r] = await db.query(
    `SELECT * FROM (SELECT m.id, m.text, m.created_at, m.user_id, m.edited, m.deleted,
         m.file_name, m.file_mime, m.file_size, u.username, u.full_name
       FROM messages m JOIN users u ON u.id=m.user_id WHERE m.chat_id=? ORDER BY m.id DESC LIMIT 200) t ORDER BY id`, [req.params.id]);
  if (r.length) await db.query('UPDATE chat_members SET last_read=? WHERE chat_id=? AND user_id=?', [r[r.length - 1].id, req.params.id, req.user.id]);
  res.json(r);
}));

app.post('/api/chats/:id/messages', auth, wrap(async (req, res) => {
  if (!(await isMember(req.params.id, req.user.id))) return res.status(403).json({ error: 'You are not in this chat' });
  if (!req.body.text?.trim()) return res.status(400).json({ error: 'Message is empty' });
  await db.query('INSERT INTO messages (chat_id,user_id,text) VALUES (?,?,?)', [req.params.id, req.user.id, req.body.text.trim()]);
  res.json({ ok: true });
}));

// send a photo or file (text is an optional caption)
app.post('/api/chats/:id/file', auth, upload.single('file'), wrap(async (req, res) => {
  if (!(await isMember(req.params.id, req.user.id))) return res.status(403).json({ error: 'You are not in this chat' });
  const f = req.file;
  if (!f) return res.status(400).json({ error: 'Choose a file (max 10 MB)' });
  await db.query('INSERT INTO messages (chat_id,user_id,text,file_name,file_mime,file_size,file_data) VALUES (?,?,?,?,?,?,?)',
    [req.params.id, req.user.id, (req.body.text || '').trim(), f.originalname, f.mimetype, f.size, f.buffer]);
  res.json({ ok: true });
}));

// open or download a photo / file from a message
app.get('/api/chats/:id/messages/:mid/file', auth, wrap(async (req, res) => {
  if (!(await isMember(req.params.id, req.user.id))) return res.status(403).json({ error: 'You are not in this chat' });
  const [[m]] = await db.query('SELECT file_name, file_mime, file_data FROM messages WHERE id=? AND chat_id=? AND deleted=0', [req.params.mid, req.params.id]);
  if (!m || !m.file_data) return res.status(404).json({ error: 'File not found' });
  res.set({
    'Content-Type': m.file_mime || 'application/octet-stream',
    'Content-Disposition': `inline; filename="${encodeURIComponent(m.file_name || 'file')}"`,
  });
  res.send(m.file_data);
}));

// edit your own message
app.put('/api/chats/:id/messages/:mid', auth, wrap(async (req, res) => {
  if (!(await isMember(req.params.id, req.user.id))) return res.status(403).json({ error: 'You are not in this chat' });
  const [[m]] = await db.query('SELECT file_name FROM messages WHERE id=? AND chat_id=? AND user_id=? AND deleted=0',
    [req.params.mid, req.params.id, req.user.id]);
  if (!m) return res.status(403).json({ error: 'You can only edit your own messages' });
  const text = (req.body.text || '').trim();
  if (!text && !m.file_name) return res.status(400).json({ error: 'Message is empty' });
  await db.query('UPDATE messages SET text=?, edited=1 WHERE id=?', [text, req.params.mid]);
  res.json({ ok: true });
}));

// delete a message for everyone (your own, or any message if you are admin)
app.delete('/api/chats/:id/messages/:mid', auth, wrap(async (req, res) => {
  if (!(await isMember(req.params.id, req.user.id))) return res.status(403).json({ error: 'You are not in this chat' });
  await db.query(
    `UPDATE messages SET deleted=1, text='', file_name=NULL, file_mime=NULL, file_size=NULL, file_data=NULL
     WHERE id=? AND chat_id=? AND (user_id=? OR ?)`,
    [req.params.mid, req.params.id, req.user.id, req.user.role === 'admin']);
  res.json({ ok: true });
}));

// ---------- Leave information (full day / half day, visible to the whole team) ----------
app.get('/api/leaves', auth, wrap(async (req, res) => {
  const [r] = await db.query('SELECT l.*, u.username, u.full_name FROM leaves l JOIN users u ON u.id=l.user_id ORDER BY l.from_date DESC');
  res.json(r);
}));
app.post('/api/leaves', auth, wrap(async (req, res) => {
  const { from_date, reason } = req.body;
  const day_type = req.body.day_type === 'half' ? 'half' : 'full';
  const to_date = day_type === 'half' ? from_date : req.body.to_date;
  const user_id = req.user.role === 'admin' ? req.body.user_id : req.user.id;
  if (!user_id || !from_date || !to_date) return res.status(400).json({ error: 'Choose a member and the dates' });
  if (to_date < from_date) return res.status(400).json({ error: 'End date is before start date' });
  await db.query('INSERT INTO leaves (user_id,from_date,to_date,day_type,reason) VALUES (?,?,?,?,?)',
    [user_id, from_date, to_date, day_type, clean(reason)]);
  const [[lu]] = await db.query('SELECT COALESCE(full_name, username) AS n FROM users WHERE id=?', [user_id]);
  log('leave', `${lu.n} is on ${day_type === 'half' ? 'half-day' : 'full-day'} leave from ${from_date} to ${to_date}`);
  res.json({ ok: true });
}));
app.delete('/api/leaves/:id', auth, wrap(async (req, res) => {
  await db.query('DELETE FROM leaves WHERE id=? AND (user_id=? OR ?)', [req.params.id, req.user.id, req.user.role === 'admin']);
  res.json({ ok: true });
}));

// ---------- Workout (private notes, documents and images, stored in the database) ----------
app.get('/api/workout', auth, wrap(async (req, res) => {
  const [r] = await db.query(
    `SELECT id, kind, title, content, file_name, mime, size, created_at
     FROM workout_items WHERE user_id=? ORDER BY id DESC`, [req.user.id]);
  res.json(r);
}));
app.post('/api/workout/note', auth, wrap(async (req, res) => {
  const { title, content } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Give it a title' });
  await db.query('INSERT INTO workout_items (user_id,kind,title,content) VALUES (?,?,?,?)',
    [req.user.id, 'note', title.trim(), clean(content)]);
  res.json({ ok: true });
}));
app.post('/api/workout/file', auth, upload.single('file'), wrap(async (req, res) => {
  const f = req.file;
  if (!f) return res.status(400).json({ error: 'Choose a file (max 10 MB)' });
  const title = (req.body.title || '').trim() || f.originalname;
  const kind = (f.mimetype || '').startsWith('image/') ? 'image'
    : /\.(pdf|docx?|xlsx?|pptx?|txt|csv)$/i.test(f.originalname) ? 'doc' : 'file';
  await db.query('INSERT INTO workout_items (user_id,kind,title,file_name,mime,size,file_data) VALUES (?,?,?,?,?,?,?)',
    [req.user.id, kind, title, f.originalname, f.mimetype, f.size, f.buffer]);
  res.json({ ok: true });
}));
// ?view=1 shows the file in the page (image preview); without it the file downloads
app.get('/api/workout/:id/download', auth, wrap(async (req, res) => {
  const [[w]] = await db.query('SELECT file_name, mime, file_data FROM workout_items WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  if (!w || !w.file_data) return res.status(404).json({ error: 'File not found' });
  res.set({
    'Content-Type': w.mime || 'application/octet-stream',
    'Content-Disposition': `${req.query.view ? 'inline' : 'attachment'}; filename="${encodeURIComponent(w.file_name || 'file')}"`,
  });
  res.send(w.file_data);
}));
app.delete('/api/workout/:id', auth, wrap(async (req, res) => {
  await db.query('DELETE FROM workout_items WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  res.json({ ok: true });
}));

// ---------- To-do list (dashboard only, private to each user) ----------
app.get('/api/todos', auth, wrap(async (req, res) => {
  const [r] = await db.query('SELECT id, text FROM todos WHERE user_id=? ORDER BY id', [req.user.id]);
  res.json(r);
}));
app.post('/api/todos', auth, wrap(async (req, res) => {
  const text = (req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Write a to-do first' });
  await db.query('INSERT INTO todos (user_id,text) VALUES (?,?)', [req.user.id, text]);
  res.json({ ok: true });
}));
app.delete('/api/todos/:id', auth, wrap(async (req, res) => {
  await db.query('DELETE FROM todos WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  res.json({ ok: true });
}));

// Upload errors (for example a file over 10 MB) return a clear message
app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File is too big (max 10 MB)' });
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

// ---------- Start: create first users, upgrade database ----------
const addCol = async (sql) => {
  try { await db.query(sql); return true; }
  catch (e) { if (e.code === 'ER_DUP_FIELDNAME') return false; throw e; }
};

async function migrate() {
  const fresh = await addCol('ALTER TABLE users ADD COLUMN full_name VARCHAR(100), ADD COLUMN dob DATE, ADD COLUMN gender VARCHAR(20), ADD COLUMN job_role VARCHAR(80), ADD COLUMN photo MEDIUMTEXT');
  await db.query('CREATE TABLE IF NOT EXISTS chats (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), is_group TINYINT NOT NULL DEFAULT 0, created_by INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
  await db.query('CREATE TABLE IF NOT EXISTS chat_members (chat_id INT NOT NULL, user_id INT NOT NULL, last_read INT NOT NULL DEFAULT 0, PRIMARY KEY (chat_id, user_id))');
  await db.query('CREATE TABLE IF NOT EXISTS activity (id INT AUTO_INCREMENT PRIMARY KEY, kind VARCHAR(20), text VARCHAR(300), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
  await db.query('CREATE TABLE IF NOT EXISTS notif_clear (user_id INT PRIMARY KEY, cleared_at DATETIME NOT NULL)');
  await addCol('ALTER TABLE messages ADD COLUMN chat_id INT');
  await addCol('ALTER TABLE messages ADD COLUMN edited TINYINT NOT NULL DEFAULT 0, ADD COLUMN deleted TINYINT NOT NULL DEFAULT 0, ADD COLUMN file_name VARCHAR(255) NULL, ADD COLUMN file_mime VARCHAR(120) NULL, ADD COLUMN file_size INT NULL, ADD COLUMN file_data LONGBLOB NULL');
  await addCol('ALTER TABLE users ADD COLUMN mobile VARCHAR(20) NULL');
  await addCol('ALTER TABLE users ADD COLUMN email VARCHAR(120) NULL');
  await addCol("ALTER TABLE leaves ADD COLUMN day_type VARCHAR(10) NOT NULL DEFAULT 'full'");
  await addCol('ALTER TABLE notes ADD COLUMN remind_time TIME NULL, ADD COLUMN place VARCHAR(150) NULL');
  await addCol('ALTER TABLE projects ADD COLUMN members VARCHAR(500) NULL');
  await addCol('ALTER TABLE projects ADD COLUMN project_no VARCHAR(60) NULL');
  await addCol('ALTER TABLE projects ADD COLUMN service VARCHAR(30) NULL');
    await addCol('ALTER TABLE projects ADD COLUMN quantity INT NULL');
  await db.query('ALTER TABLE projects MODIFY quantity VARCHAR(40) NULL').catch(() => {});
  // project dates are optional (empty date is saved as NULL and shown as TBD)
  await db.query('ALTER TABLE projects MODIFY start_date DATE NULL, MODIFY due_date DATE NULL').catch(() => {});
  await db.query(`CREATE TABLE IF NOT EXISTS workout_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    kind VARCHAR(10) NOT NULL,
    title VARCHAR(200) NOT NULL,
    content MEDIUMTEXT NULL,
    file_name VARCHAR(255) NULL,
    mime VARCHAR(120) NULL,
    size INT NULL,
    file_data LONGBLOB NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (user_id)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS todos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    text VARCHAR(300) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (user_id)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS meetings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    meet_date DATE NOT NULL,
    meet_time TIME NOT NULL,
    place VARCHAR(150) NULL,
    attendees VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (meet_date)
  )`);
  if (fresh) {
    await db.query('UPDATE users SET full_name = username');
    await db.query("UPDATE users SET role='member' WHERE username='Akash'");
    await db.query("UPDATE users SET role='admin' WHERE username='Charles'");
    console.log('Charles is now admin');
  }
  let tc = await teamChatId();
  if (!tc) {
    const [r] = await db.query("INSERT INTO chats (name, is_group) VALUES ('Dellner PM Team', 1)");
    tc = r.insertId;
    await db.query('INSERT IGNORE INTO chat_members (chat_id, user_id) SELECT ?, id FROM users', [tc]);
    await db.query('UPDATE messages SET chat_id=? WHERE chat_id IS NULL', [tc]);
    console.log('Team group chat created');
  }
}

const initPromise = (async () => {
  const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM users');

  if (n === 0) {
    const hash = await bcrypt.hash('Dellner@PM', 10);

    for (const name of ['Akash', 'Charles', 'Abi', 'Elango']) {
      await db.query(
        'INSERT INTO users (username,password_hash,role) VALUES (?,?,?)',
        [name, hash, name === 'Charles' ? 'admin' : 'member']
      );
    }

    console.log('First 4 users created (Charles is admin)');
  }

  await migrate();
})();

if (!process.env.VERCEL) {
  initPromise
    .then(() => {
      app.listen(process.env.PORT || 5000, () => {
        console.log('API running on port ' + (process.env.PORT || 5000));
      });
    })
    .catch((error) => {
      console.error('Startup failed:', error);
      process.exit(1);
    });
}

module.exports = app;

module.exports = app;
})();
