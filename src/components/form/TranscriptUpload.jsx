import { useState, useRef } from 'react';
import { useAdvising } from '../../context/AdvisingContext';
import { useFileUpload } from '../../hooks/useFileUpload';

export default function TranscriptUpload() {
  const { state } = useAdvising();
  const { handleUpload, uploading, error } = useFileUpload();
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();

  const onFile = async (file) => {
    if (file) {
      try {
        await handleUpload(file);
      } catch {
        // Error state is handled in the upload hook.
      }
    }
  };

  return (
    <div>
      <div className="step-header">
        <div className="step-tag">Step 2 of 5</div>
        <h1 className="step-title">Upload your transcript</h1>
        <p className="step-subtitle">The AI reads every course and grade, maps them to your degree requirements, and identifies exactly what you still need to graduate. PDF format only.</p>
      </div>

      <div
        className={`upload-zone ${dragging ? 'dragging' : ''}`}
        onClick={() => fileRef.current.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); onFile(e.dataTransfer.files[0]); }}
      >
        <span className="upload-icon">📄</span>
        <div className="upload-text">
          {uploading ? 'Uploading...' : 'Drop your transcript here'}
        </div>
        <div className="upload-sub">or <span>browse files</span> · PDF up to 10MB</div>
        {state.uploadedFile && (
          <div className="file-badge">✓ {state.uploadedFile.name}</div>
        )}
        <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
          onChange={e => onFile(e.target.files[0])} />
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
            Your transcript is stored locally in this form and will only be sent to the backend when you press Generate My Schedule.
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--accent)', marginTop: '0.5rem' }}>
            The backend will handle transcript parsing, course analysis, and planning in one submission.
          </p>
        </div>
      )}
    </div>
  );
}
