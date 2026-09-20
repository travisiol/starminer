import type { ReactNode } from "react";
import { CHAIN_NAME } from "@/config/chains";
import { DIFFICULTY_LABEL } from "@/game/config/planets";
import { RISK_LABEL, type RiskBand } from "@/game/math/miningProbability";
import type { Difficulty } from "@/game/types";
import { fmt } from "@/lib/format";

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`label ${className}`}>{children}</span>;
}

/** Big tabular number with an optional unit. */
export function Num({ value, unit, className = "", size = "lg" }: { value: number | string; unit?: string; className?: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const sz = { sm: "text-base", md: "text-xl", lg: "text-[28px] leading-none", xl: "text-[44px] leading-none" }[size];
  return (
    <span className={`num font-semibold ${sz} ${className}`}>
      {typeof value === "number" ? fmt(value) : value}
      {unit ? <span className="ml-1.5 text-[0.55em] font-medium tracking-[0.12em] text-muted">{unit}</span> : null}
    </span>
  );
}

export function DifficultyTag({ difficulty, className = "" }: { difficulty: Difficulty; className?: string }) {
  return (
    <span className={`chip diff-${difficulty} border-current/30 ${className}`}>
      <span className="dot" />
      {DIFFICULTY_LABEL[difficulty]}
    </span>
  );
}

const BAND_COLOR: Record<RiskBand, string> = {
  locked: "text-dim",
  risky: "diff-extreme",
  fair: "diff-hard",
  strong: "diff-normal",
  safe: "diff-easy",
};

export function RiskTag({ band, className = "" }: { band: RiskBand; className?: string }) {
  return (
    <span className={`chip ${BAND_COLOR[band]} border-current/30 ${className}`}>
      <span className="dot" />
      {RISK_LABEL[band]}
    </span>
  );
}

/** The success meter: a bar that reads like a gauge, coloured by risk band. Never shows 100. */
export function ProbabilityMeter({ probability, band, className = "" }: { probability: number; band: RiskBand; className?: string }) {
  const pctValue = Math.min(99, Math.round(probability * 100));
  const bar = { locked: "bg-graphite", risky: "bg-diff-extreme", fair: "bg-diff-hard", strong: "bg-diff-normal", safe: "bg-diff-easy" }[band];
  return (
    <div className={`meter ${className}`} role="meter" aria-valuemin={0} aria-valuemax={99} aria-valuenow={pctValue} aria-label="Success chance">
      <span className={bar} style={{ width: `${pctValue}%` }} />
    </div>
  );
}

/** Where the game runs. Onchain only. */
export function ModeBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`chip border-easy/40 text-easy ${className}`} title={`Every purchase, mission and sale is a transaction on ${CHAIN_NAME}.`}>
      <span className="dot dot-live" />
      Onchain · {CHAIN_NAME}
    </span>
  );
}

export function Stat({ label, value, unit, sub, size = "lg" }: { label: string; value: number | string; unit?: string; sub?: ReactNode; size?: "md" | "lg" | "xl" }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Num value={value} unit={unit} size={size} />
      {sub ? <span className="text-xs text-muted">{sub}</span> : null}
    </div>
  );
}

export function Divider({ className = "" }: { className?: string }) {
  return <div className={`hairline ${className}`} />;
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="panel flex flex-col items-start gap-3 border-dashed p-6">
      <p className="display-wide text-xs text-text">{title}</p>
      {body ? <p className="max-w-md text-sm text-muted">{body}</p> : null}
      {action}
    </div>
  );
}
