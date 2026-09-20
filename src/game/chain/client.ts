import { createPublicClient, erc20Abi, getAbiItem, http, type Address, type Log } from "viem";
import { BROWSER_RPC_URL, gameChain, isBrowser, RPC_URL } from "@/config/chains";
import { GAME_ADDRESS, TOKEN_ADDRESS } from "@/config/contracts";
import { STARMINER_GAME_ABI } from "@/lib/abi/starminerGame";

/* ------------------------------------------------------------------ */
/*  Reads from the game contract. One multicall per refresh.           */
/* ------------------------------------------------------------------ */

export const publicClient = createPublicClient({ chain: gameChain, transport: http(isBrowser() ? BROWSER_RPC_URL : RPC_URL, { batch: true }) });

export function gameContract() {
  if (!GAME_ADDRESS) throw new Error("Game address not configured");
  return { address: GAME_ADDRESS, abi: STARMINER_GAME_ABI } as const;
}

export interface OnchainShip {
  id: bigint;
  owner: Address;
  hull: number;
  mark: number;
  listed: boolean;
}
export interface OnchainMission {
  id: bigint;
  player: Address;
  planet: number;
  status: number; // 0 none, 1 active, 2 resolved, 3 claimed, 4 aborted
  success: boolean;
  rare: boolean;
  probabilityBps: number;
  rewardMultBps: number;
  rareMultBps: number;
  fleetPower: number;
  startedAt: bigint;
  endsAt: bigint;
  reward: bigint;
  rareBonus: bigint;
  ships: readonly [bigint, bigint, bigint];
}
export interface OnchainListing {
  id: bigint;
  shipId: bigint;
  seller: Address;
  buyer: Address;
  price: bigint;
  listedAt: bigint;
  status: number; // 1 open, 2 sold, 3 cancelled
  hull: number;
  mark: number;
}
export interface OnchainPlayer {
  xp: number;
  missionsCompleted: number;
  missionsSucceeded: number;
  furthestPlanet: number;
  nonce: number;
  totalMined: bigint;
  activeMission: bigint;
}
export interface GameStats {
  purchased: bigint;
  spentOnShips: bigint;
  spentOnRefits: bigint;
  volume: bigint;
  missions: bigint;
  available: bigint;
  distributed: bigint;
  paid: bigint;
}
export interface Snapshot {
  at: number;
  address: Address | null;
  deployed: boolean;
  balance: bigint;
  allowance: bigint;
  player: OnchainPlayer | null;
  ships: OnchainShip[];
  fleet: readonly [bigint, bigint, bigint];
  mission: OnchainMission | null;
  history: OnchainMission[];
  openListings: OnchainListing[];
  stats: GameStats | null;
  /** Successful extractions per planet id. */
  successes: Record<number, number>;
}

type MissionStruct = { player: Address; planet: number; status: number; success: boolean; rare: boolean; probabilityBps: number; rewardMultBps: number; rareMultBps: number; fleetPower: number; startedAt: bigint; endsAt: bigint; reward: bigint; rareBonus: bigint; commit: `0x${string}`; entropy: `0x${string}`; ships: readonly [bigint, bigint, bigint] };

const toMission = (id: bigint, m: MissionStruct): OnchainMission => ({
  id,
  player: m.player,
  planet: m.planet,
  status: m.status,
  success: m.success,
  rare: m.rare,
  probabilityBps: m.probabilityBps,
  rewardMultBps: m.rewardMultBps,
  rareMultBps: m.rareMultBps,
  fleetPower: m.fleetPower,
  startedAt: m.startedAt,
  endsAt: m.endsAt,
  reward: m.reward,
  rareBonus: m.rareBonus,
  ships: m.ships,
});

let deployedCache: { address: Address; ok: boolean; at: number } | null = null;

/** Whether code exists at the game address. A positive answer is cached; a negative one is retried every 15 s. */
export async function isDeployed(): Promise<boolean> {
  if (!GAME_ADDRESS) return false;
  if (deployedCache && deployedCache.address === GAME_ADDRESS && (deployedCache.ok || Date.now() - deployedCache.at < 15_000)) return deployedCache.ok;
  const code = await publicClient.getCode({ address: GAME_ADDRESS });
  const ok = Boolean(code && code !== "0x");
  deployedCache = { address: GAME_ADDRESS, ok, at: Date.now() };
  return ok;
}

