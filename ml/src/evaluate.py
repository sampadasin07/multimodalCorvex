"""
evaluate.py — Evaluate trained models on the held-out test set.

Produces:
  - Test-set metrics per target (AUC, PR-AUC, Accuracy, Precision, Recall, F1, Brier)
  - ROC curves, PR curves, calibration plots, confusion matrices
  - Baseline comparisons (majority class, random stratified)
  - Saves evaluation_report.json and all PNGs to reports/
"""
from __future__ import annotations

import json
import logging
import sys
import warnings
from pathlib import Path

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.calibration import calibration_curve
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src import config as cfg, data
from src.train import ALL_MODEL_FEATURES, TARGET_NAMES

warnings.filterwarnings("ignore")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

DISPLAY_NAMES = {
    "Cath": "CAD (Cath)",
    "LAD": "LAD Stenosis",
    "LCX": "LCX Stenosis",
    "RCA": "RCA Stenosis",
}
TARGET_COLORS = {
    "Cath": "#e74c3c",
    "LAD": "#e67e22",
    "LCX": "#2980b9",
    "RCA": "#27ae60",
}


def load_models_and_data():
    """Load trained models, test data, and model card."""
    X, targets, split = data.load_processed()
    test_idx = split["test_indices"]

    X_test = X.iloc[test_idx].reset_index(drop=True)
    X_test = X_test[ALL_MODEL_FEATURES].copy()
    targets_test = {k: v.iloc[test_idx].reset_index(drop=True)
                    for k, v in targets.items()}

    models = {}
    for tn in TARGET_NAMES:
        path = cfg.MODELS_DIR / f"{tn}_pipeline.joblib"
        models[tn] = joblib.load(path)

    with open(cfg.MODELS_DIR / "model_card.json") as f:
        model_card = json.load(f)

    return X_test, targets_test, models, model_card


def compute_metrics(y_true, y_proba, threshold):
    """Compute all metrics for a single target."""
    y_pred = (y_proba >= threshold).astype(int)

    return {
        "roc_auc": round(roc_auc_score(y_true, y_proba), 4),
        "pr_auc": round(average_precision_score(y_true, y_proba), 4),
        "brier": round(brier_score_loss(y_true, y_proba), 4),
        "accuracy": round(accuracy_score(y_true, y_pred), 4),
        "precision": round(precision_score(y_true, y_pred, zero_division=0), 4),
        "recall": round(recall_score(y_true, y_pred, zero_division=0), 4),
        "f1": round(f1_score(y_true, y_pred, zero_division=0), 4),
        "threshold": round(threshold, 4),
        "n_test": len(y_true),
        "n_positive": int(y_true.sum()),
        "n_negative": int(len(y_true) - y_true.sum()),
    }


def compute_baselines(y_true):
    """Compute baseline metrics for comparison."""
    n = len(y_true)
    pos_rate = y_true.mean()

    # Majority class baseline
    majority_pred = np.ones(n) if pos_rate >= 0.5 else np.zeros(n)
    majority = {
        "accuracy": round(accuracy_score(y_true, majority_pred), 4),
        "precision": round(precision_score(y_true, majority_pred, zero_division=0), 4),
        "recall": round(recall_score(y_true, majority_pred, zero_division=0), 4),
        "f1": round(f1_score(y_true, majority_pred, zero_division=0), 4),
        "roc_auc": 0.5,
        "strategy": f"always predict {'1' if pos_rate >= 0.5 else '0'}",
    }

    # Random stratified baseline (expected values)
    random_baseline = {
        "accuracy": round(max(pos_rate, 1 - pos_rate), 4),
        "precision": round(pos_rate, 4),
        "recall": round(pos_rate, 4),
        "f1": round(pos_rate, 4),
        "roc_auc": 0.5,
        "strategy": f"random with p={pos_rate:.2f}",
    }

    return {"majority_class": majority, "random_stratified": random_baseline}


# ═══════════════════════════════════════════════════════════
# PLOT FUNCTIONS
# ═══════════════════════════════════════════════════════════

def plot_roc_curves(all_results, reports_dir):
    """ROC curves for all targets on one plot."""
    fig, ax = plt.subplots(figsize=(8, 7))
    ax.plot([0, 1], [0, 1], "k--", alpha=0.3, label="Random (AUC=0.50)")

    for tn in TARGET_NAMES:
        r = all_results[tn]
        fpr, tpr, _ = roc_curve(r["y_true"], r["y_proba"])
        auc = r["metrics"]["roc_auc"]
        ax.plot(fpr, tpr, color=TARGET_COLORS[tn], lw=2,
                label=f'{DISPLAY_NAMES[tn]} (AUC={auc:.3f})')

    ax.set_xlabel("False Positive Rate", fontsize=12)
    ax.set_ylabel("True Positive Rate", fontsize=12)
    ax.set_title("ROC Curves — Test Set", fontsize=14, fontweight="bold")
    ax.legend(loc="lower right", fontsize=10)
    ax.set_xlim(-0.02, 1.02)
    ax.set_ylim(-0.02, 1.02)
    plt.tight_layout()
    plt.savefig(reports_dir / "roc_curves.png", dpi=150, bbox_inches="tight")
    plt.close()


