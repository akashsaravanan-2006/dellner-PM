// In dev, always use the local backend. Set VITE_API only for production builds.
const BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API || '/api')
  : 'http://localhost:5000/api';

console.log('API base URL:', BASE);

async function req(path, method = 'GET', body) {
  const token = sessionStorage.getItem('token');
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && token) { sessionStorage.clear(); window.location.reload(); }
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  get: (p) => req(p),
  post: (p, b) => req(p, 'POST', b),
  put: (p, b) => req(p, 'PUT', b),
  del: (p) => req(p, 'DELETE'),
};