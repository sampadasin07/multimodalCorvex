import { api } from './api';
import { toBackendFeatures, fromBackendPrediction } from './backendAdapter';
import { generateMockPrediction } from '../data/mockPrediction';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run prediction on submitted assessment data (real backend; mock if VITE_USE_MOCK=true).
 */

let evaluationCache = null;
async function getEvaluation() {
  if (!evaluationCache) {
    try {
      evaluationCache = await api.evaluation();
    } catch {
      evaluationCache = null;   // metrics are optional, never block a prediction
    }
  }
  return evaluationCache;
}

export async function runPrediction(patientId, assessmentDate, formData) {
  if (USE_MOCK) {
    await delay(2000);
    return generateMockPrediction(patientId, assessmentDate, formData);
  }
    const [res, evaluation] = await Promise.all([
    api.predict(toBackendFeatures(formData), { includeShap: true }),
    getEvaluation(),
  ]);
  return fromBackendPrediction(res, patientId, assessmentDate, evaluation);
}

export async function getPredictionResult(patientId) {
  await delay(300);
  return null;
}

export async function getExplanation(patientId) {
  await delay(300);
  return null;
}

export async function getModelMetadata() {
  await delay(200);
  return {
    name: 'CORVEX Cardiac Risk Models',
    version: '1.0',
    preprocessing: 'See project documentation',
    validationMethod: 'Cross-validation and held-out test set',
    metrics: {},
    _isMock: false,
  };
}