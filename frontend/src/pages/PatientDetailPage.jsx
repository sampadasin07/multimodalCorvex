import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, User, Activity, ChevronRight, Archive, ArchiveRestore, CheckCircle2, Clock, Trash2, AlertTriangle, X } from 'lucide-react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { getPatientById, archivePatient, deletePatient, deleteAssessment } from '../services/patientService';
import { generateMockPrediction } from '../data/mockPrediction';

function ConfirmDeleteModal({ isOpen, title, children, onCancel, onConfirm, isLoading, errorMessage }) {
  if (!isOpen) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
      <div className="modal-content" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertTriangle size={18} color="var(--color-danger)" />
            </div>
            <h2 id="delete-modal-title" style={{ fontSize: 'var(--font-lg)', fontWeight: 700, margin: 0 }}>{title}</h2>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onCancel} disabled={isLoading} aria-label="Close dialog" style={{ flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          {children}
          {errorMessage && (
            <div style={{ marginTop: '16px', padding: '12px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', fontSize: 'var(--font-sm)', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <AlertTriangle size={15} style={{ marginTop: '2px', flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button id="btn-delete-cancel" className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>Cancel</button>
          <button id="btn-delete-confirm" className="btn btn-danger" onClick={onConfirm} disabled={isLoading} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {isLoading ? (<><span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />Deleting&hellip;</>) : (<><Trash2 size={14} />Permanently Delete</>)}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PatientDetailPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [archiveMessage, setArchiveMessage] = useState('');
  const [archiveError, setArchiveError] = useState('');

  const [showDeletePatient, setShowDeletePatient] = useState(false);
  const [deletingPatient, setDeletingPatient] = useState(false);
  const [deletePatientError, setDeletePatientError] = useState('');

  const [assessmentToDelete, setAssessmentToDelete] = useState(null);
  const [deletingAssessment, setDeletingAssessment] = useState(false);
  const [deleteAssessmentError, setDeleteAssessmentError] = useState('');

  const loadPatient = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPatientById(patientId);
      setPatient(data);
    } catch {
      setPatient(null);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { loadPatient(); }, [loadPatient]);

  const handleToggleArchive = async () => {
    if (!patient || archiving) return;
    setArchiving(true);
    setArchiveError('');
    setArchiveMessage('');
    const willBeArchived = !patient.isArchived;
    try {
      await archivePatient(patient.patientId, willBeArchived);
      await loadPatient();
      setArchiveMessage(
        willBeArchived
          ? `Patient ${patient.patientId} has been archived. It is now hidden from standard searches.`
          : `Patient ${patient.patientId} has been unarchived and restored to active records.`
      );
      setTimeout(() => setArchiveMessage(''), 5000);
    } catch (err) {
      console.warn('Archive toggle failed:', err);
      setArchiveError(
        err?.message ||
          `Failed to ${willBeArchived ? 'archive' : 'unarchive'} patient record. Please try again.`
      );
    } finally {
      setArchiving(false);
    }
  };

  const handleDeletePatientClick = () => { setDeletePatientError(''); setShowDeletePatient(true); };
  const handleDeletePatientCancel = () => { if (deletingPatient) return; setShowDeletePatient(false); setDeletePatientError(''); };
  const handleDeletePatientConfirm = async () => {
    if (deletingPatient) return;
    setDeletingPatient(true);
    setDeletePatientError('');
    try {
      await deletePatient(patient.patientId);
      navigate('/search', { replace: true, state: { deletedPatientId: patient.patientId } });
    } catch (err) {
      setDeletePatientError(err?.message || 'Deletion failed. The patient record has not been removed. Please try again.');
      setDeletingPatient(false);
    }
  };

  const handleDeleteAssessmentClick = (asm) => { setDeleteAssessmentError(''); setAssessmentToDelete(asm); };
  const handleDeleteAssessmentCancel = () => { if (deletingAssessment) return; setAssessmentToDelete(null); setDeleteAssessmentError(''); };
  const handleDeleteAssessmentConfirm = async () => {
    if (deletingAssessment || !assessmentToDelete) return;
    setDeletingAssessment(true);
    setDeleteAssessmentError('');
    try {
      await deleteAssessment(assessmentToDelete.assessmentId, patient.patientId);
      setPatient((prev) => ({ ...prev, assessmentHistory: prev.assessmentHistory.filter((a) => a.assessmentId !== assessmentToDelete.assessmentId) }));
      setAssessmentToDelete(null);
    } catch (err) {
      setDeleteAssessmentError(err?.message || 'Deletion failed. The assessment has not been removed. Please try again.');
      setDeletingAssessment(false);
    }
  };

  const handleViewAssessment = (assessment) => {
    if (assessment.predictionResult) {
      navigate('/results', { state: { prediction: assessment.predictionResult, patientId: patient.patientId, assessmentDate: assessment.assessmentDate, formData: assessment.features || {}, isDemo: assessment.isDemo, assessmentId: assessment.assessmentId } });
      return;
    }
    handleViewDetailedAnalysis();
  };

  const handleResumeAssessment = (assessment) => {
    navigate(`/assessment/continue/${patient.patientId}`, { state: { assessmentId: assessment.assessmentId, version: assessment.version, patientId: patient.patientId, assessmentDate: assessment.assessmentDate, formData: assessment.features, currentStage: assessment.currentStage, completedStages: assessment.completedStages, isDemo: assessment.isDemo, resumeStage: assessment.currentStage } });
  };

  const handleViewDetailedAnalysis = () => {
    if (!patient) return;
    const completed = patient.assessmentHistory?.find((a) => a.status === 'completed' && a.predictionResult);
    if (completed) { handleViewAssessment(completed); return; }
    const mockFormData = { 'Age': patient.age || 58, 'Sex': patient.sex || 'Male', 'Weight': 72, 'Length': 172, 'BMI': 24.3, 'BP': 130, 'PR': 75, 'DM': patient.predictions?.overallCAD === 'Yes' ? 'Yes' : 'No', 'HTN': 'Yes', 'ST Depression': 'Yes', 'Typical Chest Pain': 'Yes', 'EF-TTE': 50 };
    const prediction = generateMockPrediction(patient.patientId, patient.registeredDate || '2026-10-01', mockFormData);
    if (patient.predictions?.overallCAD === 'No') { prediction.overallCAD = { status: 'Negative', probability: 0.18, label: 'No CAD (Predicted)' }; }
    navigate('/results', { state: { prediction, patientId: patient.patientId, assessmentDate: patient.registeredDate || '2026-10-01', formData: mockFormData, isDemo: true } });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
        <div className="loading-overlay" style={{ flex: 1 }}><div className="spinner spinner-lg" /><span>Loading patient record...</span></div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
        <div className="loading-overlay" style={{ flex: 1 }}>
          <p style={{ marginBottom: '16px' }}>Patient not found: {patientId}</p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={() => navigate('/search')}>Search Patients</button>
            <button className="btn btn-primary" onClick={() => navigate('/')}>Go Home</button>
          </div>
        </div>
      </div>
    );
  }

  const history = patient.assessmentHistory || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <div className="container-narrow" style={{ padding: '32px 24px', flex: 1 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/search')} style={{ marginBottom: '24px' }}>
          <ArrowLeft size={16} /> Back to Search
        </button>

        {archiveMessage && (
          <div
            id="banner-archive-success"
            style={{
              marginBottom: '16px',
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-success-bg, rgba(34,197,94,0.12))',
              border: '1px solid rgba(34,197,94,0.35)',
              color: 'var(--color-success, #22c55e)',
              fontSize: 'var(--font-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} />
              <span>{archiveMessage}</span>
            </div>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => setArchiveMessage('')}
              style={{ width: '24px', height: '24px' }}
              aria-label="Dismiss message"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {archiveError && (
          <div
            id="banner-archive-error"
            style={{
              marginBottom: '16px',
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: 'var(--color-danger, #ef4444)',
              fontSize: 'var(--font-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} />
              <span>{archiveError}</span>
            </div>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => setArchiveError('')}
              style={{ width: '24px', height: '24px' }}
              aria-label="Dismiss error"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--corvex-accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={24} color="var(--corvex-blue-500)" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 700 }}>{patient.patientId}</h1>
                  {patient.isArchived && <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Archive size={12} /> Archived</span>}
                </div>
                <div style={{ display: 'flex', gap: '12px', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
                  <span>Registered: {patient.registeredDate}</span>
                  {patient.age && <span>&#8226; Age: {patient.age}</span>}
                  {patient.sex && <span>&#8226; {patient.sex}</span>}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button id="btn-delete-record" className="btn btn-danger btn-sm" onClick={handleDeletePatientClick} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Trash2 size={14} /> Delete Record
              </button>
              <button
                id={patient.isArchived ? 'btn-unarchive-record' : 'btn-archive-record'}
                className={`btn ${patient.isArchived ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={handleToggleArchive}
                disabled={archiving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                title={patient.isArchived ? 'Restore patient to active records' : 'Archive patient record'}
              >
                {archiving ? (
                  <>
                    <span className="spinner" style={{ width: '13px', height: '13px', borderWidth: '2px' }} />
                    {patient.isArchived ? 'Unarchiving...' : 'Archiving...'}
                  </>
                ) : patient.isArchived ? (
                  <>
                    <ArchiveRestore size={14} /> Unarchive Patient
                  </>
                ) : (
                  <>
                    <Archive size={14} /> Archive Record
                  </>
                )}
              </button>
            </div>
          </div>

          {patient.isArchived && (
            <div
              id="banner-archived-status"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: 'var(--radius-md)',
                marginTop: '12px',
                marginBottom: '16px',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Archive size={18} color="var(--color-warning, #f59e0b)" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)', color: 'var(--text-primary)' }}>
                    This patient record is currently archived
                  </div>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
                    Archived records are excluded from standard roster search. You can unarchive this patient to restore them to active records.
                  </div>
                </div>
              </div>
              <button
                id="btn-unarchive-banner"
                className="btn btn-primary btn-sm"
                onClick={handleToggleArchive}
                disabled={archiving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {archiving ? (
                  <>
                    <span className="spinner" style={{ width: '13px', height: '13px', borderWidth: '2px' }} />
                    Unarchiving&hellip;
                  </>
                ) : (
                  <>
                    <ArchiveRestore size={14} /> Unarchive Patient
                  </>
                )}
              </button>
            </div>
          )}

          {patient.predictions && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ fontSize: 'var(--font-md)', fontWeight: 600 }}>Latest Assessment Results (Predicted)</h3>
                <button className="btn btn-primary btn-sm" onClick={handleViewDetailedAnalysis} style={{ display: 'flex', alignItems: 'center', gap: '6px' }} id="btn-view-detailed-analysis">
                  <Activity size={15} /> More / Detailed Analysis <ChevronRight size={14} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <ResultBadge label="Overall CAD" value={patient.predictions.overallCAD} />
                <ResultBadge label="LAD" value={patient.predictions.LAD} />
                <ResultBadge label="LCX" value={patient.predictions.LCX} />
                <ResultBadge label="RCA" value={patient.predictions.RCA} />
              </div>
              <div style={{ marginTop: '16px', fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>
                These are predicted results from ML models, not confirmed clinical diagnoses.
              </div>
            </div>
          )}
          {!patient.predictions && (
            <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-sm)' }}>No completed assessment results available for this patient yet.</p>
          )}
        </div>

        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} /> Assessment History {history.length > 0 && <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)' }}>({history.length})</span>}
          </h3>
          {history.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-sm)' }}>No recorded assessments found for this patient.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {history.map((asm) => {
                const isCompleted = asm.status === 'completed';
                return (
                  <div key={asm.assessmentId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 'var(--font-md)' }}>{asm.assessmentId}</strong>
                        {isCompleted ? (
                          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={12} /> Completed</span>
                        ) : (
                          <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> In Progress (Stage {asm.currentStage}/7)</span>
                        )}
                        {asm.isDemo && <span className="badge badge-demo">Demo</span>}
                      </div>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                        Date: {asm.assessmentDate} &#8226; Created: {new Date(asm.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <button id={`btn-delete-assessment-${asm.assessmentId}`} className="btn btn-danger btn-sm" onClick={() => handleDeleteAssessmentClick(asm)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Trash2 size={13} /> Delete
                      </button>
                      {isCompleted ? (
                        <button className="btn btn-secondary btn-sm" onClick={() => handleViewAssessment(asm)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <Activity size={14} /> View Stored Results
                        </button>
                      ) : (
                        <button className="btn btn-primary btn-sm" onClick={() => handleResumeAssessment(asm)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          Resume Draft <ChevronRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <button className="btn btn-primary btn-lg" onClick={() => { sessionStorage.removeItem('corvex_assessment_draft'); navigate('/assessment/new', { state: { fresh: true, patientId: patient.patientId } }); }} style={{ width: '100%' }}>
          <Plus size={20} /> Start New Assessment for this Patient
        </button>
      </div>

      <Footer />

      <ConfirmDeleteModal isOpen={showDeletePatient} title="Permanently Delete Patient Record" onCancel={handleDeletePatientCancel} onConfirm={handleDeletePatientConfirm} isLoading={deletingPatient} errorMessage={deletePatientError}>
        <p style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>
          You are about to permanently delete patient <strong>{patient?.patientId}</strong> and all data associated with this record.
        </p>
        <div style={{ padding: '12px 14px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
          <p style={{ marginBottom: '6px' }}><strong>This will permanently delete:</strong></p>
          <ul style={{ margin: 0, paddingLeft: '18px', lineHeight: 1.7 }}>
            <li>The patient record ({patient?.patientId})</li>
            <li>All {history.length} assessment{history.length !== 1 ? 's' : ''} belonging to this patient</li>
            <li>All stored prediction results associated with those assessments</li>
          </ul>
        </div>
        <p style={{ marginTop: '14px', fontSize: 'var(--font-sm)', color: 'var(--color-danger)', fontWeight: 600 }}>
          &#9888; This action cannot be undone.
        </p>
      </ConfirmDeleteModal>

      <ConfirmDeleteModal isOpen={!!assessmentToDelete} title="Permanently Delete Assessment" onCancel={handleDeleteAssessmentCancel} onConfirm={handleDeleteAssessmentConfirm} isLoading={deletingAssessment} errorMessage={deleteAssessmentError}>
        <p style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>
          You are about to permanently delete assessment <strong>{assessmentToDelete?.assessmentId}</strong>.
        </p>
        <div style={{ padding: '12px 14px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
          <p style={{ marginBottom: '6px' }}><strong>This will permanently delete:</strong></p>
          <ul style={{ margin: 0, paddingLeft: '18px', lineHeight: 1.7 }}>
            <li>Assessment <strong>{assessmentToDelete?.assessmentId}</strong></li>
            <li>All stored prediction results for this assessment</li>
          </ul>
          <p style={{ marginTop: '8px' }}>The patient record and all other assessments will remain untouched.</p>
        </div>
        <p style={{ marginTop: '14px', fontSize: 'var(--font-sm)', color: 'var(--color-danger)', fontWeight: 600 }}>
          &#9888; This action cannot be undone.
        </p>
      </ConfirmDeleteModal>
    </div>
  );
}

function ResultBadge({ label, value }) {
  const isPositive = value === 'Yes';
  return (
    <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', background: isPositive ? 'var(--color-danger-bg)' : 'var(--color-success-bg)', textAlign: 'center' }}>
      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: isPositive ? 'var(--color-danger)' : 'var(--color-success)' }}>{value}</div>
    </div>
  );
}
