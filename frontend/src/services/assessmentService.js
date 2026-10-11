/**
 * Assessment Service — persistent storage layer for assessment operations.
 *
 * Persists in-progress drafts, form features, and completed ML prediction results
 * directly into the backend SQLite database.
 */
import { api } from './api';
import { MOCK_SAVED_ASSESSMENTS } from '../data/mockPatients';
import { createEmptyFormState } from '../utils/featureDefinitions';

// Local memory cache for offline resilience
const assessmentStore = { ...MOCK_SAVED_ASSESSMENTS };

/**
 * Create a new draft assessment in the database
 */
export async function createAssessment(patientId, assessmentDate, isDemo = false, currentStage = 1, features = null) {
  try {
    const asm = await api.createAssessment({
      patient_id: patientId,
      assessment_date: assessmentDate,
      is_demo: isDemo,
      current_stage: currentStage,
      features: features || createEmptyFormState(),
    });
    if (asm && asm.assessmentId) {
      assessmentStore[patientId] = asm;
      return asm;
    }
  } catch (err) {
    console.warn('Backend createAssessment failed, using local session store:', err);
  }

  // Fallback for offline mode
  const localAsm = {
    assessmentId: `ASM-LOCAL-${Date.now()}`,
    patientId,
    assessmentDate,
    currentStage: currentStage || 1,
    completedStages: [],
    isDemo: !!isDemo,
    features: features || createEmptyFormState(),
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  assessmentStore[patientId] = localAsm;
  return localAsm;
}

/**
 * Get an assessment by its unique assessment ID (or fallback patient ID)
 */
export async function getAssessment(assessmentId) {
  try {
    const asm = await api.getAssessment(assessmentId);
    if (asm) return asm;
  } catch {
    // If assessmentId is actually a patientId or offline
    if (assessmentStore[assessmentId]) return assessmentStore[assessmentId];
  }
  return null;
}

/**
 * Update an existing draft assessment (autosave / stage transition)
 */
export async function saveAssessment(assessmentIdOrPatientId, assessmentData) {
  const { assessmentId, patientId, currentStage, completedStages, features, isDemo, version } = assessmentData;
  const targetId = assessmentId || assessmentIdOrPatientId;

  // Try updating via persistent backend API if targetId looks like an ASM ID
  if (targetId && targetId.startsWith('ASM-') && !targetId.startsWith('ASM-LOCAL')) {
    try {
      const updated = await api.updateAssessment(targetId, {
        current_stage: currentStage,
        completed_stages: completedStages,
        features,
        is_demo: isDemo,
        version,
      });
      if (updated) {
        if (patientId) assessmentStore[patientId] = updated;
        return updated;
      }
    } catch (err) {
      console.warn('Persistent saveAssessment failed:', err);
      // Bubble up error so UI can display save failure accurately without false success
      throw err;
    }
  }

  // Fallback / local memory store update
  const key = patientId || assessmentIdOrPatientId;
  const existing = assessmentStore[key] || {};
  assessmentStore[key] = {
    ...existing,
    ...assessmentData,
    version: (existing.version || 1) + 1,
    updatedAt: new Date().toISOString(),
  };
  return assessmentStore[key];
}

/**
 * Check if a resumable (incomplete) draft assessment exists for this patient
 */
export async function findResumableAssessment(patientId) {
  try {
    const drafts = await api.getResumableAssessments(patientId);
    if (Array.isArray(drafts) && drafts.length > 0) {
      // Return the most recent incomplete draft
      return drafts[0];
    }
    if (Array.isArray(drafts) && drafts.length === 0) {
      return null;
    }
  } catch (err) {
    console.warn(`Backend resumable lookup failed for ${patientId}, checking local store:`, err);
  }

  // Check local fallback
  const local = assessmentStore[patientId];
  if (local && (local.status === 'in_progress' || (local.currentStage && local.currentStage <= 7))) {
    return local;
  }
  return null;
}

/**
 * Get all resumable assessments for a patient (for multi-draft selection)
 */
export async function getAllResumableAssessments(patientId) {
  try {
    const drafts = await api.getResumableAssessments(patientId);
    if (Array.isArray(drafts)) {
      return drafts;
    }
  } catch {
    // ignore
  }
  const single = await findResumableAssessment(patientId);
  return single ? [single] : [];
}

/**
 * Mark assessment completed and store the actual ML prediction results
 */
export async function completeAssessment(assessmentId, predictionResult) {
  if (assessmentId && assessmentId.startsWith('ASM-') && !assessmentId.startsWith('ASM-LOCAL')) {
    try {
      return await api.completeAssessment(assessmentId, {
        prediction_result: predictionResult,
        model_version: predictionResult?.model?.version || '1.0',
      });
    } catch (err) {
      console.warn('Backend completeAssessment failed:', err);
      throw err;
    }
  }

  // Local fallback
  return {
    assessmentId,
    status: 'completed',
    predictionResult,
    completedAt: new Date().toISOString(),
  };
}
