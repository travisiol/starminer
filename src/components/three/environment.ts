import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

let cached: { renderer: THREE.WebGLRenderer; texture: THREE.Texture } | null = null;

/**
 * A neutral studio environment for the metal hulls (metals reflect their surroundings; without
 * an environment map they render black). Call from a Canvas `onCreated` — never from an effect.
 */
export function applyStudioEnvironment(gl: THREE.WebGLRenderer, scene: THREE.Scene, intensity = 0.55) {
  if (!cached || cached.renderer !== gl) {
    const pmrem = new THREE.PMREMGenerator(gl);
    const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    cached = { renderer: gl, texture };
  }
  scene.environment = cached.texture;
  scene.environmentIntensity = intensity;
}
