import { encodeDeployData, getCreate2Address, isAddress, keccak256, toHex, type Address, type Hex } from "viem";
import { contractHulls, contractPlanets } from "@/game/chain/gameConfig";
import { STARMINER_GAME_ABI, STARMINER_GAME_BYTECODE } from "@/lib/abi/starminerGame";

/* ------------------------------------------------------------------ */
/*  Onchain configuration. Give the game its token (the CA) and an     */
/*  owner; the game contract's address is known before it exists       */
/*  (CREATE2 through the deterministic deployment proxy), so the site   */
/*  can offer "Deploy" and start reading the moment code lands there.  */
/* ------------------------------------------------------------------ */

// Static `process.env.NEXT_PUBLIC_*` accesses only: Next inlines those into the browser bundle,
// a dynamic `process.env[key]` would be undefined on the client.
const read = (v: string | undefined): Address | null => {
  const s = v?.trim();
  return s && isAddress(s) ? (s as Address) : null;
};

/** The game token — the one address the operator has to provide. */
export const TOKEN_ADDRESS = read(process.env.NEXT_PUBLIC_TOKEN_ADDRESS);
export const TOKEN_DECIMALS = Number(process.env.NEXT_PUBLIC_TOKEN_DECIMALS ?? 18) || 18;
/** Owner: tunes the config, receives the treasury share unless a treasury is set. */
export const OWNER_ADDRESS = read(process.env.NEXT_PUBLIC_OWNER_ADDRESS);
export const TREASURY_ADDRESS = read(process.env.NEXT_PUBLIC_TREASURY_ADDRESS) ?? OWNER_ADDRESS;
/** Address of the randomness server's signing key (the key itself lives in RANDOM_SIGNER_KEY, server-side). */
export const RANDOM_SIGNER_ADDRESS = read(process.env.NEXT_PUBLIC_RANDOM_SIGNER_ADDRESS);

/** Arachnid's deterministic deployment proxy — present on Robinhood Chain and most EVM chains. */
export const CREATE2_PROXY = "0x4e59b44847b379578588920cA78FbF26c0B4956C" as const;
export const DEPLOY_SALT: Hex = keccak256(toHex("starminer:game:v1"));

export const constructorReady = Boolean(TOKEN_ADDRESS && OWNER_ADDRESS && TREASURY_ADDRESS && RANDOM_SIGNER_ADDRESS);

export function constructorArgs() {
  if (!constructorReady) throw new Error("Game constructor arguments are not configured");
  return [TOKEN_ADDRESS!, OWNER_ADDRESS!, TREASURY_ADDRESS!, RANDOM_SIGNER_ADDRESS!, contractHulls(TOKEN_DECIMALS), contractPlanets(TOKEN_DECIMALS)] as const;
}

/** Creation code + encoded constructor arguments: what the proxy deploys. */
export function gameInitCode(): Hex | null {
  if (!constructorReady) return null;
  return encodeDeployData({ abi: STARMINER_GAME_ABI, bytecode: STARMINER_GAME_BYTECODE, args: constructorArgs() });
}

/** Where the game lives: an explicit override, else the CREATE2 address of the current config. */
export const GAME_ADDRESS: Address | null = (() => {
  const explicit = read(process.env.NEXT_PUBLIC_GAME_ADDRESS);
  if (explicit) return explicit;
  const init = gameInitCode();
  return init ? getCreate2Address({ from: CREATE2_PROXY, salt: DEPLOY_SALT, bytecode: init }) : null;
})();

export const contractsConfigured = Boolean(GAME_ADDRESS && TOKEN_ADDRESS);

export function missingConfig(): string[] {
  const out: string[] = [];
  if (!TOKEN_ADDRESS) out.push("NEXT_PUBLIC_TOKEN_ADDRESS (the token CA)");
  if (!OWNER_ADDRESS) out.push("NEXT_PUBLIC_OWNER_ADDRESS");
  if (!RANDOM_SIGNER_ADDRESS) out.push("NEXT_PUBLIC_RANDOM_SIGNER_ADDRESS");
  return out;
}

export const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || "";
