"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { PLANETS } from "@/game/config/planets";
import { frontierPlanet } from "@/game/math/progression";
import { SceneBoundary } from "@/components/three/SceneBoundary";
import { ResolutionModal } from "@/components/missions/ResolutionModal";
import { useNow } from "@/lib/hooks";
import { toast } from "@/lib/toast";
import { selectAllPlans, selectFleet, useGameStore } from "@/store/gameStore";
import { PlanetPanel } from "./PlanetPanel";
import { FleetCard, MissionCard, PlanetTooltip, ZoneLegend } from "./SystemHud";

const SystemScene = dynamic(() => import("@/components/three/system/SystemScene").then((m) => m.SystemScene), {
  ssr: false,
  loading: () => <div className="absolute inset-0 flex items-center justify-center bg-void text-muted label">Loading the system…</div>,
});

/** THE MAP: the solar system, with the fleet card, the mission card and the planet panel over it. */
export function SystemView() {
  const hydrated = useGameStore((s) => s.hydrated);
  const ships = useGameStore((s) => s.ships);
  const fleetSlots = useGameStore((s) => s.fleet);
  const progress = useGameStore((s) => s.progress);
  const activeMission = useGameStore((s) => s.activeMission);
  const selected = useGameStore((s) => s.selectedPlanet);
  const selectPlanet = useGameStore((s) => s.selectPlanet);
  const launchMission = useGameStore((s) => s.launchMission);
  const resolveActiveMission = useGameStore((s) => s.resolveActiveMission);
  const lastReport = useGameStore((s) => s.lastReport);
  const dismissReport = useGameStore((s) => s.dismissReport);
  const tx = useGameStore((s) => s.tx);
  const now = useNow();

  const [hovered, setHovered] = useState<number | null>(null);
  const [focus, setFocus] = useState<{ zone: number | null; nonce: number }>({ zone: null, nonce: 0 });
  const [launching, setLaunching] = useState(false);

  const storeSlice = useMemo(() => ({ ships, fleet: fleetSlots, progress, activeMission }), [ships, fleetSlots, progress, activeMission]);
  const plans = useMemo(() => selectAllPlans(storeSlice), [storeSlice]);
  const fleet = useMemo(() => selectFleet(storeSlice), [storeSlice]);
  // Every world shows its name; only the progression lock differs.
  const named = useMemo(() => PLANETS.map(() => true), []);
  const frontier = useMemo(() => frontierPlanet(progress).id, [progress]);
  const busy = Boolean(tx && tx.stage !== "added" && tx.stage !== "failed");

  const onSelect = useCallback((id: number | null) => selectPlanet(id), [selectPlanet]);
  const onHover = useCallback((id: number | null) => setHovered(id), []);
  const onFocus = useCallback((zone: number | null) => setFocus((f) => ({ zone, nonce: f.nonce + 1 })), []);

  const selectedPlan = selected ? plans[selected - 1] : null;
  const hoveredPlan = hovered && hovered !== selected ? plans[hovered - 1] : null;

  const launch = async () => {
    if (!selected) return;
    setLaunching(true);
    const m = await launchMission(selected);
    setLaunching(false);
    if (m) toast({ kind: "info", title: `Expedition launched to ${PLANETS[selected - 1].name}`, body: "Engines lit. The fleet is on its way." });
  };

  return (
    <div className="fixed inset-0 top-14 overflow-hidden bg-void">
      <SceneBoundary fallback={<Fallback />}>
        <SystemScene plans={plans} named={named} selected={selected} hovered={hovered} onSelect={onSelect} onHover={onHover} activeMission={activeMission} focus={focus} initialZone={Math.ceil(frontier / 5)} />
      </SceneBoundary>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-4 left-4 md:top-5 md:left-5">
          <ZoneLegend frontier={frontier} onFocus={onFocus} />
        </div>
        <PlanetTooltip plan={hoveredPlan} named={hovered ? named[hovered - 1] : false} />
        <div className="absolute bottom-[5.5rem] left-3 md:bottom-5 md:left-5">
          <FleetCard fleet={fleet} frontier={frontier} hydrated={hydrated} />
        </div>
        <div className="absolute right-3 bottom-[5.5rem] hidden md:right-5 md:bottom-5 md:block">
          <MissionCard mission={activeMission} now={now} onView={() => selectPlanet(activeMission?.planetId ?? null)} onResolve={() => void resolveActiveMission()} busy={busy} />
        </div>
        <PlanetPanel plan={selectedPlan} named={selected ? named[selected - 1] : false} progress={selected ? progress.planets[selected] : undefined} onClose={() => selectPlanet(null)} onLaunch={() => void launch()} launching={launching || busy} />
        <p className="label pointer-events-none absolute top-4 right-4 hidden text-[9px] text-dim lg:block">Drag to rotate · scroll to zoom · click a planet</p>
      </div>

      <ResolutionModal mission={lastReport} open={Boolean(lastReport)} onClaim={dismissReport} onClose={dismissReport} />
    </div>
  );
}

function Fallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="panel max-w-md p-6 text-sm text-muted">
        <p className="display-wide text-xs text-text">3D unavailable</p>
        <p className="mt-2">This browser could not start WebGL. The system map needs it; the planets, fleet, hangar and market pages still work.</p>
      </div>
    </div>
  );
}
