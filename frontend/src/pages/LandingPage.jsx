import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowRight, Activity } from 'lucide-react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { getAllResumableAssessments } from '../services/assessmentService';
import { getPatientById } from '../services/patientService';

export default function LandingPage() {
  const navigate = useNavigate();
  const [continueId, setContinueId] = useState('');
  const [continueLoading, setContinueLoading] = useState(false);
  const [continueError, setContinueError] = useState('');
  const [draftsList, setDraftsList] = useState(null);

  const handleNewAssessment = () => {
    // fresh: true tells NewAssessmentPage to clear any cached draft and start blank
    navigate('/assessment/new', { state: { fresh: true } });
  };

  const resumeDraft = (draft) => {
    navigate(`/assessment/continue/${continueId.trim()}`, {
      state: {
        assessmentId: draft.assessmentId,
        version: draft.version,
        patientId: continueId.trim(),
        assessmentDate: draft.assessmentDate,
        formData: draft.features,
        currentStage: draft.currentStage,
        completedStages: draft.completedStages,
        isDemo: draft.isDemo,
        resumeStage: draft.currentStage,
      },
    });
  };

  const handleContinue = async () => {
    const pid = continueId.trim();
    if (!pid) {
      setContinueError('Please enter a Patient ID.');
      return;
    }
    setContinueError('');
    setDraftsList(null);
    setContinueLoading(true);

    try {
      const patient = await getPatientById(pid);
      if (!patient) {
        setContinueError(`Patient "${pid}" does not exist. Please check the ID or start a New Assessment.`);
        setContinueLoading(false);
        return;
      }

      const drafts = await getAllResumableAssessments(pid);
      if (!drafts || drafts.length === 0) {
        setContinueError(
          `No incomplete draft assessment found for Patient "${pid}". ${
            patient.hasAssessment
              ? 'This patient has completed assessments viewable under Search Patient.'
              : 'You can start a New Assessment for this patient.'
          }`
        );
        setContinueLoading(false);
        return;
      }

      if (drafts.length === 1) {
        resumeDraft(drafts[0]);
      } else {
        setDraftsList(drafts);
      }
    } catch {
      setContinueError('An error occurred. Please try again.');
    } finally {
      setContinueLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />

      <main className="landing-hero">
        <Activity size={64} strokeWidth={2} color="var(--corvex-blue-500)" style={{ marginBottom: '24px' }} />

        <h1>CORVEX</h1>
        <p className="hero-subtitle">
          Cardiovascular risk visualization and prediction platform.
          Clinical decision support powered by machine learning.
        </p>

        <div className="landing-actions">
          {/* New Assessment — primary action */}
          <button className="primary-action" onClick={handleNewAssessment} id="btn-new-assessment">
            <Plus size={22} />
            New Assessment
          </button>

          {/* Continue Assessment — secondary action */}
          <div className="continue-section">
            <h3>Continue Assessment</h3>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Enter a Patient ID to resume a saved, incomplete assessment.
            </p>
            <div className="continue-form">
              <input
                type="text"
                className="form-input"
                placeholder="e.g. CV-2026-0004"
                value={continueId}
                onChange={(e) => {
                  setContinueId(e.target.value);
                  setContinueError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
                id="input-continue-id"
              />
              <button
                className="btn btn-secondary"
                onClick={handleContinue}
                disabled={continueLoading}
                id="btn-continue"
              >
                {continueLoading ? (
                  <span className="spinner" style={{ width: 16, height: 16 }} />
                ) : (
                  <>
                    Continue <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
            {continueError && (
              <div style={{ marginTop: '8px', fontSize: 'var(--font-sm)', color: 'var(--color-danger)' }}>
                {continueError}
              </div>
            )}

            {draftsList && draftsList.length > 1 && (
              <div style={{ marginTop: '16px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Multiple incomplete drafts found. Select one to resume:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {draftsList.map((d) => (
                    <div
                      key={d.assessmentId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'var(--bg-elevated)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-sm)',
                      }}
                    >
                      <div>
                        <strong>{d.assessmentId}</strong>
                        <span style={{ color: 'var(--text-tertiary)', marginLeft: '8px' }}>
                          Stage {d.currentStage}/7 • {d.assessmentDate}
                        </span>
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => resumeDraft(d)}
                        style={{ padding: '4px 10px', fontSize: 'var(--font-xs)' }}
                      >
                        Resume <ArrowRight size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
