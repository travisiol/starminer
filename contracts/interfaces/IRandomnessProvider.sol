// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IRandomnessProvider — the only source of randomness for live missions.
/// @notice Implementations: a VRF adapter (request → async fulfil), a commit-reveal scheme, or a
///         block-hash fallback for test networks. MissionManager never depends on which one.
interface IRandomnessProvider {
    /// @dev Returns a request id; the provider later calls IMissionManager.fulfillRandomness.
    function request(uint256 missionId) external returns (bytes32 requestId);
    function isFulfilled(bytes32 requestId) external view returns (bool);
    function randomWord(bytes32 requestId) external view returns (uint256);
    /// @return a short label surfaced to players ("vrf", "commit-reveal", "blockhash-test").
    function kind() external view returns (string memory);

    event RandomnessRequested(bytes32 indexed requestId, uint256 indexed missionId);
    event RandomnessFulfilled(bytes32 indexed requestId, uint256 randomWord);
}
