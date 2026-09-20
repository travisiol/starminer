import { defineChain } from "viem";

/**
 * The chain the game runs on. Any EVM chain works; the defaults point at Robinhood Chain
 * (Arbitrum Orbit, id 4663). Every value can be overridden from the environment.
 */
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 4663);
export const CHAIN_NAME = process.env.NEXT_PUBLIC_CHAIN_NAME?.trim() || "Robinhood Chain";

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL?.trim() || "https://rpc.mainnet.chain.robinhood.com";

/** The browser talks to the chain through our own relay (see app/api/rpc); Node and the server go direct. */
export const BROWSER_RPC_URL = "/api/rpc";
export const isBrowser = () => typeof window !== "undefined";

export const EXPLORER_URL = (process.env.NEXT_PUBLIC_EXPLORER_URL?.trim() || "https://robinhoodchain.blockscout.com").replace(/\/$/, "");

/** Multicall3 at its canonical address (present on Robinhood Chain and most EVM chains). */
export const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;

export const gameChain = defineChain({
  id: CHAIN_ID,
  name: CHAIN_NAME,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: `${CHAIN_NAME} explorer`, url: EXPLORER_URL } },
  contracts: { multicall3: { address: MULTICALL3 } },
  testnet: false,
});

export const explorer = {
  address: (a: string) => `${EXPLORER_URL}/address/${a}`,
  token: (a: string) => `${EXPLORER_URL}/token/${a}`,
  tx: (h: string) => `${EXPLORER_URL}/tx/${h}`,
};
