import { useState, useRef, useEffect } from 'react';
import { useAdvising } from '../../context/AdvisingContext';
import { streamChatMessage } from '../../api/advising';

export default function AIChat() {
  const { state } = useAdvising();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      text: "Hey Bear! I know your transcript and degree requirements — ask me anything: how many credits left, what to take next, whether a course counts, anything.",
      id: 'welcome',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const cancelRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  // Clean up any active stream on unmount
  useEffect(() => () => cancelRef.current?.(), []);

  const sessionId = state.confirmationId || 'default-session';

  const chatContext = state.uploadResult
    ? {
        student: state.uploadResult.student,
        validation: state.uploadResult.validation,
        recommendedSchedule: state.uploadResult.recommendedSchedule,
      }
    : null;

  const send = () => {
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    const aiMsgId = `ai-${Date.now()}`;
    setInput('');
    setIsLoading(true);

    setMessages((m) => [
      ...m,
      { role: 'user', text: userText, id: `user-${Date.now()}` },
      { role: 'ai', text: '', id: aiMsgId, streaming: true },
    ]);

    cancelRef.current = streamChatMessage({
      sessionId,
      message: userText,
      context: chatContext,
      onText: (text) => {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === aiMsgId ? { ...msg, text: msg.text + text } : msg
          )
        );
      },
      onDone: () => {
        setMessages((m) =>
          m.map((msg) => (msg.id === aiMsgId ? { ...msg, streaming: false } : msg))
        );
        setIsLoading(false);
        cancelRef.current = null;
      },
      onError: (err) => {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === aiMsgId
              ? { ...msg, text: err || 'Something went wrong. Try again.', streaming: false }
              : msg
          )
        );
        setIsLoading(false);
        cancelRef.current = null;
      },
    });
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Chat with BearAdvisor AI"
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
      position: 'fixed', bottom: '2rem', right: '2rem', width: '360px', maxHeight: '520px',
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 100,
      boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>BearAdvisor AI</span>
          {state.uploadResult && (
            <span style={{ fontSize: '0.72rem', color: 'var(--accent)', marginLeft: '0.5rem' }}>
              transcript loaded
            </span>
          )}
        </div>
        <button onClick={() => setOpen(false)} style={{
          background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.1rem',
        }}>
          ✕
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '1rem',
        display: 'flex', flexDirection: 'column', gap: '0.6rem',
      }}>
        {messages.map((m) => (
          <div key={m.id} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            background: m.role === 'user' ? 'rgba(110,231,183,0.15)' : 'var(--surface2)',
            padding: '0.6rem 0.9rem', borderRadius: '10px', maxWidth: '85%',
            fontSize: '0.84rem', lineHeight: '1.5',
          }}>
            {m.text || (m.streaming ? (
              <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>thinking...</span>
            ) : '')}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '0.75rem', borderTop: '1px solid var(--border)',
        display: 'flex', gap: '0.5rem',
      }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Ask about your degree, prereqs, schedule..."
          disabled={isLoading}
          style={{
            flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: '8px', padding: '0.6rem 0.8rem', color: 'var(--text)',
            fontSize: '0.84rem', outline: 'none', fontFamily: "'Manrope', sans-serif",
            opacity: isLoading ? 0.6 : 1,
          }}
        />
        <button
          onClick={send}
          disabled={isLoading || !input.trim()}
          style={{
            background: 'var(--accent)', color: '#0c0e14', border: 'none',
            borderRadius: '8px', padding: '0.6rem 1rem', fontWeight: 600,
            cursor: isLoading ? 'not-allowed' : 'pointer', fontSize: '0.84rem',
            opacity: isLoading || !input.trim() ? 0.5 : 1,
          }}
        >
          {isLoading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
