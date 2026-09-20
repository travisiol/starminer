import type { ZoneConfig, ZoneId } from "../types";

/** Six rings, each five worlds deep. The player travels outward. */
export const ZONES: readonly ZoneConfig[] = [
  { id: 1, name: "Frontier", planets: [1, 5], band: [14, 24], levelRequired: 1, blurb: "Shallow ore, short trips. Where every fleet starts." },
  { id: 2, name: "Outer Belt", planets: [6, 10], band: [32, 44], levelRequired: 3, blurb: "Ice, rust and the first real storms." },
  { id: 3, name: "Void Sector", planets: [11, 15], band: [54, 70], levelRequired: 6, blurb: "Light thins out. Sensors lie. Rewards stop being small." },
  { id: 4, name: "Deep System", planets: [16, 20], band: [82, 102], levelRequired: 10, blurb: "Toxic giants and shattered crusts. Hulls come back thinner." },
  { id: 5, name: "Dark Expanse", planets: [21, 25], band: [116, 142], levelRequired: 15, blurb: "Molten, ringed, star-touched. Missions measured in hours." },
  { id: 6, name: "Forbidden Orbit", planets: [26, 30], band: [158, 196], levelRequired: 20, blurb: "Five worlds that weak fleets cannot touch. The last is Eclipse." },
];

export const zoneById = (id: ZoneId): ZoneConfig => ZONES[id - 1];

export const zoneOfPlanet = (planetId: number): ZoneConfig => ZONES[Math.min(5, Math.max(0, Math.ceil(planetId / 5) - 1))];