def plot_pr_curves(all_results, reports_dir):
    """Precision-Recall curves for all targets."""
    fig, ax = plt.subplots(figsize=(8, 7))

    for tn in TARGET_NAMES:
        r = all_results[tn]
        prec, rec, _ = precision_recall_curve(r["y_true"], r["y_proba"])
        pr_auc = r["metrics"]["pr_auc"]
        prevalence = r["y_true"].mean()
        ax.plot(rec, prec, color=TARGET_COLORS[tn], lw=2,
                label=f'{DISPLAY_NAMES[tn]} (PR-AUC={pr_auc:.3f})')

    # Add prevalence lines
    for tn in TARGET_NAMES:
        prevalence = all_results[tn]["y_true"].mean()
        ax.axhline(y=prevalence, color=TARGET_COLORS[tn], linestyle=":",
                   alpha=0.3)

    ax.set_xlabel("Recall", fontsize=12)
    ax.set_ylabel("Precision", fontsize=12)
    ax.set_title("Precision-Recall Curves — Test Set", fontsize=14, fontweight="bold")
    ax.legend(loc="upper right", fontsize=10)
    ax.set_xlim(-0.02, 1.02)
    ax.set_ylim(-0.02, 1.02)
    plt.tight_layout()
    plt.savefig(reports_dir / "pr_curves.png", dpi=150, bbox_inches="tight")
    plt.close()


