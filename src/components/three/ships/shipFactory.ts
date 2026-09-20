import * as THREE from "three";
import { SHIPS } from "@/game/config/ships";
import type { ShipClass, ShipConfig, ShipVisual } from "@/game/types";
import { mulberry32 } from "@/lib/prng";

/* ------------------------------------------------------------------ */
/*  Procedural hulls. No assets: every ship is primitives, seeded by   */
/*  its config, built once and cached per hull id.                     */
/*  Ships point down −Z (nose forward), engines at +Z, Y up.            */
/*  Every hull in a class gets a different primary silhouette (by its   */
/*  slot in the class); the seed decides the secondary details.        */
/* ------------------------------------------------------------------ */

const PALETTES: Record<ShipVisual["palette"], { hull: string; panel: string; trim: string; dark: string }> = {
  titanium: { hull: "#a3aab2", panel: "#646b73", trim: "#2b3036", dark: "#1a1d21" },
  charcoal: { hull: "#4a5058", panel: "#2f343a", trim: "#1a1d21", dark: "#101215" },
  gunmetal: { hull: "#6b727a", panel: "#464c53", trim: "#292d32", dark: "#15181b" },
  bone: { hull: "#d8d5cb", panel: "#a09d95", trim: "#4a4a45", dark: "#2a2a27" },
  obsidian: { hull: "#272a30", panel: "#17191d", trim: "#3e444b", dark: "#0c0d10" },
};

/** Base hull length per class (scene units); power scales it further. */
const CLASS_LENGTH: Record<ShipClass, number> = { scout: 1.7, miner: 2.1, cruiser: 2.8, destroyer: 3.2, dreadnought: 4.4, capital: 5.9 };

/** Bigger ships feel bigger: 100 power → ×0.75, 1,000 → ×1.11, 18,500 → ×1.57. */
export const powerScale = (fleetPower: number) => 0.75 + 0.36 * Math.log10(Math.max(100, fleetPower) / 100);

export const shipLength = (hull: ShipConfig) => CLASS_LENGTH[hull.class] * powerScale(hull.fleetPower);

interface Mats {
  hull: THREE.MeshStandardMaterial;
  panel: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  paint: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  window: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  engine: THREE.MeshBasicMaterial;
}

const matCache = new Map<string, Mats>();

function materials(v: ShipVisual): Mats {
  const key = `${v.palette}|${v.accent}`;
  const hit = matCache.get(key);
  if (hit) return hit;
  const p = PALETTES[v.palette];
  const accent = new THREE.Color(v.accent);
  const m: Mats = {
    // Moderate metalness: enough to catch the studio environment, not so much that lights alone leave it black.
    hull: new THREE.MeshStandardMaterial({ color: p.hull, metalness: 0.55, roughness: 0.4 }),
    panel: new THREE.MeshStandardMaterial({ color: p.panel, metalness: 0.5, roughness: 0.55 }),
    trim: new THREE.MeshStandardMaterial({ color: p.trim, metalness: 0.45, roughness: 0.7 }),
    dark: new THREE.MeshStandardMaterial({ color: p.dark, metalness: 0.4, roughness: 0.8 }),
    paint: new THREE.MeshStandardMaterial({ color: accent, metalness: 0.3, roughness: 0.45, emissive: accent, emissiveIntensity: 0.25 }),
    glass: new THREE.MeshStandardMaterial({ color: "#0b1a24", metalness: 0.2, roughness: 0.1, emissive: accent, emissiveIntensity: 0.35 }),
    window: new THREE.MeshStandardMaterial({ color: "#0a0d12", emissive: new THREE.Color("#d9ecff"), emissiveIntensity: 1.3, roughness: 0.3 }),
    accent: new THREE.MeshStandardMaterial({ color: "#000000", emissive: accent, emissiveIntensity: 2.2, roughness: 0.4 }),
    engine: new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
  matCache.set(key, m);
  return m;
}

let glowTexture: THREE.Texture | null = null;
function glow(): THREE.Texture {
  if (glowTexture) return glowTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.3, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  glowTexture = new THREE.CanvasTexture(c);
  return glowTexture;
}

/* ---------------- baked geometry helpers (all along Z, nose at −Z) ---------------- */

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const sphere = (r: number, seg = 16) => new THREE.SphereGeometry(r, seg, Math.max(6, seg / 2));
/** Cylinder along Z. `rNose` at −Z, `rRear` at +Z. Four segments + `square` gives a flat-faced tapered prism. */
function zCyl(rNose: number, rRear: number, len: number, seg = 16, square = false): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rNose, rRear, len, seg);
  if (square) g.rotateY(Math.PI / 4);
  g.rotateX(-Math.PI / 2);
  return g;
}
const zCapsule = (r: number, len: number) => new THREE.CapsuleGeometry(r, Math.max(0.01, len - 2 * r), 6, 16).rotateX(Math.PI / 2);
/** Cone pointing forward (−Z); its base sits at z = 0, tip at z = −len. */
const noseCone = (r: number, len: number, seg = 16) => new THREE.ConeGeometry(r, len, seg).rotateX(-Math.PI / 2).translate(0, 0, -len / 2);
const yCyl = (r: number, h: number, seg = 8) => new THREE.CylinderGeometry(r, r, h, seg);
const ringZ = (R: number, t: number) => new THREE.TorusGeometry(R, t, 10, 48);
const dome = (r: number) => new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);

/**
 * A tapered, swept wing panel lying flat (span along X, chord along Z, thickness Y).
 * `side` = +1 right, −1 left. `sweep` shifts the tip toward the rear.
 */
