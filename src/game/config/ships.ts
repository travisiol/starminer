import type { FleetBonus, Mark, Rarity, ShipClass, ShipConfig, ShipVisual } from "../types";

/* ------------------------------------------------------------------ */
/*  THE SHIP MARKET — 24 hulls across six classes.                     */
/*  A hull is bought at MK-I and refitted up to MK-V (see economy.ts). */
/* ------------------------------------------------------------------ */

export const SHIP_CLASSES: readonly ShipClass[] = ["scout", "miner", "cruiser", "destroyer", "dreadnought", "capital"];

export const CLASS_LABEL: Record<ShipClass, string> = {
  scout: "SCOUT",
  miner: "MINER",
  cruiser: "CRUISER",
  destroyer: "DESTROYER",
  dreadnought: "DREADNOUGHT",
  capital: "CAPITAL SHIP",
};

export const CLASS_BLURB: Record<ShipClass, string> = {
  scout: "Small, fast, cheap. The first hulls every commander flies.",
  miner: "Industrial and heavy. Drill arms, cargo pods, no wasted mass.",
  cruiser: "Balanced hulls that do everything reasonably well.",
  destroyer: "Large, armoured, powerful. Built to survive the deep system.",
  dreadnought: "Massive. A single hull that outweighs an early fleet.",
  capital: "Endgame. The only class that reaches the last orbit with confidence.",
};

/**
 * Class traits — the "optional bonuses" in the Fleet Power sum. A trait applies once when
 * at least one hull of that class is in the active fleet, so mixed fleets are rewarded.
 */
export const CLASS_TRAITS: Record<ShipClass, FleetBonus> = {
  scout: { id: "scout", label: "Scout pathfinding", detail: "Mission time −5%", durationMultiplier: 0.95 },
  miner: { id: "miner", label: "Miner efficiency", detail: "Mining reward +5%", rewardMultiplier: 1.05 },
  cruiser: { id: "cruiser", label: "Cruiser escort", detail: "Success chance +2 pts", successBonus: 0.02 },
  destroyer: { id: "destroyer", label: "Destroyer salvage", detail: "Rare drop chance ×1.25", rareDropMultiplier: 1.25 },
  dreadnought: { id: "dreadnought", label: "Dreadnought mass", detail: "Fleet Power +3%", powerMultiplier: 1.03 },
  capital: { id: "capital", label: "Capital command", detail: "Fleet Power +5%", powerMultiplier: 1.05 },
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "COMMON",
  uncommon: "UNCOMMON",
  rare: "RARE",
  epic: "EPIC",
  legendary: "LEGENDARY",
};

const V = (seed: number, palette: ShipVisual["palette"], accent = "#8EDBFF"): ShipVisual => ({ seed, palette, accent });

/** [id, name, class, fleetPower, price, rarity, levelRequired, description, visual] */
type Row = [string, string, ShipClass, number, number, Rarity, number, string, ShipVisual];

