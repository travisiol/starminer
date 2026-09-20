"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { brand } from "@/config/brand";
import { Mark } from "@/components/brand/Mark";
import { ModeBadge } from "@/components/ui/atoms";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { fmt } from "@/lib/format";
import { useGameStore } from "@/store/gameStore";

export const NAV = [
  { href: "/", label: "Planets" },
  { href: "/system", label: "Map" },
  { href: "/fleet", label: "Fleet" },
  { href: "/hangar", label: "Hangar" },
  { href: "/market", label: "Market" },
  { href: "/missions", label: "Missions" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/economy", label: "Economy" },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const balance = useGameStore((s) => s.balance);
  const hydrated = useGameStore((s) => s.hydrated);
  const power = useGameStore((s) => s.fleet.filter(Boolean).length);
  const landing = pathname === "/how-it-works";

  return (
    <header className={`fixed inset-x-0 top-0 z-[60] ${landing ? "" : "border-b border-line/80 bg-void/70 backdrop-blur-xl"}`}>
      <div className="flex h-14 items-center gap-4 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2.5 text-text" aria-label={`${brand.name} home`}>
          <Mark size={22} />
          <span className="display-wide text-[13px] tracking-[0.22em]">{brand.wordmark}</span>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV.map((n) => {
            const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`label rounded-md px-3 py-2 transition ${active ? "bg-white/[0.06] text-text" : "hover:bg-white/[0.04] hover:text-text"}`}
                aria-current={active ? "page" : undefined}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <ModeBadge className="hidden sm:inline-flex" />
          <Link href="/profile" className="panel flex h-9 items-center gap-2 px-3 transition hover:border-graphite" title="Your balance and commander profile">
            <span className="label hidden sm:inline">{brand.token.ticker}</span>
            <span className="num text-sm font-semibold">{hydrated ? fmt(balance) : "—"}</span>
            <span className="label hidden md:inline text-dim">·</span>
            <span className="label hidden md:inline">{hydrated ? `${power}/3 ships` : ""}</span>
          </Link>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
