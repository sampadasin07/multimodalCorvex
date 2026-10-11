/**
 * Mock patients for the patient search feature.
 * All data is synthetic/de-identified.
 */
export const MOCK_PATIENTS = [
  {
    patientId: 'CV-2026-0001',
    registeredDate: '2026-09-15',
    age: 58,
    sex: 'Male',
    hasAssessment: true,
    predictions: {
      overallCAD: 'Yes',
      LAD: 'Yes',
      LCX: 'No',
      RCA: 'Yes',
    },
  },
  {
    patientId: 'CV-2026-0002',
    registeredDate: '2026-09-20',
    age: 45,
    sex: 'Female',
    hasAssessment: true,
    predictions: {
      overallCAD: 'No',
      LAD: 'No',
      LCX: 'No',
      RCA: 'No',
    },
  },
  {
    patientId: 'CV-2026-0003',
    registeredDate: '2026-09-28',
    age: 67,
    sex: 'Male',
    hasAssessment: true,
    predictions: {
      overallCAD: 'Yes',
      LAD: 'Yes',
      LCX: 'Yes',
      RCA: 'No',
    },
  },
  {
    patientId: 'CV-2026-0004',
    registeredDate: '2026-10-01',
    age: 52,
    sex: 'Female',
    hasAssessment: false,
    predictions: null,
  },
  {
    patientId: 'CV-2026-0005',
    registeredDate: '2026-10-02',
    age: 71,
    sex: 'Male',
    hasAssessment: true,
    predictions: {
      overallCAD: 'Yes',
      LAD: 'No',
      LCX: 'Yes',
      RCA: 'Yes',
    },
  },
];

/**
 * Mock saved incomplete assessment (for Continue Assessment)
 */
export const MOCK_SAVED_ASSESSMENTS = {
  'CV-2026-0004': {
    patientId: 'CV-2026-0004',
    assessmentDate: '2026-10-01',
    currentStage: 3,
    isDemo: false,
    features: {
      // Stage 1 filled
      'Age': 52,
      'Sex': 'Female',
      'Weight': 68,
      'Length': 165,
      'BMI': 25.0,
      // Stage 2 filled
      'DM': 'No',
      'HTN': 'Yes',
      'Current Smoker': 'No',
      'EX-Smoker': 'No',
      'FH': 'No',
      'Obesity': 'No',
      'CRF': 'No',
      'CVA': 'No',
      'Airway disease': 'No',
      'Thyroid Disease': 'Yes',
      'CHF': 'No',
      'DLP': 'No',
      // Stage 3 partially filled
      'BP': 130,
      'PR': 72,
      'Edema': null,
      'Weak Peripheral Pulse': null,
      'Lung rales': null,
      'Systolic Murmur': null,
      'Diastolic Murmur': null,
      // Remaining stages empty
      'Typical Chest Pain': null,
      'Dyspnea': null,
      'Function Class': null,
      'Atypical': null,
      'Nonanginal': null,
      'Exertional CP': null,
      'LowTH Ang': null,
      'Q Wave': null,
      'ST Elevation': null,
      'ST Depression': null,
      'T Inversion': null,
      'LVH': null,
      'Poor R Progression': null,
      'BBB': null,
      'FBS': null,
      'CR': null,
      'TG': null,
      'LDL': null,
      'HDL': null,
      'BUN': null,
      'ESR': null,
      'HB': null,
      'K': null,
      'Na': null,
      'WBC': null,
      'Lymph': null,
      'Neut': null,
      'PLT': null,
      'EF-TTE': null,
      'Region RWMA': null,
      'VHD': null,
    },
  },
};
