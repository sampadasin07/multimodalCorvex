/**
 * Demo patient data — synthetic/de-identified only.
 * Populates all 55 model features across all 7 stages.
 */
export const DEMO_PATIENT = {
  patientId: 'CV-2026-0001',
  assessmentDate: new Date().toISOString().split('T')[0],
  isDemo: true,

  // All 55 features keyed by exact model keys
  features: {
    // Stage 1 — Demographics & Body Measurements
    'Age': 58,
    'Sex': 'Male',
    'Weight': 82,
    'Length': 172,
    'BMI': 27.7,

    // Stage 2 — Medical History & Risk Factors
    'DM': 'Yes',
    'HTN': 'Yes',
    'Current Smoker': 'No',
    'EX-Smoker': 'Yes',
    'FH': 'Yes',
    'Obesity': 'No',
    'CRF': 'No',
    'CVA': 'No',
    'Airway disease': 'No',
    'Thyroid Disease': 'No',
    'CHF': 'No',
    'DLP': 'Yes',

    // Stage 3 — Vitals & Physical Examination
    'BP': 140,
    'PR': 78,
    'Edema': 'No',
    'Weak Peripheral Pulse': 'No',
    'Lung rales': 'No',
    'Systolic Murmur': 'No',
    'Diastolic Murmur': 'No',

    // Stage 4 — Symptoms / Clinical Presentation
    'Typical Chest Pain': 'Yes',
    'Dyspnea': 'Yes',
    'Function Class': '2',
    'Atypical': 'No',
    'Nonanginal': 'No',
    'Exertional CP': 'Yes',
    'LowTH Ang': 'No',

    // Stage 5 — ECG
    'Q Wave': 'No',
    'ST Elevation': 'No',
    'ST Depression': 'Yes',
    'T Inversion': 'Yes',
    'LVH': 'No',
    'Poor R Progression': 'No',
    'BBB': 'LBBB',

    // Stage 6 — Laboratory Results
    'FBS': 126,
    'CR': 1.1,
    'TG': 185,
    'LDL': 142,
    'HDL': 38,
    'BUN': 18,
    'ESR': 15,
    'HB': 14.2,
    'K': 4.3,
    'Na': 140,
    'WBC': 7200,
    'Lymph': 30,
    'Neut': 62,
    'PLT': 225,

    // Stage 7 — Echocardiography
    'EF-TTE': 45,
    'Region RWMA': '2',
    'VHD': 'Mild',
  },
};