function wingGeo(side: 1 | -1, span: number, rootChord: number, tipChord: number, sweep: number, t: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, -rootChord / 2);
  s.lineTo(side * span, -tipChord / 2 + sweep);
  s.lineTo(side * span, tipChord / 2 + sweep);
  s.lineTo(0, rootChord / 2);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false });
  g.rotateX(Math.PI / 2);
  g.translate(0, t / 2, 0);
  return g;
}

interface Ctx {
  g: THREE.Group;
  m: Mats;
  r: () => number;
  /** Class base length. */
  B: number;
  /** Position of the hull inside its class (0 = cheapest). Picks the primary silhouette. */
  slot: number;
}

function part(ctx: Ctx, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rot?: [number, number, number]): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
  ctx.g.add(mesh);
  return mesh;
}

/* ---------------- shared details ---------------- */

/** Engine: dark nozzle, bright core, additive glow sprite (tagged so scenes can pulse it). */
function engine(ctx: Ctx, x: number, y: number, z: number, r: number) {
  part(ctx, zCyl(r * 0.85, r, r * 1.7, 14), ctx.m.trim, x, y, z);
  part(ctx, zCyl(r * 0.62, r * 0.7, r * 0.3, 14), ctx.m.dark, x, y, z + r * 0.95);
  part(ctx, zCyl(r * 0.5, r * 0.5, r * 0.4, 12), ctx.m.engine, x, y, z + r * 1.0);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: ctx.m.engine.color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 }));
  s.scale.setScalar(r * 4.2);
  s.position.set(x, y, z + r * 1.2);
  s.name = "engine-glow";
  ctx.g.add(s);
}

function light(ctx: Ctx, x: number, y: number, z: number, r = 0.035) {
  part(ctx, sphere(r, 8), ctx.m.accent, x, y, z);
}

/** A row of lit windows along Z on one side of the hull. */
function windows(ctx: Ctx, x: number, y: number, z0: number, z1: number, n: number, size = 0.05) {
  for (let i = 0; i < n; i++) part(ctx, box(size * 0.6, size, size * 1.4), ctx.m.window, x, y, z0 + ((z1 - z0) * (i + 0.5)) / n);
}

/** A painted stripe (accent colour) lying on a surface. */
function stripe(ctx: Ctx, x: number, y: number, z: number, w: number, d: number, rot?: [number, number, number]) {
  part(ctx, box(w, 0.025, d), ctx.m.paint, x, y, z, rot);
}

function antenna(ctx: Ctx, x: number, y: number, z: number, h: number) {
  part(ctx, yCyl(0.014, h, 6), ctx.m.trim, x, y + h / 2, z);
  part(ctx, sphere(0.03, 8), ctx.m.accent, x, y + h, z);
}

function dish(ctx: Ctx, x: number, y: number, z: number, r: number) {
  part(ctx, yCyl(0.02, r * 0.9, 6), ctx.m.trim, x, y + r * 0.45, z);
  part(ctx, new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3).rotateX(Math.PI), ctx.m.panel, x, y + r * 0.9 + r * 0.5, z);
}

function radiators(ctx: Ctx, x: number, y: number, z: number, n: number, h: number, d: number) {
  for (let i = 0; i < n; i++) part(ctx, box(0.03, h, d), ctx.m.dark, x, y, z + i * d * 1.5);
}

/** Cylindrical pod with rounded ends, along Z. */
function pod(ctx: Ctx, x: number, y: number, z: number, r: number, len: number, mat: THREE.Material = ctx.m.panel) {
  part(ctx, zCapsule(r, len), mat, x, y, z);
  part(ctx, ringZ(r * 1.02, 0.02), ctx.m.trim, x, y, z - len * 0.3);
  part(ctx, ringZ(r * 1.02, 0.02), ctx.m.trim, x, y, z + len * 0.3);
}

function tank(ctx: Ctx, x: number, y: number, z: number, r: number) {
  part(ctx, sphere(r, 20), ctx.m.hull, x, y, z);
  part(ctx, ringZ(r * 0.98, 0.025), ctx.m.trim, x, y, z);
}

function turret(ctx: Ctx, x: number, y: number, z: number, r: number, barrels = 2) {
  part(ctx, zCyl(r * 1.1, r * 1.1, r * 0.5, 16), ctx.m.trim, x, y, z);
  part(ctx, dome(r), ctx.m.panel, x, y + r * 0.2, z);
  for (let i = 0; i < barrels; i++) {
    const bx = barrels === 1 ? 0 : (i - (barrels - 1) / 2) * r * 0.7;
    part(ctx, zCyl(r * 0.12, r * 0.12, r * 2.4, 8), ctx.m.dark, x + bx, y + r * 0.5, z - r * 1.3);
  }
}

function drillArm(ctx: Ctx, x: number, y: number, z: number, len: number) {
  part(ctx, zCyl(0.06, 0.08, len, 8), ctx.m.trim, x, y, z - len / 2);
  part(ctx, ringZ(0.11, 0.03), ctx.m.paint, x, y, z - len * 0.55);
  part(ctx, noseCone(0.13, 0.42, 12), ctx.m.panel, x, y, z - len);
  part(ctx, ringZ(0.14, 0.02), ctx.m.dark, x, y, z - len - 0.12);
}

function container(ctx: Ctx, x: number, y: number, z: number, w: number, h: number, d: number, painted = false) {
  part(ctx, box(w, h, d), painted ? ctx.m.paint : ctx.m.panel, x, y, z);
  for (let i = -1; i <= 1; i += 2) part(ctx, box(w * 1.02, h * 0.06, d * 0.06), ctx.m.dark, x, y + (i * h) / 3, z);
}

