import { getFeaturesForStage } from '../../utils/featureDefinitions';
import FeatureField from './FeatureField';

export default function Stage5ECG({ formData, onChange, errors }) {
  const features = getFeaturesForStage(5);

  return (
    <div>
      <div className="stage-header">
        <h2>ECG</h2>
        <p className="stage-subtitle">Stage 5 of 7 — 7 features</p>
      </div>

      <div className="feature-grid">
        {features.map((feat) => (
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
  );
}
