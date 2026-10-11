"""Database module for CORVEX.

Provides persistent SQLite storage for patients and assessments.
Uses thread-safe SQLite connections with WAL mode and foreign key constraints.
"""

from __future__ import annotations

import json
import os
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Generator, Optional

# Locate default DB in the backend directory
_BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = _BACKEND_DIR / "corvex.db"

_local = threading.local()


def get_db_path() -> Path:
    env_path = os.getenv("CORVEX_DB_PATH")
    if env_path:
        return Path(env_path).resolve()
    return DEFAULT_DB_PATH


@contextmanager
def get_connection() -> Generator[sqlite3.Connection, None, None]:
    """Yields a SQLite connection configured with WAL and foreign keys."""
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(
        str(db_path),
        timeout=20.0,
        check_same_thread=False,
    )
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    try:
        yield conn
    finally:
        conn.close()


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db() -> None:
    """Creates tables, indexes, and populates initial sample records if empty."""
    with get_connection() as conn:
        with conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS patients (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    patient_id TEXT UNIQUE NOT NULL,
                    registered_date TEXT NOT NULL,
                    age INTEGER,
                    sex TEXT,
                    is_archived INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                """
            )

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS assessments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    assessment_id TEXT UNIQUE NOT NULL,
                    patient_id TEXT NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
                    assessment_date TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'in_progress',
                    current_stage INTEGER NOT NULL DEFAULT 1,
                    completed_stages TEXT NOT NULL DEFAULT '[]',
                    is_demo INTEGER NOT NULL DEFAULT 0,
                    features TEXT NOT NULL DEFAULT '{}',
                    prediction_result TEXT,
                    model_version TEXT DEFAULT '1.0',
                    version INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    completed_at TEXT
                );
                """
            )

            conn.execute("CREATE INDEX IF NOT EXISTS idx_patients_patient_id ON patients(patient_id);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_patients_reg_date ON patients(registered_date);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_assessments_patient_id ON assessments(patient_id);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_assessments_assessment_id ON assessments(assessment_id);")

            # Check if seeding is needed
            cur = conn.execute("SELECT COUNT(*) FROM patients")
            count = cur.fetchone()[0]
            if count == 0:
                _seed_initial_data(conn)


