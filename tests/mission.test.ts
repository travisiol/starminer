import assert from "node:assert/strict";
import { test } from "node:test";
import { planetById } from "@/game/config/planets";
import { planMission, resolveOutcome } from "@/game/engine/mission";
import { summarizeFleet } from "@/game/math/fleet";
import { emptyProgress } from "@/game/math/progression";
import type { Mission, OwnedShip, PlayerProgress } from "@/game/types";

const own = (hullId: string, mark: OwnedShip["mark"] = 1): OwnedShip => ({ instanceId: `t_${hullId}`, hullId, mark, acquiredAt: 0, condition: 100 });
const rand = (outcome: number, reward = 0, rare = 9999) => ({ outcome, reward, rare, source: "seeded" });

const unlockedAll = (): PlayerProgress => {
  const p = emptyProgress();
  p.level = 30;
  p.missionsCompleted = 100;
  for (let i = 1; i <= 30; i++) p.planets[i] = { successes: 1, failures: 0, bestReward: 0 };
  return p;
};

test("plan: empty fleet, locked world, below-minimum and busy fleet are all blocked with a reason", () => {
  const aera = planetById(1);
  assert.equal(planMission(aera, summarizeFleet([]), emptyProgress()).blocked, "Equip at least one ship");
  const scout = summarizeFleet([own("scout-01")]);
  assert.equal(planMission(aera, scout, emptyProgress()).blocked, null);
  assert.match(planMission(planetById(2), scout, emptyProgress()).blocked ?? "", /Mine Aera/);
  const kryos = planMission(planetById(6), scout, unlockedAll());
  assert.match(kryos.blocked ?? "", /below minimum/);
  assert.equal(kryos.chanceBps, 0);
  assert.equal(kryos.powerShortfall, 380 - 100);
  const busy: Mission = { id: "m", planetId: 1, shipIds: [], fleetPower: 100, probability: 0.5, startedAt: 0, endsAt: 1, duration: 1, potentialReward: [5, 8], status: "in-progress", outcome: null };
  assert.match(planMission(aera, scout, emptyProgress(), 1, busy).blocked ?? "", /already in progress/);
});

test("plan: the chance is the contract's bps, traits are applied in basis points", () => {
  const aera = planetById(1);
  const solo = planMission(aera, summarizeFleet([own("scout-01")]), emptyProgress());
  assert.equal(solo.chanceBps, 5912); // asserted onchain too (contracts/test)
  assert.equal(solo.probability, 0.5912);
  const kryos = planetById(6);
  const fleet = summarizeFleet([own("vanguard"), own("scout-02"), own("hauler")]); // cruiser + scout + miner
  const plan = planMission(kryos, fleet, unlockedAll());
  assert.equal(plan.fleetPower, 1420);
  assert.equal(fleet.successBonusBps, 200);
  assert.equal(fleet.rewardMultBps, 10500);
  assert.equal(fleet.durationMultBps, 9500);
  assert.ok(plan.chanceBps > 9800 && plan.chanceBps <= 9900);
  assert.deepEqual(plan.potentialReward, [Math.floor((26 * 10500) / 10000), Math.floor((39 * 10500) / 10000)]);
  assert.equal(plan.duration, Math.floor((600 * 9500 + 5000) / 10000));
  assert.equal(plan.rareBps, 120);
});

test("resolve: a roll under the chance succeeds and pays inside the range; over it fails and pays nothing", () => {
  const kryos = planetById(6);
  const fleet = summarizeFleet([own("vanguard")]);
  const m: Mission = { id: "m", planetId: 6, shipIds: ["t_vanguard"], fleetPower: 700, probability: 0.9, startedAt: 0, endsAt: 0, duration: 600, potentialReward: [26, 39], status: "in-progress", outcome: null };
  const win = resolveOutcome(m, kryos, fleet, rand(8999, 13), 1_000_000);
  assert.equal(win.success, true);
  assert.equal(win.reward, 39); // 26 + 13 % 14
  assert.equal(win.rareDrop, null);
  assert.equal(win.xp, kryos.xp);
  assert.equal(resolveOutcome(m, kryos, fleet, rand(0, 0), 1_000_000).reward, 26);
  const lose = resolveOutcome(m, kryos, fleet, rand(9000, 5, 0), 1_000_000);
  assert.equal(lose.success, false);
  assert.equal(lose.reward, 0);
  assert.equal(lose.rareDrop, null);
  assert.equal(lose.xp, Math.round(kryos.xp * 0.2));
});

test("resolve: a rare drop doubles the reward and names the resource; a thin vault caps the payout", () => {
  const kryos = planetById(6);
  const fleet = summarizeFleet([own("vanguard")]);
  const m: Mission = { id: "m", planetId: 6, shipIds: [], fleetPower: 700, probability: 0.9, startedAt: 0, endsAt: 0, duration: 600, potentialReward: [26, 39], status: "in-progress", outcome: null };
  const rare = resolveOutcome(m, kryos, fleet, rand(100, 7, 0), 1_000_000);
  assert.equal(rare.rareDrop, "Kryos Ice Core");
  assert.equal(rare.reward, 33 + 33);
  assert.equal(rare.rareBonus, 33);
  const thin = resolveOutcome(m, kryos, fleet, rand(100, 7, 9999), 10);
  assert.equal(thin.reward, 10);
});
