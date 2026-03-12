import { useState } from 'react';

export default function AIChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hey Bear! I know every degree program at Morgan State — all requirements, prerequisites, electives, and course sequences. Ask me anything: "How many credits do I have left?", "Can I take CS 440 without CS 340?", "What\'s the fastest path to graduate?"' },
  ]);
  const [input, setInput] = useState('');

  const send = () => {
    if (!input.trim()) return;
    setMessages(m => [...m, { role: 'user', text: input }]);
    setInput('');
    setTimeout(() => {
      setMessages(m => [...m, { role: 'ai', text: 'Let me cross-reference that against your transcript and degree requirements — one moment...' }]);
    }, 800);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: '2rem', right: '2rem', width: '56px', height: '56px',
          borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
          border: 'none', cursor: 'pointer', fontSize: '1.4rem', color: '#0c0e14',
          boxShadow: '0 8px 24px rgba(110,231,183,0.3)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0c0e14" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="4" r="2.5" fill="#0c0e14" />
          <circle cx="16" cy="4" r="2.5" fill="#0c0e14" />
          <path d="M4.5 10C4.5 6.5 7.5 4 12 4s7.5 2.5 7.5 6c0 4-2.5 7-7.5 10C7 17 4.5 14 4.5 10z" fill="#0c0e14" />
          <circle cx="9.5" cy="10.5" r="1.2" fill="#6ee7b7" />
          <circle cx="14.5" cy="10.5" r="1.2" fill="#6ee7b7" />
          <ellipse cx="12" cy="13.5" rx="1.5" ry="1" fill="#6ee7b7" />
        </svg>
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: '2rem', right: '2rem', width: '360px', maxHeight: '480px',
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 100,
      boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
    }}>
      <div style={{
        padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>BearAdvisorAI Chat</span>
        <button onClick={() => setOpen(false)} style={{
          background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.1rem',
        }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            background: m.role === 'user' ? 'rgba(110,231,183,0.15)' : 'var(--surface2)',
            padding: '0.6rem 0.9rem', borderRadius: '10px', maxWidth: '85%',
            fontSize: '0.84rem', lineHeight: '1.5',
          }}>
            {m.text}
          </div>
        ))}
      </div>

      <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask about your degree, courses, prereqs..."
          style={{
            flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: '8px', padding: '0.6rem 0.8rem', color: 'var(--text)',
            fontSize: '0.84rem', outline: 'none', fontFamily: "'Manrope', sans-serif",
          }}
        />
        <button onClick={send} style={{
          background: 'var(--accent)', color: '#0c0e14', border: 'none',
          borderRadius: '8px', padding: '0.6rem 1rem', fontWeight: 600,
          cursor: 'pointer', fontSize: '0.84rem',
        }}>
          Send
        </button>
      </div>
    </div>
  );
}
