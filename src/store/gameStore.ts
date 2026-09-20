"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { decodeEventLog, erc20Abi, formatUnits, maxUint256, parseUnits, type Address, type Hex, type TransactionReceipt } from "viem";
import { getWalletClient, waitForTransactionReceipt } from "wagmi/actions";
import { gameChain } from "@/config/chains";
import { GAME_ADDRESS, TOKEN_ADDRESS, TOKEN_DECIMALS } from "@/config/contracts";
import { readSnapshot, type OnchainMission, type Snapshot } from "@/game/chain/client";
import { hullByIndex, hullIndex } from "@/game/chain/gameConfig";
import { ECONOMY } from "@/game/config/economy";
import { planetById, PLANETS } from "@/game/config/planets";
import { shipById } from "@/game/config/ships";
import { planMission, type MissionPlan } from "@/game/engine/mission";
import { BPS, MARK_STEP_BPS, mulBpsRound, refitCost, summarizeFleet } from "@/game/math/fleet";
import { emptyProgress, levelForXp } from "@/game/math/progression";
import { failureXp, rewardRange } from "@/game/math/rewards";
import type { FleetSlots, FleetSummary, Listing, Mark, Mission, OwnedShip, PlayerProgress, RewardVaultState } from "@/game/types";
import { STARMINER_GAME_ABI } from "@/lib/abi/starminerGame";
import { wagmiConfig } from "@/lib/wagmi";

/* ------------------------------------------------------------------ */
/*  The game state is the chain. This store mirrors one player's view  */
/*  of StarminerGame (refreshed every few seconds) and turns actions   */
/*  into wallet transactions. Only display settings live in the        */
/*  browser.                                                           */
/* ------------------------------------------------------------------ */

export type TxStage = "awaiting-signature" | "pending" | "confirmed" | "added" | "failed";
export type TxKind = "purchase" | "refit" | "market" | "launch" | "resolve" | "fleet" | "list" | "approve";

export interface TxFlow {
  kind: TxKind;
  stage: TxStage;
  hullId?: string;
  instanceId?: string;
  targetMark?: Mark;
  hash?: Hex;
  error?: string;
  /** Free text for the overlay, e.g. "Expedition to Kryos". */
  label?: string;
}

export interface ActivityEvent {
  id: string;
  at: number;
  kind: "purchase" | "refit" | "launch" | "success" | "failure" | "unlock" | "level" | "market";
  text: string;
}

export interface GameStats {
  shipsPurchased: number;
  tokensSpentOnShips: number;
  tokensSpentOnRefits: number;
  marketVolume: number;
  missionsLaunched: number;
}

export interface GameState {
  /** Connected wallet, mirrored from wagmi. */
  address: Address | null;
  /** First snapshot loaded (or nothing to load). */
  hydrated: boolean;
  /** Display settings read back from this browser. */
  settingsLoaded: boolean;
  deployed: boolean;
  syncing: boolean;
  lastSync: number;
  syncError: string | null;

  balance: number;
  balanceRaw: bigint;
  allowance: bigint;
  vault: RewardVaultState;
  stats: GameStats;
  ships: OwnedShip[];
  fleet: FleetSlots;
  activeMission: Mission | null;
  history: Mission[];
  progress: PlayerProgress;
  nonce: number;
  /** Open listings across the market (yours included). */
  listings: Listing[];
  /** The last mission this wallet settled, for the report modal. */
  lastReport: Mission | null;
  tx: TxFlow | null;
  activity: ActivityEvent[];
  selectedPlanet: number | null;
  settings: { audio: boolean; quality: "auto" | "high" | "low"; introSeen: boolean };

  // actions
  setAddress: (a: Address | null) => void;
  refresh: () => Promise<void>;
  selectPlanet: (id: number | null) => void;
  buyShip: (hullId: string) => Promise<string | null>;
  refitShip: (instanceId: string) => Promise<boolean>;
  equipShip: (instanceId: string, slot?: 0 | 1 | 2) => Promise<boolean>;
  unequipShip: (instanceId: string) => Promise<void>;
  setSlot: (slot: 0 | 1 | 2, instanceId: string | null) => Promise<void>;
  launchMission: (planetId: number) => Promise<Mission | null>;
  /** Reveal the seed and settle the finished expedition (one transaction). */
  resolveActiveMission: () => Promise<Mission | null>;
  claimMission: () => Promise<void>;
  abortMission: () => Promise<void>;
  listShip: (instanceId: string, price: number) => Promise<Listing | null>;
  cancelListing: (listingId: string) => Promise<boolean>;
  buyListing: (listingId: string) => Promise<string | null>;
  dismissTx: () => void;
  dismissReport: () => void;
  setSettings: (patch: Partial<GameState["settings"]>) => void;
}

