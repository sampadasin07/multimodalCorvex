import json
import os
import logging
import time
from contextlib import asynccontextmanager
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import db, predictor

logger = logging.getLogger("cardiorisk")

DISCLAIMER = (
    "For decision support and educational purposes only. "
    "Not a substitute for formal diagnostic imaging or clinical judgment."
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    predictor.warmup()      # runs once when the server starts
    db.init_db()            # initializes tables, indexes, and initial seeds
    yield


app = FastAPI(title="CardioRisk API", version="0.1.0", lifespan=lifespan)

# Lets the frontend (a different port) call this API
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,    # fine for a hackathon; tighten later
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serves ml/reports/*.png at http://localhost:8000/reports/<file>.png
app.mount("/reports", StaticFiles(directory=str(predictor.cfg.REPORTS_DIR)), name="reports")


class PredictRequest(BaseModel):
    features: dict[str, Any]


class PatientCreateRequest(BaseModel):
    patient_id: Optional[str] = None
    registered_date: Optional[str] = None
    age: Optional[int] = None
    sex: Optional[str] = None


class AssessmentCreateRequest(BaseModel):
    patient_id: str
    assessment_date: Optional[str] = None
    is_demo: bool = False
    current_stage: int = 1
    features: Optional[dict[str, Any]] = None


class AssessmentUpdateRequest(BaseModel):
    current_stage: Optional[int] = None
    completed_stages: Optional[list[int]] = None
    features: Optional[dict[str, Any]] = None
    is_demo: Optional[bool] = None
    version: Optional[int] = None


class AssessmentCompleteRequest(BaseModel):
    prediction_result: dict[str, Any]
    model_version: Optional[str] = "1.0"


class PatientArchiveRequest(BaseModel):
    is_archived: Optional[bool] = None



@app.get("/")
def root():
    return {
        "message": "CORVEX CardioRisk API is running",
        "frontend": "http://localhost:5173",
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health")
def health():
    return {"status": "ok", "models_loaded": True}


@app.get("/api/schema")
def get_schema():
    return predictor.SCHEMA


@app.get("/api/samples")
def get_samples():
    return predictor.SAMPLES


@app.get("/api/model-info")
def get_model_info():
    return predictor.MODEL_CARD


@app.get("/api/evaluation")
def evaluation():
    with open(predictor.cfg.REPORTS_DIR / "evaluation_report.json", encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/explainability")
def explainability():
    with open(predictor.cfg.REPORTS_DIR / "explainability_summary.json", encoding="utf-8") as f:
        return json.load(f)


@app.post("/api/predict")
def predict(payload: PredictRequest, include_shap: bool = True):
    cleaned, errors, warnings = predictor.clean_input(payload.features)
    if errors:
        raise HTTPException(status_code=422, detail=errors)
    start = time.perf_counter()
    try:
        result = predictor.run(cleaned, include_shap=include_shap)
    except Exception:
        logger.exception("Prediction failed")
        raise HTTPException(
            status_code=500,
            detail="Prediction failed. Please check the input values.",
        )
    result["warnings"] = warnings
    result["disclaimer"] = DISCLAIMER
    result["processing_ms"] = round((time.perf_counter() - start) * 1000)
    return result


# --- Persistent Database Endpoints ---


@app.get("/api/patients")
def get_patients(
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
):
    return db.search_patients(
        query=query,
        sex=sex,
        age_min=age_min,
        age_max=age_max,
        date_from=date_from,
        date_to=date_to,
        overall_cad=overall_cad,
        lad=lad,
        lcx=lcx,
        rca=rca,
        include_archived=include_archived,
    )


@app.post("/api/patients")
def create_patient(payload: PatientCreateRequest):
    return db.create_or_get_patient(
        patient_id=payload.patient_id,
        registered_date=payload.registered_date,
        age=payload.age,
        sex=payload.sex,
    )


@app.get("/api/patients/{patient_id}")
def get_patient(patient_id: str):
    p = db.get_patient_by_id(patient_id)
    if not p:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
    history = db.get_patient_assessment_history(patient_id)
    p["assessmentHistory"] = history
    return p


@app.api_route("/api/patients/{patient_id}/archive", methods=["POST", "PATCH"])
def archive_patient(
    patient_id: str,
    payload: Optional[PatientArchiveRequest] = None,
    is_archived: Optional[bool] = None,
):
    target = True
    if is_archived is not None:
        target = is_archived
    elif payload is not None and payload.is_archived is not None:
        target = payload.is_archived

    success = db.archive_patient(patient_id, target)
    if not success:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
    return {"status": "ok", "patient_id": patient_id, "is_archived": target}


@app.delete("/api/patients/{patient_id}")
def delete_patient(patient_id: str):
    """Permanently deletes a patient and all their assessments (CASCADE)."""
    deleted = db.delete_patient(patient_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
    return {"status": "deleted", "patient_id": patient_id}


@app.delete("/api/assessments/{assessment_id}")
def delete_assessment(assessment_id: str, patient_id: str):
    """Permanently deletes a single assessment.

    Requires patient_id as a query parameter to enforce ownership and prevent
    stale or mis-routed requests from deleting the wrong assessment.
    """
    try:
        deleted = db.delete_assessment(assessment_id, patient_id)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=f"Assessment {assessment_id} not found for patient {patient_id}",
        )
    return {"status": "deleted", "assessment_id": assessment_id, "patient_id": patient_id}


@app.get("/api/patients/{patient_id}/resumable")
def get_resumable(patient_id: str):
    p = db.get_patient_by_id(patient_id)
    if not p:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
    return db.get_resumable_assessments(patient_id)


@app.post("/api/assessments")
def create_assessment(payload: AssessmentCreateRequest):
    return db.create_assessment(
        patient_id=payload.patient_id,
        assessment_date=payload.assessment_date,
        is_demo=payload.is_demo,
        current_stage=payload.current_stage,
        features=payload.features,
    )


@app.get("/api/assessments/{assessment_id}")
def get_assessment(assessment_id: str):
    asm = db.get_assessment_by_id(assessment_id)
    if not asm:
        raise HTTPException(status_code=404, detail=f"Assessment {assessment_id} not found")
    return asm


@app.patch("/api/assessments/{assessment_id}")
def update_assessment(assessment_id: str, payload: AssessmentUpdateRequest):
    try:
        return db.update_assessment(
            assessment_id=assessment_id,
            current_stage=payload.current_stage,
            completed_stages=payload.completed_stages,
            features=payload.features,
            is_demo=payload.is_demo,
            client_version=payload.version,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/assessments/{assessment_id}/complete")
def complete_assessment(assessment_id: str, payload: AssessmentCompleteRequest):
    try:
        return db.complete_assessment(
            assessment_id=assessment_id,
            prediction_result=payload.prediction_result,
            model_version=payload.model_version or "1.0",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
