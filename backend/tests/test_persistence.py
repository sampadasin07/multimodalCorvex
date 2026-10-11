import json
import os
import tempfile

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app import db


@pytest.fixture(autouse=True)
def isolated_db(tmp_path, monkeypatch):
    """Each test gets its own fresh SQLite database so mutations don't bleed across tests."""
    db_path = tmp_path / "corvex_test.db"
    monkeypatch.setenv("CORVEX_DB_PATH", str(db_path))
    # Re-init so the new DB path is used and seeded
    db.init_db()
    yield
    # Cleanup is handled automatically by tmp_path



def test_db_init_and_seed():
    with TestClient(app) as client:
        r = client.get("/api/patients")
        assert r.status_code == 200
        patients = r.json()
        assert len(patients) >= 5
        patient_ids = {p["patientId"] for p in patients}
        assert "CV-2026-0001" in patient_ids
        assert "CV-2026-0004" in patient_ids


def test_patient_search_and_filters():
    with TestClient(app) as client:
        # Filter by sex
        r = client.get("/api/patients?sex=Male")
        assert r.status_code == 200
        assert all(p["sex"] == "Male" for p in r.json())

        # Filter by CAD prediction
        r = client.get("/api/patients?overall_cad=Yes")
        assert r.status_code == 200
        for p in r.json():
            assert p["predictions"] is not None
            assert p["predictions"]["overallCAD"] == "Yes"

        # Filter by query
        r = client.get("/api/patients?query=0004")
        assert r.status_code == 200
        results = r.json()
        assert len(results) == 1
        assert results[0]["patientId"] == "CV-2026-0004"


def test_patient_resumable_assessment():
    with TestClient(app) as client:
        r = client.get("/api/patients/CV-2026-0004/resumable")
        assert r.status_code == 200
        resumable = r.json()
        assert len(resumable) >= 1
        draft = resumable[0]
        assert draft["status"] == "in_progress"
        assert draft["currentStage"] == 3
        assert draft["features"]["HTN"] == "Yes"


def test_create_update_and_complete_assessment_flow():
    with TestClient(app) as client:
        # 1. Create a new patient
        p_res = client.post(
            "/api/patients",
            json={"registered_date": "2026-10-10", "age": 60, "sex": "Male"},
        )
        assert p_res.status_code == 200
        p_data = p_res.json()
        new_pid = p_data["patient_id"]
        assert new_pid.startswith("CV-")

        # 2. Create a new draft assessment
        a_res = client.post(
            "/api/assessments",
            json={
                "patient_id": new_pid,
                "assessment_date": "2026-10-10",
                "current_stage": 1,
                "features": {"Age": 60, "Sex": "Male"},
            },
        )
        assert a_res.status_code == 200
        a_data = a_res.json()
        asm_id = a_data["assessmentId"]
        assert a_data["status"] == "in_progress"
        assert a_data["version"] == 1

        # 3. Autosave / update stage and features
        u_res = client.patch(
            f"/api/assessments/{asm_id}",
            json={
                "current_stage": 2,
                "completed_stages": [1],
                "features": {"DM": "No", "HTN": "Yes"},
                "version": 1,
            },
        )
        assert u_res.status_code == 200
        u_data = u_res.json()
        assert u_data["currentStage"] == 2
        assert u_data["features"]["DM"] == "No"
        assert u_data["version"] == 2

        # 4. Out-of-order write should be rejected
        stale_res = client.patch(
            f"/api/assessments/{asm_id}",
            json={
                "current_stage": 1,
                "features": {"DM": "Yes"},
                "version": 1,  # Stale version! Current version is 2
            },
        )
        assert stale_res.status_code == 400
        assert "Out of order" in stale_res.json()["detail"]

        # 5. Complete the assessment with prediction results
        pred_payload = {
            "prediction_result": {
                "overallCAD": {"status": "Positive", "probability": 0.78, "threshold": 0.504},
                "vessels": {
                    "LAD": {"status": "Stenosis Detected", "probability": 0.72, "threshold": 0.437},
                    "LCX": {"status": "Normal", "probability": 0.20, "threshold": 0.384},
                    "RCA": {"status": "Normal", "probability": 0.25, "threshold": 0.346},
                },
            },
            "model_version": "1.0",
        }
        c_res = client.post(f"/api/assessments/{asm_id}/complete", json=pred_payload)
        assert c_res.status_code == 200
        c_data = c_res.json()
        assert c_data["status"] == "completed"
        assert c_data["completedAt"] is not None

        # 6. Completed assessment should no longer be in resumable list
        resumable_res = client.get(f"/api/patients/{new_pid}/resumable")
        assert resumable_res.status_code == 200
        assert not any(a["assessmentId"] == asm_id for a in resumable_res.json())

        # 7. Patient details should show it in assessment history
        detail_res = client.get(f"/api/patients/{new_pid}")
        assert detail_res.status_code == 200
        detail_data = detail_res.json()
        assert len(detail_data["assessmentHistory"]) >= 1
        assert detail_data["assessmentHistory"][0]["assessmentId"] == asm_id