def _seed_initial_data(conn: sqlite3.Connection) -> None:
    """Populates baseline demonstration patients and assessments."""
    now = utc_now_iso()
    seed_patients = [
        {
            "patient_id": "CV-2026-0001",
            "registered_date": "2026-09-15",
            "age": 58,
            "sex": "Male",
            "assessment": {
                "assessment_id": "ASM-2026-0001",
                "assessment_date": "2026-09-15",
                "status": "completed",
                "current_stage": 7,
                "completed_stages": [1, 2, 3, 4, 5, 6, 7],
                "is_demo": 1,
                "features": {
                    "Age": 58,
                    "Sex": "Male",
                    "Weight": 74,
                    "Length": 172,
                    "BMI": 25.0,
                    "DM": "Yes",
                    "HTN": "Yes",
                    "BP": 135,
                    "PR": 78,
                    "Typical Chest Pain": "Yes",
                    "ST Elevation": "No",
                    "ST Depression": "Yes",
                    "EF-TTE": 48,
                },
                "predictions": {
                    "overallCAD": {"status": "Positive", "probability": 0.82, "riskLevel": "high", "label": "CAD Detected (Predicted)", "threshold": 0.504},
                    "vessels": {
                        "LAD": {"status": "Stenosis Detected", "probability": 0.74, "riskLevel": "high", "threshold": 0.437},
                        "LCX": {"status": "Normal", "probability": 0.32, "riskLevel": "low", "threshold": 0.384},
                        "RCA": {"status": "Stenosis Detected", "probability": 0.69, "riskLevel": "high", "threshold": 0.346},
                    },
                },
            },
        },
        {
            "patient_id": "CV-2026-0002",
            "registered_date": "2026-09-20",
            "age": 45,
            "sex": "Female",
            "assessment": {
                "assessment_id": "ASM-2026-0002",
                "assessment_date": "2026-09-20",
                "status": "completed",
                "current_stage": 7,
                "completed_stages": [1, 2, 3, 4, 5, 6, 7],
                "is_demo": 1,
                "features": {
                    "Age": 45,
                    "Sex": "Female",
                    "Weight": 60,
                    "Length": 162,
                    "BMI": 22.9,
                    "DM": "No",
                    "HTN": "No",
                    "BP": 118,
                    "PR": 68,
                    "Typical Chest Pain": "No",
                    "ST Elevation": "No",
                    "ST Depression": "No",
                    "EF-TTE": 58,
                },
                "predictions": {
                    "overallCAD": {"status": "Negative", "probability": 0.18, "riskLevel": "low", "label": "No CAD Detected (Predicted)", "threshold": 0.504},
                    "vessels": {
                        "LAD": {"status": "Normal", "probability": 0.15, "riskLevel": "low", "threshold": 0.437},
                        "LCX": {"status": "Normal", "probability": 0.12, "riskLevel": "low", "threshold": 0.384},
                        "RCA": {"status": "Normal", "probability": 0.16, "riskLevel": "low", "threshold": 0.346},
                    },
                },
            },
        },
        {
            "patient_id": "CV-2026-0003",
            "registered_date": "2026-09-28",
            "age": 67,
            "sex": "Male",
            "assessment": {
                "assessment_id": "ASM-2026-0003",
                "assessment_date": "2026-09-28",
                "status": "completed",
                "current_stage": 7,
                "completed_stages": [1, 2, 3, 4, 5, 6, 7],
                "is_demo": 1,
                "features": {
                    "Age": 67,
                    "Sex": "Male",
                    "Weight": 82,
                    "Length": 175,
                    "BMI": 26.8,
                    "DM": "Yes",
                    "HTN": "Yes",
                    "BP": 142,
                    "PR": 82,
                    "Typical Chest Pain": "Yes",
                    "ST Elevation": "No",
                    "ST Depression": "Yes",
                    "EF-TTE": 42,
                },
                "predictions": {
                    "overallCAD": {"status": "Positive", "probability": 0.88, "riskLevel": "high", "label": "CAD Detected (Predicted)", "threshold": 0.504},
                    "vessels": {
                        "LAD": {"status": "Stenosis Detected", "probability": 0.81, "riskLevel": "high", "threshold": 0.437},
                        "LCX": {"status": "Stenosis Detected", "probability": 0.72, "riskLevel": "high", "threshold": 0.384},
                        "RCA": {"status": "Normal", "probability": 0.28, "riskLevel": "low", "threshold": 0.346},
                    },
                },
            },
        },
        {
            "patient_id": "CV-2026-0004",
            "registered_date": "2026-10-01",
            "age": 52,
            "sex": "Female",
            "assessment": {
                "assessment_id": "ASM-2026-0004",
                "assessment_date": "2026-10-01",
                "status": "in_progress",
                "current_stage": 3,
                "completed_stages": [1, 2],
                "is_demo": 0,
                "features": {
                    "Age": 52,
                    "Sex": "Female",
                    "Weight": 68,
                    "Length": 165,
                    "BMI": 25.0,
                    "DM": "No",
                    "HTN": "Yes",
                    "Current Smoker": "No",
                    "EX-Smoker": "No",
                    "FH": "No",
                    "Obesity": "No",
                    "CRF": "No",
                    "CVA": "No",
                    "Airway disease": "No",
                    "Thyroid Disease": "Yes",
                    "CHF": "No",
                    "DLP": "No",
                    "BP": 130,
                    "PR": 72,
                },
                "predictions": None,
            },
        },
        {
            "patient_id": "CV-2026-0005",
            "registered_date": "2026-10-02",
            "age": 71,
            "sex": "Male",
            "assessment": {
                "assessment_id": "ASM-2026-0005",
                "assessment_date": "2026-10-02",
                "status": "completed",
                "current_stage": 7,
                "completed_stages": [1, 2, 3, 4, 5, 6, 7],
                "is_demo": 1,
                "features": {
                    "Age": 71,
                    "Sex": "Male",
                    "Weight": 79,
                    "Length": 168,
                    "BMI": 28.0,
                    "DM": "Yes",
                    "HTN": "Yes",
                    "BP": 145,
                    "PR": 80,
                    "Typical Chest Pain": "Yes",
                    "ST Elevation": "No",
                    "ST Depression": "Yes",
                    "EF-TTE": 45,
                },
                "predictions": {
                    "overallCAD": {"status": "Positive", "probability": 0.79, "riskLevel": "high", "label": "CAD Detected (Predicted)", "threshold": 0.504},
                    "vessels": {
                        "LAD": {"status": "Normal", "probability": 0.35, "riskLevel": "low", "threshold": 0.437},
                        "LCX": {"status": "Stenosis Detected", "probability": 0.68, "riskLevel": "high", "threshold": 0.384},
                        "RCA": {"status": "Stenosis Detected", "probability": 0.71, "riskLevel": "high", "threshold": 0.346},
                    },
                },
            },
        },
    ]

    for item in seed_patients:
        conn.execute(
            """
            INSERT INTO patients (patient_id, registered_date, age, sex, is_archived, created_at, updated_at)
            VALUES (?, ?, ?, ?, 0, ?, ?);
            """,
            (item["patient_id"], item["registered_date"], item["age"], item["sex"], now, now),
        )
        asm = item["assessment"]
        pred_json = json.dumps(asm["predictions"]) if asm["predictions"] else None
        conn.execute(
            """
            INSERT INTO assessments (
                assessment_id, patient_id, assessment_date, status, current_stage,
                completed_stages, is_demo, features, prediction_result, version,
                created_at, updated_at, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?);
            """,
            (
                asm["assessment_id"],
                item["patient_id"],
                asm["assessment_date"],
                asm["status"],
                asm["current_stage"],
                json.dumps(asm["completed_stages"]),
                asm["is_demo"],
                json.dumps(asm["features"]),
                pred_json,
                now,
                now,
                now if asm["status"] == "completed" else None,
            ),
        )