const EMPTY = (address: Address | null, deployed: boolean): Snapshot => ({
  at: Date.now(),
  address,
  deployed,
  balance: 0n,
  allowance: 0n,
  player: null,
  ships: [],
  fleet: [0n, 0n, 0n],
  mission: null,
  history: [],
  openListings: [],
  stats: null,
  successes: {},
});

const PLANET_IDS = Array.from({ length: 30 }, (_, i) => i + 1);

export async function readSnapshot(address: Address | null): Promise<Snapshot> {
  const deployed = await isDeployed();
  if (!deployed || !TOKEN_ADDRESS) return EMPTY(address, deployed);
  const g = gameContract();

  const base = await publicClient.multicall({
    allowFailure: false,
    contracts: [
      { ...g, functionName: "stats" },
      { ...g, functionName: "openListings" },
    ],
  });
  const st = base[0];
  const stats: GameStats = { purchased: st[0], spentOnShips: st[1], spentOnRefits: st[2], volume: st[3], missions: st[4], available: st[5], distributed: st[6], paid: st[7] };
  const [lIds, lData] = base[1];
  // Each listing carries its hull and mark so the market can show other commanders' ships.
  const listedShips = lIds.length
    ? await publicClient.multicall({ allowFailure: false, contracts: lData.map((l) => ({ ...g, functionName: "ship" as const, args: [l.shipId] as const })) })
    : [];
  const openListings: OnchainListing[] = lIds.map((id, i) => {
    const sh = listedShips[i] as { hull: number; mark: number };
    return { id, ...lData[i], hull: sh.hull, mark: sh.mark };
  });

  if (!address) return { ...EMPTY(null, true), stats, openListings };

  const me = await publicClient.multicall({
    allowFailure: false,
    contracts: [
      { address: TOKEN_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [address] },
      { address: TOKEN_ADDRESS, abi: erc20Abi, functionName: "allowance", args: [address, g.address] },
      { ...g, functionName: "playerOf", args: [address] },
      { ...g, functionName: "shipsOf", args: [address] },
      { ...g, functionName: "fleetOf", args: [address] },
      { ...g, functionName: "activeMissionOf", args: [address] },
      { ...g, functionName: "missionIdsOf", args: [address] },
    ],
  });
  // Successes per planet drive the unlock gates; one homogeneous multicall keeps the types simple.
  const succ = await publicClient.multicall({
    allowFailure: false,
    contracts: PLANET_IDS.map((i) => ({ ...g, functionName: "successesOn" as const, args: [address, i] as const })),
  });
  const balance = me[0];
  const allowance = me[1];
  const p = me[2];
  const [sIds, sData] = me[3];
  const fleet = me[4];
  const [mid, mData] = me[5];
  const ids = me[6];
  const successes: Record<number, number> = {};
  PLANET_IDS.forEach((id, k) => {
    const n = Number(succ[k]);
    if (n > 0) successes[id] = n;
  });

  const mission = mid > 0n ? toMission(mid, mData) : null;
  const recent = [...ids].reverse().filter((id) => id !== mid).slice(0, 25);
  const hist = recent.length
    ? await publicClient.multicall({ allowFailure: false, contracts: recent.map((id) => ({ ...g, functionName: "missionOf" as const, args: [id] as const })) })
    : [];
  const history = recent.map((id, i) => toMission(id, hist[i] as MissionStruct));

  return {
    at: Date.now(),
    address,
    deployed: true,
    balance,
    allowance,
    player: { xp: p.xp, missionsCompleted: p.missionsCompleted, missionsSucceeded: p.missionsSucceeded, furthestPlanet: p.furthestPlanet, nonce: p.nonce, totalMined: p.totalMined, activeMission: p.activeMission },
    ships: sIds.map((id, i) => ({ id, ...sData[i] })),
    fleet,
    mission,
    history,
    openListings,
    stats,
    successes,
  };
}

