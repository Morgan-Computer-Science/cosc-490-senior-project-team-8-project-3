export default function Input({ label, error, ...props }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      <input {...props} />
      {error && <span style={{ color: 'var(--danger)', fontSize: '0.78rem', marginTop: '0.3rem', display: 'block' }}>{error}</span>}
    </div>
  );
}
