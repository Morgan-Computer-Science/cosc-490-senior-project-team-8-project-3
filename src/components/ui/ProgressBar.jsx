export default function ProgressBar({ value = 0, max = 100 }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div style={{
      width: '100%', height: '4px', background: 'var(--border)',
      borderRadius: '2px', overflow: 'hidden',
    }}>
      <div style={{
        height: '100%', width: `${pct}%`,
        background: 'linear-gradient(90deg, var(--accent), var(--accent2))',
        borderRadius: '2px', transition: 'width 0.3s ease',
      }} />
    </div>
  );
}
