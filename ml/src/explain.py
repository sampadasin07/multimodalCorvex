"""
explain.py — Generate SHAP and LIME explanations for trained models.

Produces per target:
  - SHAP global importance bar plot (mean |SHAP|)
  - SHAP beeswarm plot
  - SHAP waterfall for sample patients (high-risk, low-risk, borderline)
  - Model-native feature importance (RF impurity / LR coefficients)
  - LIME explanations for high-risk and low-risk patients
  - explainability_summary.json
"""
from __future__ import annotations

import json
import logging
import sys
import warnings
from pathlib import Path

import joblib
import lime
import lime.lime_tabular
import matplotlib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap

matplotlib.use("Agg")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src import config as cfg, data
from src.train import (
    ALL_MODEL_FEATURES,
    BINARY_FEATURES,
    NUMERIC_FEATURES,
    ONEHOT_INT_FEATURES,
    ONEHOT_STR_FEATURES,
    ORDINAL_STR_FEATURES,
    TARGET_NAMES,
)

warnings.filterwarnings("ignore")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

DISPLAY_NAMES = {
    "Cath": "CAD (Cath)", "LAD": "LAD Stenosis",
    "LCX": "LCX Stenosis", "RCA": "RCA Stenosis",
}
TARGET_COLORS = {
    "Cath": "#e74c3c", "LAD": "#e67e22",
    "LCX": "#2980b9", "RCA": "#27ae60",
}


def get_transformed_feature_names() -> list[str]:
    """Return feature names after ColumnTransformer encoding."""
    names = list(NUMERIC_FEATURES)
    names += list(BINARY_FEATURES)
    names += ["BBB_LBBB", "BBB_RBBB"]
    names += ["VHD_ordinal"]
    names += ["RWMA_1", "RWMA_2", "RWMA_3", "RWMA_4"]
    return names


def extract_inner_model(calibrated_model):
    """Extract preprocessor and classifier from CalibratedClassifierCV."""
    inner = calibrated_model.calibrated_classifiers_[0].estimator
    return inner.named_steps["preprocessor"], inner.named_steps["classifier"]


def get_shap_values(classifier, X_transformed, model_type):
    """Compute SHAP values as a numpy array (n_samples, n_features).

    Returns (shap_values, base_value) for the positive class.
    """
    if model_type == "RF":
        explainer = shap.TreeExplainer(classifier)
        sv = explainer.shap_values(X_transformed)
        # Handle different SHAP output formats:
        # - list of [class0, class1] arrays
        # - 3D array (n_samples, n_features, n_classes)
        # - 2D array (n_samples, n_features) — single output
        sv = np.asarray(sv)
        if isinstance(sv, np.ndarray) and sv.ndim == 3:
            sv = sv[:, :, 1]  # positive class
        elif isinstance(sv, list):
            sv = np.asarray(sv[1])
        bv = explainer.expected_value
        bv = np.asarray(bv)
        if bv.ndim > 0 and bv.size > 1:
            bv = float(bv.flat[1])
        else:
            bv = float(bv)
    elif model_type == "LR":
        explainer = shap.LinearExplainer(classifier, X_transformed)
        sv = explainer.shap_values(X_transformed)
        sv = np.asarray(sv)
        if sv.ndim == 3:
            sv = sv[:, :, 1]
        bv = explainer.expected_value
        bv = np.asarray(bv)
        bv = float(bv.flat[0])
    else:
        raise ValueError(f"Unknown model type: {model_type}")
    # Ensure dense 2D array
    if sv.ndim == 1:
        sv = sv.reshape(1, -1)
    return sv, float(bv)


# ═══════════════════════════════════════════════════════════
# CUSTOM PLOTS (robust, no shap.plots dependency issues)
# ═══════════════════════════════════════════════════════════

def plot_shap_bar(sv, feature_names, target_name, reports_dir):
    """Bar plot of mean |SHAP| values — top 20 features."""
    mean_abs = np.abs(sv).mean(axis=0).flatten()
    idx_sorted = np.argsort(mean_abs)[-20:].tolist()
    top_names = [feature_names[i] for i in idx_sorted]
    top_vals = [float(mean_abs[i]) for i in idx_sorted]

    fig, ax = plt.subplots(figsize=(10, 8))
    colors = ["#e74c3c" if v > np.median(top_vals) else "#3498db" for v in top_vals]
    ax.barh(range(len(top_names)), top_vals, color=colors,
            edgecolor="black", linewidth=0.3)
    ax.set_yticks(range(len(top_names)))
    ax.set_yticklabels(top_names, fontsize=9)
    ax.set_xlabel("mean |SHAP value|", fontsize=11)
    ax.set_title(f"SHAP Feature Importance — {DISPLAY_NAMES[target_name]}",
                 fontsize=13, fontweight="bold")
    plt.tight_layout()
    fig.savefig(reports_dir / f"shap_bar_{target_name}.png",
                dpi=150, bbox_inches="tight")
    plt.close(fig)


