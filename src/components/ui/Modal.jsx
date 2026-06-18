import { useEffect } from 'react';

export default function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '16px', padding: '2rem', maxWidth: '500px', width: '90%',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        {title && <h3 style={{ marginBottom: '1rem', fontFamily: "'Fraunces', serif" }}>{title}</h3>}
        {children}
      </div>
    </div>
  );
}
