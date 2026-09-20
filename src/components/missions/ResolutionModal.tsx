"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { brand } from "@/config/brand";
import { planetById } from "@/game/config/planets";
import { probabilityPercent } from "@/game/math/miningProbability";
import { describeSource } from "@/game/random/RandomProvider";
import type { Mission } from "@/game/types";
import { Label } from "@/components/ui/atoms";
import { fmt } from "@/lib/format";
import { easeOutExpo } from "@/lib/motion";

interface Props {
  mission: Mission | null;
  open: boolean;
  onClaim: () => void;
  onClose: () => void;
}

/** MISSION SUCCESSFUL / MISSION FAILED. Success pulses once; failure turns the frame red, briefly. No explosions. */
export function ResolutionModal({ mission, open, onClaim, onClose }: Props) {
  const o = mission?.outcome ?? null;
  const planet = mission ? planetById(mission.planetId) : null;
  return (
    <AnimatePresence>
      {open && mission && o && planet ? (
        <motion.div className="fixed inset-0 z-[105] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label="Mission report">
          <motion.div
            className={`glass-strong relative w-full max-w-md overflow-hidden p-6 ${o.success ? "" : "border-danger/50"}`}
            initial={{ y: 18, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ duration: 0.45, ease: easeOutExpo }}
          >
            {o.success ? (
              <motion.span className="pointer-events-none absolute inset-0 bg-accent/20" initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 1.4, ease: "easeOut" }} />
            ) : (
              <motion.span className="pointer-events-none absolute inset-0 bg-danger/25" initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 1.2, ease: "easeOut" }} />
            )}
            <div className="relative">
              <Label>
                Planet {planet.id.toString().padStart(2, "0")} · {planet.name}
              </Label>
              <h2 className={`display mt-1.5 text-[30px] ${o.success ? "" : "text-danger"}`}>{o.success ? "MISSION SUCCESSFUL" : "MISSION FAILED"}</h2>
              <p className="mt-1 text-sm text-muted">{o.success ? "Resource extraction complete." : "Extraction unsuccessful. The fleet returned."}</p>

              <div className="mt-5 grid grid-cols-2 gap-4">
                <Field label="Reward" value={o.success ? `+${fmt(o.reward)} ${brand.token.ticker}` : `0 ${brand.token.ticker}`} strong />
                <Field label="Rare resource" value={o.rareDrop ?? "None"} sub={o.rareDrop ? `+${fmt(o.rareBonus)} ${brand.token.ticker} included` : undefined} />
                <Field label="Fleet status" value="Operational" />
                <Field label="XP" value={`+${fmt(o.xp)}`} />
                <Field label="Fleet Power" value={fmt(mission.fleetPower)} />
                <Field label="Success chance" value={`${probabilityPercent(mission.probability)}%`} />
              </div>

              <p className="mt-4 text-[11px] leading-relaxed text-dim">
                Roll {o.roll.toFixed(4)} vs {mission.probability.toFixed(4)} · {describeSource(o.randomSource as "local-crypto")}
              </p>

              <div className="mt-5 flex flex-col gap-2">
                {o.success ? (
                  <button type="button" className="btn btn-primary w-full" onClick={onClaim}>
                    Claim reward
                  </button>
                ) : (
                  <button type="button" className="btn btn-ghost w-full" onClick={onClaim}>
                    Return to system
                  </button>
                )}
                {o.success ? (
                  <Link href="/market" className="btn btn-ghost w-full" onClick={onClaim}>
                    Buy a stronger ship
                  </Link>
                ) : (
                  <Link href="/fleet" className="btn btn-ghost w-full" onClick={onClaim}>
                    Rebuild the fleet
                  </Link>
                )}
                <button type="button" className="label self-center py-1 hover:text-text" onClick={onClose}>
                  Close for now
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Field({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div>
      <Label>{label}</Label>
      <p className={`num mt-1 font-semibold ${strong ? "text-[26px] leading-none" : "text-[15px]"}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-muted">{sub}</p> : null}
    </div>
  );
}