def plot_shap_beeswarm(sv, X_data, feature_names, target_name, reports_dir):
    """Beeswarm plot showing SHAP value distribution colored by feature value."""
    mean_abs = np.abs(sv).mean(axis=0).flatten()
    idx_sorted = np.argsort(mean_abs)[-20:].tolist()  # top 20

    fig, ax = plt.subplots(figsize=(10, 8))
    for rank, feat_idx in enumerate(idx_sorted):
        shap_col = sv[:, feat_idx]
        feat_col = X_data[:, feat_idx]

        # Normalize feature values to [0, 1] for color mapping
        fmin, fmax = feat_col.min(), feat_col.max()
        if fmax > fmin:
            normed = (feat_col - fmin) / (fmax - fmin)
        else:
            normed = np.full_like(feat_col, 0.5)

        jitter = np.random.default_rng(42).normal(0, 0.12, len(shap_col))
        ax.scatter(
            shap_col, rank + jitter,
            c=normed, cmap="RdBu_r", s=6, alpha=0.6,
            edgecolors="none", vmin=0, vmax=1,
        )

    ax.set_yticks(range(len(idx_sorted)))
    ax.set_yticklabels([feature_names[i] for i in idx_sorted], fontsize=9)
    ax.axvline(x=0, color="gray", linewidth=0.5, linestyle="--")
    ax.set_xlabel("SHAP value (impact on positive class)", fontsize=11)
    ax.set_title(f"SHAP Beeswarm — {DISPLAY_NAMES[target_name]}",
                 fontsize=13, fontweight="bold")

    sm = plt.cm.ScalarMappable(cmap="RdBu_r", norm=plt.Normalize(0, 1))
    sm.set_array([])
    cbar = plt.colorbar(sm, ax=ax, pad=0.02, aspect=40)
    cbar.set_label("Feature value (normalized)", fontsize=9)
    cbar.set_ticks([0, 1])
    cbar.set_ticklabels(["Low", "High"])

    plt.tight_layout()
    fig.savefig(reports_dir / f"shap_beeswarm_{target_name}.png",
                dpi=150, bbox_inches="tight")
    plt.close(fig)


def plot_shap_waterfall(sv_row, base_value, feature_names, X_row,
                        target_name, patient_label, reports_dir):
    """Waterfall plot for a single patient — top 15 contributing features."""
    n_show = 15
    idx_sorted = np.argsort(np.abs(sv_row))[::-1][:n_show]
    idx_sorted = idx_sorted[::-1]  # smallest at top

    names = [feature_names[i] for i in idx_sorted]
    vals = sv_row[idx_sorted]
    feat_vals = X_row[idx_sorted]

    fig, ax = plt.subplots(figsize=(10, 7))
    colors = ["#e74c3c" if v > 0 else "#2980b9" for v in vals]

    # Compute cumulative positions
    cumulative = base_value
    bottoms = []
    for v in vals:
        bottoms.append(cumulative)
        cumulative += v

    ax.barh(range(len(names)), vals, left=bottoms, color=colors,
            edgecolor="black", linewidth=0.3, height=0.6)

    # Labels
    labels = [f"{names[i]} = {feat_vals[i]:.2g}" for i in range(len(names))]
    ax.set_yticks(range(len(names)))
    ax.set_yticklabels(labels, fontsize=8)
    ax.axvline(x=base_value, color="gray", linewidth=0.8, linestyle="--",
               label=f"Base: {base_value:.3f}")
    ax.axvline(x=cumulative, color="black", linewidth=1.2,
               label=f"Output: {cumulative:.3f}")

    display = DISPLAY_NAMES[target_name]
    ax.set_title(f"SHAP Waterfall — {display} ({patient_label})",
                 fontsize=12, fontweight="bold")
    ax.set_xlabel("Model output (log-odds / raw score)")
    ax.legend(fontsize=9)
    plt.tight_layout()
    fig.savefig(reports_dir / f"shap_waterfall_{target_name}_{patient_label}.png",
                dpi=150, bbox_inches="tight")
    plt.close(fig)