# ─── Delete-patient tests ─────────────────────────────────────────────────────

def test_delete_patient_removes_patient_and_assessments():
    """Deleting a patient must remove the patient row and all their assessments (CASCADE)."""
    with TestClient(app) as client:
        # Create a patient with two assessments
        p_res = client.post("/api/patients", json={"registered_date": "2026-10-10", "age": 45, "sex": "Female"})
        assert p_res.status_code == 200
        pid = p_res.json()["patient_id"]

        for _ in range(2):
            a_res = client.post("/api/assessments", json={"patient_id": pid, "assessment_date": "2026-10-10", "current_stage": 1})
            assert a_res.status_code == 200

        # Create an unrelated patient that must NOT be touched
        other_res = client.post("/api/patients", json={"registered_date": "2026-10-10", "age": 50, "sex": "Male"})
        assert other_res.status_code == 200
        other_pid = other_res.json()["patient_id"]

        # Delete the first patient
        del_res = client.delete(f"/api/patients/{pid}")
        assert del_res.status_code == 200
        assert del_res.json()["status"] == "deleted"

        # Patient should be gone
        get_res = client.get(f"/api/patients/{pid}")
        assert get_res.status_code == 404

        # The unrelated patient must still exist
        other_get = client.get(f"/api/patients/{other_pid}")
        assert other_get.status_code == 200
        assert other_get.json()["patient_id"] == other_pid


def test_delete_patient_not_found():
    """Deleting a non-existent patient must return 404."""
    with TestClient(app) as client:
        res = client.delete("/api/patients/DOES-NOT-EXIST-999")
        assert res.status_code == 404


# ─── Delete-assessment tests ──────────────────────────────────────────────────

def _create_patient_with_assessments(client, n=2):
    """Helper: create a patient and n draft assessments; return (patient_id, [assessment_id, ...])."""
    p_res = client.post("/api/patients", json={"registered_date": "2026-10-10", "age": 55, "sex": "Male"})
    assert p_res.status_code == 200
    pid = p_res.json()["patient_id"]
    asm_ids = []
    for _ in range(n):
        a_res = client.post("/api/assessments", json={"patient_id": pid, "assessment_date": "2026-10-10", "current_stage": 1})
        assert a_res.status_code == 200
        asm_ids.append(a_res.json()["assessmentId"])
    return pid, asm_ids


def test_delete_assessment_removes_only_targeted():
    """Deleting one assessment must leave the patient and sibling assessments intact."""
    with TestClient(app) as client:
        pid, asm_ids = _create_patient_with_assessments(client, n=2)
        target_id, sibling_id = asm_ids[0], asm_ids[1]

        del_res = client.delete(f"/api/assessments/{target_id}?patient_id={pid}")
        assert del_res.status_code == 200
        assert del_res.json()["status"] == "deleted"

        # Deleted assessment is gone
        get_del = client.get(f"/api/assessments/{target_id}")
        assert get_del.status_code == 404

        # Sibling assessment still exists
        get_sib = client.get(f"/api/assessments/{sibling_id}")
        assert get_sib.status_code == 200
        assert get_sib.json()["assessmentId"] == sibling_id

        # Parent patient still exists and shows the sibling in history
        detail = client.get(f"/api/patients/{pid}")
        assert detail.status_code == 200
        history_ids = [a["assessmentId"] for a in detail.json()["assessmentHistory"]]
        assert target_id not in history_ids
        assert sibling_id in history_ids


