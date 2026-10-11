import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, User, Calendar, AlertTriangle } from 'lucide-react';
import Header from '../components/layout/Header';
import OverallPredictionCard from '../components/results/OverallPredictionCard';
import VesselPredictionCards from '../components/results/VesselPredictionCards';
import ExplanationPanel from '../components/results/ExplanationPanel';
import PatientMeasurements from '../components/results/PatientMeasurements';
import ModelMethodology from '../components/results/ModelMethodology';
import HeartVisualization from '../components/visualization/HeartVisualization';
import { riskColor, riskLabel } from '../utils/riskColor';

/**
 * Results Dashboard — the main output screen.
 * 
 * Data flow:
 *   predictionService → ResultsPage (this) → HeartVisualization → TemporaryHeartModel
 * 
 * The ResultsPage receives prediction data from the service layer via location.state.
 * It passes vesselData and selectedVessel down to HeartVisualization.
 * HeartVisualization is a reusable container; it internally renders TemporaryHeartModel
 * which can later be replaced with ActualHeartModel.
 */
export default function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { prediction, patientId, assessmentDate, formData, isDemo } = location.state || {};

  const [selectedVessel, setSelectedVessel] = useState(null);

  if (!prediction) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
        <div className="loading-overlay" style={{ flex: 1 }}>
          <p>No prediction data found. Please run an assessment first.</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>Go Home</button>
        </div>
      </div>
    );
  }

  const handleVesselSelect = (vessel) => {
    setSelectedVessel((prev) => (prev === vessel ? null : vessel));
  };

  // Prepare vesselData for the visualization component
  const vesselData = prediction.vessels || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />

      <div className="results-layout">
        {/* Results header */}
        <div className="results-header">
          <div>
            <h1>Results / Assessment</h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', marginTop: '8px', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={14} /> Patient ID: <strong>{patientId}</strong>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} /> Assessment Date: <strong>{assessmentDate}</strong>
              </span>
              {isDemo && <span className="badge badge-demo">DEMO / SYNTHETIC DATA</span>}
              {prediction._meta?.isMock && <span className="badge badge-warning">MOCK PREDICTION</span>}
            </div>
          </div>
        </div>
        {/* Feature defaults disclaimer banner */}
        {prediction._meta?.assumedFeatures?.length > 0 && (
          <div className="disclaimer" style={{ marginBottom: '16px', borderColor: 'var(--color-warning)' }}>
            <strong>{prediction._meta.assumedFeatures.length} of 50 model inputs were not entered.</strong>{' '}
            Typical values from the training data were assumed for them, so interpret this result with caution.
          </div>
        )}

        {/* Runtime warnings banner — filters out legacy dropped column & range warnings */}
        {(() => {
          const visibleWarnings = (prediction._meta?.warnings || []).filter(
            (w) =>
              !w.includes('is not used by the model') &&
              !w.includes('outside the dataset range')
          );
          if (visibleWarnings.length === 0) return null;
          return (
            <div className="disclaimer" style={{ marginBottom: '16px' }}>
              {visibleWarnings.map((w) => (
                <div key={w}>⚠ {w}</div>
              ))}
            </div>
          );
        })()}

        {/* Main results grid — two columns on desktop */}
        <div className="results-grid">
          {/* Left column: Overall CAD + Vessel cards */}
          <div className="results-prediction-col">
            <OverallPredictionCard prediction={prediction} />
            <VesselPredictionCards
              vessels={prediction.vessels}
              selectedVessel={selectedVessel}
              onVesselSelect={handleVesselSelect}
            />
          </div>

          {/* Right column: 3D Visualization */}
          <div className="results-viz-col">
            <div>
              <h3 style={{ fontSize: 'var(--font-md)', fontWeight: 600, marginBottom: '12px' }}>
                3D Coronary Visualization
              </h3>
              <HeartVisualization
                selectedVessel={selectedVessel}
                vesselData={vesselData}
                onVesselSelect={handleVesselSelect}
              />
            </div>

            {/* Selected vessel detail */}
            {selectedVessel && vesselData[selectedVessel] && (
              <div className="card" style={{ borderLeft: `3px solid ${getVesselColor(selectedVessel)}` }}>
                <h4 style={{ fontWeight: 600, marginBottom: '8px', color: getVesselColor(selectedVessel) }}>
                  {selectedVessel} — {getVesselFullName(selectedVessel)}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: 'var(--font-sm)' }}>
                  <div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>Status</div>
                    <div style={{ fontWeight: 600 }}>{vesselData[selectedVessel].status} (Predicted)</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>Probability</div>
                    <div style={{ fontWeight: 600 }}>{Math.round(vesselData[selectedVessel].probability * 100)}%</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>Risk level</div>
                    <div style={{ fontWeight: 600, color: riskColor(vesselData[selectedVessel]) }}>
                      {riskLabel(vesselData[selectedVessel])}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>Decision threshold</div>
                    <div style={{ fontWeight: 600 }}>
                      {vesselData[selectedVessel].threshold != null
                        ? `${Math.round(vesselData[selectedVessel].threshold * 100)}%`
                        : '—'}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '8px', fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle size={11} />
                  This is a predicted result, not a confirmed clinical diagnosis.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Explainability */}
        <div style={{ marginBottom: '24px' }}>
          <ExplanationPanel explanation={prediction.explanation} selectedVessel={selectedVessel} />
        </div>

        {/* Patient Measurements */}
        <div style={{ marginBottom: '24px' }}>
          <PatientMeasurements formData={formData || {}} />
        </div>

        {/* Model / Methodology */}
        <div style={{ marginBottom: '24px' }}>
          <ModelMethodology modelInfo={prediction.model} />
        </div>

        {/* Disclaimer */}
        <div className="disclaimer" style={{ marginBottom: '32px' }}>
          {prediction._meta?.disclaimer || 'For educational and decision-support purposes only. Not a diagnosis or a substitute for professional medical evaluation.'}
        </div>
      </div>
    </div>
  );
}

function getVesselColor(vessel) {
  switch (vessel) {
    case 'LAD': return 'var(--vessel-lad)';
    case 'LCX': return 'var(--vessel-lcx)';
    case 'RCA': return 'var(--vessel-rca)';
    default: return 'var(--text-primary)';
  }
}

function getVesselFullName(vessel) {
  switch (vessel) {
    case 'LAD': return 'Left Anterior Descending';
    case 'LCX': return 'Left Circumflex';
    case 'RCA': return 'Right Coronary Artery';
    default: return vessel;
  }
}
