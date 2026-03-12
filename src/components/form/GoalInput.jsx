import { useAdvising } from '../../context/AdvisingContext';

export default function GoalInput() {
  const { state, dispatch } = useAdvising();

  return (
    <div>
      <div className="step-header">
        <div className="step-tag">Step 4 of 5</div>
        <h1 className="step-title">What are you working toward?</h1>
        <p className="step-subtitle">The AI already knows your degree requirements. Tell it about your career interests, concentration preferences, or timeline so it can prioritize the right courses and electives for you.</p>
      </div>

      <div className="field">
        <label>Academic & career goals</label>
        <textarea
          placeholder="e.g. I want to focus on cybersecurity and graduate by Spring 2027. I also need a light course load on Fridays for my internship..."
          value={state.goals}
          onChange={e => dispatch({ type: 'SET_GOALS', payload: e.target.value })}
          style={{ minHeight: '160px' }}
        />
      </div>

      <div className="field">
        <label>Anything else we should know?</label>
        <textarea
          placeholder="e.g. I can't take classes before 10am, I want to keep Fridays free, I need to retake MATH 241..."
          value={state.advisorNotes}
          onChange={e => dispatch({ type: 'SET_ADVISOR_NOTES', payload: e.target.value })}
          style={{ minHeight: '100px' }}
        />
      </div>
    </div>
  );
}
