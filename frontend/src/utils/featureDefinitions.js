/**
 * Centralized definition of all 55 model input features.
 * 
 * Each feature has:
 *   - key: exact model/dataset feature key
 *   - label: human-readable UI label
 *   - stage: which assessment stage (1-7)
 *   - type: 'numeric' | 'boolean' | 'select'
 *   - group: optional sub-grouping within a stage
 *   - tooltip: abbreviation expansion & clinical hint
 *   - unit: medical unit (e.g. mmHg, mg/dL, bpm, %, kg, cm)
 *   - placeholder: suggested value placeholder with units
 *   - normalRange: reference clinical range
 *   - description: comprehensive clinical definition and expected input format
 *   - options: for 'select' type, the available choices
 * 
 * Patient ID and Assessment Date are METADATA, not part of the 55.
 * Cath, LAD, LCX, RCA are OUTPUTS, never inputs.
 */

export const STAGES = [
  { number: 1, title: 'Demographics & Body Measurements', featureCount: 5 },
  { number: 2, title: 'Medical History & Risk Factors', featureCount: 12 },
  { number: 3, title: 'Vitals & Physical Examination', featureCount: 7 },
  { number: 4, title: 'Symptoms / Clinical Presentation', featureCount: 7 },
  { number: 5, title: 'ECG', featureCount: 7 },
  { number: 6, title: 'Laboratory Results', featureCount: 14 },
  { number: 7, title: 'Echocardiography', featureCount: 3 },
];

export const TOTAL_FEATURES = 55;

