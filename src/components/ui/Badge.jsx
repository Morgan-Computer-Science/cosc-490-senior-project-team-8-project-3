export default function Badge({ children, variant = 'default' }) {
  const styles = {
    default: { background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' },
    ai: { background: 'rgba(129, 140, 248, 0.15)', color: 'var(--accent2)', border: '1px solid rgba(129, 140, 248, 0.3)' },
    success: { background: 'rgba(110, 231, 183, 0.1)', color: 'var(--accent)', border: '1px solid rgba(110, 231, 183, 0.25)' },
  };

  return (
    <span
      style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: '0.68rem',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        padding: '0.25rem 0.6rem',
        borderRadius: '4px',
        ...styles[variant],
      }}
    >
      {children}
    </span>
  );
}
