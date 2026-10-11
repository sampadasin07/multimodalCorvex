import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Calendar, User } from 'lucide-react';
import Header from '../components/layout/Header';
import AssessmentStepper from '../components/assessment/AssessmentStepper';
import Stage1Demographics from '../components/assessment/Stage1Demographics';
import Stage2MedicalHistory from '../components/assessment/Stage2MedicalHistory';
import Stage3Vitals from '../components/assessment/Stage3Vitals';
import Stage4Symptoms from '../components/assessment/Stage4Symptoms';
import Stage5ECG from '../components/assessment/Stage5ECG';
import Stage6Laboratory from '../components/assessment/Stage6Laboratory';
import Stage7Echocardiography from '../components/assessment/Stage7Echocardiography';
import { createEmptyFormState, countFilledFeatures, TOTAL_FEATURES } from '../utils/featureDefinitions';
import { validateStage } from '../utils/validation';
import { DEMO_PATIENT } from '../data/demoPatient';
import { findResumableAssessment, saveAssessment, createAssessment } from '../services/assessmentService';

function generatePatientId() {
  const year = new Date().getFullYear();
  const num = String(Math.floor(1000 + Math.random() * 9000));
  return `CV-${year}-${num}`;
}

export default function NewAssessmentPage() {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const isContinue = !!params.patientId;

  // Retrieve initial state from location.state (e.g. from Review page or Edit button)
  // or fall back to sessionStorage draft if available.
  // If fresh: true is passed (from Landing Page "New Assessment"), always start clean.
  const navState = location.state || {};
  const isFreshStart = navState.fresh === true;

  let cachedData = null;
  if (!isFreshStart && !isContinue) {
    try {
      const raw = sessionStorage.getItem('corvex_assessment_draft');
      if (raw) cachedData = JSON.parse(raw);
    } catch {
      // ignore
    }
  }

  // If fresh start, also wipe the stored draft so it doesn't bleed in later
  if (isFreshStart) {
    try {
      sessionStorage.removeItem('corvex_assessment_draft');
    } catch {
      // ignore
    }
  }

  const initialPatientId =
    isFreshStart
      ? navState.patientId || generatePatientId() // use passed patientId or generate new ID on fresh start
      : navState.patientId || cachedData?.patientId || (isContinue ? '' : generatePatientId());
  const initialDate =
    isFreshStart
      ? new Date().toISOString().split('T')[0]
      : navState.assessmentDate || cachedData?.assessmentDate || new Date().toISOString().split('T')[0];
  const initialFormData =
    isFreshStart
      ? createEmptyFormState()
      : navState.formData || cachedData?.formData || createEmptyFormState();
  const initialStage =
    isFreshStart
      ? 1
      : navState.resumeStage || (cachedData?.currentStage && cachedData.currentStage <= 7 ? cachedData.currentStage : 1);
  const initialIsDemo =
    isFreshStart
      ? false
      : navState.isDemo !== undefined ? navState.isDemo : (cachedData?.isDemo || false);
  const initialCompleted =
    isFreshStart
      ? []
      : navState.completedStages || cachedData?.completedStages || [];

  // ── All useState declarations BEFORE useRef ────────────────────────────────
  // Bug fix: originally refs were declared before useState, so patientId,
  // assessmentDate, isDemo, completedStages refs all started as `undefined`.
  const [assessmentId, setAssessmentId] = useState(
    isFreshStart ? null : navState.assessmentId || cachedData?.assessmentId || null
  );
  const [version, setVersion] = useState(
    isFreshStart ? 1 : navState.version || cachedData?.version || 1
  );
  const [patientId, setPatientId] = useState(initialPatientId);
  const [assessmentDate, setAssessmentDate] = useState(initialDate);
  const [currentStage, setCurrentStage] = useState(initialStage);
  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState({});
  const [isDemo, setIsDemo] = useState(initialIsDemo);
  const [completedStages, setCompletedStages] = useState(initialCompleted);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(''); // 'saving' | 'saved' | 'error'
  const [saveError, setSaveError] = useState('');

  // ── Refs (AFTER useState so initial values are correct) ──────────────────────
  // Refs so async doSave always reads the latest values without stale closures
  const assessmentIdRef = useRef(assessmentId);
  const versionRef = useRef(version);
  const patientIdRef = useRef(patientId);
  const assessmentDateRef = useRef(assessmentDate);
  const isDemoRef = useRef(isDemo);
  const completedStagesRef = useRef(completedStages);
  // Mutex: prevents concurrent in-flight saves that cause version conflicts
  const saveInProgressRef = useRef(false);

  // Keep refs in sync whenever state changes
  useEffect(() => { assessmentIdRef.current = assessmentId; }, [assessmentId]);
  useEffect(() => { versionRef.current = version; }, [version]);
  useEffect(() => { patientIdRef.current = patientId; }, [patientId]);
  useEffect(() => { assessmentDateRef.current = assessmentDate; }, [assessmentDate]);
  useEffect(() => { isDemoRef.current = isDemo; }, [isDemo]);
  useEffect(() => { completedStagesRef.current = completedStages; }, [completedStages]);

  // Synchronize if location.state changes (e.g., user hits Edit Stage or Back to Assessment)
  // Skip this sync on fresh start — we already applied blank initial state above.
  useEffect(() => {
    if (location.state && !location.state.fresh) {
      if (location.state.assessmentId) {
        assessmentIdRef.current = location.state.assessmentId;
        setAssessmentId(location.state.assessmentId);
      }
      if (location.state.version != null) {
        versionRef.current = location.state.version;
        setVersion(location.state.version);
      }
      if (location.state.patientId) {
        patientIdRef.current = location.state.patientId;
        setPatientId(location.state.patientId);
      }
      if (location.state.assessmentDate) setAssessmentDate(location.state.assessmentDate);
      if (location.state.formData) setFormData(location.state.formData);
      if (location.state.isDemo !== undefined) setIsDemo(location.state.isDemo);
      if (location.state.completedStages) setCompletedStages(location.state.completedStages);
      if (location.state.resumeStage) setCurrentStage(location.state.resumeStage);
    }
  }, [location.state]);

  // Handle URL param continue flow
  useEffect(() => {
    if (isContinue && params.patientId) {
      loadSavedAssessment(params.patientId);
    }
  }, [isContinue, params.patientId]);

  // Persist draft to sessionStorage whenever key state changes
  useEffect(() => {
    if (patientId && formData) {
      try {
        sessionStorage.setItem(
          'corvex_assessment_draft',
          JSON.stringify({
            assessmentId,
            version,
            patientId,
            assessmentDate,
            formData,
            currentStage,
            isDemo,
            completedStages,
          })
        );
      } catch {
        // ignore
      }
    }
  }, [assessmentId, version, patientId, assessmentDate, formData, currentStage, isDemo, completedStages]);

  const loadSavedAssessment = async (pid) => {
    setLoading(true);
    try {
      const saved = await findResumableAssessment(pid);
      if (saved) {
        const loadedVersion = saved.version ?? 1;
        const loadedAsmId = saved.assessmentId || null;
        // Update refs immediately so the first autosave after load uses correct values
        if (loadedAsmId) assessmentIdRef.current = loadedAsmId;
        versionRef.current = loadedVersion;
        if (saved.patientId) patientIdRef.current = saved.patientId;
        if (loadedAsmId) setAssessmentId(loadedAsmId);
        setVersion(loadedVersion);
        setPatientId(saved.patientId);
        setAssessmentDate(saved.assessmentDate || assessmentDate);
        setFormData({ ...createEmptyFormState(), ...saved.features });
        setCurrentStage(saved.currentStage || 1);
        setIsDemo(saved.isDemo || false);
        const completed = [];
        for (let i = 1; i < (saved.currentStage || 1); i++) completed.push(i);
        setCompletedStages(completed);
      }
    } catch {
      // Error handled by UI
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = useCallback((key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    // Clear field error on change
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleLoadDemo = () => {
    const hasEntries = Object.values(formData).some((v) => v !== null && v !== '');
    if (hasEntries) {
      if (!window.confirm('Loading demo data will replace all current entries with synthetic demo data. Continue?')) {
        return;
      }
    }
    setFormData({ ...createEmptyFormState(), ...DEMO_PATIENT.features });
    setPatientId(DEMO_PATIENT.patientId);
    setAssessmentDate(DEMO_PATIENT.assessmentDate);
    setIsDemo(true);
    setCompletedStages([1, 2, 3, 4, 5, 6, 7]);
    setCurrentStage(1); // Stay on Stage 1 per spec
  };

  const handleNext = async () => {
    // Validate current stage
    const validation = validateStage(currentStage, formData);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});

    // Mark current stage as completed
    const updatedCompleted = completedStages.includes(currentStage)
      ? completedStages
      : [...completedStages, currentStage];
    setCompletedStages(updatedCompleted);

    const nextStage = currentStage === 7 ? 7 : currentStage + 1;
    if (currentStage === 7) {
      // Await the save so the Review page receives the confirmed server version.
      // Previously this was fire-and-forget, so Review navigated with a stale
      // version number, which triggered the "Out of order save rejected" error.
      await doSave(formData, nextStage, Array.from(new Set([...updatedCompleted, 7])));

      const allCompleted = Array.from(new Set([...updatedCompleted, 7]));
      // Read from refs — authoritative after doSave completes
      const confirmedAsmId = assessmentIdRef.current;
      const confirmedVersion = versionRef.current;
      try {
        sessionStorage.setItem(
          'corvex_assessment_draft',
          JSON.stringify({
            assessmentId: confirmedAsmId,
            version: confirmedVersion,
            patientId,
            assessmentDate,
            formData,
            currentStage: 7,
            isDemo,
            completedStages: allCompleted,
          })
        );
      } catch {
        // ignore
      }

      navigate('/assessment/review', {
        state: {
          assessmentId: confirmedAsmId,
          version: confirmedVersion,
          patientId,
          assessmentDate,
          formData,
          isDemo,
          completedStages: allCompleted,
        },
      });
    } else {
      setCurrentStage((prev) => prev + 1);
      // Fire-and-forget save for intermediate stages (non-blocking)
      doSave(formData, nextStage, updatedCompleted);
    }
  };

  const handleBack = () => {
    if (currentStage > 1) {
      setCurrentStage((prev) => prev - 1);
      setErrors({});
    }
  };

  const handleStageClick = (stageNum) => {
    setErrors({});
    setCurrentStage(stageNum);
  };

  /**
   * doSave — persists current form state to the backend database.
   *
   * Reads assessmentId and version from REFS (not state) to avoid stale closure
   * problems that caused the "Out of order save rejected" version conflict error.
   * A mutex prevents concurrent saves from racing each other.
   */
  const doSave = async (overrideData = null, overrideStage = null, overrideCompleted = null) => {
    // Skip if a save is already in flight — prevents version races
    if (saveInProgressRef.current) return;
    saveInProgressRef.current = true;

    setSaveStatus('saving');
    setSaveError('');

    const activeFeatures = overrideData || formData;
    const activeStage = overrideStage != null ? overrideStage : currentStage;
    const activeCompleted = overrideCompleted != null ? overrideCompleted : completedStagesRef.current;
    // Read from refs — guaranteed to be the latest values, no stale closure
    const currentAsmId = assessmentIdRef.current;
    const currentVer = versionRef.current;
    const currentPatientId = patientIdRef.current;
    const currentDate = assessmentDateRef.current;
    const currentIsDemo = isDemoRef.current;

    try {
      if (!currentAsmId) {
        const newAsm = await createAssessment(currentPatientId, currentDate, currentIsDemo, activeStage, activeFeatures);
        if (newAsm && newAsm.assessmentId) {
          // Update ref first so subsequent calls use the new ID immediately
          assessmentIdRef.current = newAsm.assessmentId;
          versionRef.current = newAsm.version || 1;
          setAssessmentId(newAsm.assessmentId);
          setVersion(newAsm.version || 1);
        }
      } else {
        const updated = await saveAssessment(currentAsmId, {
          assessmentId: currentAsmId,
          patientId: currentPatientId,
          assessmentDate: currentDate,
          currentStage: activeStage,
          completedStages: activeCompleted,
          features: activeFeatures,
          isDemo: currentIsDemo,
          version: currentVer,
        });
        if (updated && updated.version != null) {
          // Always use the authoritative server version — never optimistically increment.
          // Optimistic increments caused the "Out of order save rejected" conflict.
          versionRef.current = updated.version;
          setVersion(updated.version);
        }
      }
      setSaveStatus('saved');
    } catch (err) {
      console.warn('Persistent doSave failed:', err);
      setSaveStatus('error');
      setSaveError(err?.message || 'Database save failed');
    } finally {
      saveInProgressRef.current = false;
    }
  };

  // Debounced autosave when form inputs change.
  // Only fires after an assessment row exists in the DB (assessmentId is set).
  // This prevents autosave from racing with the explicit createAssessment call.
  // doSave reads from refs so it does NOT need to be in the dep array.
  useEffect(() => {
    if (!formData) return;
    // Do not autosave until a DB row exists — first save handled by doSave in handleNext
    if (!assessmentIdRef.current) return;
    const hasValues = Object.values(formData).some((v) => v !== null && v !== '');
    if (!hasValues) return;

    const timer = setTimeout(() => {
      doSave();
    }, 1500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData]);

  const filledCount = countFilledFeatures(formData);

  const renderStage = () => {
    const stageProps = { formData, onChange: handleFieldChange, errors };
    switch (currentStage) {
      case 1:
        return <Stage1Demographics {...stageProps} onLoadDemo={handleLoadDemo} isDemo={isDemo} />;
      case 2:
        return <Stage2MedicalHistory {...stageProps} />;
      case 3:
        return <Stage3Vitals {...stageProps} />;
      case 4:
        return <Stage4Symptoms {...stageProps} />;
      case 5:
        return <Stage5ECG {...stageProps} />;
      case 6:
        return <Stage6Laboratory {...stageProps} />;
      case 7:
        return <Stage7Echocardiography {...stageProps} />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
        <div className="loading-overlay" style={{ flex: 1 }}>
          <div className="spinner spinner-lg" />
          <span>Loading saved assessment...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="assessment-layout">
      <Header />

      {/* Progress bar area */}
      <div className="assessment-progress-bar">
        <div className="assessment-progress-inner">
          {/* Metadata row */}
          <div className="assessment-meta">
            <div className="meta-item">
              <User size={14} />
              <strong>Patient ID:</strong> {patientId}
            </div>
            <div className="meta-item">
              <Calendar size={14} />
              <strong>Assessment Date:</strong>
              <input
                type="date"
                value={assessmentDate}
                onChange={(e) => setAssessmentDate(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: 'var(--font-sm)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              />
            </div>
            {isDemo && <span className="badge badge-demo">DEMO / SYNTHETIC DATA</span>}
            <div className="meta-item" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>
                {filledCount} / {TOTAL_FEATURES} features completed
              </span>
              {saveStatus === 'saving' && (
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-info)' }}>
                  Saving...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-success)', opacity: 0.9 }}>
                  ✓ Saved
                </span>
              )}
              {saveStatus === 'error' && (
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-danger)' }} title={saveError}>
                  ⚠ Save failed
                </span>
              )}
            </div>
          </div>

          {/* Stepper */}
          <AssessmentStepper
            currentStage={currentStage}
            completedStages={completedStages}
            onStageClick={handleStageClick}
          />
        </div>
      </div>

      {/* Stage content */}
      <div className="assessment-content">
        <div className="assessment-content-inner">
          {renderStage()}
        </div>
      </div>

      {/* Navigation bar */}
      <div className="assessment-nav">
        <div className="assessment-nav-inner">
          <span className="nav-info">
            Stage {currentStage} of 7
          </span>
          <div className="nav-buttons">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleBack}
              disabled={currentStage === 1}
              id="btn-nav-back"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleNext}
              id="btn-nav-next"
            >
              {currentStage === 7 ? (
                <>Review Assessment <ArrowRight size={16} /></>
              ) : (
                <>Next <ArrowRight size={16} /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
