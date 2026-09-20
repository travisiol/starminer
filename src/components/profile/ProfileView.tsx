"use client";

import { useConnection } from "wagmi";
import { brand } from "@/config/brand";
import { CHAIN_NAME, explorer } from "@/config/chains";
import { GAME_ADDRESS } from "@/config/contracts";
import { planetById } from "@/game/config/planets";
import { levelProgress } from "@/game/math/progression";
import { LEVEL_XP } from "@/game/math/tables";
import { Empty, Label, ModeBadge, Stat } from "@/components/ui/atoms";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { fmt, shortAddress, timeAgo } from "@/lib/format";
import { useMounted, useNow } from "@/lib/hooks";
import { useGameStore } from "@/store/gameStore";

/** PROFILE — commander level and XP (read from the contract), recent activity, wallet, settings. */
export function ProfileView() {
  const mounted = useMounted();
  const address = useGameStore((s) => s.address);
  const hydrated = useGameStore((s) => s.hydrated);
  const balance = useGameStore((s) => s.balance);
  const progress = useGameStore((s) => s.progress);
  const activity = useGameStore((s) => s.activity);
  const settings = useGameStore((s) => s.settings);
  const setSettings = useGameStore((s) => s.setSettings);
  const { isConnected } = useConnection();
  const now = useNow();
  const lp = levelProgress(progress.xp);

  return (
    <div className="container-x pt-20 pb-28 md:pb-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Label>Commander</Label>
          <h1 className="display gradient-text mt-1 text-[36px] md:text-[48px]">{mounted && isConnected && address ? shortAddress(address) : "PROFILE"}</h1>
        </div>
        <div className="flex items-center gap-3">
          <ModeBadge />
          <ConnectButton size="md" />
        </div>
      </header>

      {!address ? (
        <div className="mt-8">
          <Empty title="Connect your wallet" body={`Your level, XP and ships live in the game contract on ${CHAIN_NAME}. Connect to see them.`} action={<ConnectButton size="md" />} />
        </div>
      ) : null}

      <section className="panel mt-8 p-5 md:p-6">
        <div className="flex flex-wrap items-end gap-8">
          <div>
            <Label>Level</Label>
            <p className="num text-[56px] leading-none font-semibold">{hydrated && address ? progress.level : "—"}</p>
          </div>
          <div className="min-w-[240px] flex-1">
            <div className="flex justify-between text-xs text-muted">
              <span>{fmt(lp.current)} XP</span>
              <span>{lp.needed ? `${fmt(lp.needed)} to level ${progress.level + 1}` : "Max level"}</span>
            </div>
            <div className="meter mt-2">
              <span className="bg-accent" style={{ width: `${Math.round(lp.ratio * 100)}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-dim">
              XP comes from missions: the full planet XP on success, a fifth of it on failure. Each level adds 0.5% Fleet Power (commander bonus). Level 30 at {fmt(LEVEL_XP[29])} XP.
            </p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
          <Stat label="Balance" value={hydrated && address ? fmt(balance) : "—"} unit={brand.token.ticker} size="md" />
          <Stat label="Missions" value={hydrated && address ? fmt(progress.missionsCompleted) : "—"} size="md" sub={hydrated && address ? `${progress.missionsSucceeded} successful` : undefined} />
          <Stat label="Mined" value={hydrated && address ? fmt(progress.totalMined) : "—"} unit={brand.token.ticker} size="md" />
          <Stat label="Furthest world" value={hydrated && address && progress.furthestPlanet ? planetById(progress.furthestPlanet).name.toUpperCase() : "—"} size="md" />
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="panel p-5">
          <Label>Recent activity (this browser)</Label>
          <ul className="mt-3 space-y-2">
            {activity.slice(0, 12).map((e) => (
              <li key={e.id} className="flex items-start gap-2 text-xs">
                <span className={`mt-1 dot ${e.kind === "success" ? "text-easy" : e.kind === "failure" ? "text-danger" : e.kind === "purchase" ? "text-accent" : "text-muted"}`} />
                <span className="flex-1 text-muted">{e.text}</span>
                <span className="text-dim">{now ? timeAgo(e.at, now) : ""}</span>
              </li>
            ))}
            {activity.length === 0 ? <li className="text-xs text-dim">Nothing yet. Buy a ship to begin.</li> : null}
          </ul>
        </div>
        <div className="panel p-5">
          <Label>Onchain</Label>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex justify-between gap-3">
              <span className="text-muted">Chain</span>
              <span>{CHAIN_NAME}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-muted">Game contract</span>
              {GAME_ADDRESS ? (
                <a href={explorer.address(GAME_ADDRESS)} target="_blank" rel="noreferrer" className="mono text-xs hover:text-accent">
                  {shortAddress(GAME_ADDRESS)} ↗
                </a>
              ) : (
                <span className="text-dim">not configured</span>
              )}
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-muted">Your wallet</span>
              {address ? (
                <a href={explorer.address(address)} target="_blank" rel="noreferrer" className="mono text-xs hover:text-accent">
                  {shortAddress(address)} ↗
                </a>
              ) : (
                <span className="text-dim">—</span>
              )}
            </li>
          </ul>
          <p className="mt-4 text-[11px] leading-relaxed text-dim">Ships, fleet, missions, listings and XP are all state of the game contract. This site only reads it and asks your wallet to sign.</p>
        </div>
      </section>

      <section className="panel mt-6 p-5">
        <Label>Settings</Label>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" className={`btn btn-ghost btn-sm ${settings.audio ? "border-accent/50 text-accent" : ""}`} onClick={() => setSettings({ audio: !settings.audio })}>
            Audio {settings.audio ? "on" : "muted"}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSettings({ quality: settings.quality === "auto" ? "low" : settings.quality === "low" ? "high" : "auto" })}>
            3D quality · {settings.quality}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSettings({ introSeen: false })}>
            Replay intro
          </button>
        </div>
        <p className="mt-3 text-[11px] text-dim">Audio is muted by default. Quality auto lowers 3D detail on phones.</p>
      </section>
    </div>
  );
}
