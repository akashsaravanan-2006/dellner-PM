import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { api } from '../api';
import logo from '../img/logo.jfif?url';
import './Login.css';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const { token, user } = await api.post('/login', {
        username: username.trim(),
        password,
      });
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('user', JSON.stringify(user));
      onLogin(user);
    } catch (x) { setErr(x.message); }
  };

  return (
    <div className="login-wrap dpm">
      <form className="login-card" onSubmit={submit} autoComplete="off">
        <img src={logo} alt="Dellner" />
        <h1>Dellner PM portal</h1>
        <p className="muted">Sign in to see your team's projects.</p>
        <input
          name="dpm-username"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="off"
          autoFocus
          required
        />
        <div className="pw-field">
          <input
            name="dpm-password"
            type={show ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            className="pw-eye"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {err && <p className="error">{err}</p>}
        <button className="btn">Sign in</button>
      </form>
    </div>
  );
}