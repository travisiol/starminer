"use client";

import { ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { brand } from "@/config/brand";
import { PLANETS } from "@/game/config/planets";
import { shipById } from "@/game/config/ships";
import type { MissionPlan } from "@/game/engine/mission";
import { probabilityPercent } from "@/game/math/miningProbability";
import { DifficultyTag, Empty, Label, ModeBadge, ProbabilityMeter, RiskTag } from "@/components/ui/atoms";
import { ShipCard } from "@/components/ships/ShipCard";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { duration, fmt, padId, range } from "@/lib/format";
import { toast } from "@/lib/toast";
import { selectAllPlans, selectFleet, useGameStore } from "@/store/gameStore";

/**
 * FLEET BUILDER — three slots, drag owned hulls in (or tap a slot, then a hull),
 * and watch TOTAL FLEET POWER and every planet's odds update. Each change is one transaction.
 */
export function FleetBuilder() {
  const address = useGameStore((s) => s.address);
  const hydrated = useGameStore((s) => s.hydrated);
  const ships = useGameStore((s) => s.ships);
  const fleetSlots = useGameStore((s) => s.fleet);
  const progress = useGameStore((s) => s.progress);
  const activeMission = useGameStore((s) => s.activeMission);
  const tx = useGameStore((s) => s.tx);
  const setSlot = useGameStore((s) => s.setSlot);
  const unequip = useGameStore((s) => s.unequipShip);
  const selectPlanet = useGameStore((s) => s.selectPlanet);
  const [armedSlot, setArmedSlot] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const slice = useMemo(() => ({ ships, fleet: fleetSlots, progress, activeMission }), [ships, fleetSlots, progress, activeMission]);
  const fleet = useMemo(() => selectFleet(slice), [slice]);
  const plans = useMemo(() => selectAllPlans(slice), [slice]);
  const locked = activeMission?.status === "in-progress";
  const busy = Boolean(tx && tx.stage !== "added" && tx.stage !== "failed");

  const reach = useMemo(() => summarizeReach(plans), [plans]);
  const comparison = useMemo(() => plans.filter((p) => p.probability > 0 && p.access.state === "unlocked").slice(-6).reverse(), [plans]);

  const assign = (slot: number, instanceId: string) => {
    if (locked) {
      toast({ kind: "error", title: "Fleet locked", body: "The fleet is on an expedition. Change it when the mission is settled." });
      return;
    }
    setArmedSlot(null);
    void setSlot(slot as 0 | 1 | 2, instanceId);
  };

  const benchShips = ships.filter((s) => !fleetSlots.includes(s.instanceId));

  return (
    <div className="container-x pt-20 pb-28 md:pb-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Label>Fleet builder</Label>
          <h1 className="display gradient-text mt-1 text-[36px] md:text-[48px]">BUILD YOUR FLEET</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">Three slots. Every ship adds its Fleet Power; more power means better odds on every world. Drag a hull into a slot, or tap a slot and then a hull.</p>
        </div>
        <ModeBadge />
      </header>

      {!address ? (
        <div className="mt-6">
          <Empty title="Connect your wallet" body="The fleet is stored in the game contract under your address." action={<ConnectButton size="md" />} />
        </div>
      ) : null}

      {/* Slots */}
      <section className="mt-8 grid gap-3 md:grid-cols-3">
        {[0, 1, 2].map((i) => {
          const id = fleetSlots[i];
          const owned = id ? ships.find((s) => s.instanceId === id) : undefined;
          const hull = owned ? shipById(owned.hullId) : null;
          const armed = armedSlot === i;
          return (
            <div
              key={i}
              className={`relative min-h-[150px] rounded-lg border p-3 transition ${dragOver === i ? "border-accent bg-accent/5" : armed ? "border-accent/60 bg-accent/5" : "border-dashed border-graphite bg-white/[0.01]"}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(i);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const inst = e.dataTransfer.getData("text/starminer-ship");
                if (inst) assign(i, inst);
              }}
            >
              <div className="flex items-center justify-between">
                <Label>Ship 0{i + 1}</Label>
                {hull ? (
                  <button type="button" className="label flex items-center gap-1 hover:text-text" onClick={() => !locked && void unequip(owned!.instanceId)} disabled={locked || busy}>
                    <X size={11} /> Unequip
                  </button>
                ) : (
                  <button type="button" className={`label hover:text-text ${armed ? "text-accent" : ""}`} onClick={() => setArmedSlot(armed ? null : i)}>
                    {armed ? "Pick a hull below" : "Tap to assign"}
                  </button>
                )}
              </div>
              {hull && owned ? (
                <div className="mt-2">
                  <ShipCard hull={hull} owned={owned} compact />
                </div>
              ) : (
                <div className="mt-6 flex flex-col items-center justify-center text-center">
                  <p className="display-wide text-xs text-dim">Empty slot</p>
                  <p className="mt-1 text-[11px] text-dim">Drop a hull here</p>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Totals */}
      <section className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="panel p-5">
          <div className="flex flex-wrap items-end gap-8">
            <div>
              <Label>Total Fleet Power</Label>
              <p className="num glow-text text-[52px] leading-none font-semibold">{hydrated ? fmt(fleet.totalPower) : "—"}</p>
              {fleet.totalPower !== fleet.basePower ? <p className="mt-1 text-xs text-muted">Base {fmt(fleet.basePower)} · bonuses applied</p> : null}
            </div>
            <div>
              <Label>Ships</Label>
              <p className="num text-[32px] leading-none font-semibold">
                {fleet.ships.length}
                <span className="text-lg text-muted"> / 3</span>
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {fleet.bonuses.length === 0 ? <span className="chip">No fleet traits yet</span> : fleet.bonuses.map((b) => <span key={b.id} className="chip text-text" title={b.label}>{b.detail}</span>)}
          </div>
          <p className="mt-3 text-[11px] text-dim">Traits apply once per class in the fleet. Mixing classes stacks them.</p>
        </div>

        <div className="panel p-5">
          <Label>Reachable planets</Label>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <Reach label="Reachable" value={reach.reachable} tone="text-text" />
            <Reach label="Strong chance" value={reach.strong} tone="diff-easy" />
            <Reach label="Risky" value={reach.risky} tone="diff-hard" />
            <Reach label="Locked" value={reach.locked} tone="text-dim" />
          </div>
          <p className="mt-4 text-[11px] text-dim">Strong = 80% or better. Risky = below 80%. Locked = under the minimum power or a progression gate not yet met.</p>
        </div>
      </section>

      {/* Bench */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="display-wide text-xs">Owned ships {hydrated && address ? `· ${ships.length}` : ""}</h2>
          <Link href="/market" className="btn btn-ghost btn-xs">
            Buy ships <ArrowRight size={12} />
          </Link>
        </div>
        {address && hydrated && ships.length === 0 ? (
          <div className="mt-3">
            <Empty
              title="No ships yet"
              body="Every fleet starts with one hull. SCOUT-01 costs 500 and gives 100 Fleet Power — enough for Aera."
              action={
                <Link href="/market" className="btn btn-primary btn-sm">
                  Open the ship market
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {benchShips.map((s) => {
              const hull = shipById(s.hullId);
              return (
                <ShipCard
                  key={s.instanceId}
                  hull={hull}
                  owned={s}
                  compact
                  draggable={!locked && !busy}
                  onDragStart={(e) => e.dataTransfer.setData("text/starminer-ship", s.instanceId)}
                  onClick={armedSlot !== null ? () => assign(armedSlot, s.instanceId) : undefined}
                  selected={armedSlot !== null}
                  footer={
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      disabled={locked || busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        const free = fleetSlots.indexOf(null);
                        assign(armedSlot ?? (free === -1 ? 0 : free), s.instanceId);
                      }}
                    >
                      Equip
                    </button>
                  }
                />
              );
            })}
            {benchShips.length === 0 && ships.length > 0 ? <p className="text-sm text-muted">Every owned hull is in the fleet.</p> : null}
          </div>
        )}
      </section>

      {/* Comparison */}
      <section className="mt-10">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="display-wide text-xs">Planet comparison</h2>
            <p className="mt-1 text-sm text-muted">Safe and near-certain, or risky and rich. The decision is the game.</p>
          </div>
          <Link href="/" className="btn btn-ghost btn-xs">
            Open planets
          </Link>
        </div>
        {comparison.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No reachable world for this fleet yet.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {comparison.map((plan) => (
              <Link key={plan.planet.id} href="/" onClick={() => selectPlanet(plan.planet.id)} className="panel p-4 transition hover:border-accent/40">
                <div className="flex items-center justify-between">
                  <span className="display-wide text-[12px]">{plan.planet.name}</span>
                  <Label>Planet {padId(plan.planet.id)}</Label>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <DifficultyTag difficulty={plan.planet.difficulty} />
                  <RiskTag band={plan.band} />
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <Label>Chance</Label>
                    <p className="num text-[28px] leading-none font-semibold">{probabilityPercent(plan.probability)}%</p>
                  </div>
                  <div className="text-right text-xs text-muted">
                    <p>Power {fmt(plan.planet.recommendedPower)}</p>
                    <p>
                      Reward {range(plan.potentialReward)} {brand.token.ticker}
                    </p>
                    <p>Time {duration(plan.planet.missionDuration)}</p>
                  </div>
                </div>
                <ProbabilityMeter probability={plan.probability} band={plan.band} className="mt-3" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Reach({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <p className={`num mt-1 text-lg font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

/** "01 – 14" style ranges from the plan list. */
function summarizeReach(plans: MissionPlan[]) {
  const reachable = plans.filter((p) => p.probability > 0).map((p) => p.planet.id);
  const strong = plans.filter((p) => p.probability >= 0.8).map((p) => p.planet.id);
  const risky = plans.filter((p) => p.probability > 0 && p.probability < 0.8).map((p) => p.planet.id);
  const lockedIds = plans.filter((p) => p.probability === 0 || p.access.state !== "unlocked").map((p) => p.planet.id);
  const fmtRange = (ids: number[]) => (ids.length === 0 ? "—" : ids.length === 1 ? padId(ids[0]) : `${padId(ids[0])} – ${padId(ids[ids.length - 1])}`);
  return {
    reachable: fmtRange(reachable),
    strong: fmtRange(strong),
    risky: fmtRange(risky),
    locked: lockedIds.length === PLANETS.length ? "01 – 30" : fmtRange(lockedIds),
  };
}
