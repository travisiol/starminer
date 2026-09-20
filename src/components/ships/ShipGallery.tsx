"use client";

import Link from "next/link";
import { brand } from "@/config/brand";
import { CLASS_BLURB, CLASS_LABEL, RARITY_LABEL, SHIPS, SHIP_CLASSES } from "@/game/config/ships";
import { Label } from "@/components/ui/atoms";
import { fmt } from "@/lib/format";
import { HullImage } from "./HullImage";

/** Every hull in the game, rendered large, class by class. */
export function ShipGallery() {
  return (
    <div className="container-x pt-20 pb-28 md:pb-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Label>Catalogue</Label>
          <h1 className="display gradient-text mt-1 text-[36px] md:text-[48px]">EVERY HULL IN THE SYSTEM</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">{SHIPS.length} hulls in six classes. Each one is generated from its own recipe — no two share a silhouette.</p>
        </div>
        <Link href="/market" className="btn btn-primary btn-sm">
          Open the market
        </Link>
      </header>

      {SHIP_CLASSES.map((cls) => (
        <section key={cls} className="mt-10">
          <h2 className="display-wide text-xs">{CLASS_LABEL[cls]}</h2>
          <p className="mt-1 text-sm text-muted">{CLASS_BLURB[cls]}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SHIPS.filter((s) => s.class === cls).map((hull) => (
              <div key={hull.id} className="panel p-4">
                <HullImage hull={hull} size={320} className="w-full" />
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="display-wide text-[12px]">{hull.name}</p>
                    <p className="text-[11px] text-muted">
                      {RARITY_LABEL[hull.rarity]} · level {hull.levelRequired}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="num text-lg font-semibold">{fmt(hull.fleetPower)}</p>
                    <p className="text-[11px] text-muted">
                      {fmt(hull.price)} {brand.token.ticker}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-dim">{hull.description}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