# --- Patient Operations ---


def generate_next_patient_id(conn: sqlite3.Connection) -> str:
    """Generates the next sequential patient ID in CV-YYYY-NNNN format safely."""
    year = datetime.now().year
    prefix = f"CV-{year}-"
    cur = conn.execute(
        "SELECT patient_id FROM patients WHERE patient_id LIKE ? ORDER BY patient_id DESC LIMIT 1",
        (f"{prefix}%",),
    )
    row = cur.fetchone()
    if row:
        try:
            last_num = int(row[0].split("-")[-1])
            next_num = last_num + 1
        except (ValueError, IndexError):
            next_num = 1
    else:
        next_num = 1
    return f"CV-{year}-{next_num:04d}"


def generate_next_assessment_id(conn: sqlite3.Connection) -> str:
    """Generates the next sequential assessment ID in ASM-YYYY-NNNN format safely."""
    year = datetime.now().year
    prefix = f"ASM-{year}-"
    cur = conn.execute(
        "SELECT assessment_id FROM assessments WHERE assessment_id LIKE ? ORDER BY assessment_id DESC LIMIT 1",
        (f"{prefix}%",),
    )
    row = cur.fetchone()
    if row:
        try:
            last_num = int(row[0].split("-")[-1])
            next_num = last_num + 1
        except (ValueError, IndexError):
            next_num = 1
    else:
        next_num = 1
    return f"ASM-{year}-{next_num:04d}"


