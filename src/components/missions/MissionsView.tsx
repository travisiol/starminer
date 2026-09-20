"use client";

import Link from "next/link";
import { brand } from "@/config/brand";
import { ECONOMY } from "@/game/config/economy";
import { planetById } from "@/game/config/planets";
import { MARK_LABEL, shipById } from "@/game/config/ships";
import { probabilityPercent, riskBand } from "@/game/math/miningProbability";
import { shipPower } from "@/game/math/fleet";
import { DifficultyTag, Empty, Label, ModeBadge, ProbabilityMeter } from "@/components/ui/atoms";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { countdown, duration, fmt, padId, range, timeAgo } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { useGameStore } from "@/store/gameStore";
import { ResolutionModal } from "./ResolutionModal";

const ABORT_GRACE_MS = 2 * 24 * 3600 * 1000;

/** MISSIONS — the live expedition with its timer, then the onchain log of every settled one. */
export function MissionsView() {
  const address = useGameStore((s) => s.address);
  const hydrated = useGameStore((s) => s.hydrated);
  const mission = useGameStore((s) => s.activeMission);
  const history = useGameStore((s) => s.history);
  const ships = useGameStore((s) => s.ships);
  const tx = useGameStore((s) => s.tx);
  const lastReport = useGameStore((s) => s.lastReport);
  const resolve = useGameStore((s) => s.resolveActiveMission);
  const abort = useGameStore((s) => s.abortMission);
  const dismissReport = useGameStore((s) => s.dismissReport);
  const selectPlanet = useGameStore((s) => s.selectPlanet);
  const now = useNow();

  const planet = mission ? planetById(mission.planetId) : null;
  const left = mission ? mission.endsAt - now : 0;
  const due = Boolean(mission && now > 0 && left <= 0);
  const elapsed = mission ? Math.min(1, (now - mission.startedAt) / (mission.endsAt - mission.startedAt || 1)) : 0;
  const busy = Boolean(tx && (tx.stage === "awaiting-signature" || tx.stage === "pending" || tx.stage === "confirmed"));
  const abortable = Boolean(mission && mission.status === "in-progress" && now > mission.endsAt + ABORT_GRACE_MS);

  return (
    <div className="container-x pt-20 pb-28 md:pb-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Label>Missions</Label>
          <h1 className="display gradient-text mt-1 text-[36px] md:text-[48px]">EXPEDITIONS</h1>
        </div>
        <ModeBadge />
      </header>

      {!address ? (
        <div className="mt-8">
          <Empty title="Connect your wallet" body="Expeditions belong to a wallet. Connect to see the one in flight and the log of the ones you settled." action={<ConnectButton size="md" />} />
        </div>
      ) : !hydrated ? null : mission && planet ? (
        <section className="panel mt-8 p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className={`dot ${due || mission.status === "resolved" ? "text-gold" : "text-accent animate-pulse-soft"}`} />
                <Label>{mission.status === "resolved" ? "Mission resolved" : due ? "Extraction complete — settle to see the report" : "Mining in progress"}</Label>
              </div>
              <h2 className="display mt-1 text-[30px] uppercase md:text-[40px]">Mining {planet.name}</h2>
              <div className="mt-2 flex items-center gap-2">
                <DifficultyTag difficulty={planet.difficulty} />
                <Label>Planet {padId(planet.id)}</Label>
              </div>
            </div>
            <div className="text-right">
              <Label>{due ? "Complete" : "Remaining"}</Label>
              <p className="num text-[44px] leading-none font-semibold md:text-[56px]">{due ? "00:00" : now ? countdown(left) : "--:--"}</p>
              <p className="mt-1 text-xs text-muted">of {duration(mission.duration)}</p>
            </div>
          </div>

          <div className="meter mt-5">
            <span className="bg-accent" style={{ width: `${Math.round(elapsed * 100)}%` }} />
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label>Fleet Power</Label>
              <p className="num text-2xl font-semibold">{fmt(mission.fleetPower)}</p>
            </div>
            <div>
              <Label>Success probability</Label>
              <p className="num text-2xl font-semibold">{probabilityPercent(mission.probability)}%</p>
              <ProbabilityMeter probability={mission.probability} band={riskBand(mission.probability)} className="mt-2" />
            </div>
            <div>
              <Label>Potential reward</Label>
              <p className="num text-2xl font-semibold">{range(mission.potentialReward)}</p>
              <p className="text-xs text-muted">{brand.token.ticker}</p>
            </div>
            <div>
              <Label>Ships</Label>
              <ul className="mt-1 space-y-0.5 text-sm">
                {mission.shipIds.map((id) => {
                  const s = ships.find((x) => x.instanceId === id);
                  if (!s) return <li key={id} className="text-muted">Ship #{id}</li>;
                  const hull = shipById(s.hullId);
                  return (
                    <li key={id} className="flex justify-between gap-3">
                      <span className="display-wide text-[11px]">
                        {hull.name} <span className="text-dim">{MARK_LABEL[s.mark]}</span>
                      </span>
                      <span className="num text-muted">{fmt(shipPower(s))}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {due || mission.status === "resolved" ? (
              <button type="button" className="btn btn-primary" onClick={() => void resolve()} disabled={busy}>
                {busy ? "Settling…" : mission.status === "resolved" ? "Claim" : "Resolve & claim"}
              </button>
            ) : (
              <Link href="/system" className="btn btn-ghost" onClick={() => selectPlanet(planet.id)}>
                Watch in the system
              </Link>
            )}
            {abortable ? (
              <button type="button" className="btn btn-danger" onClick={() => void abort()} disabled={busy}>
                Abort (no reveal after 2 days)
              </button>
            ) : null}
          </div>
          <p className="mt-3 text-[11px] text-dim">Settling reveals the server seed onchain; the contract mixes it with the launch block and pays from the vault in the same transaction.</p>
        </section>
      ) : (
        <div className="mt-8">
          <Empty
            title="No active expedition"
            body="Pick a planet, check your odds, and launch. One fleet, one mission at a time."
            action={
              <Link href="/" className="btn btn-primary btn-sm">
                Choose a planet
              </Link>
            }
          />
        </div>
      )}

      <section className="mt-10">
        <h2 className="display-wide text-xs">Mission log {hydrated && address ? `· ${history.length}` : ""}</h2>
        {!address ? null : hydrated && history.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No missions settled yet.</p>
        ) : (
          <div className="panel mt-3 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="label px-4 py-3 font-normal">Planet</th>
                  <th className="label px-4 py-3 font-normal">Result</th>
                  <th className="label px-4 py-3 text-right font-normal">Power</th>
                  <th className="label hidden px-4 py-3 text-right font-normal sm:table-cell">Chance</th>
                  <th className="label px-4 py-3 text-right font-normal">Reward</th>
                  <th className="label hidden px-4 py-3 text-right font-normal md:table-cell">When</th>
                </tr>
              </thead>
              <tbody>
                {history.map((m) => {
                  const p = planetById(m.planetId);
                  const o = m.outcome;
                  return (
                    <tr key={m.id} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-3">
                        <span className="display-wide text-[11px]">{p.name}</span>
                        <span className="ml-2 text-xs text-dim">{padId(p.id)}</span>
                      </td>
                      <td className={`px-4 py-3 label-strong ${!o ? "text-dim" : o.success ? "text-easy" : "text-danger"}`}>{!o ? "Aborted" : o.success ? "Success" : "Failed"}</td>
                      <td className="num px-4 py-3 text-right">{fmt(m.fleetPower)}</td>
                      <td className="num hidden px-4 py-3 text-right sm:table-cell">{probabilityPercent(m.probability)}%</td>
                      <td className="num px-4 py-3 text-right">
                        {o?.success ? `+${fmt(o.reward)}` : "0"}
                        {o?.rareDrop ? <span className="ml-1 text-gold" title={o.rareDrop}>★</span> : null}
                      </td>
                      <td className="hidden px-4 py-3 text-right text-muted md:table-cell">{now ? timeAgo(m.endsAt, now) : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-dim">
          Rewards are paid from the vault in {ECONOMY.token.ticker}; the log is read from the contract, newest first (last 25).
        </p>
      </section>

      <ResolutionModal mission={lastReport} open={Boolean(lastReport)} onClaim={dismissReport} onClose={dismissReport} />
    </div>
  );
}
