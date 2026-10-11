# Data Quality Report

**Dataset**: Extension of Z-Alizadeh Sani (UCI/Kaggle)
**Total samples**: 303
**Train samples**: 242
**Test samples**: 61
**Total features**: 52
**Random seed**: 42

## 1. Target Balance (Train Set)

| Target | Positive (1) | Negative (0) | Pos % |
|--------|-------------|-------------|-------|
| CAD (Cath) | 172 | 70 | 71.1% |
| LAD Stenosis | 141 | 101 | 58.3% |
| LCX Stenosis | 94 | 148 | 38.8% |
| RCA Stenosis | 91 | 151 | 37.6% |

## 2. Missing Values

**No missing values** in any feature column.

## 3. Cath vs Vessel Status Consistency

**1 mismatch(es)** found:

| Row | Cath | LAD | LCX | RCA | Notes |
|-----|------|-----|-----|-----|-------|
| 93 | Normal | Stenotic | Normal | Normal | Cath=Normal but has stenotic vessel |

## 4. Obesity vs BMI Relationship

- Obesity == (BMI >= 25): **302/303** agree (99.7%)
- Obesity == (BMI >= 30): **163/303** agree (53.8%)

Obesity column matches BMI >= 25 (WHO overweight cutoff) at 99.7% agreement, 
but only 53.8% for BMI >= 30 (WHO obesity cutoff). This means Obesity reflects 
a **clinical overweight/obesity judgment**, not a strict BMI >= 30 derivation. 
**Decision: KEEP Obesity** as an independent clinical feature.

## 5. Duplicate Rows

Fully duplicate feature rows: **0**

## 6. Sparse Binary Columns (minority class < 10 in full data)

| Feature | Positive (1) | Negative (0) | Notes |
|---------|-------------|-------------|-------|
| CRF | 6 | 297 | minority=6 |
| CVA | 5 | 298 | minority=5 |
| Thyroid Disease | 7 | 296 | minority=7 |
| CHF | 1 | 302 | minority=1 |
| Weak Peripheral Pulse | 5 | 298 | minority=5 |
| Diastolic Murmur | 9 | 294 | minority=9 |
| LowTH Ang | 2 | 301 | minority=2 |
| Poor R Progression | 9 | 294 | minority=9 |

> **Note**: These columns are kept but may have limited predictive power and
> could cause instability in cross-validation folds.

## 7. Highly Correlated Feature Pairs (|r| > 0.8, Train Set)

| Feature A | Feature B | |r| |
|-----------|-----------|-----|
| Lymph | Neut | 0.9226 |

## 8. Numeric Feature Ranges & Outliers (Train Set)

| Feature | Unit | Min | Max | Median | IQR Outliers | Plausible |
|---------|------|-----|-----|--------|-------------|-----------|
| Age | years | 30.0 | 86.0 | 57.0 | 0 | Yes |
| BMI | kg/m2 | 18.4 | 40.9 | 26.8 | 3 | Yes |
| BP | mmHg | 90.0 | 190.0 | 130.0 | 7 | Yes |
| PR | bpm | 50.0 | 110.0 | 70.0 | 7 | Yes |
| FBS | mg/dL | 62.0 | 400.0 | 97.5 | 16 | Yes |
| CR | mg/dL | 0.5 | 2.2 | 1.0 | 5 | Yes |
| TG | mg/dL | 37.0 | 1050.0 | 119.0 | 16 | Yes |
| LDL | mg/dL | 18.0 | 232.0 | 100.0 | 4 | Yes |
| HDL | mg/dL | 15.9 | 111.0 | 39.0 | 4 | Yes |
| BUN | mg/dL | 8.0 | 52.0 | 16.0 | 14 | Yes |
| ESR | mm/hr | 1.0 | 90.0 | 15.0 | 11 | Yes |
| HB | g/dL | 8.9 | 17.6 | 13.3 | 2 | Yes |
| K | mEq/L | 3.0 | 6.6 | 4.2 | 1 | Yes |
| Na | mEq/L | 130.0 | 156.0 | 141.0 | 11 | Yes |
| WBC | cells/uL | 3700.0 | 18000.0 | 7150.0 | 8 | Yes |
| Lymph | % | 7.0 | 60.0 | 32.0 | 3 | Yes |
| Neut | % | 32.0 | 86.0 | 60.0 | 0 | Yes |
| PLT | x1000/uL | 25.0 | 742.0 | 208.0 | 8 | **1 out of range** |
| EF-TTE | % | 15.0 | 60.0 | 50.0 | 13 | Yes |

