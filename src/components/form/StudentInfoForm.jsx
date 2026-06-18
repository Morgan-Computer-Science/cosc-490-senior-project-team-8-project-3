import { useRef, useState } from 'react';
import { useAdvising } from '../../context/AdvisingContext';
import { YEAR_OPTIONS } from '../../utils/constants';
import { extractBearCard } from '../../api/advising';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

export default function StudentInfoForm() {
  const { state, dispatch } = useAdvising();
  const { studentInfo } = state;
  const bearCardRef = useRef();
  const [dragging, setDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractNote, setExtractNote] = useState('');

  const update = (field, value) => {
    dispatch({ type: 'SET_STUDENT_INFO', payload: { [field]: value } });
  };

  const handleBearCard = async (file) => {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return;

    const preview = URL.createObjectURL(file);
    dispatch({ type: 'SET_BEAR_CARD', payload: { file, preview } });
    setExtractNote('');
    setExtracting(true);

    try {
      const data = await extractBearCard(file);
      if (data.name) {
        dispatch({ type: 'SET_STUDENT_INFO', payload: { name: data.name } });
      }
      if (data.student_id) {
        dispatch({ type: 'SET_STUDENT_INFO', payload: { netid: data.student_id } });
      }
      if (data.name || data.student_id) {
        setExtractNote('Auto-filled from Bear Card');
      } else if (data.note) {
        setExtractNote(data.note);
      } else {
        setExtractNote('Could not read card — please fill in manually');
      }
    } catch {
      setExtractNote('OCR unavailable — fill in manually');
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div>
      <div className="step-header">
        <div className="step-tag">Step 1 of 5</div>
        <h1 className="step-title">Tell us about yourself</h1>
        <p className="step-subtitle">
          We'll use this to personalize your AI advising plan.
        </p>
      </div>

      <div className="grid-2">
        <div className="field">
          <label>Full Name</label>
          <input
            type="text"
            placeholder="Jane Doe"
            value={studentInfo.name}
            onChange={(e) => update('name', e.target.value)}
          />
        </div>
        <div className="field">
          <label>NetID / Student ID</label>
          <input
            type="text"
            placeholder="jd123"
            value={studentInfo.netid}
            onChange={(e) => update('netid', e.target.value)}
          />
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label>Major</label>
          <input
            type="text"
            placeholder="Computer Science"
            value={studentInfo.major}
            onChange={(e) => update('major', e.target.value)}
          />
        </div>
        <div className="field">
          <label>Year</label>
          <select value={studentInfo.year} onChange={(e) => update('year', e.target.value)}>
            {YEAR_OPTIONS.map((y) => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="field" style={{ marginTop: '0.5rem' }}>
        <label>
          Bear Card Photo
          <span style={{ textTransform: 'none', fontWeight: 400, letterSpacing: 0 }}>
            {' '}(optional — auto-fills name and ID)
          </span>
        </label>

        {!state.bearCardFile ? (
          <div
            className={`upload-zone ${dragging ? 'dragging' : ''}`}
            style={{ padding: '2rem 1.5rem' }}
            onClick={() => bearCardRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleBearCard(e.dataTransfer.files[0]); }}
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
              onChange={(e) => handleBearCard(e.target.files[0])}
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
              style={{ width: '100px', height: '64px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)' }}
            />
            <div style={{ flex: 1 }}>
              <div className="file-badge" style={{ marginTop: 0 }}>
                ✓ {state.bearCardFile.name}
              </div>
              {extracting && (
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                  Reading card...
                </div>
              )}
              {extractNote && !extracting && (
                <div style={{
                  fontSize: '0.78rem', marginTop: '0.25rem',
                  color: extractNote.startsWith('Auto-filled') ? 'var(--accent)' : 'var(--muted)',
                }}>
                  {extractNote}
                </div>
              )}
            </div>
            <button
              className="tag-remove"
              style={{ fontSize: '1.2rem', padding: '0.4rem' }}
              onClick={() => {
                dispatch({ type: 'CLEAR_BEAR_CARD' });
                setExtractNote('');
              }}
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