function tower(ctx: Ctx, x: number, y: number, z: number, w: number, h: number, d: number) {
  part(ctx, box(w, h, d), ctx.m.panel, x, y + h / 2, z);
  part(ctx, box(w * 0.8, h * 0.18, d * 0.6), ctx.m.glass, x, y + h * 0.95, z - d * 0.15);
  part(ctx, box(w * 1.1, h * 0.05, d * 1.05), ctx.m.trim, x, y + h * 0.7, z);
  antenna(ctx, x, y + h, z + d * 0.2, h * 0.6);
}

/* ---------------- class builders ---------------- */

function scout(c: Ctx) {
  const { B, slot, r, m } = c;
  const L = B;
  // Body per slot: slim capsule, wedge, flat lens, twin needles.
  if (slot === 0) {
    part(c, zCapsule(0.2, L), m.hull);
    part(c, noseCone(0.19, 0.35, 16), m.panel, 0, 0, -L / 2 + 0.1);
  } else if (slot === 1) {
    part(c, zCyl(0.06, 0.34, L, 4, true), m.hull);
    part(c, box(0.5, 0.06, 0.5), m.panel, 0, 0.1, L * 0.15);
  } else if (slot === 2) {
    const lens = new THREE.Mesh(sphere(0.5, 24), m.hull);
    lens.scale.set(0.9, 0.32, 1.4);
    c.g.add(lens);
    part(c, ringZ(0.46, 0.03), m.trim, 0, 0, 0.1, [0, Math.PI / 2, 0]);
  } else {
    part(c, zCapsule(0.14, L * 0.9), m.hull, -0.22, 0, 0);
    part(c, zCapsule(0.14, L * 0.9), m.hull, 0.22, 0, 0);
    part(c, box(0.5, 0.12, 0.5), m.panel, 0, 0, 0.1);
    part(c, noseCone(0.12, 0.4, 12), m.panel, -0.22, 0, -L * 0.45 + 0.1);
    part(c, noseCone(0.12, 0.4, 12), m.panel, 0.22, 0, -L * 0.45 + 0.1);
  }
  // Cockpit.
  const cockpit = new THREE.Mesh(sphere(0.15, 16), m.glass);
  cockpit.position.set(0, slot === 2 ? 0.16 : 0.1, -L * 0.28);
  cockpit.scale.set(1, 0.7, 1.5);
  c.g.add(cockpit);
  // Wings per slot: delta, swept-back, canards + tail, X-fins.
  const t = 0.035;
  if (slot === 0) {
    part(c, wingGeo(1, 0.85, 0.7, 0.22, 0.35, t), m.panel, 0.15, -0.02, 0.15);
    part(c, wingGeo(-1, 0.85, 0.7, 0.22, 0.35, t), m.panel, -0.15, -0.02, 0.15);
  } else if (slot === 1) {
    part(c, wingGeo(1, 0.75, 0.45, 0.2, 0.5, t), m.panel, 0.2, 0, 0.3);
    part(c, wingGeo(-1, 0.75, 0.45, 0.2, 0.5, t), m.panel, -0.2, 0, 0.3);
    part(c, box(t, 0.38, 0.32), m.panel, 0, 0.2, 0.55);
  } else if (slot === 2) {
    part(c, wingGeo(1, 0.4, 0.25, 0.1, 0.05, t), m.panel, 0.35, 0.04, -0.35);
    part(c, wingGeo(-1, 0.4, 0.25, 0.1, 0.05, t), m.panel, -0.35, 0.04, -0.35);
    part(c, wingGeo(1, 0.6, 0.4, 0.15, 0.25, t), m.panel, 0.35, -0.02, 0.45);
    part(c, wingGeo(-1, 0.6, 0.4, 0.15, 0.25, t), m.panel, -0.35, -0.02, 0.45);
  } else {
    for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
      const fin = part(c, box(0.55, t, 0.3), m.panel, 0, 0, 0.45);
      fin.rotation.z = a;
      fin.position.x = Math.cos(a) * 0.3;
      fin.position.y = Math.sin(a) * 0.3;
    }
  }
  // Engines.
  const rear = L * 0.5;
  if (slot === 0) engine(c, 0, 0, rear, 0.16);
  else if (slot === 1) {
    engine(c, -0.16, 0, rear, 0.12);
    engine(c, 0.16, 0, rear, 0.12);
  } else if (slot === 2) {
    const e = part(c, zCyl(0.3, 0.34, 0.3, 16), m.trim, 0, 0, 0.6);
    e.scale.set(1, 0.4, 1);
    engine(c, 0, 0, 0.62, 0.13);
  } else {
    engine(c, -0.22, 0, rear * 0.9, 0.12);
    engine(c, 0.22, 0, rear * 0.9, 0.12);
  }
  stripe(c, 0, slot === 2 ? 0.17 : 0.2, 0.05, 0.08, L * 0.5);
  windows(c, slot === 3 ? 0.36 : 0.2, 0.03, -L * 0.15, L * 0.2, 3, 0.04);
  windows(c, slot === 3 ? -0.36 : -0.2, 0.03, -L * 0.15, L * 0.2, 3, 0.04);
  if (r() > 0.35) antenna(c, 0.08, slot === 2 ? 0.15 : 0.2, 0.2, 0.35);
  light(c, 0.9, 0, 0.35);
  light(c, -0.9, 0, 0.35);
}

