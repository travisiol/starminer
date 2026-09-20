import { brand } from "@/config/brand";

const nf = new Intl.NumberFormat("en-US");

export const fmt = (n: number): string => nf.format(Math.round(n));

/** "2,400 $STAR" */
export const tokens = (n: number): string => `${fmt(n)} ${brand.token.ticker}`;

/** "48 – 72" */
export const range = ([lo, hi]: [number, number]): string => `${fmt(lo)} – ${fmt(hi)}`;

/** Compact: 12,400 → "12.4K", 2,500,000 → "2.5M" */
export function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 10_000) return `${(n / 1000).toFixed(abs >= 100_000 ? 0 : 1)}K`;
  return fmt(n);
}

/** Mission duration: 30 → "30 SEC", 1500 → "25 MIN", 28800 → "08H 00M" */
export function duration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} SEC`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s ? `${m} MIN ${s.toString().padStart(2, "0")}S` : `${m} MIN`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h.toString().padStart(2, "0")}H ${m.toString().padStart(2, "0")}M`;
}

/** Countdown: "07:42" or "01:07:42" */
export function countdown(msLeft: number): string {
  const total = Math.max(0, Math.ceil(msLeft / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h.toString().padStart(2, "0")}:${mm}:${ss}` : `${mm}:${ss}`;
}

export const pct = (p: number): string => `${Math.round(p * 100)}%`;
export const pct1 = (p: number): string => `${(p * 100).toFixed(1)}%`;

export const shortAddress = (a: string): string => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const padId = (id: number): string => id.toString().padStart(2, "0");

export function timeAgo(ms: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
