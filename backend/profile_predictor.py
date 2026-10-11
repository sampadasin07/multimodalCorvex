import time

import pandas as pd

from app import predictor
from src import predict as mp
from src.train import ALL_MODEL_FEATURES, TARGET_NAMES

predictor.warmup()
sample = {k: v for k, v in predictor.SAMPLES[0].items() if not k.startswith("_")}
cleaned, errors, _ = predictor.clean_input(sample)
print("input errors:", errors)

t = time.perf_counter()
res = mp.predict_patient(cleaned, include_shap=False)
print("predict_patient (no shap): %.0f ms" % ((time.perf_counter() - t) * 1000))

df = pd.DataFrame([res["feature_values"]])[ALL_MODEL_FEATURES]
for _ in range(2):
    for tn in TARGET_NAMES:
        t = time.perf_counter()
        mp._models[tn].predict_proba(df)
        print(tn, "predict_proba: %.0f ms" % ((time.perf_counter() - t) * 1000))

t = time.perf_counter()
predictor.explainer.explain(res["feature_values"])
print("SHAP (all 4 targets): %.0f ms" % ((time.perf_counter() - t) * 1000))