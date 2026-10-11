/**
 * ActualHeartModel - BodyParts3D anatomical heart visualization.
 *
 * Anatomical Mesh Provenance:
 *   Heart body: Full BodyParts3D FMA7088 Chambers & Myocardium (FJ2417-FJ2439)
 *   LAD:        FMA3862 (Anterior Interventricular Branch)
 *   LCX:        FMA3895 (Circumflex Branch)
 *   RCA:        FMA50039 (Right Coronary Artery Tree)
 *
 * Props:
 *   selectedVessel: 'LAD' | 'LCX' | 'RCA' | null
 *   vesselData:     { LAD: { probability, riskLevel }, LCX: {...}, RCA: {...} }
 *   heartStyle:     'anatomical' | 'glass' | 'angiogram'
 *   onVesselSelect: (name: string | null) => void
 */
import { Suspense, useRef, useState, useMemo } from 'react';
import { useLoader, useFrame } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as THREE from 'three';
import { riskColor } from '../../utils/riskColor';

function vesselColor(data) {
  return riskColor(data) ?? '#ef4444';
}

function usePulseRef(active) {
  const valRef = useRef(0.18);
  useFrame(({ clock }) => {
    valRef.current = active
      ? 0.38 + 0.30 * Math.sin(clock.elapsedTime * 3.4)
      : 0.18;
  });
  return valRef;
}

function AnatomicalMesh({
  path,
  color,
  emissiveIntensityRef,
  staticEmissive,
  roughness = 0.35,
  metalness = 0.08,
  opacity = 1,
  transparent = false,
  depthWrite = true,
  side = THREE.FrontSide,
  onClick,
  onPointerDown,
  onPointerOver,
  onPointerOut,
}) {
  const obj = useLoader(OBJLoader, path);

  const geometry = useMemo(() => {
    let geo = null;
    obj.traverse((child) => {
      if (child.isMesh && !geo) {
        geo = child.geometry.clone();
        geo.computeVertexNormals();
      }
    });
    return geo;
  }, [obj]);

  const matRef = useRef();
  useFrame(() => {
    if (matRef.current && emissiveIntensityRef) {
      matRef.current.emissiveIntensity = emissiveIntensityRef.current;
    }
  });

  if (!geometry) return null;

  return (
    <mesh
      geometry={geometry}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        ref={matRef}
        color={color}
        emissive={color}
        emissiveIntensity={staticEmissive ?? 0.12}
        roughness={roughness}
        metalness={metalness}
        transparent={transparent}
        opacity={opacity}
        depthWrite={depthWrite}
        side={side}
      />
    </mesh>
  );
}

function CoronaryArtery({ name, objPath, vesselData, selected, dimmed, onVesselSelect }) {
  const [hovered, setHovered] = useState(false);
  const pulseRef = usePulseRef(selected);
  const color = vesselColor(vesselData?.[name]);
  const pointerDownPos = useRef(null);

  const handlePointerDown = (e) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleClick = (e) => {
    e.stopPropagation();
    // Distinguish camera orbit drag from intentional vessel click
    if (pointerDownPos.current) {
      const dx = e.clientX - pointerDownPos.current.x;
      const dy = e.clientY - pointerDownPos.current.y;
      if (Math.hypot(dx, dy) > 6) {
        return; // User was dragging to rotate the camera
      }
    }
    onVesselSelect?.(name);
  };

  const handleOver = (e) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handleOut = () => {
    setHovered(false);
    document.body.style.cursor = 'default';
  };

  return (
    <Suspense fallback={null}>
      <AnatomicalMesh
        path={objPath}
        color={color}
        emissiveIntensityRef={selected ? pulseRef : undefined}
        staticEmissive={selected ? 0.42 : hovered ? 0.48 : 0.22}
        roughness={0.25}
        metalness={0.15}
        opacity={dimmed ? 0.20 : 1}
        transparent={dimmed}
        side={THREE.FrontSide}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
      />
    </Suspense>
  );
}

function HeartBody({ dimmed, heartStyle = 'anatomical', selectedVessel, onVesselSelect }) {
  const pointerDownPos = useRef(null);

  const handlePointerDown = (e) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleClick = (e) => {
    if (pointerDownPos.current) {
      const dx = e.clientX - pointerDownPos.current.x;
      const dy = e.clientY - pointerDownPos.current.y;
      if (Math.hypot(dx, dy) > 6) return;
    }
    if (selectedVessel) {
      onVesselSelect?.(null);
    }
  };

  // 'angiogram' mode hides heart body entirely for pure coronary catheterization view
  if (heartStyle === 'angiogram') {
    return null;
  }

  // Always use the complete big heart (full BodyParts3D organ spanning atria, ventricles, and apex)
  const meshPath = '/heart_obj/heart_body.obj';
  const isGlass = heartStyle === 'glass';

  // Aesthetic color palettes:
  // - Anatomical:
  //   When normal: 100% solid, fully opaque cardiac muscle (#b84656) with FrontSide depth-testing
  //   This completely eliminates interior overlapping triangle artifacts ("broken pieces")!
  //   When dimmed: gracefully ghosted so selected vessel shines
  // - Frosted Glass:
  //   High-tech medical x-ray cyan (#38bdf8), soft translucent organ silhouette
  const bodyColor = isGlass
    ? (dimmed ? '#0284c7' : '#38bdf8')
    : (dimmed ? '#7d303b' : '#b84656');

  const opacity = isGlass
    ? (dimmed ? 0.08 : 0.28)
    : (dimmed ? 0.16 : 1.0);

  const isTransparent = isGlass || dimmed;
  const depthWrite = !isGlass && !dimmed;
  const roughness = isGlass ? 0.20 : 0.44;
  const metalness = isGlass ? 0.15 : 0.06;

  return (
    <Suspense fallback={null}>
      <AnatomicalMesh
        path={meshPath}
        color={bodyColor}
        staticEmissive={isGlass ? (dimmed ? 0.02 : 0.10) : (dimmed ? 0.02 : 0.06)}
        roughness={roughness}
        metalness={metalness}
        opacity={opacity}
        transparent={isTransparent}
        depthWrite={depthWrite}
        side={THREE.FrontSide}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      />
    </Suspense>
  );
}

function LoadingPlaceholder() {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.9;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.6, 16, 16]} />
      <meshStandardMaterial color="#555" wireframe />
    </mesh>
  );
}

export default function ActualHeartModel({
  selectedVessel,
  vesselData,
  heartStyle = 'anatomical',
  onVesselSelect,
}) {
  const vessels = [
    { name: 'LAD', path: '/heart_obj/lad.obj' },
    { name: 'LCX', path: '/heart_obj/lcx.obj' },
    { name: 'RCA', path: '/heart_obj/rca.obj' },
  ];

  return (
    <group>
      <Suspense fallback={<LoadingPlaceholder />}>
        <HeartBody
          dimmed={!!selectedVessel}
          heartStyle={heartStyle}
          selectedVessel={selectedVessel}
          onVesselSelect={onVesselSelect}
        />
      </Suspense>

      {vessels.map(({ name, path }) => (
        <CoronaryArtery
          key={name}
          name={name}
          objPath={path}
          vesselData={vesselData}
          selected={selectedVessel === name}
          dimmed={!!selectedVessel && selectedVessel !== name}
          onVesselSelect={onVesselSelect}
        />
      ))}
    </group>
  );
}