function miner(c: Ctx) {
  const { B, slot, r, m } = c;
  const L = B;
  if (slot === 0) {
    // Prospector: a drill bolted to a fuel tank.
    part(c, zCyl(0.3, 0.3, L * 0.75, 18), m.hull, 0, 0, 0.1);
    tank(c, 0, 0.42, 0.25, 0.32);
    part(c, box(0.5, 0.35, 0.45), m.panel, 0, -0.05, -L * 0.3);
    drillArm(c, 0, -0.05, -L * 0.5, 0.55);
    engine(c, 0, 0, L * 0.5, 0.2);
    stripe(c, 0.31, 0, 0.1, 0.03, L * 0.4, [0, 0, Math.PI / 2]);
  } else if (slot === 1) {
    // Hauler: reinforced spine with twin cargo containers.
    part(c, box(0.5, 0.45, L), m.hull, 0, 0, 0);
    container(c, 0.62, -0.02, 0.15, 0.55, 0.5, L * 0.6, true);
    container(c, -0.62, -0.02, 0.15, 0.55, 0.5, L * 0.6, true);
    part(c, box(0.42, 0.3, 0.55), m.panel, 0, 0.36, -0.2);
    part(c, box(0.9, 0.16, 0.25), m.trim, 0, -0.1, -L * 0.52);
    engine(c, -0.25, 0, L * 0.5, 0.15);
    engine(c, 0.25, 0, L * 0.5, 0.15);
  } else if (slot === 2) {
    // Drillhead: three drill arms and a crusher deck.
    part(c, box(0.85, 0.55, L * 0.8), m.hull, 0, 0, 0.15);
    part(c, box(0.6, 0.25, 0.7), m.panel, 0, 0.4, 0.35);
    part(c, box(1.05, 0.14, 0.4), m.trim, 0, -0.3, -0.3);
    for (const [x, y] of [
      [-0.3, -0.05],
      [0.3, -0.05],
      [0, 0.22],
    ] as const)
      drillArm(c, x, y, -L * 0.25, 0.7);
    radiators(c, 0.46, 0.05, -0.1, 4, 0.5, 0.14);
    radiators(c, -0.46, 0.05, -0.1, 4, 0.5, 0.14);
    engine(c, -0.28, -0.05, L * 0.55, 0.15);
    engine(c, 0.28, -0.05, L * 0.55, 0.15);
  } else if (slot === 3) {
    // Excavator: twin hull with a detachable core drill between them.
    part(c, box(0.42, 0.5, L * 0.9), m.hull, -0.45, 0, 0);
    part(c, box(0.42, 0.5, L * 0.9), m.hull, 0.45, 0, 0);
    part(c, box(0.5, 0.2, 0.4), m.trim, 0, 0.15, -0.3);
    part(c, box(0.5, 0.2, 0.4), m.trim, 0, 0.15, 0.5);
    part(c, zCyl(0.16, 0.2, L * 0.7, 12), m.panel, 0, -0.05, 0.1);
    drillArm(c, 0, -0.05, -L * 0.3, 0.6);
    pod(c, -0.45, 0.36, 0.1, 0.13, 0.7, m.paint);
    pod(c, 0.45, 0.36, 0.1, 0.13, 0.7, m.paint);
    engine(c, -0.45, 0, L * 0.47, 0.16);
    engine(c, 0.45, 0, L * 0.47, 0.16);
  } else {
    // Forge: a mobile refinery — big block, stacks, radiator banks.
    part(c, box(1.0, 0.7, L * 0.85), m.hull, 0, 0, 0.1);
    for (const x of [-0.3, 0, 0.3]) part(c, yCyl(0.08, 0.5, 10), m.trim, x, 0.55, 0.2);
    for (const x of [-0.3, 0, 0.3]) part(c, sphere(0.06, 8), m.accent, x, 0.82, 0.2);
    radiators(c, 0.55, 0, -0.4, 5, 0.6, 0.16);
    radiators(c, -0.55, 0, -0.4, 5, 0.6, 0.16);
    part(c, box(1.1, 0.18, 0.3), m.trim, 0, -0.2, -L * 0.5);
    dish(c, 0.3, 0.35, -0.4, 0.18);
    tank(c, -0.35, 0.45, -0.3, 0.2);
    engine(c, -0.3, 0, L * 0.55, 0.16);
    engine(c, 0, -0.1, L * 0.55, 0.16);
    engine(c, 0.3, 0, L * 0.55, 0.16);
  }
  const wy = slot === 4 ? 0.2 : 0.12;
  windows(c, slot === 3 ? 0.67 : slot === 1 ? 0.26 : 0.44, wy, -L * 0.2, 0.1, 3, 0.05);
  windows(c, slot === 3 ? -0.67 : slot === 1 ? -0.26 : -0.44, wy, -L * 0.2, 0.1, 3, 0.05);
  if (r() > 0.4) antenna(c, 0.2, 0.3, 0.5, 0.4);
  light(c, 0.7, 0.2, -0.4);
  light(c, -0.7, 0.2, -0.4);
}

