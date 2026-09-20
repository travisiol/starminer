"use client";

import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { MISSIONS } from "@/game/config/missions";
import { PLANETS } from "@/game/config/planets";
import { ZONES } from "@/game/config/zones";
import type { MissionPlan } from "@/game/engine/mission";
import type { Mission, PlanetConfig } from "@/game/types";
import { useLowQuality, usePrefersReducedMotion } from "@/lib/hooks";
import { Planet } from "../Planet";
import { QualityContext, dprFor } from "../quality";
import { StarField } from "../StarField";
import { Sun } from "../Sun";
import { systemSim } from "./systemSim";

export interface SystemSceneProps {
  plans: MissionPlan[];
  named: boolean[];
  selected: number | null;
  hovered: number | null;
  onSelect: (id: number | null) => void;
  onHover: (id: number | null) => void;
  activeMission: Mission | null;
  /** Bumps to request a camera fit: null = whole system, n = zone n. */
  focus: { zone: number | null; nonce: number };
  /** Zone the camera settles on at mount — the player's frontier. */
  initialZone: number;
}

/** The planet's world position for a given sim time. */
export function planetPosition(p: PlanetConfig, t: number, out: THREE.Vector3): THREE.Vector3 {
  const a = p.orbit.angle + t * p.orbit.speed;
  const r = p.orbit.radius;
  out.set(Math.cos(a) * r, Math.sin(a) * r * Math.sin(p.orbit.inclination), Math.sin(a) * r * Math.cos(p.orbit.inclination));
  return out;
}

const ORIGIN = new THREE.Vector3(0, 0, 0);
const HANGAR_POS = new THREE.Vector3(9.5, 0.6, 3);

/* ------------------------------------------------------------------ */

export function SystemScene(props: SystemSceneProps) {
  const low = useLowQuality();
  const reduced = usePrefersReducedMotion();
  const quality = low ? "low" : "high";
  return (
    <Canvas
      dpr={dprFor(quality)}
      camera={{ position: [0, 64, 118], fov: 48, near: 0.5, far: 2400 }}
      gl={{ antialias: !low, powerPreference: "high-performance", preserveDrawingBuffer: process.env.NODE_ENV !== "production" }}
      onPointerMissed={() => props.onSelect(null)}
      className="!absolute inset-0"
      frameloop={reduced ? "demand" : "always"}
    >
      <QualityContext.Provider value={quality}>
        <color attach="background" args={["#050607"]} />
        <fog attach="fog" args={["#050607", 420, 1400]} />
        <ambientLight intensity={0.12} />
        <StarField count={low ? 1400 : 2800} radius={900} />
        <Sun radius={5} />
        <Orbits hovered={props.hovered} selected={props.selected} plans={props.plans} />
        <ZoneBands />
        <HangarStation />
        {PLANETS.map((p, i) => (
          <PlanetNode key={p.id} planet={p} plan={props.plans[i]} named={props.named[i]} selected={props.selected === p.id} hovered={props.hovered === p.id} onSelect={props.onSelect} onHover={props.onHover} />
        ))}
        <Expedition mission={props.activeMission} />
        <CameraRig selected={props.selected} focus={props.focus} initialZone={props.initialZone} />
      </QualityContext.Provider>
    </Canvas>
  );
}

/* ---------------- orbits & zones ---------------- */

function Orbits({ hovered, selected, plans }: { hovered: number | null; selected: number | null; plans: MissionPlan[] }) {
  const lines = useMemo(
    () =>
      PLANETS.map((p) => {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 160; i++) {
          const a = (i / 160) * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(a) * p.orbit.radius, Math.sin(a) * p.orbit.radius * Math.sin(p.orbit.inclination), Math.sin(a) * p.orbit.radius * Math.cos(p.orbit.inclination)));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color: "#252b32", transparent: true, opacity: 0.55 });
        return new THREE.Line(geo, mat);
      }),
    [],
  );
  useFrame(() => {
    lines.forEach((l, i) => {
      const id = i + 1;
      const m = l.material as THREE.LineBasicMaterial;
      const state = plans[i]?.access.state;
      const active = id === selected || id === hovered;
      const target = active ? 1 : state === "unlocked" ? 0.7 : state === "locked" ? 0.45 : 0.28;
      m.opacity += (target - m.opacity) * 0.15;
      m.color.set(active ? "#8edbff" : state === "unlocked" ? "#3a4652" : "#1f252c");
    });
  });
  return (
    <group>
      {lines.map((l, i) => (
        <primitive key={i} object={l} />
      ))}
    </group>
  );
}

