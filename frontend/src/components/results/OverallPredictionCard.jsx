import { useState } from 'react';
import { ChevronDown, AlertTriangle } from 'lucide-react';
import { riskColor, riskLabel } from '../../utils/riskColor';

/**
 * Overall CAD prediction card with probability ring and expandable details.
 */
export default function OverallPredictionCard({ prediction }) {
  const [showDetails, setShowDetails] = useState(false);

  if (!prediction || !prediction.overallCAD) return null;

  const { status, probability, label, threshold } = prediction.overallCAD;
  const pct = Math.round(probability * 100);
  const isPositive = status === 'Positive';
  const color = riskColor(prediction.overallCAD);

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 700 }}>Overall CAD Prediction</h2>
        <span className={`badge ${isPositive ? 'badge-danger' : 'badge-success'}`}>
          {isPositive ? 'CAD Detected' : 'Normal'} (Predicted)
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        {/* Probability ring */}
        <div className="prob-ring">
          <svg width="100" height="100" viewBox="0 0 100 100">
            {/* Background ring */}
            <circle
              cx="50" cy="50" r="42"
              fill="none"
              stroke="var(--surface-secondary)"
              strokeWidth="8"
            />
            {/* Progress ring */}
            <circle
              cx="50" cy="50" r="42"
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 42}`}
              strokeDashoffset={`${2 * Math.PI * 42 * (1 - probability)}`}
              strokeLinecap="round"
            />
          </svg>
          <span className="prob-value" style={{ color }}>
            {pct}%
          </span>
        </div>

        <div>
          <div style={{ fontSize: 'var(--font-md)', fontWeight: 600, marginBottom: '4px' }}>
            {label}
          </div>
          <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)' }}>
                        Predicted probability of CAD · <strong style={{ color }}>{riskLabel(prediction.overallCAD)}</strong>
          </div>
        </div>
      </div>

      {/* Expandable details */}
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setShowDetails(!showDetails)}
        style={{ marginTop: '16px', width: '100%', justifyContent: 'space-between' }}
      >
        View Prediction Details
        <ChevronDown
          size={16}
          style={{ transform: showDetails ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        />
      </button>

      {showDetails && (
        <div style={{ marginTop: '12px', padding: '12px', background: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)' }}>
          {prediction._meta?.isMock && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
              <AlertTriangle size={14} color="var(--color-warning)" />
              This result is from mock/demo data for frontend demonstration.
            </div>
          )}
          <div style={{ fontSize: 'var(--font-sm)' }}>
            <div><strong>Output:</strong> Cath / Overall CAD</div>
            <div><strong>Status:</strong> {status}</div>
            <div><strong>Probability:</strong> {(probability * 100).toFixed(1)}%</div>
            {threshold != null && (
              <div>
                <strong>Decision threshold:</strong> {(threshold * 100).toFixed(1)}% (tuned for high sensitivity, so false alarms are expected)
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
