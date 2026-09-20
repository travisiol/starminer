/* ------------------------------------------------------------------ */
/*  MISSION RULES — fleet limits, the probability curve, timing.       */
/* ------------------------------------------------------------------ */

export const MISSIONS = {
  /** One active fleet, three ships, one expedition at a time. */
  maxActiveShips: 3,
  maxActiveMissions: 1,

  /**
   * Success curve. Below minimum power the mission is unavailable.
   *  - at minimum viable power       → `atMinimum`
   *  - at recommended power          → `atRecommended`
   *  - above recommended: 1 − (1 − atRecommended) · e^(−decay · (ratio − 1)), capped at `cap`
   *  - between minimum and recommended: eased interpolation (`belowExponent`)
   * With these numbers: 75% rec ≈ 63-65%, 125% ≈ 90%, 150% ≈ 95%, 200% ≈ 99%.
   */
  curve: {
    atMinimum: 0.52,
    atRecommended: 0.8,
    cap: 0.99,
    decay: 2.8,
    belowExponent: 0.85,
  },

  /** Commander bonus: +0.5% Fleet Power per player level above 1, capped. */
  commanderBonusPerLevel: 0.005,
  commanderBonusCap: 0.15,

  /** Seconds the launch transition plays before the mission counts as "in progress". */
  launchTransitionSeconds: 2.4,

  /** Failure never destroys ships in the MVP; condition loss is reserved for the damage system. */
  failureConditionLoss: 0,
} as const;
