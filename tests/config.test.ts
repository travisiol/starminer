import assert from "node:assert/strict";
import { test } from "node:test";
import { PLANETS, difficultyOfPlanet } from "@/game/config/planets";
import { SHIPS, CLASS_TRAITS, SHIP_CLASSES } from "@/game/config/ships";
import { ZONES } from "@/game/config/zones";
import { ECONOMY } from "@/game/config/economy";

test("exactly 30 planets, numbered 1..30, one zone of five each", () => {
  assert.equal(PLANETS.length, 30);
  PLANETS.forEach((p, i) => {
    assert.equal(p.id, i + 1);
    assert.equal(p.zone, Math.ceil(p.id / 5));
    assert.equal(p.difficulty, difficultyOfPlanet(p.id));
  });
  assert.deepEqual(
    ZONES.map((z) => z.planets),
    [
      [1, 5],
      [6, 10],
      [11, 15],
      [16, 20],
      [21, 25],
      [26, 30],
    ],
  );
});

test("planet power ladder is strictly increasing and minimum < recommended", () => {
  for (let i = 0; i < PLANETS.length; i++) {
    const p = PLANETS[i];
    assert.ok(p.minimumPower < p.recommendedPower, `${p.name} min < rec`);
    if (i > 0) {
      assert.ok(p.minimumPower > PLANETS[i - 1].minimumPower, `${p.name} min rises`);
      assert.ok(p.recommendedPower > PLANETS[i - 1].recommendedPower, `${p.name} rec rises`);
      assert.ok(p.rewardMin > PLANETS[i - 1].rewardMin, `${p.name} reward rises`);
    }
  }
  // Brief anchors.
  const at = (id: number) => PLANETS[id - 1];
  assert.deepEqual([at(1).minimumPower, at(1).recommendedPower], [90, 140]);
  assert.deepEqual([at(10).minimumPower, at(10).recommendedPower], [900, 1200]);
  assert.deepEqual([at(20).minimumPower, at(20).recommendedPower], [6000, 7500]);
  assert.deepEqual([at(30).minimumPower, at(30).recommendedPower], [35000, 45000]);
  assert.deepEqual([at(30).rewardMin, at(30).rewardMax], [2500, 5000]);
  assert.equal(at(30).missionDuration, 28800);
  assert.equal(at(1).missionDuration, 30);
});

test("planet names are original and unique; every world has a distinct visual", () => {
  const names = new Set(PLANETS.map((p) => p.name.toLowerCase()));
  assert.equal(names.size, 30);
  for (const real of ["earth", "mars", "jupiter", "saturn", "venus", "mercury", "neptune", "uranus", "pluto"]) assert.ok(!names.has(real));
  const visuals = new Set(PLANETS.map((p) => `${p.visual.surface}|${p.visual.primary}|${p.visual.secondary}`));
  assert.equal(visuals.size, 30);
});

test("unlock chain: planet 1 open, others gated on the previous world", () => {
  assert.equal(PLANETS[0].unlockRequirement, null);
  for (const p of PLANETS.slice(1)) assert.ok(p.unlockRequirement?.previousPlanet, `${p.name} needs previous`);
  assert.equal(PLANETS[2].unlockRequirement?.missionsCompleted, 2);
  for (const z of ZONES.slice(1)) assert.equal(PLANETS[z.planets[0] - 1].unlockRequirement?.playerLevel, z.levelRequired);
});

test("ship market: 20-30 hulls, unique ids, power rises with price, every class represented", () => {
  assert.ok(SHIPS.length >= 20 && SHIPS.length <= 30);
  assert.equal(new Set(SHIPS.map((s) => s.id)).size, SHIPS.length);
  for (let i = 1; i < SHIPS.length; i++) {
    assert.ok(SHIPS[i].fleetPower > SHIPS[i - 1].fleetPower, `${SHIPS[i].name} power rises`);
    assert.ok(SHIPS[i].price > SHIPS[i - 1].price, `${SHIPS[i].name} price rises`);
    assert.ok(SHIPS[i].levelRequired >= SHIPS[i - 1].levelRequired, `${SHIPS[i].name} level rises`);
  }
  for (const c of SHIP_CLASSES) {
    assert.ok(SHIPS.some((s) => s.class === c), `class ${c} exists`);
    assert.ok(CLASS_TRAITS[c]);
  }
  const first = SHIPS[0];
  assert.deepEqual([first.id, first.fleetPower, first.price, first.levelRequired], ["scout-01", 100, 500, 1]);
  const omega = SHIPS.find((s) => s.id === "omega")!;
  assert.deepEqual([omega.fleetPower, omega.price, omega.class], [15000, 55000, "capital"]);
});

test("economy: the demo balance buys the first hull many times over, sinks are declared", () => {
  assert.equal(ECONOMY.demoStartingBalance, 10_000);
  assert.ok(ECONOMY.sinks.some((s) => s.id === "ships" && s.active));
  assert.equal(ECONOMY.maxMark, 5);
});
