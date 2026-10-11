import { getFeaturesForStage } from '../../utils/featureDefinitions';
import FeatureField from './FeatureField';

export default function Stage2MedicalHistory({ formData, onChange, errors }) {
  const features = getFeaturesForStage(2);

  return (
    <div>
      <div className="stage-header">
        <h2>Medical History & Risk Factors</h2>
        <p className="stage-subtitle">Stage 2 of 7 — 12 features</p>
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