function cruiser(c: Ctx) {
  const { B, slot, r, m } = c;
  const L = B;
  const t = 0.05;
  if (slot === 0) {
    // Vanguard: long capsule, swept wings, twin masts.
    part(c, zCapsule(0.3, L), m.hull);
    part(c, noseCone(0.29, 0.6, 16), m.panel, 0, 0, -L / 2 + 0.2);
    part(c, wingGeo(1, 1.2, 0.8, 0.3, 0.55, t), m.panel, 0.25, 0, 0.35);
    part(c, wingGeo(-1, 1.2, 0.8, 0.3, 0.55, t), m.panel, -0.25, 0, 0.35);
    part(c, box(0.4, 0.26, 0.9), m.panel, 0, 0.32, 0.3);
    part(c, box(0.28, 0.14, 0.4), m.glass, 0, 0.48, 0.05);
    engine(c, 0, 0.05, L * 0.5, 0.17);
    engine(c, 1.25, 0, 0.95, 0.11);
    engine(c, -1.25, 0, 0.95, 0.11);
  } else if (slot === 1) {
    // Nova: wedge hull with a dorsal spine, delta wings and canards.
    part(c, zCyl(0.08, 0.42, L, 4, true), m.hull);
    part(c, box(0.14, 0.32, L * 0.6), m.panel, 0, 0.3, 0.25);
    part(c, box(0.3, 0.16, 0.5), m.glass, 0, 0.26, -0.35);
    part(c, wingGeo(1, 1.0, 0.9, 0.25, 0.4, t), m.panel, 0.3, -0.05, 0.4);
    part(c, wingGeo(-1, 1.0, 0.9, 0.25, 0.4, t), m.panel, -0.3, -0.05, 0.4);
    part(c, wingGeo(1, 0.45, 0.3, 0.12, 0.1, t), m.panel, 0.25, 0.02, -0.7);
    part(c, wingGeo(-1, 0.45, 0.3, 0.12, 0.1, t), m.panel, -0.25, 0.02, -0.7);
    engine(c, -0.2, 0, L * 0.5, 0.15);
    engine(c, 0.2, 0, L * 0.5, 0.15);
    engine(c, 0, 0.25, L * 0.48, 0.11);
  } else if (slot === 2) {
    // Aurora: wide flat hull with a forward shield spine and forward-swept wings.
    const body = new THREE.Mesh(sphere(0.6, 24), m.hull);
    body.scale.set(1.4, 0.35, 2.2);
    c.g.add(body);
    part(c, box(0.2, 0.22, L * 0.7), m.panel, 0, 0.2, -0.2);
    part(c, box(0.5, 0.06, 0.9), m.paint, 0, 0.32, -0.6);
    part(c, wingGeo(1, 1.1, 0.7, 0.3, -0.45, t), m.panel, 0.6, 0, 0.35);
    part(c, wingGeo(-1, 1.1, 0.7, 0.3, -0.45, t), m.panel, -0.6, 0, 0.35);
    part(c, box(0.32, 0.12, 0.4), m.glass, 0, 0.28, -0.95);
    engine(c, -0.5, 0, 1.15, 0.14);
    engine(c, 0.5, 0, 1.15, 0.14);
    engine(c, 0, 0, 1.25, 0.16);
  } else {
    // Halcyon: capsule stretched to the limit, big dorsal + ventral fins, no wings.
    part(c, zCapsule(0.28, L * 1.15), m.hull);
    part(c, zCyl(0.29, 0.29, 0.12, 20), m.trim, 0, 0, -0.5);
    part(c, zCyl(0.29, 0.29, 0.12, 20), m.trim, 0, 0, 0.5);
    part(c, wingGeo(1, 0.7, 0.9, 0.2, 0.6, t), m.panel, 0, 0.2, 0.5, [0, 0, Math.PI / 2]);
    part(c, wingGeo(-1, 0.55, 0.9, 0.2, 0.6, t), m.panel, 0, -0.2, 0.5, [0, 0, Math.PI / 2]);
    part(c, box(0.4, 0.18, 0.7), m.panel, 0, 0.3, -0.3);
    part(c, box(0.26, 0.12, 0.35), m.glass, 0, 0.42, -0.5);
    pod(c, 0.42, -0.1, 0.2, 0.11, 0.9);
    pod(c, -0.42, -0.1, 0.2, 0.11, 0.9);
    engine(c, 0, 0, L * 0.58, 0.2);
    engine(c, 0.42, -0.1, 0.75, 0.09);
    engine(c, -0.42, -0.1, 0.75, 0.09);
  }
  antenna(c, 0.12, slot === 2 ? 0.3 : 0.45, -0.1, 0.5);
  if (r() > 0.5) antenna(c, -0.12, slot === 2 ? 0.3 : 0.45, -0.3, 0.35);
  const wx = slot === 2 ? 0.7 : 0.29;
  windows(c, wx, 0.06, -L * 0.3, L * 0.25, 6, 0.045);
  windows(c, -wx, 0.06, -L * 0.3, L * 0.25, 6, 0.045);
  stripe(c, slot === 2 ? 0.75 : 0.3, 0.04, 0.1, 0.03, L * 0.5, [0, 0, Math.PI / 2]);
  light(c, 1.3, 0, 0.6);
  light(c, -1.3, 0, 0.6);
}

