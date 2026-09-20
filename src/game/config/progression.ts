/* ------------------------------------------------------------------ */
/*  PLAYER PROGRESSION — XP, levels, milestones.                       */
/* ------------------------------------------------------------------ */

export const PROGRESSION = {
  maxLevel: 30,
  /** Total XP needed to *be* level n: 80 · (n−1)^1.9, rounded to tens. Level 1 = 0. */
  xpForLevel(level: number): number {
    if (level <= 1) return 0;
    return Math.round((80 * Math.pow(level - 1, 1.9)) / 10) * 10;
  },
  /** XP granted when a world is scanned for the first time. */
  discoveryXp(zone: number): number {
    return 30 * zone;
  },
  milestones: [
    { id: "first-ship", label: "First hull purchased", xp: 25 },
    { id: "full-fleet", label: "Three ships equipped", xp: 60 },
    { id: "first-success", label: "First successful extraction", xp: 40 },
    { id: "zone-2", label: "Reached the Outer Belt", xp: 120 },
    { id: "zone-3", label: "Reached the Void Sector", xp: 240 },
    { id: "zone-4", label: "Reached the Deep System", xp: 400 },
    { id: "zone-5", label: "Reached the Dark Expanse", xp: 650 },
    { id: "zone-6", label: "Reached the Forbidden Orbit", xp: 1000 },
    { id: "eclipse", label: "Mined Eclipse", xp: 2500 },
  ],
} as const;

export type MilestoneId = (typeof PROGRESSION.milestones)[number]["id"];
