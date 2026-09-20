"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useConnect, useConnectors } from "wagmi";
import { Mark } from "@/components/brand/Mark";
import { CHAIN_NAME, CHAIN_ID } from "@/config/chains";
import { easeOutExpo } from "@/lib/motion";
import { hasWalletConnect } from "@/lib/wagmi";

/**
 * Our own connect sheet: every injected wallet the browser announces (EIP-6963)
 * as its own row, WalletConnect when configured. The game is onchain: ships,
 * missions and sales are transactions signed here.
 */
export function ConnectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const connectors = useConnectors();
  const { mutateAsync: connect, isPending, variables, error, reset } = useConnect();
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const named = connectors.filter((c) => c.type === "injected" && c.id !== "injected");
  const list = connectors.filter((c) => !(c.id === "injected" && named.length > 0));
  const pendingId = isPending ? (variables as { connector?: { uid?: string } } | undefined)?.connector?.uid : undefined;

  const pick = async (uid: string) => {
    const c = connectors.find((x) => x.uid === uid);
    if (!c) return;
    setFailed(null);
    try {
      await connect({ connector: c });
      onClose();
    } catch (e) {
      const msg = (e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error)?.message ?? "Connection failed.";
      setFailed(msg.split("\n")[0].slice(0, 160));
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Connect a wallet"
        >
          <motion.div
            className="glass-strong relative w-full max-w-md p-6"
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ duration: 0.4, ease: easeOutExpo }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" aria-label="Close" onClick={onClose} className="absolute top-4 right-4 rounded-md p-1 text-muted transition hover:text-text">
              <X size={16} />
            </button>
            <div className="flex items-center gap-3">
              <Mark size={20} className="text-text" />
              <h2 className="display-wide text-sm">Connect wallet</h2>
            </div>
            <p className="mt-2 text-sm text-muted">
              {CHAIN_NAME} · chain {CHAIN_ID}.{" "}
              Ships, missions and rewards live on the chain; every purchase, launch and sale asks for a signature.
            </p>

            <ul className="mt-5 flex flex-col gap-2">
              {list.map((c) => (
                <li key={c.uid}>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => pick(c.uid)}
                    className="flex w-full items-center gap-3 rounded-md border border-graphite bg-white/[0.02] px-4 py-3 text-left transition hover:border-accent/50 hover:bg-white/[0.04] disabled:opacity-60"
                  >
                    {c.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.icon} alt="" className="h-7 w-7 rounded-md" />
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-graphite text-muted">
                        <Mark size={14} />
                      </span>
                    )}
                    <span className="flex-1 text-sm font-medium">{c.name}</span>
                    {pendingId === c.uid ? <span className="label animate-pulse-soft">Waiting…</span> : <span className="label">{c.type === "walletConnect" ? "QR" : "Browser"}</span>}
                  </button>
                </li>
              ))}
              {list.length === 0 ? <li className="rounded-md border border-dashed border-graphite p-4 text-sm text-muted">No wallet found in this browser. Install one, or configure WalletConnect.</li> : null}
            </ul>

            {!hasWalletConnect ? <p className="mt-4 text-[11px] leading-relaxed text-dim">WalletConnect is off: set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to offer mobile wallets.</p> : null}
            {failed || error ? (
              <p className="mt-3 text-xs text-danger" role="alert">
                {failed ?? error?.message}{" "}
                <button type="button" className="underline" onClick={() => (setFailed(null), reset())}>
                  dismiss
                </button>
              </p>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
