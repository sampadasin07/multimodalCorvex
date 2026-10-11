import { riskColor, riskLabel } from '../../utils/riskColor';

/**
 * Vessel-specific prediction cards for LAD, LCX, RCA.
 * Clicking a vessel updates the selectedVessel state.
 */
export default function VesselPredictionCards({ vessels, selectedVessel, onVesselSelect }) {
  if (!vessels) return null;

  const vesselNames = ['LAD', 'LCX', 'RCA'];
  const vesselFullNames = {
    LAD: 'Left Anterior Descending',
    LCX: 'Left Circumflex',
    RCA: 'Right Coronary Artery',
  };
  const vesselColors = {
    LAD: 'var(--vessel-lad)',
    LCX: 'var(--vessel-lcx)',
    RCA: 'var(--vessel-rca)',
  };

  return (
    <div>
      <h3 style={{ fontSize: 'var(--font-md)', fontWeight: 600, marginBottom: '12px' }}>
        Vessel-Specific Predictions
      </h3>
      <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
        Click a vessel for detailed probability / explanation.
      </p>
      <div className="vessel-cards-row">
        {vesselNames.map((name) => {
          const data = vessels[name];
          if (!data) return null;
          const pct = Math.round(data.probability * 100);
          const isActive = selectedVessel === name;

          return (
            <div
              key={name}
              className={`card vessel-card ${isActive ? 'active' : ''}`}
              onClick={() => onVesselSelect(name)}
              role="button"
              tabIndex={0}
              aria-label={`${name} vessel prediction`}
            >
              {/* Color accent bar */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: vesselColors[name],
                borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
              }} />

              <div className="vessel-name" style={{ color: vesselColors[name] }}>
                {name}
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                {vesselFullNames[name]}
              </div>
                            <div className="vessel-prob" style={{ color: riskColor(data) }}>
                {pct}%
              </div>
              <div className="vessel-status">
                {data.status} (Predicted)
              </div>
              <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: riskColor(data) }}>
                {riskLabel(data)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
