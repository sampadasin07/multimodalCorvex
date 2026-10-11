import { getFeaturesForStage } from '../../utils/featureDefinitions';
import FeatureField from './FeatureField';

export default function Stage6Laboratory({ formData, onChange, errors }) {
  const features = getFeaturesForStage(6);

  return (
    <div>
      <div className="stage-header">
        <h2>Laboratory Results</h2>
        <p className="stage-subtitle">Stage 6 of 7 — 14 features</p>
      </div>

      <div className="lab-grid">
        {features.map((feat) => (
          <div key={feat.key} className="lab-item">
            <FeatureField
              featureDef={feat}
              value={formData[feat.key]}
              onChange={onChange}
              error={errors[feat.key]}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
