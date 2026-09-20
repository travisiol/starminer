# STARMINER

**BUILD YOUR FLEET. CONQUER THE SYSTEM. MINE THE UNKNOWN.**

A browser-based space mining strategy game that runs **onchain**. Thirty original worlds across six
zones, one fleet of three ships, transparent mining odds. Buy ships with the game token → build
Fleet Power → pick a planet → check the odds → launch → succeed or fail → claim → buy a stronger
ship → reach a harder planet. Players can also sell hulls to each other on the player market.

_STARMINER is a temporary brand name — see [Renaming](#renaming)._

## Run it

```bash
npm install
npm run dev        # http://localhost:3781
npm test           # 28 checks on the game core (config, curve, fleet, progression, missions)
npm run lint
npm run build
```

```bash
cd contracts && npm install
npm run compile    # solc 0.8.24, viaIR, evm paris
npm test           # 11 Hardhat tests: the whole loop on a mock token
npm run export     # → src/lib/abi/starminerGame.ts (ABI + creation bytecode)
```

## Going live (the operator's three steps)

1. **Set the token.** `NEXT_PUBLIC_TOKEN_ADDRESS` = the CA of the game token, `NEXT_PUBLIC_OWNER_ADDRESS` =
   your wallet (receives 40% of every ship purchase; the other 60% funds the reward vault).
2. **Set the randomness server.** Generate a key, put it in `RANDOM_SIGNER_KEY` (server only) and its
   address in `NEXT_PUBLIC_RANDOM_SIGNER_ADDRESS`. The server signs a commitment before every
   launch and reveals the seed after the mission ends (`/api/random`).
3. **Deploy from `/deploy`.** The game contract's address is predicted from the config (CREATE2 through
   the deterministic deployment proxy); any wallet can send the deployment. Then fund the vault.

Every `NEXT_PUBLIC_*` variable is inlined at build time: redeploy the site after changing them.
`.env.example` lists everything.

## Where things live

```
src/game/config/     planets.ts ships.ts zones.ts economy.ts missions.ts rewards.ts progression.ts
                     ← every balance number; the deploy page sends the same tables to the contract
src/game/math/       miningProbability.ts (table interpolation, bps) · fleet.ts (bps) · rewards.ts · progression.ts
src/game/math/tables.ts   GENERATED (scripts/gen-tables.ts) — the curve + level tables shared with Tables.sol
src/game/engine/     mission.ts — plan + pure resolution, identical arithmetic to StarminerGame.resolve
src/game/chain/      gameConfig.ts (config → contract structs) · client.ts (multicall reads)
src/store/           gameStore.ts — mirrors one wallet's view of the contract; actions = transactions
src/app/api/random   the randomness server (commit / reveal / health)
src/components/three planet shader, procedural hulls (ships/shipFactory.ts), system map, hangar, stage
src/app/             / (planet pager) system fleet hangar market missions leaderboard economy profile ships deploy how-it-works
contracts/           StarminerGame.sol · Tables.sol (generated) · MockToken.sol · test/ · scripts/
```

## The contract in one paragraph

`StarminerGame.sol` holds the hull catalogue and the 30 planets (constructor), mints non-transferable
ships on `buyHull` (60% of the price to the vault, 40% to the treasury), keeps one three-slot fleet
per player, computes Fleet Power and the success chance **with the same integer tables as the
client**, stores that chance in the mission at `launch`, resolves with a server-committed seed mixed
with the launch block hash (`resolveAndClaim`), pays rewards only from the vault, and runs the
player market (`list` / `cancel` / `buy`, 2.5% fee to the vault). Failure never destroys a ship. If a
seed is never revealed, `abort` frees the fleet after two days.

## Randomness

- At launch the client asks `/api/random?action=commit` for `commit = keccak(seed)` signed by the
  server key over `(chainId, game, player, nonce, commit)`; the contract checks the signature and
  records `blockhash(block.number − 1)` as entropy.
- After `endsAt`, `/api/random?action=reveal` returns the seed (only for a real, finished mission);
  the contract checks `keccak(seed) == commit` and derives the roll from `(seed, entropy, id)`.
- Neither the player (seed unknown) nor the server (entropy unknown at commit time) can choose an
  outcome; the seed is deterministic from the server secret, so nothing is stored.

## Success curve

Analytic definition in `config/missions.ts`; both sides use the generated table
(`src/game/math/tables.ts` = `contracts/contracts/Tables.sol`): minimum → 52%, recommended → 80%,
125% → 90%, 150% → 95%, 200% → 99%, capped at **99%**.

## Captures and dev tools

```bash
npm run capture                      # headless Chrome (SwiftShader) → docs/captures/*.png
# local rig: hardhat node on 8781, mock token + CREATE2 proxy + Multicall3, env lines to paste
cd contracts && npx hardhat node --port 8781
cd contracts && npx hardhat run scripts/deploy-local.ts --network localhost
```

`scripts/dev-wallet.js` is an injected wallet stub that relays to the local node (dev only).

## Renaming

The brand lives in `src/config/brand.ts` (name, wordmark, tagline, token symbol). The rest is
`package.json`, `.env.example`, this README, `.claude/launch.json`, the settings key in
`src/store/gameStore.ts` and `DEPLOY_SALT` in `src/config/contracts.ts` (a new salt = a new address).

## Economy rules the copy follows

Ships are gameplay assets. Rewards depend on mission success, planet difficulty, the reward
configuration and the reward vault. The UI never says guaranteed, profit, passive income, ROI or
investment — it says mining reward, mission reward, resource extraction.
