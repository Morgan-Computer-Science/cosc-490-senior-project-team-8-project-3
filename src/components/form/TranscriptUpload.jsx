import { useState, useRef } from 'react';
import { useAdvising } from '../../context/AdvisingContext';
import { useFileUpload } from '../../hooks/useFileUpload';
import ManualCourseEntry from './ManualCourseEntry';

export default function TranscriptUpload() {
  const { state, dispatch } = useAdvising();
  const { handleUpload, error } = useFileUpload();
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();

  const inputMode = state.inputMode || 'pdf';

  const setMode = (mode) => {
    dispatch({ type: 'SET_INPUT_MODE', payload: mode });
    if (mode === 'pdf') dispatch({ type: 'CLEAR_MANUAL_COURSES' });
    if (mode === 'manual') dispatch({ type: 'SET_FILE', payload: null });
  };

  const onFile = async (file) => {
    if (file) {
      try {
        await handleUpload(file);
      } catch {
        // error handled in hook
      }
    }
  };

  return (
    <div>
      <div className="step-header">
        <div className="step-tag">Step 2 of 5</div>
        <h1 className="step-title">Add your course history</h1>
        <p className="step-subtitle">
          Upload your DegreeWorks transcript PDF, or enter your courses manually if you do not have a PDF handy.
        </p>
      </div>

      {/* Mode toggle */}
      <div style={{
        display: 'flex', gap: '0.5rem', marginBottom: '1.5rem',
        background: 'var(--surface2)', borderRadius: '10px', padding: '0.25rem',
      }}>
        {[
          { key: 'pdf', label: 'Upload PDF' },
          { key: 'manual', label: 'Enter Manually' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            style={{
              flex: 1, padding: '0.6rem 1rem', border: 'none', borderRadius: '8px',
              fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
              background: inputMode === key ? 'var(--accent)' : 'transparent',
              color: inputMode === key ? '#0c0e14' : 'var(--muted)',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* PDF upload mode */}
      {inputMode === 'pdf' && (
        <>
          <div
            className={`upload-zone ${dragging ? 'dragging' : ''}`}
            onClick={() => fileRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); onFile(e.dataTransfer.files[0]); }}
          >
            <span className="upload-icon">📄</span>
            <div className="upload-text">Drop your transcript here</div>
            <div className="upload-sub">or <span>browse files</span> · PDF up to 10MB</div>
            {state.uploadedFile && (
              <div className="file-badge">✓ {state.uploadedFile.name}</div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={(e) => onFile(e.target.files[0])}
            />
          </div>

          {error && (
            <div className="conflict-pill" style={{ marginTop: '1rem' }}>⚠ {error}</div>
          )}

          {state.uploadedFile && (
            <div className="ai-panel" style={{ marginTop: '1.5rem' }}>
              <div className="ai-header">
                <span className="ai-badge">Transcript Ready</span>
                <span className="ai-title">
                  {state.uploadedFile.name} is attached to this advising request
                </span>
              </div>
              <p style={{ fontSize: '0.83rem', color: 'var(--muted)' }}>
                Your transcript is stored locally and sent to the backend only when you press Generate My Schedule.
              </p>
            </div>
          )}
        </>
      )}

      {/* Manual entry mode */}
      {inputMode === 'manual' && (
        <>
          <div className="ai-panel" style={{ marginBottom: '1rem' }}>
            <div className="ai-header">
              <span className="ai-badge">Manual Entry</span>
              <span className="ai-title">Enter each course you have taken or are currently taking</span>
            </div>
            <p style={{ fontSize: '0.83rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
              Use standard Morgan State course codes (e.g. COSC111, MATH241). The AI will classify each course against your CS B.S. requirements.
            </p>
          </div>
          <ManualCourseEntry />
        </>
      )}
    </div>
  );
}