function ZoneBands() {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {ZONES.map((z) => (
        <mesh key={z.id} renderOrder={-1}>
          <ringGeometry args={[z.band[0] - 1.5, z.band[1] + 1.5, 128]} />
          <meshBasicMaterial color="#8edbff" transparent opacity={0.018 + (z.id % 2) * 0.008} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {ZONES.map((z) => (
        <Html key={`l${z.id}`} position={[0, -(z.band[1] + 0.5), 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
          <div className="label whitespace-nowrap text-[9px] text-dim">
            ZONE {z.id} · {z.name.toUpperCase()}
          </div>
        </Html>
      ))}
    </group>
  );
}

function HangarStation() {
  const ring = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ring.current) ring.current.rotation.z += dt * 0.4;
  });
  return (
    <group position={HANGAR_POS.toArray()}>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.9, 0.06, 8, 40]} />
        <meshBasicMaterial color="#8edbff" transparent opacity={0.7} />
      </mesh>
      <mesh>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#5c636b" metalness={0.8} roughness={0.4} />
      </mesh>
      <Html position={[0, 1.6, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
        <div className="label whitespace-nowrap text-[9px] text-muted">HANGAR</div>
      </Html>
    </group>
  );
}

/* ---------------- planets ---------------- */

interface NodeProps {
  planet: PlanetConfig;
  plan: MissionPlan;
  named: boolean;
  selected: boolean;
  hovered: boolean;
  onSelect: (id: number | null) => void;
  onHover: (id: number | null) => void;
}

const TMP = new THREE.Vector3();

function PlanetNode({ planet, plan, named, selected, hovered, onSelect, onHover }: NodeProps) {
  const group = useRef<THREE.Group>(null);
  const marker = useRef<THREE.Sprite>(null);
  const mining = useRef<THREE.Mesh>(null);
  const state = plan.access.state;
  const dim = state === "unknown" ? 1 : state === "locked" ? 0.35 : 0;
  const markerTex = useMemo(() => ringTexture(), []);
  const markerColor = selected ? "#ffffff" : hovered ? "#8edbff" : state === "unlocked" ? "#8edbff" : state === "locked" ? "#6b7480" : "#3a4149";
  const hit = Math.max(planet.visual.radius * 1.4, 2.6);
  const isMining = systemSim.miningPlanet === planet.id;

  useFrame((frame) => {
    const t = systemSim.time(frame.clock.elapsedTime);
    if (group.current) planetPosition(planet, t, group.current.position);
    if (marker.current) {
      const s = selected ? 0.05 : hovered ? 0.045 : 0.032;
      marker.current.scale.set(s, s, 1);
      (marker.current.material as THREE.SpriteMaterial).opacity = selected || hovered ? 1 : state === "unknown" ? 0.35 : 0.6;
    }
    if (mining.current) {
      const s = 1 + 0.12 * Math.sin(frame.clock.elapsedTime * 2.2);
      mining.current.scale.setScalar(s);
      mining.current.rotation.z += 0.01;
    }
  });

  const label = named ? `${planet.id.toString().padStart(2, "0")} ${planet.name.toUpperCase()}` : `${planet.id.toString().padStart(2, "0")} UNKNOWN`;

  return (
    <group ref={group}>
      <Planet visual={planet.visual} lightPos={ORIGIN} dim={dim} spin={0.06} />
      <mesh
        visible={false}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(planet.id);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(planet.id);
        }}
      >
        <sphereGeometry args={[hit, 12, 8]} />
        <meshBasicMaterial />
      </mesh>
      <sprite ref={marker}>
        <spriteMaterial map={markerTex} color={markerColor} transparent depthTest={false} sizeAttenuation={false} />
      </sprite>
      {isMining ? (
        <mesh ref={mining} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[planet.visual.radius * 1.5, planet.visual.radius * 1.62, 48]} />
          <meshBasicMaterial color="#8edbff" transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ) : null}
      {/* Unknown worlds stay silent until pointed at — thirty labels at once would bury the map. */}
      {named || hovered || selected ? (
        <Html position={[0, -(planet.visual.radius + 1.2), 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <div className={`label whitespace-nowrap text-[9.5px] transition-opacity ${selected || hovered ? "text-text" : state === "unlocked" ? "text-muted" : "text-dim"}`}>{label}</div>
        </Html>
      ) : null}
    </group>
  );
}

let ringTex: THREE.Texture | null = null;
function ringTexture() {
  if (ringTex) return ringTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.strokeStyle = "rgba(255,255,255,1)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(32, 32, 26, 0, Math.PI * 2);
  ctx.stroke();
  ringTex = new THREE.CanvasTexture(c);
  return ringTex;
}

/* ---------------- expedition transition ---------------- */

