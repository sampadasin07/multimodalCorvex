import { useState } from 'react';
import { ChevronDown, Stethoscope, FlaskConical, Heart } from 'lucide-react';
import { STAGES, getFeaturesForStage } from '../../utils/featureDefinitions';
import InfoPopover from '../common/InfoPopover';

/**
 * Patient measurements section — compact category summary by default,
 * with "View All 55 Inputs" to open full detail.
 */
export default function PatientMeasurements({ formData }) {
  const [showAll, setShowAll] = useState(false);

  // Compact summary categories
  const categories = [
    { name: 'Vitals', icon: <Stethoscope size={16} />, keys: ['BP', 'PR'] },
    { name: 'Laboratory', icon: <FlaskConical size={16} />, keys: ['FBS', 'CR', 'TG', 'LDL', 'HDL'] },
    { name: 'Cardiac / Echo', icon: <Heart size={16} />, keys: ['EF-TTE', 'Region RWMA', 'VHD'] },
  ];

  return (
    <div className="card">
      <h3 style={{ fontSize: 'var(--font-md)', fontWeight: 600, marginBottom: '16px' }}>
        Patient Measurements
      </h3>

      {/* Compact category summary */}
      {!showAll && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}>
          {categories.map((cat) => (
            <div key={cat.name} style={{
              padding: '12px',
              background: 'var(--surface-secondary)',
              borderRadius: 'var(--radius-md)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {cat.icon}
                {cat.name}
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>
                {cat.keys.map((key) => {
                  const val = formData[key];
                  return (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                      <span>{key}</span>
                      <span style={{ fontWeight: 500, color: val != null ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                        {val != null ? String(val) : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full 55-input view */}
      {showAll && <AllInputsView formData={formData} />}

      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setShowAll(!showAll)}
        style={{ width: '100%', justifyContent: 'space-between' }}
      >
        {showAll ? 'Show compact view' : 'View all 55 inputs'}
        <ChevronDown
          size={16}
          style={{ transform: showAll ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        />
      </button>
    </div>
  );
}

/**
 * Complete read-only view of all 55 inputs grouped by 7 stages.
 */
function AllInputsView({ formData }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      {STAGES.map((stage) => {
        const features = getFeaturesForStage(stage.number);
        return (
          <div key={stage.number} style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid var(--border-light)' }}>
              Stage {stage.number} — {stage.title}
            </h4>
            <div className="review-grid">
              {features.map((feat) => {
                const val = formData[feat.key];
                const isEmpty = val === null || val === undefined || val === '';
                let displayVal = isEmpty ? 'Not entered' : String(val);

                if (!isEmpty && feat.type === 'select' && feat.options) {
                  const opt = feat.options.find((o) => o.value === String(val));
                  if (opt) displayVal = opt.label;
                }

                return (
                  <div key={feat.key} className="review-item">
                    <div className="review-item-label-row">
                      <span className="review-label">{feat.label}</span>
                      <InfoPopover featureDef={feat} />
                    </div>
                    <div className={`review-value ${isEmpty ? 'empty' : ''}`}>
                      {isEmpty ? (
                        'Not entered'
                      ) : feat.type === 'boolean' ? (
                        <span className={`review-badge ${val === 'Yes' ? 'review-badge-yes' : 'review-badge-no'}`}>
                          {val}
                        </span>
                      ) : feat.unit ? (
                        <span className="review-val-with-unit">
                          <strong>{val}</strong> <span className="review-unit-tag">{feat.unit}</span>
                        </span>
                      ) : (
                        displayVal
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
