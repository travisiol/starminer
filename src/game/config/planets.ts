import type { Difficulty, PlanetConfig, PlanetVisual, UnlockRequirement, ZoneId } from "../types";
import { ZONES } from "./zones";

/* ------------------------------------------------------------------ */
/*  THE SYSTEM — 30 original worlds, easiest first.                    */
/*  Every balance number is here and nowhere else.                     */
/* ------------------------------------------------------------------ */

const H = 3600;
const M = 60;

/** Difficulty by band: 1-5 easy … 26-30 anomaly. */
export const difficultyOfPlanet = (id: number): Difficulty =>
  (["easy", "normal", "hard", "dangerous", "extreme", "anomaly"] as const)[Math.min(5, Math.max(0, Math.ceil(id / 5) - 1))];

/**
 * Planet row: [id, name, kind, minimumPower, recommendedPower, duration(s), rewardMin, rewardMax, rareDrop%, xp, rareResource, description, visual]
 * Kept as a table so the whole ladder is readable at a glance.
 */
type Row = [number, string, string, number, number, number, number, number, number, number, string, string, PlanetVisual];

const ROWS: Row[] = [
  // ---------------- ZONE 1 · FRONTIER ----------------
  [1, "Aera", "Green Mineral World", 90, 140, 30, 5, 8, 0.6, 20, "Verdant Ore Core", "Shallow veins of copper-green ore under a thin, pale sky. Every commander mines Aera first.",
    { surface: "mineral", primary: "#5fa57a", secondary: "#2e5a46", atmosphere: "#9fe0b8", atmosphereStrength: 0.9, radius: 1.05, scale: 1.4 }],
  [2, "Lyra", "Blue Crystal Planet", 130, 190, 1 * M, 7, 11, 0.7, 49, "Lyra Lattice Shard", "Its crust rings when the drills bite. Lattice crystal, brittle and bright, sells by the gram.",
    { surface: "crystal", primary: "#6fb2ff", secondary: "#dff1ff", atmosphere: "#a9d8ff", atmosphereStrength: 0.7, radius: 1.15, scale: 2.2 }],
  [3, "Noma", "Desert World", 180, 250, 3 * M, 10, 15, 0.8, 84, "Iron Sand Cache", "Dune seas over a bed of iron sand. Storms bury the extraction sites between every mission.",
    { surface: "desert", primary: "#c9a06a", secondary: "#8a5f34", atmosphere: "#f2cf9a", atmosphereStrength: 0.6, radius: 1.2, scale: 1.1 }],
  [4, "Velis", "Ocean Planet", 240, 330, 5 * M, 14, 21, 0.9, 121, "Abyssal Pearl", "Deep water and floating rigs. The metal is on the seabed; the risk is the tide.",
    { surface: "ocean", primary: "#1f6fb5", secondary: "#c8b98a", atmosphere: "#8ed3ff", atmosphereStrength: 1.0, radius: 1.3, scale: 1.0 }],
  [5, "Thera", "Ash World", 300, 420, 8 * M, 20, 30, 1.0, 162, "Basalt Ember", "Ash plains and low-grade basalt with embers underneath. The first world that fights back.",
    { surface: "ash", primary: "#3a3a3d", secondary: "#ff7a3d", atmosphere: "#8c8c94", atmosphereStrength: 0.5, radius: 1.35, emissive: 0.35, scale: 1.6 }],

  // ---------------- ZONE 2 · OUTER BELT ----------------
  [6, "Kryos", "Frozen Resource World", 380, 520, 10 * M, 26, 39, 1.2, 205, "Kryos Ice Core", "Ice sheets kilometres thick over rich mineral cores. Drills freeze; patience pays.",
    { surface: "frozen", primary: "#dbe9f4", secondary: "#7fa9c7", atmosphere: "#cfe6ff", atmosphereStrength: 0.8, radius: 1.5, scale: 1.3 }],
  [7, "Oryn", "Amber Gas Dwarf", 470, 650, 15 * M, 33, 50, 1.3, 251, "Amber Condensate", "Hydrocarbon clouds skimmed by scoop ships. The rewards float — and so do the storms.",
    { surface: "gas", primary: "#d39a4a", secondary: "#6e4a1f", atmosphere: "#ffd489", atmosphereStrength: 1.1, radius: 1.9, bands: 9 }],
  [8, "Vara", "Rust Iron World", 590, 800, 20 * M, 40, 60, 1.4, 300, "Oxide Ingot", "Oxidised iron plains from pole to pole. Heavy loads for heavy ships.",
    { surface: "rust", primary: "#a4552e", secondary: "#4a2416", atmosphere: "#d9865a", atmosphereStrength: 0.45, radius: 1.6, scale: 1.2 }],
  [9, "Kelon", "Twin-Ring World", 730, 980, 30 * M, 48, 72, 1.5, 350, "Ring Dust Lode", "Two ring systems of pulverised moons. The mining happens in the rings, not on the ground.",
    { surface: "dead", primary: "#b9b1a4", secondary: "#6f6960", radius: 1.55, rings: { color: "#cfc4b2", inner: 1.5, outer: 2.6, tilt: 0.35, opacity: 0.75 }, scale: 1.5 }],
  [10, "Tyrax", "Ferrous Storm Planet", 900, 1200, 45 * M, 60, 90, 1.6, 400, "Storm-forged Alloy", "Magnetic storms scramble navigation for days. The ore underneath is exceptional.",
    { surface: "storm", primary: "#3b4a63", secondary: "#8fb3ff", atmosphere: "#7aa6ff", atmosphereStrength: 0.9, radius: 2.0, bands: 7 }],

  // ---------------- ZONE 3 · VOID SECTOR ----------------
  [11, "Solven", "Sun-scorched World", 1120, 1500, 1 * H, 75, 112, 1.8, 452, "Terminator Glass", "Tidally locked and half-melted. Mining runs along the terminator line only.",
    { surface: "desert", primary: "#e6c07a", secondary: "#9a5a2a", atmosphere: "#ffe1a1", atmosphereStrength: 0.4, radius: 2.1, scale: 0.9, emissive: 0.1 }],
  [12, "Vanta", "Black World", 1400, 1850, 75 * M, 92, 138, 2.0, 506, "Null Carbon", "Absorbs almost all light. Fleets navigate Vanta by radar alone and leave by memory.",
    { surface: "void", primary: "#0a0b0e", secondary: "#2a2f3a", radius: 2.3, scale: 2.5 }],
  [13, "Kaelis", "Violet Crystal World", 1700, 2250, 90 * M, 112, 168, 2.2, 561, "Kaelis Prism", "Crystal spires taller than ships. Priceless, and sharp enough to open a hull.",
    { surface: "crystal", primary: "#8e6cf2", secondary: "#e6dcff", atmosphere: "#c2a8ff", atmosphereStrength: 0.7, radius: 2.4, scale: 2.4 }],
  [14, "Myr", "Grey Fog World", 2050, 2700, 105 * M, 135, 200, 2.4, 618, "Fog Silver", "A permanent fog that eats sensors. Scanners lie here, so fleets bring more power than they think they need.",
    { surface: "fog", primary: "#9aa0a8", secondary: "#5b636d", atmosphere: "#c9d0d8", atmosphereStrength: 1.4, radius: 2.6, bands: 4 }],
  [15, "Orionis", "Blue Giant Gas World", 2500, 3200, 2 * H, 160, 240, 2.6, 677, "Orionis Helium Core", "A blue giant of a planet. Its gravity well is where fleets learn humility.",
    { surface: "gas", primary: "#3a78d6", secondary: "#a8d0ff", atmosphere: "#7fb4ff", atmosphereStrength: 1.2, radius: 3.2, bands: 12 }],

  // ---------------- ZONE 4 · DEEP SYSTEM ----------------
  [16, "Noxia", "Toxic Gas Planet", 2950, 3800, 150 * M, 195, 300, 2.8, 737, "Chlorine Crystal", "Chlorine skies, acid rain. Every hull comes back thinner than it left.",
    { surface: "gas", primary: "#6fbf5a", secondary: "#2e5a22", atmosphere: "#b6ff9a", atmosphereStrength: 1.1, radius: 2.9, bands: 8 }],
  [17, "Zeron", "Shattered Crust World", 3500, 4500, 3 * H, 235, 370, 3.0, 800, "Raw Vein Metal", "A planet that broke and healed wrong. Veins of raw metal run open to space.",
    { surface: "shattered", primary: "#2b2d33", secondary: "#e8f4ff", atmosphere: "#8a94a8", atmosphereStrength: 0.3, radius: 3.0, emissive: 0.5, scale: 1.3 }],
  [18, "Vorax", "Red Storm Giant", 4200, 5400, 210 * M, 285, 450, 3.2, 863, "Storm Eye Ruby", "A storm the size of a moon has raged in its southern band for centuries.",
    { surface: "gas", primary: "#b8412f", secondary: "#f0a37a", atmosphere: "#ff9a7a", atmosphereStrength: 1.0, radius: 3.6, bands: 10 }],
  [19, "Talvos", "Iron Fortress World", 5000, 6400, 4 * H, 340, 540, 3.4, 928, "Fortress Plate", "Dense, heavy, ringed by the debris of failed expeditions.",
    { surface: "rust", primary: "#6b6f75", secondary: "#2a2c30", atmosphere: "#9da3ab", atmosphereStrength: 0.35, radius: 3.2, rings: { color: "#7c8188", inner: 1.4, outer: 2.1, tilt: 0.55, opacity: 0.5 }, scale: 1.7 }],
  [20, "Nexara", "Neon Crystal World", 6000, 7500, 4 * H + 30 * M, 400, 650, 3.6, 994, "Nexara Lumen Crystal", "Bioluminescent crystal fields. Beautiful from orbit, lethal below the canopy.",
    { surface: "crystal", primary: "#25d6d0", secondary: "#ff7ad9", atmosphere: "#7dfff6", atmosphereStrength: 0.8, radius: 3.4, scale: 2.8, emissive: 0.3 }],

  // ---------------- ZONE 5 · DARK EXPANSE ----------------
  [21, "Dravos", "Ash Giant", 7000, 8800, 5 * H, 470, 780, 3.8, 1062, "Dravos Slag Core", "Dead volcanoes, live ore. The plains are still warm from the last eruption cycle.",
    { surface: "ash", primary: "#4a3d36", secondary: "#ff5a2e", atmosphere: "#7a6a62", atmosphereStrength: 0.4, radius: 3.9, emissive: 0.25, scale: 1.2 }],
  [22, "Pyros", "Molten Volcanic World", 8300, 10400, 6 * H, 560, 920, 4.0, 1130, "Pyros Magma Heart", "Lava oceans under a black sky. Extraction happens between eruptions, never during.",
    { surface: "molten", primary: "#1a0c08", secondary: "#ff8a1f", atmosphere: "#ff6a2a", atmosphereStrength: 0.7, radius: 3.8, emissive: 0.9, scale: 1.4 }],
  [23, "Umbra", "Dark Purple Gas World", 9800, 12300, 6 * H, 660, 1100, 4.2, 1200, "Umbral Vapour", "Half-lit, half-guessed. Its inner layers are rich and entirely unmapped.",
    { surface: "gas", primary: "#3a1f5c", secondary: "#8f5ad1", atmosphere: "#a678ff", atmosphereStrength: 0.9, radius: 4.4, bands: 6 }],
  [24, "Cronis", "Ringed Titan World", 11600, 14500, 7 * H, 770, 1300, 4.4, 1271, "Cronis Ring Ice", "Rings so wide they cast a shadow across the whole planet at noon.",
    { surface: "desert", primary: "#d9c39a", secondary: "#8a744c", atmosphere: "#f3e4bf", atmosphereStrength: 0.5, radius: 4.2, rings: { color: "#e6d5b0", inner: 1.5, outer: 3.1, tilt: 0.42, opacity: 0.85 }, scale: 0.8 }],
  [25, "Helion", "Star-touched World", 14000, 17000, 8 * H, 900, 1500, 4.6, 1343, "Helion Corona Glass", "Close to the star's dead twin. The surface glows white; the drills glow with it.",
    { surface: "molten", primary: "#4a2a10", secondary: "#fff1c4", atmosphere: "#ffd88a", atmosphereStrength: 1.0, radius: 4.0, emissive: 1.0, scale: 1.1 }],

  // ---------------- ZONE 6 · FORBIDDEN ORBIT ----------------
  [26, "Obsidia", "Black Crystalline Planet", 16500, 20500, 6 * H, 1100, 1900, 4.8, 1418, "Obsidian Blade", "Volcanic glass in geometric fields. It reflects fleets back at themselves.",
    { surface: "obsidian", primary: "#0d0f13", secondary: "#8edbff", radius: 4.6, scale: 2.6 }],
  [27, "Xeron", "Dead Grey World", 19800, 24500, 6 * H, 1350, 2400, 5.0, 1495, "Xeron Cold Iron", "No atmosphere, no light, no sound. Just ore, and a cold that gets into the hull.",
    { surface: "dead", primary: "#6c7076", secondary: "#2c2f34", radius: 4.9, scale: 1.9 }],
  [28, "Titanis", "Colossal Iron Planet", 23800, 29500, 10 * H, 1650, 3000, 5.2, 1572, "Titanis Core Sample", "Gravity three times what hulls are rated for. Fleets leave heavier or not at all.",
    { surface: "rust", primary: "#3d4148", secondary: "#15171b", atmosphere: "#5f6670", atmosphereStrength: 0.3, radius: 6.2, rings: { color: "#5a5f66", inner: 1.3, outer: 1.9, tilt: 0.28, opacity: 0.55 }, scale: 2.0 }],
  [29, "Abyss", "Broken-Moon World", 29200, 36500, 12 * H, 2050, 3900, 5.5, 1650, "Abyssal Moon Shard", "A field of shattered moons guards it. Nothing comes back untouched.",
    { surface: "void", primary: "#0b1020", secondary: "#2b4a8a", atmosphere: "#3a5fb0", atmosphereStrength: 0.5, radius: 5.4, moons: 9, scale: 2.0 }],
  [30, "Eclipse", "Gravitational Anomaly", 35000, 45000, 8 * H, 2500, 5000, 6.0, 1750, "Eclipse Singularity Fragment", "Light bends around it. So do fleets. The window is short; the distortion closes it. The last world.",
    { surface: "distortion", primary: "#020204", secondary: "#8edbff", radius: 8.0, scale: 1.0 }],
];

