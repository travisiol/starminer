import { ECONOMY } from "../config/economy";
import { MISSIONS } from "../config/missions";
import { CLASS_TRAITS, shipById } from "../config/ships";
import type { FleetBonus, FleetSummary, Mark, OwnedShip, ShipClass } from "../types";

/* ------------------------------------------------------------------ */
/*  Fleet math in basis points, in the same order as the contract,     */
/*  so the number on screen is the number onchain.                     */
/* ------------------------------------------------------------------ */

export const BPS = 10_000;
export const MARK_STEP_BPS = Math.round(ECONOMY.markPowerStep * BPS);
export const MARK_COST_RATE_BPS = Math.round(ECONOMY.markCostRate * BPS);
export const COMMANDER_BPS_PER_LEVEL = Math.round(MISSIONS.commanderBonusPerLevel * BPS);
export const COMMANDER_CAP_BPS = Math.round(MISSIONS.commanderBonusCap * BPS);

/** x × bps / 10000, rounded half up (integer). */
export const mulBpsRound = (x: number, bps: number): number => Math.floor((x * bps + BPS / 2) / BPS);
/** x × bps / 10000, floored (integer). */
export const mulBpsFloor = (x: number, bps: number): number => Math.floor((x * bps) / BPS);

/** Power of one owned hull at its current mark. */
export function shipPower(ship: Pick<OwnedShip, "hullId" | "mark">): number {
  const base = shipById(ship.hullId).fleetPower;
  return mulBpsRound(base, BPS + MARK_STEP_BPS * (ship.mark - 1));
}

export function markPower(hullId: string, mark: Mark): number {
  return shipPower({ hullId, mark });
}

/** Cost of refitting a hull from `mark` to `mark + 1`; null at MK-V. */
export function refitCost(hullId: string, mark: Mark): number | null {
  if (mark >= ECONOMY.maxMark) return null;
  return mulBpsRound(shipById(hullId).price, MARK_COST_RATE_BPS * (mark + 1));
}

/** Commander bonus in bps: +0.5% per level above 1, capped at 15%. */
export const commanderBps = (level: number): number => Math.min(COMMANDER_CAP_BPS, Math.max(0, level - 1) * COMMANDER_BPS_PER_LEVEL);

/** Commander bonus as a multiplier (1.00 … 1.15). */
export const commanderMultiplier = (level: number): number => 1 + commanderBps(level) / BPS;

/** Class trait values in bps, derived once from the config. */
export const traitBps = (cls: ShipClass) => {
  const t = CLASS_TRAITS[cls];
  return {
    power: Math.round((t.powerMultiplier ?? 1) * BPS),
    success: Math.round((t.successBonus ?? 0) * BPS),
    reward: Math.round((t.rewardMultiplier ?? 1) * BPS),
    duration: Math.round((t.durationMultiplier ?? 1) * BPS),
    rare: Math.round((t.rareDropMultiplier ?? 1) * BPS),
  };
};

/**
 * The whole fleet in one object. TOTAL FLEET POWER = (ship 1 + ship 2 + ship 3), then each
 * class power trait in class order, then the commander bonus — every step rounded, like the contract.
 */
export function summarizeFleet(ships: OwnedShip[], playerLevel = 1): FleetSummary {
  const basePower = ships.reduce((sum, s) => sum + shipPower(s), 0);
  const order: ShipClass[] = ["scout", "miner", "cruiser", "destroyer", "dreadnought", "capital"];
  const present = new Set<ShipClass>(ships.map((s) => shipById(s.hullId).class));
  const classes = order.filter((c) => present.has(c));
  const bonuses: FleetBonus[] = classes.map((c) => CLASS_TRAITS[c]);

  let totalPower = basePower;
  let successBonusBps = 0;
  let rewardMultBps = BPS;
  let durationMultBps = BPS;
  let rareMultBps = BPS;
  for (const c of classes) {
    const t = traitBps(c);
    if (t.power !== BPS) totalPower = mulBpsRound(totalPower, t.power);
    successBonusBps += t.success;
    rewardMultBps = Math.round((rewardMultBps * t.reward) / BPS);
    durationMultBps = Math.round((durationMultBps * t.duration) / BPS);
    rareMultBps = Math.round((rareMultBps * t.rare) / BPS);
  }
  const cmd = commanderBps(playerLevel);
  if (cmd > 0) {
    totalPower = mulBpsRound(totalPower, BPS + cmd);
    bonuses.push({ id: "commander", label: `Commander level ${playerLevel}`, detail: `Fleet Power +${(cmd / 100).toFixed(1).replace(/\.0$/, "")}%`, powerMultiplier: 1 + cmd / BPS });
  }
  return {
    ships,
    basePower,
    totalPower,
    bonuses,
    successBonus: successBonusBps / BPS,
    rewardMultiplier: rewardMultBps / BPS,
    durationMultiplier: durationMultBps / BPS,
    rareDropMultiplier: rareMultBps / BPS,
    successBonusBps,
    rewardMultBps,
    durationMultBps,
    rareMultBps,
  };
}
