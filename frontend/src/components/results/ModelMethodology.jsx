import { useState } from 'react';
import { ChevronDown, Cpu, AlertTriangle } from 'lucide-react';

/**
 * Model/methodology expandable section.
 * Displays model metadata — must come from service layer, not hard-coded.
 */
export default function ModelMethodology({ modelInfo }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card">
      <button
        className="btn btn-ghost"
        onClick={() => setExpanded(!expanded)}
        style={{ width: '100%', justifyContent: 'space-between', padding: '0' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
          <Cpu size={18} />
          Model / Methodology
        </span>
        <ChevronDown
          size={16}
          style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        />
      </button>

      {expanded && (
        <div style={{ marginTop: '16px' }}>
          {modelInfo?._isMock && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', fontSize: 'var(--font-xs)', color: 'var(--color-warning)' }}>
              <AlertTriangle size={12} />
              Mock/demo metadata — actual model details will be provided by the ML team.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <DetailItem label="Model Name" value={modelInfo?.name || 'Unavailable'} />
            <DetailItem label="Version" value={modelInfo?.version || 'Unavailable'} />
            <DetailItem label="Preprocessing" value={modelInfo?.preprocessing || 'Unavailable'} />
            <DetailItem label="Validation Method" value={modelInfo?.validationMethod || 'Unavailable'} />
          </div>

          {modelInfo?.metrics && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Performance Metrics
              </div>
              {modelInfo.metrics.rows ? (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Target</th><th>Model</th><th>CV AUC</th><th>Test AUC</th>
                          <th>Precision</th><th>Recall</th><th>F1</th><th>Threshold</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modelInfo.metrics.rows.map((r) => (
                          <tr key={r.target}>
                            <td><strong>{r.target}</strong></td>
                            <td>{r.model}</td>
                            <td>{r.cvAuc.toFixed(2)}</td>
                            <td>{r.rocAuc.toFixed(2)}</td>
                            <td>{r.precision.toFixed(2)}</td>
                            <td>{r.recall.toFixed(2)}</td>
                            <td>{r.f1.toFixed(2)}</td>
                            <td>{r.threshold.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginTop: '8px' }}>
                    CV AUC is from cross-validation on the training patients; the other columns are from a
                    held-out test set of {modelInfo.metrics.testSize} patients. With a test set this small,
                    treat the figures as indicative. Decision thresholds are tuned for high sensitivity,
                    so some false alarms are expected.
                  </p>
                </>
              ) : modelInfo.metrics.note ? (
                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                  {modelInfo.metrics.note}
                </p>
              ) : (
                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)' }}>
                  Metrics unavailable.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div style={{ padding: '8px 12px', background: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)' }}>
      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: 'var(--font-sm)', fontWeight: 500 }}>{value}</div>
    </div>
  );
}
