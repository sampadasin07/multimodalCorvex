import { STAGES } from '../../utils/featureDefinitions';
import { Check } from 'lucide-react';

export default function AssessmentStepper({ currentStage, completedStages = [], onStageClick }) {
  const maxCompleted = completedStages.length > 0 ? Math.max(...completedStages) : 0;

  return (
    <div className="stepper" role="navigation" aria-label="Assessment Stages">
      {STAGES.map((stage, index) => {
        const isCompleted = completedStages.includes(stage.number);
        const isCurrent = currentStage === stage.number;
        const isClickable =
          isCompleted ||
          isCurrent ||
          stage.number <= maxCompleted + 1 ||
          stage.number === 1;

        return (
          <div key={stage.number} style={{ display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              className={`stepper-step ${isCurrent ? 'current' : ''} ${isCompleted ? 'completed' : ''}`}
              onClick={() => isClickable && onStageClick(stage.number)}
              disabled={!isClickable}
              style={{
                cursor: isClickable ? 'pointer' : 'not-allowed',
                opacity: isClickable ? 1 : 0.45,
                background: 'transparent',
                border: 'none',
                padding: 0,
                textAlign: 'left',
              }}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={`Stage ${stage.number}: ${stage.title}${isCompleted ? ' (Completed)' : ''}`}
            >
              <span className="step-number">
                {isCompleted ? <Check size={14} /> : stage.number}
              </span>
              <span className="step-label">{stage.title}</span>
            </button>
            {index < STAGES.length - 1 && (
              <div className={`stepper-connector ${isCompleted ? 'completed' : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
