import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import shap

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "ml"))
from src import config as cfg                                   # noqa: E402
from src import predict as ml_predict                           # noqa: E402
from src.train import ALL_MODEL_FEATURES, TARGET_NAMES          # noqa: E402
from src.explain import extract_inner_model, get_transformed_feature_names  # noqa: E402

DISPLAY = {"Cath": "CAD", "LAD": "LAD", "LCX": "LCX", "RCA": "RCA"}
_cache: dict = {}


def _dense(x):
    return x.toarray() if hasattr(x, "toarray") else np.asarray(x)


def build():
    """Build one SHAP explainer per target, once (not on every request)."""
    if _cache:
        return
    ml_predict._load_models()

    # Training patients, used as the "reference" data for the logistic regression
    feats = pd.read_csv(cfg.DATA_PROCESSED_DIR / "features.csv")
    with open(cfg.DATA_PROCESSED_DIR / "split.json") as f:
        train_idx = json.load(f)["train_indices"]
    train_X = feats.iloc[train_idx][ALL_MODEL_FEATURES]

    for tn in TARGET_NAMES:
        pre, clf = extract_inner_model(ml_predict._models[tn])
        kind = ml_predict._model_card["targets"][tn]["best_model"]
        if kind == "RF":
            expl = shap.TreeExplainer(clf)
        else:  # "LR" (this is the RCA fix)
            expl = shap.LinearExplainer(clf, _dense(pre.transform(train_X)))
        _cache[tn] = (pre, expl)


def explain(feature_values: dict, top_n: int = 15) -> dict:
    """Return SHAP contributions per target for one patient."""
    build()
    names = get_transformed_feature_names()
    df = pd.DataFrame([feature_values])[ALL_MODEL_FEATURES]
    out = {}
    for tn in TARGET_NAMES:
        pre, expl = _cache[tn]
        raw = expl.shap_values(_dense(pre.transform(df)))
        sv = np.asarray(raw[1] if isinstance(raw, list) else raw)
        if sv.ndim == 3:
            sv = sv[:, :, 1]
        row = sv[0]
        order = np.argsort(np.abs(row))[::-1][:top_n]
        out[DISPLAY[tn]] = [
            {
                "feature": names[i],
                "shap_value": round(float(row[i]), 4),
                "direction": "risk" if row[i] > 0 else "protective",
            }
            for i in order
        ]
    return out