/* ------------------------------------------------------------------ */
/*  Randomness abstraction. Game logic never touches Math.random.      */
/*                                                                     */
/*  demo  → LocalCryptoRandomProvider (browser CSPRNG, NOT secure vs   */
/*          the player — it runs on their machine; fine for demo).     */
/*  live  → the MissionManager contract resolves with an onchain       */
/*          RandomnessProvider (VRF-style); the client only reads.     */
/*  tests → SeededRandomProvider.                                      */
/* ------------------------------------------------------------------ */

export interface RollRequest {
  /** What the roll is for — logged and shown to the player. */
  purpose: "mission-outcome" | "reward" | "rare-drop";
  missionId: string;
}

export interface RollResult {
  /** Uniform in [0, 1). */
  value: number;
  /** Where the number came from; surfaced in the mission report. */
  source: "local-crypto" | "seeded" | "server" | "onchain-vrf";
  /** Optional proof / reference (tx hash, VRF request id, server signature). */
  proof?: string;
}

export interface RandomProvider {
  readonly source: RollResult["source"];
  readonly secure: boolean;
  roll(request: RollRequest): Promise<RollResult>;
}

/** Browser CSPRNG. Runs on the player's machine, so it is demo-only by design. */
export class LocalCryptoRandomProvider implements RandomProvider {
  readonly source = "local-crypto" as const;
  readonly secure = false;
  async roll(): Promise<RollResult> {
    const buf = new Uint32Array(1);
    (globalThis.crypto ?? (await import("node:crypto")).webcrypto).getRandomValues(buf);
    return { value: buf[0] / 4294967296, source: this.source };
  }
}

/** Deterministic mulberry32 stream for tests and reproducible demos. */
export class SeededRandomProvider implements RandomProvider {
  readonly source = "seeded" as const;
  readonly secure = false;
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  async roll(): Promise<RollResult> {
    return { value: this.next(), source: this.source };
  }
}

/** A fixed sequence — for tests that need a known outcome. */
export class ScriptedRandomProvider implements RandomProvider {
  readonly source = "seeded" as const;
  readonly secure = false;
  private i = 0;
  private readonly values: number[];
  constructor(values: number[]) {
    this.values = values;
  }
  async roll(): Promise<RollResult> {
    const value = this.values[Math.min(this.i++, this.values.length - 1)] ?? 0.5;
    return { value, source: this.source };
  }
}

/**
 * Live-mode stand-in. Outcomes are resolved by the MissionManager contract using the
 * configured RandomnessProvider; asking the client for a roll is a programming error.
 */
export class OnchainRandomProvider implements RandomProvider {
  readonly source = "onchain-vrf" as const;
  readonly secure = true;
  async roll(): Promise<RollResult> {
    throw new Error("Live missions are resolved onchain by MissionManager; the client never rolls.");
  }
}

export const describeSource = (source: string): string =>
  (
    ({
      "local-crypto": "Local randomness (browser CSPRNG, not verifiable)",
      seeded: "Seeded test randomness",
      server: "Server-side randomness (signed)",
      "onchain-vrf": "Onchain verifiable randomness",
      "onchain-commit-reveal": "Server-signed commitment revealed onchain, mixed with the launch block hash",
    }) as Record<string, string>
  )[source] ?? source;
