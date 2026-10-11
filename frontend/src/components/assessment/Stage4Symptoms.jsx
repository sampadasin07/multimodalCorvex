import { getFeaturesForStage } from '../../utils/featureDefinitions';
import FeatureField from './FeatureField';

export default function Stage4Symptoms({ formData, onChange, errors }) {
  const features = getFeaturesForStage(4);

  return (
    <div>
      <div className="stage-header">
        <h2>Symptoms / Clinical Presentation</h2>
        <p className="stage-subtitle">Stage 4 of 7 — 7 features</p>
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
