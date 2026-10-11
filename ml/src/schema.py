"""Generate models/feature_schema.json from train-set statistics and clinical knowledge.

The schema describes every input feature so the frontend can auto-generate
the patient input form and the 'measurement vs normal range' panel.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

from . import config as cfg

logger = logging.getLogger(__name__)

# ── Clinical reference ranges (from medical literature) ──────────────
# Format: (normal_min, normal_max) or None if not applicable.
# Using general adult ranges; sex-specific noted in comments.
CLINICAL_RANGES: dict[str, tuple[float, float] | None] = {
    'Age': None,
    'Sex': None,
    'BMI': (18.5, 24.9),
    'DM': None,
    'HTN': None,
    'Current Smoker': None,
    'EX-Smoker': None,
    'FH': None,
    'Obesity': None,
    'CRF': None,
    'CVA': None,
    'Airway disease': None,
    'Thyroid Disease': None,
    'CHF': None,
    'DLP': None,
    'BP': (90, 120),
    'PR': (60, 100),
    'Edema': None,
    'Weak Peripheral Pulse': None,
    'Lung rales': None,
    'Systolic Murmur': None,
    'Diastolic Murmur': None,
    'Typical Chest Pain': None,
    'Dyspnea': None,
    'Function Class': None,
    'Atypical': None,
    'Nonanginal': None,
    'LowTH Ang': None,
    'Q Wave': None,
    'St Elevation': None,
    'St Depression': None,
    'Tinversion': None,
    'LVH': None,
    'Poor R Progression': None,
    'BBB': None,
    'FBS': (70, 99),
    'CR': (0.6, 1.2),
    'TG': (40, 149),
    'LDL': (50, 99),
    'HDL': (40, 60),
    'BUN': (7, 20),
    'ESR': (0, 20),
    'HB': (12.0, 17.5),
    'K': (3.5, 5.0),
    'Na': (135, 145),
    'WBC': (4000, 11000),
    'Lymph': (20, 40),
    'Neut': (40, 70),
    'PLT': (150, 450),
    'EF-TTE': (50, 70),
    'Region RWMA': None,
    'VHD': None,
}

# ── Units ────────────────────────────────────────────────────────────
UNITS: dict[str, str] = {
    'Age': 'years', 'BMI': 'kg/m²', 'BP': 'mmHg', 'PR': 'bpm',
    'FBS': 'mg/dL', 'CR': 'mg/dL', 'TG': 'mg/dL', 'LDL': 'mg/dL',
    'HDL': 'mg/dL', 'BUN': 'mg/dL', 'ESR': 'mm/hr', 'HB': 'g/dL',
    'K': 'mEq/L', 'Na': 'mEq/L', 'WBC': 'cells/µL', 'Lymph': '%',
    'Neut': '%', 'PLT': '×1000/µL', 'EF-TTE': '%',
}

# ── Human-readable labels ────────────────────────────────────────────
LABELS: dict[str, str] = {
    'Age': 'Patient Age',
    'Sex': 'Sex (Male=1, Female=0)',
    'BMI': 'Body Mass Index',
    'DM': 'Diabetes Mellitus',
    'HTN': 'Hypertension',
    'Current Smoker': 'Current Smoker',
    'EX-Smoker': 'Ex-Smoker',
    'FH': 'Family History of CAD',
    'Obesity': 'Obesity (Clinical)',
    'CRF': 'Chronic Renal Failure',
    'CVA': 'Cerebrovascular Accident',
    'Airway disease': 'Airway Disease',
    'Thyroid Disease': 'Thyroid Disease',
    'CHF': 'Congestive Heart Failure',
    'DLP': 'Dyslipidemia',
    'BP': 'Systolic Blood Pressure',
    'PR': 'Pulse Rate',
    'Edema': 'Peripheral Edema',
    'Weak Peripheral Pulse': 'Weak Peripheral Pulse',
    'Lung rales': 'Lung Rales',
    'Systolic Murmur': 'Systolic Murmur',
    'Diastolic Murmur': 'Diastolic Murmur',
    'Typical Chest Pain': 'Typical Chest Pain',
    'Dyspnea': 'Dyspnea',
    'Function Class': 'NYHA Functional Class',
    'Atypical': 'Atypical Chest Pain',
    'Nonanginal': 'Nonanginal Chest Pain',
    'LowTH Ang': 'Low-Threshold Angina',
    'Q Wave': 'Q Wave on ECG',
    'St Elevation': 'ST Elevation on ECG',
    'St Depression': 'ST Depression on ECG',
    'Tinversion': 'T-Wave Inversion on ECG',
    'LVH': 'Left Ventricular Hypertrophy (ECG)',
    'Poor R Progression': 'Poor R-Wave Progression (ECG)',
    'BBB': 'Bundle Branch Block',
    'FBS': 'Fasting Blood Sugar',
    'CR': 'Serum Creatinine',
    'TG': 'Triglycerides',
    'LDL': 'LDL Cholesterol',
    'HDL': 'HDL Cholesterol',
    'BUN': 'Blood Urea Nitrogen',
    'ESR': 'Erythrocyte Sedimentation Rate',
    'HB': 'Hemoglobin',
    'K': 'Serum Potassium',
    'Na': 'Serum Sodium',
    'WBC': 'White Blood Cell Count',
    'Lymph': 'Lymphocyte %',
    'Neut': 'Neutrophil %',
    'PLT': 'Platelet Count',
    'EF-TTE': 'Ejection Fraction (Echocardiography)',
    'Region RWMA': 'Regional Wall Motion Abnormality',
    'VHD': 'Valvular Heart Disease',
}

# ── Feature groups ───────────────────────────────────────────────────
GROUPS: dict[str, str] = {
    'Age': 'Demographics', 'Sex': 'Demographics', 'BMI': 'Demographics',
    'Obesity': 'Demographics',
    'DM': 'Medical History', 'HTN': 'Medical History',
    'Current Smoker': 'Medical History', 'EX-Smoker': 'Medical History',
    'FH': 'Medical History', 'CRF': 'Medical History',
    'CVA': 'Medical History', 'Airway disease': 'Medical History',
    'Thyroid Disease': 'Medical History', 'CHF': 'Medical History',
    'DLP': 'Medical History',
    'BP': 'Vitals', 'PR': 'Vitals',
    'Edema': 'Symptoms/Exam', 'Weak Peripheral Pulse': 'Symptoms/Exam',
    'Lung rales': 'Symptoms/Exam', 'Systolic Murmur': 'Symptoms/Exam',
    'Diastolic Murmur': 'Symptoms/Exam', 'Typical Chest Pain': 'Symptoms/Exam',
    'Dyspnea': 'Symptoms/Exam', 'Function Class': 'Symptoms/Exam',
    'Atypical': 'Symptoms/Exam', 'Nonanginal': 'Symptoms/Exam',
    'LowTH Ang': 'Symptoms/Exam',
    'Q Wave': 'ECG', 'St Elevation': 'ECG', 'St Depression': 'ECG',
    'Tinversion': 'ECG', 'LVH': 'ECG', 'Poor R Progression': 'ECG',
    'BBB': 'ECG',
    'FBS': 'Laboratory', 'CR': 'Laboratory', 'TG': 'Laboratory',
    'LDL': 'Laboratory', 'HDL': 'Laboratory', 'BUN': 'Laboratory',
    'ESR': 'Laboratory', 'HB': 'Laboratory', 'K': 'Laboratory',
    'Na': 'Laboratory', 'WBC': 'Laboratory', 'Lymph': 'Laboratory',
    'Neut': 'Laboratory', 'PLT': 'Laboratory',
    'EF-TTE': 'Echo', 'Region RWMA': 'Echo', 'VHD': 'Echo',
}


def generate_schema() -> dict[str, dict]:
    """Generate the feature schema from train-set statistics and clinical knowledge.

    Reads train_stats.json (computed on train rows only) and combines with
    clinical reference ranges, units, labels, and group assignments.

    Returns:
        dict mapping feature_name -> feature metadata.
    """
    stats_path = cfg.DATA_PROCESSED_DIR / 'train_stats.json'
    with open(stats_path) as f:
        train_stats = json.load(f)

    schema: dict[str, dict] = {}

    for feat_name, stats in train_stats.items():
        feat_type = stats['type']  # 'numeric', 'binary', 'categorical'

        entry: dict = {
            'name': feat_name,
            'label': LABELS.get(feat_name, feat_name),
            'type': feat_type,
            'unit': UNITS.get(feat_name, ''),
            'group': GROUPS.get(feat_name, 'Other'),
            'used_by_model': feat_name not in cfg.MODEL_EXCLUDE_COLS,
        }

        if feat_type == 'numeric':
            entry['min'] = stats['min']
            entry['max'] = stats['max']
            entry['default'] = stats['median']
            rng = CLINICAL_RANGES.get(feat_name)
            entry['normal_range'] = list(rng) if rng else None
        elif feat_type == 'binary':
            entry['min'] = 0
            entry['max'] = 1
            entry['default'] = stats['mode']
            entry['normal_range'] = None
        elif feat_type == 'categorical':
            entry['categories'] = stats.get('values', [])
            entry['default'] = stats['mode']
            entry['normal_range'] = None

        # Add exclusion reason if applicable
        if feat_name in cfg.MODEL_EXCLUDE_COLS:
            entry['exclude_reason'] = (
                f"Fewer than {cfg.MIN_POSITIVES_THRESHOLD} positive cases "
                f"in the dataset (min-positives rule)"
            )

        schema[feat_name] = entry

    return schema


def save_schema(schema: dict[str, dict] | None = None) -> Path:
    """Generate (if needed) and save feature schema to models/feature_schema.json.

    Args:
        schema: Pre-generated schema dict, or None to generate fresh.

    Returns:
        Path to the saved JSON file.
    """
    if schema is None:
        schema = generate_schema()

    cfg.MODELS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = cfg.MODELS_DIR / 'feature_schema.json'

    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(schema, f, indent=2, ensure_ascii=False)

    # Summary
    n_total = len(schema)
    n_used = sum(1 for v in schema.values() if v['used_by_model'])
    n_excluded = n_total - n_used
    excluded_names = [k for k, v in schema.items() if not v['used_by_model']]

    logger.info(f"Feature schema: {n_total} features ({n_used} used by model, "
                f"{n_excluded} excluded: {excluded_names})")
    logger.info(f"Saved to {out_path}")

    return out_path


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(message)s')
    schema = generate_schema()
    path = save_schema(schema)

    # Print summary
    print(f"\nSchema saved to: {path}")
    print(f"Total features: {len(schema)}")
    print()

    # Group breakdown
    groups: dict[str, list[str]] = {}
    for name, meta in schema.items():
        g = meta['group']
        groups.setdefault(g, []).append(name)

    for group, feats in sorted(groups.items()):
        print(f"  {group} ({len(feats)}): {', '.join(feats)}")

    print()
    print("Features excluded from model (used_by_model=false):")
    for name, meta in schema.items():
        if not meta['used_by_model']:
            print(f"  {name}: {meta.get('exclude_reason', '')}")

    print()
    print("Features with clinical normal ranges:")
    for name, meta in schema.items():
        if meta.get('normal_range'):
            print(f"  {name}: {meta['normal_range']} {meta['unit']}")
