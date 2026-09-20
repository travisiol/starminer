"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { ShipConfig } from "@/game/types";
import { ClassGlyph } from "./ClassGlyph";
import { getThumbnail, requestThumbnail, subscribeThumbnails } from "./thumbnails";

/**
 * The real hull, rendered once by the shared thumbnail renderer. Falls back to the
 * class pictogram until the render lands (or forever when WebGL is unavailable).
 */
export function HullImage({ hull, size = 96, className = "" }: { hull: ShipConfig; size?: number; className?: string }) {
  const src = useSyncExternalStore(subscribeThumbnails, () => getThumbnail(hull.id), () => null);
  useEffect(() => {
    requestThumbnail(hull);
  }, [hull]);
  const h = Math.round(size * 0.75);
  return (
    <div className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-accent/15 bg-[radial-gradient(60%_60%_at_50%_45%,rgba(124,58,237,0.22),rgba(6,5,12,0.6))] ${className}`} style={{ width: size, height: h }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`${hull.name} hull`} width={size} height={h} className="h-full w-full object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.6)]" draggable={false} />
      ) : (
        <span style={{ color: hull.visual.accent }} className="opacity-60">
          <ClassGlyph cls={hull.class} size={Math.round(size * 0.45)} />
        </span>
      )}
    </div>
  );
}
