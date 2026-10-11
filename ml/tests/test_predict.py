"""
test_predict.py — Tests for the inference API.

Tests:
  - predict output shape matches spec
  - missing inputs handled gracefully (defaults filled)
  - predictions are deterministic
  - risk levels are valid
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src import config as cfg
from src.predict import predict_patient


# ── Fixtures ──────────────────────────────────────────────

@pytest.fixture(scope="module")
def sample_patients():
    path = cfg.MODELS_DIR / "sample_patients.json"
    with open(path) as f:
        patients = json.load(f)
    return patients


@pytest.fixture(scope="module")
def full_patient(sample_patients):
    """First patient (all features provided)."""
    return {k: v for k, v in sample_patients[0].items() if not k.startswith("_")}


@pytest.fixture(scope="module")
def sparse_patient(sample_patients):
    """Last patient (many features missing)."""
    return {k: v for k, v in sample_patients[-1].items() if not k.startswith("_")}


# ── Tests ─────────────────────────────────────────────────

class TestPredictOutputShape:
    """Verify output matches the documented API shape."""

    def test_top_level_keys(self, full_patient):
        result = predict_patient(full_patient, include_shap=False)
        assert "predictions" in result
        assert "overall_risk" in result
        assert "feature_values" in result

    def test_prediction_targets(self, full_patient):
        result = predict_patient(full_patient, include_shap=False)
        targets = set(result["predictions"].keys())
        assert targets == {"CAD", "LAD", "LCX", "RCA"}

    def test_prediction_fields(self, full_patient):
        result = predict_patient(full_patient, include_shap=False)
        for target, pred in result["predictions"].items():
            assert "probability" in pred, f"{target} missing probability"
            assert "risk_level" in pred, f"{target} missing risk_level"
            assert "positive" in pred, f"{target} missing positive"
            assert "threshold" in pred, f"{target} missing threshold"
            assert 0.0 <= pred["probability"] <= 1.0, f"{target} prob out of range"

    def test_shap_included(self, full_patient):
        result = predict_patient(full_patient, include_shap=True)
        assert "shap_contributions" in result
        for target in ["CAD", "LAD", "LCX", "RCA"]:
            assert target in result["shap_contributions"]
            contribs = result["shap_contributions"][target]
            assert len(contribs) > 0
            assert "feature" in contribs[0]
            assert "shap_value" in contribs[0]
            assert "direction" in contribs[0]


class TestMissingInput:
    """Verify missing features are filled with defaults."""

    def test_sparse_patient_runs(self, sparse_patient):
        result = predict_patient(sparse_patient, include_shap=False)
        assert "predictions" in result
        for target in ["CAD", "LAD", "LCX", "RCA"]:
            prob = result["predictions"][target]["probability"]
            assert 0.0 <= prob <= 1.0

    def test_empty_input_uses_all_defaults(self):
        result = predict_patient({}, include_shap=False)
        assert "predictions" in result
        for target in ["CAD", "LAD", "LCX", "RCA"]:
            prob = result["predictions"][target]["probability"]
            assert 0.0 <= prob <= 1.0


class TestDeterminism:
    """Verify predictions are reproducible."""

    def test_same_input_same_output(self, full_patient):
        r1 = predict_patient(full_patient, include_shap=False)
        r2 = predict_patient(full_patient, include_shap=False)
        for target in ["CAD", "LAD", "LCX", "RCA"]:
            assert r1["predictions"][target]["probability"] == \
                   r2["predictions"][target]["probability"], \
                   f"{target} predictions differ between runs"


class TestRiskLevels:
    """Verify risk levels follow the defined bands."""

    def test_valid_risk_levels(self, full_patient):
        result = predict_patient(full_patient, include_shap=False)
        valid = {"low", "moderate", "high"}
        assert result["overall_risk"] in valid
        for target in ["CAD", "LAD", "LCX", "RCA"]:
            assert result["predictions"][target]["risk_level"] in valid

    def test_risk_band_consistency(self, full_patient):
        result = predict_patient(full_patient, include_shap=False)
        for target in ["CAD", "LAD", "LCX", "RCA"]:
            prob = result["predictions"][target]["probability"]
            risk = result["predictions"][target]["risk_level"]
            if prob < 0.33:
                assert risk == "low"
            elif prob < 0.66:
                assert risk == "moderate"
            else:
                assert risk == "high"
