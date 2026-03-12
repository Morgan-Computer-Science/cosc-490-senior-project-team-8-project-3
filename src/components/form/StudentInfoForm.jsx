import { useRef, useState } from 'react';
import { useAdvising } from '../../context/AdvisingContext';
import { YEAR_OPTIONS } from '../../utils/constants';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

export default function StudentInfoForm() {
  const { state, dispatch } = useAdvising();
  const { studentInfo } = state;
  const bearCardRef = useRef();
  const [dragging, setDragging] = useState(false);

  const update = (field, value) => {
    dispatch({ type: 'SET_STUDENT_INFO', payload: { [field]: value } });
  };

  const handleBearCard = (file) => {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return;
    const preview = URL.createObjectURL(file);
    dispatch({ type: 'SET_BEAR_CARD', payload: { file, preview } });
  };

  return (
    <div>
      <div className="step-header">
        <div className="step-tag">Step 1 of 5</div>
        <h1 className="step-title">Tell us about yourself</h1>
        <p className="step-subtitle">We'll use this to pull up your academic record and personalize your AI advising plan.</p>
      </div>
      <div className="grid-2">
        <div className="field">
          <label>Full Name</label>
          <input type="text" placeholder="Jane Doe" value={studentInfo.name}
            onChange={e => update('name', e.target.value)} />
        </div>
        <div className="field">
          <label>NetID / Student ID</label>
          <input type="text" placeholder="jd123" value={studentInfo.netid}
            onChange={e => update('netid', e.target.value)} />
        </div>
      </div>
      <div className="grid-2">
        <div className="field">
          <label>Major</label>
          <input type="text" placeholder="Computer Science" value={studentInfo.major}
            onChange={e => update('major', e.target.value)} />
        </div>
        <div className="field">
          <label>Year</label>
          <select value={studentInfo.year} onChange={e => update('year', e.target.value)}>
            {YEAR_OPTIONS.map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="field" style={{ marginTop: '0.5rem' }}>
        <label>Bear Card Photo <span style={{ textTransform: 'none', fontWeight: 400, letterSpacing: 0 }}>(optional)</span></label>
        {!state.bearCardFile ? (
          <div
            className={`upload-zone ${dragging ? 'dragging' : ''}`}
            style={{ padding: '2rem 1.5rem' }}
            onClick={() => bearCardRef.current.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleBearCard(e.dataTransfer.files[0]); }}
          >
            <span className="upload-icon" style={{ fontSize: '2rem' }}>🪪</span>
            <div className="upload-text" style={{ fontSize: '1rem' }}>Upload your Bear Card</div>
            <div className="upload-sub">
              Take a photo or <span>browse files</span> · JPG, PNG, or WebP
            </div>
            <input
              ref={bearCardRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              style={{ display: 'none' }}
              onChange={e => handleBearCard(e.target.files[0])}
            />
          </div>
        ) : (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '14px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem',
          }}>
            <img
              src={state.bearCardPreview}
              alt="Bear Card"
              style={{
                width: '100px', height: '64px', objectFit: 'cover',
                borderRadius: '8px', border: '1px solid var(--border)',
              }}
            />
            <div style={{ flex: 1 }}>
              <div className="file-badge" style={{ marginTop: 0 }}>
                ✓ {state.bearCardFile.name}
              </div>
            </div>
            <button
              className="tag-remove"
              style={{ fontSize: '1.2rem', padding: '0.4rem' }}
              onClick={() => dispatch({ type: 'CLEAR_BEAR_CARD' })}
              title="Remove"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