def plot_calibration(all_results, reports_dir):
    """Calibration (reliability) plots for all targets."""
    fig, axes = plt.subplots(2, 2, figsize=(12, 10))

    for i, tn in enumerate(TARGET_NAMES):
        ax = axes[i // 2][i % 2]
        r = all_results[tn]

        # Calibration curve
        n_bins = min(10, max(3, len(r["y_true"]) // 5))
        try:
            prob_true, prob_pred = calibration_curve(
                r["y_true"], r["y_proba"], n_bins=n_bins, strategy="uniform"
            )
            ax.plot(prob_pred, prob_true, "s-", color=TARGET_COLORS[tn],
                    lw=2, markersize=6, label="Calibrated model")
        except ValueError:
            ax.text(0.5, 0.5, "Insufficient data\nfor calibration curve",
                    ha="center", va="center", transform=ax.transAxes)

        ax.plot([0, 1], [0, 1], "k--", alpha=0.3, label="Perfect calibration")

        # Histogram of predictions
        ax2 = ax.twinx()
        ax2.hist(r["y_proba"], bins=20, alpha=0.15, color=TARGET_COLORS[tn])
        ax2.set_ylabel("Count", fontsize=9, alpha=0.5)

        ax.set_xlabel("Mean predicted probability")
        ax.set_ylabel("Fraction of positives")
        brier = r["metrics"]["brier"]
        ax.set_title(f'{DISPLAY_NAMES[tn]} (Brier={brier:.4f})',
                     fontsize=11, fontweight="bold")
        ax.legend(fontsize=9, loc="upper left")
        ax.set_xlim(-0.02, 1.02)
        ax.set_ylim(-0.02, 1.02)

    plt.suptitle("Calibration Plots — Test Set", fontsize=14, fontweight="bold", y=1.01)
    plt.tight_layout()
    plt.savefig(reports_dir / "calibration_plots.png", dpi=150, bbox_inches="tight")
    plt.close()


def plot_confusion_matrices(all_results, reports_dir):
    """Confusion matrices for all targets."""
    fig, axes = plt.subplots(1, 4, figsize=(20, 4.5))

    for i, tn in enumerate(TARGET_NAMES):
        ax = axes[i]
        r = all_results[tn]
        threshold = r["metrics"]["threshold"]
        y_pred = (r["y_proba"] >= threshold).astype(int)
        cm = confusion_matrix(r["y_true"], y_pred)

        # Plot
        im = ax.imshow(cm, cmap="Blues", aspect="auto")
        ax.set_xticks([0, 1])
        ax.set_yticks([0, 1])
        ax.set_xticklabels(["Normal", "Positive"])
        ax.set_yticklabels(["Normal", "Positive"])
        ax.set_xlabel("Predicted")
        ax.set_ylabel("Actual")

        # Annotate
        for row in range(2):
            for col in range(2):
                val = cm[row, col]
                color = "white" if val > cm.max() / 2 else "black"
                ax.text(col, row, str(val), ha="center", va="center",
                        fontsize=16, fontweight="bold", color=color)

        rec = r["metrics"]["recall"]
        prec = r["metrics"]["precision"]
        ax.set_title(f'{DISPLAY_NAMES[tn]}\nt={threshold:.3f}, R={rec:.2f}, P={prec:.2f}',
                     fontsize=10, fontweight="bold")

    plt.suptitle("Confusion Matrices — Test Set", fontsize=14, fontweight="bold", y=1.05)
    plt.tight_layout()
    plt.savefig(reports_dir / "confusion_matrices.png", dpi=150, bbox_inches="tight")
    plt.close()


# ═══════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════

def evaluate_all() -> dict:
    """Run full evaluation on held-out test set."""
    X_test, targets_test, models, model_card = load_models_and_data()

    logger.info(f"Test set: {len(X_test)} samples, {X_test.shape[1]} features")
    reports = cfg.REPORTS_DIR
    reports.mkdir(parents=True, exist_ok=True)

    all_results: dict[str, dict] = {}
    eval_report: dict = {"test_size": len(X_test), "targets": {}}

    logger.info("")
    logger.info("=" * 90)
    logger.info("TEST SET EVALUATION")
    logger.info("=" * 90)

    for tn in TARGET_NAMES:
        y_true = targets_test[tn].values
        model = models[tn]
        threshold = model_card["targets"][tn]["threshold"]
        best_model = model_card["targets"][tn]["best_model"]
        cv_auc = model_card["targets"][tn]["nested_cv_auc_mean"]

        # Predict
        y_proba = model.predict_proba(X_test)[:, 1]

        # Metrics
        metrics = compute_metrics(y_true, y_proba, threshold)
        baselines = compute_baselines(y_true)

        all_results[tn] = {
            "y_true": y_true,
            "y_proba": y_proba,
            "metrics": metrics,
        }

        eval_report["targets"][tn] = {
            "model": best_model,
            "cv_auc": cv_auc,
            "test_metrics": metrics,
            "baselines": baselines,
        }

        # Log
        logger.info(f"\n{'─' * 40}")
        logger.info(f"  {DISPLAY_NAMES[tn]} ({best_model})")
        logger.info(f"{'─' * 40}")
        logger.info(f"  CV  AUC:   {cv_auc:.4f}")
        logger.info(f"  Test AUC:  {metrics['roc_auc']:.4f}")
        logger.info(f"  PR-AUC:    {metrics['pr_auc']:.4f}")
        logger.info(f"  Brier:     {metrics['brier']:.4f}")
        logger.info(f"  Accuracy:  {metrics['accuracy']:.4f}")
        logger.info(f"  Precision: {metrics['precision']:.4f}")
        logger.info(f"  Recall:    {metrics['recall']:.4f}")
        logger.info(f"  F1:        {metrics['f1']:.4f}")
        logger.info(f"  Threshold: {metrics['threshold']:.4f}")
        logger.info(f"  Baseline (majority): acc={baselines['majority_class']['accuracy']}")

    # ── Summary table ─────────────────────────────────────
    logger.info("\n" + "=" * 90)
    header = (
        f"{'Target':<12} {'Model':<5} {'CV AUC':<9} {'Test AUC':<10} "
        f"{'PR-AUC':<9} {'Brier':<8} {'Acc':<8} {'Prec':<8} {'Rec':<8} {'F1':<8}"
    )
    logger.info(header)
    logger.info("-" * 90)
    for tn in TARGET_NAMES:
        t = eval_report["targets"][tn]
        m = t["test_metrics"]
        logger.info(
            f"{DISPLAY_NAMES[tn]:<12} {t['model']:<5} {t['cv_auc']:<9.4f} "
            f"{m['roc_auc']:<10.4f} {m['pr_auc']:<9.4f} {m['brier']:<8.4f} "
            f"{m['accuracy']:<8.4f} {m['precision']:<8.4f} {m['recall']:<8.4f} "
            f"{m['f1']:<8.4f}"
        )
    logger.info("=" * 90)

    # ── Generate plots ────────────────────────────────────
    logger.info("\nGenerating plots...")
    plot_roc_curves(all_results, reports)
    plot_pr_curves(all_results, reports)
    plot_calibration(all_results, reports)
    plot_confusion_matrices(all_results, reports)
    logger.info("Plots saved to reports/")

    # ── Save evaluation report ────────────────────────────
    report_path = reports / "evaluation_report.json"
    with open(report_path, "w") as f:
        json.dump(eval_report, f, indent=2, default=str)
    logger.info(f"Evaluation report saved to: {report_path}")

    return eval_report


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    evaluate_all()
