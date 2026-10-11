import { getFeaturesForStage } from '../../utils/featureDefinitions';
import FeatureField from './FeatureField';

export default function Stage7Echocardiography({ formData, onChange, errors }) {
  const features = getFeaturesForStage(7);

  return (
    <div>
      <div className="stage-header">
        <h2>Echocardiography</h2>
        <p className="stage-subtitle">Stage 7 of 7 — 3 features</p>
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
