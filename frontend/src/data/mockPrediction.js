/**
 * Mock prediction response structure.
 * 
 * IMPORTANT: This data is ONLY for frontend demonstration.
 * All values are synthetic and clearly marked as mock/demo.
 * No real ML model is involved.
 * 
 * Later, the backend teammate replaces this with real model responses.
 */
export const MOCK_PREDICTION_RESPONSE = {
  overallCAD: {
    status: 'Positive',
    probability: 0.78,
    label: 'CAD Detected (Predicted)',
  },

  vessels: {
    LAD: {
      status: 'Stenosis Detected',
      probability: 0.82,
      label: 'LAD Stenosis (Predicted)',
    },
    LCX: {
      status: 'Normal',
      probability: 0.23,
      label: 'LCX Normal (Predicted)',
    },
    RCA: {
      status: 'Stenosis Detected',
      probability: 0.65,
      label: 'RCA Stenosis (Predicted)',
    },
  },

  explanation: {
    available: true,
    method: 'SHAP (Mock — demonstration only)',
    features: [
      { key: 'Age', label: 'Age', value: 58, contribution: 0.12, direction: 'positive' },
      { key: 'ST Depression', label: 'ST Depression', value: 'Yes', contribution: 0.18, direction: 'positive' },
      { key: 'Typical Chest Pain', label: 'Typical Chest Pain', value: 'Yes', contribution: 0.15, direction: 'positive' },
      { key: 'EF-TTE', label: 'Ejection Fraction', value: 45, contribution: 0.11, direction: 'positive' },
      { key: 'DM', label: 'Diabetes Mellitus', value: 'Yes', contribution: 0.09, direction: 'positive' },
      { key: 'FBS', label: 'Fasting Blood Sugar', value: 126, contribution: 0.07, direction: 'positive' },
      { key: 'HDL', label: 'HDL Cholesterol', value: 38, contribution: 0.08, direction: 'positive' },
      { key: 'HTN', label: 'Hypertension', value: 'Yes', contribution: 0.06, direction: 'positive' },
      { key: 'Sex', label: 'Sex', value: 'Male', contribution: 0.04, direction: 'positive' },
      { key: 'LDL', label: 'LDL Cholesterol', value: 142, contribution: 0.05, direction: 'positive' },
      { key: 'Dyspnea', label: 'Dyspnea', value: 'Yes', contribution: 0.03, direction: 'positive' },
      { key: 'BMI', label: 'BMI', value: 27.7, contribution: -0.02, direction: 'negative' },
    ],
  },

  model: {
    name: 'CORVEX CAD Prediction Model',
    version: 'v0.1.0-demo',
    preprocessing: 'To be defined by ML team',
    validationMethod: 'To be defined by ML team',
    metrics: {
      note: 'Mock metrics — for frontend demonstration only. Actual metrics will be provided by the trained model.',
    },
  },
};

/**
 * Generate a mock prediction for any given formData.
 * The mock response is always the same structure regardless of inputs.
 * This is intentional — the actual model will produce dynamic responses.
 */
export function generateMockPrediction(patientId, assessmentDate, formData) {
  return {
    patientId,
    assessmentDate,
    ...MOCK_PREDICTION_RESPONSE,
    _meta: {
      isMock: true,
      generatedAt: new Date().toISOString(),
      disclaimer: 'This prediction is generated from mock data for frontend demonstration only.',
    },
  };
}
