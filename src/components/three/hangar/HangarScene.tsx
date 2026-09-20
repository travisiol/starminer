"use client";

import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { shipById } from "@/game/config/ships";
import type { FleetSlots, OwnedShip } from "@/game/types";
import { useLowQuality, usePrefersReducedMotion } from "@/lib/hooks";
import { applyStudioEnvironment } from "../environment";
import { QualityContext, dprFor } from "../quality";
import { ShipModel } from "../ships/ShipModel";
import { StarField } from "../StarField";

const PLATFORM_X = [-11, 0, 11];

interface Props {
  fleet: FleetSlots;
  ships: OwnedShip[];
  /** Slot index that just changed — its platform powers up. */
  pulseSlot?: number | null;
  /** Engines lit (mission launching / in progress). */
  ignition?: boolean;
}

/** Three platforms in a dark hangar bay open to space. Equipped hulls sit on their platform; empty ones show a holo ring. */
export function HangarScene({ fleet, ships, ignition = false }: Props) {
  const low = useLowQuality();
  const reduced = usePrefersReducedMotion();
  const quality = low ? "low" : "high";
  return (
    <Canvas
      dpr={dprFor(quality)}
      camera={{ position: [0, 9, 30], fov: 40, near: 0.1, far: 800 }}
      gl={{ antialias: !low, powerPreference: "high-performance", preserveDrawingBuffer: process.env.NODE_ENV !== "production" }}
      className="!absolute inset-0"
      frameloop={reduced ? "demand" : "always"}
      onCreated={({ camera, gl, scene }) => {
        camera.lookAt(0, 1.5, 0);
        applyStudioEnvironment(gl, scene, 0.5);
      }}
    >
      <QualityContext.Provider value={quality}>
        <color attach="background" args={["#050607"]} />
        <fog attach="fog" args={["#050607", 40, 120]} />
        <hemisphereLight args={["#2a3340", "#05060a", 0.55]} />
        <directionalLight position={[8, 14, 10]} intensity={1.1} color="#dfe9f5" />
        <directionalLight position={[-10, 6, -6]} intensity={0.35} color="#8edbff" />
        <StarField count={low ? 900 : 1800} radius={500} dim={0.8} />
        <Bay />
        {PLATFORM_X.map((x, i) => {
          const id = fleet[i];
          const owned = id ? ships.find((s) => s.instanceId === id) : undefined;
          const hull = owned ? shipById(owned.hullId) : null;
          return (
            <group key={i} position={[x, 0, 0]}>
              <Platform index={i} occupied={Boolean(hull)} />
              {hull ? <ShipModel hull={hull} position={[0, 2.4, 0]} rotation={[0, Math.PI * 0.82, 0]} thrust={ignition ? 1 : 0.45} turn={0.12} bob={0.12} /> : <HoloRing />}
            </group>
          );
        })}
        <OrbitControls enablePan={false} enableDamping dampingFactor={0.08} minDistance={16} maxDistance={44} minPolarAngle={0.9} maxPolarAngle={1.42} minAzimuthAngle={-0.55} maxAzimuthAngle={0.55} target={[0, 1.5, 0]} />
      </QualityContext.Provider>
    </Canvas>
  );
}

function Bay() {
  const grid = useMemo(() => {
    const g = new THREE.GridHelper(120, 60, "#1c2229", "#12161b");
    g.position.y = -0.01;
    return g;
  }, []);
  return (
    <group>
      <primitive object={grid} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#0a0c0f" metalness={0.6} roughness={0.55} />
      </mesh>
      {/* Ceiling beams framing the bay opening. */}
      {[-16, -8, 0, 8, 16].map((x) => (
        <mesh key={x} position={[x, 13, -6]}>
          <boxGeometry args={[0.5, 0.8, 30]} />
          <meshStandardMaterial color="#1a1f25" metalness={0.7} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 13.4, -6]}>
        <boxGeometry args={[36, 0.3, 30]} />
        <meshStandardMaterial color="#0d1014" metalness={0.5} roughness={0.7} />
      </mesh>
      {/* Side walls with panel lines. */}
      {[-19, 19].map((x) => (
        <group key={x}>
          <mesh position={[x, 6.5, -6]}>
            <boxGeometry args={[0.4, 14, 30]} />
            <meshStandardMaterial color="#11151a" metalness={0.5} roughness={0.7} />
          </mesh>
          {[2, 6, 10].map((y) => (
            <mesh key={y} position={[x + (x < 0 ? 0.25 : -0.25), y, -6]}>
              <boxGeometry args={[0.05, 0.08, 28]} />
              <meshBasicMaterial color="#8edbff" transparent opacity={0.35} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Platform({ index, occupied }: { index: number; occupied: boolean }) {
  const ring = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  const level = useRef(occupied ? 1 : 0);
  useFrame((state, dt) => {
    level.current += ((occupied ? 1 : 0.18) - level.current) * Math.min(1, dt * 2.2);
    const l = level.current;
    if (ring.current) {
      const m = ring.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.25 + 0.75 * l * (0.85 + 0.15 * Math.sin(state.clock.elapsedTime * 2 + index));
    }
    if (beam.current) (beam.current.material as THREE.MeshBasicMaterial).opacity = 0.05 * l;
  });
  return (
    <group>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[4.4, 4.7, 0.6, 48]} />
        <meshStandardMaterial color="#1a1f25" metalness={0.8} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[3.9, 3.9, 0.06, 48]} />
        <meshStandardMaterial color="#252b32" metalness={0.7} roughness={0.5} />
      </mesh>
      <mesh ref={ring} position={[0, 0.66, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.0, 4.25, 64]} />
        <meshBasicMaterial color="#8edbff" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={beam} position={[0, 6, 0]}>
        <cylinderGeometry args={[3.6, 4.1, 11, 32, 1, true]} />
        <meshBasicMaterial color="#8edbff" transparent opacity={0.04} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <Html position={[0, 0.7, 5.4]} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
        <div className="label whitespace-nowrap text-[9.5px] text-muted">PLATFORM 0{index + 1}</div>
      </Html>
    </group>
  );
}

function HoloRing() {
  const g = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    if (!g.current) return;
    g.current.rotation.y += dt * 0.5;
    g.current.position.y = 2.2 + Math.sin(state.clock.elapsedTime * 1.2) * 0.15;
  });
  return (
    <group ref={g} position={[0, 2.2, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.6, 0.03, 8, 64]} />
        <meshBasicMaterial color="#8edbff" transparent opacity={0.35} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.9, 0.02, 8, 48]} />
        <meshBasicMaterial color="#8edbff" transparent opacity={0.2} />
      </mesh>
    </group>
  );
}
