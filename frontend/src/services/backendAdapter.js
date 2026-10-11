import { FEATURE_DEFINITIONS, getFeatureByKey } from '../utils/featureDefinitions';

// Frontend key -> backend column name (only where they differ)
const KEY_TO_BACKEND = {
  'ST Elevation': 'St Elevation',
  'ST Depression': 'St Depression',
  'T Inversion': 'Tinversion',
};
const KEY_TO_FRONTEND = Object.fromEntries(
  Object.entries(KEY_TO_BACKEND).map(([front, back]) => [back, front])
);

// Never sent: Exertional CP was dropped from the model (it is 'N' for every training patient).
const NOT_SENT = new Set(['Exertional CP']);

const VHD_TO_BACKEND = { Normal: 'N', Mild: 'mild', Moderate: 'Moderate', Severe: 'Severe' };
const VHD_TO_FRONTEND = { N: 'Normal', mild: 'Mild', Moderate: 'Moderate', Severe: 'Severe' };

function convertValue(key, raw) {
  if (key === 'Sex') return raw === 'Male' ? 1 : raw === 'Female' ? 0 : null;
  if (key === 'VHD') return VHD_TO_BACKEND[raw] ?? null;
  if (key === 'BBB') {
    if (raw === 'Yes') return null;     // old yes/no cannot say which side
    if (raw === 'No') return 'N';
    return raw;                         // 'N' | 'LBBB' | 'RBBB'
  }
  if (raw === 'Yes') return 1;
  if (raw === 'No') return 0;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

/** Frontend form data -> backend feature dict. Unanswered fields are left out. */
export function toBackendFeatures(formData) {
  const out = {};
  for (const feat of FEATURE_DEFINITIONS) {
    if (NOT_SENT.has(feat.key)) continue;
    const raw = formData?.[feat.key];
    if (raw === null || raw === undefined || raw === '') continue;
    const value = convertValue(feat.key, raw);
    if (value === null) continue;
    out[KEY_TO_BACKEND[feat.key] || feat.key] = value;
  }
  return out;
}

function displayValue(frontendKey, v) {
  if (v === null || v === undefined) return '—';
  const feat = getFeatureByKey(frontendKey);
  if (frontendKey === 'Sex') return v === 1 ? 'Male' : 'Female';
  if (frontendKey === 'VHD') return VHD_TO_FRONTEND[v] || v;
  if (frontendKey === 'BBB') return v === 'N' ? 'None' : v;
  if (feat?.type === 'boolean') return v === 1 ? 'Yes' : 'No';
  return v;
}

function toExplanationRows(rows, assumed) {
  return (rows || []).map((r) => {
    const key = KEY_TO_FRONTEND[r.feature] || r.feature;
    const risk = r.direction === 'risk';
    return {
      key,
      label: getFeatureByKey(key)?.label || r.label,
      value: displayValue(key, r.value),
      contribution: risk ? r.share : -r.share,   // signed, 0..1 relative contribution
      direction: risk ? 'positive' : 'negative',
      unit: r.unit,
      abnormal: r.abnormal,
      assumed: assumed.has(r.feature),            // true = user did not enter this value
    };
  });
}

const TARGET_LABEL = { Cath: 'CAD', LAD: 'LAD', LCX: 'LCX', RCA: 'RCA' };

function summarizeEvaluation(ev) {
  if (!ev?.targets) return {};
  return {
    testSize: ev.test_size,
    rows: Object.entries(ev.targets).map(([t, v]) => ({
      target: TARGET_LABEL[t] || t,
      model: v.model,
      cvAuc: v.cv_auc,
      rocAuc: v.test_metrics.roc_auc,
      precision: v.test_metrics.precision,
      recall: v.test_metrics.recall,
      f1: v.test_metrics.f1,
      threshold: v.test_metrics.threshold,
    })),
  };
}

/** Backend response -> the same shape the Results components already use. */
export function fromBackendPrediction(res, patientId, assessmentDate,evaluation) {
  const p = res.predictions;
  const assumed = new Set(res.defaults_used || []);

  const vessel = (id) => ({
    status: p[id].positive ? 'Stenosis Detected' : 'Normal',
    probability: p[id].probability,
    label: `${id} ${p[id].positive ? 'Stenosis' : 'Normal'} (Predicted)`,
    riskLevel: p[id].risk_level,
    threshold: p[id].threshold,
  });

  const byTarget = Object.fromEntries(
    Object.entries(res.explanations || {}).map(([t, rows]) => [t, toExplanationRows(rows, assumed)])
  );

  return {
    patientId,
    assessmentDate,
    overallCAD: {
      status: p.CAD.positive ? 'Positive' : 'Negative',
      probability: p.CAD.probability,
      label: p.CAD.positive ? 'CAD Detected (Predicted)' : 'No CAD Detected (Predicted)',
      riskLevel: p.CAD.risk_level,
      threshold: p.CAD.threshold,
    },
    vessels: { LAD: vessel('LAD'), LCX: vessel('LCX'), RCA: vessel('RCA') },
    explanation: {
      available: !!res.explanations,
      method: 'SHAP',
      features: byTarget.CAD || [],   // what ExplanationPanel shows today
      byTarget,                       // CAD / LAD / LCX / RCA, for per-vessel explanations later
    },
    model: {
      name: 'CORVEX Cardiac Risk Models',
      version: '1.0',
      preprocessing: 'Robust scaling and categorical encoding built into the model pipeline; 50 input features',
      validationMethod: 'Nested cross-validation (5-fold x 3 repeats outer, 3-fold inner), held-out test set of 61 patients, sigmoid (Platt) calibration',
      metrics: summarizeEvaluation(evaluation),
    },
    _meta: {
      isMock: false,
      generatedAt: new Date().toISOString(),
      disclaimer: res.disclaimer,
      warnings: (res.warnings || []).filter(
        (w) =>
          !w.includes('is not used by the model') &&
          !w.includes('outside the dataset range')
      ),
      assumedFeatures: (res.defaults_used || []).map((k) => KEY_TO_FRONTEND[k] || k),
      processingMs: res.processing_ms,
    },
  };
}