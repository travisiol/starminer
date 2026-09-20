"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { PlanetVisual } from "@/game/types";
import { mulberry32 } from "@/lib/prng";
import { ATMO_FRAGMENT, ATMO_VERTEX, PLANET_FRAGMENT, PLANET_VERTEX, RING_FRAGMENT, RING_VERTEX, makePlanetUniforms } from "./planetMaterial";
import { NOISE_GLSL } from "./noise";
import { useQuality } from "./quality";

interface PlanetProps {
  visual: PlanetVisual;
  radius?: number;
  /** World position of the light (the star). */
  lightPos?: THREE.Vector3;
  /** 0..1 desaturate + darken (undiscovered worlds). */
  dim?: number;
  spin?: number;
  /** Extra detail for close-ups (planet panel, landing). */
  detail?: boolean;
}

const ORIGIN = new THREE.Vector3(0, 0, 0);

/** A planet: shaded sphere + optional atmosphere shell, rings, broken moons, distortion halo. */
export function Planet({ visual, radius, lightPos = ORIGIN, dim = 0, spin = 0.05, detail = false }: PlanetProps) {
  const q = useQuality();
  const r = radius ?? visual.radius;
  const mat = useRef<THREE.ShaderMaterial>(null);
  const body = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => makePlanetUniforms(visual, dim), [visual, dim]);
  const segs = detail ? 96 : q === "low" ? 32 : 48;

  useFrame((state, dt) => {
    if (mat.current) {
      mat.current.uniforms.uTime.value = state.clock.elapsedTime;
      mat.current.uniforms.uLightPos.value.copy(lightPos);
      mat.current.uniforms.uDim.value = dim;
    }
    if (body.current) body.current.rotation.y += dt * spin;
  });

  return (
    <group>
      <mesh ref={body}>
        <sphereGeometry args={[r, segs, segs / 2]} />
        <shaderMaterial ref={mat} vertexShader={PLANET_VERTEX} fragmentShader={PLANET_FRAGMENT} uniforms={uniforms} />
      </mesh>
      {visual.atmosphere && dim < 0.5 ? <Atmosphere color={visual.atmosphere} strength={visual.atmosphereStrength ?? 0.8} radius={r} lightPos={lightPos} segs={segs} /> : null}
      {visual.rings ? <PlanetRings radius={r} rings={visual.rings} dim={dim} /> : null}
      {visual.moons ? <BrokenMoons radius={r} count={visual.moons} color={visual.secondary} /> : null}
      {visual.surface === "distortion" ? <Distortion radius={r} color={visual.secondary} /> : null}
    </group>
  );
}

function Atmosphere({ color, strength, radius, lightPos, segs }: { color: string; strength: number; radius: number; lightPos: THREE.Vector3; segs: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color(color) }, uStrength: { value: strength }, uLightPos: { value: new THREE.Vector3() } }), [color, strength]);
  useFrame(() => {
    if (mat.current) mat.current.uniforms.uLightPos.value.copy(lightPos);
  });
  return (
    <mesh>
      <sphereGeometry args={[radius * 1.06, segs, segs / 2]} />
      <shaderMaterial ref={mat} vertexShader={ATMO_VERTEX} fragmentShader={ATMO_FRAGMENT} uniforms={uniforms} transparent side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

/** Rings: a flat ring whose uv.x runs across the radius so the shader can band it. */
function PlanetRings({ radius, rings, dim }: { radius: number; rings: NonNullable<PlanetVisual["rings"]>; dim: number }) {
  const geo = useMemo(() => {
    const inner = radius * rings.inner;
    const outer = radius * rings.outer;
    const g = new THREE.RingGeometry(inner, outer, 128, 1);
    const pos = g.attributes.position;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const t = (v.length() - inner) / (outer - inner);
      uv.setXY(i, t, 0.5);
    }
    return g;
  }, [radius, rings.inner, rings.outer]);
  const uniforms = useMemo(
    () => ({ uColor: { value: new THREE.Color(rings.color) }, uOpacity: { value: (rings.opacity ?? 0.7) * (1 - dim * 0.7) }, uInner: { value: rings.inner }, uOuter: { value: rings.outer } }),
    [rings.color, rings.opacity, rings.inner, rings.outer, dim],
  );
  return (
    <mesh geometry={geo} rotation={[Math.PI / 2 + rings.tilt, 0.2, 0]}>
      <shaderMaterial vertexShader={RING_VERTEX} fragmentShader={RING_FRAGMENT} uniforms={uniforms} transparent side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

/** Abyss: shattered moon fragments on tilted orbits. */
function BrokenMoons({ radius, count, color }: { radius: number; count: number; color: string }) {
  const group = useRef<THREE.Group>(null);
  const rocks = useMemo(() => {
    const rr = mulberry32(count * 31);
    return Array.from({ length: count }, (_, i) => ({
      dist: radius * (1.45 + rr() * 0.9),
      angle: (i / count) * Math.PI * 2 + rr() * 0.5,
      tilt: (rr() - 0.5) * 0.7,
      size: radius * (0.06 + rr() * 0.1),
      speed: 0.08 + rr() * 0.12,
      rot: [rr() * Math.PI, rr() * Math.PI, 0] as [number, number, number],
    }));
  }, [radius, count]);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.7), roughness: 0.9, metalness: 0.1, flatShading: true }), [color]);
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.06;
  });
  return (
    <group ref={group}>
      {rocks.map((m, i) => (
        <group key={i} rotation={[m.tilt, m.angle, 0]}>
          <mesh position={[m.dist, 0, 0]} rotation={m.rot} material={material}>
            <dodecahedronGeometry args={[m.size, 0]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const HALO_VERT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorld;
void main() {
  vNormal = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const HALO_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vWorld;
${NOISE_GLSL}
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  float rim = pow(1.0 - abs(dot(N, V)), 3.5);
  float n = 0.55 + 0.45 * snoise(N * 3.0 + vec3(0.0, uTime * 0.25, uTime * 0.1));
  gl_FragColor = vec4(uColor, rim * n * 0.9);
  #include <colorspace_fragment>
}
`;

/** Eclipse: a bright thin disc and a shimmering distortion shell — light bending, not an explosion. */
function Distortion({ radius, color }: { radius: number; color: string }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const disc = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color(color) }, uTime: { value: 0 } }), [color]);
  const discUniforms = useMemo(() => ({ uColor: { value: new THREE.Color(color) }, uOpacity: { value: 1 }, uInner: { value: 1.25 }, uOuter: { value: 2.4 } }), [color]);
  const discGeo = useMemo(() => {
    const inner = radius * 1.25;
    const outer = radius * 2.4;
    const g = new THREE.RingGeometry(inner, outer, 160, 1);
    const pos = g.attributes.position;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5);
    }
    return g;
  }, [radius]);
  useFrame((state, dt) => {
    if (mat.current) mat.current.uniforms.uTime.value = state.clock.elapsedTime;
    if (disc.current) disc.current.rotation.z += dt * 0.12;
  });
  return (
    <group>
      <mesh>
        <sphereGeometry args={[radius * 1.35, 64, 32]} />
        <shaderMaterial ref={mat} vertexShader={HALO_VERT} fragmentShader={HALO_FRAG} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={disc} geometry={discGeo} rotation={[Math.PI / 2 + 0.35, 0.1, 0]}>
        <shaderMaterial vertexShader={RING_VERTEX} fragmentShader={RING_FRAGMENT} uniforms={discUniforms} transparent side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}