function destroyer(c: Ctx) {
  const { B, slot, r, m } = c;
  const L = B;
  if (slot === 0) {
    // Titan: broad brick, wedge prow, two turrets, twin vertical fins.
    part(c, box(1.5, 0.45, L * 0.85), m.hull, 0, 0, 0.1);
    part(c, zCyl(0.1, 0.75, 1.1, 4, true), m.hull, 0, 0, -L * 0.42);
    part(c, box(0.9, 0.25, 1.2), m.panel, 0, 0.33, -0.2);
    turret(c, 0.45, 0.22, 0.4, 0.22);
    turret(c, -0.45, 0.22, 0.4, 0.22);
    part(c, box(0.04, 0.55, 0.6), m.panel, 0.5, 0.45, 1.0);
    part(c, box(0.04, 0.55, 0.6), m.panel, -0.5, 0.45, 1.0);
    for (let i = 0; i < 4; i++) part(c, box(1.62, 0.05, 0.3), m.trim, 0, 0.25, -0.8 + i * 0.55);
    for (const x of [-0.55, -0.18, 0.18, 0.55]) engine(c, x, 0, L * 0.5, 0.14);
  } else if (slot === 1) {
    // Warden: layered armour, pyramid prow, three turrets in a line, escort sensor tower.
    part(c, box(1.3, 0.5, L * 0.8), m.hull, 0, 0, 0.15);
    part(c, box(1.5, 0.12, L * 0.6), m.panel, 0, 0.3, 0.25);
    part(c, box(1.7, 0.1, L * 0.45), m.trim, 0, -0.3, 0.3);
    part(c, noseCone(0.55, 1.2, 4), m.hull, 0, 0, -L * 0.25);
    turret(c, 0, 0.36, -0.2, 0.2, 2);
    turret(c, 0, 0.36, 0.45, 0.2, 2);
    turret(c, 0, -0.36, 0.1, 0.18, 1);
    tower(c, 0, 0.36, 0.95, 0.3, 0.55, 0.4);
    stripe(c, 0.66, 0.05, 0.2, 0.03, L * 0.4, [0, 0, Math.PI / 2]);
    stripe(c, -0.66, 0.05, 0.2, 0.03, L * 0.4, [0, 0, Math.PI / 2]);
    for (const x of [-0.5, -0.17, 0.17, 0.5]) engine(c, x, 0, L * 0.52, 0.14);
  } else {
    // Bastion: siege hull — very wide, flat, a forward ram, four turrets, outboard engines.
    part(c, box(2.0, 0.4, L * 0.75), m.hull, 0, 0, 0.2);
    part(c, box(1.4, 0.3, 0.9), m.panel, 0, 0.3, 0.3);
    part(c, box(0.6, 0.5, 0.8), m.trim, 0, 0, -L * 0.45);
    part(c, box(0.9, 0.18, 0.25), m.paint, 0, 0, -L * 0.62);
    turret(c, 0.7, 0.2, -0.2, 0.2, 2);
    turret(c, -0.7, 0.2, -0.2, 0.2, 2);
    turret(c, 0.7, 0.2, 0.7, 0.2, 2);
    turret(c, -0.7, 0.2, 0.7, 0.2, 2);
    part(c, box(0.3, 0.45, 0.5), m.panel, 0, 0.55, 0.8);
    part(c, box(0.24, 0.12, 0.3), m.glass, 0, 0.78, 0.65);
    part(c, box(2.3, 0.05, 0.4), m.trim, 0, -0.22, 0.1);
    for (const x of [-0.95, -0.55, 0.55, 0.95]) engine(c, x, 0, L * 0.5, 0.15);
    engine(c, 0, -0.05, L * 0.55, 0.2);
  }
  const wx = slot === 2 ? 1.01 : slot === 1 ? 0.66 : 0.76;
  windows(c, wx, 0.08, -L * 0.2, L * 0.25, 5, 0.05);
  windows(c, -wx, 0.08, -L * 0.2, L * 0.25, 5, 0.05);
  if (r() > 0.3) antenna(c, 0.3, 0.35, 0.9, 0.5);
  light(c, wx + 0.05, 0.12, -0.7);
  light(c, -wx - 0.05, 0.12, -0.7);
}

function dreadnought(c: Ctx) {
  const { B, slot, r, m } = c;
  const L = B;
  if (slot === 0) {
    // Dreadnought: a spine with three hull segments, side pylons with pods, a command tower.
    part(c, box(0.7, 0.7, L), m.panel, 0, 0, 0);
    for (const s of [
      { z: -1.4, w: 1.3, h: 0.9, l: 1.1 },
      { z: 0.1, w: 1.8, h: 1.0, l: 1.4 },
      { z: 1.5, w: 1.4, h: 0.85, l: 1.0 },
    ])
      part(c, box(s.w, s.h, s.l), m.hull, 0, 0, s.z);
    part(c, noseCone(0.5, 1.3, 6), m.hull, 0, 0, -L * 0.47);
    for (const side of [-1, 1]) {
      part(c, box(1.2, 0.12, 0.5), m.trim, side * 1.4, -0.1, 0.2);
      pod(c, side * 2.0, -0.1, 0.2, 0.28, 1.9);
      part(c, box(0.5, 0.3, 0.6), m.trim, side * 0.95, 0.55, -0.8);
    }
    tower(c, 0, 0.5, 1.2, 0.45, 0.8, 0.7);
    for (const side of [-1, 1]) {
      engine(c, side * 0.45, 0.25, L * 0.47, 0.17);
      engine(c, side * 0.45, -0.25, L * 0.47, 0.17);
      engine(c, side * 2.0, -0.1, 1.2, 0.14);
    }
  } else if (slot === 1) {
    // Colossus: a flight deck — wide flat top, hangar bays underneath, tower aft.
    part(c, box(1.6, 0.6, L * 0.9), m.hull, 0, 0, 0);
    part(c, box(2.2, 0.08, L * 0.8), m.panel, 0, 0.34, 0.1);
    stripe(c, 0, 0.39, -0.2, 0.12, L * 0.6);
    stripe(c, 0.7, 0.39, 0.2, 0.06, L * 0.4);
    stripe(c, -0.7, 0.39, 0.2, 0.06, L * 0.4);
    for (const x of [-0.5, 0, 0.5]) part(c, box(0.35, 0.22, 0.05), m.glass, x, -0.05, -L * 0.45);
    part(c, noseCone(0.4, 0.9, 4), m.hull, 0, -0.05, -L * 0.45);
    tower(c, 0.75, 0.38, 1.2, 0.5, 0.9, 0.8);
    radiators(c, 0.82, -0.1, -0.5, 6, 0.4, 0.2);
    radiators(c, -0.82, -0.1, -0.5, 6, 0.4, 0.2);
    for (const x of [-0.6, -0.2, 0.2, 0.6]) engine(c, x, -0.05, L * 0.47, 0.17);
    engine(c, -0.95, 0.1, L * 0.42, 0.12);
    engine(c, 0.95, 0.1, L * 0.42, 0.12);
  } else if (slot === 2) {
    // Leviathan: twin spines joined by two bridges, eight engines.
    for (const side of [-1, 1]) {
      part(c, box(0.8, 0.8, L), m.hull, side * 0.9, 0, 0);
      part(c, noseCone(0.42, 1.2, 8), m.panel, side * 0.9, 0, -L / 2);
      part(c, box(0.5, 0.35, 1.2), m.panel, side * 0.9, 0.55, 0.3);
      for (const dy of [0.25, -0.25]) {
        engine(c, side * 0.7, dy, L * 0.5, 0.16);
        engine(c, side * 1.1, dy, L * 0.5, 0.16);
      }
    }
    part(c, box(1.2, 0.5, 0.8), m.trim, 0, 0, -0.8);
    part(c, box(1.2, 0.5, 0.8), m.trim, 0, 0, 0.9);
    part(c, box(0.5, 0.45, 0.6), m.panel, 0, 0.45, -0.8);
    part(c, box(0.4, 0.15, 0.3), m.glass, 0, 0.75, -0.95);
    dish(c, 0, 0.5, 0.9, 0.3);
  } else {
    // Juggernaut: one enormous armoured block, heavy plates, 3×2 engine grid.
    part(c, box(2.0, 1.2, L * 0.85), m.hull, 0, 0, 0.1);
    part(c, zCyl(0.3, 1.0, 1.4, 4, true), m.hull, 0, 0, -L * 0.45);
    for (let i = 0; i < 5; i++) {
      part(c, box(2.15, 0.08, 0.45), m.trim, 0, 0.62, -1.3 + i * 0.7);
      part(c, box(0.08, 1.3, 0.45), m.trim, 1.05, 0, -1.3 + i * 0.7);
      part(c, box(0.08, 1.3, 0.45), m.trim, -1.05, 0, -1.3 + i * 0.7);
    }
    turret(c, 0.6, 0.62, -0.6, 0.28, 3);
    turret(c, -0.6, 0.62, -0.6, 0.28, 3);
    turret(c, 0, 0.62, 0.9, 0.3, 3);
    stripe(c, 0, 0.67, 0.2, 1.6, 0.12);
    for (const x of [-0.6, 0, 0.6]) for (const y of [0.3, -0.3]) engine(c, x, y, L * 0.53, 0.2);
  }
  const wx = slot === 2 ? 1.31 : slot === 3 ? 1.01 : slot === 1 ? 0.81 : 0.91;
  windows(c, wx, 0.15, -L * 0.3, L * 0.3, 8, 0.05);
  windows(c, -wx, 0.15, -L * 0.3, L * 0.3, 8, 0.05);
  for (let i = 0; i < 6; i++) light(c, (i % 2 ? -1 : 1) * (wx + 0.02), 0.3, -1.5 + i * 0.6, 0.035);
  if (r() > 0.5) antenna(c, -0.4, slot === 3 ? 0.66 : 0.5, -1.2, 0.7);
}