const ROWS: Row[] = [
  ["scout-01", "SCOUT-01", "scout", 100, 500, "common", 1, "The first hull every commander flies. Thin plating, one engine, no excuses.", V(11, "titanium")],
  ["scout-02", "SCOUT-02", "scout", 160, 750, "common", 1, "The same frame with a second reactor. Sixty percent more push for fifty percent more price.", V(12, "titanium")],
  ["ranger", "RANGER", "scout", 260, 1100, "common", 1, "Long-range scout with a proper sensor mast. Reaches the whole Frontier on its own.", V(13, "charcoal")],
  ["prospector", "PROSPECTOR", "miner", 330, 1450, "common", 2, "A drill bolted to a fuel tank. Ugly, cheap, and it fills its hold.", V(21, "gunmetal", "#ffb35c")],
  ["phantom", "PHANTOM", "scout", 420, 1800, "uncommon", 2, "Low-signature scout. The fastest hull in the Frontier and the last of its class.", V(14, "obsidian")],
  ["hauler", "HAULER", "miner", 560, 2400, "uncommon", 3, "Twin cargo pods and a reinforced spine. The Outer Belt workhorse.", V(22, "gunmetal", "#ffb35c")],
  ["vanguard", "VANGUARD", "cruiser", 700, 3000, "uncommon", 3, "First true cruiser. Balanced, armoured, and the first hull that makes Tyrax reasonable.", V(31, "titanium")],
  ["drillhead", "DRILLHEAD", "miner", 900, 3800, "uncommon", 4, "Three drill arms and a crusher deck. Built for ice and iron.", V(23, "charcoal", "#ffb35c")],
  ["nova", "NOVA", "cruiser", 1200, 5000, "rare", 5, "The cruiser that opens the Void Sector. Three engines, twin sensor masts, room to grow.", V(32, "bone")],
  ["excavator", "EXCAVATOR", "miner", 1550, 6400, "rare", 6, "Industrial mining platform with a detachable core drill. Slow, and it never comes back empty.", V(24, "gunmetal", "#ffb35c")],
  ["aurora", "AURORA", "cruiser", 1900, 7800, "rare", 7, "Long cruiser with a forward shield spine. Popular with commanders who fly Myr on purpose.", V(33, "titanium")],
  ["titan", "TITAN", "destroyer", 2200, 9000, "rare", 8, "First destroyer. Twin turret domes, four engines, plating that shrugs off Noxia's rain.", V(41, "charcoal", "#ff6a5c")],
  ["halcyon", "HALCYON", "cruiser", 2600, 10600, "rare", 9, "A cruiser stretched to the limit of its class. The last hull before things get heavy.", V(34, "bone")],
  ["forge", "FORGE", "miner", 2900, 11800, "rare", 9, "A mobile refinery. Processes ore in flight and pays for itself in the Deep System.", V(25, "obsidian", "#ffb35c")],
  ["warden", "WARDEN", "destroyer", 3400, 13800, "epic", 10, "Escort destroyer with layered armour. Fleets that fly Warden lose fewer missions to the storms.", V(42, "gunmetal", "#ff6a5c")],
  ["dreadnought", "DREADNOUGHT", "dreadnought", 4000, 16000, "epic", 11, "The class that named itself. A hull segment for every job and six engines to move them.", V(51, "charcoal")],
  ["bastion", "BASTION", "destroyer", 4800, 19000, "epic", 12, "Siege destroyer. Broad, slow, and nearly impossible to stop once it has committed.", V(43, "obsidian", "#ff6a5c")],
  ["colossus", "COLOSSUS", "dreadnought", 5800, 22500, "epic", 14, "Dreadnought with a full hangar deck. Carries its own repair crews into the Dark Expanse.", V(52, "titanium")],
  ["leviathan", "LEVIATHAN", "dreadnought", 7500, 28000, "epic", 16, "Nothing in the Dark Expanse is bigger, except the planets. Twin spines, eight engines.", V(53, "gunmetal")],
  ["juggernaut", "JUGGERNAUT", "dreadnought", 9200, 34000, "legendary", 18, "The heaviest dreadnought ever launched. Its mass alone steadies a fleet.", V(54, "obsidian")],
  ["sovereign", "SOVEREIGN", "capital", 11000, 40000, "legendary", 20, "First capital ship. A command tower, a ring drive, and a crew the size of a city.", V(61, "bone", "#D6B35A")],
  ["meridian", "MERIDIAN", "capital", 13000, 47000, "legendary", 23, "Capital ship built for the Forbidden Orbit. Its outriggers carry a scout wing of their own.", V(62, "titanium", "#D6B35A")],
  ["omega", "OMEGA", "capital", 15000, 55000, "legendary", 26, "The ship that reaches Eclipse. Three Omegas at full refit are the strongest fleet in the system.", V(63, "charcoal", "#D6B35A")],
  ["apex", "APEX", "capital", 18500, 68000, "legendary", 30, "Endgame. Nothing above it exists yet. Command it and the last orbit becomes routine.", V(64, "obsidian", "#D6B35A")],
];

export const SHIPS: readonly ShipConfig[] = ROWS.map(([id, name, cls, fleetPower, price, rarity, levelRequired, description, visual]) => ({
  id,
  name,
  class: cls,
  fleetPower,
  price,
  rarity,
  levelRequired,
  description,
  status: "available",
  visual,
}));

const byId = new Map(SHIPS.map((s) => [s.id, s]));

export const shipById = (id: string): ShipConfig => {
  const s = byId.get(id);
  if (!s) throw new Error(`Unknown hull ${id}`);
  return s;
};

export const shipsOfClass = (cls: ShipClass) => SHIPS.filter((s) => s.class === cls);

export const MARK_LABEL: Record<Mark, string> = { 1: "MK-I", 2: "MK-II", 3: "MK-III", 4: "MK-IV", 5: "MK-V" };
