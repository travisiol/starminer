"use client";

import { Maximize2 } from "lucide-react";
import Link from "next/link";
import { brand } from "@/config/brand";
import { planetById } from "@/game/config/planets";
import { ZONES } from "@/game/config/zones";
import type { MissionPlan } from "@/game/engine/mission";
import { probabilityPercent, riskBand } from "@/game/math/miningProbability";
import type { FleetSummary, Mission } from "@/game/types";
import { DifficultyTag, Label, ModeBadge, ProbabilityMeter } from "@/components/ui/atoms";
import { countdown, fmt, padId, range } from "@/lib/format";

/* ------------------------------------------------------------------ */
/*  Everything drawn over the solar system: fleet card (bottom-left),   */
/*  active mission (bottom-right), hover tooltip, zone legend.          */
/* ------------------------------------------------------------------ */

export function FleetCard({ fleet, frontier, hydrated }: { fleet: FleetSummary; frontier: number; hydrated: boolean }) {
  return (
    <div className="glass pointer-events-auto w-[calc(100vw-1.5rem)] max-w-[300px] p-4 md:w-[280px]">
      <div className="flex items-center justify-between">
        <Label>Your fleet</Label>
        <ModeBadge />
      </div>
      <div className="mt-2 flex items-end gap-5">
        <div>
          <Label>Power</Label>
          <p className="num text-[30px] leading-none font-semibold">{hydrated ? fmt(fleet.totalPower) : "—"}</p>
        </div>
        <div>
          <Label>Ships</Label>
          <p className="num text-[30px] leading-none font-semibold">
            {hydrated ? fleet.ships.length : "—"}
            <span className="text-base text-muted"> / 3</span>
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div>
          <Label>Frontier</Label>
          <p className="mt-0.5 text-sm font-medium">{hydrated ? `${padId(frontier)} · ${planetById(frontier).name.toUpperCase()}` : "—"}</p>
        </div>
        <Link href={fleet.ships.length === 0 ? "/market" : "/fleet"} className="btn btn-ghost btn-xs">
          {fleet.ships.length === 0 ? "Buy a ship" : "Fleet"}
        </Link>
      </div>
    </div>
  );
}

/** The active expedition: countdown while flying, one button once it is due (reveal + settle in one transaction). */
export function MissionCard({ mission, now, onView, onResolve, busy }: { mission: Mission | null; now: number; onView: () => void; onResolve: () => void; busy?: boolean }) {
  if (!mission) {
    return (
      <div className="glass pointer-events-auto w-[calc(100vw-1.5rem)] max-w-[300px] p-4 md:w-[280px]">
        <Label>Active mission</Label>
        <p className="display-wide mt-2 text-xs text-muted">No active expedition</p>
        <p className="mt-1 text-xs text-dim">Select a planet to check your odds.</p>
      </div>
    );
  }
  const planet = planetById(mission.planetId);
  const left = mission.endsAt - now;
  const due = now > 0 && left <= 0;
  const resolved = mission.status === "resolved";
  return (
    <div className="glass pointer-events-auto w-[calc(100vw-1.5rem)] max-w-[300px] p-4 md:w-[280px]">
      <div className="flex items-center justify-between">
        <Label>{resolved ? "Mission resolved" : due ? "Extraction complete" : "Mining in progress"}</Label>
        <span className={`dot ${resolved || due ? "text-gold" : "text-accent animate-pulse-soft"}`} />
      </div>
      <p className="display mt-1 text-xl uppercase">{planet.name}</p>
      {resolved || due ? (
        <button type="button" className="btn btn-primary btn-sm mt-3 w-full" onClick={onResolve} disabled={busy}>
          {busy ? "Settling…" : resolved ? "Claim" : "Resolve & claim"}
        </button>
      ) : (
        <>
          <p className="num mt-2 text-[30px] leading-none font-semibold">{now ? countdown(left) : "--:--"}</p>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-muted">Power {fmt(mission.fleetPower)}</span>
            <span className="text-muted">Chance {probabilityPercent(mission.probability)}%</span>
          </div>
          <ProbabilityMeter probability={mission.probability} band={riskBand(mission.probability)} className="mt-2" />
          <button type="button" className="btn btn-ghost btn-xs mt-3 w-full" onClick={onView}>
            Mission details
          </button>
        </>
      )}
    </div>
  );
}

export function PlanetTooltip({ plan, named }: { plan: MissionPlan | null; named: boolean }) {
  if (!plan) return null;
  const p = plan.planet;
  return (
    <div className="glass pointer-events-none absolute top-20 left-1/2 z-[25] w-[240px] -translate-x-1/2 p-3 md:top-auto md:bottom-32 md:left-6 md:translate-x-0">
      <div className="flex items-center justify-between">
        <span className="display-wide text-xs">{named ? p.name : "Unknown world"}</span>
        <Label>Planet {padId(p.id)}</Label>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <DifficultyTag difficulty={p.difficulty} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <span className="text-muted">Recommended</span>
        <span className="num text-right">{fmt(p.recommendedPower)}</span>
        <span className="text-muted">Your power</span>
        <span className="num text-right">{fmt(plan.fleetPower)}</span>
        <span className="text-muted">Success</span>
        <span className={`num text-right ${plan.probability === 0 ? "text-dim" : ""}`}>{plan.probability > 0 ? `${probabilityPercent(plan.probability)}%` : "—"}</span>
        <span className="text-muted">Reward</span>
        <span className="num text-right">
          {range(plan.potentialReward)} {brand.token.ticker}
        </span>
      </div>
    </div>
  );
}

export function ZoneLegend({ frontier, onFocus }: { frontier: number; onFocus: (zone: number | null) => void }) {
  const frontierZone = Math.ceil(frontier / 5);
  return (
    <div className="glass pointer-events-auto hidden w-[210px] p-3 md:block">
      <div className="flex items-center justify-between">
        <Label>Zones</Label>
        <button type="button" className="label flex items-center gap-1 hover:text-text" onClick={() => onFocus(null)} title="Fit the whole system">
          <Maximize2 size={11} /> Fit
        </button>
      </div>
      <ul className="mt-2 space-y-0.5">
        {ZONES.map((z) => {
          const reached = z.id <= frontierZone;
          return (
            <li key={z.id}>
              <button type="button" onClick={() => onFocus(z.id)} className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left transition hover:bg-white/[0.05] ${reached ? "text-text" : "text-dim"}`}>
                <span className="label-strong text-[10px] tracking-[0.1em]" style={{ color: "inherit" }}>
                  {z.id} · {z.name}
                </span>
                <span className="label text-[9px]">
                  {padId(z.planets[0])}–{padId(z.planets[1])}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
