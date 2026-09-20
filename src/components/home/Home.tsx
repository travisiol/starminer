"use client";

import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, HelpCircle, Lock } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { brand } from "@/config/brand";
import { planetById, PLANETS } from "@/game/config/planets";
import { ZONES } from "@/game/config/zones";
import { probabilityPercent, powerForProbability } from "@/game/math/miningProbability";
import { frontierPlanet } from "@/game/math/progression";
import type { Mission } from "@/game/types";
import { ResolutionModal } from "@/components/missions/ResolutionModal";
import { SceneBoundary } from "@/components/three/SceneBoundary";
import { DifficultyTag, Label, ModeBadge, ProbabilityMeter, RiskTag } from "@/components/ui/atoms";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { countdown, duration, fmt, padId, pct1, range } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { toast } from "@/lib/toast";
import { selectAllPlans, selectFleet, useGameStore } from "@/store/gameStore";
import { IntroModal } from "./IntroModal";

const PlanetStage = dynamic(() => import("./PlanetStage").then((m) => m.PlanetStage), { ssr: false, loading: () => null });

const EXPLAINER = ["30 worlds", "Buy ships → Fleet Power", "Equip 3 ships", "More power = better odds", "Deeper worlds pay more"];

/**
 * HOME — you arrive on a planet. Swipe (or ← →) for the next one. Every number that decides a
 * launch is on this screen; the fleet, hangar and market are one tap away.
 */