> **PLT=25 x1000/uL**: One patient has a very low platelet count (severe thrombocytopenia).
> Clinically plausible but extreme. All other values are within physiologically plausible ranges.

## 9. Final Input Feature List

**Total features: 52**

**Leakage check**: None of ['LAD', 'LCX', 'RCA', 'Cath'] present in features. ✅

| # | Feature | Dtype | Group |
|---|---------|-------|-------|
| 1 | Age | int64 | Demographics |
| 2 | Sex | int64 | Demographics |
| 3 | BMI | float64 | Demographics |
| 4 | DM | int64 | Medical History |
| 5 | HTN | int64 | Medical History |
| 6 | Current Smoker | int64 | Medical History |
| 7 | EX-Smoker | int64 | Medical History |
| 8 | FH | int64 | Medical History |
| 9 | Obesity | int64 | Demographics |
| 10 | CRF | int64 | Medical History |
| 11 | CVA | int64 | Medical History |
| 12 | Airway disease | int64 | Medical History |
| 13 | Thyroid Disease | int64 | Medical History |
| 14 | CHF | int64 | Medical History |
| 15 | DLP | int64 | Medical History |
| 16 | BP | int64 | Vitals |
| 17 | PR | int64 | Vitals |
| 18 | Edema | int64 | Symptoms/Exam |
| 19 | Weak Peripheral Pulse | int64 | Symptoms/Exam |
| 20 | Lung rales | int64 | Symptoms/Exam |
| 21 | Systolic Murmur | int64 | Symptoms/Exam |
| 22 | Diastolic Murmur | int64 | Symptoms/Exam |
| 23 | Typical Chest Pain | int64 | Symptoms/Exam |
| 24 | Dyspnea | int64 | Symptoms/Exam |
| 25 | Function Class | int64 | Symptoms/Exam |
| 26 | Atypical | int64 | Symptoms/Exam |
| 27 | Nonanginal | int64 | Symptoms/Exam |
| 28 | LowTH Ang | int64 | Symptoms/Exam |
| 29 | Q Wave | int64 | ECG |
| 30 | St Elevation | int64 | ECG |
| 31 | St Depression | int64 | ECG |
| 32 | Tinversion | int64 | ECG |
| 33 | LVH | int64 | ECG |
| 34 | Poor R Progression | int64 | ECG |
| 35 | BBB | object | ECG |
| 36 | FBS | int64 | Laboratory |
| 37 | CR | float64 | Laboratory |
| 38 | TG | int64 | Laboratory |
| 39 | LDL | int64 | Laboratory |
| 40 | HDL | float64 | Laboratory |
| 41 | BUN | int64 | Laboratory |
| 42 | ESR | int64 | Laboratory |
| 43 | HB | float64 | Laboratory |
| 44 | K | float64 | Laboratory |
| 45 | Na | int64 | Laboratory |
| 46 | WBC | int64 | Laboratory |
| 47 | Lymph | int64 | Laboratory |
| 48 | Neut | int64 | Laboratory |
| 49 | PLT | int64 | Laboratory |
| 50 | EF-TTE | int64 | Echo |
| 51 | Region RWMA | int64 | Echo |
| 52 | VHD | object | Echo |

## 10. Feature Statistics (Train Set Only)

