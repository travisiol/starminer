"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { concat, erc20Abi, maxUint256, parseUnits } from "viem";
import { useConnection } from "wagmi";
import { getWalletClient, waitForTransactionReceipt } from "wagmi/actions";
import { brand } from "@/config/brand";
import { CHAIN_ID, CHAIN_NAME, explorer, gameChain } from "@/config/chains";
import { CREATE2_PROXY, DEPLOY_SALT, GAME_ADDRESS, OWNER_ADDRESS, RANDOM_SIGNER_ADDRESS, TOKEN_ADDRESS, TOKEN_DECIMALS, TREASURY_ADDRESS, gameInitCode, missingConfig } from "@/config/contracts";
import { STARMINER_GAME_ABI } from "@/lib/abi/starminerGame";
import { Label } from "@/components/ui/atoms";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { fmt } from "@/lib/format";
import { toast } from "@/lib/toast";
import { wagmiConfig } from "@/lib/wagmi";
import { useGameStore } from "@/store/gameStore";

interface Health {
  ok: boolean;
  signer: string | null;
  signerMatchesConfig: boolean;
  game: string | null;
  chainId: number;
}

/**
 * /deploy — the operator's checklist. Give the game its token, deploy the contract with any
 * wallet (CREATE2: the address is known before the transaction), fund the vault. Nothing here
 * is needed by players; it is how the game goes live.
 */
