# CORVEX — Cardiovascular Risk Visualization & Prediction

> **Clinical Disclaimer:** CORVEX predictions are for educational and decision-support purposes only. They are not a substitute for formal diagnostic imaging, laboratory investigation, or clinical judgment by a qualified healthcare professional.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Prerequisites](#3-prerequisites)
4. [Installation & Configuration](#4-installation--configuration)
5. [Running the Complete Application](#5-running-the-complete-application)
6. [Application URLs & Endpoints](#6-application-urls--endpoints)
7. [ML Models & Inference](#7-ml-models--inference)
8. [Database](#8-database)
9. [Running Tests](#9-running-tests)
10. [Troubleshooting](#10-troubleshooting)
11. [Project Structure](#11-project-structure)
12. [License & Attribution](#12-license--attribution)

---

## 1. Project Overview

CORVEX is a full-stack cardiovascular risk prediction platform built for the Multimodal AI Hackathon. It accepts structured clinical data for a patient, runs it through four trained machine-learning models, and presents the results in an interactive interface that includes a real-time 3D anatomical heart visualization.

### Key Features

| Feature | Description |
| :--- | :--- |
| **Seven-Stage Clinical Input Workflow** | Stage 1: Demographics -> Stage 2: Medical History -> Stage 3: Vitals -> Stage 4: Symptoms -> Stage 5: ECG -> Stage 6: Laboratory -> Stage 7: Echocardiography |
| **CAD Prediction** | Binary classification: Coronary Artery Disease detected vs. Normal |
| **Vessel Stenosis Prediction** | Independent predictions for LAD (Left Anterior Descending), LCX (Left Circumflex), and RCA (Right Coronary Artery) |
| **Interactive 3D Coronary Visualization** | Anatomically accurate BodyParts3D heart model rendered with Three.js / React Three Fiber. Vessel colors adapt to predicted risk: red (high), amber (moderate), green (low). |
| **Clinical Explanation** | SHAP feature contribution charts explaining each prediction |
| **Patient Record Management** | Create, search, archive, and review patient records and assessment histories |
| **In-Progress Assessment Drafts** | Assessments are auto-saved stage-by-stage and can be resumed |

### Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, Vite 8, React Router DOM 7, Three.js 0.186, React Three Fiber 9 |
| **Backend API** | Python, FastAPI 0.143, Uvicorn 0.54, Pydantic v2 |
| **Database** | SQLite (embedded, file-based, no server required) |
| **ML Pipeline** | scikit-learn 1.8, XGBoost 3.4, SHAP 0.53, LIME 0.2, joblib |

---

## 2. Architecture

```
Browser (React / Vite)
    |
    |  HTTP  (default: http://127.0.0.1:8000)
    v
FastAPI Backend  (backend/app/main.py)
    |   |-- Prediction route (/api/predict)
    |   |       |__ loads ml/ models directly in-process
    |   |           (backend/app/predictor.py  ->  ml/src/predict.py)
    |   |           (backend/app/explainer.py  ->  ml/src/explain.py)
    |   |-- Patient & assessment CRUD  (/api/patients, /api/assessments)
    |   |__ Static report files served at /reports/*
    |
    |__ SQLite database  (backend/corvex.db)
            |-- patients table
            |__ assessments table
```

**Important:** The backend and ML inference pipeline run in the **same Python process** using the **same virtual environment**. There is no separate ML server. When the backend starts, it loads all four trained model pipelines into memory and keeps them warm for fast inference.

---

## 3. Prerequisites

### Python
- **Required:** Python **3.10 or later** (tested with 3.10.11 and 3.13.7)
- Download from [python.org](https://www.python.org/downloads/)
- Verify: `python --version`

### Node.js & npm
- **Required:** Node.js **18.0 or later** (tested with v24.14.1), npm **9.0 or later** (tested with 11.11.0)
- Download from [nodejs.org](https://nodejs.org/)
- Verify: `node --version` and `npm --version`

### Database
- **No external database server is required.** CORVEX uses SQLite, which is embedded in Python's standard library. The database file (`backend/corvex.db`) is created automatically when the backend first starts.

### Git
- Required to clone the repository.
- Verify: `git --version`

---

## 4. Installation & Configuration

All commands below assume you are running **Windows PowerShell** from the repository root (`corvex/`) unless stated otherwise.

### Step 1 - Clone the repository

```powershell
git clone https://github.com/<your-username>/corvex.git
cd corvex
```

### Step 2 - Create the Python virtual environment

```powershell
python -m venv .venv
```

### Step 3 - Activate the virtual environment

```powershell
# Windows (PowerShell)
.venv\Scripts\Activate.ps1

# Windows (Command Prompt)
.venv\Scripts\activate.bat

# macOS / Linux
source .venv/bin/activate
```

You should see `(.venv)` at the start of your shell prompt.

### Step 4 - Install Python dependencies

```powershell
pip install -r requirements.txt
```

This installs all packages required by both the FastAPI backend and the ML inference pipeline in one step.

> **Note:** `ml/requirements.txt` is the standalone ML-only dependency file used when working on the ML pipeline in isolation (retraining, EDA, etc.). You do **not** need to install it separately when running the full application. The root `requirements.txt` already covers all ML dependencies.

### Step 5 - Install frontend (JavaScript) dependencies

```powershell
cd frontend
npm install
cd ..
```

Alternatively, from the repository root:

```powershell
npm --prefix frontend install
```

### Step 6 - Configure environment variables

The repository includes a `.env` file at the root. The frontend Vite configuration (`frontend/vite.config.js`) has `envDir: '../'` configured, so Vite automatically reads this root `.env` file during development and build. The default configuration points the frontend to the backend API running on port 8000.

The `.env` file should contain:

```
VITE_API_URL=http://127.0.0.1:8000
```

**Optional variables (not required for standard operation):**

| Variable | Default | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `http://127.0.0.1:8000` | URL of the backend API |
| `VITE_USE_MOCK` | (unset / false) | Set to `true` to run the frontend without the backend using generated mock data |
| `CORVEX_DB_PATH` | `backend/corvex.db` | Override the SQLite database file location |

### Step 7 - Database

**No setup command is required.** The SQLite database is created and seeded automatically when the backend starts for the first time. If `backend/corvex.db` does not exist, `init_db()` creates the `patients` and `assessments` tables and populates three demonstration patient records.

---

## 5. Running the Complete Application

The application requires **two terminals** running simultaneously.

### Terminal 1 - Backend API (Python / FastAPI)

Run from the **repository root** (`corvex/`):

```powershell
# Activate the virtual environment first (if not already active)
.venv\Scripts\Activate.ps1

# Start the backend
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

You should see output like:

```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Loading models...
INFO:     Models loaded.
INFO:     Application startup complete.
```

> **Why run from the root?** `backend/app/predictor.py` resolves the ML module path relative to the project root (`PROJECT_ROOT = Path(__file__).resolve().parents[2]`). Running from any other directory will break the ML model import path.

### Terminal 2 - Frontend (React / Vite)

Run from the **frontend directory** (`corvex/frontend/`):

```powershell
cd frontend
npm run dev
```

Alternatively, run from the repository root:

```powershell
npm --prefix frontend run dev
```

You should see:

```
  VITE v8.x.x  ready in xxx ms

  ->  Local:   http://localhost:5173/
```

Open your browser and navigate to **http://localhost:5173**.

### Startup Order

The backend must be started before using the frontend. The frontend will still load without the backend, but prediction requests and patient record operations will fail until the backend is running.

---

## 6. Application URLs & Endpoints

| URL | Description |
| :--- | :--- |
| `http://localhost:5173` | Frontend - main application entry point |
| `http://127.0.0.1:8000/health` | Backend health check - returns `{"status": "ok", "models_loaded": true}` |
| `http://127.0.0.1:8000/docs` | Interactive API documentation (Swagger UI) |
| `http://127.0.0.1:8000/redoc` | Alternative API documentation (ReDoc) |
| `http://127.0.0.1:8000/api/schema` | Feature schema (input names, units, defaults, normal ranges) |
| `http://127.0.0.1:8000/api/samples` | Sample patient test cases |
| `http://127.0.0.1:8000/api/model-info` | Model card: CV results, thresholds, best model per target |
| `http://127.0.0.1:8000/api/evaluation` | Model evaluation report JSON |
| `http://127.0.0.1:8000/reports/*.png` | Static SHAP, LIME, ROC, calibration plot images |

### Frontend Routes

| URL | Page |
| :--- | :--- |
| `/` | Landing page |
| `/search` | Patient search and management |
| `/assessment/new` | Start a new seven-stage assessment |
| `/assessment/continue/:patientId` | Resume a saved assessment |
| `/assessment/review` | Review all entered data before submitting |
| `/results` | Prediction results with 3D visualization and SHAP explanations |
| `/patient/:patientId` | Individual patient detail and assessment history |

---

## 7. ML Models & Inference

### Trained Model Files

The four pre-trained model pipelines are located in `ml/models/` and are included in the repository:

| File | Target | Best Model | Nested CV AUC | Test AUC |
| :--- | :--- | :--- | :--- | :--- |
| `ml/models/Cath_pipeline.joblib` | Overall CAD | Random Forest | 0.926 +/- 0.035 | 0.817 |
| `ml/models/LAD_pipeline.joblib` | LAD Stenosis | Random Forest | 0.847 +/- 0.041 | 0.736 |
| `ml/models/LCX_pipeline.joblib` | LCX Stenosis | Random Forest | 0.726 +/- 0.052 | 0.763 |
| `ml/models/RCA_pipeline.joblib` | RCA Stenosis | Logistic Regression | 0.723 +/- 0.052 | 0.738 |

Additional model artifacts in `ml/models/`:

| File | Purpose |
| :--- | :--- |
| `feature_schema.json` | All 50 input feature definitions: labels, units, types, defaults, normal ranges |
| `model_card.json` | CV results, decision thresholds, preprocessing configuration |
| `sample_patients.json` | Five demonstration test cases |
| `split_indices.json` | Fixed train/test split indices (for reproducibility) |

### Does a new developer need to train models?

**No.** All four models are pre-trained and saved. A new developer can clone the repository and run inference immediately using the existing `.joblib` files.

### How the backend loads models

When the backend starts, the lifespan event in `backend/app/main.py` calls `predictor.warmup()`, which:

1. Loads all four `.joblib` pipelines into memory via `joblib.load()`
2. Builds SHAP `TreeExplainer` / `LinearExplainer` instances for each model using the training data reference set (`ml/data/processed/features.csv`)
3. Runs one warm-up prediction to pre-JIT any lazy-loaded code paths

Subsequent prediction requests (`POST /api/predict`) are served from memory without reloading models.

### Decision Thresholds

Each model uses a fixed decision threshold calibrated for high-sensitivity clinical screening (recall >= 0.90):

| Target | Threshold |
| :--- | :--- |
| CAD (Overall) | 0.504 |
| LAD | 0.437 |
| LCX | 0.384 |
| RCA | 0.346 |

### Risk Color Coding

Vessel colors in the 3D viewer adapt to the predicted probability:

| Risk Level | Condition | Color |
| :--- | :--- | :--- |
| **High / Stenosis Detected** | probability >= threshold + margin | `#ef4444` (Crimson / Red) |
| **Moderate Risk** | probability >= threshold | `#f59e0b` (Amber / Yellow) |
| **Low Risk / Normal** | probability < threshold | `#10b981` (Emerald / Green) |

### Optional: Re-running the ML Pipeline

If you want to retrain models or reproduce experiments from the `ml/` directory (virtual environment must be active):

```powershell
cd ml

python -m src.data       # Step 1: Preprocess raw data
python -m src.schema     # Step 2: Generate feature schema
python -m src.train      # Step 3: Train all four models (nested CV, ~8 minutes)
python -m src.evaluate   # Step 4: Evaluate models on the held-out test set
python -m src.explain    # Step 5: Generate SHAP and LIME explanations

# Or run all steps in sequence on Windows:
run.bat all
```

Raw training data: `ml/data/raw/extention of Z-Alizadeh sani dataset.xlsx`
Dataset: Z-Alizadeh Sani cohort - 303 cardiac catheterization patients, 50 features, Tehran Heart Center (2011-2012).

---

## 8. Database

### Technology

CORVEX uses **SQLite** via Python's built-in `sqlite3` module. No database server installation, Docker, or external service is needed.

### Database File Location

| Location | Purpose |
| :--- | :--- |
| `backend/corvex.db` | Default database (created automatically on first backend startup) |
| Custom path | Set `CORVEX_DB_PATH` environment variable to override |

### Schema

**`patients` table**

| Column | Type | Description |
| :--- | :--- | :--- |
| `patient_id` | TEXT (UNIQUE) | Human-readable ID (format: `CV-YYYY-NNNN`) |
| `registered_date` | TEXT | ISO 8601 registration date |
| `age` | INTEGER | Patient age |
| `sex` | TEXT | `Male` or `Female` |
| `is_archived` | INTEGER | `0` = active, `1` = archived |
| `created_at`, `updated_at` | TEXT | UTC ISO 8601 timestamps |

**`assessments` table**

| Column | Type | Description |
| :--- | :--- | :--- |
| `assessment_id` | TEXT (UNIQUE) | Auto-generated assessment identifier |
| `patient_id` | TEXT (FK) | References `patients.patient_id` with `ON DELETE CASCADE` |
| `status` | TEXT | `in_progress` or `completed` |
| `current_stage` | INTEGER | Last completed stage (1-7) |
| `features` | TEXT (JSON) | All clinical input values as serialized JSON |
| `prediction_result` | TEXT (JSON) | Complete prediction output including probabilities and SHAP values |
| `model_version` | TEXT | Model version string (default `"1.0"`) |
| `version` | INTEGER | Optimistic concurrency version counter |

### Initialization

`init_db()` is called automatically at startup. It:
- Creates both tables if they do not exist (idempotent - safe to call on every startup)
- Creates five indexes for fast patient search and assessment lookup
- Seeds three demonstration patients with completed assessments if the database is empty

### Persistence

The database persists between server restarts. Patient records and completed assessments are retained as long as `backend/corvex.db` is not deleted.

> **Note:** `backend/corvex.db` is not in `.gitignore`. If you do not want to commit database contents to GitHub, add `*.db` to `.gitignore`.

---

## 9. Running Tests

### ML tests

Run from the **repository root** (`corvex/`):

```powershell
python -m pytest ml/tests/ -v
```

Tests cover: data leakage prevention, feature schema correctness, drop column enforcement, risk level bands, and prediction shape.

### Backend API tests

Run from the **repository root** (`corvex/`):

```powershell
python -m pytest backend/tests/ -v
```

Tests cover: health check, prediction endpoint, SHAP explanations, input validation, and patient/assessment CRUD. Requires `httpx` (included in `requirements.txt`).

### Frontend linting

Run from the **frontend directory** (`corvex/frontend/`):

```powershell
cd frontend
npm run lint
```

Or from the repository root:

```powershell
npm --prefix frontend run lint
```

---

## 10. Troubleshooting

### `ModuleNotFoundError: No module named 'fastapi'` or `No module named 'src'`

The virtual environment is not activated, or you installed dependencies in the wrong Python environment.

```powershell
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Backend fails to start with `No module named 'backend'`

You are running `uvicorn` from the wrong directory. Always run from the **repository root** (`corvex/`):

```powershell
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

### `Cannot reach the prediction server. Is the backend running?`

The backend is not running or is on a different port. Verify the backend terminal shows `Uvicorn running on http://127.0.0.1:8000` and confirm `.env` contains `VITE_API_URL=http://127.0.0.1:8000`.

### Model files not found (`FileNotFoundError: ml/models/Cath_pipeline.joblib`)

The trained `.joblib` files are committed to the repository and should be present after cloning. If missing, retrain using `python -m src.train` from the `ml/` directory.

### `GET /api/evaluation` returns 500

The `ml/reports/evaluation_report.json` file is required. It is committed to the repository. If missing, regenerate using `python -m src.evaluate` from the `ml/` directory.

### SHAP warm-up is slow on first startup

Building SHAP explainers on first startup typically takes 5-15 seconds. This is normal. Subsequent requests are fast.

### PowerShell execution policy error

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then re-run `.venv\Scripts\Activate.ps1`.

### Python version incompatibility with SHAP or XGBoost

Some releases may lack pre-compiled wheels for Python 3.13+. If `pip install` fails, use Python 3.10, 3.11, or 3.12.

---

## 11. Project Structure

```
corvex/
|-- .env                          # Root environment variables (loaded by Vite via envDir)
|-- .gitignore
|-- README.md
|-- requirements.txt              # Root Python requirements (backend + ML, one shared venv)
|
|-- frontend/                     # Dedicated React / Vite frontend
|   |-- .oxlintrc.json            # Frontend Oxlint configuration
|   |-- index.html                # Vite HTML entry point
|   |-- package.json              # Frontend npm dependencies and scripts
|   |-- package-lock.json         # Locked npm dependency tree
|   |-- vite.config.js            # Vite configuration (envDir: '../')
|   |
|   |-- public/
|   |   |-- favicon.svg
|   |   |-- icons.svg
|   |   |__ heart_obj/            # BodyParts3D anatomical mesh files (.obj)
|   |       |-- heart_body.obj
|   |       |-- lad.obj
|   |       |-- lcx.obj
|   |       |__ rca.obj
|   |
|   |-- src/                      # React frontend source
|       |-- main.jsx
|       |-- App.jsx               # Router and page mapping
|       |-- index.css             # Global design system and CSS variables
|       |-- pages/
|       |   |-- LandingPage.jsx
|       |   |-- NewAssessmentPage.jsx  # Seven-stage assessment form
|       |   |-- ReviewAssessmentPage.jsx
|       |   |-- ResultsPage.jsx        # 3D viewer + prediction cards + SHAP
|       |   |-- SearchPatientPage.jsx
|       |   |__ PatientDetailPage.jsx
|       |-- components/
|       |   |-- assessment/       # Stage 1-7 input form components
|       |   |-- layout/
|       |   |-- results/          # OverallPredictionCard, VesselPredictionCards, ExplanationPanel
|       |   |__ visualization/    # HeartVisualization.jsx, ActualHeartModel.jsx
|       |-- services/             # API client, assessment service, patient service
|       |-- utils/                # featureDefinitions.js, riskColor.js, validation.js
|       |__ data/                 # demoPatient.js, mockPrediction.js
|
|-- backend/
|   |-- app/
|   |   |-- main.py               # FastAPI application, all API routes
|   |   |-- predictor.py          # Bridges backend to ml/src/predict.py
|   |   |-- explainer.py          # SHAP explainer builder and inference
|   |   |__ db.py                 # SQLite database: schema, CRUD, seeding
|   |__ tests/
|       |-- tests_api.py          # FastAPI endpoint tests
|       |__ test_persistence.py   # Database persistence tests
|
|__ ml/
    |-- README_ML.md              # ML-specific documentation (methodology, API contract)
    |-- requirements.txt          # ML-only dependencies (for standalone ML work)
    |-- run.bat                   # Windows batch script for ML pipeline stages
    |-- src/
    |   |-- config.py             # Paths, constants, feature configuration
    |   |-- data.py               # Data loading, cleaning, splitting
    |   |-- schema.py             # Feature schema generation
    |   |-- train.py              # Nested CV model training
    |   |-- evaluate.py           # Test-set evaluation and plots
    |   |-- explain.py            # SHAP and LIME explanation generation
    |   |__ predict.py            # predict_patient() inference API
    |-- models/
    |   |-- Cath_pipeline.joblib  # Trained CAD model
    |   |-- LAD_pipeline.joblib   # Trained LAD stenosis model
    |   |-- LCX_pipeline.joblib   # Trained LCX stenosis model
    |   |-- RCA_pipeline.joblib   # Trained RCA stenosis model
    |   |-- feature_schema.json
    |   |-- model_card.json
    |   |-- sample_patients.json
    |   |__ split_indices.json
    |-- data/
    |   |-- raw/                  # Original Excel training dataset
    |   |__ processed/            # features.csv, targets.csv, split.json
    |-- reports/                  # evaluation_report.json, explainability_summary.json, plots
    |-- notebooks/
    |__ tests/
```

---

## 12. License & Attribution

- **CORVEX Project:** Cardiovascular Risk Prediction System. Built for the Multimodal AI Hackathon (Track A).
- **Anatomical 3D Assets:** BodyParts3D (c) Database Center for Life Science (DBCLS), licensed under [Creative Commons Attribution-ShareAlike 2.1 Japan (CC BY-SA 2.1 JP)](https://creativecommons.org/licenses/by-sa/2.1/jp/).
- **Training Dataset:** Extension of Z-Alizadeh Sani dataset - Tehran Heart Center cardiac catheterization registry (303 patients, 2011-2012).

### 3D Anatomical Mesh Provenance

Anatomical meshes were sourced from **BodyParts3D 4.0** using Foundational Model of Anatomy (FMA) concept IDs:

| Structure | FMA ID | Description |
| :--- | :--- | :--- |
| Heart body | FMA7088 | Myocardium, ventricles, and atria (FJ2417-FJ2439) |
| LAD artery | FMA3862 | Anterior interventricular branch of LCA (FJ2631-FJ2648) |
| LCX artery | FMA3895 | Circumflex branch of LCA (FJ2649-FJ2654) |
| RCA tree | FMA50039 | Right coronary artery tree (FJ2667-FJ2723) |

Meshes are centered at the heart bounding-box midpoint and scaled to approximately [-1.0, 1.0] Three.js units. Axis remapping: Three.js X = BP3D X, Three.js Y (up) = BP3D Z, Three.js Z (anterior) = -BP3D Y.
