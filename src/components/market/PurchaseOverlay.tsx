"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ExternalLink, Loader2, PenLine, X } from "lucide-react";
import Link from "next/link";
import { explorer } from "@/config/chains";
import { MARK_LABEL, shipById } from "@/game/config/ships";
import { easeOutExpo } from "@/lib/motion";
import { useGameStore, type TxKind, type TxStage } from "@/store/gameStore";

const ORDER: TxStage[] = ["awaiting-signature", "pending", "confirmed", "added"];

const STEPS: Record<TxKind, [string, string, string, string]> = {
  purchase: ["Awaiting signature", "Transaction pending", "Purchase confirmed", "Ship added to hangar"],
  market: ["Awaiting signature", "Transaction pending", "Purchase confirmed", "Ship added to hangar"],
  refit: ["Awaiting signature", "Transaction pending", "Refit confirmed", "Mark applied"],
  launch: ["Awaiting signature", "Transaction pending", "Launch confirmed", "Fleet under way"],
  resolve: ["Awaiting signature", "Transaction pending", "Report sealed", "Settled"],
  fleet: ["Awaiting signature", "Transaction pending", "Fleet updated", "Platforms powered"],
  list: ["Awaiting signature", "Transaction pending", "Listing confirmed", "Market updated"],
  approve: ["Awaiting signature", "Approval pending", "Approved", "Ready"],
};

const TITLE: Record<TxKind, string> = {
  purchase: "Purchase",
  market: "Player market",
  refit: "Refit",
  launch: "Launch",
  resolve: "Mission report",
  fleet: "Fleet",
  list: "Player market",
  approve: "Token approval",
};

/**
 * Every wallet transaction, one state at a time: awaiting signature → pending → confirmed →
 * done. Nothing reads "confirmed" before the block does.
 */
export function PurchaseOverlay() {
  const tx = useGameStore((s) => s.tx);
  const dismiss = useGameStore((s) => s.dismissTx);
  // The mission report modal takes over once a resolve is settled.
  const open = Boolean(tx) && !(tx?.kind === "resolve" && tx.stage === "added");
  const hull = tx?.hullId ? shipById(tx.hullId) : null;
  const idx = tx ? ORDER.indexOf(tx.stage) : -1;
  const failed = tx?.stage === "failed";
  const done = tx?.stage === "added";
  const heading = tx?.kind === "refit" && hull && tx.targetMark ? `${hull.name} → ${MARK_LABEL[tx.targetMark]}` : (tx?.label ?? hull?.name ?? "");

  return (
    <AnimatePresence>
      {open && tx ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label={`${TITLE[tx.kind]} progress`}
          onClick={failed || done ? dismiss : undefined}
        >
          <motion.div
            className="glass-strong relative w-full max-w-md p-6"
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ duration: 0.4, ease: easeOutExpo }}
            onClick={(e) => e.stopPropagation()}
          >
            {failed || done ? (
              <button type="button" aria-label="Close" onClick={dismiss} className="absolute top-4 right-4 rounded-md p-1 text-muted transition hover:text-text">
                <X size={16} />
              </button>
            ) : null}
            <p className="label">{TITLE[tx.kind]}</p>
            <h2 className="display mt-1 text-2xl">{heading}</h2>

            {failed ? (
              <div className="mt-5 rounded-md border border-danger/40 bg-danger/10 p-4 text-sm text-[#fecdd3]" role="alert">
                {tx.error ?? "The transaction was not completed."}
              </div>
            ) : (
              <ol className="mt-5 flex flex-col gap-2">
                {STEPS[tx.kind].map((label, i) => {
                  const state = i < idx ? "done" : i === idx ? "active" : "todo";
                  return (
                    <li key={label} className={`flex items-center gap-3 rounded-md border px-4 py-3 ${state === "active" ? "border-accent/40 bg-accent/5" : state === "done" ? "border-line bg-white/[0.02]" : "border-line/60 opacity-45"}`}>
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${state === "done" ? "border-easy/50 text-easy" : state === "active" ? "border-accent/60 text-accent" : "border-graphite text-dim"}`}>
                        {state === "done" ? <Check size={12} /> : state === "active" ? i === 0 ? <PenLine size={12} /> : <Loader2 size={12} className="animate-spin" /> : <span className="dot" />}
                      </span>
                      <span className="label-strong">{label}</span>
                      {state === "active" && i !== 3 ? <span className="label ml-auto animate-pulse-soft">…</span> : null}
                    </li>
                  );
                })}
              </ol>
            )}

            {tx.hash ? (
              <a href={explorer.tx(tx.hash)} target="_blank" rel="noreferrer" className="label mt-3 inline-flex items-center gap-1 hover:text-text">
                <ExternalLink size={11} /> View transaction
              </a>
            ) : null}

            {done && (tx.kind === "purchase" || tx.kind === "market") ? (
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/hangar" className="btn btn-primary btn-sm" onClick={dismiss}>
                  Open hangar
                </Link>
                <Link href="/" className="btn btn-ghost btn-sm" onClick={dismiss}>
                  Go to planets
                </Link>
                <button type="button" className="btn btn-ghost btn-sm" onClick={dismiss}>
                  Keep shopping
                </button>
              </div>
            ) : done ? (
              <div className="mt-5 flex gap-2">
                <button type="button" className="btn btn-primary btn-sm" onClick={dismiss}>
                  Done
                </button>
              </div>
            ) : null}
            {failed ? (
              <div className="mt-5 flex gap-2">
                <button type="button" className="btn btn-ghost btn-sm" onClick={dismiss}>
                  Close
                </button>
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