def plot_native_importance(classifier, feature_names, target_name,
                           model_type, reports_dir):
    """Model-native feature importance (RF impurity / LR |coefficients|)."""
    if model_type == "RF":
        importances = classifier.feature_importances_
        xlabel = "Mean Decrease in Impurity"
    elif model_type == "LR":
        importances = np.abs(classifier.coef_[0])
        xlabel = "|Coefficient|"
    else:
        return

    idx_sorted = np.argsort(importances)[-20:].tolist()
    top_names = [feature_names[i] for i in idx_sorted]
    top_vals = [float(importances[i]) for i in idx_sorted]

    fig, ax = plt.subplots(figsize=(10, 7))
    colors = ["#e74c3c" if v > np.median(top_vals) else "#3498db" for v in top_vals]
    ax.barh(range(len(top_names)), top_vals, color=colors,
            edgecolor="black", linewidth=0.3)
    ax.set_yticks(range(len(top_names)))
    ax.set_yticklabels(top_names, fontsize=9)
    ax.set_xlabel(xlabel, fontsize=11)
    ax.set_title(f"{model_type} Feature Importance — {DISPLAY_NAMES[target_name]}",
                 fontsize=13, fontweight="bold")
    plt.tight_layout()
    fig.savefig(reports_dir / f"importance_native_{target_name}.png",
                dpi=150, bbox_inches="tight")
    plt.close(fig)


def run_lime(model, X_train_raw, X_sample, target_name, label, reports_dir):
    """LIME explanation for one patient."""
    # LIME needs all-numeric input. Encode string categoricals.
    X_lime = X_train_raw.copy()
    sample_lime = X_sample.copy()

    # Encode BBB: N=0, LBBB=1, RBBB=2
    bbb_map = {"N": 0, "LBBB": 1, "RBBB": 2}
    if "BBB" in X_lime.columns:
        X_lime["BBB"] = X_lime["BBB"].map(bbb_map).astype(float)
        sample_lime["BBB"] = bbb_map.get(sample_lime["BBB"], 0)

    # Encode VHD: N=0, mild=1, Moderate=2, Severe=3
    vhd_map = {v: i for i, v in enumerate(cfg.VHD_ORDER)}
    if "VHD" in X_lime.columns:
        X_lime["VHD"] = X_lime["VHD"].map(vhd_map).astype(float)
        sample_lime["VHD"] = vhd_map.get(sample_lime["VHD"], 0)

    cat_indices = [
        i for i, col in enumerate(X_lime.columns)
        if col in BINARY_FEATURES or col == "BBB" or col == "VHD"
        or col in ONEHOT_INT_FEATURES
    ]
    explainer = lime.lime_tabular.LimeTabularExplainer(
        X_lime.values.astype(float),
        feature_names=list(X_lime.columns),
        class_names=["Normal", "Positive"],
        categorical_features=cat_indices,
        mode="classification",
        random_state=cfg.RANDOM_SEED,
    )

    # Wrapper to encode strings before model predict
    def predict_fn(X_arr):
        df = pd.DataFrame(X_arr, columns=X_lime.columns)
        # Decode back for model
        inv_bbb = {0: "N", 1: "LBBB", 2: "RBBB"}
        inv_vhd = {i: v for i, v in enumerate(cfg.VHD_ORDER)}
        if "BBB" in df.columns:
            df["BBB"] = df["BBB"].round().astype(int).map(inv_bbb).fillna("N")
        if "VHD" in df.columns:
            df["VHD"] = df["VHD"].round().astype(int).map(inv_vhd).fillna("N")
        return model.predict_proba(df)

    exp = explainer.explain_instance(
        sample_lime.values.astype(float), predict_fn,
        num_features=15,
    )
    # Use the label that was explained (may be 0 or 1)
    lbl = exp.available_labels()[0]
    fig = exp.as_pyplot_figure(label=lbl)
    fig.set_size_inches(10, 6)
    plt.title(f"LIME — {DISPLAY_NAMES[target_name]} ({label})",
              fontsize=13, fontweight="bold")
    plt.tight_layout()
    fig.savefig(reports_dir / f"lime_{target_name}_{label}.png",
                dpi=150, bbox_inches="tight")
    plt.close(fig)


# ═══════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════

