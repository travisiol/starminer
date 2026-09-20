"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { formatUnits } from "viem";
import { brand } from "@/config/brand";
import { TOKEN_DECIMALS } from "@/config/contracts";
import { BLOCK_TIME_MS, readActivity, readCommanders, type ActivityRow, type CommanderRow } from "@/game/chain/client";
import { hullByIndex } from "@/game/chain/gameConfig";
import { planetById } from "@/game/config/planets";
import { Empty, Label, ModeBadge } from "@/components/ui/atoms";
import { compact, fmt, padId, shortAddress } from "@/lib/format";
import { useGameStore } from "@/store/gameStore";

type Category = "fleet" | "miners" | "furthest" | "missions" | "resources";

const CATEGORIES: { id: Category; label: string; metric: string }[] = [
  { id: "fleet", label: "Strongest Fleet", metric: "Fleet Power" },
  { id: "miners", label: "Top Miners", metric: "Success rate" },
  { id: "furthest", label: "Furthest Planet", metric: "Furthest world" },
  { id: "missions", label: "Missions Completed", metric: "Missions" },
  { id: "resources", label: "Total Resources Mined", metric: "Mined" },
];

const tokens = (wei: bigint) => Number(formatUnits(wei, TOKEN_DECIMALS));
const rate = (c: CommanderRow) => (c.missionsCompleted ? c.missionsSucceeded / c.missionsCompleted : 0);

function rank(category: Category, rows: CommanderRow[]): CommanderRow[] {
  const key: Record<Category, (c: CommanderRow) => number> = {
    fleet: (c) => c.fleetPower,
    miners: (c) => (c.missionsCompleted >= 3 ? rate(c) * 1000 : rate(c) * 100) + c.missionsCompleted / 1000,
    furthest: (c) => c.furthestPlanet * 100_000 + c.fleetPower,
    missions: (c) => c.missionsCompleted,
    resources: (c) => tokens(c.totalMined),
  };
  return [...rows].sort((a, b) => key[category](b) - key[category](a));
}

function describe(row: ActivityRow): string {
  const who = shortAddress(row.who);
  switch (row.kind) {
    case "purchase":
      return `${who} purchased ${row.hull !== undefined ? hullByIndex(row.hull)?.name ?? "a hull" : "a hull"}`;
    case "success":
      return `${who} extracted ${fmt(tokens(row.amount ?? 0n))} ${brand.token.ticker}`;
    case "failure":
      return `${who}'s mining attempt failed`;
    case "sale":
      return `${who} bought a hull on the player market for ${fmt(tokens(row.amount ?? 0n))} ${brand.token.ticker}`;
    case "launch":
      return `${who} launched an expedition to ${row.planet ? planetById(row.planet).name.toUpperCase() : "a world"}`;
  }
}

/** LEADERBOARD — every commander the contract knows, ranked five ways, plus the recent onchain activity. */
export function LeaderboardView() {
  const [cat, setCat] = useState<Category>("fleet");
  const address = useGameStore((s) => s.address);
  const deployed = useGameStore((s) => s.deployed);

  const commanders = useQuery({ queryKey: ["commanders"], queryFn: () => readCommanders(), enabled: deployed, refetchInterval: 30_000 });
  const activity = useQuery({ queryKey: ["activity"], queryFn: () => readActivity(), enabled: deployed, refetchInterval: 30_000 });

  const rows = useMemo(() => rank(cat, commanders.data ?? []), [cat, commanders.data]);
  const metric = (c: CommanderRow) =>
    ({
      fleet: fmt(c.fleetPower),
      miners: `${(rate(c) * 100).toFixed(1)}%`,
      furthest: c.furthestPlanet ? `${padId(c.furthestPlanet)} ${planetById(c.furthestPlanet).name.toUpperCase()}` : "—",
      missions: fmt(c.missionsCompleted),
      resources: `${compact(tokens(c.totalMined))} ${brand.token.ticker}`,
    })[cat];

  return (
    <div className="container-x pt-20 pb-28 md:pb-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Label>Leaderboard</Label>
          <h1 className="display gradient-text mt-1 text-[36px] md:text-[48px]">COMMANDERS</h1>
        </div>
        <ModeBadge />
      </header>

      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => (
          <button key={c.id} type="button" className={`chip ${cat === c.id ? "border-text text-text" : "hover:text-text"}`} onClick={() => setCat(c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      {!deployed ? (
        <div className="mt-6">
          <Empty title="No game contract yet" body="The leaderboard reads every commander from the game contract. It fills up the moment the contract is live." />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="panel overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="label w-12 px-4 py-3 font-normal">#</th>
                  <th className="label px-4 py-3 font-normal">Commander</th>
                  <th className="label px-4 py-3 text-right font-normal">{CATEGORIES.find((c) => c.id === cat)?.metric}</th>
                  <th className="label hidden px-4 py-3 text-right font-normal sm:table-cell">Fleet Power</th>
                  <th className="label hidden px-4 py-3 text-right font-normal md:table-cell">Level</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((c, i) => {
                  const isYou = address ? c.address.toLowerCase() === address.toLowerCase() : false;
                  return (
                    <tr key={c.address} className={`border-b border-line/60 last:border-0 ${isYou ? "bg-accent/5" : ""}`}>
                      <td className="num px-4 py-3 text-muted">{i + 1}</td>
                      <td className="px-4 py-3">
                        <span className={`mono text-[12px] ${isYou ? "text-accent" : ""}`}>{isYou ? "YOU" : shortAddress(c.address)}</span>
                      </td>
                      <td className="num px-4 py-3 text-right font-semibold">{metric(c)}</td>
                      <td className="num hidden px-4 py-3 text-right text-muted sm:table-cell">{fmt(c.fleetPower)}</td>
                      <td className="num hidden px-4 py-3 text-right text-muted md:table-cell">{c.level}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted">
                      {commanders.isLoading ? "Reading the contract…" : "No commander yet. The first ship bought puts its owner here."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <aside className="panel p-4">
            <Label>Activity · last {(40_000n * BigInt(BLOCK_TIME_MS)) / 60_000n / 1000n < 1n ? "hour" : "hours"}</Label>
            <ul className="mt-3 space-y-2.5">
              {(activity.data?.rows ?? []).map((e) => {
                const ago = Number(activity.data!.latest - e.blockNumber) * BLOCK_TIME_MS;
                const label = ago < 60_000 ? "just now" : ago < 3_600_000 ? `≈ ${Math.round(ago / 60_000)}m ago` : `≈ ${Math.round(ago / 3_600_000)}h ago`;
                return (
                  <li key={e.id} className="flex items-start gap-2 text-xs">
                    <span className={`mt-1 dot ${e.kind === "success" ? "text-easy" : e.kind === "failure" ? "text-danger" : e.kind === "purchase" || e.kind === "sale" ? "text-accent" : "text-muted"}`} />
                    <span className="flex-1 text-muted">{describe(e)}</span>
                    <span className="text-dim">{label}</span>
                  </li>
                );
              })}
              {activity.data && activity.data.rows.length === 0 ? <li className="text-xs text-dim">Nothing yet.</li> : null}
              {activity.isLoading ? <li className="text-xs text-dim">Reading recent blocks…</li> : null}
            </ul>
          </aside>
        </div>
      )}
    </div>
  );
}