def create_or_get_patient(
    patient_id: Optional[str] = None,
    registered_date: Optional[str] = None,
    age: Optional[int] = None,
    sex: Optional[str] = None,
) -> dict[str, Any]:
    now = utc_now_iso()
    today = datetime.now().strftime("%Y-%m-%d")
    with get_connection() as conn:
        with conn:
            if patient_id:
                cur = conn.execute(
                    "SELECT * FROM patients WHERE patient_id = ?",
                    (patient_id,),
                )
                row = cur.fetchone()
                if row:
                    # Update age or sex if provided and currently missing
                    updates = []
                    params: list[Any] = []
                    if age is not None and row["age"] is None:
                        updates.append("age = ?")
                        params.append(age)
                    if sex is not None and row["sex"] is None:
                        updates.append("sex = ?")
                        params.append(sex)
                    if updates:
                        updates.append("updated_at = ?")
                        params.append(now)
                        params.append(patient_id)
                        conn.execute(
                            f"UPDATE patients SET {', '.join(updates)} WHERE patient_id = ?",
                            params,
                        )
                    return get_patient_by_id(patient_id, conn)

            # Generate new patient ID if none supplied
            assigned_id = patient_id or generate_next_patient_id(conn)
            reg_date = registered_date or today
            conn.execute(
                """
                INSERT INTO patients (patient_id, registered_date, age, sex, is_archived, created_at, updated_at)
                VALUES (?, ?, ?, ?, 0, ?, ?);
                """,
                (assigned_id, reg_date, age, sex, now, now),
            )
            return get_patient_by_id(assigned_id, conn)


def get_patient_by_id(patient_id: str, conn: Optional[sqlite3.Connection] = None) -> Optional[dict[str, Any]]:
    def _query(c: sqlite3.Connection):
        cur = c.execute("SELECT * FROM patients WHERE patient_id = ?", (patient_id,))
        row = cur.fetchone()
        if not row:
            return None
        res = dict(row)
        res["is_archived"] = bool(res["is_archived"])

        # Fetch latest completed prediction if any
        pred_cur = c.execute(
            """
            SELECT prediction_result, assessment_date FROM assessments
            WHERE patient_id = ? AND status = 'completed' AND prediction_result IS NOT NULL
            ORDER BY completed_at DESC, updated_at DESC LIMIT 1
            """,
            (patient_id,),
        )
        pred_row = pred_cur.fetchone()
        if pred_row and pred_row["prediction_result"]:
            try:
                pred_data = json.loads(pred_row["prediction_result"])
                res["predictions"] = _format_summary_predictions(pred_data)
                res["hasAssessment"] = True
            except Exception:
                res["predictions"] = None
                res["hasAssessment"] = True
        else:
            # Check if there is any assessment at all
            any_cur = c.execute("SELECT COUNT(*) FROM assessments WHERE patient_id = ?", (patient_id,))
            res["hasAssessment"] = any_cur.fetchone()[0] > 0
            res["predictions"] = None

        return res

    if conn is not None:
        return _query(conn)
    with get_connection() as c:
        return _query(c)


def _format_summary_predictions(pred_data: dict[str, Any]) -> dict[str, str]:
    """Extracts overallCAD, LAD, LCX, RCA in Yes/No format for frontend cards/filters."""
    out = {"overallCAD": "No", "LAD": "No", "LCX": "No", "RCA": "No"}
    if "overallCAD" in pred_data:
        cad = pred_data["overallCAD"]
        out["overallCAD"] = "Yes" if (cad.get("status") == "Positive" or cad.get("probability", 0) >= cad.get("threshold", 0.5)) else "No"
    elif "predictions" in pred_data and "CAD" in pred_data["predictions"]:
        cad = pred_data["predictions"]["CAD"]
        out["overallCAD"] = "Yes" if cad.get("positive", False) else "No"

    vessels = pred_data.get("vessels") or pred_data.get("predictions", {})
    for v in ("LAD", "LCX", "RCA"):
        if v in vessels:
            v_info = vessels[v]
            is_pos = (
                v_info.get("positive", False)
                or v_info.get("status") == "Stenosis Detected"
                or v_info.get("probability", 0) >= v_info.get("threshold", 0.4)
            )
            out[v] = "Yes" if is_pos else "No"
    return out


