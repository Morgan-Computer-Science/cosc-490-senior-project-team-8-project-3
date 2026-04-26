import { useState, useRef, useEffect } from 'react';
import { useAdvising } from '../../context/AdvisingContext';
import { speechToText, streamChatMessage, textToSpeech } from '../../api/advising';

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
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('');
  const [speakingId, setSpeakingId] = useState('');
  const messagesEndRef = useRef(null);
  const cancelRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);
  const messageIdRef = useRef(0);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  // Clean up any active stream on unmount
  useEffect(() => () => {
    cancelRef.current?.();
    mediaRecorderRef.current?.stream?.getTracks?.().forEach((track) => track.stop());
    if (audioRef.current) audioRef.current.pause();
  }, []);

  const sessionId = state.confirmationId || 'default-session';

  const chatContext = state.uploadResult
    ? {
        student: state.uploadResult.student,
        validation: state.uploadResult.validation,
        recommendedSchedule: state.uploadResult.recommendedSchedule,
      }
    : null;

  const playText = async (text, id = 'voice-reply') => {
    if (!text) return;

    setSpeakingId(id);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const result = await textToSpeech({ text });
    const audio = new Audio(`data:${result.mimeType};base64,${result.audioContent}`);
    audioRef.current = audio;
    audio.onended = () => setSpeakingId('');
    audio.onerror = () => {
      setVoiceError('Could not play the generated audio.');
      setSpeakingId('');
    };
    await audio.play();
  };

  const send = (overrideText, options = {}) => {
    const textToSend = String(overrideText ?? input).trim();
    if (!textToSend || isLoading) return Promise.resolve('');

    const userText = textToSend;
    messageIdRef.current += 1;
    const idBase = messageIdRef.current;
    const aiMsgId = `ai-${idBase}`;
    setInput('');
    setIsLoading(true);
    setVoiceError('');
    setVoiceStatus(options.voice ? 'Thinking...' : '');

    setMessages((m) => [
      ...m,
      { role: 'user', text: userText, id: `user-${idBase}` },
      { role: 'ai', text: '', id: aiMsgId, streaming: true },
    ]);

    return new Promise((resolve) => {
      let fullReply = '';
      cancelRef.current = streamChatMessage({
        sessionId,
        message: userText,
        context: chatContext,
        onText: (text) => {
          fullReply += text;
          setMessages((m) =>
            m.map((msg) =>
              msg.id === aiMsgId ? { ...msg, text: msg.text + text } : msg
            )
          );
        },
        onDone: async () => {
          setMessages((m) =>
            m.map((msg) => (msg.id === aiMsgId ? { ...msg, streaming: false } : msg))
          );
          setIsLoading(false);
          cancelRef.current = null;

          if (options.speakReply && fullReply.trim()) {
            try {
              setVoiceStatus('Speaking...');
              await playText(fullReply, aiMsgId);
            } catch (err) {
              setVoiceError(err.message || 'Text-to-speech failed.');
            }
          }
          setVoiceStatus('');
          resolve(fullReply);
        },
        onError: (err) => {
          const errorText = err || 'Something went wrong. Try again.';
          setMessages((m) =>
            m.map((msg) =>
              msg.id === aiMsgId
                ? { ...msg, text: errorText, streaming: false }
                : msg
            )
          );
          setVoiceError(options.voice ? errorText : '');
          setVoiceStatus('');
          setIsLoading(false);
          cancelRef.current = null;
          resolve('');
        },
      });
    });
  };

  const speak = async (message) => {
    if (!message?.text || message.streaming) return;

    try {
      setSpeakingId(message.id);
      setVoiceError('');
      await playText(message.text, message.id);
    } catch (err) {
      setVoiceError(err.message || 'Text-to-speech failed.');
      setSpeakingId('');
    }
  };

  const transcribeRecording = async (blob) => {
    try {
      setVoiceError('');
      setVoiceStatus('Transcribing...');
      const result = await speechToText({ audioBlob: blob, saveAudio: true });
      if (result.transcript) {
        setVoiceStatus(result.savedAudioPath ? 'Saved recording. Asking BearAdvisor...' : 'Asking BearAdvisor...');
        await send(result.transcript, { speakReply: true, voice: true });
      } else {
        setVoiceError('I could not hear any speech in that recording.');
        setVoiceStatus('');
      }
    } catch (err) {
      setVoiceError(err.message || 'Speech-to-text failed.');
      setVoiceStatus('');
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setVoiceError('This browser does not support microphone recording.');
      return;
    }

    try {
      setVoiceError('');
      setVoiceStatus('');
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : '';
      const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        setIsRecording(false);
        setVoiceStatus('Saving recording...');
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size > 0) transcribeRecording(blob);
      };

      recorder.start();
      setIsRecording(true);
      setVoiceStatus('Recording...');
    } catch (err) {
      setVoiceError(err.message || 'Microphone access failed.');
      setIsRecording(false);
    }
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
            {m.role === 'ai' && m.text && !m.streaming && (
              <button
                onClick={() => speak(m)}
                title="Read this response aloud"
                style={{
                  display: 'block', marginTop: '0.45rem', background: 'transparent',
                  border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px',
                  padding: '0.25rem 0.45rem', cursor: 'pointer', fontSize: '0.74rem',
                }}
              >
                {speakingId === m.id ? 'Playing...' : 'Speak'}
              </button>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {voiceError && (
        <div style={{
          padding: '0.45rem 0.75rem', borderTop: '1px solid var(--border)',
          color: '#fca5a5', fontSize: '0.75rem',
        }}>
          {voiceError}
        </div>
      )}
      {voiceStatus && !voiceError && (
        <div style={{
          padding: '0.45rem 0.75rem', borderTop: '1px solid var(--border)',
          color: 'var(--accent)', fontSize: '0.75rem',
        }}>
          {voiceStatus}
        </div>
      )}
      <div style={{
        padding: '0.75rem', borderTop: '1px solid var(--border)',
        display: 'flex', gap: '0.5rem',
      }}>
        <button
          onClick={toggleRecording}
          disabled={isLoading || (!!voiceStatus && !isRecording)}
          title={isRecording ? 'Stop and ask BearAdvisor' : 'Record, ask, and play response'}
          style={{
            background: isRecording ? '#f87171' : 'var(--surface2)', color: isRecording ? '#0c0e14' : 'var(--text)',
            border: '1px solid var(--border)', borderRadius: '8px', width: '40px',
            cursor: isLoading || (!!voiceStatus && !isRecording) ? 'not-allowed' : 'pointer', fontSize: '0.7rem',
            opacity: isLoading || (!!voiceStatus && !isRecording) ? 0.5 : 1,
          }}
        >
          {isRecording ? 'Stop' : 'Mic'}
        </button>
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
          onClick={() => send()}
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