const tokens = (wei: bigint): number => Number(formatUnits(wei, TOKEN_DECIMALS));
const toWei = (whole: number): bigint => parseUnits(String(whole), TOKEN_DECIMALS);

const MISSION_STATUS: Record<number, Mission["status"]> = { 1: "in-progress", 2: "resolved", 3: "claimed", 4: "claimed" };

function toMission(m: OnchainMission, roll?: number): Mission {
  const planet = planetById(m.planet);
  const startedAt = Number(m.startedAt) * 1000;
  const endsAt = Number(m.endsAt) * 1000;
  const settled = m.status === 2 || m.status === 3;
  return {
    id: m.id.toString(),
    planetId: m.planet,
    shipIds: m.ships.filter((s) => s > 0n).map((s) => s.toString()),
    fleetPower: m.fleetPower,
    probability: m.probabilityBps / BPS,
    startedAt,
    endsAt,
    duration: Math.round((endsAt - startedAt) / 1000),
    potentialReward: rewardRange(planet, m.rewardMultBps),
    status: MISSION_STATUS[m.status] ?? "claimed",
    outcome: settled
      ? {
          success: m.success,
          reward: tokens(m.reward),
          rareDrop: m.rare ? planet.rareResource : null,
          rareBonus: tokens(m.rareBonus),
          xp: m.success ? planet.xp : failureXp(planet.xp),
          randomSource: "onchain-commit-reveal",
          roll: roll ?? -1,
        }
      : null,
  };
}

function applySnapshot(s: Snapshot): Partial<GameState> {
  const p = s.player;
  const planets: PlayerProgress["planets"] = {};
  for (const [id, n] of Object.entries(s.successes)) planets[Number(id)] = { successes: n, failures: 0, bestReward: 0 };
  const progress: PlayerProgress = p
    ? { xp: p.xp, level: levelForXp(p.xp), missionsCompleted: p.missionsCompleted, missionsSucceeded: p.missionsSucceeded, totalMined: tokens(p.totalMined), furthestPlanet: p.furthestPlanet, planets, milestones: [] }
    : emptyProgress();
  const ships: OwnedShip[] = s.ships.filter((x) => !x.listed).map((x) => ({ instanceId: x.id.toString(), hullId: hullByIndex(x.hull).id, mark: x.mark as Mark, acquiredAt: 0, condition: 100 }));
  const fleet = s.fleet.map((id) => (id > 0n ? id.toString() : null)) as FleetSlots;
  const listings: Listing[] = s.openListings.map((l) => {
    const mine = s.address && l.seller.toLowerCase() === s.address.toLowerCase();
    return {
      id: l.id.toString(),
      hullId: hullByIndex(l.hull).id,
      mark: l.mark as Mark,
      price: tokens(l.price),
      seller: mine ? "YOU" : `${l.seller.slice(0, 6)}…${l.seller.slice(-4)}`,
      sellerAddress: mine ? "you" : l.seller,
      listedAt: Number(l.listedAt) * 1000,
      instanceId: l.shipId.toString(),
      status: "open",
    };
  });
  const st = s.stats;
  return {
    hydrated: true,
    deployed: s.deployed,
    lastSync: s.at,
    syncError: null,
    balance: tokens(s.balance),
    balanceRaw: s.balance,
    allowance: s.allowance,
    vault: st ? { available: tokens(st.available), distributed: tokens(st.distributed), missionsCompleted: Number(st.paid) } : { available: 0, distributed: 0, missionsCompleted: 0 },
    stats: st
      ? { shipsPurchased: Number(st.purchased), tokensSpentOnShips: tokens(st.spentOnShips), tokensSpentOnRefits: tokens(st.spentOnRefits), marketVolume: tokens(st.volume), missionsLaunched: Number(st.missions) }
      : { shipsPurchased: 0, tokensSpentOnShips: 0, tokensSpentOnRefits: 0, marketVolume: 0, missionsLaunched: 0 },
    ships,
    fleet,
    activeMission: s.mission ? toMission(s.mission) : null,
    history: s.history.map((m) => toMission(m)),
    progress,
    nonce: p?.nonce ?? 0,
    listings,
  };
}

