"""
train.py — Train and select models for cardiac risk prediction.

For each of 4 targets (CAD/Cath, LAD, LCX, RCA):
  1. Nested CV (outer RepeatedStratifiedKFold(5,3), inner StratifiedKFold(3))
     → honest out-of-fold (OOF) performance estimates
  2. Compare LR / RF / XGBoost by mean OOF AUC
  3. Final hyperparameter search on full 80% training set
  4. CalibratedClassifierCV(method='sigmoid', cv=3) on training set
  5. Threshold from OOF predictions: highest t with recall≥0.90,
     fallback to Youden J if precision < 0.50

Outputs:
  models/{target}_pipeline.joblib   — calibrated pipeline per target
  models/model_card.json            — metadata, CV results, thresholds
  models/split_indices.json         — train/test indices (copy)
  reports/oof_predictions.csv       — OOF predicted probabilities
"""
from __future__ import annotations

import json
import logging
import shutil
import sys
import time
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import (
    GridSearchCV,
    RepeatedStratifiedKFold,
    StratifiedKFold,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import (
    OneHotEncoder,
    OrdinalEncoder,
    RobustScaler,
)
from xgboost import XGBClassifier

# ── Project imports ──────────────────────────────────────
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src import config as cfg, data

warnings.filterwarnings("ignore")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════
# FEATURE DEFINITIONS
# ═══════════════════════════════════════════════════════════

NUMERIC_FEATURES: list[str] = [
    "Age", "BMI", "BP", "PR", "FBS", "CR", "TG", "LDL", "HDL",
    "BUN", "ESR", "HB", "K", "Na", "WBC", "Lymph", "Neut", "PLT",
    "EF-TTE", "Function Class",
]

BINARY_FEATURES: list[str] = [
    "Sex", "DM", "HTN", "Current Smoker", "EX-Smoker", "FH",
    "Obesity", "CRF", "CVA", "Airway disease", "Thyroid Disease",
    "DLP", "Edema", "Weak Peripheral Pulse", "Lung rales",
    "Systolic Murmur", "Diastolic Murmur", "Typical Chest Pain",
    "Dyspnea", "Atypical", "Nonanginal", "Q Wave", "St Elevation",
    "St Depression", "Tinversion", "LVH", "Poor R Progression",
]

ONEHOT_STR_FEATURES: list[str] = ["BBB"]
ORDINAL_STR_FEATURES: list[str] = ["VHD"]
ONEHOT_INT_FEATURES: list[str] = ["Region RWMA"]

ALL_MODEL_FEATURES = (
    NUMERIC_FEATURES + BINARY_FEATURES +
    ONEHOT_STR_FEATURES + ORDINAL_STR_FEATURES + ONEHOT_INT_FEATURES
)

TARGET_NAMES: list[str] = ["Cath", "LAD", "LCX", "RCA"]
SEED = cfg.RANDOM_SEED


# ═══════════════════════════════════════════════════════════
# PREPROCESSING PIPELINE
# ═══════════════════════════════════════════════════════════

def build_preprocessor(use_scaler: bool = False) -> ColumnTransformer:
    """Build a ColumnTransformer for feature preprocessing.

    Args:
        use_scaler: If True, apply RobustScaler to numeric features (for LR).
    """
    if use_scaler:
        numeric_transformer = Pipeline([("scaler", RobustScaler())])
    else:
        numeric_transformer = "passthrough"

    bbb_encoder = OneHotEncoder(
        categories=[["N", "LBBB", "RBBB"]],  # N first → dropped
        drop="first",
        sparse_output=False,
        handle_unknown="infrequent_if_exist",
    )
    vhd_encoder = OrdinalEncoder(
        categories=[cfg.VHD_ORDER],  # ['N', 'mild', 'Moderate', 'Severe']
        handle_unknown="use_encoded_value",
        unknown_value=-1,
    )
    rwma_encoder = OneHotEncoder(
        categories=[[0, 1, 2, 3, 4]],  # 0 first → dropped (no abnormality)
        drop="first",
        sparse_output=False,
        handle_unknown="infrequent_if_exist",
    )

    return ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, NUMERIC_FEATURES),
            ("bin", "passthrough", BINARY_FEATURES),
            ("bbb", bbb_encoder, ONEHOT_STR_FEATURES),
            ("vhd", vhd_encoder, ORDINAL_STR_FEATURES),
            ("rwma", rwma_encoder, ONEHOT_INT_FEATURES),
        ],
        remainder="drop",
    )


