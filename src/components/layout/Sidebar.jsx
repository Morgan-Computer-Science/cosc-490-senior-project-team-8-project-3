import StepIndicator from '../form/StepIndicator';

export default function Sidebar({ currentStep, onStepClick }) {
  return (
    <aside className="sidebar">
      <div className="logo">
        <span className="logo-dot" />
        BearAdvisorAI
      </div>
      <StepIndicator currentStep={currentStep} onStepClick={onStepClick} />
      <div className="sidebar-footer">
        Your data is encrypted and used solely for AI-powered advising. Transcripts are deleted after processing.
      </div>
    </aside>
  );
}
