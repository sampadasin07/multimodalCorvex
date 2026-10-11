import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import ActualHeartModel from './ActualHeartModel';
import { RotateCcw, ZoomIn, ZoomOut, Play, Pause, X, Move3d, Layers } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { riskColor } from '../../utils/riskColor';

const VESSEL_DETAILS = {
  LAD: {
    fullName: 'Left Anterior Descending',
    territory: 'Anterior LV wall, cardiac apex & interventricular septum',
    defaultPos: [0, 0.2, 4.2],
  },
  LCX: {
    fullName: 'Left Circumflex',
    territory: 'Posterolateral LV wall & left atrium',
    defaultPos: [3.3, 0.5, 2.2],
  },
  RCA: {
    fullName: 'Right Coronary Artery',
    territory: 'Right ventricle, inferior wall & SA/AV nodal supply',
    defaultPos: [-3.3, 0.3, 2.2],
  },
};

const VIEW_PRESETS = [
  { label: 'Anterior', pos: [0, 0.2, 4.2] },
  { label: 'Posterior', pos: [0, 0.2, -4.2] },
  { label: 'Left', pos: [4.2, 0.2, 0] },
  { label: 'Right', pos: [-4.2, 0.2, 0] },
];

/**
 * HeartVisualization — Reusable, interactive 3D coronary & anatomical heart container.
 *
 * Full Touchpad / Keypad / Mouse Gestures:
 * - Free motion / orbital rotation by scrolling two fingers on trackpad / keypad
 * - Click-and-drag 360° spherical rotation from any angle
 * - Trackpad pinch gesture (or Ctrl+scroll) smoothly zooms in/out
 * - Dedicated on-screen Zoom In (+) and Zoom Out (-) buttons
 * - Shift + trackpad scroll to pan
 * - Mode toggle to switch trackpad scroll between Free Rotate and Zoom
 * - Auto-rotation toggle (continuous 360° turntable inspection)
 * - Anatomical perspective presets (Anterior, Posterior, Left, Right)
 * - Automatic camera orientation when selecting localized vessels
 * - In-viewport HUD showing localized vessel-specific risk details
 * - Reset view button
 */
const STYLE_OPTIONS = [
  { id: 'anatomical', label: 'Anatomical', desc: 'Smooth continuous cardiac muscle' },
  { id: 'glass', label: 'X-Ray Glass', desc: 'Frosted medical glass with cyan rim glow' },
  { id: 'angiogram', label: 'Angiogram', desc: 'Isolated coronary tree (catheterization view)' },
];

