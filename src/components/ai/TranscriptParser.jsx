import { useTranscriptParse } from '../../hooks/useTranscriptParse';

export default function TranscriptParser() {
  const { parsedCourses, hasParsed } = useTranscriptParse();

  if (!hasParsed) return null;

  return (
    <div className="ai-panel">
      <div className="ai-header">
        <span className="ai-badge">AI Parsed</span>
        <span className="ai-title">Transcript Analysis</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
        {parsedCourses.map(c => (
          <span key={c} className="course-tag" style={{ cursor: 'default' }}>{c}</span>
        ))}
      </div>
    </div>
  );
}
