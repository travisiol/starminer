/* ------------------------------------------------------------------ */
/*  Core domain types. Balance numbers never live here — see config/. */
/* ------------------------------------------------------------------ */

export type Difficulty = "easy" | "normal" | "hard" | "dangerous" | "extreme" | "anomaly";

export type ZoneId = 1 | 2 | 3 | 4 | 5 | 6;

export type PlanetSurface =
  | "mineral" // green ore world
  | "crystal" // bright faceted crystal
  | "desert"
  | "ocean"
  | "ash" // dark basalt with ember cracks
  | "frozen"
  | "gas" // banded gas world
  | "rust"
  | "storm" // dark banded with lightning
  | "void" // near-black
  | "fog"
  | "shattered" // dark crust with open metal veins
  | "molten"
  | "obsidian" // black crystalline
  | "dead" // grey, airless
  | "distortion"; // the endgame anomaly

export interface PlanetVisual {
  surface: PlanetSurface;
  /** Hex colours. Primary = dominant, secondary = bands / veins / crystal edges. */
  primary: string;
  secondary: string;
  /** Rim/atmosphere colour; omit for airless worlds. */
  atmosphere?: string;
  atmosphereStrength?: number;
  /** Scene radius (the solar system is not to scale on purpose). */
  radius: number;
  rings?: { color: string; inner: number; outer: number; tilt: number; opacity?: number };
  /** Broken-moon fragments orbiting the planet. */
  moons?: number;
  /** 0..1 self-illumination (molten, star-touched). */
  emissive?: number;
  /** Noise scale multiplier for the surface pattern. */
  scale?: number;
  /** Gas banding count. */
  bands?: number;
}

export interface UnlockRequirement {
  /** The previous planet must have been mined successfully at least once. */
  previousPlanet?: boolean;
  /** Total missions completed (success or failure) across the system. */
  missionsCompleted?: number;
  /** Player level gate (zones also carry one). */
  playerLevel?: number;
}

export interface PlanetConfig {
  id: number;
  name: string;
  /** Short type line, e.g. "Frozen Resource World". */
  kind: string;
  description: string;
  zone: ZoneId;
  difficulty: Difficulty;
  minimumPower: number;
  recommendedPower: number;
  /** Seconds. */
  missionDuration: number;
  rewardMin: number;
  rewardMax: number;
  /** 0..1 */
  rareDropChance: number;
  rareResource: string;
  /** XP granted on a successful extraction. */
  xp: number;
  unlockRequirement: UnlockRequirement | null;
  /** Legend worlds are known by name before they are scanned. */
  alwaysNamed?: boolean;
  visual: PlanetVisual;
  /** Orbit placement, scene units / radians. */
  orbit: { radius: number; angle: number; inclination: number; speed: number };
}

export interface ZoneConfig {
  id: ZoneId;
  name: string;
  planets: [number, number];
  /** Orbit band in scene units. */
  band: [number, number];
  /** Level gate to enter the zone (planets carry their own progression gates too). */
  levelRequired: number;
  blurb: string;
}

export type ShipClass = "scout" | "miner" | "cruiser" | "destroyer" | "dreadnought" | "capital";
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface ShipVisual {
  /** Seeds the procedural hull so every model is reproducible. */
  seed: number;
  palette: "titanium" | "charcoal" | "gunmetal" | "bone" | "obsidian";
  /** Accent light colour (engines, running lights). */
  accent: string;
}

export interface ShipConfig {
  id: string;
  name: string;
  class: ShipClass;
  /** Base Fleet Power at MK-I. */
  fleetPower: number;
  /** Price in whole tokens. */
  price: number;
  rarity: Rarity;
  levelRequired: number;
  description: string;
  status: "available" | "coming-soon";
  visual: ShipVisual;
}

/** Upgrade mark of an owned hull. */
export type Mark = 1 | 2 | 3 | 4 | 5;

export interface OwnedShip {
  instanceId: string;
  hullId: string;
  mark: Mark;
  acquiredAt: number;
  /** Reserved for the future damage system; 100 = pristine. */
  condition: number;
}

export type FleetSlots = [string | null, string | null, string | null];

export interface FleetBonus {
  id: string;
  label: string;
  detail: string;
  powerMultiplier?: number;
  successBonus?: number;
  rewardMultiplier?: number;
  durationMultiplier?: number;
  rareDropMultiplier?: number;
}

export interface FleetSummary {
  ships: OwnedShip[];
  basePower: number;
  /** Power after multiplicative bonuses. */
  totalPower: number;
  bonuses: FleetBonus[];
  successBonus: number;
  rewardMultiplier: number;
  durationMultiplier: number;
  rareDropMultiplier: number;
  /** The same four, in basis points — what the contract uses. */
  successBonusBps: number;
  rewardMultBps: number;
  durationMultBps: number;
  rareMultBps: number;
}

export type MissionStatus = "in-progress" | "resolved" | "claimed";

export interface MissionOutcome {
  success: boolean;
  /** Whole tokens paid out (0 on failure). */
  reward: number;
  rareDrop: string | null;
  rareBonus: number;
  xp: number;
  /** Where the randomness came from — always shown to the player. */
  randomSource: string;
  roll: number;
}

export interface Mission {
  id: string;
  planetId: number;
  shipIds: string[];
  fleetPower: number;
  /** 0..1, the probability shown at launch. */
  probability: number;
  startedAt: number;
  endsAt: number;
  /** Seconds, after bonuses and demo time scale. */
  duration: number;
  potentialReward: [number, number];
  status: MissionStatus;
  outcome: MissionOutcome | null;
}

export interface PlanetProgress {
  successes: number;
  failures: number;
  bestReward: number;
}

export interface PlayerProgress {
  xp: number;
  level: number;
  missionsCompleted: number;
  missionsSucceeded: number;
  totalMined: number;
  furthestPlanet: number;
  planets: Record<number, PlanetProgress>;
  milestones: string[];
}

export interface RewardVaultState {
  available: number;
  distributed: number;
  missionsCompleted: number;
}

/** A player-market listing (open, sold or cancelled). Ids are the onchain listing ids. */
export interface Listing {
  id: string;
  hullId: string;
  mark: Mark;
  /** Whole tokens asked by the seller. */
  price: number;
  seller: string;
  sellerAddress: string;
  listedAt: number;
  /** The listed hull instance (onchain ship id). */
  instanceId?: string;
  status: "open" | "sold" | "cancelled";
  buyer?: string;
  soldAt?: number;
}
