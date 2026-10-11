"""
predict.py — Inference API for cardiac risk prediction.

Provides predict_patient() for Person 2's backend to call.
Loads calibrated models, applies thresholds, returns structured results
including risk levels, probabilities, and SHAP explanations.
"""
from __future__ import annotations

import json
import logging
import sys
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import shap

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src import config as cfg, data
from src.train import ALL_MODEL_FEATURES, TARGET_NAMES

logger = logging.getLogger(__name__)

# ── Lazy-loaded globals ──────────────────────────────────
_models: dict | None = None
_model_card: dict | None = None
_schema: dict | None = None
_shap_explainers: dict | None = None


def _load_models():
    """Load all models and metadata (lazy, cached)."""
    global _models, _model_card, _schema
    if _models is not None:
        return

    _models = {}
    for tn in TARGET_NAMES:
        path = cfg.MODELS_DIR / f"{tn}_pipeline.joblib"
        _models[tn] = joblib.load(path)

    with open(cfg.MODELS_DIR / "model_card.json") as f:
        _model_card = json.load(f)

    with open(cfg.MODELS_DIR / "feature_schema.json") as f:
        _schema = json.load(f)

    logger.info("Models loaded.")


def _get_risk_level(prob: float, threshold: float | None = None) -> str:
    """Map probability to risk level string based on threshold if available."""
    if threshold is not None:
        if prob >= threshold:
            margin = (1.0 - threshold) / 2
            return "high" if prob >= threshold + margin else "moderate"
        else:
            return "low"
            
    for level, (lo, hi) in cfg.RISK_BANDS.items():
        if lo <= prob < hi:
            return level
    return "high"


def _get_shap_explanation(model, patient_df: pd.DataFrame, target: str) -> list[dict]:
    """Compute SHAP feature contributions for a single patient."""
    from src.explain import extract_inner_model, get_transformed_feature_names, get_shap_values

    preprocessor, classifier = extract_inner_model(model)
    feature_names = get_transformed_feature_names()
    X_t = preprocessor.transform(patient_df)
    if hasattr(X_t, 'toarray'):
        X_t = X_t.toarray()

    sv, bv = get_shap_values(classifier, np.asarray(X_t),
                              _model_card["targets"][target]["best_model"])

    # Return top 10 contributing features
    sv_row = sv[0]
    idx_sorted = np.argsort(np.abs(sv_row))[::-1][:10].tolist()
    contributions = []
    for i in idx_sorted:
        contributions.append({
            "feature": feature_names[i],
            "shap_value": round(float(sv_row[i]), 4),
            "direction": "risk" if sv_row[i] > 0 else "protective",
        })
    return contributions


