"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { mulberry32 } from "@/lib/prng";

const VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vTwinkle;
void main() {
  vColor = aColor;
  vTwinkle = 0.75 + 0.25 * sin(uTime * 0.9 + aPhase);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPixelRatio * (260.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vTwinkle;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.08, d) * vTwinkle;
  gl_FragColor = vec4(vColor, a);
  #include <colorspace_fragment>
}
`;

/** A seeded shell of soft points far behind everything. Cheap, deterministic, twinkles gently. */
export function StarField({ count = 2600, radius = 700, seed = 7, dim = 1 }: { count?: number; radius?: number; seed?: number; dim?: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const { positions, sizes, phases, colors } = useMemo(() => {
    const r = mulberry32(seed);
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    // Violet space: lavender and pale magenta stars around plain white.
    const warm = new THREE.Color("#f0d9ff");
    const cool = new THREE.Color("#c4b5fd");
    const white = new THREE.Color("#ffffff");
    for (let i = 0; i < count; i++) {
      const u = r() * 2 - 1;
      const t = r() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const rr = radius * (0.85 + r() * 0.3);
      positions[i * 3] = rr * s * Math.cos(t);
      positions[i * 3 + 1] = rr * u;
      positions[i * 3 + 2] = rr * s * Math.sin(t);
      const big = r() < 0.06;
      sizes[i] = (big ? 2.4 + r() * 2.2 : 0.7 + r() * 1.3) * dim;
      phases[i] = r() * Math.PI * 2;
      const c = r() < 0.5 ? white : r() < 0.5 ? warm : cool;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    return { positions, sizes, phases, colors };
  }, [count, radius, seed, dim]);

  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uPixelRatio: { value: 1 } }), []);

  useFrame((state) => {
    if (!mat.current) return;
    mat.current.uniforms.uTime.value = state.clock.elapsedTime;
    mat.current.uniforms.uPixelRatio.value = Math.min(2, state.gl.getPixelRatio());
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
        <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
      </bufferGeometry>
      <shaderMaterial ref={mat} vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}
