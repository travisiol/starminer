import { brand } from "@/config/brand";

/* ------------------------------------------------------------------ */
/*  TOKEN ECONOMY — utility and sinks. No guaranteed anything.         */
/* ------------------------------------------------------------------ */

export const ECONOMY = {
  token: brand.token,

  /** Demo wallets start here. Demo tokens are not money. */
  demoStartingBalance: 10_000,

  /** Demo reward vault at first launch; mining draws it down, ship purchases refill it. */
  demoVaultInitial: 2_500_000,
  /** Share of every ship purchase / refit routed back into the reward vault (demo model). */
  vaultShareOfSpend: 0.6,

  /**
   * Refits: MK-I → MK-V. Each mark adds `markPowerStep` of the hull's base power;
   * each refit costs `markCostRate × price × targetMark`. Marks stop at V — no infinite scaling.
   */
  markPowerStep: 0.15,
  markCostRate: 0.1,
  maxMark: 5,

  /**
   * Player market: commanders sell hulls to each other. The protocol keeps `marketFeeBps` of every
   * sale for the reward vault; the rest goes to the seller. Listings above `marketMaxPriceRatio` × the
   * hull's current value find no demo buyer (and would sit unsold in live too).
   */
  marketFeeBps: 250,
  marketMaxPriceRatio: 1.2,
  /** Demo buyers pick up a fairly priced listing after 45–120 seconds. */
  demoBuyerDelaySeconds: [45, 120] as const,

  /** Token sinks. `active` ones exist in the MVP; the rest are architectural placeholders. */
  sinks: [
    { id: "ships", label: "Ship purchases", active: true, note: "The primary sink. Every hull is bought with the native token." },
    { id: "refits", label: "Ship refits (MK-II → MK-V)", active: true, note: "Secondary sink, capped at MK-V." },
    { id: "market-fee", label: "Player market fee (2.5%)", active: true, note: "Every commander-to-commander sale routes a fee to the reward vault." },
    { id: "repairs", label: "Repairs", active: false, note: "Reserved for the optional damage system." },
    { id: "permits", label: "Special mining permits", active: false, note: "Time-limited access to event worlds." },
    { id: "cosmetics", label: "Cosmetics", active: false, note: "Hull liveries and hangar themes. Never power." },
    { id: "modules", label: "Fleet modules", active: false, note: "Slot modifiers once fleets grow beyond three ships." },
    { id: "expeditions", label: "Rare expeditions", active: false, note: "One-off missions with their own reward pool." },
  ],
} as const;

export type SinkId = (typeof ECONOMY.sinks)[number]["id"];
