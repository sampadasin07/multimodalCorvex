export const RISK_COLORS = { low: '#10b981', moderate: '#f59e0b', high: '#ef4444' };
const RISK_LABELS = { low: 'Low risk', moderate: 'Moderate risk', high: 'High risk' };

/** Takes a vessel/overall object: { riskLevel?, probability, threshold? } */
export function riskLevelOf(data) {
  if (data?.riskLevel) return data.riskLevel;     // from the backend
  const p = data?.probability ?? 0;               // fallback for mock data (same cut-offs as backend)
  
  if (data?.threshold != null) {
    const t = data.threshold;
    if (p >= t) {
      const margin = (1.0 - t) / 2;
      return p >= t + margin ? 'high' : 'moderate';
    } else {
      return 'low';
    }
  }
  
  return p >= 0.66 ? 'high' : p >= 0.33 ? 'moderate' : 'low';
}
export const riskColor = (data) => RISK_COLORS[riskLevelOf(data)];
export const riskLabel = (data) => RISK_LABELS[riskLevelOf(data)];