function capital(c: Ctx) {
  const { B, slot, r, m } = c;
  const L = B;
  const rig = 2.3 + r() * 0.3;
  if (slot === 0) {
    // Sovereign: command tower, ring drive, twin outriggers.
    part(c, box(0.9, 0.9, L), m.panel, 0, 0, 0);
    part(c, box(2.2, 1.1, 1.8), m.hull, 0, 0, 0.6);
    part(c, box(1.5, 0.9, 1.6), m.hull, 0, 0, -1.4);
    part(c, noseCone(0.62, 1.7, 8), m.hull, 0, 0, -L * 0.45);
    tower(c, 0, 0.55, 1.4, 0.6, 1.3, 1.0);
    part(c, ringZ(1.5, 0.12), m.hull, 0, 0, 1.9);
    part(c, ringZ(1.5, 0.05), m.accent, 0, 0, 1.75);
    for (const side of [-1, 1]) {
      part(c, box(0.5, 0.5, 4.2), m.hull, side * rig, -0.2, 0.2);
      part(c, box(rig - 0.4, 0.1, 0.4), m.trim, (side * rig) / 2, -0.2, -0.6);
      part(c, box(rig - 0.4, 0.1, 0.4), m.trim, (side * rig) / 2, -0.2, 1.0);
      part(c, noseCone(0.3, 0.9, 6), m.hull, side * rig, -0.2, -1.9);
      engine(c, side * rig, -0.2, 2.35, 0.2);
    }
    for (const [x, y] of [
      [-0.5, 0.35],
      [0.5, 0.35],
      [-0.5, -0.35],
      [0.5, -0.35],
      [0, 0],
    ] as const)
      engine(c, x, y, 2.85, x === 0 ? 0.28 : 0.18);
  } else if (slot === 1) {
    // Meridian: long keel, outriggers carrying a scout wing (bays), triple tower.
    part(c, box(1.0, 1.0, L * 1.05), m.hull, 0, 0, 0);
    part(c, noseCone(0.55, 2.2, 4), m.hull, 0, 0, -L * 0.52);
    for (const side of [-1, 1]) {
      part(c, box(1.4, 0.45, 3.0), m.panel, side * 1.6, -0.1, 0.4);
      for (let i = 0; i < 3; i++) part(c, box(0.45, 0.2, 0.06), m.glass, side * 1.6, -0.1, -1.0 + i * 1.0);
      part(c, box(1.2, 0.1, 0.5), m.trim, side * 0.9, 0.1, 0.4);
      engine(c, side * 1.6, -0.1, 1.95, 0.17);
    }
    for (let i = 0; i < 3; i++) tower(c, 0, 0.5, -0.6 + i * 0.9, 0.4, 0.9 + i * 0.25, 0.5);
    stripe(c, 0.51, 0.1, 0, 0.04, L * 0.7, [0, 0, Math.PI / 2]);
    stripe(c, -0.51, 0.1, 0, 0.04, L * 0.7, [0, 0, Math.PI / 2]);
    for (const [x, y] of [
      [-0.35, 0.3],
      [0.35, 0.3],
      [-0.35, -0.3],
      [0.35, -0.3],
    ] as const)
      engine(c, x, y, L * 0.53, 0.2);
  } else if (slot === 2) {
    // Omega: triple spine and a double ring drive — the ship that reaches Eclipse.
    part(c, box(0.8, 0.8, L), m.panel, 0, 0, 0);
    part(c, box(0.7, 0.7, L * 0.9), m.hull, 1.3, -0.2, 0.2);
    part(c, box(0.7, 0.7, L * 0.9), m.hull, -1.3, -0.2, 0.2);
    part(c, box(3.4, 0.14, 0.6), m.trim, 0, -0.2, -0.8);
    part(c, box(3.4, 0.14, 0.6), m.trim, 0, -0.2, 1.4);
    part(c, noseCone(0.45, 1.8, 8), m.hull, 0, 0, -L / 2);
    part(c, noseCone(0.36, 1.0, 8), m.panel, 1.3, -0.2, -L * 0.45 + 0.2);
    part(c, noseCone(0.36, 1.0, 8), m.panel, -1.3, -0.2, -L * 0.45 + 0.2);
    part(c, ringZ(1.9, 0.14), m.hull, 0, 0, 1.6);
    part(c, ringZ(1.9, 0.05), m.accent, 0, 0, 1.45);
    part(c, ringZ(1.4, 0.12), m.hull, 0, 0, 2.5);
    part(c, ringZ(1.4, 0.05), m.accent, 0, 0, 2.35);
    tower(c, 0, 0.4, 0.6, 0.55, 1.4, 0.9);
    for (const x of [-1.3, 0, 1.3]) engine(c, x, x === 0 ? 0 : -0.2, L * 0.5, x === 0 ? 0.3 : 0.2);
    engine(c, -0.45, 0.4, L * 0.48, 0.14);
    engine(c, 0.45, 0.4, L * 0.48, 0.14);
  } else {
    // Apex: massive prow, cathedral towers, three rings, engine cluster.
    part(c, box(1.3, 1.3, L * 0.9), m.hull, 0, 0, 0.3);
    part(c, zCyl(0.2, 1.1, 2.6, 4, true), m.hull, 0, 0, -L * 0.42);
    part(c, box(0.5, 0.25, 1.4), m.paint, 0, 0.7, -1.2);
    for (let i = 0; i < 4; i++) tower(c, (i % 2 ? -1 : 1) * 0.35, 0.65, -0.3 + i * 0.6, 0.35, 1.0 + (i % 2) * 0.5, 0.45);
    for (const z of [0.9, 1.7, 2.5]) {
      part(c, ringZ(1.7, 0.1), m.hull, 0, 0, z);
      part(c, ringZ(1.7, 0.04), m.accent, 0, 0, z - 0.12);
    }
    for (const side of [-1, 1]) {
      part(c, box(0.4, 0.4, 3.0), m.panel, side * 1.9, -0.3, 0.6);
      part(c, box(1.6, 0.1, 0.4), m.trim, side * 1.1, -0.3, 0.6);
      engine(c, side * 1.9, -0.3, 2.15, 0.18);
    }
    for (const [x, y] of [
      [-0.4, 0.4],
      [0.4, 0.4],
      [-0.4, -0.4],
      [0.4, -0.4],
      [0, 0],
    ] as const)
      engine(c, x, y, L * 0.5, x === 0 ? 0.34 : 0.2);
  }
  const wx = slot === 2 ? 0.41 : slot === 3 ? 0.66 : slot === 1 ? 0.51 : 1.11;
  windows(c, wx, 0.25, -L * 0.3, L * 0.3, 12, 0.05);
  windows(c, -wx, 0.25, -L * 0.3, L * 0.3, 12, 0.05);
  for (let i = 0; i < 5; i++) {
    light(c, rig + 0.28, -0.2, -1.6 + i * 0.8, 0.035);
    light(c, -rig - 0.28, -0.2, -1.6 + i * 0.8, 0.035);
  }
}

