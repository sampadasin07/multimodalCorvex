import { STAGES, getFeaturesForStage } from '../../utils/featureDefinitions';
import { Edit3 } from 'lucide-react';
import InfoPopover from '../common/InfoPopover';

export default function AssessmentReview({ formData, patientId, assessmentDate, isDemo, onEditStage }) {
  return (
    <div>
      {STAGES.map((stage) => {
        const features = getFeaturesForStage(stage.number);
        const stageFilledCount = features.filter(
          (f) => formData[f.key] !== null && formData[f.key] !== '' && formData[f.key] !== undefined
        ).length;

        const missingRequiredInStage = features.filter(
          (f) => f.required && (formData[f.key] === null || formData[f.key] === '' || formData[f.key] === undefined)
        );

        const hasMissingRequired = missingRequiredInStage.length > 0;

        return (
          <div
            key={stage.number}
            className="review-stage card"
            style={{
              marginBottom: '16px',
              border: hasMissingRequired ? '1px solid var(--color-danger)' : undefined,
              boxShadow: hasMissingRequired ? '0 0 0 1px rgba(239, 68, 68, 0.2)' : undefined,
            }}
          >
            <div className="review-stage-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: 'var(--font-md)', fontWeight: 600 }}>
                    Stage {stage.number} — {stage.title}
                  </h3>
                  {hasMissingRequired && (
                    <span
                      style={{
                        background: 'var(--color-danger-bg)',
                        color: 'var(--color-danger)',
                        border: '1px solid var(--color-danger)',
                        fontSize: 'var(--font-xs)',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        fontWeight: 600,
                      }}
                    >
                      ⚠️ {missingRequiredInStage.length} Required Field{missingRequiredInStage.length > 1 ? 's' : ''} Missing
                    </span>
                  )}
                </div>
                <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', fontSize: '0.82em', display: 'block', marginTop: '4px' }}>
                  {stageFilledCount} / {stage.featureCount} completed
                </span>
              </div>
              <button
                type="button"
                className={hasMissingRequired ? "btn btn-outline btn-sm" : "btn btn-secondary btn-sm"}
                onClick={() => onEditStage(stage.number)}
                id={`btn-edit-stage-${stage.number}`}
                aria-label={`Edit Stage ${stage.number}: ${stage.title}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderColor: hasMissingRequired ? 'var(--color-danger)' : undefined,
                  color: hasMissingRequired ? 'var(--color-danger)' : undefined,
                }}
              >
                <Edit3 size={14} /> Fill Stage {stage.number}
              </button>
            </div>

            <div className="review-grid">
              {features.map((feat) => {
                const val = formData[feat.key];
                const isEmpty = val === null || val === undefined || val === '';
                const isRequiredMissing = feat.required && isEmpty;

                return (
                  <div
                    key={feat.key}
                    className={`review-item ${isRequiredMissing ? 'review-item-missing-required' : ''}`}
                    style={
                      isRequiredMissing
                        ? {
                            border: '1.5px solid var(--color-danger)',
                            background: 'rgba(239, 68, 68, 0.05)',
                            borderRadius: 'var(--radius-md)',
                            padding: '10px 12px',
                          }
                        : undefined
                    }
                  >
                    <div className="review-item-label-row">
                      <span className="review-label" style={{ fontWeight: isRequiredMissing ? 600 : 500 }}>
                        {feat.label}
                        {feat.required && (
                          <span style={{ color: 'var(--color-danger)', marginLeft: '3px', fontWeight: 'bold' }}>*</span>
                        )}
                      </span>
                      <InfoPopover featureDef={feat} />
                    </div>
                    <div className={`review-value ${isEmpty ? 'empty' : ''}`}>
                      {isRequiredMissing ? (
                        <span
                          style={{
                            color: 'var(--color-danger)',
                            fontWeight: 700,
                            fontSize: 'var(--font-xs)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'var(--color-danger-bg)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                          }}
                        >
                          Required Field Missing
                        </span>
                      ) : isEmpty ? (
                        <span className="text-muted">Not entered</span>
                      ) : (
                        formatReviewValue(feat, val)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatReviewValue(featureDef, value) {
  if (featureDef.type === 'boolean') {
    if (value === 'Yes') {
      return <span className="review-badge review-badge-yes">Yes</span>;
    }
    if (value === 'No') {
      return <span className="review-badge review-badge-no">No</span>;
    }
    return String(value);
  }

  if (featureDef.type === 'select' && featureDef.options) {
    const opt = featureDef.options.find((o) => o.value === String(value));
    return <span className="review-val-text">{opt ? opt.label : String(value)}</span>;
  }

  if (featureDef.unit) {
    return (
      <span className="review-val-with-unit">
        <strong>{value}</strong> <span className="review-unit-tag">{featureDef.unit}</span>
      </span>
    );
  }

  return <span className="review-val-text">{String(value)}</span>;
}
