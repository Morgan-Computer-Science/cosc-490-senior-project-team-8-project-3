import { useState } from 'react';
import { useAdvising } from '../../context/AdvisingContext';

const STATUS_OPTIONS = ['COMPLETED', 'IN_PROGRESS', 'PLANNED'];
const GRADE_OPTIONS = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F', 'W', 'P', ''];

// Loose validation: letters then digits (e.g. COSC111, MATH241, ENGL101)
const COURSE_CODE_RE = /^[A-Z]{2,5}\s*\d{3,4}$/i;

export default function ManualCourseEntry() {
  const { state, dispatch } = useAdvising();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('COMPLETED');
  const [grade, setGrade] = useState('');
  const [term, setTerm] = useState('');
  const [error, setError] = useState('');

  const add = () => {
    const normalized = code.trim().toUpperCase().replace(/\s+/g, '');
    if (!COURSE_CODE_RE.test(normalized)) {
      setError('Enter a valid course code (e.g. COSC111, MATH241)');
      return;
    }
    if (state.manualCourses.some((c) => c.code === normalized)) {
      setError(`${normalized} is already in your list`);
      return;
    }
    dispatch({ type: 'ADD_MANUAL_COURSE', payload: { code: normalized, status, grade, term } });
    setCode('');
    setGrade('');
    setTerm('');
    setError('');
  };

  const remove = (courseCode) => {
    dispatch({ type: 'REMOVE_MANUAL_COURSE', payload: courseCode });
  };

  const statusColor = {
    COMPLETED: 'var(--accent)',
    IN_PROGRESS: '#60a5fa',
    PLANNED: 'var(--muted)',
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      {/* Entry row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto auto auto',
        gap: '0.5rem',
        alignItems: 'start',
        marginBottom: '0.75rem',
      }}>
        <div className="field" style={{ margin: 0 }}>
          <label style={{ fontSize: '0.75rem' }}>Course Code</label>
          <input
            type="text"
            value={code}
            onChange={(e) => { setCode(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="e.g. COSC111"
            style={{ textTransform: 'uppercase' }}
          />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label style={{ fontSize: '0.75rem' }}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label style={{ fontSize: '0.75rem' }}>Grade</label>
          <select value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">—</option>
            {GRADE_OPTIONS.filter(Boolean).map((g) => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label style={{ fontSize: '0.75rem' }}>Term</label>
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="e.g. Fall 2024"
            style={{ width: '110px' }}
          />
        </div>
        <div style={{ paddingTop: '1.6rem' }}>
          <button className="btn btn-primary" onClick={add} style={{ padding: '0.55rem 1rem', whiteSpace: 'nowrap' }}>
            + Add
          </button>
        </div>
      </div>

      {error && (
        <div className="conflict-pill" style={{ marginBottom: '0.75rem' }}>
          {error}
        </div>
      )}

      {/* Course list */}
      {state.manualCourses.length === 0 ? (
        <div style={{
          border: '1px dashed var(--border)', borderRadius: '10px',
          padding: '1.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem',
        }}>
          No courses added yet. Add each course you have completed or are taking.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {state.manualCourses.map((c) => (
            <div
              key={c.code}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                background: 'var(--surface2)', borderRadius: '8px', padding: '0.6rem 0.9rem',
                border: '1px solid var(--border)',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: '0.85rem', minWidth: '70px' }}>
                {c.code}
              </span>
              <span style={{
                fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.04em',
                color: statusColor[c.status] || 'var(--muted)',
              }}>
                {c.status}
              </span>
              {c.grade && (
                <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                  Grade: {c.grade}
                </span>
              )}
              {c.term && (
                <span style={{ fontSize: '0.78rem', color: 'var(--muted)', flex: 1 }}>
                  {c.term}
                </span>
              )}
              <button
                onClick={() => remove(c.code)}
                className="tag-remove"
                title="Remove"
                style={{ marginLeft: 'auto', fontSize: '1rem' }}
              >
                ×
              </button>
            </div>
          ))}
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
            {state.manualCourses.length} course{state.manualCourses.length !== 1 ? 's' : ''} entered
          </div>
        </div>
      )}
    </div>
  );
}
