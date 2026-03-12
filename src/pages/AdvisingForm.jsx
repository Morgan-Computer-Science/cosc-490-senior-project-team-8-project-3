import { useAdvising } from '../context/AdvisingContext';
import { useFormState } from '../hooks/useFormState';
import { submitAdvisingForm } from '../api/advising';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import StudentInfoForm from '../components/form/StudentInfoForm';
import TranscriptUpload from '../components/form/TranscriptUpload';
import CourseSelector from '../components/form/CourseSelector';
import GoalInput from '../components/form/GoalInput';
import FormReview from '../components/form/FormReview';
import AIChat from '../components/ai/AIChat';
import { useState } from 'react';

const stepComponents = [StudentInfoForm, TranscriptUpload, CourseSelector, GoalInput, FormReview];

export default function AdvisingFormPage() {
  const { state, dispatch } = useAdvising();
  const { step, goNext, goBack, isFirst, isLast } = useFormState();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const StepComponent = stepComponents[step];

  const handleSubmit = async () => {
    if (!state.uploadedFile) {
      alert('Upload a transcript before generating your schedule.');
      dispatch({ type: 'SET_STEP', payload: 1 });
      return;
    }

    try {
      setSubmitting(true);
      const result = await submitAdvisingForm({
        student: state.studentInfo,
        courses: state.courses,
        goals: state.goals,
        notes: state.advisorNotes,
        transcriptFile: state.uploadedFile,
        bearCardFile: state.bearCardFile,
      });
      dispatch({ type: 'SET_CONFIRMATION', payload: result.confirmation_id || null });
      dispatch({
        type: 'SET_TRANSCRIPT',
        payload: {
          id: result.transcript_id || null,
          parsed: result.parsedCourses || [],
        },
      });
      dispatch({ type: 'SET_UPLOAD_RESULT', payload: result });
      navigate('/results');
    } catch (err) {
      console.error('Submit failed:', err);
      alert(err.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app">
      <Sidebar currentStep={step} onStepClick={(s) => dispatch({ type: 'SET_STEP', payload: s })} />

      <main className="main">
        <StepComponent />

        <div className="btn-row">
          <button
            className="btn btn-ghost"
            onClick={goBack}
            disabled={isFirst}
            style={{ opacity: isFirst ? 0.3 : 1 }}
          >
            ← Back
          </button>

          {!isLast ? (
            <button className="btn btn-primary" onClick={goNext}>
              Continue →
            </button>
          ) : (
            <button className="btn btn-primary btn-submit" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Generating...' : 'Generate My Schedule ✦'}
            </button>
          )}
        </div>
      </main>

      <AIChat />
    </div>
  );
}