export function DeployView() {
  const { isConnected } = useConnection();
  const deployed = useGameStore((s) => s.deployed);
  const vault = useGameStore((s) => s.vault);
  const allowance = useGameStore((s) => s.allowance);
  const balance = useGameStore((s) => s.balance);
  const refresh = useGameStore((s) => s.refresh);
  const [busy, setBusy] = useState<string | null>(null);
  const [amount, setAmount] = useState("100000");

  const health = useQuery({
    queryKey: ["random-health"],
    queryFn: async () => (await fetch("/api/random?action=health", { cache: "no-store" })).json() as Promise<Health>,
    refetchInterval: 15_000,
  });

  const missing = missingConfig();
  const init = gameInitCode();

  const deploy = async () => {
    if (!init) return;
    setBusy("deploy");
    try {
      const client = await getWalletClient(wagmiConfig);
      const hash = await client.sendTransaction({ to: CREATE2_PROXY, data: concat([DEPLOY_SALT, init]), chain: gameChain, account: client.account });
      toast({ kind: "info", title: "Deployment sent", body: "Waiting for the block…" });
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });
      if (receipt.status !== "success") throw new Error("Deployment reverted");
      await refresh();
      toast({ kind: "success", title: "Game contract deployed", body: GAME_ADDRESS ?? "" });
    } catch (e) {
      toast({ kind: "error", title: "Deployment failed", body: ((e as Error).message ?? "").split("\n")[0].slice(0, 160) });
    } finally {
      setBusy(null);
    }
  };

  const fund = async () => {
    if (!GAME_ADDRESS || !TOKEN_ADDRESS) return;
    const wei = parseUnits(amount || "0", TOKEN_DECIMALS);
    if (wei <= 0n) return;
    setBusy("fund");
    try {
      const client = await getWalletClient(wagmiConfig);
      if (allowance < wei) {
        const a = await client.writeContract({ address: TOKEN_ADDRESS, abi: erc20Abi, functionName: "approve", args: [GAME_ADDRESS, maxUint256], chain: gameChain, account: client.account });
        await waitForTransactionReceipt(wagmiConfig, { hash: a });
      }
      const hash = await client.writeContract({ address: GAME_ADDRESS, abi: STARMINER_GAME_ABI, functionName: "fundVault", args: [wei], chain: gameChain, account: client.account });
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });
      if (receipt.status !== "success") throw new Error("Funding reverted");
      await refresh();
      toast({ kind: "success", title: "Vault funded", body: `${fmt(Number(amount))} ${brand.token.ticker}` });
    } catch (e) {
      toast({ kind: "error", title: "Funding failed", body: ((e as Error).message ?? "").split("\n")[0].slice(0, 160) });
    } finally {
      setBusy(null);
    }
  };

  const steps = [
    { ok: Boolean(TOKEN_ADDRESS), label: "Game token (the CA)", detail: TOKEN_ADDRESS ?? "Set NEXT_PUBLIC_TOKEN_ADDRESS" },
    { ok: Boolean(OWNER_ADDRESS), label: "Owner / treasury", detail: OWNER_ADDRESS ? `${OWNER_ADDRESS}${TREASURY_ADDRESS && TREASURY_ADDRESS !== OWNER_ADDRESS ? ` · treasury ${TREASURY_ADDRESS}` : ""}` : "Set NEXT_PUBLIC_OWNER_ADDRESS" },
    {
      ok: Boolean(health.data?.ok && health.data.signerMatchesConfig),
      label: "Randomness server",
      detail: health.isLoading ? "Checking…" : !health.data?.ok ? "RANDOM_SIGNER_KEY is not set on the server" : health.data.signerMatchesConfig ? `Signer ${health.data.signer}` : `Server signs with ${health.data.signer}, contract expects ${RANDOM_SIGNER_ADDRESS}`,
    },
    { ok: deployed, label: "Game contract", detail: GAME_ADDRESS ? `${GAME_ADDRESS} · ${deployed ? "deployed" : "not deployed yet (address predicted)"}` : "Waiting for the config above" },
    { ok: vault.available > 0, label: "Reward vault", detail: deployed ? `${fmt(vault.available)} ${brand.token.ticker} available` : "Deploy first" },
  ];

  return (
    <div className="container-x pt-20 pb-28 md:pb-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Label>Operator</Label>
          <h1 className="display gradient-text mt-1 text-[36px] md:text-[48px]">GO LIVE</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            {CHAIN_NAME} · chain {CHAIN_ID}. Give the game its token, deploy the contract with any wallet, fund the vault. Players can then buy, mine and trade with the token.
          </p>
        </div>
        <ConnectButton size="md" />
      </header>

      <ol className="mt-8 space-y-3">
        {steps.map((s, i) => (
          <li key={s.label} className={`panel flex items-start gap-4 p-4 ${s.ok ? "border-easy/30" : ""}`}>
            <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${s.ok ? "border-easy/60 text-easy" : "border-graphite text-dim"}`}>{s.ok ? "✓" : i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="label-strong">{s.label}</p>
              <p className="mono mt-1 break-all text-xs text-muted">{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      {missing.length > 0 ? (
        <div className="panel mt-6 p-5">
          <p className="display-wide text-xs">Missing configuration</p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="panel p-5">
          <Label>Deploy the game contract</Label>
          <p className="mt-2 text-sm text-muted">
            Sent through the deterministic deployment proxy, so the address is the one above whoever pays the gas. Constructor: token, owner, treasury, signer, the 24 hulls and the 30 planets from the config.
          </p>
          <p className="mono mt-2 break-all text-[11px] text-dim">proxy {CREATE2_PROXY} · salt {DEPLOY_SALT.slice(0, 18)}…</p>
          <button type="button" className="btn btn-primary mt-4" disabled={!init || deployed || !isConnected || busy !== null} onClick={deploy}>
            {deployed ? "Deployed" : busy === "deploy" ? "Deploying…" : "Deploy game contract"}
          </button>
          {GAME_ADDRESS ? (
            <a href={explorer.address(GAME_ADDRESS)} target="_blank" rel="noreferrer" className="label mt-3 block hover:text-text">
              View on explorer ↗
            </a>
          ) : null}
        </div>
        <div className="panel p-5">
          <Label>Fund the reward vault</Label>
          <p className="mt-2 text-sm text-muted">Mining rewards are paid from the vault only. Every ship purchase and refit routes 60% back into it; seed it so the first missions pay.</p>
          <div className="mt-4 flex gap-2">
            <input className="input" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount to fund" />
            <button type="button" className="btn btn-primary shrink-0" disabled={!deployed || !isConnected || busy !== null} onClick={fund}>
              {busy === "fund" ? "Funding…" : "Fund"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-dim">
            Your balance {fmt(balance)} {brand.token.ticker}. The first funding also approves the game to spend {brand.token.ticker}.
          </p>
        </div>
      </section>

      <section className="panel mt-6 p-5">
        <Label>Environment (Vercel → Settings → Environment Variables)</Label>
        <pre className="mono mt-3 overflow-x-auto whitespace-pre text-[11px] leading-relaxed text-muted">{`NEXT_PUBLIC_TOKEN_ADDRESS=${TOKEN_ADDRESS ?? "0x…the CA"}
NEXT_PUBLIC_OWNER_ADDRESS=${OWNER_ADDRESS ?? "0x…your wallet"}
NEXT_PUBLIC_RANDOM_SIGNER_ADDRESS=${RANDOM_SIGNER_ADDRESS ?? "0x…address of the signer key"}
RANDOM_SIGNER_KEY=0x…private key of the signer (server only, never public)
NEXT_PUBLIC_CHAIN_ID=${CHAIN_ID}`}</pre>
      </section>
    </div>
  );
}
