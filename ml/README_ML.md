# ML Module — Cardiovascular Risk Visualization & Prediction

## Overview

This module trains and serves **4 independent binary classifiers** that predict cardiovascular disease risk from clinical, ECG, lab, and echocardiography features:

| Target | Description | Best Model | Nested CV AUC | Test AUC |
|--------|-------------|-----------|---------------|----------|
| **CAD** | Coronary artery disease (Cath: CAD vs Normal) | Random Forest | 0.926 ± 0.035 | 0.817 |
| **LAD** | Left anterior descending stenosis | Random Forest | 0.847 ± 0.041 | 0.736 |
| **LCX** | Left circumflex stenosis | Random Forest | 0.726 ± 0.052 | 0.763 |
| **RCA** | Right coronary artery stenosis | Logistic Regression | 0.723 ± 0.052 | 0.738 |

**Dataset**: Extension of Z-Alizadeh Sani (303 patients, 50 features after cleaning).

---

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run full pipeline
python -m src.data          # Clean data → data/processed/
python -m src.schema        # Generate feature_schema.json
python -m src.train         # Train models → models/
python -m src.evaluate      # Test-set metrics → reports/
python -m src.explain       # SHAP + LIME → reports/
python -m src.predict       # Demo predictions with sample patients

# Run tests
python -m pytest tests/ -v
```

---

## For Person 2 (Backend Integration)

### `predict_patient()` API

```python
from src.predict import predict_patient

result = predict_patient(patient_data, include_shap=True)
```

**Input**: `patient_data` — dict of feature_name → value (50 features). Missing features auto-fill from `feature_schema.json` defaults.

**Output**:
```json
{
  "predictions": {
    "CAD": {"probability": 0.82, "risk_level": "high", "positive": true, "threshold": 0.504},
    "LAD": {"probability": 0.71, "risk_level": "high", "positive": true, "threshold": 0.437},
    "LCX": {"probability": 0.45, "risk_level": "moderate", "positive": true, "threshold": 0.384},
    "RCA": {"probability": 0.38, "risk_level": "moderate", "positive": true, "threshold": 0.346}
  },
  "overall_risk": "high",
  "feature_values": { ... },
  "shap_contributions": {
    "CAD": [
      {"feature": "Typical Chest Pain", "shap_value": 0.12, "direction": "risk"},
      ...
    ]
  }
}
```

### Risk Bands
- `low`: probability < 0.33
- `moderate`: 0.33 ≤ probability < 0.66
- `high`: probability ≥ 0.66

### Sample Patients
See `models/sample_patients.json` for 5 diverse test cases.

---

## For Person 3 (Frontend / 3D Visualization)

The `predictions` dict maps directly to artery colors in the Three.js viewer:
- `CAD.probability` → overall heart risk indicator
- `LAD.probability` → LAD artery color intensity
- `LCX.probability` → LCX artery color intensity
- `RCA.probability` → RCA artery color intensity

Use `feature_schema.json` to:
- Render input forms with proper labels, units, min/max, and defaults
- Highlight abnormal values (compare against `normal_range`)

---

## Project Structure

```
ml/
├── src/
│   ├── __init__.py
│   ├── config.py          # Constants, paths, leakage guard
│   ├── data.py            # Load, clean, split data
│   ├── schema.py          # Generate feature_schema.json
│   ├── train.py           # Nested CV, calibrated model training
│   ├── evaluate.py        # Test-set evaluation, plots
│   ├── explain.py         # SHAP + LIME explainability
│   └── predict.py         # Inference API (predict_patient)
├── tests/
│   ├── __init__.py
│   └── test_no_leakage.py # Leakage, drop, schema tests
├── data/
│   ├── raw/               # Original Excel dataset
│   └── processed/         # Cleaned CSVs, split.json
├── models/
│   ├── *_pipeline.joblib  # 4 calibrated model pipelines
│   ├── model_card.json    # CV results, thresholds, params
│   ├── feature_schema.json # Feature metadata + normal ranges
│   ├── split_indices.json # Train/test split
│   └── sample_patients.json # 5 demo patients
├── reports/
│   ├── evaluation_report.json
│   ├── explainability_summary.json
│   ├── *.png              # All plots (EDA, ROC, SHAP, LIME, etc.)
│   └── oof_predictions.csv
├── notebooks/
│   ├── 01_eda.py          # EDA (jupytext percent format)
│   └── 01_eda.ipynb       # Executed notebook
├── requirements.txt
└── README_ML.md           # This file
```

---

## Methodology

### Preprocessing (inside sklearn Pipeline)
- **20 numeric features**: RobustScaler for LR only; passthrough for RF/XGB
- **27 binary features**: passthrough
- **BBB**: one-hot encoding (drop N baseline) → LBBB, RBBB
- **VHD**: ordinal encoding (N=0, mild=1, Moderate=2, Severe=3)
- **Region RWMA**: one-hot encoding (drop 0) → 1, 2, 3, 4
- **Total**: 50 raw features → 54 encoded dimensions

### Model Selection
- **Nested CV**: outer RepeatedStratifiedKFold(5, 3) = 15 folds; inner StratifiedKFold(3)
- **3 candidates**: Logistic Regression, Random Forest, XGBoost
- Best model selected by outer-fold AUC mean

### Calibration
- Sigmoid (Platt scaling) applied after final model selection
- All probabilities are calibrated for meaningful risk communication

### Threshold Selection
- Primary rule: highest threshold with recall ≥ 0.90 (screening setting)
- Fallback: Youden's J if precision drops below 0.50
- All 4 targets used the primary rule

### Leakage Prevention
- `LEAKAGE_COLS = ['LAD', 'LCX', 'RCA', 'Cath']` — never used as input features
- Unit test enforces this guarantee
- All preprocessing fits on training folds only (no data leakage in CV)

---

## Key Features by Target (SHAP)

| CAD | LAD | LCX | RCA |
|-----|-----|-----|-----|
| Typical Chest Pain | Typical Chest Pain | Age | Age |
| Atypical | EF-TTE | TG | ESR |
| Age | Atypical | ESR | Typical Chest Pain |
| EF-TTE | Age | Typical Chest Pain | CR |
| BP | ESR | Neut | TG |

> **Note on Lymph/Neut**: These features are highly correlated (|r|=0.92, WBC differential). Both are retained; SHAP may split credit between them. This is documented, not a modeling error.

---

## Known Limitations

1. **Small dataset** (303 patients) — CV estimates are more reliable than the 61-sample test set
2. **Single-center data** — model may not generalize to other populations
3. **LCX and RCA AUC ~0.72-0.76** — moderate discrimination due to weak individual feature-target correlations
4. **Row 93 mismatch**: Cath=Normal but LAD=Stenotic — the only Cath/vessel inconsistency, kept as-is
5. **Excluded features**: CHF (1 positive) and LowTH Ang (2 positives) — too sparse for modeling
6. **Obesity redundancy**: ~BMI≥25 (99.7% agreement), kept as separate clinical judgment variable

---

## Reproducibility

- `RANDOM_SEED = 42` used everywhere
- Fixed train/test split in `split_indices.json`
- All preprocessing inside sklearn Pipelines (fit on train only)
- Python 3.14, scikit-learn 1.8.0, xgboost 2.x, shap 0.51
