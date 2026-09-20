"use client";

import Link from "next/link";
import { useMemo } from "react";
import { brand } from "@/config/brand";
import { CHAIN_NAME, explorer } from "@/config/chains";
import { GAME_ADDRESS, TOKEN_ADDRESS, missingConfig } from "@/config/contracts";
import { ECONOMY } from "@/game/config/economy";
import { planetById } from "@/game/config/planets";
import { Label, ModeBadge, Stat } from "@/components/ui/atoms";
import { fmt, shortAddress } from "@/lib/format";
import { useGameStore } from "@/store/gameStore";

/** ECONOMY — the reward vault, the sinks and the contract-wide numbers, all read from the game contract. */
export function EconomyView() {
  const address = useGameStore((s) => s.address);
  const hydrated = useGameStore((s) => s.hydrated);
  const deployed = useGameStore((s) => s.deployed);
  const vault = useGameStore((s) => s.vault);
  const stats = useGameStore((s) => s.stats);
  const progress = useGameStore((s) => s.progress);
  const history = useGameStore((s) => s.history);

  const mostMined = useMemo(() => {
    const counts = new Map<number, number>();
    for (const m of history) counts.set(m.planetId, (counts.get(m.planetId) ?? 0) + 1);
    let best: number | null = null;
    for (const [id, n] of counts) if (best === null || n > (counts.get(best) ?? 0)) best = id;
    return best;
  }, [history]);
  const successRate = progress.missionsCompleted ? progress.missionsSucceeded / progress.missionsCompleted : null;
  const missing = missingConfig();

  return (
    <div className="container-x pt-20 pb-28 md:pb-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Label>Economy</Label>
          <h1 className="display gradient-text mt-1 text-[36px] md:text-[48px]">REWARD VAULT</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Mining rewards are paid from a finite vault held by the game contract. Ship purchases and refits route {Math.round(ECONOMY.vaultShareOfSpend * 100)}% of every spend into it, player sales {(ECONOMY.marketFeeBps / 100).toFixed(1)}%. The UI never implies infinite rewards.
          </p>
        </div>
        <ModeBadge />
      </header>

      {!deployed ? (
        <div className="panel mt-6 p-5">
          <p className="display-wide text-xs">Game contract not live yet</p>
          <p className="mt-2 text-sm text-muted">
            {missing.length > 0 ? `Missing configuration: ${missing.join(", ")}.` : `No code at ${GAME_ADDRESS} yet.`}{" "}
            <Link href="/deploy" className="underline">
              Operator checklist
            </Link>
            . Nothing is fabricated in the meantime.
          </p>
        </div>
      ) : null}

      <section className="panel mt-8 grid gap-6 p-5 sm:grid-cols-3 md:p-6">
        <Stat label="Available" value={hydrated && deployed ? fmt(vault.available) : "—"} unit={brand.token.ticker} size="xl" />
        <Stat label="Distributed through mining" value={hydrated && deployed ? fmt(vault.distributed) : "—"} unit={brand.token.ticker} size="xl" />
        <Stat label="Missions paid" value={hydrated && deployed ? fmt(vault.missionsCompleted) : "—"} size="xl" />
        <p className="text-xs text-muted sm:col-span-3">
          Read from the contract{GAME_ADDRESS ? " " : ""}
          {GAME_ADDRESS ? (
            <a href={explorer.address(GAME_ADDRESS)} target="_blank" rel="noreferrer" className="mono underline">
              {shortAddress(GAME_ADDRESS)}
            </a>
          ) : null}{" "}
          on {CHAIN_NAME}. Token {TOKEN_ADDRESS ? <span className="mono">{shortAddress(TOKEN_ADDRESS)}</span> : "not set"}.
        </p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="panel p-5">
          <Label>Game-wide</Label>
          <div className="mt-4 grid grid-cols-2 gap-5">
            <Stat label="Total ships purchased" value={deployed ? fmt(stats.shipsPurchased) : "—"} size="md" />
            <Stat label="Tokens spent on ships" value={deployed ? fmt(stats.tokensSpentOnShips) : "—"} unit={brand.token.ticker} size="md" />
            <Stat label="Tokens spent on refits" value={deployed ? fmt(stats.tokensSpentOnRefits) : "—"} unit={brand.token.ticker} size="md" />
            <Stat label="Player market volume" value={deployed ? fmt(stats.marketVolume) : "—"} unit={brand.token.ticker} size="md" />
            <Stat label="Missions launched" value={deployed ? fmt(stats.missionsLaunched) : "—"} size="md" />
            <Stat label="Tokens distributed" value={deployed ? fmt(vault.distributed) : "—"} unit={brand.token.ticker} size="md" />
          </div>
        </div>
        <div className="panel p-5">
          <Label>Your account</Label>
          {!address ? (
            <p className="mt-3 text-sm text-muted">Connect a wallet to see your own numbers.</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-5">
              <Stat label="Missions" value={hydrated ? fmt(progress.missionsCompleted) : "—"} size="md" />
              <Stat label="Mined" value={hydrated ? fmt(progress.totalMined) : "—"} unit={brand.token.ticker} size="md" />
              <Stat label="Success rate" value={successRate === null ? "—" : `${(successRate * 100).toFixed(1)}%`} size="md" />
              <Stat label="Most mined planet" value={mostMined ? planetById(mostMined).name.toUpperCase() : "—"} size="md" />
            </div>
          )}
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="panel p-5">
          <Label>Token utility and sinks</Label>
          <ul className="mt-3 divide-y divide-line">
            {ECONOMY.sinks.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-4 py-2.5">
                <div>
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="text-xs text-muted">{s.note}</p>
                </div>
                <span className={`chip shrink-0 ${s.active ? "text-easy" : "text-dim"}`}>{s.active ? "Active" : "Planned"}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel p-5">
          <Label>How rewards work</Label>
          <ol className="mt-3 space-y-2 text-sm text-muted">
            <li>1. A mission succeeds or fails on the chance stored at launch, from a server-committed seed revealed after it ends.</li>
            <li>2. Success draws a reward from the planet range, times fleet traits, in the same transaction.</li>
            <li>3. The reward is paid from the vault. If the vault is thin, it pays what it has.</li>
            <li>4. Failure pays nothing and destroys nothing.</li>
          </ol>
          <p className="mt-4 text-[11px] leading-relaxed text-dim">Ships are gameplay assets. Rewards depend on mission success, planet difficulty, the reward configuration and the available reward pool. {brand.name} makes no promise of any return.</p>
        </div>
      </section>
    </div>
  );
}
