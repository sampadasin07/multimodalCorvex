import json
import sys
from pathlib import Path

# Make the ml/ folder importable (the ML code does "from src import ...")
PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT / "ml"))

from src.predict import predict_patient, _load_models  # noqa: E402
from src import config as cfg                           # noqa: E402
from . import explainer                                 # noqa: E402

# ---- Load static files once ----
with open(cfg.MODELS_DIR / "feature_schema.json", encoding="utf-8") as f:
    SCHEMA = json.load(f)
with open(cfg.MODELS_DIR / "sample_patients.json", encoding="utf-8") as f:
    SAMPLES = json.load(f)
with open(cfg.MODELS_DIR / "model_card.json", encoding="utf-8") as f:
    MODEL_CARD = json.load(f)

MODEL_FEATURES = [k for k, v in SCHEMA.items() if v["used_by_model"]]
INTEGER_LIKE = {"Region RWMA", "Function Class"}


def warmup():
    """Load models + SHAP explainers and run one prediction, so requests are fast."""
    _load_models()
    explainer.build()
    sample = {k: v for k, v in SAMPLES[0].items() if not k.startswith("_")}
    run(sample, include_shap=True)


def clean_input(raw: dict):
    """Check the incoming data. Returns (cleaned, errors, warnings)."""
    cleaned, errors, warnings = {}, [], []
    
    if raw.get("Age") in (None, ""):
        errors.append("'Age' is a fundamental baseline prior and cannot be missing.")
    if raw.get("Sex") in (None, ""):
        errors.append("'Sex' is a fundamental baseline prior and cannot be missing.")

    # Validate BMI (or derive from Weight & Length if BMI is missing)
    if raw.get("BMI") in (None, ""):
        if raw.get("Weight") not in (None, "") and raw.get("Length") not in (None, ""):
            try:
                w = float(raw["Weight"])
                l = float(raw["Length"]) / 100.0
                if l > 0:
                    cleaned["BMI"] = round(w / (l * l), 1)
                else:
                    errors.append("'Length' (Height) must be greater than 0.")
            except (ValueError, TypeError):
                errors.append("Invalid 'Weight' or 'Length' value to compute BMI.")
        else:
            errors.append("'BMI' (or both 'Weight' and 'Length') is required and cannot be missing.")

    if raw.get("Atypical") in (None, ""):
        errors.append("'Atypical' (Chest Pain) is highly predictive and cannot be missing.")
    if raw.get("ESR") in (None, ""):
        errors.append("'ESR' is highly predictive and cannot be missing.")
    if raw.get("TG") in (None, ""):
        errors.append("'TG' (Triglycerides) is highly predictive and cannot be missing.")

    for key, value in raw.items():
        if key.startswith("_"):
            continue
        if key in cfg.DROP_COLS:        # Exertional CP, Weight, Length
            continue
        meta = SCHEMA.get(key)
        if meta is None:
            errors.append(f"Unknown feature: '{key}'")
            continue

        # Text categories (BBB, VHD)
        if meta["type"] == "categorical":
            if value not in meta["categories"]:
                errors.append(f"'{key}' must be one of {meta['categories']}, got '{value}'")
                continue
            cleaned[key] = value
            continue

        # Text values the ML code already understands
        if isinstance(value, str) and value in ("Male", "Fmale", "Y", "N"):
            cleaned[key] = value
            continue

        # Everything else must be a number
        try:
            num = float(value)
        except (TypeError, ValueError):
            errors.append(f"'{key}' must be a number, got '{value}'")
            continue
        if meta["type"] == "binary" or key in INTEGER_LIKE:
            num = int(num)
        cleaned[key] = num
    return cleaned, errors, warnings


def to_raw_name(encoded: str) -> str:
    """Convert encoded model feature names back to real feature names (Problem B fix)."""
    if encoded.startswith("RWMA_"):
        return "Region RWMA"
    if encoded == "VHD_ordinal":
        return "VHD"
    if encoded.startswith("BBB_"):
        return "BBB"
    return encoded


def enrich_shap(shap_contribs: dict, feature_values: dict) -> dict:
    """Turn raw SHAP output into dashboard-friendly rows."""
    out = {}
    for target, items in shap_contribs.items():
        merged = {}
        for it in items:
            raw = to_raw_name(it["feature"])
            merged[raw] = merged.get(raw, 0.0) + it["shap_value"]
        total = sum(abs(v) for v in merged.values()) or 1.0
        rows = []
        for raw, sv in sorted(merged.items(), key=lambda kv: -abs(kv[1]))[:8]:
            meta = SCHEMA.get(raw, {})
            value = feature_values.get(raw)
            normal = meta.get("normal_range")
            abnormal = None
            if normal and isinstance(value, (int, float)):
                abnormal = value < normal[0] or value > normal[1]
            rows.append({
                "feature": raw,
                "label": meta.get("label", raw),
                "value": value,
                "unit": meta.get("unit", ""),
                "normal_range": normal,
                "abnormal": abnormal,
                "shap_value": round(sv, 4),
                "share": round(abs(sv) / total, 4),   # relative contribution, 0..1
                "direction": "risk" if sv > 0 else "protective",
            })
        out[target] = rows
    return out


def run(cleaned: dict, include_shap: bool = True) -> dict:
    result = predict_patient(cleaned, include_shap=False)   # SHAP is done by explainer.py
    response = {
        "overall_risk": result["overall_risk"],
        "predictions": result["predictions"],
        "feature_values": result["feature_values"],
        "defaults_used": [k for k in MODEL_FEATURES if k not in cleaned],
    }
    if include_shap:
        response["explanations"] = enrich_shap(
            explainer.explain(result["feature_values"]), result["feature_values"]
        )
    return response