/** Three small ships leave the hangar, fly to the planet over the launch transition, then hold orbit until the mission resolves. */
function Expedition({ mission }: { mission: Mission | null }) {
  const group = useRef<THREE.Group>(null);
  const planet = mission ? PLANETS[mission.planetId - 1] : null;
  const active = Boolean(mission && (mission.status === "in-progress" || mission.status === "resolved"));
  useEffect(() => {
    systemSim.miningPlanet = mission && mission.status === "in-progress" ? mission.planetId : null;
    return () => {
      systemSim.miningPlanet = null;
    };
  }, [mission]);

  useFrame((frame) => {
    if (!group.current || !mission || !planet) return;
    const now = Date.now();
    const t = systemSim.time(frame.clock.elapsedTime);
    planetPosition(planet, t, TMP);
    const k = Math.min(1, (now - mission.startedAt) / (MISSIONS.launchTransitionSeconds * 1000));
    const ease = 1 - Math.pow(1 - k, 3);
    const lift = Math.sin(ease * Math.PI) * 6;
    group.current.position.lerpVectors(HANGAR_POS, TMP, ease);
    group.current.position.y += lift;
    if (k >= 1) {
      const orbit = planet.visual.radius * 1.5;
      const a = frame.clock.elapsedTime * 1.4;
      group.current.position.set(TMP.x + Math.cos(a) * orbit, TMP.y + 0.3, TMP.z + Math.sin(a) * orbit);
    }
    group.current.visible = active && mission.status === "in-progress";
  });

  return (
    <group ref={group} visible={false}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[(i - 1) * 0.45, 0, i === 1 ? -0.3 : 0.2]}>
          <sphereGeometry args={[0.14, 8, 8]} />
          <meshBasicMaterial color="#8edbff" />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------- camera ---------------- */

const zoneFit = (zone: number | null) => ({
  target: new THREE.Vector3(0, 0, 0),
  distance: zone === null ? 440 : ZONES[zone - 1].band[1] * 1.55 + 40,
  polar: zone === null ? 0.95 : 1.05,
});

function CameraRig({ selected, focus, initialZone }: { selected: number | null; focus: SystemSceneProps["focus"]; initialZone: number }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const target = useMemo(() => new THREE.Vector3(), []);
  // Starts at the initial nonce so mounting never counts as a "Fit" request.
  const lastNonce = useRef(0);
  // The first frames ease onto the frontier zone, so a new commander opens on Aera, not on an empty void.
  // `until: -1` = stamped on the first frame (clocks are impure during render).
  const goal = useRef<{ target: THREE.Vector3; distance: number; polar: number; until: number } | null>({ ...zoneFit(initialZone), until: -1 });

  // A zone fit or a selection sets a goal the rig eases toward for ~1.6 s, then hands control back.
  useEffect(() => {
    if (focus.nonce === lastNonce.current) return;
    lastNonce.current = focus.nonce;
    goal.current = { ...zoneFit(focus.zone), until: performance.now() + 1600 };
  }, [focus]);

  useEffect(() => {
    if (selected === null) return;
    const p = PLANETS[selected - 1];
    goal.current = { target: new THREE.Vector3(), distance: Math.max(9, p.visual.radius * 6.5), polar: 1.15, until: performance.now() + 1800 };
  }, [selected]);

  useFrame((frame, dt) => {
    const c = controls.current;
    if (!c) return;
    const g = goal.current;
    if (g) {
      if (g.until < 0) g.until = performance.now() + 2200;
      if (selected !== null) {
        const p = PLANETS[selected - 1];
        planetPosition(p, systemSim.time(frame.clock.elapsedTime), g.target);
      }
      const k = 1 - Math.exp(-dt * 4.5);
      target.copy(c.target).lerp(g.target, k);
      c.target.copy(target);
      const dir = new THREE.Vector3().subVectors(camera.position, c.target);
      const spherical = new THREE.Spherical().setFromVector3(dir);
      spherical.radius += (g.distance - spherical.radius) * k;
      spherical.phi += (g.polar - spherical.phi) * k;
      dir.setFromSpherical(spherical);
      camera.position.copy(c.target).add(dir);
      if (performance.now() > g.until && selected === null) goal.current = null;
    } else if (selected !== null) {
      // Keep following the selected planet as it moves along its orbit.
      const p = PLANETS[selected - 1];
      const prev = target.clone();
      planetPosition(p, systemSim.time(frame.clock.elapsedTime), target);
      const delta = target.clone().sub(prev);
      c.target.add(delta);
      camera.position.add(delta);
    }
    c.update();
  });

  return <OrbitControls ref={controls} enablePan={false} enableDamping dampingFactor={0.08} minDistance={7} maxDistance={480} minPolarAngle={0.25} maxPolarAngle={1.45} rotateSpeed={0.6} zoomSpeed={0.8} />;
}