export const FEATURE_DEFINITIONS = [
  // ── Stage 1: Demographics & Body Measurements (5) ──
  {
    key: 'Age',
    label: 'Age',
    stage: 1,
    type: 'numeric',
    required: true,
    unit: 'years',
    placeholder: 'e.g. 58',
    normalRange: '18–100 years',
    tooltip: 'Patient chronological age in completed years',
    description: 'Patient chronological age in completed years. Enter a numerical value.',
  },
  {
    key: 'Sex',
    label: 'Sex',
    stage: 1,
    type: 'select',
    required: true,
    placeholder: 'Select biological sex',
    tooltip: 'Patient biological sex at birth',
    description: 'Patient biological sex. Select Male or Female from the dropdown.',
    options: [
      { value: 'Male', label: 'Male' },
      { value: 'Female', label: 'Female' },
    ],
  },
  {
    key: 'Weight',
    label: 'Weight',
    stage: 1,
    type: 'numeric',
    required: true,
    unit: 'kg',
    placeholder: 'e.g. 82',
    normalRange: '40–160 kg',
    tooltip: 'Patient body weight in kilograms (kg)',
    description: 'Patient body weight measured in kilograms (kg). Enter a numerical value. Used to automatically calculate BMI.',
  },
  {
    key: 'Length',
    label: 'Height',
    stage: 1,
    type: 'numeric',
    required: true,
    unit: 'cm',
    placeholder: 'e.g. 172',
    normalRange: '120–220 cm',
    tooltip: 'Patient standing height in centimeters (cm)',
    description: 'Patient standing height measured in centimeters (cm). Enter a numerical value. Used to automatically calculate BMI.',
  },
  {
    key: 'BMI',
    label: 'BMI',
    stage: 1,
    type: 'numeric',
    unit: 'kg/m²',
    calculable: true,
    placeholder: 'e.g. 27.7',
    normalRange: '18.5–24.9 kg/m²',
    tooltip: 'Body Mass Index = Weight (kg) / [Height (m)]²',
    description: 'Body Mass Index in kg/m². Automatically calculated when Weight and Height are filled, or enter numerical value manually.',
  },

  // ── Stage 2: Medical History & Risk Factors (12) ──
  {
    key: 'DM',
    label: 'Diabetes Mellitus',
    stage: 2,
    type: 'boolean',
    required: true,
    tooltip: 'DM — Diabetes Mellitus. Patient diagnosed with diabetes.',
    description: 'Documented medical history or diagnosis of Diabetes Mellitus. Click Yes or No.',
  },
  {
    key: 'HTN',
    label: 'Hypertension',
    stage: 2,
    type: 'boolean',
    required: true,
    tooltip: 'HTN — Hypertension. Documented medical diagnosis. Do not infer from BP alone.',
    description: 'Clinical diagnosis of chronic Hypertension. Click Yes or No (do not infer from a single blood pressure measurement alone).',
  },
  {
    key: 'Current Smoker',
    label: 'Current Smoker',
    stage: 2,
    type: 'boolean',
    required: true,
    tooltip: 'Active tobacco cigarette smoking status',
    description: 'Patient currently and regularly smokes tobacco cigarettes. Click Yes or No.',
  },
  {
    key: 'EX-Smoker',
    label: 'Former Smoker',
    stage: 2,
    type: 'boolean',
    tooltip: 'EX-Smoker — Former smoker who has ceased smoking',
    description: 'Patient was previously a regular tobacco smoker but has quit smoking. Click Yes or No.',
  },
  {
    key: 'FH',
    label: 'Family History',
    stage: 2,
    type: 'boolean',
    tooltip: 'FH — Family History of premature CAD in first-degree relatives',
    description: 'Family history of premature Coronary Artery Disease in first-degree relatives (males <55 years, females <65 years). Click Yes or No.',
  },
  {
    key: 'Obesity',
    label: 'Obesity',
    stage: 2,
    type: 'boolean',
    tooltip: 'Clinical diagnosis of obesity. Do not infer from BMI alone.',
    description: 'Clinical diagnosis of obesity documented in medical record. Click Yes or No (do not automatically infer from BMI alone).',
  },
  {
    key: 'CRF',
    label: 'Chronic Renal Failure',
    stage: 2,
    type: 'boolean',
    tooltip: 'CRF — Chronic Renal Failure or Chronic Kidney Disease',
    description: 'Documented medical history of Chronic Renal Failure (CRF) or chronic kidney disease. Click Yes or No.',
  },
  {
    key: 'CVA',
    label: 'Cerebrovascular Accident',
    stage: 2,
    type: 'boolean',
    tooltip: 'CVA — Prior stroke or cerebrovascular accident',
    description: 'Prior medical history of stroke or ischemic cerebrovascular accident. Click Yes or No.',
  },
  {
    key: 'Airway disease',
    label: 'Airway Disease',
    stage: 2,
    type: 'boolean',
    tooltip: 'Chronic obstructive pulmonary disease, asthma, or bronchitis',
    description: 'Documented history of chronic airway disease such as COPD, chronic bronchitis, or asthma. Click Yes or No.',
  },
  {
    key: 'Thyroid Disease',
    label: 'Thyroid Disease',
    stage: 2,
    type: 'boolean',
    tooltip: 'Documented history of hypothyroidism or hyperthyroidism',
    description: 'Documented history of diagnosed thyroid disease (hypo- or hyperthyroidism). Click Yes or No.',
  },
  {
    key: 'CHF',
    label: 'Congestive Heart Failure',
    stage: 2,
    type: 'boolean',
    tooltip: 'CHF — Congestive Heart Failure diagnosis',
    description: 'Documented medical history of Congestive Heart Failure (CHF). Click Yes or No.',
  },
  {
    key: 'DLP',
    label: 'Dyslipidemia',
    stage: 2,
    type: 'boolean',
    tooltip: 'DLP — Dyslipidemia / Hyperlipidemia',
    description: 'Documented medical diagnosis of Dyslipidemia or hypercholesterolemia. Click Yes or No.',
  },

  // ── Stage 3: Vitals & Physical Examination (7) ──
  {
    key: 'BP',
    label: 'Blood Pressure',
    stage: 3,
    type: 'numeric',
    required: true,
    unit: 'mmHg',
    group: 'Vitals',
    placeholder: 'e.g. 120',
    normalRange: '90–120 mmHg',
    tooltip: 'Resting Systolic Blood Pressure in mmHg. Normal: < 120 mmHg.',
    description: 'Resting systolic blood pressure measured in millimeters of mercury (mmHg). Enter numerical value.',
  },
  {
    key: 'PR',
    label: 'Pulse Rate',
    stage: 3,
    type: 'numeric',
    required: true,
    unit: 'bpm',
    group: 'Vitals',
    placeholder: 'e.g. 72',
    normalRange: '60–100 bpm',
    tooltip: 'Resting Pulse Rate / Heart Rate in beats per minute (bpm)',
    description: 'Resting heart rate in beats per minute (bpm). Enter numerical value.',
  },
  {
    key: 'Edema',
    label: 'Edema',
    stage: 3,
    type: 'boolean',
    group: 'Physical Examination',
    tooltip: 'Peripheral or ankle edema on physical examination',
    description: 'Presence of peripheral edema (swelling of lower extremities) detected upon physical exam. Click Yes or No.',
  },
  {
    key: 'Weak Peripheral Pulse',
    label: 'Weak Peripheral Pulse',
    stage: 3,
    type: 'boolean',
    group: 'Physical Examination',
    tooltip: 'Diminished or absent peripheral arterial pulse on examination',
    description: 'Palpably diminished or absent peripheral arterial pulses (dorsalis pedis or radial). Click Yes or No.',
  },
  {
    key: 'Lung rales',
    label: 'Lung Rales',
    stage: 3,
    type: 'boolean',
    group: 'Physical Examination',
    tooltip: 'Crackles or rales heard on lung auscultation',
    description: 'Adventitious crackling sounds (rales) heard upon pulmonary auscultation. Click Yes or No.',
  },
  {
    key: 'Systolic Murmur',
    label: 'Systolic Murmur',
    stage: 3,
    type: 'boolean',
    group: 'Physical Examination',
    tooltip: 'Audible heart murmur during ventricular systole',
    description: 'Audible heart murmur detected during ventricular systole. Click Yes or No.',
  },
  {
    key: 'Diastolic Murmur',
    label: 'Diastolic Murmur',
    stage: 3,
    type: 'boolean',
    group: 'Physical Examination',
    tooltip: 'Audible heart murmur during ventricular diastole',
    description: 'Audible heart murmur detected during ventricular diastole. Click Yes or No.',
  },

  // ── Stage 4: Symptoms / Clinical Presentation (7) ──
  {
    key: 'Typical Chest Pain',
    label: 'Typical Chest Pain',
    stage: 4,
    type: 'boolean',
    required: true,
    tooltip: 'Substernal chest pain provoked by exertion, relieved by rest/nitrates',
    description: 'Classic substernal angina meeting typical criteria (exertional, relieved by rest/nitroglycerin). Click Yes or No.',
  },
  {
    key: 'Dyspnea',
    label: 'Dyspnea',
    stage: 4,
    type: 'boolean',
    required: true,
    tooltip: 'Shortness of breath / difficulty breathing',
    description: 'Shortness of breath or labored breathing reported by the patient. Click Yes or No.',
  },
  {
    key: 'Function Class',
    label: 'Function Class',
    stage: 4,
    type: 'select',
    placeholder: 'Select NYHA functional class',
    tooltip: 'NYHA Functional Classification of Heart Failure (Class I to IV)',
    description: 'New York Heart Association (NYHA) functional classification grading activity limitations. Select an option.',
    options: [
      { value: '0', label: '0' },
      { value: '1', label: '1' },
      { value: '2', label: '2' },
      { value: '3', label: '3' },
    ],
  },
  {
    key: 'Atypical',
    label: 'Atypical Chest Pain',
    stage: 4,
    type: 'boolean',
    required: true,
    tooltip: 'Chest discomfort lacking one or more typical features of angina',
    description: 'Atypical angina or chest discomfort that meets only two of the three classic angina characteristics. Click Yes or No.',
  },
  {
    key: 'Nonanginal',
    label: 'Nonanginal Chest Pain',
    stage: 4,
    type: 'boolean',
    tooltip: 'Chest pain of non-cardiac origin (musculoskeletal, pleuritic, GI)',
    description: 'Chest discomfort that meets zero or one angina characteristic, likely of non-cardiac origin. Click Yes or No.',
  },
  {
    key: 'Exertional CP',
    label: 'Exertional Chest Pain',
    stage: 4,
    type: 'boolean',
    tooltip: 'Exertional CP — Chest pain specifically triggered by physical exertion',
    description: 'Chest discomfort consistently provoked or exacerbated by physical exertion. Click Yes or No.',
  },
  {
    key: 'LowTH Ang',
    label: 'Low Threshold Angina',
    stage: 4,
    type: 'boolean',
    tooltip: 'LowTH Ang — Angina provoked by minimal or low-level physical exertion',
    description: 'Low-threshold angina brought on by minimal physical activity or light walking. Click Yes or No.',
  },

  // ── Stage 5: ECG (7) ──
  {
    key: 'Q Wave',
    label: 'Q Wave',
    stage: 5,
    type: 'boolean',
    tooltip: 'Pathologic Q waves on 12-lead ECG (>0.04s or >25% R-wave depth)',
    description: 'Presence of pathological Q waves suggesting prior transmural myocardial infarction. Click Yes or No.',
  },
  {
    key: 'ST Elevation',
    label: 'ST Elevation',
    stage: 5,
    type: 'boolean',
    tooltip: 'ST segment elevation in 2 or more contiguous leads on ECG',
    description: 'Significant ST-segment elevation indicative of acute transmural myocardial ischemia. Click Yes or No.',
  },
  {
    key: 'ST Depression',
    label: 'ST Depression',
    stage: 5,
    type: 'boolean',
    required: true,
    tooltip: 'Horizontal or downsloping ST depression in contiguous leads',
    description: 'Horizontal or downsloping ST-segment depression indicative of subendocardial ischemia. Click Yes or No.',
  },
  {
    key: 'T Inversion',
    label: 'T Inversion',
    stage: 5,
    type: 'boolean',
    tooltip: 'Inverted T waves in leads with upright QRS complexes',
    description: 'T-wave inversion in leads where T waves are normally positive, suggesting ischemia or strain. Click Yes or No.',
  },
  {
    key: 'LVH',
    label: 'Left Ventricular Hypertrophy',
    stage: 5,
    type: 'boolean',
    tooltip: 'LVH — Electrocardiographic criteria for Left Ventricular Hypertrophy',
    description: 'ECG voltage criteria (e.g. Sokolow-Lyon or Cornell) indicating Left Ventricular Hypertrophy. Click Yes or No.',
  },
  {
    key: 'Poor R Progression',
    label: 'Poor R Progression',
    stage: 5,
    type: 'boolean',
    tooltip: 'Failure of R waves to increase progressively across leads V1–V4',
    description: 'Loss or delayed progression of R-wave amplitude across precordial leads V1 to V4. Click Yes or No.',
  },
  {
    key: 'BBB',
    label: 'Bundle Branch Block',
    stage: 5,
    type: 'select',
    placeholder: 'Select ECG finding',
    tooltip: 'BBB — Right (RBBB) or Left (LBBB) Bundle Branch Block (QRS ≥ 120ms)',
    description: 'Presence and type of bundle branch block on ECG (QRS duration ≥ 120 ms). Select None, LBBB or RBBB.',
    options: [
      { value: 'N', label: 'None' },
      { value: 'LBBB', label: 'Left Bundle Branch Block (LBBB)' },
      { value: 'RBBB', label: 'Right Bundle Branch Block (RBBB)' },
    ],
  },

  // ── Stage 6: Laboratory Results (14) ──
  {
    key: 'FBS',
    label: 'Fasting Blood Sugar',
    stage: 6,
    type: 'numeric',
    unit: 'mg/dL',
    placeholder: 'e.g. 95',
    normalRange: '70–99 mg/dL',
    tooltip: 'FBS — Fasting Blood Sugar in mg/dL. Normal: 70–99 mg/dL.',
    description: 'Serum glucose level after at least 8 hours of fasting. Enter numerical value in mg/dL.',
  },
  {
    key: 'CR',
    label: 'Creatinine',
    stage: 6,
    type: 'numeric',
    unit: 'mg/dL',
    placeholder: 'e.g. 1.0',
    normalRange: '0.7–1.3 mg/dL',
    tooltip: 'CR — Serum Creatinine in mg/dL. Normal: 0.7–1.3 mg/dL.',
    description: 'Serum creatinine concentration reflecting renal function. Enter numerical value in mg/dL.',
  },
  {
    key: 'TG',
    label: 'Triglycerides',
    stage: 6,
    type: 'numeric',
    required: true,
    unit: 'mg/dL',
    placeholder: 'e.g. 150',
    normalRange: '< 150 mg/dL',
    tooltip: 'TG — Serum Triglycerides in mg/dL. Desirable: < 150 mg/dL.',
    description: 'Fasting serum triglycerides level. Enter numerical value in mg/dL.',
  },
  {
    key: 'LDL',
    label: 'LDL Cholesterol',
    stage: 6,
    type: 'numeric',
    unit: 'mg/dL',
    placeholder: 'e.g. 100',
    normalRange: '< 100 mg/dL',
    tooltip: 'LDL — Low-Density Lipoprotein in mg/dL. Optimal: < 100 mg/dL.',
    description: 'Low-Density Lipoprotein cholesterol. Enter numerical value in mg/dL.',
  },
  {
    key: 'HDL',
    label: 'HDL Cholesterol',
    stage: 6,
    type: 'numeric',
    unit: 'mg/dL',
    placeholder: 'e.g. 45',
    normalRange: '≥ 40 mg/dL (M), ≥ 50 mg/dL (F)',
    tooltip: 'HDL — High-Density Lipoprotein in mg/dL. Protective: ≥ 40-50 mg/dL.',
    description: 'High-Density Lipoprotein cholesterol. Enter numerical value in mg/dL.',
  },
  {
    key: 'BUN',
    label: 'Blood Urea Nitrogen',
    stage: 6,
    type: 'numeric',
    unit: 'mg/dL',
    placeholder: 'e.g. 15',
    normalRange: '7–20 mg/dL',
    tooltip: 'BUN — Blood Urea Nitrogen in mg/dL. Normal: 7–20 mg/dL.',
    description: 'Blood Urea Nitrogen level reflecting renal function and protein metabolism. Enter numerical value in mg/dL.',
  },
  {
    key: 'ESR',
    label: 'ESR (Sedimentation Rate)',
    stage: 6,
    type: 'numeric',
    required: true,
    unit: 'mm/hr',
    placeholder: 'e.g. 12',
    normalRange: '0–20 mm/hr',
    tooltip: 'ESR — Erythrocyte Sedimentation Rate in mm/hr. Normal: 0–20 mm/hr.',
    description: 'Erythrocyte sedimentation rate measuring systemic inflammatory response. Enter numerical value in mm/hr.',
  },
  {
    key: 'HB',
    label: 'Hemoglobin',
    stage: 6,
    type: 'numeric',
    unit: 'g/dL',
    placeholder: 'e.g. 14.0',
    normalRange: '12.0–17.5 g/dL',
    tooltip: 'HB — Whole Blood Hemoglobin in g/dL. Normal: 12.0–17.5 g/dL.',
    description: 'Total hemoglobin concentration in whole blood. Enter numerical value in g/dL.',
  },
  {
    key: 'K',
    label: 'Potassium',
    stage: 6,
    type: 'numeric',
    unit: 'mEq/L',
    placeholder: 'e.g. 4.2',
    normalRange: '3.5–5.0 mEq/L',
    tooltip: 'K — Serum Potassium in mEq/L (mmol/L). Normal: 3.5–5.0 mEq/L.',
    description: 'Serum potassium electrolyte concentration. Enter numerical value in mEq/L (or mmol/L).',
  },
  {
    key: 'Na',
    label: 'Sodium',
    stage: 6,
    type: 'numeric',
    unit: 'mEq/L',
    placeholder: 'e.g. 140',
    normalRange: '135–145 mEq/L',
    tooltip: 'Na — Serum Sodium in mEq/L (mmol/L). Normal: 135–145 mEq/L.',
    description: 'Serum sodium electrolyte concentration. Enter numerical value in mEq/L (or mmol/L).',
  },
  {
    key: 'WBC',
    label: 'White Blood Cell Count',
    stage: 6,
    type: 'numeric',
    unit: 'cells/µL',
    placeholder: 'e.g. 7000',
    normalRange: '4,000–11,000 cells/µL',
    tooltip: 'WBC — Total Leukocyte Count in cells/µL. Normal: 4,000–11,000 cells/µL.',
    description: 'Total white blood cell count per microliter of blood. Enter numerical value in cells/µL.',
  },
  {
    key: 'Lymph',
    label: 'Lymphocytes',
    stage: 6,
    type: 'numeric',
    unit: '%',
    placeholder: 'e.g. 30',
    normalRange: '20–40%',
    tooltip: 'Lymph — Lymphocyte percentage in differential count (%). Normal: 20–40%.',
    description: 'Lymphocyte percentage in white blood cell differential count. Enter numerical percentage (%).',
  },
  {
    key: 'Neut',
    label: 'Neutrophils',
    stage: 6,
    type: 'numeric',
    unit: '%',
    placeholder: 'e.g. 60',
    normalRange: '40–70%',
    tooltip: 'Neut — Neutrophil percentage in differential count (%). Normal: 40–70%.',
    description: 'Neutrophil percentage in white blood cell differential count. Enter numerical percentage (%).',
  },
  {
    key: 'PLT',
    label: 'Platelet Count',
    stage: 6,
    type: 'numeric',
    unit: '×10³/µL',
    placeholder: 'e.g. 250',
    normalRange: '150–450 ×10³/µL',
    tooltip: 'PLT — Platelet count in thousands per µL (×10³/µL). Normal: 150–450.',
    description: 'Circulating platelet count in thousands per microliter. Enter 250 for 250,000 cells/µL.',
  },

  // ── Stage 7: Echocardiography (3) ──
  {
    key: 'EF-TTE',
    label: 'Ejection Fraction (TTE)',
    stage: 7,
    type: 'numeric',
    required: true,
    unit: '%',
    placeholder: 'e.g. 55',
    normalRange: '50–70%',
    tooltip: 'EF-TTE — Left Ventricular Ejection Fraction (%) by Transthoracic Echo',
    description: 'Left Ventricular Ejection Fraction evaluated by transthoracic echocardiography. Enter numerical percentage (%).',
  },
  {
    key: 'Region RWMA',
    label: 'Regional Wall Motion Abnormality',
    stage: 7,
    type: 'select',
    placeholder: 'Select RWMA score/region',
    tooltip: 'Region RWMA — Segmental wall motion abnormality (0=None, 1 to 4)',
    description: 'Presence and anatomical region of wall motion abnormality detected on echocardiogram. Select an option from dropdown.',
    options: [
      { value: '0', label: '0' },
      { value: '1', label: '1' },
      { value: '2', label: '2' },
      { value: '3', label: '3' },
      { value: '4', label: '4' },
    ],
  },
  {
    key: 'VHD',
    label: 'Valvular Heart Disease',
    stage: 7,
    type: 'select',
    placeholder: 'Select VHD severity',
    tooltip: 'VHD — Valvular Heart Disease severity (Normal, Mild, Moderate, Severe)',
    description: 'Severity grade of Valvular Heart Disease evaluated on echocardiography. Select an option from dropdown.',
    options: [
      { value: 'Normal', label: 'Normal / None' },
      { value: 'Mild', label: 'Mild' },
      { value: 'Moderate', label: 'Moderate' },
      { value: 'Severe', label: 'Severe' },
    ],
  },
];