def search_patients(
    query: str = "",
    sex: Optional[str] = None,
    age_min: Optional[int] = None,
    age_max: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    overall_cad: Optional[str] = None,
    lad: Optional[str] = None,
    lcx: Optional[str] = None,
    rca: Optional[str] = None,
    include_archived: bool = False,
) -> list[dict[str, Any]]:
    with get_connection() as conn:
        sql = "SELECT patient_id FROM patients WHERE 1=1"
        params: list[Any] = []

        if not include_archived:
            sql += " AND is_archived = 0"

        if query.strip():
            sql += " AND LOWER(patient_id) LIKE ?"
            params.append(f"%{query.strip().lower()}%")

        if sex and sex != "All":
            sql += " AND sex = ?"
            params.append(sex)

        if age_min is not None:
            sql += " AND age >= ?"
            params.append(age_min)

        if age_max is not None:
            sql += " AND age <= ?"
            params.append(age_max)

        if date_from:
            sql += " AND registered_date >= ?"
            params.append(date_from)

        if date_to:
            sql += " AND registered_date <= ?"
            params.append(date_to)

        sql += " ORDER BY registered_date DESC, id DESC"
        cur = conn.execute(sql, params)
        rows = cur.fetchall()

        matched: list[dict[str, Any]] = []
        for r in rows:
            p = get_patient_by_id(r["patient_id"], conn)
            if not p:
                continue

            # Apply prediction filters based strictly on latest completed assessment
            preds = p.get("predictions")
            if overall_cad and overall_cad != "All":
                if not preds or preds.get("overallCAD") != overall_cad:
                    continue
            if lad and lad != "All":
                if not preds or preds.get("LAD") != lad:
                    continue
            if lcx and lcx != "All":
                if not preds or preds.get("LCX") != lcx:
                    continue
            if rca and rca != "All":
                if not preds or preds.get("RCA") != rca:
                    continue

            # Format fields for frontend compatibility
            matched.append({
                "patientId": p["patient_id"],
                "registeredDate": p["registered_date"],
                "age": p["age"],
                "sex": p["sex"],
                "hasAssessment": p["hasAssessment"],
                "predictions": preds,
                "isArchived": p["is_archived"],
            })

        return matched


# --- Assessment Operations ---


