"use client";

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { shipBounds, shipTemplate } from "@/components/three/ships/shipFactory";
import type { ShipConfig } from "@/game/types";

/* ------------------------------------------------------------------ */
/*  Hull thumbnails: one shared offscreen renderer draws each hull once */
/*  (three-quarter studio view, transparent background) into a data     */
/*  URL. Cards show the real ship instead of a class pictogram.         */
/* ------------------------------------------------------------------ */

const W = 320;
const H = 240;

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let broken = false;

const thumbs = new Map<string, string>();
const listeners = new Set<() => void>();
const queue: ShipConfig[] = [];
let scheduled = false;

function setup(): boolean {
  if (renderer) return true;
  if (broken || typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = W * 2;
    canvas.height = H * 2;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "low-power" });
    renderer.setPixelRatio(1);
    renderer.setSize(W * 2, H * 2, false);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.7;
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight("#cfd6ff", "#0a0a12", 0.55));
    const key = new THREE.DirectionalLight("#fff4ea", 1.5);
    key.position.set(-4, 6, -5);
    scene.add(key);
    const rim = new THREE.DirectionalLight("#a78bfa", 0.9);
    rim.position.set(5, 2, 6);
    scene.add(rim);
    const fill = new THREE.DirectionalLight("#8edbff", 0.35);
    fill.position.set(6, -3, -4);
    scene.add(fill);
    camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 200);
    return true;
  } catch {
    broken = true;
    return false;
  }
}

function draw(hull: ShipConfig): string | null {
  if (!setup() || !renderer || !scene || !camera) return null;
  const model = shipTemplate(hull);
  const { center, radius } = shipBounds(hull);
  // Three-quarter view from the front-left, slightly above: the nose (−Z) points at the viewer's lower-left.
  const dir = new THREE.Vector3(-1, 0.6, -1.25).normalize();
  const dist = (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.08;
  camera.position.copy(center).addScaledVector(dir, dist);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  scene.add(model);
  renderer.render(scene, camera);
  scene.remove(model);
  try {
    return renderer.domElement.toDataURL("image/webp", 0.92);
  } catch {
    return null;
  }
}

function pump() {
  scheduled = false;
  const hull = queue.shift();
  if (!hull) return;
  if (!thumbs.has(hull.id)) {
    const url = draw(hull);
    if (url) {
      thumbs.set(hull.id, url);
      listeners.forEach((l) => l());
    }
  }
  if (queue.length) schedule();
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  // One hull per macrotask keeps the UI responsive (and virtual-time captures can advance it).
  setTimeout(pump, 0);
}

/** Ask for a hull's thumbnail; listeners fire when it lands. */
export function requestThumbnail(hull: ShipConfig) {
  if (thumbs.has(hull.id) || queue.some((h) => h.id === hull.id)) return;
  queue.push(hull);
  schedule();
}

export const getThumbnail = (id: string): string | null => thumbs.get(id) ?? null;

export function subscribeThumbnails(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
