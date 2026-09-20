"use client";

import type { ReactNode } from "react";
import { CLASS_LABEL, MARK_LABEL, RARITY_LABEL } from "@/game/config/ships";
import { shipPower } from "@/game/math/fleet";
import type { Mark, OwnedShip, ShipConfig } from "@/game/types";
import { Label } from "@/components/ui/atoms";
import { fmt } from "@/lib/format";
import { HullImage } from "./HullImage";

export { ClassGlyph } from "./ClassGlyph";

const RARITY_TONE: Record<ShipConfig["rarity"], string> = {
  common: "text-muted",
  uncommon: "diff-easy",
  rare: "diff-normal",
  epic: "diff-anomaly",
  legendary: "text-gold",
};

interface CardProps {
  hull: ShipConfig;
  owned?: OwnedShip;
  /** Slot number when the hull is in the active fleet. */
  slot?: number | null;
  footer?: ReactNode;
  onClick?: () => void;
  compact?: boolean;
  selected?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  dimmed?: boolean;
}

/** One hull, with its real render. Used by the market, the hangar and the fleet builder with different footers. */
export function ShipCard({ hull, owned, slot, footer, onClick, compact, selected, draggable, onDragStart, dimmed }: CardProps) {
  const mark: Mark = owned?.mark ?? 1;
  const power = owned ? shipPower(owned) : hull.fleetPower;
  return (
    <div
      className={`panel group relative flex flex-col transition ${selected ? "border-accent/60" : "hover:border-accent/40"} ${dimmed ? "opacity-55" : ""} ${compact ? "p-3" : "p-4"} ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      role={onClick ? "button" : undefined}
    >
      <div className="flex items-start gap-3">
        <HullImage hull={hull} size={compact ? 84 : 112} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="display-wide truncate text-[12px]">{hull.name}</p>
            {owned ? <span className="chip">{MARK_LABEL[mark]}</span> : null}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
            <span>{CLASS_LABEL[hull.class]}</span>
            <span className="text-dim">·</span>
            <span className={RARITY_TONE[hull.rarity]}>{RARITY_LABEL[hull.rarity]}</span>
            {slot !== null && slot !== undefined ? (
              <>
                <span className="text-dim">·</span>
                <span className="text-accent">SLOT {slot + 1}</span>
              </>
            ) : null}
          </p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <Label>Fleet Power</Label>
              <p className="num text-[22px] leading-none font-semibold">{fmt(power)}</p>
            </div>
            {!owned ? (
              <div className="text-right">
                <Label>Price</Label>
                <p className="num text-[15px] leading-none font-semibold">{fmt(hull.price)}</p>
              </div>
            ) : (
              <div className="text-right">
                <Label>Condition</Label>
                <p className="num text-[15px] leading-none font-semibold">{owned.condition}%</p>
              </div>
            )}
          </div>
        </div>
      </div>
      {footer ? <div className="mt-3 flex items-center gap-2">{footer}</div> : null}
    </div>
  );
}
