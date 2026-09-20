import assert from "node:assert/strict";
import { test } from "node:test";
import { miningProbability, powerForProbability, probabilityPercent, riskBand } from "@/game/math/miningProbability";
import { PLANETS } from "@/game/config/planets";

const pctOf = (power: number, min: number, rec: number) => probabilityPercent(miningProbability(power, min, rec));

test("below minimum power the mission is unavailable (0)", () => {
  assert.equal(miningProbability(89, 90, 140), 0);
  assert.equal(miningProbability(0, 90, 140), 0);
  assert.equal(miningProbability(-5, 90, 140), 0);
});

test("brief anchors: min ≈ 50-55, 75% ≈ 65, 100% = 80, 125% ≈ 90, 150% ≈ 96, 200% ≈ 99, never 100", () => {
  const min = 90;
  const rec = 150;
  const atMin = pctOf(min, min, rec);
  assert.ok(atMin >= 50 && atMin <= 55, `at minimum ${atMin}`);
  const at75 = pctOf(rec * 0.75, min, rec);
  assert.ok(at75 >= 60 && at75 <= 68, `at 75% ${at75}`);
  assert.equal(pctOf(rec, min, rec), 80);
  const at125 = pctOf(rec * 1.25, min, rec);
  assert.ok(at125 >= 89 && at125 <= 91, `at 125% ${at125}`);
  const at150 = pctOf(rec * 1.5, min, rec);
  assert.ok(at150 >= 94 && at150 <= 97, `at 150% ${at150}`);
  assert.equal(pctOf(rec * 2, min, rec), 99);
  assert.equal(pctOf(rec * 50, min, rec), 99);
  for (let p = 0; p < 20000; p += 37) assert.ok(miningProbability(p, min, rec) <= 0.99);
});

test("brief example: min 90 / rec 150 — 100 → ~57, 150 → 80, 200 → ~91, 300 → 99", () => {
  const f = (p: number) => pctOf(p, 90, 150);
  assert.ok(Math.abs(f(100) - 57) <= 3, `100 → ${f(100)}`);
  assert.equal(f(150), 80);
  assert.ok(Math.abs(f(200) - 91) <= 2, `200 → ${f(200)}`);
  assert.equal(f(300), 99);
});

test("endgame: Eclipse 45,000 → 80, 60,000 → ~91, 80,000 → ~97, 100,000 → 99", () => {
  const e = PLANETS[29];
  const f = (p: number) => pctOf(p, e.minimumPower, e.recommendedPower);
  assert.equal(f(45_000), 80);
  assert.ok(Math.abs(f(60_000) - 91) <= 2, `60k → ${f(60_000)}`);
  assert.ok(Math.abs(f(80_000) - 97) <= 2, `80k → ${f(80_000)}`);
  assert.equal(f(100_000), 99);
});

test("first player experience: SCOUT-01 alone on Aera ≈ 57%, plus SCOUT-02 → 95%+", () => {
  const a = PLANETS[0];
  const solo = pctOf(100, a.minimumPower, a.recommendedPower);
  assert.ok(solo >= 55 && solo <= 61, `solo → ${solo}`);
  const pair = pctOf(260, a.minimumPower, a.recommendedPower);
  assert.ok(pair >= 95, `pair → ${pair}`);
});

test("curve is monotonic and smooth (no jump at the recommended seam)", () => {
  let prev = 0;
  for (let p = 90; p <= 600; p += 1) {
    const v = miningProbability(p, 90, 150);
    assert.ok(v >= prev - 1e-9, `monotonic at ${p}`);
    prev = v;
  }
  // Power is an integer onchain: one unit either side of the recommended seam moves the chance by well under a point.
  const seamBelow = miningProbability(149, 90, 150);
  const seamAbove = miningProbability(150, 90, 150);
  assert.ok(Math.abs(seamAbove - seamBelow) < 0.01, `seam ${seamBelow} → ${seamAbove}`);
});

test("inverse: power for a target probability lands on that probability", () => {
  for (const target of [0.55, 0.7, 0.8, 0.9, 0.95, 0.98]) {
    const power = powerForProbability(target, 900, 1200);
    const got = miningProbability(power, 900, 1200);
    assert.ok(got >= target - 0.005, `${target} → power ${power} gives ${got}`);
  }
});

test("risk bands", () => {
  assert.equal(riskBand(0), "locked");
  assert.equal(riskBand(0.55), "risky");
  assert.equal(riskBand(0.7), "fair");
  assert.equal(riskBand(0.85), "strong");
  assert.equal(riskBand(0.97), "safe");
});
