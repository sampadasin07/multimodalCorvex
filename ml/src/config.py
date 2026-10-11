from pathlib import Path

# ── Paths ──────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent          # ml/
DATA_RAW_DIR = PROJECT_ROOT / 'data' / 'raw'
DATA_PROCESSED_DIR = PROJECT_ROOT / 'data' / 'processed'
MODELS_DIR = PROJECT_ROOT / 'models'
REPORTS_DIR = PROJECT_ROOT / 'reports'

RAW_XLSX = DATA_RAW_DIR / 'extention of Z-Alizadeh sani dataset.xlsx'
RAW_SHEET = 'Sheet 1 - Table 1'

# ── Reproducibility ────────────────────────────────────
RANDOM_SEED = 42
TEST_SIZE = 0.20

# ── Target leakage guard ───────────────────────────────
LEAKAGE_COLS: list[str] = ['LAD', 'LCX', 'RCA', 'Cath']

# ── Columns to drop (with reason) ─────────────────────
DROP_COLS: dict[str, str] = {
    'Exertional CP': 'Zero-variance (all values are N)',
    'Weight': 'Redundant with BMI (BMI = Weight / (Length/100)^2, exact)',
    'Length': 'Redundant with BMI (BMI = Weight / (Length/100)^2, exact)',
}

# ── Target encoding maps ──────────────────────────────
TARGET_MAP: dict[str, dict[str, int]] = {
    'Cath': {'CAD': 1, 'Normal': 0},
    'LAD':  {'Stenotic': 1, 'Normal': 0},
    'LCX':  {'Stenotic': 1, 'Normal': 0},
    'RCA':  {'Stenotic': 1, 'Normal': 0},
}

# ── Binary Y/N columns (mapped Y→1, N→0 in data.py) ──
YN_COLS: list[str] = [
    'Obesity', 'CRF', 'CVA', 'Airway disease', 'Thyroid Disease',
    'CHF', 'DLP', 'Weak Peripheral Pulse', 'Lung rales',
    'Systolic Murmur', 'Diastolic Murmur', 'Dyspnea',
    'Atypical', 'Nonanginal', 'LowTH Ang', 'LVH', 'Poor R Progression',
]

# ── Sex mapping ────────────────────────────────────────
SEX_MAP: dict[str, int] = {'Male': 1, 'Fmale': 0}

# ── Categorical columns (kept as strings/ints, encoded in pipeline) ──
# BBB: N / LBBB / RBBB  -> one-hot in pipeline (drop N baseline)
# VHD: N / mild / Moderate / Severe -> ordinal in pipeline
VHD_ORDER: list[str] = ['N', 'mild', 'Moderate', 'Severe']
# Region RWMA: 0-4 (categorical region code) -> one-hot in pipeline
# Function Class: 0-3 (ordinal NYHA class) -> keep as integer

# ── Risk level bands (for predict.py later) ────────────
RISK_BANDS: dict[str, tuple[float, float]] = {
    'low': (0.0, 0.33),
    'moderate': (0.33, 0.66),
    'high': (0.66, 1.0),
}

# ── Min-positives rule ─────────────────────────────────
# Binary features with fewer than this many positive cases in the full
# dataset are excluded from model input (used_by_model=False in schema).
# They remain in the cleaned data and schema for documentation / frontend.
MIN_POSITIVES_THRESHOLD: int = 5
MODEL_EXCLUDE_COLS: list[str] = [
    'CHF',        # 1 positive out of 303
    'LowTH Ang',  # 2 positives out of 303
]

# ── Columns that stay as-is for pipeline encoding ─────
PIPELINE_ONEHOT_COLS: list[str] = ['BBB']              # string categorical
PIPELINE_ORDINAL_COLS: list[str] = ['VHD']              # string ordinal
PIPELINE_ONEHOT_INT_COLS: list[str] = ['Region RWMA']   # integer categorical