/* ---------------- leaderboard: every commander, read in one multicall ---------------- */

export interface CommanderRow {
  address: Address;
  fleetPower: number;
  level: number;
  xp: number;
  missionsCompleted: number;
  missionsSucceeded: number;
  furthestPlanet: number;
  totalMined: bigint;
}

export async function readCommanders(limit = 400): Promise<CommanderRow[]> {
  if (!(await isDeployed())) return [];
  const g = gameContract();
  const addrs = (await publicClient.readContract({ ...g, functionName: "commanders", args: [0n, BigInt(limit)] })) as readonly Address[];
  if (addrs.length === 0) return [];
  const [players, powers, levels] = await Promise.all([
    publicClient.multicall({ allowFailure: false, contracts: addrs.map((a) => ({ ...g, functionName: "playerOf" as const, args: [a] as const })) }),
    publicClient.multicall({ allowFailure: false, contracts: addrs.map((a) => ({ ...g, functionName: "fleetPower" as const, args: [a] as const })) }),
    publicClient.multicall({ allowFailure: false, contracts: addrs.map((a) => ({ ...g, functionName: "levelOf" as const, args: [a] as const })) }),
  ]);
  return addrs.map((address, i) => {
    const p = players[i];
    return { address, fleetPower: powers[i][1], level: Number(levels[i]), xp: p.xp, missionsCompleted: p.missionsCompleted, missionsSucceeded: p.missionsSucceeded, furthestPlanet: p.furthestPlanet, totalMined: p.totalMined };
  });
}

/* ---------------- activity: recent events ---------------- */

export interface ActivityRow {
  id: string;
  kind: "purchase" | "success" | "failure" | "sale" | "launch";
  who: Address;
  hull?: number;
  planet?: number;
  amount?: bigint;
  blockNumber: bigint;
}

/** Approximate L2 block time, used to turn a block distance into "x min ago". */
export const BLOCK_TIME_MS = 250;

export async function readActivity(window = 40_000n): Promise<{ latest: bigint; rows: ActivityRow[] }> {
  if (!(await isDeployed())) return { latest: 0n, rows: [] };
  const g = gameContract();
  const latest = await publicClient.getBlockNumber();
  const events = [getAbiItem({ abi: STARMINER_GAME_ABI, name: "Purchased" }), getAbiItem({ abi: STARMINER_GAME_ABI, name: "Resolved" }), getAbiItem({ abi: STARMINER_GAME_ABI, name: "Sold" }), getAbiItem({ abi: STARMINER_GAME_ABI, name: "Launched" })];
  const fetch = (span: bigint) => publicClient.getLogs({ address: g.address, events, fromBlock: latest > span ? latest - span : 0n, toBlock: latest });
  let logs: Log[] = [];
  try {
    logs = (await fetch(window)) as Log[];
  } catch {
    try {
      logs = (await fetch(4_000n)) as Log[];
    } catch {
      logs = [];
    }
  }
  const rows: ActivityRow[] = [];
  for (const l of logs as (Log & { eventName: string; args: Record<string, unknown> })[]) {
    const id = `${l.blockNumber}-${l.logIndex}`;
    const a = l.args;
    if (l.eventName === "Purchased") rows.push({ id, kind: "purchase", who: a.player as Address, hull: Number(a.hull), amount: a.price as bigint, blockNumber: l.blockNumber! });
    else if (l.eventName === "Resolved") rows.push({ id, kind: a.success ? "success" : "failure", who: a.player as Address, amount: a.reward as bigint, blockNumber: l.blockNumber! });
    else if (l.eventName === "Sold") rows.push({ id, kind: "sale", who: a.buyer as Address, amount: a.price as bigint, blockNumber: l.blockNumber! });
    else if (l.eventName === "Launched") rows.push({ id, kind: "launch", who: a.player as Address, planet: Number(a.planet), blockNumber: l.blockNumber! });
  }
  rows.sort((x, y) => (x.blockNumber > y.blockNumber ? -1 : 1));
  return { latest, rows: rows.slice(0, 40) };
}
