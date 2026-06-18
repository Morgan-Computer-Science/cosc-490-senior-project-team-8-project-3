import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center',
    }}>
      <h1 style={{
        fontFamily: "'Fraunces', serif", fontSize: '4rem', fontWeight: 600,
        color: 'var(--accent)', marginBottom: '0.5rem',
      }}>
        404
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: '1rem', marginBottom: '2rem' }}>
        This page doesn't exist.
      </p>
      <Link to="/">
        <button className="btn btn-ghost">← Back to Home</button>
      </Link>
    </div>
  );
}
