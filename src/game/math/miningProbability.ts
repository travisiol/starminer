import { MISSIONS } from "../config/missions";
import { CURVE_ABOVE_BPS, CURVE_ABOVE_RANGE_E6, CURVE_BELOW_BPS, CURVE_CAP_BPS } from "./tables";

export type CurveParams = typeof MISSIONS.curve;

/**
 * Success chance in basis points, exactly as the contract computes it: the shared lookup tables
 * (generated from the analytic curve in config/missions.ts) with integer linear interpolation.
 * Below minimum power → 0 (mission unavailable). Never above the cap (9900 = 99%).
 */
export function miningChanceBps(fleetPower: number, minimumPower: number, recommendedPower: number): number {
  const power = Math.floor(fleetPower);
  if (!(power > 0) || power < minimumPower) return 0;
  const E6 = 1_000_000;
  if (power < recommendedPower) {
    const t6 = Math.floor(((power - minimumPower) * E6) / Math.max(1, recommendedPower - minimumPower));
    const x = t6 * (CURVE_BELOW_BPS.length - 1);
    const i = Math.floor(x / E6);
    const f = x % E6;
    if (i >= CURVE_BELOW_BPS.length - 1) return CURVE_BELOW_BPS[CURVE_BELOW_BPS.length - 1];
    return CURVE_BELOW_BPS[i] + Math.floor(((CURVE_BELOW_BPS[i + 1] - CURVE_BELOW_BPS[i]) * f) / E6);
  }
  const r6 = Math.floor((power * E6) / recommendedPower);
  if (r6 >= E6 + CURVE_ABOVE_RANGE_E6) return CURVE_CAP_BPS;
  const perUnit = ((CURVE_ABOVE_BPS.length - 1) * E6) / CURVE_ABOVE_RANGE_E6; // 16 grid steps per unit of ratio
  const x = (r6 - E6) * perUnit;
  const i = Math.floor(x / E6);
  const f = x % E6;
  const bps = CURVE_ABOVE_BPS[i] + Math.floor(((CURVE_ABOVE_BPS[i + 1] - CURVE_ABOVE_BPS[i]) * f) / E6);
  return Math.min(CURVE_CAP_BPS, bps);
}

/** Success probability 0..1 (bps / 10000). Kept as the client's convenience form. */
export function miningProbability(fleetPower: number, minimumPower: number, recommendedPower: number): number {
  return miningChanceBps(fleetPower, minimumPower, recommendedPower) / 10000;
}

/** Whole-percent display value; the cap guarantees it never reads 100. */
export const probabilityPercent = (p: number, cap = MISSIONS.curve.cap): number => Math.min(Math.round(cap * 100), Math.round(p * 100));

/** Fleet Power needed to reach a target probability on a planet — the analytic inverse, used only for hints ("about 175 would put this at 90%"). */
export function powerForProbability(target: number, minimumPower: number, recommendedPower: number, params: CurveParams = MISSIONS.curve): number {
  const { atMinimum, atRecommended, cap, decay, belowExponent } = params;
  const p = Math.min(target, cap - 1e-6);
  if (p <= atMinimum) return minimumPower;
  if (p <= atRecommended) {
    const t = Math.pow((p - atMinimum) / (atRecommended - atMinimum), 1 / belowExponent);
    return Math.ceil(minimumPower + t * (recommendedPower - minimumPower));
  }
  const ratio = 1 - Math.log((1 - p) / (1 - atRecommended)) / decay;
  return Math.ceil(ratio * recommendedPower);
}

export type RiskBand = "locked" | "risky" | "fair" | "strong" | "safe";

/** Coarse bands used by the fleet builder and the system map. */
export function riskBand(p: number): RiskBand {
  if (p <= 0) return "locked";
  if (p < 0.65) return "risky";
  if (p < 0.8) return "fair";
  if (p < 0.93) return "strong";
  return "safe";
}

export const RISK_LABEL: Record<RiskBand, string> = { locked: "LOCKED", risky: "RISKY", fair: "FAIR", strong: "STRONG", safe: "SAFE" };
