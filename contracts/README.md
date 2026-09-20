# STARMINER — contract architecture (interfaces only)

Live mode runs on any EVM chain. These interfaces are the contract surface the frontend is built
against; nothing is deployed yet and `.env.example` leaves every address empty on purpose.

| Contract               | Role                                                                            | Writes to                     |
| ---------------------- | ------------------------------------------------------------------------------- | ----------------------------- |
| `IGameToken`           | The native token (`$STAR` placeholder). Plain ERC-20.                           | —                             |
| `IShipRegistry`        | Hull catalogue + ship ownership (ERC-721 or non-transferable, same interface).  | —                             |
| `IShipShop`            | Primary sink: pulls the price, routes a share to the vault, mints the ship.     | Registry, Vault, Progression  |
| `IFleetManager`        | The active fleet: three slots, Fleet Power, frozen during missions.             | —                             |
| `IMissionManager`      | Launch / resolve / claim. Stores the probability shown at launch. Never rolls.  | Vault, Progression, Registry  |
| `IRewardVault`         | Finite reward pool. Pays what it has, never more.                               | Token                         |
| `IPlayerProgression`   | XP, level, unlocks, scans.                                                      | —                             |
| `IRandomnessProvider`  | VRF / commit-reveal / test adapter behind one interface.                        | MissionManager (fulfil)       |
| `IShipUpgradeManager`  | Optional refits MK-I → MK-V, secondary sink.                                    | Registry, Vault               |
| `IShipMarket`          | Player-to-player hull sales: list, cancel, buy. Fee (2.5%) to the vault.        | Registry (escrow), Vault      |

## Flow

```
approve(ShipShop, price)  →  ShipShop.buy(hull)     →  Registry.mint, Vault.deposit(share)
FleetManager.equip(slot, shipId) × ≤3               →  fleetPower() = Σ powerOf × traits × commander bonus
MissionManager.launch(planet)                       →  stores probabilityBps (same curve as the client), endsAt
… endsAt passes …
MissionManager.resolve(id)                          →  RandomnessProvider.request → fulfillRandomness → success / reward
MissionManager.claim(id)                            →  Vault.pay(player, reward), Progression.recordMission
```

## Invariants the frontend relies on

- `probabilityBps` is never 10000 (cap 9900) and is fixed at launch.
- A mission below `minimumPower` cannot be launched; the shown chance is 0.
- Failure pays 0 and never changes ship ownership. `condition` is reserved for a future damage system.
- Rewards are paid from `RewardVault.available()` only; the UI shows that number.
- The client never generates randomness in live mode (`OnchainRandomProvider` throws on `roll`).

The TypeScript side reads these through `src/config/contracts.ts` and shows "not configured"
states until the addresses are set.