| Feature | Type | Min | Max | Median/Mode | Unique |
|---------|------|-----|-----|-------------|--------|
| Age | numeric | 30.00 | 86.00 | 57.00 | 45 |
| Sex | binary | 0 | 1 | mode=1 | 2 |
| BMI | numeric | 18.37 | 40.90 | 26.83 | 216 |
| DM | binary | 0 | 1 | mode=0 | 2 |
| HTN | binary | 0 | 1 | mode=1 | 2 |
| Current Smoker | binary | 0 | 1 | mode=0 | 2 |
| EX-Smoker | binary | 0 | 1 | mode=0 | 2 |
| FH | binary | 0 | 1 | mode=0 | 2 |
| Obesity | binary | 0 | 1 | mode=1 | 2 |
| CRF | binary | 0 | 1 | mode=0 | 2 |
| CVA | binary | 0 | 1 | mode=0 | 2 |
| Airway disease | binary | 0 | 1 | mode=0 | 2 |
| Thyroid Disease | binary | 0 | 1 | mode=0 | 2 |
| CHF | binary | 0 | 1 | mode=0 | 2 |
| DLP | binary | 0 | 1 | mode=0 | 2 |
| BP | numeric | 90.00 | 190.00 | 130.00 | 17 |
| PR | numeric | 50.00 | 110.00 | 70.00 | 21 |
| Edema | binary | 0 | 1 | mode=0 | 2 |
| Weak Peripheral Pulse | binary | 0 | 1 | mode=0 | 2 |
| Lung rales | binary | 0 | 1 | mode=0 | 2 |
| Systolic Murmur | binary | 0 | 1 | mode=0 | 2 |
| Diastolic Murmur | binary | 0 | 1 | mode=0 | 2 |
| Typical Chest Pain | binary | 0 | 1 | mode=1 | 2 |
| Dyspnea | binary | 0 | 1 | mode=0 | 2 |
| Function Class | numeric | 0.00 | 3.00 | 0.00 | 3 |
| Atypical | binary | 0 | 1 | mode=0 | 2 |
| Nonanginal | binary | 0 | 1 | mode=0 | 2 |
| LowTH Ang | binary | 0 | 1 | mode=0 | 2 |
| Q Wave | binary | 0 | 1 | mode=0 | 2 |
| St Elevation | binary | 0 | 1 | mode=0 | 2 |
| St Depression | binary | 0 | 1 | mode=0 | 2 |
| Tinversion | binary | 0 | 1 | mode=0 | 2 |
| LVH | binary | 0 | 1 | mode=0 | 2 |
| Poor R Progression | binary | 0 | 1 | mode=0 | 2 |
| BBB | categorical | - | - | mode=N | 3 |
| FBS | numeric | 62.00 | 400.00 | 97.50 | 101 |
| CR | numeric | 0.50 | 2.20 | 1.00 | 16 |
| TG | numeric | 37.00 | 1050.00 | 119.00 | 130 |
| LDL | numeric | 18.00 | 232.00 | 100.00 | 102 |
| HDL | numeric | 15.90 | 111.00 | 39.00 | 45 |
| BUN | numeric | 8.00 | 52.00 | 16.00 | 29 |
| ESR | numeric | 1.00 | 90.00 | 15.00 | 56 |
| HB | numeric | 8.90 | 17.60 | 13.30 | 61 |
| K | numeric | 3.00 | 6.60 | 4.20 | 26 |
| Na | numeric | 130.00 | 156.00 | 141.00 | 22 |
| WBC | numeric | 3700.00 | 18000.00 | 7150.00 | 75 |
| Lymph | numeric | 7.00 | 60.00 | 32.00 | 47 |
| Neut | numeric | 32.00 | 86.00 | 60.00 | 48 |
| PLT | numeric | 25.00 | 742.00 | 208.00 | 115 |
| EF-TTE | numeric | 15.00 | 60.00 | 50.00 | 11 |
| Region RWMA | numeric | 0.00 | 4.00 | 0.00 | 5 |
| VHD | categorical | - | - | mode=mild | 4 |

Saved train-set statistics to `data/processed/train_stats.json` for schema generation.
