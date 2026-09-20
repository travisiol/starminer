/* ------------------------------------------------------------------ */
/*  REWARDS — how much a successful extraction pays and from where.    */
/* ------------------------------------------------------------------ */

export const REWARDS = {
  /** A rare drop adds this share of the base reward on top (1 = doubles it). */
  rareBonusMultiplier: 1.0,

  /** Failed missions pay this share of the planet's XP (learning, not tokens). */
  failureXpShare: 0.2,

  /**
   * Overpowering a planet does not pay more — rewards scale with the planet, not the fleet.
   * This keeps "safe planet vs risky planet" a real decision.
   */
  overpowerBonus: 0,

  /** Rewards are whole tokens. */
  rounding: "floor" as const,
} as const;
