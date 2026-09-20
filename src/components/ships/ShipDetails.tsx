"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { brand } from "@/config/brand";
import { ECONOMY } from "@/game/config/economy";
import { CLASS_BLURB, CLASS_LABEL, CLASS_TRAITS, MARK_LABEL, RARITY_LABEL } from "@/game/config/ships";
import { markPower, refitCost, shipPower } from "@/game/math/fleet";
import type { Mark, OwnedShip, ShipConfig } from "@/game/types";
import { Label } from "@/components/ui/atoms";
import { fmt } from "@/lib/format";
import { easeOutExpo } from "@/lib/motion";
import { ShipPreview } from "./ShipPreview";

interface Props {
  hull: ShipConfig | null;
  owned?: OwnedShip;
  onClose: () => void;
  /** Market: purchase. Hangar: refit / equip. */
  primary?: { label: string; onClick: () => void; disabled?: boolean; hint?: string };
  secondary?: { label: string; onClick: () => void; disabled?: boolean };
  balance: number;
  onRefit?: (instanceId: string) => void;
}

/** DETAILS drawer: a live 3D turntable, the numbers, the class trait and the refit ladder. */
export function ShipDetails({ hull, owned, onClose, primary, secondary, balance, onRefit }: Props) {
  return (
    <AnimatePresence>
      {hull ? (
        <motion.div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} role="dialog" aria-modal="true" aria-label={`${hull.name} details`}>
          <motion.div
            className="glass-strong scroll-thin relative max-h-[92svh] w-full max-w-3xl overflow-y-auto p-5 md:p-6"
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ duration: 0.4, ease: easeOutExpo }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" aria-label="Close" onClick={onClose} className="absolute top-4 right-4 z-10 rounded-md p-1 text-muted transition hover:text-text">
              <X size={16} />
            </button>
            <div className="grid gap-5 md:grid-cols-[1.1fr_1fr]">
              <ShipPreview hull={hull} className="aspect-[4/3] md:aspect-auto md:min-h-[380px]" />
              <div>
                <Label>
                  {CLASS_LABEL[hull.class]} · {RARITY_LABEL[hull.rarity]}
                </Label>
                <h2 className="display mt-1 text-[32px]">
                  {hull.name}
                  {owned ? <span className="ml-2 text-lg text-muted">{MARK_LABEL[owned.mark]}</span> : null}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{hull.description}</p>
                <p className="mt-2 text-xs text-dim">{CLASS_BLURB[hull.class]}</p>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <Field label="Fleet Power" value={fmt(owned ? shipPower(owned) : hull.fleetPower)} big />
                  <Field label={owned ? "Paid" : "Price"} value={`${fmt(hull.price)} ${brand.token.ticker}`} />
                  <Field label="Level required" value={String(hull.levelRequired)} />
                  <Field label="Class trait" value={CLASS_TRAITS[hull.class].detail} />
                </div>

                <div className="mt-4 rounded-md border border-line p-3">
                  <Label>Refit ladder</Label>
                  <ul className="mt-2 grid grid-cols-5 gap-1">
                    {([1, 2, 3, 4, 5] as Mark[]).map((m) => {
                      const current = owned?.mark ?? 1;
                      const cost = m > 1 ? refitCost(hull.id, (m - 1) as Mark) : null;
                      return (
                        <li key={m} className={`rounded border px-1.5 py-1.5 text-center ${m === current ? "border-accent/60 bg-accent/5" : m < current ? "border-line opacity-60" : "border-line"}`}>
                          <p className="label text-[9px]">{MARK_LABEL[m]}</p>
                          <p className="num text-xs font-semibold">{fmt(markPower(hull.id, m))}</p>
                          {cost !== null ? <p className="text-[9px] text-dim">{fmt(cost)}</p> : <p className="text-[9px] text-dim">base</p>}
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-2 text-[11px] text-dim">
                    Each mark adds {Math.round(ECONOMY.markPowerStep * 100)}% of base power. Refits cost {Math.round(ECONOMY.markCostRate * 100)}% of the price × the target mark and stop at MK-V.
                  </p>
                </div>

                <div className="mt-5 flex flex-col gap-2">
                  {primary ? (
                    <button type="button" className="btn btn-primary w-full" onClick={primary.onClick} disabled={primary.disabled} title={primary.hint}>
                      {primary.label}
                    </button>
                  ) : null}
                  {owned && onRefit && owned.mark < ECONOMY.maxMark ? (
                    <button type="button" className="btn btn-ghost w-full" disabled={(refitCost(hull.id, owned.mark) ?? Infinity) > balance} onClick={() => onRefit(owned.instanceId)}>
                      Refit to {MARK_LABEL[(owned.mark + 1) as Mark]} · {fmt(refitCost(hull.id, owned.mark) ?? 0)} {brand.token.ticker}
                    </button>
                  ) : null}
                  {secondary ? (
                    <button type="button" className="btn btn-ghost w-full" onClick={secondary.onClick} disabled={secondary.disabled}>
                      {secondary.label}
                    </button>
                  ) : null}
                  {primary?.hint ? <p className="text-center text-[11px] text-muted">{primary.hint}</p> : null}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Field({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div>
      <Label>{label}</Label>
      <p className={`num mt-1 font-semibold ${big ? "text-[26px] leading-none" : "text-[14px]"}`}>{value}</p>
    </div>
  );
}
