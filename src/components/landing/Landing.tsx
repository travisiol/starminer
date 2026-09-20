"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import { brand } from "@/config/brand";
import { PLANETS } from "@/game/config/planets";
import { CLASS_LABEL, SHIPS, SHIP_CLASSES } from "@/game/config/ships";
import { ZONES } from "@/game/config/zones";
import { miningProbability, probabilityPercent } from "@/game/math/miningProbability";
import { ClassGlyph } from "@/components/ships/ShipCard";
import { SceneBoundary } from "@/components/three/SceneBoundary";
import { DifficultyTag, Label } from "@/components/ui/atoms";
import { Mark } from "@/components/brand/Mark";
import { duration, fmt, padId } from "@/lib/format";
import { reveal, revealDelayed } from "@/lib/motion";

const HeroScene = dynamic(() => import("@/components/three/hero/HeroScene").then((m) => m.HeroScene), { ssr: false, loading: () => null });

const STEPS = [
  { n: "01", title: "BUILD", body: "Purchase ships and assemble your fleet." },
  { n: "02", title: "EXPLORE", body: "Unlock increasingly dangerous planets." },
  { n: "03", title: "MINE", body: "Deploy your fleet and attempt extraction." },
  { n: "04", title: "GROW", body: "Use your rewards to build stronger fleets." },
];

