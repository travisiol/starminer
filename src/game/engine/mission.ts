import { CURVE_CAP_BPS } from "../math/tables";
import { BPS } from "../math/fleet";
import { miningChanceBps, riskBand, type RiskBand } from "../math/miningProbability";
import { planetAccess, type PlanetAccess } from "../math/progression";
import { drawReward, failureXp, missionSeconds, rareBonus, rareChanceBps, rewardRange } from "../math/rewards";
import type { FleetSummary, Mission, MissionOutcome, PlanetConfig, PlayerProgress } from "../types";

/** Everything the planet panel shows before launch, computed from config + fleet + progress. */
export interface MissionPlan {
  planet: PlanetConfig;
  access: PlanetAccess;
  /** Success chance in bps after the fleet's success trait; 0 when the fleet is below minimum power. */
  chanceBps: number;
  /** chanceBps / 10000, for display. */
  probability: number;
  band: RiskBand;
  fleetPower: number;
  /** Fleet Power short of the minimum (0 when reachable). */
  powerShortfall: number;
  potentialReward: [number, number];
  /** Seconds, after traits and time scale. */
  duration: number;
  rareBps: number;
  rareDropChance: number;
  /** Null when launchable, otherwise the reason. */
  blocked: string | null;
}

export function planMission(planet: PlanetConfig, fleet: FleetSummary, progress: PlayerProgress, timeScale = 1, activeMission: Mission | null = null): MissionPlan {
  const access = planetAccess(planet, progress);
  const base = miningChanceBps(fleet.totalPower, planet.minimumPower, planet.recommendedPower);
  const chanceBps = base > 0 ? Math.min(CURVE_CAP_BPS, base + fleet.successBonusBps) : 0;
  const powerShortfall = Math.max(0, planet.minimumPower - fleet.totalPower);

  let blocked: string | null = null;
  if (fleet.ships.length === 0) blocked = "Equip at least one ship";
  else if (access.state !== "unlocked") blocked = access.missing[0] ?? "Locked";
  else if (powerShortfall > 0) blocked = `Fleet Power below minimum (${planet.minimumPower.toLocaleString("en-US")})`;
  else if (activeMission && activeMission.status !== "claimed") blocked = "An expedition is already in progress";

  const rareBps = rareChanceBps(planet, fleet.rareMultBps);
  return {
    planet,
    access,
    chanceBps,
    probability: chanceBps / BPS,
    band: riskBand(chanceBps / BPS),
    fleetPower: fleet.totalPower,
    powerShortfall,
    potentialReward: rewardRange(planet, fleet.rewardMultBps),
    duration: missionSeconds(planet, fleet.durationMultBps, timeScale),
    rareBps,
    rareDropChance: rareBps / BPS,
    blocked,
  };
}

/** Three integer random values, as the contract derives them from the revealed seed. */
export interface ResolutionRandoms {
  outcome: number;
  reward: number;
  rare: number;
  source: string;
}

/**
 * Pure resolution — the same arithmetic as `StarminerGame.resolve`, so a client can predict or
 * verify an onchain outcome from the revealed randomness.
 */
export function resolveOutcome(mission: Mission, planet: PlanetConfig, fleet: FleetSummary, rand: ResolutionRandoms, vaultAvailable: number): MissionOutcome {
  const chanceBps = Math.round(mission.probability * BPS);
  const roll = Math.abs(Math.floor(rand.outcome)) % BPS;
  const success = roll < chanceBps;
  if (!success) {
    return { success: false, reward: 0, rareDrop: null, rareBonus: 0, xp: failureXp(planet.xp), randomSource: rand.source, roll: roll / BPS };
  }
  const base = drawReward(planet, rand.reward, fleet.rewardMultBps);
  const rareHit = Math.abs(Math.floor(rand.rare)) % BPS < rareChanceBps(planet, fleet.rareMultBps);
  const bonus = rareHit ? rareBonus(base) : 0;
  // Rewards come from the vault, never from thin air: a thin vault pays what it has.
  const total = Math.min(vaultAvailable, base + bonus);
  return {
    success: true,
    reward: total,
    rareDrop: rareHit ? planet.rareResource : null,
    rareBonus: rareHit ? Math.max(0, total - Math.min(vaultAvailable, base)) : 0,
    xp: planet.xp,
    randomSource: rand.source,
    roll: roll / BPS,
  };
}
