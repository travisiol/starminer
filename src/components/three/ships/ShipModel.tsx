"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ShipConfig } from "@/game/types";
import { buildShip } from "./shipFactory";

interface Props {
  hull: ShipConfig;
  /** Extra scale on top of the power scale. */
  scale?: number;
  /** 0 = engines cold, 1 = ignited. Engine sprites pulse around it. */
  thrust?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** Slow yaw for showcase views. */
  turn?: number;
  bob?: number;
}

/** One procedural hull as a scene object. Engine glows breathe with `thrust`. */
export function ShipModel({ hull, scale = 1, thrust = 0.6, position, rotation, turn = 0, bob = 0 }: Props) {
  const group = useRef<THREE.Group>(null);
  const model = useMemo(() => buildShip(hull), [hull]);
  const glows = useMemo(() => {
    const out: THREE.Sprite[] = [];
    model.traverse((o) => {
      if (o.name === "engine-glow") out.push(o as THREE.Sprite);
    });
    return out;
  }, [model]);
  const baseScales = useMemo(() => glows.map((g) => g.scale.x), [glows]);

  useEffect(() => {
    const m = model;
    return () => {
      // Geometries are shared with the cached template; only the clone tree goes.
      m.removeFromParent();
    };
  }, [model]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    glows.forEach((g, i) => {
      const pulse = 0.85 + 0.15 * Math.sin(t * 9 + i * 1.7);
      const s = baseScales[i] * (0.35 + 0.85 * thrust) * pulse;
      g.scale.set(s, s, 1);
      (g.material as THREE.SpriteMaterial).opacity = 0.25 + 0.7 * thrust * pulse;
    });
    if (group.current) {
      if (turn) group.current.rotation.y += dt * turn;
      if (bob) group.current.position.y = (position?.[1] ?? 0) + Math.sin(t * 0.8) * bob;
    }
  });

  return (
    <group ref={group} position={position} rotation={rotation} scale={scale}>
      <primitive object={model} />
    </group>
  );
}
