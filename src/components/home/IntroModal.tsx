"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { brand } from "@/config/brand";
import { CHAIN_NAME } from "@/config/chains";
import { Mark } from "@/components/brand/Mark";
import { easeOutExpo } from "@/lib/motion";
import { useGameStore } from "@/store/gameStore";

const LINES: [string, string][] = [
  ["30", "planets, six zones deep"],
  ["BUY", `ships with ${brand.token.ticker} — every ship adds Fleet Power`],
  ["3", "ships in your active fleet"],
  ["POWER", "raises your success chance; it never reaches 100%"],
  ["DEEPER", "worlds pay more — and fail more"],
];

/** First visit: the whole game in five lines, then straight onto Aera. */
export function IntroModal() {
  const seen = useGameStore((s) => s.settings.introSeen);
  const loaded = useGameStore((s) => s.settingsLoaded);
  const setSettings = useGameStore((s) => s.setSettings);
  const close = () => setSettings({ introSeen: true });

  return (
    <AnimatePresence>
      {loaded && !seen ? (
        <motion.div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label="Welcome">
          <motion.div className="glass-strong w-full max-w-lg p-6 md:p-8" initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }} transition={{ duration: 0.45, ease: easeOutExpo }}>
            <div className="flex items-center gap-3">
              <Mark size={22} className="text-text" />
              <span className="display-wide text-xs">{brand.name}</span>
            </div>
            <h2 className="display gradient-text mt-4 text-[30px] md:text-[38px]">WELCOME, COMMANDER.</h2>
            <p className="mt-2 text-sm text-muted">{brand.line} The whole game in five lines:</p>
            <ol className="mt-5 space-y-2.5">
              {LINES.map(([k, v]) => (
                <li key={k} className="flex items-baseline gap-3">
                  <span className="num gradient-text w-20 shrink-0 text-right text-lg font-semibold">{k}</span>
                  <span className="text-sm text-muted">{v}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-muted">Everything runs onchain on {CHAIN_NAME}: your ships, your fleet, every mission and every sale are transactions signed by your wallet.</p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button type="button" className="btn btn-primary flex-1" onClick={close}>
                Start on Aera
              </button>
              <Link href="/market" className="btn btn-ghost flex-1" onClick={close}>
                Buy your first ship
              </Link>
            </div>
            <Link href="/how-it-works" className="label mt-4 block text-center hover:text-text" onClick={close}>
              Read how it works
            </Link>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
