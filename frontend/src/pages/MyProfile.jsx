import { useEffect, useState } from 'react';
import { api } from '../api';
import Avatar from '../components/Avatar';
import './MyProfile.css';

const toSquare = (file) => new Promise((resolve) => {
  const r = new FileReader();
  r.onload = () => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = c.height = 220;
      c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 220, 220);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.src = r.result;
  };
  r.readAsDataURL(file);
});

export default function MyProfile({ user, onUpdate }) {
  const [f, setF] = useState({ full_name: '', dob: '', gender: '', job_role: '', mobile: '', email: '', photo: '' });
  const [msg, setMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    api.get('/me').then((m) => setF({
      full_name: m.full_name || '',
      dob: m.dob || '',
      gender: m.gender || '',
      job_role: m.job_role || '',
      mobile: m.mobile || '',
      email: m.email || '',
      photo: m.photo || '',
    }));
  }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const pick = async (e) => { if (e.target.files[0]) setF({ ...f, photo: await toSquare(e.target.files[0]) }); };
  const save = async (e) => {
    e.preventDefault();
    try { await api.put('/me', f); await onUpdate(); setMsg({ type: 'success', text: 'Profile saved' }); }
    catch (x) { setMsg({ type: 'error', text: x.message }); }
  };

  return (
    <div>
      <div className="page-head"><h1>My profile</h1></div>
      <form className="panel profile" onSubmit={save}>
        <div className="profile-photo">
          <Avatar u={{ ...f, username: user.username }} size={120} />
          <label className="btn ghost">Change photo<input type="file" accept="image/*" hidden onChange={pick} /></label>
          {f.photo && <button type="button" className="btn ghost" onClick={() => setF({ ...f, photo: '' })}>Remove photo</button>}
        </div>
        <div className="profile-fields">
          <label>Name<input value={f.full_name} onChange={set('full_name')} required /></label>
          <label>Date of birth<input type="date" value={f.dob} onChange={set('dob')} /></label>
          <label>Gender
            <select value={f.gender} onChange={set('gender')}>
              <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
            </select>
          </label>
          <label>Job role<input placeholder="e.g. Project manager" value={f.job_role} onChange={set('job_role')} /></label>
          <label>Mobile number
            <input type="tel"  value={f.mobile} onChange={set('mobile')}
              pattern="\+?[0-9 ()\-]{7,20}" title="Enter a valid mobile number (digits, + and spaces only)" />
          </label>
          <label>Email ID
            <input type="email"  value={f.email} onChange={set('email')} />
          </label>
          <label>Access level<input value={user.role === 'admin' ? 'Admin' : 'Member'} disabled /></label>
          <label>Username<input value={user.username} disabled /></label>
          {msg.text && <p className={msg.type + ' full'}>{msg.text}</p>}
          <button className="btn full-btn">Save profile</button>
        </div>
      </form>
    </div>
  );
}