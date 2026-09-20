import assert from "node:assert/strict";
import { test } from "node:test";
import { commanderMultiplier, refitCost, shipPower, summarizeFleet } from "@/game/math/fleet";
import type { OwnedShip } from "@/game/types";

const own = (hullId: string, mark: OwnedShip["mark"] = 1): OwnedShip => ({ instanceId: `t_${hullId}_${mark}`, hullId, mark, acquiredAt: 0, condition: 100 });

test("marks add 15% of base power each, refits cost 10% × price × target mark, MK-V is the ceiling", () => {
  assert.equal(shipPower(own("nova", 1)), 1200);
  assert.equal(shipPower(own("nova", 2)), 1380);
  assert.equal(shipPower(own("nova", 5)), 1920);
  assert.equal(refitCost("nova", 1), 1000);
  assert.equal(refitCost("nova", 4), 2500);
  assert.equal(refitCost("nova", 5), null);
});

test("TOTAL FLEET POWER is the sum of the three ships (plus optional bonuses)", () => {
  const f = summarizeFleet([own("scout-01"), own("scout-02")], 1);
  assert.equal(f.basePower, 260);
  // Same class twice: one scout trait, no power trait.
  assert.equal(f.totalPower, 260);
  assert.equal(f.bonuses.length, 1);
  assert.equal(f.durationMultiplier, 0.95);
});

test("mixed classes stack their traits; capital + dreadnought multiply power", () => {
  const f = summarizeFleet([own("omega"), own("juggernaut"), own("forge")], 1);
  assert.equal(f.basePower, 15000 + 9200 + 2900);
  assert.equal(f.totalPower, Math.round(f.basePower * 1.05 * 1.03));
  assert.ok(f.rewardMultiplier > 1);
});

test("commander bonus: +0.5% per level above 1, capped at 15%", () => {
  assert.equal(commanderMultiplier(1), 1);
  assert.equal(commanderMultiplier(11), 1.05);
  assert.equal(commanderMultiplier(30), 1.145);
  assert.equal(commanderMultiplier(99), 1.15);
  const f = summarizeFleet([own("scout-01")], 21);
  assert.equal(f.totalPower, 110);
  assert.ok(f.bonuses.some((b) => b.id === "commander"));
});

test("empty fleet is zero everywhere", () => {
  const f = summarizeFleet([], 5);
  assert.equal(f.totalPower, 0);
  assert.equal(f.ships.length, 0);
});
