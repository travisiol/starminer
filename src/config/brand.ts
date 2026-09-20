/**
 * Everything brand-shaped lives here. A rename touches this file,
 * `package.json`, `.env.example`, `README.md` and `.claude/launch.json` — nothing else.
 */
export const brand = {
  name: "STARMINER",
  wordmark: "STARMINER",
  /** The three lines of the core tagline, in order. */
  tagline: ["BUILD YOUR FLEET.", "CONQUER THE SYSTEM.", "MINE THE UNKNOWN."] as const,
  line: "Build your fleet. Conquer the system. Mine the unknown.",
  description:
    "A browser-based space mining strategy game. Thirty worlds, one three-ship fleet, transparent odds. Buy ships, build Fleet Power, reach the planets weak fleets cannot touch.",
  hook: "30 WORLDS. ONE FLEET. HOW FAR CAN YOU GO?",
  token: {
    /** Placeholder native token. */
    symbol: "STAR",
    ticker: "$STAR",
    name: "Star Token",
    decimals: 18,
  },
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3781").replace(/\/$/, ""),
  social: {
    x: "",
    docs: "/#how-it-works",
  },
} as const;

export type Brand = typeof brand;