const GOLDEN = 2.399963;

function orbitFor(id: number, zone: ZoneId) {
  const band = ZONES[zone - 1].band;
  const i = (id - 1) % 5; // 0..4 inside the zone
  const radius = band[0] + ((band[1] - band[0]) * i) / 4;
  const angle = (id * GOLDEN) % (Math.PI * 2);
  const inclination = ((id % 3) - 1) * 0.035 + ((id % 7) - 3) * 0.008;
  // Inner worlds circle in ~4 minutes, the outer ring in ~25 — slow enough to hover, alive enough to notice.
  const speed = 0.026 * Math.pow(14 / radius, 0.8);
  return { radius, angle, inclination, speed };
}

function unlockFor(id: number): UnlockRequirement | null {
  if (id === 1) return null;
  if (id === 2) return { previousPlanet: true };
  if (id === 3) return { previousPlanet: true, missionsCompleted: 2 };
  const zone = Math.ceil(id / 5) as ZoneId;
  const first = (zone - 1) * 5 + 1;
  // Entering a new zone needs the zone's level; inside a zone, the previous world plus a mission count.
  return id === first
    ? { previousPlanet: true, playerLevel: ZONES[zone - 1].levelRequired, missionsCompleted: (zone - 1) * 4 }
    : { previousPlanet: true, missionsCompleted: id - 1 };
}

export const PLANETS: readonly PlanetConfig[] = ROWS.map(
  ([id, name, kind, minimumPower, recommendedPower, missionDuration, rewardMin, rewardMax, rarePct, xp, rareResource, description, visual]) => {
    const zone = Math.ceil(id / 5) as ZoneId;
    return {
      id,
      name,
      kind,
      description,
      zone,
      difficulty: difficultyOfPlanet(id),
      minimumPower,
      recommendedPower,
      missionDuration,
      rewardMin,
      rewardMax,
      rareDropChance: rarePct / 100,
      rareResource,
      xp,
      unlockRequirement: unlockFor(id),
      alwaysNamed: id === 30,
      visual,
      orbit: orbitFor(id, zone),
    };
  },
);

export const PLANET_COUNT = PLANETS.length;

export const planetById = (id: number): PlanetConfig => {
  const p = PLANETS[id - 1];
  if (!p || p.id !== id) throw new Error(`Unknown planet ${id}`);
  return p;
};

export const planetsInZone = (zone: ZoneId) => PLANETS.filter((p) => p.zone === zone);

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "EASY",
  normal: "NORMAL",
  hard: "HARD",
  dangerous: "DANGEROUS",
  extreme: "EXTREME",
  anomaly: "ANOMALY",
};
