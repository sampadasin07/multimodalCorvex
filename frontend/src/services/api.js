const BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new Error('Cannot reach the prediction server. Is the backend running?');
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (Array.isArray(body.detail)) {
        message = body.detail.map((d) => (typeof d === 'string' ? d : d.msg)).join('; ');
      } else if (body.detail) {
        message = body.detail;
      }
    } catch { /* body was not JSON */ }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export const api = {
  health: () => request('/health'),
  schema: () => request('/api/schema'),
  samples: () => request('/api/samples'),
  vessels: () => request('/api/vessels'),
  evaluation: () => request('/api/evaluation'),
  modelInfo: () => request('/api/model-info'),
  predict: (features, { includeShap = true } = {}) =>
    request(`/api/predict?include_shap=${includeShap}`, {
      method: 'POST',
      body: JSON.stringify({ features }),
    }),

  // Patient persistence APIs
  searchPatients: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.query) qs.set('query', params.query);
    if (params.sex && params.sex !== 'All') qs.set('sex', params.sex);
    if (params.ageMin != null) qs.set('age_min', params.ageMin);
    if (params.ageMax != null) qs.set('age_max', params.ageMax);
    if (params.dateFrom) qs.set('date_from', params.dateFrom);
    if (params.dateTo) qs.set('date_to', params.dateTo);
    if (params.overallCAD && params.overallCAD !== 'All') qs.set('overall_cad', params.overallCAD);
    if (params.LAD && params.LAD !== 'All') qs.set('lad', params.LAD);
    if (params.LCX && params.LCX !== 'All') qs.set('lcx', params.LCX);
    if (params.RCA && params.RCA !== 'All') qs.set('rca', params.RCA);
    if (params.includeArchived) qs.set('include_archived', 'true');
    const queryStr = qs.toString();
    return request(`/api/patients${queryStr ? `?${queryStr}` : ''}`);
  },
  getPatient: (patientId) => request(`/api/patients/${encodeURIComponent(patientId)}`),
  createPatient: (data) =>
    request('/api/patients', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  archivePatient: (patientId, isArchived = true) =>
    request(`/api/patients/${encodeURIComponent(patientId)}/archive`, {
      method: 'POST',
      body: JSON.stringify({ is_archived: isArchived }),
    }),
  deletePatient: (patientId) =>
    request(`/api/patients/${encodeURIComponent(patientId)}`, {
      method: 'DELETE',
    }),
  getResumableAssessments: (patientId) =>
    request(`/api/patients/${encodeURIComponent(patientId)}/resumable`),

  // Assessment persistence APIs
  createAssessment: (data) =>
    request('/api/assessments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getAssessment: (assessmentId) =>
    request(`/api/assessments/${encodeURIComponent(assessmentId)}`),
  updateAssessment: (assessmentId, data) =>
    request(`/api/assessments/${encodeURIComponent(assessmentId)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  completeAssessment: (assessmentId, data) =>
    request(`/api/assessments/${encodeURIComponent(assessmentId)}/complete`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteAssessment: (assessmentId, patientId) =>
    request(
      `/api/assessments/${encodeURIComponent(assessmentId)}?patient_id=${encodeURIComponent(patientId)}`,
      { method: 'DELETE' }
    ),
};