def create_assessment(
    patient_id: str,
    assessment_date: Optional[str] = None,
    is_demo: bool = False,
    current_stage: int = 1,
    features: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    now = utc_now_iso()
    today = datetime.now().strftime("%Y-%m-%d")
    date_val = assessment_date or today
    feat_dict = features or {}

    with get_connection() as conn:
        with conn:
            # Ensure patient exists
            p = get_patient_by_id(patient_id, conn)
            if not p:
                conn.execute(
                    """
                    INSERT INTO patients (patient_id, registered_date, is_archived, created_at, updated_at)
                    VALUES (?, ?, 0, ?, ?);
                    """,
                    (patient_id, date_val, now, now),
                )

            asm_id = generate_next_assessment_id(conn)
            completed_stages: list[int] = []
            for i in range(1, current_stage):
                completed_stages.append(i)

            conn.execute(
                """
                INSERT INTO assessments (
                    assessment_id, patient_id, assessment_date, status, current_stage,
                    completed_stages, is_demo, features, version, created_at, updated_at
                ) VALUES (?, ?, ?, 'in_progress', ?, ?, ?, ?, 1, ?, ?);
                """,
                (
                    asm_id,
                    patient_id,
                    date_val,
                    current_stage,
                    json.dumps(completed_stages),
                    1 if is_demo else 0,
                    json.dumps(feat_dict),
                    now,
                    now,
                ),
            )
            return get_assessment_by_id(asm_id, conn)  # type: ignore[return-value]


def get_assessment_by_id(
    assessment_id: str,
    conn: Optional[sqlite3.Connection] = None,
) -> Optional[dict[str, Any]]:
    def _query(c: sqlite3.Connection):
        cur = c.execute("SELECT * FROM assessments WHERE assessment_id = ?", (assessment_id,))
        row = cur.fetchone()
        if not row:
            return None
        return _deserialize_assessment(dict(row))

    if conn is not None:
        return _query(conn)
    with get_connection() as c:
        return _query(c)


def get_resumable_assessments(patient_id: str) -> list[dict[str, Any]]:
    """Returns in-progress assessments for a patient."""
    with get_connection() as conn:
        cur = conn.execute(
            """
            SELECT * FROM assessments
            WHERE patient_id = ? AND status = 'in_progress'
            ORDER BY updated_at DESC, id DESC
            """,
            (patient_id,),
        )
        return [_deserialize_assessment(dict(r)) for r in cur.fetchall()]


def get_patient_assessment_history(patient_id: str) -> list[dict[str, Any]]:
    """Returns all assessments for a patient (completed and in-progress)."""
    with get_connection() as conn:
        cur = conn.execute(
            """
            SELECT * FROM assessments
            WHERE patient_id = ?
            ORDER BY created_at DESC, id DESC
            """,
            (patient_id,),
        )
        return [_deserialize_assessment(dict(r)) for r in cur.fetchall()]


def update_assessment(
    assessment_id: str,
    current_stage: Optional[int] = None,
    completed_stages: Optional[list[int]] = None,
    features: Optional[dict[str, Any]] = None,
    is_demo: Optional[bool] = None,
    client_version: Optional[int] = None,
) -> dict[str, Any]:
    """Updates an existing in-progress assessment draft with optimistic concurrency control."""
    now = utc_now_iso()
    with get_connection() as conn:
        with conn:
            cur = conn.execute("SELECT * FROM assessments WHERE assessment_id = ?", (assessment_id,))
            row = cur.fetchone()
            if not row:
                raise ValueError(f"Assessment {assessment_id} not found")

            if row["status"] != "in_progress":
                raise ValueError("Cannot edit a completed assessment")

            current_ver = row["version"]
            # Guard against out-of-order writes
            if client_version is not None and client_version < current_ver:
                # Client version is older than current database version; reject overwrite
                raise ValueError(
                    f"Out of order save rejected: client version {client_version} is older than current version {current_ver}"
                )

            # Merge or overwrite features
            existing_feats = json.loads(row["features"] or "{}")
            if features is not None:
                existing_feats.update(features)

            stage_val = current_stage if current_stage is not None else row["current_stage"]

            if completed_stages is not None:
                comp_json = json.dumps(completed_stages)
            else:
                comp_json = row["completed_stages"]

            demo_val = (1 if is_demo else 0) if is_demo is not None else row["is_demo"]
            new_version = current_ver + 1

            conn.execute(
                """
                UPDATE assessments
                SET current_stage = ?,
                    completed_stages = ?,
                    features = ?,
                    is_demo = ?,
                    version = ?,
                    updated_at = ?
                WHERE assessment_id = ?;
                """,
                (
                    stage_val,
                    comp_json,
                    json.dumps(existing_feats),
                    demo_val,
                    new_version,
                    now,
                    assessment_id,
                ),
            )

            # Also sync Age and Sex to patient table if present in features
            pid = row["patient_id"]
            patient_updates = []
            p_params: list[Any] = []
            if "Age" in existing_feats and existing_feats["Age"] is not None:
                try:
                    patient_updates.append("age = ?")
                    p_params.append(int(existing_feats["Age"]))
                except (ValueError, TypeError):
                    pass
            if "Sex" in existing_feats and existing_feats["Sex"]:
                patient_updates.append("sex = ?")
                p_params.append(str(existing_feats["Sex"]))
            if patient_updates:
                patient_updates.append("updated_at = ?")
                p_params.append(now)
                p_params.append(pid)
                conn.execute(
                    f"UPDATE patients SET {', '.join(patient_updates)} WHERE patient_id = ?",
                    p_params,
                )

            return get_assessment_by_id(assessment_id, conn)  # type: ignore[return-value]


def complete_assessment(
    assessment_id: str,
    prediction_result: dict[str, Any],
    model_version: str = "1.0",
) -> dict[str, Any]:
    """Marks an assessment as completed and stores the actual ML outputs."""
    now = utc_now_iso()
    with get_connection() as conn:
        with conn:
            cur = conn.execute("SELECT * FROM assessments WHERE assessment_id = ?", (assessment_id,))
            row = cur.fetchone()
            if not row:
                raise ValueError(f"Assessment {assessment_id} not found")

            all_stages = json.dumps([1, 2, 3, 4, 5, 6, 7])
            conn.execute(
                """
                UPDATE assessments
                SET status = 'completed',
                    current_stage = 7,
                    completed_stages = ?,
                    prediction_result = ?,
                    model_version = ?,
                    updated_at = ?,
                    completed_at = ?
                WHERE assessment_id = ?;
                """,
                (
                    all_stages,
                    json.dumps(prediction_result),
                    model_version,
                    now,
                    now,
                    assessment_id,
                ),
            )
            return get_assessment_by_id(assessment_id, conn)  # type: ignore[return-value]


def archive_patient(patient_id: str, is_archived: bool = True) -> bool:
    now = utc_now_iso()
    with get_connection() as conn:
        with conn:
            cur = conn.execute(
                "UPDATE patients SET is_archived = ?, updated_at = ? WHERE patient_id = ?",
                (1 if is_archived else 0, now, patient_id),
            )
            return cur.rowcount > 0


def _deserialize_assessment(row: dict[str, Any]) -> dict[str, Any]:
    row["is_demo"] = bool(row.get("is_demo", 0))
    if isinstance(row.get("completed_stages"), str):
        try:
            row["completed_stages"] = json.loads(row["completed_stages"])
        except Exception:
            row["completed_stages"] = []
    if isinstance(row.get("features"), str):
        try:
            row["features"] = json.loads(row["features"])
        except Exception:
            row["features"] = {}
    if isinstance(row.get("prediction_result"), str) and row["prediction_result"]:
        try:
            row["prediction_result"] = json.loads(row["prediction_result"])
        except Exception:
            pass

    # Provide frontend camelCase aliases for frictionless integration
    row["assessmentId"] = row["assessment_id"]
    row["patientId"] = row["patient_id"]
    row["assessmentDate"] = row["assessment_date"]
    row["currentStage"] = row["current_stage"]
    row["completedStages"] = row["completed_stages"]
    row["isDemo"] = row["is_demo"]
    row["predictionResult"] = row.get("prediction_result")
    row["createdAt"] = row["created_at"]
    row["updatedAt"] = row["updated_at"]
    row["completedAt"] = row.get("completed_at")
    return row


def delete_patient(patient_id: str) -> bool:
    """Permanently deletes a patient and all their assessments.

    The assessments table references patients(patient_id) with ON DELETE CASCADE,
    so a single DELETE on patients atomically removes all child assessments
    within the same transaction.  Foreign keys must be enabled (they are via
    get_connection()) for CASCADE to fire.

    Returns True if a row was actually deleted, False if the patient was not found.
    """
    with get_connection() as conn:
        with conn:  # single atomic transaction
            cur = conn.execute(
                "DELETE FROM patients WHERE patient_id = ?",
                (patient_id,),
            )
            return cur.rowcount > 0


def delete_assessment(assessment_id: str, patient_id: str) -> bool:
    """Permanently deletes a single assessment that belongs to the given patient.

    The patient_id ownership check prevents a stale or mis-routed request from
    accidentally removing an assessment belonging to a different patient.

    Returns True if an assessment row was deleted, False if no matching row was found.
    Raises ValueError if the assessment exists but belongs to a different patient.
    """
    with get_connection() as conn:
        # First verify existence and ownership without deleting yet
        cur = conn.execute(
            "SELECT patient_id FROM assessments WHERE assessment_id = ?",
            (assessment_id,),
        )
        row = cur.fetchone()
        if row is None:
            return False  # not found
        if row["patient_id"] != patient_id:
            raise ValueError(
                f"Assessment {assessment_id} does not belong to patient {patient_id}."
            )
        with conn:  # atomic delete
            conn.execute(
                "DELETE FROM assessments WHERE assessment_id = ? AND patient_id = ?",
                (assessment_id, patient_id),
            )
            return True
