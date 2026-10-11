import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, User, Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Header from '../components/layout/Header';
import AssessmentReview from '../components/assessment/AssessmentReview';
import { countFilledFeatures, getMissingRequiredFeatures, TOTAL_FEATURES } from '../utils/featureDefinitions';
import { runPrediction } from '../services/predictionService';
import { saveAssessment, completeAssessment, getAssessment } from '../services/assessmentService';

export default function ReviewAssessmentPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Retrieve state from navigation or session cache
  const navState = location.state || {};
  let cachedData = null;
  try {
    const raw = sessionStorage.getItem('corvex_assessment_draft');
    if (raw) cachedData = JSON.parse(raw);
  } catch {
    // ignore
  }

  const assessmentId = navState.assessmentId || cachedData?.assessmentId;
  const version = navState.version || cachedData?.version || 1;
  const patientId = navState.patientId || cachedData?.patientId;
  const assessmentDate = navState.assessmentDate || cachedData?.assessmentDate;
  const formData = navState.formData || cachedData?.formData;
  const isDemo = navState.isDemo !== undefined ? navState.isDemo : (cachedData?.isDemo || false);
  const completedStages = navState.completedStages || cachedData?.completedStages || [1, 2, 3, 4, 5, 6, 7];

  const [predicting, setPredicting] = useState(false);
  const [predError, setPredError] = useState('');

  if (!formData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
        <div className="loading-overlay" style={{ flex: 1 }}>
          <p>No assessment data found. Please start a new assessment.</p>
          <button className="btn btn-primary" onClick={() => navigate('/assessment/new')}>
            Start New Assessment
          </button>
        </div>
      </div>
    );
  }

  const filledCount = countFilledFeatures(formData);
  const missingRequired = getMissingRequiredFeatures(formData);
  const isReadyToPredict = missingRequired.length === 0;

  // Navigate directly back to a specific stage to edit
  const handleEditStage = (stageNum) => {
    try {
      sessionStorage.setItem(
        'corvex_assessment_draft',
        JSON.stringify({
          assessmentId,
          version,
          patientId,
          assessmentDate,
          formData,
          isDemo,
          completedStages,
          currentStage: stageNum,
        })
      );
    } catch {
      // ignore
    }

    navigate('/assessment/new', {
      state: {
        assessmentId,
        version,
        patientId,
        assessmentDate,
        formData,
        isDemo,
        completedStages: completedStages.length > 0 ? completedStages : [1, 2, 3, 4, 5, 6, 7],
        resumeStage: stageNum,
      },
    });
  };

  // Back to Assessment button: take user directly to Stage 7 (the last stage) with all data preserved
  const handleBackToAssessment = () => {
    try {
      sessionStorage.setItem(
        'corvex_assessment_draft',
        JSON.stringify({
          assessmentId,
          version,
          patientId,
          assessmentDate,
          formData,
          isDemo,
          completedStages,
          currentStage: 7,
        })
      );
    } catch {
      // ignore
    }

    navigate('/assessment/new', {
      state: {
        assessmentId,
        version,
        patientId,
        assessmentDate,
        formData,
        isDemo,
        completedStages: completedStages.length > 0 ? completedStages : [1, 2, 3, 4, 5, 6, 7],
        resumeStage: 7,
      },
    });
  };

  const handleRunPrediction = async () => {
    if (!isReadyToPredict) return;

    setPredicting(true);
    setPredError('');

    try {
      // 1. Save final draft before prediction
      //    If we have a persistent assessmentId, fetch its current version from the
      //    database first. The navState.version can be stale (set when the user
      //    navigated here after many autosaves), which was the cause of the
      //    "Out of order save rejected" error.
      if (assessmentId && assessmentId.startsWith('ASM-') && !assessmentId.startsWith('ASM-LOCAL')) {
        try {
          const latestAsm = await getAssessment(assessmentId);
          const latestVersion = latestAsm?.version ?? version;
          await saveAssessment(assessmentId, {
            assessmentId,
            patientId,
            assessmentDate,
            currentStage: 7,
            completedStages: [1, 2, 3, 4, 5, 6, 7],
            isDemo,
            features: formData,
            version: latestVersion,
          });
        } catch (saveErr) {
          // Pre-prediction save failure is non-fatal: data is already persisted
          // from autosaves during form filling. Log and continue to prediction.
          console.warn('Pre-prediction save failed (non-fatal):', saveErr);
        }
      }

      // 2. Run real prediction via ML pipeline
      const result = await runPrediction(patientId, assessmentDate, formData);

      // 3. Mark completed and store actual outputs in SQLite database
      if (assessmentId) {
        try {
          await completeAssessment(assessmentId, result);
        } catch (dbErr) {
          console.warn('Could not mark completed in DB:', dbErr);
        }
      }

      // 4. Clear active session draft now that assessment is finished
      try {
        sessionStorage.removeItem('corvex_assessment_draft');
      } catch {
        // ignore
      }

      navigate('/results', {
        state: {
          prediction: result,
          patientId,
          assessmentDate,
          formData,
          isDemo,
          assessmentId,
        },
      });
    } catch (err) {
      console.error('Prediction failed:', err);
      if (err instanceof TypeError) {
        // fetch() throws TypeError when the server cannot be reached at all
        setPredError('Cannot reach the prediction server. Check that the backend is running, then try again. Your data has been preserved.');
      } else {
        setPredError(`The prediction could not be completed${err?.message ? `: ${err.message}` : ''}. Your data has been preserved.`);
      }
    } finally {
      setPredicting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />

      <div className="assessment-content" style={{ flex: 1 }}>
        <div className="container-narrow">
          {/* Review header */}
          <div style={{ marginBottom: '24px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleBackToAssessment}
              id="btn-back-to-assessment"
              style={{ marginBottom: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={16} /> Back to Assessment (Stage 7)
            </button>

            <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, marginBottom: '12px' }}>
              Review Assessment
            </h1>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={14} /> <strong>Patient ID:</strong> {patientId}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} /> <strong>Assessment Date:</strong> {assessmentDate}
              </span>
              {isDemo && <span className="badge badge-demo">DEMO / SYNTHETIC DATA</span>}
              <span style={{ color: 'var(--text-tertiary)' }}>
                {filledCount} / {TOTAL_FEATURES} features completed
              </span>
            </div>
          </div>

          {/* Missing Required Warning Banner */}
          {!isReadyToPredict && (
            <div
              className="card"
              style={{
                borderColor: 'var(--color-danger)',
                background: 'rgba(239, 68, 68, 0.06)',
                padding: '20px',
                marginBottom: '24px',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-danger)', fontWeight: 700, fontSize: 'var(--font-md)' }}>
                <AlertTriangle size={20} />
                Action Required: {missingRequired.length} Necessary Field{missingRequired.length > 1 ? 's' : ''} Missing
              </div>
              <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-primary)', marginTop: '8px', marginBottom: '14px' }}>
                The Run Prediction button is disabled until all required fields (marked with a red <span style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}>*</span>) are answered:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {missingRequired.map((feat) => (
                  <button
                    key={feat.key}
                    type="button"
                    onClick={() => handleEditStage(feat.stage)}
                    className="btn btn-outline btn-sm"
                    style={{
                      borderColor: 'var(--color-danger)',
                      color: 'var(--color-danger)',
                      background: '#fff',
                      fontSize: 'var(--font-xs)',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    Stage {feat.stage}: {feat.label} →
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ready Banner */}
          {isReadyToPredict && (
            <div
              className="card"
              style={{
                borderColor: 'var(--color-success)',
                background: 'var(--color-success-bg)',
                padding: '16px 20px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <CheckCircle2 size={22} color="var(--color-success)" />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--color-success)', fontSize: 'var(--font-sm)' }}>
                  All Required Fields Completed
                </div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
                  You are ready to generate CAD risk predictions.
                </div>
              </div>
            </div>
          )}

          {/* Review content */}
          <AssessmentReview
            formData={formData}
            patientId={patientId}
            assessmentDate={assessmentDate}
            isDemo={isDemo}
            onEditStage={handleEditStage}
          />

          {/* Disclaimer */}
          <div className="disclaimer" style={{ marginTop: '16px', marginBottom: '16px' }}>
            For educational and decision-support purposes only. Not a diagnosis or a substitute for professional medical evaluation.
          </div>

          {/* Run Prediction */}
          <div className="card" style={{ textAlign: 'center', padding: '32px', marginBottom: '32px' }}>
            <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, marginBottom: '8px' }}>
              Run CAD Risk Prediction
            </h3>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              {isReadyToPredict
                ? `Ready to submit ${filledCount} features for prediction analysis.`
                : `Fill all ${missingRequired.length} missing required field(s) above to enable prediction.`}
            </p>

            {predError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginBottom: '16px', color: 'var(--color-danger)', fontSize: 'var(--font-sm)' }}>
                <AlertTriangle size={16} />
                {predError}
              </div>
            )}

            <button
              className="btn btn-primary btn-lg"
              onClick={handleRunPrediction}
              disabled={!isReadyToPredict || predicting}
              id="btn-run-prediction"
              style={{
                opacity: !isReadyToPredict ? 0.55 : 1,
                cursor: !isReadyToPredict ? 'not-allowed' : 'pointer',
              }}
            >
              {predicting ? (
                <>
                  <span className="spinner" style={{ width: 18, height: 18 }} />
                  Generating assessment...
                </>
              ) : !isReadyToPredict ? (
                <>
                  <AlertTriangle size={20} /> Fill Required Fields to Enable ({missingRequired.length} Missing)
                </>
              ) : (
                <>
                  <Play size={20} /> Run Prediction
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