def test_delete_assessment_wrong_patient_returns_409():
    """Deleting an assessment with a mismatched patient_id must return 409, not silently succeed."""
    with TestClient(app) as client:
        pid1, asm_ids1 = _create_patient_with_assessments(client, n=1)
        pid2, _ = _create_patient_with_assessments(client, n=1)
        target_asm = asm_ids1[0]

        # Attempt to delete pid1's assessment while claiming it belongs to pid2
        res = client.delete(f"/api/assessments/{target_asm}?patient_id={pid2}")
        assert res.status_code == 409

        # The assessment must still exist under pid1
        get_res = client.get(f"/api/assessments/{target_asm}")
        assert get_res.status_code == 200


def test_delete_assessment_not_found():
    """Deleting a non-existent assessment must return 404."""
    with TestClient(app) as client:
        # We need a valid patient_id to satisfy the endpoint signature
        p_res = client.post("/api/patients", json={"registered_date": "2026-10-10"})
        pid = p_res.json()["patient_id"]
        res = client.delete(f"/api/assessments/DOES-NOT-EXIST-999?patient_id={pid}")
        assert res.status_code == 404


# ─── Archive / Unarchive patient tests ────────────────────────────────────────

def test_archive_and_unarchive_patient():
    """Archiving hides a patient from default search; unarchiving restores them."""
    with TestClient(app) as client:
        # 1. Create a patient
        p_res = client.post("/api/patients", json={"registered_date": "2026-10-10", "age": 52, "sex": "Female"})
        assert p_res.status_code == 200
        pid = p_res.json()["patient_id"]

        # Initially active: present in default search
        active_list = client.get("/api/patients").json()
        assert any(p["patientId"] == pid for p in active_list)

        # 2. Archive the patient
        arc_res = client.post(f"/api/patients/{pid}/archive", json={"is_archived": True})
        assert arc_res.status_code == 200
        assert arc_res.json()["is_archived"] is True

        # Patient detail shows is_archived = True
        detail_res = client.get(f"/api/patients/{pid}")
        assert detail_res.status_code == 200
        assert detail_res.json()["is_archived"] is True

        # Default search excludes the archived patient
        hidden_list = client.get("/api/patients").json()
        assert not any(p["patientId"] == pid for p in hidden_list)

        # Search with include_archived=true includes the archived patient
        inc_list = client.get("/api/patients?include_archived=true").json()
        matched = [p for p in inc_list if p["patientId"] == pid]
        assert len(matched) == 1
        assert matched[0]["isArchived"] is True

        # 3. Unarchive the patient via POST
        unarc_res = client.post(f"/api/patients/{pid}/archive", json={"is_archived": False})
        assert unarc_res.status_code == 200
        assert unarc_res.json()["is_archived"] is False

        # Patient detail shows is_archived = False
        detail_after = client.get(f"/api/patients/{pid}").json()
        assert detail_after["is_archived"] is False

        # Patient is back in default search
        restored_list = client.get("/api/patients").json()
        assert any(p["patientId"] == pid for p in restored_list)

        # 4. Unarchive also works via PATCH
        # Re-archive first
        client.post(f"/api/patients/{pid}/archive", json={"is_archived": True})
        # Unarchive via PATCH
        patch_res = client.patch(f"/api/patients/{pid}/archive", json={"is_archived": False})
        assert patch_res.status_code == 200
        assert patch_res.json()["is_archived"] is False

        detail_patch = client.get(f"/api/patients/{pid}").json()
        assert detail_patch["is_archived"] is False


def test_archive_patient_not_found():
    """Archiving a non-existent patient returns 404."""
    with TestClient(app) as client:
        res = client.post("/api/patients/DOES-NOT-EXIST-999/archive", json={"is_archived": True})
        assert res.status_code == 404
