// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IMissionManager — launch, resolve and claim mining expeditions.
/// @notice One active mission per player. The success probability is computed onchain from the same
///         curve as the client (see src/game/math/miningProbability.ts) and stored at launch so the
///         number the player saw is the number that resolves. Randomness comes from IRandomnessProvider;
///         the client never rolls. Failure pays nothing and never burns ships.
interface IMissionManager {
    enum Status { None, InProgress, Resolved, Claimed }

    struct Mission {
        uint256 id;
        address player;
        uint8 planetId;          // 1..30
        uint256[3] shipIds;
        uint32 fleetPower;
        uint16 probabilityBps;   // 0..9900 — never 10000
        uint64 startedAt;
        uint64 endsAt;
        Status status;
        bool success;
        uint256 reward;
        bool rareDrop;
        bytes32 randomnessRequest;
    }

    struct PlanetParams {
        uint32 minimumPower;
        uint32 recommendedPower;
        uint32 durationSeconds;
        uint128 rewardMin;
        uint128 rewardMax;
        uint16 rareDropBps;
        uint32 xp;
    }

    function planet(uint8 planetId) external view returns (PlanetParams memory);
    function activeMission(address player) external view returns (Mission memory);
    function mission(uint256 missionId) external view returns (Mission memory);
    /// @return bps success chance for the fleet on the planet, 0 when below minimum; capped at 9900.
    function successChance(address player, uint8 planetId) external view returns (uint16 bps);
    function canLaunch(address player, uint8 planetId) external view returns (bool ok, string memory reason);

    function launch(uint8 planetId) external returns (uint256 missionId);
    /// @dev Anyone may resolve a due mission (keeper-friendly). Requests randomness if not yet fulfilled.
    function resolve(uint256 missionId) external;
    function claim(uint256 missionId) external;

    /// @dev Called by the randomness provider.
    function fulfillRandomness(bytes32 requestId, uint256 randomWord) external;

    event MissionLaunched(address indexed player, uint256 indexed missionId, uint8 indexed planetId, uint32 fleetPower, uint16 probabilityBps, uint64 endsAt);
    event MissionResolved(uint256 indexed missionId, bool success, uint256 reward, bool rareDrop, uint256 roll);
    event RewardClaimed(address indexed player, uint256 indexed missionId, uint256 reward);
}
