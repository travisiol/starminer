"use client";

import { Canvas } from "@react-three/fiber";
import type { ShipConfig } from "@/game/types";
import { useLowQuality } from "@/lib/hooks";
import { applyStudioEnvironment } from "@/components/three/environment";
import { QualityContext, dprFor } from "@/components/three/quality";
import { SceneBoundary } from "@/components/three/SceneBoundary";
import { ShipModel } from "@/components/three/ships/ShipModel";
import { StarField } from "@/components/three/StarField";
import { shipLength } from "@/components/three/ships/shipFactory";

/** A small turntable of one hull, for detail drawers. One canvas at a time — never in a grid. */
export function ShipPreview({ hull, className = "" }: { hull: ShipConfig; className?: string }) {
  const low = useLowQuality();
  const quality = low ? "low" : "high";
  const dist = shipLength(hull) * 1.9 + 1.5;
  return (
    <div className={`relative overflow-hidden rounded-md border border-line bg-void ${className}`}>
      <SceneBoundary fallback={<div className="absolute inset-0 flex items-center justify-center text-muted label">Preview unavailable</div>}>
        <Canvas dpr={dprFor(quality)} camera={{ position: [dist * 0.7, dist * 0.35, dist * 0.8], fov: 34, near: 0.1, far: 400 }} gl={{ antialias: !low, alpha: false }} className="!absolute inset-0" onCreated={({ camera, gl, scene }) => {
            camera.lookAt(0, 0, 0);
            applyStudioEnvironment(gl, scene, 0.6);
          }}
        >
          <QualityContext.Provider value={quality}>
            <color attach="background" args={["#07090c"]} />
            <hemisphereLight args={["#2a3340", "#05060a", 0.5]} />
            <directionalLight position={[6, 8, 6]} intensity={1.4} color="#e8f0f8" />
            <directionalLight position={[-8, 2, -6]} intensity={0.4} color={hull.visual.accent} />
            <StarField count={500} radius={200} dim={0.6} />
            <ShipModel hull={hull} thrust={0.7} turn={0.35} bob={0.05} />
          </QualityContext.Provider>
        </Canvas>
      </SceneBoundary>
    </div>
  );
}