export default function HeartVisualization({ selectedVessel, vesselData, onVesselSelect }) {
  const containerRef = useRef();
  const controlsRef = useRef();
  const [autoRotate, setAutoRotate] = useState(false);
  const [trackpadMode, setTrackpadMode] = useState('rotate'); // 'rotate' | 'zoom'
  const [heartStyle, setHeartStyle] = useState('anatomical'); // 'anatomical' | 'glass' | 'angiogram'

  // When selected vessel changes, orient camera to the ideal anatomical angle for that vessel
  useEffect(() => {
    if (selectedVessel && VESSEL_DETAILS[selectedVessel] && controlsRef.current) {
      const controls = controlsRef.current;
      const camera = controls.object;
      const targetPos = VESSEL_DETAILS[selectedVessel].defaultPos;
      camera.position.set(...targetPos);
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }, [selectedVessel]);

  // Touchpad / keypad two-finger scroll handler
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e) => {
      // Prevent outer page from scrolling while interacting with the 3D heart
      e.preventDefault();
      e.stopPropagation();

      if (!controlsRef.current) return;
      const controls = controlsRef.current;
      const camera = controls.object;
      const target = controls.target;

      // Trackpad pinch-to-zoom (browser passes e.ctrlKey = true on pinch) or explicit zoom mode
      if (e.ctrlKey || trackpadMode === 'zoom') {
        const factor = e.deltaY > 0 ? 1.05 : 0.95;
        const currentDist = camera.position.distanceTo(target);
        const nextDist = currentDist * factor;
        if (nextDist >= 1.8 && nextDist <= 11.0) {
          camera.position.sub(target).multiplyScalar(factor).add(target);
          controls.update();
        }
        return;
      }

      // Shift + scroll -> Pan camera across the heart
      if (e.shiftKey) {
        const panSpeed = 0.003;
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize();
        const up = camera.up.clone().normalize();
        const panOffset = right.multiplyScalar(-e.deltaX * panSpeed)
          .add(up.multiplyScalar(e.deltaY * panSpeed));
        camera.position.add(panOffset);
        target.add(panOffset);
        controls.update();
        return;
      }

      // Free 3D orbital motion by scrolling fingers on keypad / trackpad:
      // deltaX orbits horizontally around Y (azimuth / yaw)
      // deltaY orbits vertically around elevation (polar / pitch)
      const offset = new THREE.Vector3().subVectors(camera.position, target);
      const radius = offset.length();
      if (radius < 0.001) return;

      let theta = Math.atan2(offset.x, offset.z);
      let phi = Math.acos(Math.max(-1, Math.min(1, offset.y / radius)));

      const sensitivity = 0.0055;
      theta -= e.deltaX * sensitivity;
      phi += e.deltaY * sensitivity;

      // Clamp polar angle so camera does not flip upside down
      const minPolar = 0.08;
      const maxPolar = Math.PI - 0.08;
      phi = Math.max(minPolar, Math.min(maxPolar, phi));

      const sinPhiRadius = Math.sin(phi) * radius;
      offset.x = sinPhiRadius * Math.sin(theta);
      offset.y = Math.cos(phi) * radius;
      offset.z = sinPhiRadius * Math.cos(theta);

      camera.position.copy(target).add(offset);
      camera.lookAt(target);
      controls.update();
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [trackpadMode]);

  const handleZoomIn = () => {
    if (controlsRef.current) {
      const camera = controlsRef.current.object;
      camera.position.multiplyScalar(0.82);
      controlsRef.current.update();
    }
  };

  const handleZoomOut = () => {
    if (controlsRef.current) {
      const camera = controlsRef.current.object;
      camera.position.multiplyScalar(1.22);
      controlsRef.current.update();
    }
  };

  const handleReset = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
      const camera = controlsRef.current.object;
      camera.position.set(0, 0.3, 4.2);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  const handlePresetView = (pos) => {
    if (controlsRef.current) {
      const camera = controlsRef.current.object;
      camera.position.set(...pos);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  const activeVesselInfo = selectedVessel ? VESSEL_DETAILS[selectedVessel] : null;
  const activeVesselData = selectedVessel ? vesselData?.[selectedVessel] : null;

  return (
    <div
      ref={containerRef}
      className="viz-container"
      style={{ position: 'relative', touchAction: 'none' }}
    >
      <Canvas
        camera={{ position: [0, 0.3, 4.2], fov: 45 }}
        style={{ position: 'absolute', inset: 0 }}
        shadows
      >
        {/* Ambient illumination */}
        <ambientLight intensity={0.4} />

        {/* Key light — top-left-front */}
        <directionalLight
          position={[3.5, 4, 4]}
          intensity={1.15}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />

        {/* Fill light — bottom-right */}
        <directionalLight position={[-3.5, -2, 2]} intensity={0.5} />

        {/* Rim light — back-accent */}
        <directionalLight position={[0, 2.5, -5]} intensity={0.3} color="#ffe0d0" />

        <ActualHeartModel
          selectedVessel={selectedVessel}
          vesselData={vesselData}
          heartStyle={heartStyle}
          onVesselSelect={onVesselSelect}
        />

        <OrbitControls
          ref={controlsRef}
          autoRotate={autoRotate}
          autoRotateSpeed={1.2}
          enableZoom={false} // Handled smoothly via container wheel listener + on-screen buttons
          enableRotate={true} // Left-click drag on mouse/trackpad freely rotates 360°
          enablePan={true}    // Right-click or shift-drag pans
          minDistance={1.8}
          maxDistance={11}
          enableDamping={true}
          dampingFactor={0.07}
        />
      </Canvas>

      {/* Top-Left: Vessel quick-select badges */}
      <div style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        zIndex: 10,
      }}>
        {['LAD', 'LCX', 'RCA'].map((vessel) => {
          const isSelected = selectedVessel === vessel;
          const color = riskColor(vesselData?.[vessel]) || 'rgba(255,255,255,0.7)';
          return (
            <button
              key={vessel}
              onClick={() => onVesselSelect(isSelected ? null : vessel)}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                border: isSelected ? `2px solid ${color}` : '1px solid rgba(255,255,255,0.22)',
                background: isSelected ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.5)',
                color: isSelected ? color : 'rgba(255,255,255,0.85)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: isSelected ? `0 0 10px ${color}40` : 'none',
              }}
              title={`Inspect ${vessel} (${VESSEL_DETAILS[vessel]?.fullName})`}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: color,
                  display: 'inline-block',
                }}
              />
              {vessel}
              {vesselData?.[vessel]?.probability != null && (
                <span style={{ fontSize: '11px', opacity: 0.85, marginLeft: '2px' }}>
                  {Math.round(vesselData[vessel].probability * 100)}%
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Top-Right: Anatomical View Presets + Localized Risk HUD */}
      <div style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '8px',
        zIndex: 10,
        maxWidth: '260px',
      }}>
        {/* Anatomical Perspective Pills */}
        <div style={{
          display: 'flex',
          gap: '4px',
          background: 'rgba(0,0,0,0.55)',
          padding: '3px 5px',
          borderRadius: '6px',
          border: '1px solid rgba(255,255,255,0.12)',
        }}>
          {VIEW_PRESETS.map((vp) => (
            <button
              key={vp.label}
              onClick={() => handlePresetView(vp.pos)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.7)',
                fontSize: '11px',
                padding: '3px 7px',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                e.currentTarget.style.background = 'transparent';
              }}
              title={`View ${vp.label} anatomical perspective`}
            >
              {vp.label}
            </button>
          ))}
        </div>

        {/* Localized Risk Detail Card (when vessel is selected) */}
        {selectedVessel && activeVesselData && (
          <div style={{
            background: 'rgba(10, 16, 28, 0.88)',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${riskColor(activeVesselData)}60`,
            borderLeft: `4px solid ${riskColor(activeVesselData)}`,
            borderRadius: '8px',
            padding: '10px 12px',
            color: '#fff',
            fontSize: '12px',
            width: '100%',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            animation: 'fadeIn 0.2s ease',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontWeight: 700, color: riskColor(activeVesselData), fontSize: '13px' }}>
                {selectedVessel}
              </span>
              <button
                onClick={() => onVesselSelect(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Deselect vessel"
              >
                <X size={13} />
              </button>
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)', marginBottom: '6px' }}>
              {activeVesselInfo?.fullName}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>Predicted Stenosis:</span>
              <span style={{ fontWeight: 700, color: riskColor(activeVesselData) }}>
                {activeVesselData.probability != null ? `${Math.round(activeVesselData.probability * 100)}%` : '—'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>Clinical Status:</span>
              <span style={{ fontWeight: 600 }}>
                {activeVesselData.status || 'Evaluated'}
              </span>
            </div>
            <div style={{
              fontSize: '10px',
              color: 'rgba(255,255,255,0.55)',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              paddingTop: '5px',
              lineHeight: 1.3,
            }}>
              {activeVesselInfo?.territory}
            </div>
          </div>
        )}

        {/* Interaction Hint (when no vessel selected) */}
        {!selectedVessel && (
          <div style={{
            background: 'rgba(0,0,0,0.55)',
            borderRadius: '6px',
            padding: '5px 8px',
            fontSize: '10px',
            color: 'rgba(255,255,255,0.65)',
            textAlign: 'right',
            pointerEvents: 'none',
            letterSpacing: '0.02em',
            lineHeight: 1.3,
          }}>
            <div>🖐️ <strong>Scroll fingers on keypad</strong> to rotate 360°</div>
            <div style={{ opacity: 0.75 }}>Pinch or +/- to zoom · Click vessels</div>
          </div>
        )}
      </div>

      {/* Bottom Center Toolbar: Auto-rotate, Zoom In, Zoom Out, Reset, Trackpad mode toggle */}
      <div className="viz-controls" style={{ zIndex: 10 }}>
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          title={autoRotate ? 'Pause 360° auto-rotation' : 'Start 360° auto-rotation'}
          style={{
            color: autoRotate ? '#60a5fa' : 'rgba(255,255,255,0.7)',
            background: autoRotate ? 'rgba(96, 165, 250, 0.2)' : undefined,
          }}
        >
          {autoRotate ? <Pause size={14} /> : <Play size={14} />}
        </button>

        <button
          onClick={() => setTrackpadMode(trackpadMode === 'rotate' ? 'zoom' : 'rotate')}
          title={trackpadMode === 'rotate' ? 'Keypad Mode: Free Rotate (Click to switch to Zoom)' : 'Keypad Mode: Zoom (Click to switch to Free Rotate)'}
          style={{
            color: trackpadMode === 'rotate' ? '#34d399' : '#fbbf24',
            background: 'rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            width: 'auto',
            padding: '0 8px',
            borderRadius: '14px',
            fontSize: '10px',
            fontWeight: 600,
          }}
        >
          <Move3d size={13} />
          {trackpadMode === 'rotate' ? 'Rotate' : 'Zoom'}
        </button>

        {/* Heart Myocardium Style Switcher */}
        <div style={{
          display: 'flex',
          gap: '2px',
          background: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '2px',
          alignItems: 'center',
        }}>
          {STYLE_OPTIONS.map((opt) => {
            const isActive = heartStyle === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setHeartStyle(opt.id)}
                title={opt.desc}
                style={{
                  background: isActive ? 'rgba(255, 255, 255, 0.24)' : 'transparent',
                  color: isActive ? '#fff' : 'rgba(255, 255, 255, 0.65)',
                  border: 'none',
                  borderRadius: '14px',
                  fontSize: '10px',
                  fontWeight: isActive ? 700 : 500,
                  padding: '2px 8px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  width: 'auto',
                  height: '24px',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <button onClick={handleZoomIn} title="Zoom in (+)">
          <ZoomIn size={14} />
        </button>
        <button onClick={handleZoomOut} title="Zoom out (-)">
          <ZoomOut size={14} />
        </button>
        <button onClick={handleReset} title="Reset view">
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Attribution & instruction note */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '12px',
        fontSize: '9px',
        color: 'rgba(255,255,255,0.3)',
        zIndex: 10,
        letterSpacing: '0.02em',
      }}>
        BodyParts3D 4.0 · CC BY-SA 2.1 JP
      </div>
    </div>
  );
}
