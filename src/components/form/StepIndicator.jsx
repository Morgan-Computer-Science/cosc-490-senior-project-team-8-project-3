import { STEP_LABELS } from '../../utils/constants';

export default function StepIndicator({ currentStep, onStepClick }) {
  return (
    <nav className="steps-nav">
      {STEP_LABELS.map((label, i) => (
        <div
          key={i}
          className={`step-item ${i === currentStep ? 'active' : i < currentStep ? 'done' : ''}`}
          onClick={() => i < currentStep && onStepClick(i)}
          style={{ cursor: i < currentStep ? 'pointer' : 'default' }}
        >
          <div className="step-num">
            {i < currentStep ? '✓' : i + 1}
          </div>
          <span className="step-label">{label}</span>
        </div>
      ))}
    </nav>
  );
}
