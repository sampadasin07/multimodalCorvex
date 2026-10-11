import { getFeaturesForStage } from '../../utils/featureDefinitions';
import FeatureField from './FeatureField';

export default function Stage3Vitals({ formData, onChange, errors }) {
  const features = getFeaturesForStage(3);
  const vitals = features.filter((f) => f.group === 'Vitals');
  const physExam = features.filter((f) => f.group === 'Physical Examination');

  return (
    <div>
      <div className="stage-header">
        <h2>Vitals & Physical Examination</h2>
        <p className="stage-subtitle">Stage 3 of 7 — 7 features</p>
      </div>

      <div className="feature-section">
        <h3>Vitals</h3>
        <div className="feature-grid">
          {vitals.map((feat) => (
            <FeatureField
              key={feat.key}
              featureDef={feat}
              value={formData[feat.key]}
              onChange={onChange}
              error={errors[feat.key]}
            />
          ))}
        </div>
      </div>

      <div className="feature-section">
        <h3>Physical Examination</h3>
        <div className="feature-grid">
          {physExam.map((feat) => (
            <FeatureField
              key={feat.key}
              featureDef={feat}
              value={formData[feat.key]}
              onChange={onChange}
              error={errors[feat.key]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
