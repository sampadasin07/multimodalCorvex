import { FEATURE_DEFINITIONS } from './featureDefinitions';

/**
 * Validate a single feature value
 * Returns { valid: boolean, message: string | null }
 */
export function validateFeature(featureKey, value) {
  const def = FEATURE_DEFINITIONS.find((f) => f.key === featureKey);
  if (!def) return { valid: true, message: null };

  // Null/empty is not an error per se, it's "unanswered"
  if (value === null || value === '' || value === undefined) {
    if (def.required) {
      return { valid: false, message: `${def.label} is required *`, empty: true };
    }
    return { valid: true, message: null, empty: true };
  }

  if (def.type === 'numeric') {
    const num = Number(value);
    if (isNaN(num)) {
      return { valid: false, message: 'Enter a valid number' };
    }
    if (def.key === 'Age' && (num < 0 || num > 150)) {
      return { valid: false, message: 'Enter a valid age' };
    }
    if (def.key === 'BMI' && num < 0) {
      return { valid: false, message: 'BMI must be positive' };
    }
    if ((def.key === 'Weight' || def.key === 'Length') && num <= 0) {
      return { valid: false, message: 'Enter a positive value' };
    }
  }

  if (def.type === 'boolean') {
    if (value !== 'Yes' && value !== 'No' && value !== true && value !== false) {
      return { valid: false, message: 'Please select Yes or No' };
    }
  }

  if (def.type === 'select') {
    if (def.options && !def.options.find((o) => o.value === String(value))) {
      return { valid: false, message: 'Please select a valid option' };
    }
  }

  return { valid: true, message: null, empty: false };
}

/**
 * Validate all features for a given stage
 * Returns { valid: boolean, errors: { [key]: message } }
 */
export function validateStage(stageNumber, formData) {
  const stageFeatures = FEATURE_DEFINITIONS.filter((f) => f.stage === stageNumber);
  const errors = {};
  let valid = true;

  stageFeatures.forEach((feat) => {
    const result = validateFeature(feat.key, formData[feat.key]);
    if (!result.valid) {
      errors[feat.key] = result.message;
      valid = false;
    }
  });

  return { valid, errors };
}

/**
 * Check if a stage has all required features filled
 */
export function isStageComplete(stageNumber, formData) {
  const stageFeatures = FEATURE_DEFINITIONS.filter((f) => f.stage === stageNumber);
  return stageFeatures.every(
    (f) => formData[f.key] !== null && formData[f.key] !== '' && formData[f.key] !== undefined
  );
}

/**
 * Check which stages have unanswered features
 */
export function getIncompleteStages(formData) {
  const stages = [1, 2, 3, 4, 5, 6, 7];
  return stages.filter((s) => !isStageComplete(s, formData));
}