/* ------------------------------------------------------------------ */
/*  Selectors (pure, safe to call in render).                          */
/* ------------------------------------------------------------------ */

export const selectFleetShips = (s: Pick<GameState, "ships" | "fleet">): OwnedShip[] =>
  s.fleet.map((id) => (id ? s.ships.find((x) => x.instanceId === id) : undefined)).filter((x): x is OwnedShip => Boolean(x));

export const selectFleet = (s: Pick<GameState, "ships" | "fleet" | "progress">): FleetSummary => summarizeFleet(selectFleetShips(s), s.progress.level);

export const selectPlan = (s: Pick<GameState, "ships" | "fleet" | "progress" | "activeMission">, planetId: number): MissionPlan =>
  planMission(planetById(planetId), selectFleet(s), s.progress, 1, s.activeMission);

export const selectAllPlans = (s: Pick<GameState, "ships" | "fleet" | "progress" | "activeMission">): MissionPlan[] => {
  const fleet = selectFleet(s);
  return PLANETS.map((p) => planMission(p, fleet, s.progress, 1, s.activeMission));
};

export const selectMarketListings = (s: Pick<GameState, "listings">): Listing[] => s.listings.filter((l) => l.status === "open");

/** What a hull is worth on the player market at its mark — the reference next to every ask. */
export const hullValue = (hullId: string, mark: Mark): number => mulBpsRound(shipById(hullId).price, BPS + MARK_STEP_BPS * (mark - 1));

/* ------------------------------------------------------------------ */

const shortError = (e: unknown): string => {
  const msg = (e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error)?.message ?? "Transaction failed";
  const m = /reason:\s*([^\n]+)/i.exec(msg) ?? /reverted with reason string '([^']+)'/i.exec(msg);
  const reason = m?.[1]?.trim();
  const named: Record<string, string> = {
    level: "Your commander level is too low for this hull.",
    active: "An expedition is already in progress.",
    locked: "This world is still locked.",
    power: "Fleet Power is below the planet's minimum.",
    fleet: "Equip at least one ship first.",
    mission: "The fleet is frozen while an expedition is out.",
    listed: "That ship is listed on the market.",
    early: "The mission has not finished yet.",
    seed: "The randomness server returned a seed that does not match.",
    sig: "The randomness server's signature was refused.",
    own: "You cannot buy your own listing.",
    status: "That mission or listing is not in the right state.",
    "on mission": "That ship is out on an expedition.",
  };
  if (reason && named[reason]) return named[reason];
  return msg.split("\n")[0].slice(0, 180);
};

function pushActivity(list: ActivityEvent[], kind: ActivityEvent["kind"], text: string): ActivityEvent[] {
  return [{ id: `${Date.now()}-${list.length}`, at: Date.now(), kind, text }, ...list].slice(0, 40);
}

