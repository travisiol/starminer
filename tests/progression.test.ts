import assert from "node:assert/strict";
import { test } from "node:test";
import { PLANETS, planetById } from "@/game/config/planets";
import { PROGRESSION } from "@/game/config/progression";
import { emptyProgress, frontierPlanet, levelForXp, levelProgress, planetAccess } from "@/game/math/progression";
import { LEVEL_XP } from "@/game/math/tables";
import type { PlayerProgress } from "@/game/types";

const withSuccesses = (ids: number[], extra: Partial<PlayerProgress> = {}): PlayerProgress => {
  const p = emptyProgress();
  for (const id of ids) p.planets[id] = { successes: 1, failures: 0, bestReward: 0 };
  p.missionsCompleted = ids.length;
  p.missionsSucceeded = ids.length;
  return { ...p, ...extra };
};

test("levels: 0 XP is level 1, thresholds rise, max level 30 — from the shared table", () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(LEVEL_XP[1]), 2);
  assert.equal(levelForXp(LEVEL_XP[1] - 1), 1);
  assert.equal(levelForXp(1e9), 30);
  for (let n = 2; n <= 30; n++) {
    assert.ok(LEVEL_XP[n - 1] > LEVEL_XP[n - 2]);
    assert.equal(LEVEL_XP[n - 1], PROGRESSION.xpForLevel(n), `table matches the config formula at level ${n}`);
  }
  const lp = levelProgress(LEVEL_XP[2] + 10);
  assert.equal(lp.level, 3);
  assert.equal(lp.current, 10);
});

test("a fresh commander: Aera unlocked, every other world named and visible but locked", () => {
  const p = emptyProgress();
  assert.equal(planetAccess(planetById(1), p).state, "unlocked");
  assert.equal(planetAccess(planetById(2), p).state, "locked");
  assert.equal(planetAccess(planetById(3), p).state, "locked");
  for (const planet of PLANETS) assert.ok(planet.name.length > 0);
  assert.equal(frontierPlanet(p).id, 1);
});

test("mining Aera unlocks Lyra; Noma also needs two completed missions", () => {
  const one = withSuccesses([1]);
  assert.equal(planetAccess(planetById(2), one).state, "unlocked");
  const two = withSuccesses([1, 2]);
  assert.equal(planetAccess(planetById(3), two).state, "unlocked");
  const twoButOneMission = withSuccesses([1, 2], { missionsCompleted: 1 });
  const a = planetAccess(planetById(3), twoButOneMission);
  assert.equal(a.state, "locked");
  assert.match(a.missing.join(" "), /Complete 2 missions/);
});

test("zone gates need the zone level even with the previous world mined", () => {
  const five = withSuccesses([1, 2, 3, 4, 5]);
  const k = planetAccess(planetById(6), five);
  assert.equal(k.state, "locked");
  assert.match(k.missing.join(" "), /level 3/);
  const leveled = { ...five, level: 3, xp: LEVEL_XP[2] };
  assert.equal(planetAccess(planetById(6), leveled).state, "unlocked");
});

test("the whole chain is completable: mining every world in order unlocks the next", () => {
  let p = emptyProgress();
  for (const planet of PLANETS) {
    p = { ...p, level: 30, xp: 1e6, missionsCompleted: Math.max(p.missionsCompleted, planet.id * 2) };
    assert.equal(planetAccess(planet, p).state, "unlocked", `${planet.name} should be open`);
    p.planets[planet.id] = { successes: 1, failures: 0, bestReward: 0 };
    p.missionsCompleted += 1;
  }
  assert.equal(frontierPlanet(p).id, 30);
});