export function Home() {
  const address = useGameStore((s) => s.address);
  const hydrated = useGameStore((s) => s.hydrated);
  const ships = useGameStore((s) => s.ships);
  const fleetSlots = useGameStore((s) => s.fleet);
  const progress = useGameStore((s) => s.progress);
  const activeMission = useGameStore((s) => s.activeMission);
  const launchMission = useGameStore((s) => s.launchMission);
  const resolveActiveMission = useGameStore((s) => s.resolveActiveMission);
  const lastReport = useGameStore((s) => s.lastReport);
  const dismissReport = useGameStore((s) => s.dismissReport);
  const tx = useGameStore((s) => s.tx);
  const setSettings = useGameStore((s) => s.setSettings);
  const selectedPlanet = useGameStore((s) => s.selectedPlanet);
  const now = useNow();

  const [index, setIndex] = useState<number | null>(null);
  const [direction, setDirection] = useState<-1 | 0 | 1>(0);
  const strip = useRef<HTMLDivElement>(null);

  const slice = useMemo(() => ({ ships, fleet: fleetSlots, progress, activeMission }), [ships, fleetSlots, progress, activeMission]);
  const plans = useMemo(() => selectAllPlans(slice), [slice]);
  const fleet = useMemo(() => selectFleet(slice), [slice]);
  const frontierIdx = useMemo(() => frontierPlanet(progress).id - 1, [progress]);
  const current = index ?? (selectedPlanet ? selectedPlanet - 1 : hydrated ? frontierIdx : 0);
  const plan = plans[current];
  const planet = plan.planet;
  const zone = ZONES[planet.zone - 1];
  const locked = plan.access.state !== "unlocked";
  const percent = probabilityPercent(plan.probability);
  const mining = activeMission?.status === "in-progress" && activeMission.planetId === planet.id;
  const strongAt = powerForProbability(0.9, planet.minimumPower, planet.recommendedPower);
  const busy = Boolean(tx && tx.stage !== "added" && tx.stage !== "failed");

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(PLANETS.length - 1, next));
      setDirection(clamped > current ? 1 : clamped < current ? -1 : 0);
      setIndex(clamped);
    },
    [current],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(current + 1);
      if (e.key === "ArrowLeft") go(current - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, current]);

  // Keep the current chip in view in the planet strip.
  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>(`[data-index="${current}"]`);
    const box = strip.current;
    if (!el || !box) return;
    box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
  }, [current]);

  const launch = async () => {
    const m = await launchMission(planet.id);
    if (m) toast({ kind: "info", title: `Expedition launched to ${planet.name}`, body: "Engines lit. The fleet is on its way." });
  };

  const hint = !address
    ? "Connect a wallet to see your odds: your fleet lives in the game contract."
    : fleet.ships.length === 0
      ? "Equip at least one ship to see your odds here."
      : plan.probability === 0
        ? `Below minimum power by ${fmt(plan.powerShortfall)}. Bring at least ${fmt(planet.minimumPower)} Fleet Power.`
        : plan.probability < 0.9
          ? `About ${fmt(strongAt)} Fleet Power would put this at 90%. Odds never exceed 99%.`
          : "Odds never exceed 99% — a mission can still fail. Failure never destroys ships.";

  return (
    <div className="pt-14 pb-24 lg:pb-8">
      {/* The game in one line, always visible */}
      <div className="border-b border-line/70">
        <div className="container-x no-scrollbar flex h-12 items-center gap-2 overflow-x-auto">
          {EXPLAINER.map((t, i) => (
            <span key={t} className="chip shrink-0 text-text">
              <span className="text-accent">{padId(i + 1)}</span>
              {t}
            </span>
          ))}
          <Link href="/how-it-works" className="chip shrink-0 hover:text-text">
            <HelpCircle size={11} /> How it works
          </Link>
          <button type="button" className="chip shrink-0 hover:text-text" onClick={() => setSettings({ introSeen: false })}>
            Replay intro
          </button>
        </div>
      </div>

      <section className="container-x grid gap-5 pt-5 lg:grid-cols-[1.2fr_1fr]">
        {/* Stage — swipe or drag horizontally */}
        <motion.div
          className="relative h-[46svh] min-h-[320px] touch-pan-y overflow-hidden rounded-3xl border border-accent/20 bg-void lg:h-[calc(100svh-3.5rem-3rem-2.5rem-4.5rem)] lg:min-h-[520px]"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          dragSnapToOrigin
          onDragEnd={(_, info) => {
            if (info.offset.x < -60 || info.velocity.x < -400) go(current + 1);
            else if (info.offset.x > 60 || info.velocity.x > 400) go(current - 1);
          }}
        >
          <SceneBoundary fallback={<div className="label absolute inset-0 flex items-center justify-center text-muted">3D unavailable</div>}>
            <PlanetStage planet={planet} dim={locked ? 0.35 : 0} direction={direction} mining={Boolean(mining)} />
          </SceneBoundary>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4 md:p-5">
            <div>
              <p className="label">Planet</p>
              <p className="num display glow-text text-[56px] leading-none md:text-[72px]">{padId(planet.id)}</p>
            </div>
            <div className="text-right">
              <p className="label">Zone {zone.id}</p>
              <p className="display-wide text-[11px]">{zone.name}</p>
            </div>
          </div>
          <button type="button" aria-label="Previous planet" className="btn btn-ghost absolute top-1/2 left-3 h-11 w-11 -translate-y-1/2 p-0" onClick={() => go(current - 1)} disabled={current === 0}>
            <ChevronLeft size={18} />
          </button>
          <button type="button" aria-label="Next planet" className="btn btn-ghost absolute top-1/2 right-3 h-11 w-11 -translate-y-1/2 p-0" onClick={() => go(current + 1)} disabled={current === PLANETS.length - 1}>
            <ChevronRight size={18} />
          </button>
          <p className="label pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-[9.5px] text-dim">
            Swipe or use ← → · {padId(current + 1)} / {PLANETS.length}
          </p>
        </motion.div>

        {/* Info */}
        <div className="flex flex-col gap-4">
          <div className="panel flex-1 p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <Label>{planet.kind}</Label>
              <ModeBadge />
            </div>
            <h1 className="display gradient-text mt-1 text-[40px] uppercase md:text-[52px]">{planet.name}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <DifficultyTag difficulty={planet.difficulty} />
              {plan.probability > 0 ? <RiskTag band={plan.band} /> : null}
              {locked ? (
                <span className="chip">
                  <Lock size={11} /> Locked
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">{planet.description}</p>

            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
              <Field label="Minimum power" value={fmt(planet.minimumPower)} />
              <Field label="Recommended" value={fmt(planet.recommendedPower)} />
              <Field label="Your fleet" value={fmt(plan.fleetPower)} tone={plan.powerShortfall > 0 ? "danger" : "text"} />
              <Field label="Mission time" value={duration(planet.missionDuration)} />
              <Field label="Reward" value={`${range(plan.potentialReward)} ${brand.token.ticker}`} />
              <Field label="Rare drop" value={pct1(plan.rareDropChance)} sub={planet.rareResource} />
            </div>

            <div className="mt-5 rounded-xl border border-accent/25 bg-accent/5 p-4">
              <div className="flex items-end justify-between">
                <Label>Success chance</Label>
                <span className={`num text-[40px] leading-none font-semibold ${plan.probability === 0 ? "text-dim" : plan.band === "risky" ? "diff-extreme" : plan.band === "fair" ? "diff-hard" : "glow-text"}`}>
                  {plan.probability > 0 ? `${percent}%` : "—"}
                </span>
              </div>
              <ProbabilityMeter probability={plan.probability} band={plan.band} className="mt-3" />
              <p className="mt-2 text-xs text-muted">{hint}</p>
            </div>

            {locked ? (
              <ul className="mt-4 space-y-1 text-xs text-muted">
                {plan.access.missing.map((m) => (
                  <li key={m} className="flex items-center gap-2">
                    <Lock size={11} /> {m}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              {!address ? (
                <ConnectButton size="md" />
              ) : (
                <button type="button" className="btn btn-primary flex-1" disabled={Boolean(plan.blocked) || busy} onClick={() => void launch()} title={plan.blocked ?? undefined}>
                  {fleet.ships.length === 0 ? "Equip a ship first" : busy ? "Waiting for wallet…" : `Mine ${planet.name}`}
                </button>
              )}
              <Link href={fleet.ships.length === 0 ? "/market" : "/fleet"} className="btn btn-ghost flex-1">
                {fleet.ships.length === 0 ? "Buy your first ship" : "Change fleet"}
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="panel p-4">
              <Label>Your fleet</Label>
              <div className="mt-2 flex items-end gap-5">
                <div>
                  <Label>Power</Label>
                  <p className="num text-[28px] leading-none font-semibold">{hydrated && address ? fmt(fleet.totalPower) : "—"}</p>
                </div>
                <div>
                  <Label>Ships</Label>
                  <p className="num text-[28px] leading-none font-semibold">
                    {hydrated && address ? fleet.ships.length : "—"}
                    <span className="text-base text-muted"> / 3</span>
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Link href="/hangar" className="btn btn-ghost btn-xs">
                  Hangar
                </Link>
                <Link href="/market" className="btn btn-ghost btn-xs">
                  Market
                </Link>
              </div>
            </div>
            <MissionMini mission={activeMission} now={now} busy={busy} onResolve={() => void resolveActiveMission()} onGo={(id) => go(id - 1)} />
          </div>
        </div>
      </section>

      {/* Planet strip */}
      <div className="container-x mt-5">
        <div ref={strip} className="no-scrollbar flex gap-2 overflow-x-auto pb-2">
          {plans.map((p, i) => {
            const st = p.access.state;
            return (
              <button key={p.planet.id} type="button" data-index={i} onClick={() => go(i)} className={`chip shrink-0 ${i === current ? "halo border-accent text-text" : st === "unlocked" ? "text-text" : ""}`}>
                {padId(p.planet.id)} {p.planet.name}
              </button>
            );
          })}
        </div>
      </div>

      <IntroModal />
      <ResolutionModal mission={lastReport} open={Boolean(lastReport)} onClaim={dismissReport} onClose={dismissReport} />
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

function MissionMini({ mission, now, busy, onResolve, onGo }: { mission: Mission | null; now: number; busy: boolean; onResolve: () => void; onGo: (planetId: number) => void }) {
  if (!mission) {
    return (
      <div className="panel p-4">
        <Label>Active mission</Label>
        <p className="display-wide mt-2 text-xs text-muted">No active expedition</p>
        <p className="mt-1 text-xs text-dim">Pick a world, check the odds, launch.</p>
      </div>
    );
  }
  const planet = planetById(mission.planetId);
  const due = now > 0 && now >= mission.endsAt;
  const resolved = mission.status === "resolved";
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <Label>{resolved ? "Mission resolved" : due ? "Extraction complete" : "Mining in progress"}</Label>
        <span className={`dot ${resolved || due ? "text-gold" : "text-accent animate-pulse-soft"}`} />
      </div>
      <button type="button" className="display mt-1 text-left text-xl uppercase hover:text-accent" onClick={() => onGo(planet.id)}>
        {planet.name}
      </button>
      {resolved || due ? (
        <button type="button" className="btn btn-primary btn-sm mt-3 w-full" onClick={onResolve} disabled={busy}>
          {busy ? "Settling…" : resolved ? "Claim" : "Resolve & claim"}
        </button>
      ) : (
        <>
          <p className="num mt-1 text-[26px] leading-none font-semibold">{now ? countdown(mission.endsAt - now) : "--:--"}</p>
          <Link href="/missions" className="btn btn-ghost btn-xs mt-3">
            Details
          </Link>
        </>
      )}
    </div>
  );
}
