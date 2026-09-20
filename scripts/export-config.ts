// Writes the game config in the contract's shape for Hardhat tests and scripts.
// usage: node --import ./tests/register.mjs scripts/export-config.ts → contracts/deploy-config.json
import { writeFileSync } from "node:fs";
import { contractHulls, contractPlanets } from "@/game/chain/gameConfig";
import { SHIPS } from "@/game/config/ships";
import { PLANETS } from "@/game/config/planets";

const json = {
  generated: new Date().toISOString(),
  decimals: 18,
  hulls: contractHulls().map((h, i) => ({ id: SHIPS[i].id, name: SHIPS[i].name, ...h, price: h.price.toString() })),
  planets: contractPlanets().map((p, i) => ({ id: PLANETS[i].id, name: PLANETS[i].name, ...p, rewardMin: p.rewardMin.toString(), rewardMax: p.rewardMax.toString() })),
};
writeFileSync("contracts/deploy-config.json", JSON.stringify(json, null, 2));
console.log(`wrote contracts/deploy-config.json: ${json.hulls.length} hulls, ${json.planets.length} planets`);