def predict_patient(
    patient_data: dict[str, Any],
    include_shap: bool = True,
) -> dict[str, Any]:
    """Predict cardiovascular risk for a single patient.

    This is the main API function for Person 2's backend.

    Args:
        patient_data: Dict of feature_name -> value for all 50 input features.
            Missing features will use defaults from feature_schema.json.
        include_shap: If True, include SHAP feature contributions.

    Returns:
        {
            "predictions": {
                "CAD": {"probability": 0.82, "risk_level": "high", "positive": true, ...},
                "LAD": {...}, "LCX": {...}, "RCA": {...}
            },
            "overall_risk": "high",
            "feature_values": {...},  # actual values used (with defaults filled)
            "shap_contributions": {...}  # if include_shap=True
        }
    """
    _load_models()

    # ── Fill missing features with defaults ────────────────
    filled = {}
    for feat_name, meta in _schema.items():
        if feat_name in patient_data:
            filled[feat_name] = patient_data[feat_name]
        else:
            filled[feat_name] = meta["default"]
            logger.debug(f"Using default for {feat_name}: {meta['default']}")

    # ── Clean raw inputs (mirror data.py's clean logic) ────
    # Sex: Male/Fmale → 1/0
    if isinstance(filled.get("Sex"), str):
        filled["Sex"] = cfg.SEX_MAP.get(filled["Sex"], 0)

    # Y/N columns → 1/0
    for col in cfg.YN_COLS:
        if col in filled and isinstance(filled[col], str):
            filled[col] = 1 if filled[col] == "Y" else 0

    # BBB and VHD stay as strings (pipeline handles encoding)
    # Region RWMA and Function Class stay as int

    # ── Build DataFrame with model features only ──────────
    patient_df = pd.DataFrame([filled])[ALL_MODEL_FEATURES]

    # ── Predict for each target ───────────────────────────
    predictions = {}
    display_names = {"Cath": "CAD", "LAD": "LAD", "LCX": "LCX", "RCA": "RCA"}

    for tn in TARGET_NAMES:
        model = _models[tn]
        threshold = _model_card["targets"][tn]["threshold"]

        prob = float(model.predict_proba(patient_df)[0, 1])
        risk_level = _get_risk_level(prob, threshold=threshold)
        positive = prob >= threshold

        predictions[display_names[tn]] = {
            "probability": round(prob, 4),
            "risk_level": risk_level,
            "positive": bool(positive),
            "threshold": threshold,
            "model": _model_card["targets"][tn]["best_model"],
        }

    # ── Overall risk = max probability across targets ─────
    overall_prob = predictions["CAD"]["probability"]
    overall_threshold = predictions["CAD"]["threshold"]
    overall_risk = _get_risk_level(overall_prob, threshold=overall_threshold)

    result: dict[str, Any] = {
        "predictions": predictions,
        "overall_risk": overall_risk,
        "feature_values": filled,
    }

    # ── SHAP contributions ────────────────────────────────
    if include_shap:
        shap_contribs = {}
        for tn in TARGET_NAMES:
            shap_contribs[display_names[tn]] = _get_shap_explanation(
                _models[tn], patient_df, tn
            )
        result["shap_contributions"] = shap_contribs

    return result


def predict_from_json(json_path: str | Path, include_shap: bool = True) -> dict:
    """Load patient data from JSON file and predict."""
    with open(json_path) as f:
        patient_data = json.load(f)
    return predict_patient(patient_data, include_shap=include_shap)


# ═══════════════════════════════════════════════════════════
# CLI / DEMO
# ═══════════════════════════════════════════════════════════

if __name__ == "__main__":
    import warnings
    warnings.filterwarnings("ignore")
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    sys.stdout.reconfigure(encoding="utf-8")

    # Load sample patients
    sample_path = cfg.MODELS_DIR / "sample_patients.json"
    if not sample_path.exists():
        print(f"No sample_patients.json found at {sample_path}")
        print("Run with a JSON file: python -m src.predict <path_to_patient.json>")
        sys.exit(1)

    with open(sample_path) as f:
        samples = json.load(f)

    for sample in samples:
        name = sample.get("_label", "Patient")
        print(f"\n{'=' * 60}")
        print(f"  {name}")
        print(f"{'=' * 60}")

        # Remove metadata keys
        patient_data = {k: v for k, v in sample.items() if not k.startswith("_")}
        result = predict_patient(patient_data, include_shap=True)

        print(f"  Overall Risk: {result['overall_risk'].upper()}")
        print()
        for target, pred in result["predictions"].items():
            status = "POSITIVE" if pred["positive"] else "negative"
            print(f"  {target:>4}: prob={pred['probability']:.3f}  "
                  f"risk={pred['risk_level']:<8} [{status}]")

        if "shap_contributions" in result:
            print(f"\n  Top risk drivers (CAD):")
            for c in result["shap_contributions"]["CAD"][:5]:
                arrow = "+" if c["direction"] == "risk" else "-"
                print(f"    {arrow} {c['feature']}: {c['shap_value']:+.4f}")

    # Save full result of last patient
    out_path = cfg.REPORTS_DIR / "sample_prediction.json"
    with open(out_path, "w") as f:
        json.dump(result, f, indent=2, default=str)
    print(f"\nFull result saved to: {out_path}")
