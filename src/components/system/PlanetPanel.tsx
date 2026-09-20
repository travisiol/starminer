"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Lock, ScanSearch, X } from "lucide-react";
import Link from "next/link";
import { DEMO_TIME_SCALE, isDemo } from "@/config/mode";
import { DIFFICULTY_LABEL } from "@/game/config/planets";
import { ZONES } from "@/game/config/zones";
import type { MissionPlan } from "@/game/engine/mission";
import { probabilityPercent, powerForProbability } from "@/game/math/miningProbability";
import type { PlanetProgress } from "@/game/types";
import { DifficultyTag, Label, ProbabilityMeter, RiskTag } from "@/components/ui/atoms";
import { brand } from "@/config/brand";
import { duration, fmt, padId, pct1, range } from "@/lib/format";
import { easeOutExpo } from "@/lib/motion";

interface Props {
  plan: MissionPlan | null;
  named: boolean;
  progress: PlanetProgress | undefined;
  onClose: () => void;
  onLaunch: () => void;
  launching: boolean;
}

/**
 * PLANET DETAIL — every number the player needs before committing a fleet:
 * requirement, their power, the odds, the time, the reward. Never hides the probability.
 */
export function PlanetPanel({ plan, named, progress, onClose, onLaunch, launching }: Props) {
  return (
    <AnimatePresence>
      {plan ? (
        <motion.aside
          key={plan.planet.id}
          className="glass-strong scroll-thin pointer-events-auto absolute inset-x-3 bottom-[5.5rem] z-[30] max-h-[68svh] overflow-y-auto p-5 md:inset-x-auto md:top-20 md:right-5 md:bottom-auto md:max-h-[calc(100svh-7rem)] md:w-[380px]"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.4, ease: easeOutExpo }}
          aria-label="Planet detail"
        >
          <button type="button" aria-label="Close" onClick={onClose} className="absolute top-4 right-4 rounded-md p-1 text-muted transition hover:text-text">
            <X size={16} />
          </button>
          {named ? <Known plan={plan} progress={progress} onLaunch={onLaunch} launching={launching} /> : <Unknown plan={plan} />}
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

function Known({ plan, progress, onLaunch, launching }: { plan: MissionPlan; progress: PlanetProgress | undefined; onLaunch: () => void; launching: boolean }) {
  const p = plan.planet;
  const zone = ZONES[p.zone - 1];
  const percent = probabilityPercent(plan.probability);
  const locked = plan.access.state !== "unlocked";
  const missions = (progress?.successes ?? 0) + (progress?.failures ?? 0);
  const successRate = missions ? (progress!.successes / missions) * 100 : null;
  const strongAt = powerForProbability(0.9, p.minimumPower, p.recommendedPower);

  return (
    <div>
      <div className="flex items-center gap-2">
        <Label>Planet {padId(p.id)}</Label>
        <span className="label text-dim">·</span>
        <Label>
          Zone {zone.id} · {zone.name}
        </Label>
      </div>
      <h2 className="display mt-1.5 text-[34px] uppercase">{p.name}</h2>
      <p className="mt-1 text-sm text-muted">{p.kind}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <DifficultyTag difficulty={p.difficulty} />
        {plan.probability > 0 ? <RiskTag band={plan.band} /> : null}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">{p.description}</p>

      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
        <Field label="Minimum Fleet Power" value={fmt(p.minimumPower)} />
        <Field label="Recommended" value={fmt(p.recommendedPower)} />
        <Field label="Your Fleet" value={fmt(plan.fleetPower)} tone={plan.powerShortfall > 0 ? "danger" : "text"} />
        <Field label="Mission Duration" value={duration(p.missionDuration)} sub={isDemo && DEMO_TIME_SCALE > 1 ? `Demo: ${duration(plan.duration)}` : undefined} />
        <Field label="Potential Mining Reward" value={`${range(plan.potentialReward)} ${brand.token.ticker}`} />
        <Field label="Rare Drop Chance" value={pct1(plan.rareDropChance)} sub={p.rareResource} />
      </div>

      <div className="mt-5 rounded-md border border-line bg-white/[0.02] p-4">
        <div className="flex items-end justify-between">
          <Label>Estimated success</Label>
          <span className={`num text-[36px] leading-none font-semibold ${plan.probability === 0 ? "text-dim" : plan.band === "risky" ? "diff-extreme" : plan.band === "fair" ? "diff-hard" : "text-text"}`}>
            {plan.probability > 0 ? `${percent}%` : "—"}
          </span>
        </div>
        <ProbabilityMeter probability={plan.probability} band={plan.band} className="mt-3" />
        <p className="mt-2 text-xs text-muted">
          {plan.probability === 0 ? (
            <>
              Below minimum power by <span className="text-text">{fmt(plan.powerShortfall)}</span>. Bring at least {fmt(p.minimumPower)} Fleet Power.
            </>
          ) : plan.probability < 0.9 ? (
            <>
              About <span className="text-text">{fmt(strongAt)}</span> Fleet Power would put this at 90%. Odds never exceed 99%.
            </>
          ) : (
            <>Odds never exceed 99% — even here, a mission can fail. Failure never destroys ships.</>
          )}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Your missions here" value={fmt(missions)} />
        <Field label="Your success rate" value={successRate === null ? "—" : `${successRate.toFixed(1)}%`} />
      </div>

      {locked ? (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-line p-3 text-xs text-muted">
          <Lock size={14} className="mt-0.5 shrink-0" />
          <div>
            <p className="label-strong">Locked</p>
            <ul className="mt-1 space-y-0.5">
              {plan.access.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-2">
        <button type="button" className="btn btn-primary w-full" disabled={Boolean(plan.blocked) || launching} onClick={onLaunch} title={plan.blocked ?? undefined}>
          {launching ? "Launching…" : plan.blocked && !locked && plan.powerShortfall === 0 ? plan.blocked : `Mine ${p.name}`}
        </button>
        <Link href="/fleet" className="btn btn-ghost w-full">
          Change fleet
        </Link>
      </div>
    </div>
  );
}

function Unknown({ plan }: { plan: MissionPlan }) {
  const p = plan.planet;
  const zone = ZONES[p.zone - 1];
  return (
    <div>
      <div className="flex items-center gap-2">
        <Label>Planet {padId(p.id)}</Label>
        <span className="label text-dim">·</span>
        <Label>
          Zone {zone.id} · {zone.name}
        </Label>
      </div>
      <h2 className="display mt-1.5 text-[34px] uppercase text-muted">Unknown world</h2>
      <div className="mt-3 flex items-center gap-2">
        <span className="chip">
          <ScanSearch size={11} /> Scan pending
        </span>
        <span className="chip text-dim">{DIFFICULTY_LABEL[p.difficulty]} BAND</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4">
        <Field label="Required Power" value="???" />
        <Field label="Reward" value="???" />
        <Field label="Mission Duration" value="???" />
        <Field label="Rare Drop" value="???" />
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted">Unlock the previous world to complete the scan. The name, power requirement and reward are revealed when the scan finishes.</p>
      <div className="mt-4 rounded-md border border-line p-3 text-xs text-muted">
        <p className="label-strong">Still blocking</p>
        <ul className="mt-1 space-y-0.5">
          {plan.access.missing.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Field({ label, value, sub, tone = "text" }: { label: string; value: string; sub?: string; tone?: "text" | "danger" }) {
  return (
    <div>
      <Label>{label}</Label>
      <p className={`num mt-1 text-[15px] font-semibold ${tone === "danger" ? "text-danger" : ""}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-muted">{sub}</p> : null}
    </div>
  );
}