/** The landing: hero with a large ship over the system, then the loop in five seconds, then the zones, ships and how it works. */
export function Landing() {
  const aera = PLANETS[0];
  const eclipse = PLANETS[29];
  const first = SHIPS[0];
  const second = SHIPS[1];
  const solo = probabilityPercent(miningProbability(first.fleetPower, aera.minimumPower, aera.recommendedPower));
  const pair = probabilityPercent(miningProbability(first.fleetPower + second.fleetPower, aera.minimumPower, aera.recommendedPower));

  return (
    <div>
      {/* HERO */}
      <section className="relative h-[100svh] min-h-[640px] overflow-hidden">
        <SceneBoundary fallback={<div className="absolute inset-0 bg-void" />}>
          <HeroScene hullId="leviathan" />
        </SceneBoundary>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_30%_50%,rgba(5,6,7,0.55),rgba(5,6,7,0.05)_60%,rgba(5,6,7,0.7))]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-void to-transparent" />
        <div className="container-x relative flex h-full flex-col justify-end pt-20 pb-[max(3.5rem,8svh)] md:justify-center md:pb-0">
          <div className="max-w-6xl">
            <p className="fade-up label">Browser-based space mining strategy · onchain</p>
            {/* Sized to the viewport so each tagline line stays on one line from tablets up. */}
            <h1 className="fade-up fade-up-2 display mt-4 text-[clamp(40px,6.3vw,88px)]">
              {brand.tagline.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h1>
            <p className="fade-up fade-up-3 mt-5 max-w-lg text-base text-muted md:text-lg">
              Thirty worlds. One fleet of three ships. Every ship adds Fleet Power; more power means better odds on harder planets — and harder planets pay more.
            </p>
            <div className="fade-up fade-up-4 mt-8 flex flex-wrap gap-3">
              <Link href="/" className="btn btn-primary">
                Enter the system
              </Link>
              <a href="#how-it-works" className="btn btn-ghost">
                How it works
              </a>
            </div>
            <p className="fade-up fade-up-4 mt-5 text-[11px] text-dim">Mining is never guaranteed. Odds are shown before every launch and cap at 99%.</p>
          </div>
        </div>
      </section>

      {/* THE HOOK */}
      <section className="section border-t border-line">
        <div className="container-x">
          <motion.h2 {...reveal} className="display text-balance text-[36px] sm:text-[52px] md:text-[72px]">
            {brand.hook}
          </motion.h2>
          <motion.div {...revealDelayed(0.1)} className="mt-10 grid gap-3 md:grid-cols-3">
            {[
              { k: "30", t: "planets, six zones", b: "From Aera, a green ore world, to Eclipse, a gravitational anomaly." },
              { k: "3", t: "ships in the active fleet", b: "Their power adds up. TOTAL FLEET POWER is the number that decides everything." },
              { k: "99%", t: "is the ceiling", b: "More power raises the odds. It never removes the risk." },
            ].map((c) => (
              <div key={c.k} className="panel p-5">
                <p className="num text-[44px] leading-none font-semibold">{c.k}</p>
                <p className="display-wide mt-2 text-[11px]">{c.t}</p>
                <p className="mt-2 text-sm text-muted">{c.b}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* THE LOOP IN NUMBERS */}
      <section className="section border-t border-line">
        <div className="container-x grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <motion.div {...reveal}>
            <Label>The mechanic</Label>
            <h2 className="display mt-2 text-[32px] md:text-[44px]">MORE FLEET POWER. BETTER MINING ODDS.</h2>
            <p className="mt-4 text-sm text-muted">Every world has a minimum and a recommended Fleet Power. Below the minimum you cannot go. At the minimum you are flipping a coin. At the recommended power you succeed four times in five. Above it, the odds climb toward 99% and stop there.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="chip">Safe planet · high odds · lower reward</span>
              <span className="chip">Risky planet · lower odds · higher reward</span>
            </div>
          </motion.div>
          <motion.div {...revealDelayed(0.1)} className="panel p-5">
            <div className="flex items-center justify-between">
              <span className="display-wide text-xs">Planet 01 · {aera.name}</span>
              <DifficultyTag difficulty={aera.difficulty} />
            </div>
            <p className="mt-1 text-xs text-muted">
              Minimum {aera.minimumPower} · Recommended {aera.recommendedPower}
            </p>
            <ul className="mt-4 divide-y divide-line">
              <Row label={`${first.name} alone`} power={first.fleetPower} pct={solo} />
              <Row label={`${first.name} + ${second.name}`} power={first.fleetPower + second.fleetPower} pct={pair} />
              <Row label="Three scouts" power={first.fleetPower + second.fleetPower + SHIPS[2].fleetPower} pct={probabilityPercent(miningProbability(520, aera.minimumPower, aera.recommendedPower))} />
            </ul>
            <div className="mt-5 border-t border-line pt-4">
              <div className="flex items-center justify-between">
                <span className="display-wide text-xs">Planet 30 · {eclipse.name}</span>
                <DifficultyTag difficulty={eclipse.difficulty} />
              </div>
              <ul className="mt-2 divide-y divide-line">
                <Row label="At recommended power" power={45000} pct={80} />
                <Row label="Two thirds above it" power={80000} pct={probabilityPercent(miningProbability(80000, eclipse.minimumPower, eclipse.recommendedPower))} />
              </ul>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ZONES */}
      <section className="section border-t border-line">
        <div className="container-x">
          <motion.div {...reveal} className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Label>The system</Label>
              <h2 className="display mt-2 text-[32px] md:text-[44px]">SIX ZONES. DEEPER EVERY TIME.</h2>
            </div>
            <Link href="/system" className="btn btn-ghost btn-sm">
              Open the map
            </Link>
          </motion.div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ZONES.map((z, i) => {
              const first = PLANETS[z.planets[0] - 1];
              const last = PLANETS[z.planets[1] - 1];
              return (
                <motion.div key={z.id} {...revealDelayed(i * 0.05)} className="panel p-5">
                  <div className="flex items-center justify-between">
                    <span className="label">Zone {z.id}</span>
                    <DifficultyTag difficulty={first.difficulty} />
                  </div>
                  <p className="display mt-2 text-2xl uppercase">{z.name}</p>
                  <p className="mt-1 text-xs text-muted">
                    Planets {padId(z.planets[0])}–{padId(z.planets[1])} · {fmt(first.recommendedPower)} to {fmt(last.recommendedPower)} recommended power
                  </p>
                  <p className="mt-3 text-sm text-muted">{z.blurb}</p>
                  <p className="mt-3 text-[11px] text-dim">
                    Missions {duration(first.missionDuration)} → {duration(last.missionDuration)} · rewards up to {fmt(last.rewardMax)} {brand.token.ticker}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SHIPS */}
      <section className="section border-t border-line">
        <div className="container-x">
          <motion.div {...reveal} className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Label>The market</Label>
              <h2 className="display mt-2 text-[32px] md:text-[44px]">SIX CLASSES. {SHIPS.length} HULLS.</h2>
            </div>
            <Link href="/market" className="btn btn-ghost btn-sm">
              Open the market
            </Link>
          </motion.div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {SHIP_CLASSES.map((c, i) => {
              const hulls = SHIPS.filter((s) => s.class === c);
              const lo = hulls[0];
              const hi = hulls[hulls.length - 1];
              return (
                <motion.div key={c} {...revealDelayed(i * 0.05)} className="panel p-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-md border border-line bg-void/60" style={{ color: hi.visual.accent }}>
                    <ClassGlyph cls={c} size={40} />
                  </div>
                  <p className="display-wide mt-3 text-[11px]">{CLASS_LABEL[c]}</p>
                  <p className="num mt-1 text-sm text-muted">
                    {fmt(lo.fleetPower)} – {fmt(hi.fleetPower)} power
                  </p>
                  <p className="text-[11px] text-dim">
                    from {fmt(lo.price)} {brand.token.ticker}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="section border-t border-line">
        <div className="container-x">
          <motion.div {...reveal}>
            <Label>How it works</Label>
            <h2 className="display mt-2 text-[32px] md:text-[44px]">FOUR STEPS. ONE LOOP.</h2>
          </motion.div>
          <div className="mt-8 grid gap-3 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <motion.div key={s.n} {...revealDelayed(i * 0.06)} className="panel p-5">
                <p className="num text-3xl font-semibold text-muted">{s.n}</p>
                <p className="display mt-3 text-2xl">{s.title}</p>
                <p className="mt-2 text-sm text-muted">{s.body}</p>
              </motion.div>
            ))}
          </div>
          <motion.p {...revealDelayed(0.2)} className="mt-6 text-[11px] leading-relaxed text-dim">
            Ships are gameplay assets. Mining rewards depend on mission success, planet difficulty, the reward configuration and the reward vault. {brand.name} promises no return of any kind. Everything runs onchain: ships, missions and sales are transactions signed by your wallet.
          </motion.p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="section border-t border-line">
        <div className="container-x text-center">
          <motion.p {...reveal} className="display text-balance text-[28px] sm:text-[40px] md:text-[56px]">
            START WITH ONE SMALL SHIP.
            <br />
            REACH THE PLANETS THAT WEAK FLEETS CANNOT TOUCH.
          </motion.p>
          <motion.div {...revealDelayed(0.1)} className="mt-8 flex justify-center gap-3">
            <Link href="/" className="btn btn-primary">
              Enter the system
            </Link>
            <Link href="/market" className="btn btn-ghost">
              Buy your first ship
            </Link>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-line py-8">
        <div className="container-x flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-text">
            <Mark size={18} />
            <span className="display-wide text-[11px]">{brand.wordmark}</span>
          </div>
          <p className="text-[11px] text-dim">Game first. Crypto second. {brand.name} is a temporary brand name.</p>
        </div>
      </footer>
    </div>
  );
}

function Row({ label, power, pct }: { label: string; power: number; pct: number }) {
  return (
    <li className="flex items-center justify-between py-2.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="flex items-center gap-4">
        <span className="num text-muted">{fmt(power)} power</span>
        <span className={`num w-12 text-right font-semibold ${pct < 65 ? "diff-extreme" : pct < 80 ? "diff-hard" : "diff-easy"}`}>{pct}%</span>
      </span>
    </li>
  );
}
