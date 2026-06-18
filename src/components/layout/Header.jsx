import { Link } from 'react-router-dom';

export default function Header() {
  return (
    <header style={{
      padding: '1rem 2rem', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'var(--surface)',
    }}>
      <Link to="/" style={{ textDecoration: 'none' }}>
        <div style={{
          fontFamily: "'Fraunces', serif", fontSize: '1.3rem', fontWeight: 600,
          color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <span style={{
            width: 8, height: 8, background: 'var(--accent3)',
            borderRadius: '50%', animation: 'pulse 2s ease-in-out infinite',
          }} />
          BearAdvisorAI
        </div>
      </Link>
    </header>
  );
}