async function randomServer(action: "commit" | "reveal", params: Record<string, string>): Promise<Record<string, string>> {
  const q = new URLSearchParams({ action, ...params });
  const res = await fetch(`/api/random?${q}`, { cache: "no-store" });
  const body = (await res.json()) as Record<string, string> & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Randomness server error (${res.status})`);
  return body;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => {
      const game = () => {
        if (!GAME_ADDRESS) throw new Error("Game contract not configured");
        return { address: GAME_ADDRESS, abi: STARMINER_GAME_ABI } as const;
      };

      /** One wallet transaction with the four visible stages; refreshes the snapshot when mined. */
      async function send(flow: Omit<TxFlow, "stage">, run: (client: Awaited<ReturnType<typeof getWalletClient>>) => Promise<Hex>): Promise<TransactionReceipt | null> {
        set({ tx: { ...flow, stage: "awaiting-signature" } });
        try {
          const client = await getWalletClient(wagmiConfig);
          const hash = await run(client);
          set({ tx: { ...flow, stage: "pending", hash } });
          const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });
          if (receipt.status !== "success") throw new Error("Transaction reverted");
          set({ tx: { ...flow, stage: "confirmed", hash } });
          await get().refresh();
          set({ tx: { ...flow, stage: "added", hash } });
          return receipt;
        } catch (e) {
          set({ tx: { ...flow, stage: "failed", error: shortError(e) } });
          return null;
        }
      }

      /** Approve the game once (unlimited) when the allowance cannot cover `amount`. */
      async function ensureAllowance(amount: bigint, flow: Omit<TxFlow, "stage">): Promise<boolean> {
        if (get().allowance >= amount) return true;
        if (!TOKEN_ADDRESS) return false;
        const r = await send({ ...flow, kind: "approve", label: `Approve ${ECONOMY.token.ticker} spending` }, (client) =>
          client.writeContract({ address: TOKEN_ADDRESS!, abi: erc20Abi, functionName: "approve", args: [GAME_ADDRESS!, maxUint256], chain: gameChain, account: client.account }),
        );
        return Boolean(r);
      }

      return {
        address: null,
        hydrated: false,
        settingsLoaded: false,
        deployed: false,
        syncing: false,
        lastSync: 0,
        syncError: null,
        balance: 0,
        balanceRaw: 0n,
        allowance: 0n,
        vault: { available: 0, distributed: 0, missionsCompleted: 0 },
        stats: { shipsPurchased: 0, tokensSpentOnShips: 0, tokensSpentOnRefits: 0, marketVolume: 0, missionsLaunched: 0 },
        ships: [],
        fleet: [null, null, null],
        activeMission: null,
        history: [],
        progress: emptyProgress(),
        nonce: 0,
        listings: [],
        lastReport: null,
        tx: null,
        activity: [],
        selectedPlanet: null,
        settings: { audio: false, quality: "auto", introSeen: false },

        setAddress: (a) => {
          if (get().address === a) return;
          set({ address: a, hydrated: false, ships: [], fleet: [null, null, null], activeMission: null, history: [], progress: emptyProgress(), balance: 0, balanceRaw: 0n, allowance: 0n });
          void get().refresh();
        },

        refresh: async () => {
          if (get().syncing) return;
          set({ syncing: true });
          try {
            const snap = await readSnapshot(get().address);
            set(applySnapshot(snap));
          } catch (e) {
            set({ hydrated: true, syncError: (e as Error).message?.split("\n")[0] ?? "Could not read the chain" });
          } finally {
            set({ syncing: false });
          }
        },

        selectPlanet: (id) => set({ selectedPlanet: id }),

        buyShip: async (hullId) => {
          const hull = shipById(hullId);
          const idx = hullIndex(hullId);
          const price = toWei(hull.price);
          const flow = { kind: "purchase" as const, hullId, label: hull.name };
          if (get().progress.level < hull.levelRequired) {
            set({ tx: { ...flow, stage: "failed", error: `Requires commander level ${hull.levelRequired}.` } });
            return null;
          }
          if (get().balanceRaw < price) {
            set({ tx: { ...flow, stage: "failed", error: `Not enough ${ECONOMY.token.ticker}. Price ${hull.price.toLocaleString("en-US")}.` } });
            return null;
          }
          if (!(await ensureAllowance(price, flow))) return null;
          const receipt = await send(flow, (client) => client.writeContract({ ...game(), functionName: "buyHull", args: [idx], chain: gameChain, account: client.account }));
          if (!receipt) return null;
          let shipId: string | null = null;
          for (const log of receipt.logs) {
            try {
              const ev = decodeEventLog({ abi: STARMINER_GAME_ABI, data: log.data, topics: log.topics });
              if (ev.eventName === "Purchased") shipId = (ev.args as { shipId: bigint }).shipId.toString();
            } catch {
              /* other contracts' logs */
            }
          }
          set((s) => ({ activity: pushActivity(s.activity, "purchase", `Purchased ${hull.name}`), tx: s.tx ? { ...s.tx, instanceId: shipId ?? undefined } : s.tx }));
          return shipId;
        },

        refitShip: async (instanceId) => {
          const ship = get().ships.find((x) => x.instanceId === instanceId);
          if (!ship) return false;
          const cost = refitCost(ship.hullId, ship.mark);
          if (cost === null) return false;
          const hull = shipById(ship.hullId);
          const targetMark = (ship.mark + 1) as Mark;
          const flow = { kind: "refit" as const, hullId: ship.hullId, instanceId, targetMark, label: hull.name };
          if (get().balanceRaw < toWei(cost)) {
            set({ tx: { ...flow, stage: "failed", error: `Not enough ${ECONOMY.token.ticker}. Refit costs ${cost.toLocaleString("en-US")}.` } });
            return false;
          }
          if (!(await ensureAllowance(toWei(cost), flow))) return false;
          const r = await send(flow, (client) => client.writeContract({ ...game(), functionName: "refit", args: [BigInt(instanceId)], chain: gameChain, account: client.account }));
          if (r) set((s) => ({ activity: pushActivity(s.activity, "refit", `Refitted ${hull.name} to MK-${["I", "II", "III", "IV", "V"][targetMark - 1]}`) }));
          return Boolean(r);
        },

        equipShip: async (instanceId, slot) => {
          const s = get();
          if (s.activeMission?.status === "in-progress") return false;
          if (!s.ships.some((x) => x.instanceId === instanceId)) return false;
          const already = s.fleet.indexOf(instanceId);
          if (already !== -1 && slot === undefined) return true;
          const target = slot ?? s.fleet.indexOf(null);
          if (target === -1) return false;
          const r = await send({ kind: "fleet", instanceId, label: "Equip ship" }, (client) => client.writeContract({ ...game(), functionName: "equip", args: [target, BigInt(instanceId)], chain: gameChain, account: client.account }));
          return Boolean(r);
        },

        unequipShip: async (instanceId) => {
          const s = get();
          if (s.activeMission?.status === "in-progress") return;
          const slot = s.fleet.indexOf(instanceId);
          if (slot === -1) return;
          await send({ kind: "fleet", instanceId, label: "Unequip ship" }, (client) => client.writeContract({ ...game(), functionName: "unequip", args: [slot], chain: gameChain, account: client.account }));
        },

        setSlot: async (slot, instanceId) => {
          if (instanceId === null) {
            const current = get().fleet[slot];
            if (current) await get().unequipShip(current);
            return;
          }
          await get().equipShip(instanceId, slot);
        },

        launchMission: async (planetId) => {
          const s = get();
          const plan = selectPlan(s, planetId);
          const planet = planetById(planetId);
          const flow = { kind: "launch" as const, label: `Expedition to ${planet.name}` };
          if (plan.blocked) {
            set({ tx: { ...flow, stage: "failed", error: plan.blocked } });
            return null;
          }
          if (!s.address) return null;
          set({ tx: { ...flow, stage: "awaiting-signature" } });
          let commit: Hex;
          let signature: Hex;
          try {
            const c = await randomServer("commit", { player: s.address, nonce: String(s.nonce) });
            commit = c.commit as Hex;
            signature = c.signature as Hex;
          } catch (e) {
            set({ tx: { ...flow, stage: "failed", error: shortError(e) } });
            return null;
          }
          const r = await send(flow, (client) => client.writeContract({ ...game(), functionName: "launch", args: [planetId, commit, signature], chain: gameChain, account: client.account }));
          if (!r) return null;
          set((st) => ({ activity: pushActivity(st.activity, "launch", `Expedition launched to ${planet.name}`) }));
          return get().activeMission;
        },

        resolveActiveMission: async () => {
          const s = get();
          const m = s.activeMission;
          if (!m || !s.address) return null;
          const planet = planetById(m.planetId);
          const flow = { kind: "resolve" as const, label: `Report from ${planet.name}` };
          if (m.status === "resolved") {
            // Someone else revealed and resolved it; only the claim is left.
            const r = await send(flow, (client) => client.writeContract({ ...game(), functionName: "claim", args: [BigInt(m.id)], chain: gameChain, account: client.account }));
            if (!r) return null;
            const report = { ...m, status: "claimed" as const };
            set((st) => ({ lastReport: report, activity: pushActivity(st.activity, m.outcome?.success ? "success" : "failure", m.outcome?.success ? `Extraction complete on ${planet.name}: +${m.outcome.reward.toLocaleString("en-US")} ${ECONOMY.token.ticker}` : `Extraction failed on ${planet.name}`) }));
            return report;
          }
          if (Date.now() < m.endsAt) return null;
          set({ tx: { ...flow, stage: "awaiting-signature" } });
          // The active mission is always the player's latest launch, so its commit used nonce − 1.
          const nonce = Math.max(0, s.nonce - 1);
          let seed: Hex;
          try {
            const rv = await randomServer("reveal", { player: s.address, nonce: String(nonce), mission: m.id });
            seed = rv.seed as Hex;
          } catch (e) {
            set({ tx: { ...flow, stage: "failed", error: shortError(e) } });
            return null;
          }
          const receipt = await send(flow, (client) => client.writeContract({ ...game(), functionName: "resolveAndClaim", args: [BigInt(m.id), seed], chain: gameChain, account: client.account }));
          if (!receipt) return null;
          let roll = -1;
          let success = false;
          let reward = 0n;
          let rare = false;
          for (const log of receipt.logs) {
            try {
              const ev = decodeEventLog({ abi: STARMINER_GAME_ABI, data: log.data, topics: log.topics });
              if (ev.eventName === "Resolved") {
                const a = ev.args as { success: boolean; reward: bigint; rare: boolean; roll: bigint };
                roll = Number(a.roll) / BPS;
                success = a.success;
                reward = a.reward;
                rare = a.rare;
              }
            } catch {
              /* other logs */
            }
          }
          const report: Mission = {
            ...m,
            status: "claimed",
            outcome: {
              success,
              reward: tokens(reward),
              rareDrop: rare ? planet.rareResource : null,
              rareBonus: 0,
              xp: success ? planet.xp : failureXp(planet.xp),
              randomSource: "onchain-commit-reveal",
              roll,
            },
          };
          set((st) => ({
            lastReport: report,
            activity: pushActivity(st.activity, success ? "success" : "failure", success ? `Extraction complete on ${planet.name}: +${tokens(reward).toLocaleString("en-US")} ${ECONOMY.token.ticker}` : `Extraction failed on ${planet.name}`),
          }));
          return report;
        },

        claimMission: async () => {
          await get().resolveActiveMission();
        },

        abortMission: async () => {
          const m = get().activeMission;
          if (!m) return;
          await send({ kind: "resolve", label: "Abort expedition" }, (client) => client.writeContract({ ...game(), functionName: "abort", args: [BigInt(m.id)], chain: gameChain, account: client.account }));
        },

        listShip: async (instanceId, price) => {
          const ship = get().ships.find((x) => x.instanceId === instanceId);
          if (!ship || !(price > 0)) return null;
          const hull = shipById(ship.hullId);
          const r = await send({ kind: "list", instanceId, hullId: ship.hullId, label: `List ${hull.name}` }, (client) =>
            client.writeContract({ ...game(), functionName: "list", args: [BigInt(instanceId), toWei(Math.round(price))], chain: gameChain, account: client.account }),
          );
          if (!r) return null;
          set((st) => ({ activity: pushActivity(st.activity, "market", `Listed ${hull.name} for ${Math.round(price).toLocaleString("en-US")} ${ECONOMY.token.ticker}`) }));
          return get().listings.find((l) => l.instanceId === instanceId) ?? null;
        },

        cancelListing: async (listingId) => {
          const r = await send({ kind: "list", label: "Cancel listing" }, (client) => client.writeContract({ ...game(), functionName: "cancel", args: [BigInt(listingId)], chain: gameChain, account: client.account }));
          return Boolean(r);
        },

        buyListing: async (listingId) => {
          const l = get().listings.find((x) => x.id === listingId);
          if (!l || l.sellerAddress === "you") return null;
          const hull = shipById(l.hullId);
          const price = toWei(l.price);
          const flow = { kind: "market" as const, hullId: l.hullId, label: `${hull.name} from ${l.seller}` };
          if (get().balanceRaw < price) {
            set({ tx: { ...flow, stage: "failed", error: `Not enough ${ECONOMY.token.ticker}. Asking ${l.price.toLocaleString("en-US")}.` } });
            return null;
          }
          if (!(await ensureAllowance(price, flow))) return null;
          const r = await send(flow, (client) => client.writeContract({ ...game(), functionName: "buy", args: [BigInt(listingId)], chain: gameChain, account: client.account }));
          if (!r) return null;
          set((st) => ({ activity: pushActivity(st.activity, "market", `Bought ${hull.name} from ${l.seller} for ${l.price.toLocaleString("en-US")} ${ECONOMY.token.ticker}`), tx: st.tx ? { ...st.tx, instanceId: l.instanceId } : st.tx }));
          return l.instanceId ?? null;
        },

        dismissTx: () => set({ tx: null }),
        dismissReport: () => set({ lastReport: null }),
        setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      };
    },
    {
      name: "starminer:settings:v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ settings: s.settings, activity: s.activity }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<GameState>;
        return { ...current, settings: { ...current.settings, ...(p.settings ?? {}) }, activity: p.activity ?? [] };
      },
    },
  ),
);

/** Load the persisted settings once on the client; safe to call repeatedly. */
export function hydrateSettings() {
  if (typeof window === "undefined") return;
  void Promise.resolve(useGameStore.persist.rehydrate()).then(() => useGameStore.setState({ settingsLoaded: true }));
}
