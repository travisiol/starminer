"use client";

import { ChevronDown, Copy, ExternalLink, LogOut } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useConnection, useDisconnect, useSwitchChain } from "wagmi";
import { CHAIN_ID, CHAIN_NAME, explorer } from "@/config/chains";
import { shortAddress } from "@/lib/format";
import { useMounted } from "@/lib/hooks";
import { toast } from "@/lib/toast";
import { ConnectDialog } from "./ConnectDialog";

/** CONNECT WALLET in the navbar. Connected: a mono address with a menu. Wrong network: a switch button. */
export function ConnectButton({ size = "sm" }: { size?: "sm" | "md" }) {
  const mounted = useMounted();
  const { address, isConnected, chainId } = useConnection();
  const { mutate: disconnect } = useDisconnect();
  const { mutateAsync: switchChain, isPending: switching } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [menu]);

  const cls = size === "md" ? "btn btn-ghost" : "btn btn-ghost btn-sm";

  if (!mounted || !isConnected || !address) {
    return (
      <>
        <button type="button" className={cls} onClick={() => setOpen(true)}>
          <span className="hidden sm:inline">Connect wallet</span>
          <span className="sm:hidden">Connect</span>
        </button>
        <ConnectDialog open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  if (chainId !== CHAIN_ID) {
    return (
      <button
        type="button"
        className={`${cls} border-hard/60 text-hard`}
        disabled={switching}
        onClick={() => switchChain({ chainId: CHAIN_ID }).catch((e: Error) => toast({ kind: "error", title: "Could not switch network", body: e.message.split("\n")[0] }))}
      >
        {switching ? "Switching…" : `Switch to ${CHAIN_NAME}`}
      </button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button type="button" className={`${cls} mono normal-case tracking-normal`} onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-haspopup="menu">
        <span className="dot dot-live" />
        {shortAddress(address)}
        <ChevronDown size={13} className="text-muted" />
      </button>
      {menu ? (
        <div role="menu" className="glass-strong absolute right-0 mt-2 w-52 overflow-hidden p-1.5 text-sm">
          <Link role="menuitem" href="/profile" className="flex items-center gap-2 rounded-md px-3 py-2 text-muted transition hover:bg-white/[0.04] hover:text-text" onClick={() => setMenu(false)}>
            Commander profile
          </Link>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-muted transition hover:bg-white/[0.04] hover:text-text"
            onClick={() => {
              navigator.clipboard.writeText(address).then(() => toast({ kind: "info", title: "Address copied" }));
              setMenu(false);
            }}
          >
            <Copy size={14} /> Copy address
          </button>
          <a role="menuitem" href={explorer.address(address)} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-md px-3 py-2 text-muted transition hover:bg-white/[0.04] hover:text-text">
            <ExternalLink size={14} /> View on explorer
          </a>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-muted transition hover:bg-white/[0.04] hover:text-danger"
            onClick={() => {
              disconnect();
              setMenu(false);
            }}
          >
            <LogOut size={14} /> Disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
}
