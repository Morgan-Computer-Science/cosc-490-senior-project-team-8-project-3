import { Link } from 'react-router-dom';
import { useAdvising } from '../context/AdvisingContext';

export default function Confirmation() {
  const { state } = useAdvising();

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: 'rgba(110, 231, 183, 0.15)', border: '2px solid var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.8rem', marginBottom: '1.5rem',
      }}>
        ✓
      </div>

      <h1 style={{
        fontFamily: "'Fraunces', serif", fontSize: '2.4rem', fontWeight: 600,
        letterSpacing: '-0.03em', marginBottom: '0.75rem',
      }}>
        You're registered
      </h1>

      <p style={{ color: 'var(--muted)', fontSize: '1rem', maxWidth: '480px', lineHeight: 1.7, marginBottom: '0.75rem' }}>
        The AI analyzed your degree requirements, verified prerequisites, resolved scheduling conflicts, and registered you for the optimal set of courses. Check your student portal to see your finalized schedule.
      </p>

      {state.confirmationId && (
        <p style={{
          fontFamily: "'DM Mono', monospace", fontSize: '0.85rem',
          color: 'var(--accent2)', marginBottom: '2rem',
        }}>
          Confirmation #{state.confirmationId}
        </p>
      )}
      {state.uploadResult && (
        <Link to="/results">
          <button className="btn btn-secondary" style={{ marginBottom: '1rem' }}>
            View upload results
          </button>
        </Link>
      )}

      <Link to="/">
        <button className="btn btn-ghost">← Back to Home</button>
      </Link>
    </div>
  );
}
