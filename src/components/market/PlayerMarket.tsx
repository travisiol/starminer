"use client";

import { useMemo, useState } from "react";
import { brand } from "@/config/brand";
import { ECONOMY } from "@/game/config/economy";
import { CLASS_LABEL, MARK_LABEL, shipById } from "@/game/config/ships";
import { markPower } from "@/game/math/fleet";
import type { Listing } from "@/game/types";
import { HullImage } from "@/components/ships/HullImage";
import { Empty, Label } from "@/components/ui/atoms";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { fmt, timeAgo } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { toast } from "@/lib/toast";
import { hullValue, selectMarketListings, useGameStore } from "@/store/gameStore";

/**
 * PLAYER MARKET — commanders sell hulls to each other, onchain. Listing escrows the ship in the
 * game contract (it leaves the hangar); a sale pays the seller minus the protocol fee (to the
 * reward vault); cancelling puts it back.
 */
export function PlayerMarket() {
  const address = useGameStore((s) => s.address);
  const hydrated = useGameStore((s) => s.hydrated);
  const ships = useGameStore((s) => s.ships);
  const listings = useGameStore((s) => s.listings);
  const balance = useGameStore((s) => s.balance);
  const tx = useGameStore((s) => s.tx);
  const activeMission = useGameStore((s) => s.activeMission);
  const listShip = useGameStore((s) => s.listShip);
  const cancelListing = useGameStore((s) => s.cancelListing);
  const buyListing = useGameStore((s) => s.buyListing);
  const now = useNow();

  const [sellId, setSellId] = useState("");
  const [price, setPrice] = useState("");

  const market = useMemo(() => selectMarketListings({ listings }), [listings]);
  const others = useMemo(() => market.filter((l) => l.sellerAddress !== "you"), [market]);
  const mine = useMemo(() => market.filter((l) => l.sellerAddress === "you"), [market]);
  const busy = Boolean(tx && tx.stage !== "added" && tx.stage !== "failed");

  const flying = new Set(activeMission?.status === "in-progress" ? activeMission.shipIds : []);
  const sellable = ships.filter((s) => !flying.has(s.instanceId));
  const selected = sellable.find((s) => s.instanceId === sellId) ?? null;
  const suggested = selected ? hullValue(selected.hullId, selected.mark) : 0;
  const asking = Math.max(0, Math.round(Number(price) || 0));
  const fee = Math.floor((asking * ECONOMY.marketFeeBps) / 10_000);
  const tooHigh = selected !== null && asking > suggested * ECONOMY.marketMaxPriceRatio;

  const pick = (id: string) => {
    setSellId(id);
    const s = sellable.find((x) => x.instanceId === id);
    setPrice(s ? String(hullValue(s.hullId, s.mark)) : "");
  };

  const submit = async () => {
    if (!selected || asking <= 0) return;
    const l = await listShip(selected.instanceId, asking);
    if (l) {
      toast({ kind: "success", title: `${shipById(l.hullId).name} listed`, body: `${fmt(l.price)} ${brand.token.ticker}. It left your hangar until it sells or you cancel.` });
      setSellId("");
      setPrice("");
    }
  };

  return (
    <section id="player-market" className="mt-12 scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="display-wide text-xs">Player market</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Sell a hull to another commander, or buy one second-hand. The contract keeps {(ECONOMY.marketFeeBps / 100).toFixed(1)}% of every sale for the reward vault and pays the rest to the seller in the same transaction.
          </p>
        </div>
      </div>

      {/* Sell */}
      <div className="panel mt-5 grid gap-5 p-5 md:grid-cols-[1fr_auto]">
        <div>
          <Label>Sell one of your ships</Label>
          {!address ? (
            <p className="mt-2 text-sm text-muted">Connect your wallet to list a hull.</p>
          ) : hydrated && sellable.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nothing to sell yet — ships you buy in the shipyard can be listed here.</p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-[1.4fr_1fr]">
              <select className="input" value={sellId} onChange={(e) => pick(e.target.value)} aria-label="Ship to sell">
                <option value="">Choose a hull…</option>
                {sellable.map((s) => {
                  const hull = shipById(s.hullId);
                  return (
                    <option key={s.instanceId} value={s.instanceId}>
                      {hull.name} {MARK_LABEL[s.mark]} · {fmt(markPower(s.hullId, s.mark))} power · value {fmt(hullValue(s.hullId, s.mark))}
                    </option>
                  );
                })}
              </select>
              <input className="input" type="number" min={1} step={10} inputMode="numeric" placeholder="Asking price" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Asking price" disabled={!selected} />
            </div>
          )}
          {selected ? (
            <p className={`mt-2 text-xs ${tooHigh ? "text-hard" : "text-muted"}`}>
              Reference value {fmt(suggested)} {brand.token.ticker}. You receive {fmt(Math.max(0, asking - fee))} after the {fmt(fee)} fee.
              {tooHigh ? ` Above ${Math.round(ECONOMY.marketMaxPriceRatio * 100)}% of value, buyers tend to stay away.` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex items-end">
          {!address ? (
            <ConnectButton size="md" />
          ) : (
            <button type="button" className="btn btn-primary w-full md:w-auto" disabled={!selected || asking <= 0 || busy} onClick={() => void submit()}>
              List for sale
            </button>
          )}
        </div>
      </div>

      {/* Listings from others */}
      <h3 className="display-wide mt-8 text-xs">For sale by other commanders {hydrated ? `· ${others.length}` : ""}</h3>
      {others.length === 0 ? (
        <div className="mt-3">
          <Empty title="Nothing for sale right now" body="Listings from other commanders appear here the moment they are posted." />
        </div>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((l) => (
            <ListingCard key={l.id} listing={l} now={now} balance={balance} busy={busy || !address} onBuy={() => void buyListing(l.id)} />
          ))}
        </div>
      )}

      {/* Your listings */}
      {mine.length > 0 ? (
        <>
          <h3 className="display-wide mt-8 text-xs">Your listings · {mine.length}</h3>
          <div className="panel mt-3 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="label px-4 py-3 font-normal">Hull</th>
                  <th className="label px-4 py-3 text-right font-normal">Price</th>
                  <th className="label hidden px-4 py-3 text-right font-normal sm:table-cell">Listed</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {mine.map((l) => {
                  const hull = shipById(l.hullId);
                  return (
                    <tr key={l.id} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-3">
                        <span className="display-wide text-[11px]">{hull.name}</span> <span className="text-xs text-dim">{MARK_LABEL[l.mark]}</span>
                      </td>
                      <td className="num px-4 py-3 text-right">{fmt(l.price)}</td>
                      <td className="hidden px-4 py-3 text-right text-muted sm:table-cell">{now ? timeAgo(l.listedAt, now) : ""}</td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" className="btn btn-ghost btn-xs" disabled={busy} onClick={() => void cancelListing(l.id).then((ok) => ok && toast({ kind: "info", title: `${hull.name} back in the hangar` }))}>
                          Cancel
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}

function ListingCard({ listing, now, balance, busy, onBuy }: { listing: Listing; now: number; balance: number; busy: boolean; onBuy: () => void }) {
  const hull = shipById(listing.hullId);
  const value = hullValue(listing.hullId, listing.mark);
  const delta = Math.round(((listing.price - value) / value) * 100);
  const short = balance < listing.price;
  return (
    <div className="panel flex flex-col p-4 transition hover:border-accent/50">
      <div className="flex items-start gap-3">
        <HullImage hull={hull} size={84} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="display-wide truncate text-[12px]">{hull.name}</p>
            <span className="chip">{MARK_LABEL[listing.mark]}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted">
            {CLASS_LABEL[hull.class]} · sold by <span className="mono text-text">{listing.seller}</span> · {now ? timeAgo(listing.listedAt, now) : ""}
          </p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <Label>Fleet Power</Label>
              <p className="num text-[20px] leading-none font-semibold">{fmt(markPower(listing.hullId, listing.mark))}</p>
            </div>
            <div className="text-right">
              <Label>Asking</Label>
              <p className="num text-[15px] leading-none font-semibold">{fmt(listing.price)}</p>
              <p className={`text-[10px] ${delta <= 0 ? "text-easy" : "text-muted"}`}>{delta === 0 ? "at value" : `${delta > 0 ? "+" : ""}${delta}% vs value`}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" className="btn btn-primary btn-xs" disabled={busy || short} onClick={onBuy} title={short ? `Need ${fmt(listing.price - balance)} more ${brand.token.ticker}` : undefined}>
          Buy
        </button>
        <span className="label ml-auto text-[9.5px]">{short ? `Need ${fmt(listing.price - balance)} more` : `Shop price ${fmt(hull.price)}`}</span>
      </div>
    </div>
  );
}
