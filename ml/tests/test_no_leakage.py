"""Test that no target/leakage columns appear in the cleaned feature set."""
import sys
from pathlib import Path

import pytest

# Ensure ml/ is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src import config as cfg, data


@pytest.fixture(scope="module")
def cleaned():
    """Load raw data and clean it once for the test module."""
    df = data.load_raw()
    X, targets = data.clean(df)
    return X, targets


class TestNoLeakage:
    """Verify that leakage columns are never present in the feature set."""

    def test_leakage_cols_not_in_features(self, cleaned):
        X, _ = cleaned
        for col in cfg.LEAKAGE_COLS:
            assert col not in X.columns, (
                f"Leakage column '{col}' found in feature DataFrame! "
                f"Columns present: {sorted(X.columns.tolist())}"
            )

    def test_leakage_cols_defined(self):
        """Ensure LEAKAGE_COLS is non-empty and contains the expected columns."""
        assert len(cfg.LEAKAGE_COLS) == 4
        assert set(cfg.LEAKAGE_COLS) == {'LAD', 'LCX', 'RCA', 'Cath'}

    def test_drop_cols_removed(self, cleaned):
        X, _ = cleaned
        for col in cfg.DROP_COLS:
            assert col not in X.columns, (
                f"Drop column '{col}' still in feature DataFrame!"
            )

    def test_targets_correctly_encoded(self, cleaned):
        _, targets = cleaned
        for name, series in targets.items():
            assert set(series.unique()) <= {0, 1}, (
                f"Target '{name}' has values other than 0/1: {sorted(series.unique())}"
            )

    def test_no_constant_columns(self, cleaned):
        X, _ = cleaned
        for col in X.columns:
            assert X[col].nunique() > 1, (
                f"Constant column '{col}' found in features (nunique=1)"
            )

    def test_feature_count(self, cleaned):
        """Verify the expected feature count after cleaning.
        
        59 original - 4 targets - 3 dropped = 52 features.
        """
        X, _ = cleaned
        expected = 59 - len(cfg.LEAKAGE_COLS) - len(cfg.DROP_COLS)
        assert X.shape[1] == expected, (
            f"Expected {expected} features, got {X.shape[1]}"
        )