# ═══════════════════════════════════════════════════════════
# MODEL CONFIGURATIONS
# ═══════════════════════════════════════════════════════════

def get_model_configs(scale_pos_weight: float = 1.0) -> dict:
    """Return model configurations with small hyperparameter grids.

    Args:
        scale_pos_weight: n_negative / n_positive for XGBoost.
    """
    return {
        "LR": {
            "pipeline": Pipeline([
                ("preprocessor", build_preprocessor(use_scaler=True)),
                ("classifier", LogisticRegression(
                    random_state=SEED, max_iter=1000, solver="lbfgs",
                )),
            ]),
            "param_grid": {
                "classifier__C": [0.01, 0.1, 1.0, 10.0],
                "classifier__class_weight": ["balanced"],
            },
        },
        "RF": {
            "pipeline": Pipeline([
                ("preprocessor", build_preprocessor(use_scaler=False)),
                ("classifier", RandomForestClassifier(
                    random_state=SEED, n_jobs=-1,
                )),
            ]),
            "param_grid": {
                "classifier__n_estimators": [100, 300],
                "classifier__max_depth": [5, 10, None],
                "classifier__min_samples_leaf": [5, 10],
                "classifier__class_weight": ["balanced"],
            },
        },
        "XGB": {
            "pipeline": Pipeline([
                ("preprocessor", build_preprocessor(use_scaler=False)),
                ("classifier", XGBClassifier(
                    random_state=SEED,
                    verbosity=0,
                    eval_metric="logloss",
                    scale_pos_weight=scale_pos_weight,
                    n_jobs=-1,
                )),
            ]),
            "param_grid": {
                "classifier__n_estimators": [100, 200],
                "classifier__max_depth": [3, 5],
                "classifier__learning_rate": [0.05, 0.1],
            },
        },
    }


# ═══════════════════════════════════════════════════════════
# NESTED CROSS-VALIDATION
# ═══════════════════════════════════════════════════════════

def nested_cv(
    X: pd.DataFrame,
    y: pd.Series,
    pipeline: Pipeline,
    param_grid: dict,
    outer_cv: RepeatedStratifiedKFold,
    inner_cv: StratifiedKFold,
) -> tuple[np.ndarray, list[float]]:
    """Run nested CV and return averaged OOF predictions + per-fold AUC scores.

    Returns:
        (oof_preds, fold_aucs): averaged OOF probabilities and AUC per outer fold.
    """
    n = len(y)
    oof_sum = np.zeros(n)
    oof_count = np.zeros(n)
    fold_aucs: list[float] = []

    for fold_idx, (train_idx, val_idx) in enumerate(outer_cv.split(X, y)):
        X_tr = X.iloc[train_idx]
        y_tr = y.iloc[train_idx]
        X_val = X.iloc[val_idx]
        y_val = y.iloc[val_idx]

        search = GridSearchCV(
            pipeline, param_grid,
            cv=inner_cv,
            scoring="roc_auc",
            n_jobs=-1,
            refit=True,
        )
        search.fit(X_tr, y_tr)

        y_proba = search.predict_proba(X_val)[:, 1]

        # Accumulate for averaging across repeats
        oof_sum[val_idx] += y_proba
        oof_count[val_idx] += 1

        fold_auc = roc_auc_score(y_val, y_proba)
        fold_aucs.append(fold_auc)

    # Average OOF predictions across repeats
    oof_preds = oof_sum / oof_count
    return oof_preds, fold_aucs


