import { REWARDS } from "../config/rewards";
import type { PlanetConfig } from "../types";
import { BPS, mulBpsFloor, mulBpsRound } from "./fleet";

/* ------------------------------------------------------------------ */
/*  Reward math in basis points — the contract does exactly this.      */
/* ------------------------------------------------------------------ */

export const RARE_BONUS_BPS = Math.round(REWARDS.rareBonusMultiplier * BPS);
export const FAILURE_XP_BPS = Math.round(REWARDS.failureXpShare * BPS);

/** Reward range a fleet can expect on a planet, after the fleet's reward trait. Whole tokens (floored). */
export function rewardRange(planet: PlanetConfig, rewardMultBps = BPS): [number, number] {
  return [mulBpsFloor(planet.rewardMin, rewardMultBps), mulBpsFloor(planet.rewardMax, rewardMultBps)];
}

/** Uniform draw inside the range from a non-negative integer random value: lo + rand % (hi − lo + 1). */
export function drawReward(planet: PlanetConfig, rand: number, rewardMultBps = BPS): number {
  const [lo, hi] = rewardRange(planet, rewardMultBps);
  return lo + (Math.abs(Math.floor(rand)) % (hi - lo + 1));
}

export const rareBonus = (reward: number): number => mulBpsFloor(reward, RARE_BONUS_BPS);

/** Rare drop chance in bps after the fleet's rare trait. */
export function rareChanceBps(planet: PlanetConfig, rareMultBps = BPS): number {
  return Math.min(BPS, Math.floor((Math.round(planet.rareDropChance * BPS) * rareMultBps) / BPS));
}

/** Effective mission duration in seconds after the fleet's duration trait (and an optional time scale). */
export function missionSeconds(planet: PlanetConfig, durationMultBps = BPS, timeScale = 1): number {
  return Math.max(5, Math.round(mulBpsRound(planet.missionDuration, durationMultBps) / Math.max(1, timeScale)));
}

export const failureXp = (xp: number): number => mulBpsRound(xp, FAILURE_XP_BPS);
