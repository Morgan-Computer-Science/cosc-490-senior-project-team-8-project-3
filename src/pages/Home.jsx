import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center',
    }}>
      <div style={{
        width: 12, height: 12, background: 'var(--accent3)',
        borderRadius: '50%', animation: 'pulse 2s ease-in-out infinite', marginBottom: '1.5rem',
      }} />

      <h1 style={{
        fontFamily: "'Fraunces', serif", fontSize: '3rem', fontWeight: 600,
        letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '1rem',
      }}>
        BearAdvisorAI
      </h1>
      <p style={{
        fontFamily: "'DM Mono', monospace", fontSize: '0.8rem', letterSpacing: '0.1em',
        color: 'var(--accent2)', textTransform: 'uppercase', marginBottom: '1.5rem',
      }}>
        Your AI-powered degree advisor
      </p>

      <p style={{ color: 'var(--muted)', fontSize: '1.05rem', maxWidth: '520px', lineHeight: 1.7, marginBottom: '1.25rem' }}>
        Upload your transcript and our AI maps exactly where you stand in your degree — every requirement completed, every course still needed, every prerequisite chain.
      </p>
      <p style={{ color: 'var(--muted)', fontSize: '1.05rem', maxWidth: '520px', lineHeight: 1.7, marginBottom: '2.5rem' }}>
        It builds your optimal schedule, avoids conflicts, and registers you for classes. No appointment, no waitlist, no guesswork. Go Bears!
      </p>

      <Link to="/advising">
        <button className="btn btn-primary" style={{ fontSize: '1rem', padding: '1rem 2.5rem' }}>
          Get Started →
        </button>
      </Link>
    </div>
  );
}