# ═══════════════════════════════════════════════════════════
# THRESHOLD SELECTION
# ═══════════════════════════════════════════════════════════

def select_threshold(
    y_true: np.ndarray,
    y_proba: np.ndarray,
    min_recall: float = 0.90,
    min_precision: float = 0.50,
) -> tuple[float, str, float, float]:
    """Select classification threshold from OOF predictions.

    Rules:
      1. Highest threshold where recall >= min_recall.
      2. If precision at that threshold < min_precision, fall back to Youden's J.

    Returns:
        (threshold, rule_used, recall_at_t, precision_at_t)
    """
    # Rule 1: scan thresholds from high to low
    thresholds = np.linspace(1.0, 0.0, 1001)
    best_t = None
    best_rec = 0.0
    best_prec = 0.0

    for t in thresholds:
        preds = (y_proba >= t).astype(int)
        if preds.sum() == 0:
            continue
        rec = recall_score(y_true, preds, zero_division=0)
        prec = precision_score(y_true, preds, zero_division=0)
        if rec >= min_recall:
            best_t = t
            best_rec = rec
            best_prec = prec
            break  # Highest threshold meeting recall criterion

    if best_t is not None and best_prec >= min_precision:
        return best_t, "recall_ge_0.90", best_rec, best_prec

    # Rule 2: Youden's J = TPR - FPR (maximised)
    fpr, tpr, roc_thresholds = roc_curve(y_true, y_proba)
    j_scores = tpr - fpr
    best_j_idx = np.argmax(j_scores)
    t_j = float(roc_thresholds[best_j_idx])

    preds_j = (y_proba >= t_j).astype(int)
    rec_j = recall_score(y_true, preds_j, zero_division=0)
    prec_j = precision_score(y_true, preds_j, zero_division=0)

    rule = "youden_J"
    if best_t is not None:
        rule = "youden_J (recall rule had precision < 0.50)"
    return t_j, rule, rec_j, prec_j


# ═══════════════════════════════════════════════════════════
# MAIN TRAINING
# ═══════════════════════════════════════════════════════════

