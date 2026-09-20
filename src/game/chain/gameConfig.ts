import { parseUnits } from "viem";
import { PLANETS } from "../config/planets";
import { SHIPS, SHIP_CLASSES } from "../config/ships";

/* ------------------------------------------------------------------ */
/*  The game config in the contract's shape. The deploy page and the   */
/*  export script both go through here, so onchain == config.          */
/*  Onchain hull id = index in SHIPS; planet id = 1-based.             */
/* ------------------------------------------------------------------ */

export interface ContractHull {
  power: number;
  price: bigint;
  class: number;
  levelRequired: number;
  active: boolean;
}

export interface ContractPlanet {
  minPower: number;
  recPower: number;
  duration: number;
  rewardMin: bigint;
  rewardMax: bigint;
  rareBps: number;
  xp: number;
}

export function contractHulls(decimals = 18): ContractHull[] {
  return SHIPS.map((s) => ({
    power: s.fleetPower,
    price: parseUnits(String(s.price), decimals),
    class: SHIP_CLASSES.indexOf(s.class),
    levelRequired: s.levelRequired,
    active: s.status === "available",
  }));
}

export function contractPlanets(decimals = 18): ContractPlanet[] {
  return PLANETS.map((p) => ({
    minPower: p.minimumPower,
    recPower: p.recommendedPower,
    duration: p.missionDuration,
    rewardMin: parseUnits(String(p.rewardMin), decimals),
    rewardMax: parseUnits(String(p.rewardMax), decimals),
    rareBps: Math.round(p.rareDropChance * 10_000),
    xp: p.xp,
  }));
}

export const hullIndex = (hullId: string): number => SHIPS.findIndex((s) => s.id === hullId);
export const hullByIndex = (i: number) => SHIPS[i];