const BUILDERS: Record<ShipClass, (c: Ctx) => void> = { scout, miner, cruiser, destroyer, dreadnought, capital };

const cache = new Map<string, THREE.Group>();

/** Position of a hull among the hulls of its class, cheapest first. */
export function classSlot(hull: ShipConfig): number {
  return SHIPS.filter((s) => s.class === hull.class).findIndex((s) => s.id === hull.id);
}

/** A cached template per hull; callers clone it (materials are shared, geometries too). */
export function shipTemplate(hull: ShipConfig): THREE.Group {
  const hit = cache.get(hull.id);
  if (hit) return hit;
  const g = new THREE.Group();
  const ctx: Ctx = { g, m: materials(hull.visual), r: mulberry32(hull.visual.seed), B: CLASS_LENGTH[hull.class], slot: Math.max(0, classSlot(hull)) };
  BUILDERS[hull.class](ctx);
  g.scale.setScalar(powerScale(hull.fleetPower));
  g.name = hull.id;
  cache.set(hull.id, g);
  return g;
}

export function buildShip(hull: ShipConfig): THREE.Group {
  return shipTemplate(hull).clone();
}

/** Bounding sphere of a built ship (after scale), for framing. */
export function shipBounds(hull: ShipConfig): { center: THREE.Vector3; radius: number } {
  const t = shipTemplate(hull);
  t.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(t);
  const center = new THREE.Vector3();
  b.getCenter(center);
  const size = new THREE.Vector3();
  b.getSize(size);
  return { center, radius: size.length() / 2 };
}

export function shipRadius(hull: ShipConfig): number {
  return shipBounds(hull).radius;
}
