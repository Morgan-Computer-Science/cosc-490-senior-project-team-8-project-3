import { useState } from 'react';
import { useAdvising } from '../../context/AdvisingContext';
import { formatCourseCode } from '../../utils/formatters';

export default function CourseSelector() {
  const { state, dispatch } = useAdvising();
  const [courseInput, setCourseInput] = useState('');

  const addCourse = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && courseInput.trim()) {
      e.preventDefault();
      dispatch({ type: 'ADD_COURSE', payload: formatCourseCode(courseInput) });
      setCourseInput('');
    }
  };

  const removeCourse = (c) => dispatch({ type: 'REMOVE_COURSE', payload: c });

  return (
    <div>
      <div className="step-header">
        <div className="step-tag">Step 3 of 5</div>
        <h1 className="step-title">Add any requested courses</h1>
        <p className="step-subtitle">This step is optional. Add any classes you want the backend to prioritize, or leave it blank and submit the form for a full backend-generated plan.</p>
      </div>

      <div className="field">
        <label>Requested courses (optional)</label>
        <div className="course-input-wrap">
          {state.courses.map(c => (
            <span className="course-tag" key={c}>
              {c}
              <button className="tag-remove" onClick={() => removeCourse(c)}>×</button>
            </span>
          ))}
          <input
            className="course-input-inner"
            placeholder="e.g. CS 4820"
            value={courseInput}
            onChange={e => setCourseInput(e.target.value)}
            onKeyDown={addCourse}
          />
        </div>
      </div>
    </div>
  );
}
