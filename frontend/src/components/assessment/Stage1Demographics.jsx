import { useEffect } from 'react';
import { getFeaturesForStage } from '../../utils/featureDefinitions';
import FeatureField from './FeatureField';
import { Calculator, Beaker, CheckCircle2 } from 'lucide-react';

export default function Stage1Demographics({ formData, onChange, errors, onLoadDemo, isDemo }) {
  const features = getFeaturesForStage(1);

  // Automatically calculate BMI whenever Weight or Height changes
  useEffect(() => {
    const weight = formData['Weight'];
    const length = formData['Length'];
    if (
      weight !== null &&
      weight !== undefined &&
      weight !== '' &&
      length !== null &&
      length !== undefined &&
      length !== ''
    ) {
      const w = Number(weight);
      const l = Number(length);
      if (w > 0 && l > 0 && !isNaN(w) && !isNaN(l)) {
        const heightM = l / 100;
        const autoBmi = Math.round((w / (heightM * heightM)) * 10) / 10;
        if (formData['BMI'] !== autoBmi) {
          onChange('BMI', autoBmi);
        }
      }
    }
  }, [formData['Weight'], formData['Length']]);

  const handleManualCalculateBMI = () => {
    const weight = formData['Weight'];
    const length = formData['Length'];
    if (weight && length && Number(length) > 0) {
      const heightM = Number(length) / 100;
      const bmi = Math.round((Number(weight) / (heightM * heightM)) * 10) / 10;
      onChange('BMI', bmi);
    }
  };

  const hasWeightAndHeight =
    formData['Weight'] > 0 && formData['Length'] > 0;

  return (
    <div>
      <div className="stage-header">
        <h2>Demographics & Body Measurements</h2>
        <p className="stage-subtitle">Stage 1 of 7 — 5 features</p>
      </div>

      {/* Demo Data Banner — prominent call-to-action at the top of Stage 1 */}
      <div className="demo-banner">
        <div className="demo-banner-left">
          <Beaker size={20} style={{ flexShrink: 0 }} />
          <div>
            <div className="demo-banner-title">
              Try with Demo Patient
              {isDemo && <span className="badge badge-demo" style={{ marginLeft: 8 }}>DEMO / SYNTHETIC DATA</span>}
            </div>
            <div className="demo-banner-desc">
              Instantly fills all 55 fields with realistic synthetic clinical data so you can explore the full workflow.
            </div>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={onLoadDemo}
          id="btn-load-demo"
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          <Beaker size={15} /> Load Demo Data
        </button>
      </div>


      <div className="feature-grid">
        {features.map((feat) => (
          <div key={feat.key}>
            <FeatureField
              featureDef={feat}
              value={formData[feat.key]}
              onChange={onChange}
              error={errors[feat.key]}
            />
            {feat.key === 'BMI' && (
              <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {hasWeightAndHeight && formData['BMI'] ? (
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-success)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 500,
                    }}
                  >
                    <CheckCircle2 size={13} /> Auto-calculated from Weight & Height
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleManualCalculateBMI}
                    disabled={!hasWeightAndHeight}
                    style={{ fontSize: '12px', padding: '2px 8px' }}
                  >
                    <Calculator size={13} /> Calculate BMI
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
