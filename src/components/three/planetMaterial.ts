import * as THREE from "three";
import type { PlanetSurface, PlanetVisual } from "@/game/types";
import { NOISE_GLSL } from "./noise";

/* ------------------------------------------------------------------ */
/*  One shader, sixteen surfaces. Every planet is a sphere with a       */
/*  procedural pattern picked by `uSurface`; no textures are loaded.    */
/* ------------------------------------------------------------------ */

export const SURFACE_INDEX: Record<PlanetSurface, number> = {
  mineral: 0,
  crystal: 1,
  desert: 2,
  ocean: 3,
  ash: 4,
  frozen: 5,
  gas: 6,
  rust: 7,
  storm: 8,
  void: 9,
  fog: 10,
  shattered: 11,
  molten: 12,
  obsidian: 13,
  dead: 14,
  distortion: 15,
};

export const PLANET_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vObj;
varying vec3 vWorld;
void main() {
  vNormal = normalize(mat3(modelMatrix) * normal);
  vObj = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const PLANET_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uPrimary;
uniform vec3 uSecondary;
uniform vec3 uAtmo;
uniform float uAtmoStrength;
uniform int uSurface;
uniform float uScale;
uniform float uBands;
uniform float uEmissive;
uniform float uTime;
uniform vec3 uLightPos;
uniform float uDim;
varying vec3 vNormal;
varying vec3 vObj;
varying vec3 vWorld;
${NOISE_GLSL}

void main() {
  vec3 N = normalize(vNormal);
  vec3 L = normalize(uLightPos - vWorld);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 p = normalize(vObj) * uScale * 2.2;
  float lat = normalize(vObj).y;

  vec3 col = uPrimary;
  float glow = 0.0;      // self-illumination mask
  float spec = 0.0;      // specular strength
  float rough = 1.0;

  if (uSurface == 0) {            // mineral: ore world with bright veins
    float f = fbm(p * 1.3);
    float veins = smoothstep(0.62, 0.9, ridged(p * 2.4));
    col = mix(uSecondary, uPrimary, smoothstep(-0.25, 0.35, f));
    col = mix(col, uSecondary * 1.6, veins * 0.6);
  } else if (uSurface == 1) {     // crystal: faceted
    float f = abs(snoise(p * 2.6));
    float g = abs(snoise(p * 5.2 + 3.0));
    float facet = smoothstep(0.5, 0.56, f) + smoothstep(0.58, 0.62, g) * 0.6;
    col = mix(uPrimary, uSecondary, clamp(facet, 0.0, 1.0));
    spec = 0.9; rough = 0.2;
  } else if (uSurface == 2) {     // desert: dunes
    float d = sin(lat * 14.0 + fbm(p * 0.9) * 4.0) * 0.5 + 0.5;
    float f = fbm(p * 2.0) * 0.5 + 0.5;
    col = mix(uSecondary, uPrimary, d * 0.7 + f * 0.3);
  } else if (uSurface == 3) {     // ocean: water with land
    float f = fbm(p * 1.1);
    float land = smoothstep(0.12, 0.2, f);
    vec3 water = uPrimary * (0.75 + 0.25 * (fbm(p * 3.0) * 0.5 + 0.5));
    col = mix(water, uSecondary, land);
    spec = (1.0 - land) * 0.9; rough = 0.15;
  } else if (uSurface == 4) {     // ash: dark plains with ember cracks
    float f = fbm(p * 1.6) * 0.5 + 0.5;
    col = uPrimary * (0.6 + 0.6 * f);
    float cracks = smoothstep(0.78, 0.95, ridged(p * 2.2));
    col = mix(col, uSecondary, cracks);
    glow = cracks;
  } else if (uSurface == 5) {     // frozen: bright ice with dark fractures
    float f = fbm(p * 1.4) * 0.5 + 0.5;
    col = mix(uSecondary, uPrimary, 0.55 + 0.45 * f);
    float frac = smoothstep(0.82, 0.96, ridged(p * 3.1));
    col = mix(col, uSecondary * 0.55, frac);
    spec = 0.5; rough = 0.35;
  } else if (uSurface == 6) {     // gas: bands and storms
    float band = sin(lat * uBands + fbm(vec3(p.x * 0.4, lat * 3.0, p.z * 0.4) + uTime * 0.02) * 2.4);
    float storm = smoothstep(0.55, 0.9, snoise(p * 1.8 + vec3(uTime * 0.03, 0.0, 0.0)));
    col = mix(uPrimary, uSecondary, band * 0.5 + 0.5);
    col = mix(col, uSecondary * 1.2, storm * 0.35);
  } else if (uSurface == 7) {     // rust: oxidised plains
    float f = fbm(p * 1.8) * 0.5 + 0.5;
    float patches = smoothstep(0.35, 0.65, fbm(p * 0.9 + 4.0) * 0.5 + 0.5);
    col = mix(uPrimary, uSecondary, patches * 0.7) * (0.7 + 0.5 * f);
  } else if (uSurface == 8) {     // storm: dark bands with lightning
    float band = sin(lat * uBands + fbm(p * 0.8) * 3.0) * 0.5 + 0.5;
    col = mix(uPrimary, uSecondary * 0.5, band);
    float bolt = smoothstep(0.93, 1.0, ridged(p * 4.0 + vec3(0.0, uTime * 0.15, 0.0)));
    float flick = step(0.6, fract(sin(floor(uTime * 3.0) * 12.9898) * 43758.5453));
    col = mix(col, uSecondary * 1.4, bolt * flick);
    glow = bolt * flick;
  } else if (uSurface == 9) {     // void: near black, faint glints
    float f = fbm(p * 2.5) * 0.5 + 0.5;
    col = mix(uPrimary, uSecondary, f * 0.35);
    float glint = smoothstep(0.985, 1.0, snoise(p * 9.0));
    col += uSecondary * glint * 0.8;
  } else if (uSurface == 10) {    // fog: soft wide bands
    float f = fbm(p * 0.7 + vec3(uTime * 0.02, 0.0, 0.0)) * 0.5 + 0.5;
    float band = sin(lat * uBands + f * 2.0) * 0.5 + 0.5;
    col = mix(uSecondary, uPrimary, 0.35 + 0.65 * band * f);
  } else if (uSurface == 11) {    // shattered: dark crust, open metal veins
    float f = fbm(p * 1.5) * 0.5 + 0.5;
    col = uPrimary * (0.7 + 0.5 * f);
    float veins = smoothstep(0.84, 0.97, ridged(p * 1.7));
    col = mix(col, uSecondary, veins);
    glow = veins;
    spec = 0.4; rough = 0.4;
  } else if (uSurface == 12) {    // molten: crust over lava
    float r = ridged(p * 1.9 + vec3(0.0, uTime * 0.01, 0.0));
    float lava = smoothstep(0.62, 0.9, r);
    col = mix(uPrimary, uSecondary, lava);
    glow = lava;
  } else if (uSurface == 13) {    // obsidian: black glass facets
    float f = abs(snoise(p * 3.0));
    float edge = smoothstep(0.03, 0.0, abs(f - 0.5)) * 0.9;
    col = uPrimary + uSecondary * edge * 0.35;
    spec = 1.2; rough = 0.08;
  } else if (uSurface == 14) {    // dead: grey with craters
    float f = fbm(p * 1.8) * 0.5 + 0.5;
    float crater = smoothstep(0.55, 0.62, abs(snoise(p * 4.5))) * (1.0 - smoothstep(0.62, 0.7, abs(snoise(p * 4.5))));
    col = mix(uSecondary, uPrimary, f) * (1.0 - crater * 0.5);
  } else {                        // distortion: black, edge shimmer only
    col = uPrimary;
    float rim = pow(1.0 - max(dot(N, V), 0.0), 5.0);
    float sh = 0.6 + 0.4 * snoise(N * 6.0 + vec3(uTime * 0.4));
    col += uSecondary * rim * sh * 0.9;
    glow = rim * 0.5;
  }

  float ndl = dot(N, L);
  float light = 0.05 + 0.95 * max(ndl, 0.0);
  light = mix(light, 1.0, glow * uEmissive);
  vec3 H = normalize(L + V);
  float s = pow(max(dot(N, H), 0.0), mix(80.0, 12.0, rough)) * spec * max(ndl, 0.0);

  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  float dayside = 0.3 + 0.7 * smoothstep(-0.3, 0.4, ndl);
  vec3 atmo = uAtmo * fres * uAtmoStrength * 0.55 * dayside;

  vec3 outCol = col * light + vec3(s) * 0.6 + atmo + uSecondary * glow * uEmissive * 0.7;
  outCol = mix(outCol, vec3(dot(outCol, vec3(0.2126, 0.7152, 0.0722))) * 0.35, uDim);
  gl_FragColor = vec4(outCol, 1.0);
  #include <colorspace_fragment>
}
`;

export interface PlanetUniforms {
  [uniform: string]: THREE.IUniform;
  uPrimary: { value: THREE.Color };
  uSecondary: { value: THREE.Color };
  uAtmo: { value: THREE.Color };
  uAtmoStrength: { value: number };
  uSurface: { value: number };
  uScale: { value: number };
  uBands: { value: number };
  uEmissive: { value: number };
  uTime: { value: number };
  uLightPos: { value: THREE.Vector3 };
  uDim: { value: number };
}

export function makePlanetUniforms(v: PlanetVisual, dim = 0): PlanetUniforms {
  return {
    uPrimary: { value: new THREE.Color(v.primary) },
    uSecondary: { value: new THREE.Color(v.secondary) },
    uAtmo: { value: new THREE.Color(v.atmosphere ?? v.secondary) },
    uAtmoStrength: { value: v.atmosphere ? (v.atmosphereStrength ?? 0.8) : 0 },
    uSurface: { value: SURFACE_INDEX[v.surface] },
    uScale: { value: v.scale ?? 1 },
    uBands: { value: v.bands ?? 8 },
    uEmissive: { value: v.emissive ?? 0 },
    uTime: { value: 0 },
    uLightPos: { value: new THREE.Vector3(0, 0, 0) },
    uDim: { value: dim },
  };
}

/* Atmosphere shell: additive rim glow, dark on the night side. */
export const ATMO_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorld;
void main() {
  vNormal = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const ATMO_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
uniform vec3 uLightPos;
varying vec3 vNormal;
varying vec3 vWorld;
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = normalize(uLightPos - vWorld);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.6);
  float day = 0.25 + 0.75 * smoothstep(-0.35, 0.35, dot(N, L));
  gl_FragColor = vec4(uColor, rim * uStrength * day * 0.9);
  #include <colorspace_fragment>
}
`;

/* Rings: banded alpha over the radius. */
export const RING_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const RING_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uInner;
uniform float uOuter;
varying vec2 vUv;
varying vec3 vWorld;
${NOISE_GLSL}
void main() {
  // RingGeometry maps uv.x across the radius when built with our helper (see PlanetRings).
  float t = vUv.x;
  float bands = 0.5 + 0.5 * sin(t * 42.0 + snoise(vec3(t * 9.0, 1.7, 0.3)) * 4.0);
  float gap = smoothstep(0.42, 0.45, t) * (1.0 - smoothstep(0.5, 0.53, t));
  float edge = smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.92, 1.0, t));
  float a = (0.35 + 0.65 * bands) * edge * (1.0 - gap * 0.85) * uOpacity;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}
`;
