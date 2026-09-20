"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe2, Rocket, ShoppingBag, Timer, UserRound } from "lucide-react";
import { useGameStore } from "@/store/gameStore";

const ITEMS = [
  { href: "/", label: "Planets", Icon: Globe2 },
  { href: "/fleet", label: "Fleet", Icon: Rocket },
  { href: "/market", label: "Market", Icon: ShoppingBag },
  { href: "/missions", label: "Missions", Icon: Timer },
  { href: "/profile", label: "Profile", Icon: UserRound },
] as const;

/** Bottom navigation on phones. Hidden on the how-it-works page and on desktop. */
export function MobileNav() {
  const pathname = usePathname();
  const active = useGameStore((s) => s.activeMission?.status ?? null);
  if (pathname === "/how-it-works") return null;
  return (
    <nav className="glass-strong safe-bottom fixed inset-x-3 bottom-3 z-[70] flex h-16 items-stretch rounded-2xl lg:hidden" aria-label="Mobile">
      {ITEMS.map(({ href, label, Icon }) => {
        const current = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} className={`relative flex flex-1 flex-col items-center justify-center gap-1 ${current ? "text-text" : "text-muted"}`} aria-current={current ? "page" : undefined}>
            <Icon size={18} strokeWidth={1.75} />
            <span className="label text-[9px]">{label}</span>
            {href === "/missions" && active ? <span className={`absolute top-3 right-[calc(50%-14px)] dot ${active === "resolved" ? "text-gold" : "text-accent animate-pulse-soft"}`} /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
