/**
 * Patient Service — abstraction layer for persistent patient data operations.
 *
 * Connects to the backend SQLite persistent database.
 * If the backend is unreachable, gracefully falls back to local mock data.
 */
import { api } from './api';
import { MOCK_PATIENTS } from '../data/mockPatients';

/**
 * Search patients by ID (full or partial) with optional filters
 */
export async function searchPatients(query = '', filters = {}) {
  try {
    const data = await api.searchPatients({ query, ...filters });
    if (Array.isArray(data)) {
      return data;
    }
  } catch (err) {
    console.warn('Backend search unavailable, falling back to local dataset:', err);
  }

  // Fallback to local mock data
  let results = [...MOCK_PATIENTS];

  // Exclude archived patients unless requested
  if (!filters.includeArchived) {
    results = results.filter((p) => !p.isArchived);
  }

  if (query.trim()) {
    const q = query.trim().toLowerCase();
    results = results.filter((p) => p.patientId.toLowerCase().includes(q));
  }

  if (filters.sex && filters.sex !== 'All') {
    results = results.filter((p) => p.sex === filters.sex);
  }

  if (filters.ageMin != null) {
    results = results.filter((p) => p.age >= filters.ageMin);
  }
  if (filters.ageMax != null) {
    results = results.filter((p) => p.age <= filters.ageMax);
  }

  if (filters.dateFrom) {
    results = results.filter((p) => p.registeredDate >= filters.dateFrom);
  }
  if (filters.dateTo) {
    results = results.filter((p) => p.registeredDate <= filters.dateTo);
  }

  if (filters.overallCAD && filters.overallCAD !== 'All') {
    results = results.filter(
      (p) => p.predictions && p.predictions.overallCAD === filters.overallCAD
    );
  }
  if (filters.LAD && filters.LAD !== 'All') {
    results = results.filter(
      (p) => p.predictions && p.predictions.LAD === filters.LAD
    );
  }
  if (filters.LCX && filters.LCX !== 'All') {
    results = results.filter(
      (p) => p.predictions && p.predictions.LCX === filters.LCX
    );
  }
  if (filters.RCA && filters.RCA !== 'All') {
    results = results.filter(
      (p) => p.predictions && p.predictions.RCA === filters.RCA
    );
  }

  return results;
}

/**
 * Get a single patient by ID with assessment history
 */
export async function getPatientById(patientId) {
  try {
    const p = await api.getPatient(patientId);
    if (p) {
      // Backend returns snake_case from SQLite; map to camelCase for the frontend.
      // Also forward camelCase variants the backend may already alias.
      return {
        patientId: p.patient_id ?? p.patientId,
        registeredDate: p.registered_date ?? p.registeredDate,
        age: p.age,
        sex: p.sex,
        hasAssessment: p.hasAssessment,
        predictions: p.predictions,
        isArchived: p.is_archived ?? p.isArchived ?? false,
        assessmentHistory: p.assessmentHistory || [],
      };
    }
  } catch (err) {
    console.warn(`Backend patient query for ${patientId} failed, falling back to local dataset:`, err);
  }

  const mock = MOCK_PATIENTS.find((p) => p.patientId === patientId);
  if (!mock) return null;
  return {
    ...mock,
    assessmentHistory: [],
  };
}

/**
 * Create or register a patient
 */
export async function createPatient(patientData) {
  return api.createPatient(patientData);
}

/**
 * Archive or unarchive a patient record
 */
export async function archivePatient(patientId, isArchived = true) {
  try {
    const res = await api.archivePatient(patientId, isArchived);
    const mock = MOCK_PATIENTS.find((p) => p.patientId === patientId);
    if (mock) {
      mock.isArchived = isArchived;
    }
    return res;
  } catch (err) {
    console.warn('Backend archivePatient unavailable, updating local dataset:', err);
    const mock = MOCK_PATIENTS.find((p) => p.patientId === patientId);
    if (mock) {
      mock.isArchived = isArchived;
      return { status: 'ok', patient_id: patientId, is_archived: isArchived };
    }
    throw err;
  }
}

/**
 * Permanently delete a patient and all their assessments.
 * This action is irreversible. The backend uses ON DELETE CASCADE
 * so all assessments for this patient are removed atomically.
 */
export async function deletePatient(patientId) {
  return api.deletePatient(patientId);
}

/**
 * Permanently delete a single assessment.
 * The patientId ownership check is enforced by the backend.
 */
export async function deleteAssessment(assessmentId, patientId) {
  return api.deleteAssessment(assessmentId, patientId);
}
