import { createPublicClient, encodePacked, http, isAddress, keccak256, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { gameChain, RPC_URL } from "@/config/chains";
import { GAME_ADDRESS, RANDOM_SIGNER_ADDRESS } from "@/config/contracts";
import { STARMINER_GAME_ABI } from "@/lib/abi/starminerGame";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  The randomness server. Stateless: every seed is derived from the    */
/*  server secret and (chain, game, player, nonce), so nothing is       */
/*  stored. Before a launch it signs the commitment; after the mission  */
/*  ends it reveals the seed. The contract mixes the seed with the      */
/*  launch block's hash — neither side can pick the outcome.            */
/* ------------------------------------------------------------------ */

const KEY = process.env.RANDOM_SIGNER_KEY?.trim() as Hex | undefined;
const account = KEY && /^0x[0-9a-fA-F]{64}$/.test(KEY) ? privateKeyToAccount(KEY) : null;
// The secret never leaves the process; seeds derive from its hash, not from the key.
const secret: Hex | null = KEY ? keccak256(encodePacked(["string", "bytes32"], ["starminer:seed:v1", keccak256(KEY)])) : null;

const client = createPublicClient({ chain: gameChain, transport: http(RPC_URL) });

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

function seedFor(player: Address, nonce: number): Hex {
  return keccak256(encodePacked(["bytes32", "uint256", "address", "address", "uint32"], [secret!, BigInt(gameChain.id), GAME_ADDRESS!, player, nonce]));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "health";

  if (action === "health") {
    return json({
      ok: Boolean(account && GAME_ADDRESS),
      signer: account?.address ?? null,
      signerMatchesConfig: Boolean(account && RANDOM_SIGNER_ADDRESS && account.address.toLowerCase() === RANDOM_SIGNER_ADDRESS.toLowerCase()),
      game: GAME_ADDRESS,
      chainId: gameChain.id,
    });
  }
  if (!account || !secret || !GAME_ADDRESS) return json({ error: "Randomness server not configured (RANDOM_SIGNER_KEY / game address)." }, 503);

  const player = url.searchParams.get("player") ?? "";
  const nonce = Number(url.searchParams.get("nonce"));
  if (!isAddress(player) || !Number.isInteger(nonce) || nonce < 0) return json({ error: "player and nonce required" }, 400);

  const seed = seedFor(player, nonce);
  const commit = keccak256(seed);

  if (action === "commit") {
    const hash = keccak256(encodePacked(["uint256", "address", "address", "uint32", "bytes32"], [BigInt(gameChain.id), GAME_ADDRESS, player, nonce, commit]));
    const signature = await account.signMessage({ message: { raw: hash } });
    return json({ commit, signature, nonce, signer: account.address });
  }

  if (action === "reveal") {
    const missionId = url.searchParams.get("mission");
    if (!missionId || !/^\d+$/.test(missionId)) return json({ error: "mission required" }, 400);
    // Reveal only for a real, finished mission that committed to this very seed.
    const m = await client.readContract({ address: GAME_ADDRESS, abi: STARMINER_GAME_ABI, functionName: "missionOf", args: [BigInt(missionId)] });
    if (m.player.toLowerCase() !== player.toLowerCase()) return json({ error: "mission belongs to another player" }, 403);
    if (m.commit !== commit) return json({ error: "nonce does not match this mission" }, 400);
    if (m.status !== 1) return json({ error: "mission is not active" }, 409);
    // Wall-clock check: the contract enforces `block.timestamp >= endsAt` itself when it resolves;
    // this only keeps seeds private until the mission is over.
    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec < Number(m.endsAt)) return json({ error: "mission not finished", endsAt: Number(m.endsAt), now: nowSec }, 425);
    return json({ seed, missionId, commit });
  }

  return json({ error: "unknown action" }, 400);
}
