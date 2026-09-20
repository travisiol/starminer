// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IPlayerProgression — XP, level, planet unlocks.
/// @notice Written only by MissionManager (missions, discovery) and ShipShop (milestones).
///         Unlock rules mirror src/game/config/planets.ts: previous world mined + mission count + zone level.
interface IPlayerProgression {
    struct Progress {
        uint32 xp;
        uint8 level;
        uint32 missionsCompleted;
        uint32 missionsSucceeded;
        uint8 furthestPlanet;
    }

    function progressOf(address player) external view returns (Progress memory);
    function successesOn(address player, uint8 planetId) external view returns (uint32);
    function isUnlocked(address player, uint8 planetId) external view returns (bool);
    function isScanned(address player, uint8 planetId) external view returns (bool);
    function levelForXp(uint32 xp) external pure returns (uint8);

    function recordMission(address player, uint8 planetId, bool success, uint32 xp) external;
    function grantXp(address player, uint32 xp, bytes32 reason) external;

    event XpGranted(address indexed player, uint32 xp, bytes32 reason);
    event LevelUp(address indexed player, uint8 level);
    event PlanetUnlocked(address indexed player, uint8 indexed planetId);
}
