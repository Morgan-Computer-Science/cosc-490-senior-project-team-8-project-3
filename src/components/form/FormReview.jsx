import { useAdvising } from '../../context/AdvisingContext';

export default function FormReview() {
  const { state, dispatch } = useAdvising();

  return (
    <div>
      <div className="step-header">
        <div className="step-tag">Step 5 of 5</div>
        <h1 className="step-title">Review & generate plan</h1>
        <p className="step-subtitle">Confirm your info below. The AI will cross-reference your transcript against your full degree requirements, build an optimized schedule, and register you.</p>
      </div>

      <div className="review-card">
        <div className="review-label">
          Student Info
          <span className="edit-link" onClick={() => dispatch({ type: 'SET_STEP', payload: 0 })}>Edit</span>
        </div>
        <p style={{ fontSize: '0.9rem' }}>
          {state.studentInfo.name || '—'} · {state.studentInfo.netid || '—'} · {state.studentInfo.major || '—'} · {state.studentInfo.year}
        </p>
        {state.bearCardFile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
            <img
              src={state.bearCardPreview}
              alt="Bear Card"
              style={{
                width: '80px', height: '52px', objectFit: 'cover',
                borderRadius: '6px', border: '1px solid var(--border)',
              }}
            />
            <span className="file-badge" style={{ marginTop: 0 }}>🪪 {state.bearCardFile.name}</span>
          </div>
        )}
      </div>

      <div className="review-card">
        <div className="review-label">
          Transcript
          <span className="edit-link" onClick={() => dispatch({ type: 'SET_STEP', payload: 1 })}>Edit</span>
        </div>
        <p style={{ fontSize: '0.9rem' }}>
          {state.uploadedFile ? state.uploadedFile.name : 'No file uploaded'}
        </p>
      </div>

      <div className="review-card">
        <div className="review-label">
          Desired Courses ({state.courses.length})
          <span className="edit-link" onClick={() => dispatch({ type: 'SET_STEP', payload: 2 })}>Edit</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {state.courses.map(c => (
            <span key={c} className="course-tag" style={{ cursor: 'default' }}>{c}</span>
          ))}
          {state.courses.length === 0 && <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>None selected</span>}
        </div>
      </div>

      <div className="review-card">
        <div className="review-label">
          Goals
          <span className="edit-link" onClick={() => dispatch({ type: 'SET_STEP', payload: 3 })}>Edit</span>
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: '1.6' }}>
          {state.goals || 'No goals entered.'}
        </p>
      </div>

      <div className="ai-panel">
        <div className="ai-header">
          <span className="ai-badge">Degree Engine</span>
          <span className="ai-title">Ready to build your path to graduation</span>
        </div>
        <p style={{ fontSize: '0.84rem', color: 'var(--muted)', lineHeight: '1.6' }}>
          The AI will analyze every completed course against your degree audit, verify all prerequisites are satisfied, resolve time conflicts, select optimal sections, and handle registration — all in seconds.
        </p>
      </div>
    </div>
  );
}
