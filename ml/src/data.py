"""Data loading, cleaning, and splitting for the cardiac risk ML module."""
from __future__ import annotations

import json
import logging
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

from . import config as cfg

logger = logging.getLogger(__name__)


def load_raw() -> pd.DataFrame:
    """Load the raw xlsx dataset from data/raw/.
    
    Returns:
        Full raw DataFrame (303 x 59).
    """
    df = pd.read_excel(cfg.RAW_XLSX, sheet_name=cfg.RAW_SHEET)
    logger.info(f"Loaded raw data: {df.shape}")
    return df


def clean(df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, pd.Series]]:
    """Clean raw data: extract targets, drop leaky/redundant cols, encode binaries.
    
    Cleaning steps:
      1. Extract LEAKAGE_COLS as target series, remove from features.
      2. Drop DROP_COLS (zero-variance and redundant columns), log each.
      3. Map Y/N columns to 1/0.
      4. Map Sex to 1/0.
      5. Leave BBB, VHD as strings (pipeline will encode).
      6. Leave Region RWMA, Function Class as integers (pipeline will encode RWMA).
      7. Encode target series using TARGET_MAP.
    
    Args:
        df: Raw DataFrame.
    
    Returns:
        (X, targets) where X is the cleaned feature DataFrame and
        targets is a dict mapping target name -> encoded pd.Series.
    """
    df = df.copy()
    
    # 1. Extract targets
    targets: dict[str, pd.Series] = {}
    for col, mapping in cfg.TARGET_MAP.items():
        targets[col] = df[col].map(mapping).astype(int)
        logger.info(f"Target '{col}': {dict(targets[col].value_counts().sort_index())}")
    
    # Remove leakage columns from features
    df = df.drop(columns=cfg.LEAKAGE_COLS)
    logger.info(f"Removed leakage columns: {cfg.LEAKAGE_COLS}")
    
    # 2. Drop zero-variance and redundant columns
    for col, reason in cfg.DROP_COLS.items():
        if col in df.columns:
            df = df.drop(columns=[col])
            logger.info(f"Dropped '{col}': {reason}")
    
    # 3. Map Y/N -> 1/0
    for col in cfg.YN_COLS:
        if col in df.columns:
            df[col] = df[col].map({'Y': 1, 'N': 0}).astype(int)
    logger.info(f"Encoded {len(cfg.YN_COLS)} Y/N columns to 1/0")
    
    # 4. Map Sex
    df['Sex'] = df['Sex'].map(cfg.SEX_MAP).astype(int)
    logger.info("Encoded Sex (Male=1, Fmale=0)")
    
    # 5-6. BBB, VHD stay as strings; Region RWMA, Function Class stay as int
    
    X = df.reset_index(drop=True)
    targets = {k: v.reset_index(drop=True) for k, v in targets.items()}
    
    logger.info(f"Cleaned features: {X.shape} ({len(X.columns)} features)")
    return X, targets


def create_split(
    X: pd.DataFrame,
    targets: dict[str, pd.Series],
) -> dict:
    """Create a stratified 80/20 holdout split, stratified on the combined
    pattern of (Cath, LAD, LCX, RCA) targets.
    
    Returns:
        dict with 'train_indices' and 'test_indices' (lists of int).
    """
    # Create a combined stratification key
    strat_key = (
        targets['Cath'].astype(str) + '_' +
        targets['LAD'].astype(str) + '_' +
        targets['LCX'].astype(str) + '_' +
        targets['RCA'].astype(str)
    )
    
    # Some combined patterns may be too rare for stratification.
    # Check and fall back to Cath-only if needed.
    pattern_counts = strat_key.value_counts()
    min_count = pattern_counts.min()
    
    if min_count < 2:
        # Some patterns appear only once; we need at least 2 for stratified split.
        # Merge all rare patterns (count < 2) into their Cath-based majority group
        # so every group has >= 2 members.
        rare_patterns = set(pattern_counts[pattern_counts < 2].index)
        logger.warning(
            f"Some target patterns have <2 samples (min={min_count}). "
            f"Rare patterns: {dict(pattern_counts[pattern_counts < 2])}. "
            f"Merging into Cath-based groups for stratification."
        )
        strat_key_safe = strat_key.copy()
        for idx in strat_key_safe.index:
            if strat_key_safe[idx] in rare_patterns:
                # Merge into the most common pattern that shares the same Cath value
                cath_val = strat_key_safe[idx].split('_')[0]
                # Find common patterns with same Cath prefix
                common = [
                    p for p in pattern_counts.index
                    if p.startswith(cath_val + '_') and p not in rare_patterns
                ]
                if common:
                    strat_key_safe[idx] = common[0]  # merge into largest common
                else:
                    strat_key_safe[idx] = f'{cath_val}_merged'
        stratify_on = strat_key_safe
    else:
        stratify_on = strat_key
    
    train_idx, test_idx = train_test_split(
        np.arange(len(X)),
        test_size=cfg.TEST_SIZE,
        random_state=cfg.RANDOM_SEED,
        stratify=stratify_on,
    )
    
    split = {
        'train_indices': sorted(train_idx.tolist()),
        'test_indices': sorted(test_idx.tolist()),
    }
    
    logger.info(f"Split: train={len(split['train_indices'])}, test={len(split['test_indices'])}")
    return split


def save_processed(
    X: pd.DataFrame,
    targets: dict[str, pd.Series],
    split: dict,
) -> None:
    """Save cleaned data and split indices to data/processed/."""
    cfg.DATA_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    
    # Save features
    X.to_csv(cfg.DATA_PROCESSED_DIR / 'features.csv', index=False)
    logger.info(f"Saved features to {cfg.DATA_PROCESSED_DIR / 'features.csv'}")
    
    # Save targets
    targets_df = pd.DataFrame(targets)
    targets_df.to_csv(cfg.DATA_PROCESSED_DIR / 'targets.csv', index=False)
    logger.info(f"Saved targets to {cfg.DATA_PROCESSED_DIR / 'targets.csv'}")
    
    # Save split indices
    with open(cfg.DATA_PROCESSED_DIR / 'split.json', 'w') as f:
        json.dump(split, f, indent=2)
    logger.info(f"Saved split to {cfg.DATA_PROCESSED_DIR / 'split.json'}")


def load_processed() -> tuple[pd.DataFrame, dict[str, pd.Series], dict]:
    """Load cleaned data and split from data/processed/.
    
    Returns:
        (X, targets, split)
    """
    X = pd.read_csv(cfg.DATA_PROCESSED_DIR / 'features.csv')
    
    targets_df = pd.read_csv(cfg.DATA_PROCESSED_DIR / 'targets.csv')
    targets = {col: targets_df[col] for col in cfg.LEAKAGE_COLS}
    
    with open(cfg.DATA_PROCESSED_DIR / 'split.json') as f:
        split = json.load(f)
    
    logger.info(f"Loaded processed data: X={X.shape}, split train={len(split['train_indices'])}")
    return X, targets, split
