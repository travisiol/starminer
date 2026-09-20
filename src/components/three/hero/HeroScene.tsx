"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { PLANETS } from "@/game/config/planets";
import { shipById } from "@/game/config/ships";
import { useLowQuality, usePrefersReducedMotion } from "@/lib/hooks";
import { applyStudioEnvironment } from "../environment";
import { Planet } from "../Planet";
import { QualityContext, dprFor } from "../quality";
import { ShipModel } from "../ships/ShipModel";
import { StarField } from "../StarField";
import { Sun } from "../Sun";
import { heroInput } from "./heroInput";

const SUN_POS = new THREE.Vector3(-70, 22, -160);

/** The landing hero: one large capital hull drifting past a distant star system. */
export function HeroScene({ hullId = "leviathan" }: { hullId?: string }) {
  const low = useLowQuality();
  const reduced = usePrefersReducedMotion();
  const quality = low ? "low" : "high";
  const hull = shipById(hullId);
  return (
    <Canvas
      dpr={dprFor(quality)}
      camera={{ position: [0, 2.2, 24], fov: 38, near: 0.1, far: 1500 }}
      gl={{ antialias: !low, powerPreference: "high-performance", preserveDrawingBuffer: process.env.NODE_ENV !== "production" }}
      className="!absolute inset-0"
      frameloop={reduced ? "demand" : "always"}
      onCreated={({ gl, scene }) => applyStudioEnvironment(gl, scene, 0.6)}
      onPointerMove={(e) => {
        heroInput.x = (e.clientX / window.innerWidth - 0.5) * 2;
        heroInput.y = (e.clientY / window.innerHeight - 0.5) * 2;
      }}
    >
      <QualityContext.Provider value={quality}>
        <color attach="background" args={["#050607"]} />
        <fog attach="fog" args={["#050607", 200, 900]} />
        <ambientLight intensity={0.18} />
        <directionalLight position={[-6, 5, 8]} intensity={1.6} color="#fff1d9" />
        <directionalLight position={[8, -3, -6]} intensity={0.5} color="#8edbff" />
        <StarField count={low ? 1200 : 2400} radius={700} />
        <group position={SUN_POS.toArray()}>
          <Sun radius={7} glowScale={7} />
        </group>
        <Backdrop />
        <Rig>
          {/* Three-quarter view, nose to the lower left, the hull filling the right half of the frame. */}
          <ShipModel hull={hull} scale={1.7} position={[3.6, -1.2, 0]} rotation={[0.18, 2.05, -0.1]} thrust={0.85} turn={0} bob={0.1} />
        </Rig>
      </QualityContext.Provider>
    </Canvas>
  );
}

/** A few worlds from the system, small and far, so the backdrop reads as "the system" without stealing the frame. */
function Backdrop() {
  // Quiet worlds only — Kryos, Cronis, Umbra — far enough back that the ship stays the subject.
  const picks = useMemo(() => [PLANETS[5], PLANETS[23], PLANETS[22]], []);
  const spots: [number, number, number][] = [
    [-30, 7, -90],
    [40, -6, -120],
    [16, 16, -170],
  ];
  return (
    <group>
      {picks.map((p, i) => (
        <group key={p.id} position={spots[i]} scale={i === 2 ? 1.3 : 1.6}>
          <Planet visual={p.visual} lightPos={SUN_POS} spin={0.03} />
        </group>
      ))}
    </group>
  );
}

function Rig({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (group.current) {
      group.current.rotation.y = Math.sin(t * 0.08) * 0.12 - 0.1;
      group.current.rotation.x = Math.sin(t * 0.11) * 0.03;
    }
    // Parallax toward the pointer; method calls keep the frame-state camera untouched as far as the compiler is concerned.
    const cam = state.camera;
    const k = 1 - Math.exp(-dt * 3);
    cam.position.setX(cam.position.x + (heroInput.x * 1.4 - cam.position.x) * k);
    cam.position.setY(cam.position.y + (2.2 - heroInput.y * 0.8 - cam.position.y) * k);
    cam.lookAt(0.6, 0, 0);
  });
  return <group ref={group}>{children}</group>;
}