def train_all() -> dict:
    """Run the full training pipeline for all 4 targets.

    Returns:
        model_card dict with all results.
    """
    t_start = time.time()

    # ── Load data ─────────────────────────────────────────
    X, targets, split = data.load_processed()
    train_idx = split["train_indices"]

    X_train = X.iloc[train_idx].reset_index(drop=True)
    targets_train = {k: v.iloc[train_idx].reset_index(drop=True)
                     for k, v in targets.items()}

    # ── Drop excluded features ────────────────────────────
    X_train = X_train[ALL_MODEL_FEATURES].copy()

    # ── Print feature info ────────────────────────────────
    logger.info("=" * 60)
    logger.info("MODEL INPUT FEATURES")
    logger.info("=" * 60)
    logger.info(f"Total model features: {len(ALL_MODEL_FEATURES)}")
    logger.info("")
    logger.info("Numeric (20):")
    for f in NUMERIC_FEATURES:
        logger.info(f"  {f}")
    logger.info("Binary (27):")
    for f in BINARY_FEATURES:
        logger.info(f"  {f}")
    logger.info("Categorical — one-hot in pipeline:")
    for f in ONEHOT_STR_FEATURES + ONEHOT_INT_FEATURES:
        logger.info(f"  {f}")
    logger.info("Categorical — ordinal in pipeline:")
    for f in ORDINAL_STR_FEATURES:
        logger.info(f"  {f}")
    logger.info("")
    logger.info("EXCLUDED features (used_by_model=false):")
    for col in cfg.MODEL_EXCLUDE_COLS:
        logger.info(f"  {col} — fewer than {cfg.MIN_POSITIVES_THRESHOLD} "
                     f"positive cases (min-positives rule)")
    logger.info("=" * 60)

    # ── Verify no leakage ─────────────────────────────────
    for lc in cfg.LEAKAGE_COLS:
        assert lc not in X_train.columns, f"LEAKAGE: {lc} in features!"
    logger.info("Leakage check: PASSED")

    # ── CV setup ──────────────────────────────────────────
    outer_cv = RepeatedStratifiedKFold(
        n_splits=5, n_repeats=3, random_state=SEED
    )
    inner_cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=SEED)

    # ── Storage ───────────────────────────────────────────
    model_card: dict = {
        "seed": SEED,
        "n_train": len(X_train),
        "n_features": len(ALL_MODEL_FEATURES),
        "excluded_features": {
            col: f"<{cfg.MIN_POSITIVES_THRESHOLD} positives"
            for col in cfg.MODEL_EXCLUDE_COLS
        },
        "outer_cv": "RepeatedStratifiedKFold(5, 3)",
        "inner_cv": "StratifiedKFold(3)",
        "calibration": "sigmoid (Platt scaling)",
        "targets": {},
    }
    oof_df = pd.DataFrame(index=range(len(X_train)))

    # ═══════════════════════════════════════════════════════
    # TRAIN EACH TARGET
    # ═══════════════════════════════════════════════════════
    for target_name in TARGET_NAMES:
        logger.info("")
        logger.info("=" * 60)
        logger.info(f"TARGET: {target_name}")
        logger.info("=" * 60)

        y_train = targets_train[target_name]
        n_pos = int(y_train.sum())
        n_neg = len(y_train) - n_pos
        spw = n_neg / n_pos  # scale_pos_weight for XGBoost
        logger.info(f"Positive: {n_pos}, Negative: {n_neg}, "
                     f"scale_pos_weight: {spw:.2f}")

        model_configs = get_model_configs(scale_pos_weight=spw)

        # ── Nested CV for each model type ──────────────────
        results: dict[str, dict] = {}

        for model_name, mcfg in model_configs.items():
            logger.info(f"  Running nested CV for {model_name}...")
            t0 = time.time()

            oof_preds, fold_aucs = nested_cv(
                X_train, y_train,
                mcfg["pipeline"], mcfg["param_grid"],
                outer_cv, inner_cv,
            )

            mean_auc = np.mean(fold_aucs)
            std_auc = np.std(fold_aucs)
            elapsed = time.time() - t0

            results[model_name] = {
                "oof_preds": oof_preds,
                "fold_aucs": fold_aucs,
                "mean_auc": mean_auc,
                "std_auc": std_auc,
            }
            logger.info(
                f"    {model_name}: AUC = {mean_auc:.4f} ± {std_auc:.4f} "
                f"({elapsed:.1f}s)"
            )

        # ── Pick best model ────────────────────────────────
        best_model_name = max(results, key=lambda k: results[k]["mean_auc"])
        best_result = results[best_model_name]
        logger.info(f"  Best model: {best_model_name} "
                     f"(AUC {best_result['mean_auc']:.4f})")

        # ── Save OOF predictions from best model ──────────
        oof_df[f"{target_name}_proba"] = best_result["oof_preds"]
        oof_df[f"{target_name}_true"] = y_train.values

        # ── Threshold selection from OOF ───────────────────
        threshold, rule, rec_at_t, prec_at_t = select_threshold(
            y_train.values, best_result["oof_preds"]
        )
        logger.info(f"  Threshold: {threshold:.4f} (rule: {rule})")
        logger.info(f"  At threshold: recall={rec_at_t:.4f}, "
                     f"precision={prec_at_t:.4f}")

        # ── Final search on full training set ──────────────
        logger.info(f"  Final GridSearchCV ({best_model_name}) on full "
                     f"training set...")
        best_mcfg = model_configs[best_model_name]
        final_search = GridSearchCV(
            best_mcfg["pipeline"],
            best_mcfg["param_grid"],
            cv=inner_cv,
            scoring="roc_auc",
            n_jobs=-1,
            refit=True,
        )
        final_search.fit(X_train, y_train)
        best_params = final_search.best_params_
        logger.info(f"  Best params: {best_params}")
        logger.info(f"  Inner CV AUC: {final_search.best_score_:.4f}")

        # ── Calibrate ──────────────────────────────────────
        logger.info(f"  Calibrating with sigmoid (Platt scaling)...")
        calibrated = CalibratedClassifierCV(
            estimator=final_search.best_estimator_,
            method="sigmoid",
            cv=3,
        )
        calibrated.fit(X_train, y_train)

        # ── Save model ────────────────────────────────────
        model_path = cfg.MODELS_DIR / f"{target_name}_pipeline.joblib"
        joblib.dump(calibrated, model_path)
        logger.info(f"  Saved: {model_path}")

        # ── Record in model card ───────────────────────────
        model_card["targets"][target_name] = {
            "best_model": best_model_name,
            "best_params": {
                k.replace("classifier__", ""): v
                for k, v in best_params.items()
            },
            "cv_results": {
                mn: {
                    "mean_auc": round(r["mean_auc"], 4),
                    "std_auc": round(r["std_auc"], 4),
                }
                for mn, r in results.items()
            },
            "nested_cv_auc_mean": round(best_result["mean_auc"], 4),
            "nested_cv_auc_std": round(best_result["std_auc"], 4),
            "inner_cv_auc": round(final_search.best_score_, 4),
            "threshold": round(threshold, 4),
            "threshold_rule": rule,
            "recall_at_threshold": round(rec_at_t, 4),
            "precision_at_threshold": round(prec_at_t, 4),
            "n_positive": n_pos,
            "n_negative": n_neg,
        }

    # ═══════════════════════════════════════════════════════
    # SAVE OUTPUTS
    # ═══════════════════════════════════════════════════════

    # OOF predictions
    cfg.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    oof_path = cfg.REPORTS_DIR / "oof_predictions.csv"
    oof_df.to_csv(oof_path, index=False)
    logger.info(f"\nOOF predictions saved to: {oof_path}")

    # Model card
    card_path = cfg.MODELS_DIR / "model_card.json"
    with open(card_path, "w") as f:
        json.dump(model_card, f, indent=2, default=str)
    logger.info(f"Model card saved to: {card_path}")

    # Split indices (copy to models/ for teammates)
    split_src = cfg.DATA_PROCESSED_DIR / "split.json"
    split_dst = cfg.MODELS_DIR / "split_indices.json"
    shutil.copy2(split_src, split_dst)
    logger.info(f"Split indices copied to: {split_dst}")

    elapsed_total = time.time() - t_start
    logger.info(f"\nTotal training time: {elapsed_total:.1f}s")

    # ═══════════════════════════════════════════════════════
    # SUMMARY TABLE
    # ═══════════════════════════════════════════════════════
    logger.info("\n" + "=" * 80)
    logger.info("TRAINING SUMMARY")
    logger.info("=" * 80)
    header = (
        f"{'Target':<8} {'Best':<5} {'AUC mean±std':<18} "
        f"{'Threshold':<10} {'Rule':<30} {'Recall':<8} {'Precision':<8}"
    )
    logger.info(header)
    logger.info("-" * 80)
    for tn in TARGET_NAMES:
        t = model_card["targets"][tn]
        logger.info(
            f"{tn:<8} {t['best_model']:<5} "
            f"{t['nested_cv_auc_mean']:.4f}±{t['nested_cv_auc_std']:.4f}"
            f"{'':>4} "
            f"{t['threshold']:<10.4f} {t['threshold_rule']:<30} "
            f"{t['recall_at_threshold']:<8.4f} {t['precision_at_threshold']:<8.4f}"
        )
    logger.info("=" * 80)

    return model_card


# ═══════════════════════════════════════════════════════════
# ENTRY POINT
# ═══════════════════════════════════════════════════════════

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    model_card = train_all()
