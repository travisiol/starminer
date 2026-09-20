"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { NOISE_GLSL } from "./noise";

const VERT = /* glsl */ `
varying vec3 vObj;
varying vec3 vNormal;
varying vec3 vWorld;
void main() {
  vObj = position;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uCore;
uniform vec3 uEdge;
varying vec3 vObj;
varying vec3 vNormal;
varying vec3 vWorld;
${NOISE_GLSL}
void main() {
  vec3 p = normalize(vObj) * 2.4;
  float g = fbm(p + vec3(uTime * 0.05, 0.0, uTime * 0.03)) * 0.5 + 0.5;
  float cells = ridged(p * 2.5 + uTime * 0.02);
  vec3 V = normalize(cameraPosition - vWorld);
  float limb = pow(max(dot(normalize(vNormal), V), 0.0), 0.6);
  vec3 col = mix(uEdge, uCore, g * 0.6 + cells * 0.4) * (0.75 + 0.45 * limb);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

const CORONA_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
varying vec3 vObj;
varying vec3 vNormal;
varying vec3 vWorld;
${NOISE_GLSL}
void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  float rim = pow(1.0 - abs(dot(normalize(vNormal), V)), 2.2);
  float n = 0.7 + 0.3 * snoise(normalize(vObj) * 4.0 + vec3(uTime * 0.2));
  gl_FragColor = vec4(uColor, rim * n * 0.55);
  #include <colorspace_fragment>
}
`;

let glowTex: THREE.Texture | null = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  // A white-violet star: hot white core, lavender halo, magenta fringe.
  g.addColorStop(0, "rgba(255,250,255,1)");
  g.addColorStop(0.18, "rgba(221,204,255,0.6)");
  g.addColorStop(0.45, "rgba(167,139,250,0.18)");
  g.addColorStop(1, "rgba(232,121,249,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

/** The fictional central star: a hot white-gold sphere, a corona shell, a large soft glow sprite and the light everything else uses. */
export function Sun({ radius = 5, glowScale = 9 }: { radius?: number; glowScale?: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const corona = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uCore: { value: new THREE.Color("#fffaff") }, uEdge: { value: new THREE.Color("#b794f6") } }), []);
  const coronaUniforms = useMemo(() => ({ uTime: { value: 0 }, uColor: { value: new THREE.Color("#c4b5fd") } }), []);
  const tex = useMemo(() => glowTexture(), []);
  useFrame((state) => {
    if (mat.current) mat.current.uniforms.uTime.value = state.clock.elapsedTime;
    if (corona.current) corona.current.uniforms.uTime.value = state.clock.elapsedTime;
  });
  return (
    <group>
      <mesh>
        <sphereGeometry args={[radius, 64, 32]} />
        <shaderMaterial ref={mat} vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * 1.25, 48, 24]} />
        <shaderMaterial ref={corona} vertexShader={VERT} fragmentShader={CORONA_FRAG} uniforms={coronaUniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.BackSide} />
      </mesh>
      <sprite scale={[radius * glowScale, radius * glowScale, 1]}>
        <spriteMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.9} />
      </sprite>
      <pointLight intensity={4} distance={0} decay={0} color="#f3ecff" />
    </group>
  );
}
