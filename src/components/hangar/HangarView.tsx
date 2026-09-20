"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { shipById } from "@/game/config/ships";
import { SceneBoundary } from "@/components/three/SceneBoundary";
import { ShipCard } from "@/components/ships/ShipCard";
import { ShipDetails } from "@/components/ships/ShipDetails";
import { Empty, Label, ModeBadge } from "@/components/ui/atoms";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { fmt } from "@/lib/format";
import { toast } from "@/lib/toast";
import { selectFleet, useGameStore } from "@/store/gameStore";

const HangarScene = dynamic(() => import("@/components/three/hangar/HangarScene").then((m) => m.HangarScene), {
  ssr: false,
  loading: () => <div className="absolute inset-0 flex items-center justify-center text-muted label">Opening the hangar…</div>,
});

/** HANGAR — the active fleet on three platforms, then every owned hull with EQUIP / UNEQUIP / DETAILS. Every change is a transaction. */
export function HangarView() {
  const address = useGameStore((s) => s.address);
  const hydrated = useGameStore((s) => s.hydrated);
  const ships = useGameStore((s) => s.ships);
  const fleetSlots = useGameStore((s) => s.fleet);
  const progress = useGameStore((s) => s.progress);
  const activeMission = useGameStore((s) => s.activeMission);
  const balance = useGameStore((s) => s.balance);
  const tx = useGameStore((s) => s.tx);
  const equip = useGameStore((s) => s.equipShip);
  const unequip = useGameStore((s) => s.unequipShip);
  const refit = useGameStore((s) => s.refitShip);
  const [details, setDetails] = useState<string | null>(null);

  const fleet = useMemo(() => selectFleet({ ships, fleet: fleetSlots, progress }), [ships, fleetSlots, progress]);
  const locked = activeMission?.status === "in-progress";
  const busy = Boolean(tx && tx.stage !== "added" && tx.stage !== "failed");
  const detailShip = details ? ships.find((s) => s.instanceId === details) : undefined;
  const detailHull = detailShip ? shipById(detailShip.hullId) : null;

  const tryEquip = async (instanceId: string) => {
    if (locked) return toast({ kind: "error", title: "Fleet locked", body: "Change the fleet when the expedition is settled." });
    if (fleetSlots.indexOf(null) === -1) return toast({ kind: "error", title: "No free platform", body: "Unequip a ship first — the fleet holds three." });
    const ok = await equip(instanceId);
    if (ok) toast({ kind: "success", title: "Platform powered up" });
  };

  return (
    <div className="pt-14">
      <section className="relative h-[52svh] min-h-[360px] w-full overflow-hidden border-b border-line bg-void">
        <SceneBoundary fallback={<div className="absolute inset-0 flex items-center justify-center text-muted label">3D hangar unavailable in this browser</div>}>
          <HangarScene fleet={fleetSlots} ships={ships} ignition={Boolean(locked)} />
        </SceneBoundary>
        <div className="pointer-events-none absolute inset-x-0 top-0 p-4 md:p-6">
          <div className="container-x flex items-start justify-between">
            <div>
              <Label>Hangar</Label>
              <h1 className="display gradient-text mt-1 text-[32px] md:text-[44px]">YOUR FLEET</h1>
            </div>
            <ModeBadge />
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 md:p-6">
          <div className="container-x flex flex-wrap items-end gap-8">
            <div>
              <Label>Total Fleet Power</Label>
              <p className="num text-[40px] leading-none font-semibold md:text-[52px]">{hydrated ? fmt(fleet.totalPower) : "—"}</p>
            </div>
            <div>
              <Label>Active ships</Label>
              <p className="num text-[40px] leading-none font-semibold md:text-[52px]">
                {hydrated ? fleet.ships.length : "—"}
                <span className="text-xl text-muted"> / 3</span>
              </p>
            </div>
            {locked ? <span className="chip text-accent">Fleet deployed — engines lit</span> : null}
          </div>
        </div>
      </section>

      <div className="container-x pb-28 pt-8 md:pb-16">
        {!address ? (
          <Empty title="Connect your wallet" body="Your ships live in the game contract under your address. Connect to see them on the platforms." action={<ConnectButton size="md" />} />
        ) : null}

        <h2 className="display-wide mt-6 text-xs">Active fleet</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => {
            const id = fleetSlots[i];
            const owned = id ? ships.find((s) => s.instanceId === id) : undefined;
            const hull = owned ? shipById(owned.hullId) : null;
            return (
              <div key={i} className={`rounded-lg border p-3 ${hull ? "border-line" : "border-dashed border-graphite"}`}>
                <Label>Platform 0{i + 1}</Label>
                {hull && owned ? (
                  <div className="mt-2">
                    <ShipCard
                      hull={hull}
                      owned={owned}
                      slot={i}
                      compact
                      footer={
                        <>
                          <button type="button" className="btn btn-ghost btn-xs" onClick={() => void unequip(owned.instanceId)} disabled={locked || busy}>
                            Unequip
                          </button>
                          <button type="button" className="btn btn-ghost btn-xs" onClick={() => setDetails(owned.instanceId)}>
                            Details
                          </button>
                        </>
                      }
                    />
                  </div>
                ) : (
                  <div className="mt-6 pb-4 text-center">
                    <p className="display-wide text-xs text-dim">Empty platform</p>
                    <p className="mt-1 text-[11px] text-dim">Equip a hull below</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex items-center justify-between">
          <h2 className="display-wide text-xs">All ships {hydrated && address ? `· ${ships.length}` : ""}</h2>
          <div className="flex gap-2">
            <Link href="/fleet" className="btn btn-ghost btn-xs">
              Fleet builder
            </Link>
            <Link href="/market" className="btn btn-primary btn-xs">
              Buy ships
            </Link>
          </div>
        </div>
        {address && hydrated && ships.length === 0 ? (
          <div className="mt-3">
            <Empty
              title="The hangar is empty"
              body="Buy your first hull in the market. It is equipped automatically and the platform powers up."
              action={
                <Link href="/market" className="btn btn-primary btn-sm">
                  Open the ship market
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ships.map((s) => {
              const hull = shipById(s.hullId);
              const slot = fleetSlots.indexOf(s.instanceId);
              const inFleet = slot !== -1;
              return (
                <ShipCard
                  key={s.instanceId}
                  hull={hull}
                  owned={s}
                  slot={inFleet ? slot : null}
                  compact
                  footer={
                    <>
                      {inFleet ? (
                        <button type="button" className="btn btn-ghost btn-xs" onClick={() => void unequip(s.instanceId)} disabled={locked || busy}>
                          Unequip
                        </button>
                      ) : (
                        <button type="button" className="btn btn-primary btn-xs" onClick={() => void tryEquip(s.instanceId)} disabled={locked || busy}>
                          Equip
                        </button>
                      )}
                      <button type="button" className="btn btn-ghost btn-xs" onClick={() => setDetails(s.instanceId)}>
                        Details
                      </button>
                    </>
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      <ShipDetails
        hull={detailHull}
        owned={detailShip}
        balance={balance}
        onClose={() => setDetails(null)}
        onRefit={(id) => {
          setDetails(null);
          void refit(id);
        }}
        primary={
          detailShip && !fleetSlots.includes(detailShip.instanceId)
            ? { label: "Equip", onClick: () => (void tryEquip(detailShip.instanceId), setDetails(null)), disabled: locked || busy }
            : detailShip
              ? { label: "Unequip", onClick: () => (void unequip(detailShip.instanceId), setDetails(null)), disabled: locked || busy }
              : undefined
        }
      />
    </div>
  );
}