/**
 * Get features for a specific stage
 */
export function getFeaturesForStage(stageNumber) {
  return FEATURE_DEFINITIONS.filter((f) => f.stage === stageNumber);
}

/**
 * Get a feature definition by its key
 */
export function getFeatureByKey(key) {
  return FEATURE_DEFINITIONS.find((f) => f.key === key);
}

/**
 * Check if a feature is required
 */
export function isFeatureRequired(key) {
  const feat = getFeatureByKey(key);
  return feat ? !!feat.required : false;
}

/**
 * Get list of all required feature definitions
 */
export function getRequiredFeatures() {
  return FEATURE_DEFINITIONS.filter((f) => f.required);
}

/**
 * Get list of missing required features for given formData
 */
export function getMissingRequiredFeatures(formData) {
  if (!formData) return getRequiredFeatures();
  return FEATURE_DEFINITIONS.filter(
    (f) => f.required && (formData[f.key] === null || formData[f.key] === undefined || formData[f.key] === '')
  );
}

/**
 * Check if all required features are filled
 */
export function isAllRequiredFilled(formData) {
  return getMissingRequiredFeatures(formData).length === 0;
}

/**
 * Generate an empty form state with all 55 keys set to null
 */
export function createEmptyFormState() {
  const state = {};
  FEATURE_DEFINITIONS.forEach((f) => {
    state[f.key] = null;
  });
  return state;
}

/**
 * Count how many features have been filled
 */
export function countFilledFeatures(formData) {
  if (!formData) return 0;
  return FEATURE_DEFINITIONS.filter((f) => formData[f.key] !== null && formData[f.key] !== '' && formData[f.key] !== undefined).length;
}

/**
 * Count filled features for a specific stage
 */
export function countFilledFeaturesForStage(formData, stageNumber) {
  if (!formData) return 0;
  const stageFeatures = getFeaturesForStage(stageNumber);
  return stageFeatures.filter((f) => formData[f.key] !== null && formData[f.key] !== '' && formData[f.key] !== undefined).length;
}
