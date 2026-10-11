@echo off
REM run.bat — ML Module runner for Windows
REM Usage: run.bat [command]

if "%1"=="" goto help
if "%1"=="install" goto install
if "%1"=="data" goto data
if "%1"=="train" goto train
if "%1"=="evaluate" goto evaluate
if "%1"=="explain" goto explain
if "%1"=="predict" goto predict
if "%1"=="test" goto test
if "%1"=="all" goto all
goto help

:install
pip install -r requirements.txt
goto end

:data
python -m src.data
python -m src.schema
goto end

:train
python -m src.train
goto end

:evaluate
python -m src.evaluate
goto end

:explain
python -m src.explain
goto end

:predict
python -m src.predict
goto end

:test
python -m pytest tests/ -v
goto end

:all
echo === Step 1/6: Data ===
python -m src.data
echo === Step 2/6: Schema ===
python -m src.schema
echo === Step 3/6: Train ===
python -m src.train
echo === Step 4/6: Evaluate ===
python -m src.evaluate
echo === Step 5/6: Explain ===
python -m src.explain
echo === Step 6/6: Test ===
python -m pytest tests/ -v
echo === DONE ===
goto end

:help
echo Usage: run.bat [command]
echo.
echo Commands:
echo   install   - Install Python dependencies
echo   data      - Clean data + generate schema
echo   train     - Train models (nested CV, ~8 min)
echo   evaluate  - Run test-set evaluation + plots
echo   explain   - Generate SHAP + LIME explanations
echo   predict   - Demo predictions with sample patients
echo   test      - Run all pytest tests
echo   all       - Run full pipeline end-to-end

:end