def explain_all():
    """Run full explainability analysis."""
    logger.info("Loading data and models...")
    X, targets, split = data.load_processed()
    train_idx, test_idx = split["train_indices"], split["test_indices"]

    X_train = X.iloc[train_idx].reset_index(drop=True)[ALL_MODEL_FEATURES].copy()
    X_test = X.iloc[test_idx].reset_index(drop=True)[ALL_MODEL_FEATURES].copy()

    with open(cfg.MODELS_DIR / "model_card.json") as f:
        model_card = json.load(f)

    feature_names = get_transformed_feature_names()
    reports = cfg.REPORTS_DIR
    reports.mkdir(parents=True, exist_ok=True)

    logger.info(f"50 model features, 54 encoded dimensions")
    logger.info(f"Excluded: {cfg.MODEL_EXCLUDE_COLS}")

    summary: dict = {}

    for tn in TARGET_NAMES:
        logger.info(f"\n{'=' * 60}")
        logger.info(f"EXPLAINING: {DISPLAY_NAMES[tn]}")
        logger.info("=" * 60)

        model_type = model_card["targets"][tn]["best_model"]
        cal_model = joblib.load(cfg.MODELS_DIR / f"{tn}_pipeline.joblib")
        preprocessor, classifier = extract_inner_model(cal_model)

        X_train_t = preprocessor.transform(X_train)
        X_test_t = preprocessor.transform(X_test)

        if isinstance(X_train_t, pd.DataFrame):
            X_train_t = X_train_t.values
        if isinstance(X_test_t, pd.DataFrame):
            X_test_t = X_test_t.values

        # ── SHAP on training set (global importance) ──────
        logger.info(f"  Computing SHAP values ({model_type})...")
        sv_train, bv = get_shap_values(classifier, X_train_t, model_type)

        plot_shap_bar(sv_train, feature_names, tn, reports)
        logger.info("  Saved SHAP bar plot")

        plot_shap_beeswarm(sv_train, X_train_t, feature_names, tn, reports)
        logger.info("  Saved SHAP beeswarm plot")

        # Top features
        mean_abs = np.abs(sv_train).mean(axis=0).flatten()
        top_idx = np.argsort(mean_abs)[::-1][:10].tolist()
        top_features = [(feature_names[i], round(float(mean_abs[i]), 4))
                        for i in top_idx]
        logger.info(f"  Top 10: {top_features}")

        summary[tn] = {
            "model_type": model_type,
            "top_10_shap": [{"feature": n, "mean_abs_shap": v}
                            for n, v in top_features],
        }

        # ── SHAP waterfall on test patients ───────────────
        logger.info("  Computing SHAP waterfalls...")
        y_proba_test = cal_model.predict_proba(X_test)[:, 1]
        sv_test, bv_test = get_shap_values(classifier, X_test_t, model_type)

        high_idx = int(np.argmax(y_proba_test))
        low_idx = int(np.argmin(y_proba_test))
        mid_idx = int(np.argsort(np.abs(y_proba_test - 0.5))[0])

        for idx, label in [(high_idx, "high_risk"),
                           (low_idx, "low_risk"),
                           (mid_idx, "borderline")]:
            plot_shap_waterfall(
                sv_test[idx], bv_test, feature_names, X_test_t[idx],
                tn, label, reports
            )
        logger.info("  Saved waterfall plots (high/low/borderline)")

        # ── Native importance ─────────────────────────────
        plot_native_importance(classifier, feature_names, tn, model_type, reports)
        logger.info("  Saved native importance plot")

        # ── LIME ──────────────────────────────────────────
        logger.info("  Running LIME...")
        for idx, label in [(high_idx, "high_risk"), (low_idx, "low_risk")]:
            run_lime(cal_model, X_train, X_test.iloc[idx], tn, label, reports)
        logger.info("  Saved LIME plots")

    # ── Save summary ──────────────────────────────────────
    out = reports / "explainability_summary.json"
    with open(out, "w") as f:
        json.dump(summary, f, indent=2)
    logger.info(f"\nSummary saved to: {out}")

    # ── Cross-target comparison ───────────────────────────
    logger.info("\n" + "=" * 60)
    logger.info("TOP 5 SHAP FEATURES PER TARGET")
    logger.info("=" * 60)
    for tn in TARGET_NAMES:
        top5 = summary[tn]["top_10_shap"][:5]
        s = ", ".join(f"{f['feature']}({f['mean_abs_shap']:.3f})" for f in top5)
        logger.info(f"  {DISPLAY_NAMES[tn]}: {s}")

    logger.info("\nDone.")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    explain_all()
