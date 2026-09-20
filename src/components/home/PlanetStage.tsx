"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { PlanetConfig } from "@/game/types";
import { useLowQuality, usePrefersReducedMotion } from "@/lib/hooks";
import { Planet } from "@/components/three/Planet";
import { QualityContext, dprFor } from "@/components/three/quality";
import { StarField } from "@/components/three/StarField";

const LIGHT = new THREE.Vector3(-60, 30, 40);
const BASE_RADIUS = 2.2;

/** Stage radius grows a little with the zone so outer worlds feel bigger without breaking the frame. */
const stageRadius = (p: PlanetConfig) => BASE_RADIUS * (0.85 + (p.zone - 1) * 0.05);

interface Props {
  planet: PlanetConfig;
  /** 0 known, 0.35 locked, 1 unscanned silhouette. */
  dim: number;
  /** Where the new world slides in from: +1 = from the right (next), −1 = from the left. */
  direction: -1 | 0 | 1;
  mining: boolean;
}

/** One world, centre stage, in front of a violet nebula. The home page's 3D. */
export function PlanetStage({ planet, dim, direction, mining }: Props) {
  const low = useLowQuality();
  const reduced = usePrefersReducedMotion();
  const quality = low ? "low" : "high";
  return (
    <Canvas
      dpr={dprFor(quality)}
      camera={{ position: [0, 0.4, 9.5], fov: 40, near: 0.1, far: 800 }}
      gl={{ antialias: !low, alpha: false, preserveDrawingBuffer: process.env.NODE_ENV !== "production" }}
      className="!absolute inset-0"
      frameloop={reduced ? "demand" : "always"}
      onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
    >
      <QualityContext.Provider value={quality}>
        <color attach="background" args={["#06050c"]} />
        <ambientLight intensity={0.1} />
        <directionalLight position={LIGHT.toArray()} intensity={1.15} color="#f3ecff" />
        <StarField count={low ? 800 : 1600} radius={320} dim={0.85} seed={planet.id * 13} />
        <Nebula />
        <Slide id={planet.id} direction={direction}>
          <Planet visual={planet.visual} radius={stageRadius(planet)} lightPos={LIGHT} dim={dim} spin={0.07} detail />
          {mining ? <MiningRing radius={stageRadius(planet)} /> : null}
        </Slide>
      </QualityContext.Provider>
    </Canvas>
  );
}

/** The new world enters from the swipe direction and eases to centre. */
function Slide({ id, direction, children }: { id: number; direction: -1 | 0 | 1; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useEffect(() => {
    if (group.current) group.current.position.x = direction * 9;
  }, [id, direction]);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    g.position.x += (0 - g.position.x) * (1 - Math.exp(-dt * 5));
  });
  return <group ref={group}>{children}</group>;
}

let nebulaCache: Record<string, THREE.Texture> = {};
function nebulaTexture(color: string): THREE.Texture {
  if (nebulaCache[color]) return nebulaCache[color];
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, color);
  g.addColorStop(0.55, color.replace(/[\d.]+\)$/, "0.12)"));
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  nebulaCache = { ...nebulaCache, [color]: t };
  return t;
}

/** Two soft additive clouds, violet and magenta, far behind the world. */
function Nebula() {
  const violet = useMemo(() => nebulaTexture("rgba(124,58,237,0.6)"), []);
  const magenta = useMemo(() => nebulaTexture("rgba(232,121,249,0.4)"), []);
  return (
    <group>
      <sprite position={[-7, 3, -34]} scale={[52, 52, 1]}>
        <spriteMaterial map={violet} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.55} />
      </sprite>
      <sprite position={[9, -5, -40]} scale={[44, 44, 1]}>
        <spriteMaterial map={magenta} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.35} />
      </sprite>
    </group>
  );
}

function MiningRing({ radius }: { radius: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.z += 0.01;
    ref.current.scale.setScalar(1 + 0.05 * Math.sin(state.clock.elapsedTime * 2.2));
  });
  return (
    <mesh ref={ref} rotation={[Math.PI / 2.4, 0.3, 0]}>
      <ringGeometry args={[radius * 1.45, radius * 1.52, 96]} />
      <meshBasicMaterial color="#a78bfa" transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}
