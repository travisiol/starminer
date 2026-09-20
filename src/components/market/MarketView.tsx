"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { brand } from "@/config/brand";
import { CLASS_BLURB, CLASS_LABEL, SHIPS, SHIP_CLASSES } from "@/game/config/ships";
import type { ShipClass, ShipConfig } from "@/game/types";
import { ShipCard } from "@/components/ships/ShipCard";
import { ShipDetails } from "@/components/ships/ShipDetails";
import { Label, ModeBadge } from "@/components/ui/atoms";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { fmt } from "@/lib/format";
import { useGameStore } from "@/store/gameStore";
import { PlayerMarket } from "./PlayerMarket";

/** SHIP MARKET — the primary token sink. Every hull, its power, its price, and why you cannot buy it yet. */
export function MarketView() {
  const address = useGameStore((s) => s.address);
  const hydrated = useGameStore((s) => s.hydrated);
  const deployed = useGameStore((s) => s.deployed);
  const balance = useGameStore((s) => s.balance);
  const level = useGameStore((s) => s.progress.level);
  const owned = useGameStore((s) => s.ships);
  const buy = useGameStore((s) => s.buyShip);
  const tx = useGameStore((s) => s.tx);
  const [cls, setCls] = useState<ShipClass | "all">("all");
  const [details, setDetails] = useState<ShipConfig | null>(null);

  const list = useMemo(() => (cls === "all" ? SHIPS : SHIPS.filter((s) => s.class === cls)), [cls]);
  const busy = Boolean(tx && tx.stage !== "added" && tx.stage !== "failed");
  const ownedCount = (id: string) => owned.filter((s) => s.hullId === id).length;

  const reason = (hull: ShipConfig): string | null => {
    if (!address) return "Connect wallet";
    if (!hydrated) return "Loading";
    if (!deployed) return "Game not deployed";
    if (level < hull.levelRequired) return `Requires level ${hull.levelRequired}`;
    if (balance < hull.price) return `Need ${fmt(hull.price - balance)} more ${brand.token.ticker}`;
    return null;
  };

  return (
    <div className="container-x pt-20 pb-28 md:pb-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Label>Ship market</Label>
          <h1 className="display gradient-text mt-1 text-[36px] md:text-[48px]">BUY SHIPS. GAIN POWER.</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">Every hull adds Fleet Power. Higher classes cost more and reach further. Hulls are bought at MK-I with {brand.token.ticker} and refitted up to MK-V in the hangar.</p>
        </div>
        <div className="flex items-center gap-3">
          <ModeBadge />
          {address ? (
            <div className="panel px-4 py-2 text-right">
              <Label>Balance</Label>
              <p className="num text-lg font-semibold">
                {hydrated ? fmt(balance) : "—"} <span className="text-xs text-muted">{brand.token.ticker}</span>
              </p>
            </div>
          ) : (
            <ConnectButton size="md" />
          )}
        </div>
      </header>

      <p className="mt-4 text-xs text-muted">60% of every purchase funds the reward vault; the first purchase also asks you to approve {brand.token.ticker} spending once.</p>

      <nav className="mt-6 flex gap-2" aria-label="Market sections">
        <a href="#shipyard" className="btn btn-ghost btn-sm">
          Shipyard · new hulls
        </a>
        <a href="#player-market" className="btn btn-ghost btn-sm">
          Player market · sell &amp; buy
        </a>
      </nav>

      <h2 id="shipyard" className="display-wide mt-8 scroll-mt-24 text-xs">
        Shipyard
      </h2>
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        <button type="button" className={`chip ${cls === "all" ? "border-text text-text" : "hover:text-text"}`} onClick={() => setCls("all")}>
          All hulls · {SHIPS.length}
        </button>
        {SHIP_CLASSES.map((c) => (
          <button key={c} type="button" className={`chip ${cls === c ? "border-text text-text" : "hover:text-text"}`} onClick={() => setCls(c)} title={CLASS_BLURB[c]}>
            {CLASS_LABEL[c]}
          </button>
        ))}
      </div>
      {cls !== "all" ? <p className="mt-2 text-xs text-muted">{CLASS_BLURB[cls]}</p> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((hull) => {
          const why = reason(hull);
          const count = ownedCount(hull.id);
          return (
            <ShipCard
              key={hull.id}
              hull={hull}
              onClick={() => setDetails(hull)}
              dimmed={Boolean(why) && why !== "Loading" && why !== "Connect wallet"}
              footer={
                <>
                  <button
                    type="button"
                    className="btn btn-primary btn-xs"
                    disabled={Boolean(why) || busy}
                    title={why ?? undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      void buy(hull.id);
                    }}
                  >
                    Purchase ship
                  </button>
                  <span className="label ml-auto text-[9.5px]">{why ? why : count ? `Owned ×${count}` : `Level ${hull.levelRequired}`}</span>
                </>
              }
            />
          );
        })}
      </div>

      <p className="mt-8 text-[11px] leading-relaxed text-dim">
        Ships are gameplay assets. Mining rewards depend on mission success, planet difficulty, the reward configuration and the reward vault — see{" "}
        <Link href="/economy" className="underline">
          Economy
        </Link>
        . Nothing in {brand.name} is guaranteed.
      </p>

      <PlayerMarket />

      <ShipDetails
        hull={details}
        balance={balance}
        onClose={() => setDetails(null)}
        primary={
          details
            ? {
                label: `Purchase · ${fmt(details.price)} ${brand.token.ticker}`,
                onClick: () => {
                  setDetails(null);
                  void buy(details.id);
                },
                disabled: Boolean(reason(details)) || busy,
                hint: reason(details) ?? undefined,
              }
            : undefined
        }
      />
    </div>
  );
}
