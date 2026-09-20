import type { ReactNode } from "react";
import type { ShipClass } from "@/game/types";

/** Original class silhouettes, top-down, nose up. The fallback when a hull render is not available. */
export function ClassGlyph({ cls, size = 56, className = "" }: { cls: ShipClass; size?: number; className?: string }) {
  const paths: Record<ShipClass, ReactNode> = {
    scout: (
      <>
        <path d="M32 6 L36 26 L36 46 L28 46 L28 26 Z" />
        <path d="M28 30 L12 44 L14 48 L28 40 Z" />
        <path d="M36 30 L52 44 L50 48 L36 40 Z" />
        <rect x="29" y="46" width="6" height="6" />
      </>
    ),
    miner: (
      <>
        <rect x="22" y="16" width="20" height="32" rx="2" />
        <rect x="12" y="22" width="8" height="20" rx="3" />
        <rect x="44" y="22" width="8" height="20" rx="3" />
        <path d="M26 16 L24 6 L28 6 Z" />
        <path d="M38 16 L36 6 L40 6 Z" />
        <rect x="26" y="48" width="5" height="6" />
        <rect x="33" y="48" width="5" height="6" />
      </>
    ),
    cruiser: (
      <>
        <path d="M32 4 L38 20 L38 50 L26 50 L26 20 Z" />
        <path d="M26 32 L6 42 L8 46 L26 42 Z" />
        <path d="M38 32 L58 42 L56 46 L38 42 Z" />
        <rect x="24" y="50" width="4" height="6" />
        <rect x="30" y="50" width="4" height="6" />
        <rect x="36" y="50" width="4" height="6" />
      </>
    ),
    destroyer: (
      <>
        <path d="M32 4 L46 18 L46 52 L18 52 L18 18 Z" />
        <rect x="10" y="26" width="8" height="18" />
        <rect x="46" y="26" width="8" height="18" />
        <circle cx="26" cy="30" r="3.5" fill="#06050c" />
        <circle cx="38" cy="30" r="3.5" fill="#06050c" />
        <rect x="20" y="52" width="5" height="6" />
        <rect x="27" y="52" width="5" height="6" />
        <rect x="34" y="52" width="5" height="6" />
        <rect x="41" y="52" width="5" height="6" />
      </>
    ),
    dreadnought: (
      <>
        <path d="M32 2 L40 14 L40 58 L24 58 L24 14 Z" />
        <rect x="14" y="20" width="10" height="30" />
        <rect x="40" y="20" width="10" height="30" />
        <rect x="6" y="30" width="8" height="14" rx="2" />
        <rect x="50" y="30" width="8" height="14" rx="2" />
        <rect x="26" y="40" width="12" height="4" fill="#06050c" />
      </>
    ),
    capital: (
      <>
        <path d="M32 2 L38 12 L38 60 L26 60 L26 12 Z" />
        <rect x="8" y="16" width="8" height="40" rx="2" />
        <rect x="48" y="16" width="8" height="40" rx="2" />
        <rect x="16" y="26" width="10" height="4" />
        <rect x="38" y="26" width="10" height="4" />
        <rect x="16" y="46" width="10" height="4" />
        <rect x="38" y="46" width="10" height="4" />
        <circle cx="32" cy="46" r="8" fill="none" stroke="currentColor" strokeWidth="3" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} fill="currentColor" aria-hidden="true">
      {paths[cls]}
    </svg>
  );
}
