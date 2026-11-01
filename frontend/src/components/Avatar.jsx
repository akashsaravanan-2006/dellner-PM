export const nm = (u) => (u && (u.full_name || u.username)) || '';

export default function Avatar({ u, size = 38 }) {
  const style = { width: size, height: size, fontSize: size * 0.4 };
  if (u?.photo) return <img className="avatar" style={style} src={u.photo} alt="" />;
  return <span className="avatar" style={style}>{nm(u).slice(0, 1).toUpperCase() || '?'}</span>;
}
