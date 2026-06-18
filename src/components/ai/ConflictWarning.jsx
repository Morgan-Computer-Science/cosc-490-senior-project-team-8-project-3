export default function ConflictWarning({ conflicts = [] }) {
  if (conflicts.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {conflicts.map((c, i) => (
        <div key={i} className="conflict-pill">
          ⚠ {c}
        </div>
      ))}
    </div>
  );
}
