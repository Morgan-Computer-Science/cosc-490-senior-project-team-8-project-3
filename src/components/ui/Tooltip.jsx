import { useState } from 'react';

export default function Tooltip({ text, children }) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span style={{
          position: 'absolute', bottom: '120%', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--surface2)', border: '1px solid var(--border)',
          color: 'var(--text)', padding: '0.4rem 0.7rem', borderRadius: '6px',
          fontSize: '0.75rem', whiteSpace: 'nowrap', zIndex: 10,
          animation: 'fadeIn 0.15s ease-out',
        }}>
          {text}
        </span>
      )}
    </span>
  );
}
