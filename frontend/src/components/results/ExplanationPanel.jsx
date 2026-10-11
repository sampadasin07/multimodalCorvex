import { useState } from 'react';
import { ChevronDown, AlertTriangle, BarChart3 } from 'lucide-react';

const TARGET_NAMES = {
  CAD: 'Overall CAD',
  LAD: 'LAD (Left Anterior Descending)',
  LCX: 'LCX (Left Circumflex)',
  RCA: 'RCA (Right Coronary Artery)',
};

function Unavailable() {
  return (
    <div className="card">
      <h3 style={{ fontSize: 'var(--font-md)', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <BarChart3 size={18} />
        Why This Prediction?
      </h3>
      <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)' }}>
        Explainability is currently unavailable.
      </p>
    </div>
  );
}

export default function ExplanationPanel({ explanation, selectedVessel }) {
  const [expanded, setExpanded] = useState(false);

  if (!explanation || !explanation.available) return <Unavailable />;

  const target = selectedVessel || 'CAD';
  const features = explanation.byTarget?.[target] || explanation.features || [];
  const shown = expanded ? features : features.slice(0, 5);
  const maxContrib = Math.max(...features.map((f) => Math.abs(f.contribution)), 0.01);
  const isMock = /mock/i.test(explanation.method || '');
  const hasAssumed = features.some((f) => f.assumed);

  return (
    <div className="card">
      <h3 style={{ fontSize: 'var(--font-md)', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <BarChart3 size={18} />
        Why This Prediction?
      </h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>
          Method: {explanation.method}
        </span>
        {isMock && <span className="badge badge-demo" style={{ fontSize: '10px' }}>DEMO</span>}
      </div>

      {explanation.byTarget && (
        <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, marginBottom: '12px' }}>
          Explaining: {TARGET_NAMES[target] || target}
          <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>
            {' '}— select a vessel to see its own explanation
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '16px', fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginBottom: '12px' }}>
        <span>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--corvex-blue-500)', marginRight: 4 }} />
          raises predicted risk
        </span>
        <span>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--color-success)', marginRight: 4 }} />
          protective / normal baseline
        </span>
      </div>

      <ExplainabilityChart features={shown} maxContrib={maxContrib} />

      {features.length > 5 && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setExpanded(!expanded)}
          style={{ marginTop: '12px', width: '100%', justifyContent: 'space-between' }}
        >
          {expanded ? 'Show less' : `View all ${features.length} contributing features`}
          <ChevronDown
            size={16}
            style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
          />
        </button>
      )}

      <div style={{ marginTop: '8px', fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
        <AlertTriangle size={12} color="var(--color-warning)" style={{ marginTop: '2px', flexShrink: 0 }} />
        <span>
          {isMock
            ? 'These contribution values are from mock data for demonstration only.'
            : 'Bars show each factor’s relative contribution to the model’s estimate. Note: Features that "lower" risk often simply represent normal/healthy clinical values that lack a pathological signal.'}
          {hasAssumed && ' “Assumed” means no value was entered, so a typical training value was used.'}
        </span>
      </div>
    </div>
  );
}

/**
 * Reusable ExplainabilityChart component.
 * Accepts explanation data as props — does NOT import mock data directly.
 */
export function ExplainabilityChart({ features, maxContrib }) {
  if (!features || features.length === 0) return null;

  return (
    <div className="explanation-preview">
      {features.map((feat, i) => {
        const absContrib = Math.abs(feat.contribution);
        const widthPct = Math.max((absContrib / maxContrib) * 100, 4);
        const isPositive = feat.direction === 'positive' || feat.contribution > 0;
        const valueText = `${feat.value}${feat.unit ? ' ' + feat.unit : ''}`;

        return (
          <div key={feat.key || i} className="explanation-feature">
            <span className="feat-name">{feat.label}</span>
            <div className="feat-bar-container">
              <div
                className={`contrib-bar ${isPositive ? 'positive' : 'negative'}`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
            <span
              className="feat-value"
              style={{ flex: '0 0 150px', color: feat.abnormal ? 'var(--color-warning)' : undefined }}
              title={feat.abnormal ? 'Outside the normal range' : undefined}
            >
              {valueText}{feat.assumed ? ' (assumed)' : ''} ({isPositive ? '+' : '−'}{Math.round(absContrib * 100)}%)
            </span>
          </div>
        );
      })}
    </div>
  );
}