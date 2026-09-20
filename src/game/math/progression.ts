import { PROGRESSION } from "../config/progression";
import { planetById, PLANETS } from "../config/planets";
import { ZONES } from "../config/zones";
import type { PlanetConfig, PlayerProgress } from "../types";
import { LEVEL_XP } from "./tables";

/** Level reached with a given total XP (1..maxLevel) — the same table the contract uses. */
export function levelForXp(xp: number): number {
  let level = 1;
  for (let n = 2; n <= LEVEL_XP.length; n++) {
    if (xp >= LEVEL_XP[n - 1]) level = n;
    else break;
  }
  return level;
}

/** Progress inside the current level, for the XP bar. */
export function levelProgress(xp: number): { level: number; current: number; needed: number; ratio: number } {
  const level = levelForXp(xp);
  if (level >= PROGRESSION.maxLevel) return { level, current: 0, needed: 0, ratio: 1 };
  const from = LEVEL_XP[level - 1];
  const to = LEVEL_XP[level];
  return { level, current: xp - from, needed: to - from, ratio: (xp - from) / (to - from) };
}

export type AccessState = "unlocked" | "locked" | "unknown";

export interface PlanetAccess {
  state: AccessState;
  /** Human-readable reasons still blocking the world (empty when unlocked). */
  missing: string[];
}

const successesOn = (progress: PlayerProgress, planetId: number) => progress.planets[planetId]?.successes ?? 0;

/** Whether the progression gates for a planet are met (power is judged separately, per fleet). Mirrors `StarminerGame.isUnlocked`. */
export function planetAccess(planet: PlanetConfig, progress: PlayerProgress): PlanetAccess {
  const req = planet.unlockRequirement;
  const missing: string[] = [];
  if (req) {
    if (req.previousPlanet && successesOn(progress, planet.id - 1) === 0) missing.push(`Mine ${planetById(planet.id - 1).name} successfully`);
    if (req.missionsCompleted && progress.missionsCompleted < req.missionsCompleted) missing.push(`Complete ${req.missionsCompleted} missions (${progress.missionsCompleted}/${req.missionsCompleted})`);
    if (req.playerLevel && progress.level < req.playerLevel) missing.push(`Reach level ${req.playerLevel}`);
  }
  return { state: missing.length === 0 ? "unlocked" : "locked", missing };
}

/** The furthest world with progression gates met — the frontier. */
export function frontierPlanet(progress: PlayerProgress): PlanetConfig {
  let best = PLANETS[0];
  for (const p of PLANETS) if (planetAccess(p, progress).state === "unlocked") best = p;
  return best;
}

export const zoneLevelRequired = (zone: number) => ZONES[zone - 1].levelRequired;

export const emptyProgress = (): PlayerProgress => ({
  xp: 0,
  level: 1,
  missionsCompleted: 0,
  missionsSucceeded: 0,
  totalMined: 0,
  furthestPlanet: 0,
  planets: {},
  milestones: [],
});
