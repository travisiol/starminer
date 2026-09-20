// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IShipShop — the primary token sink.
/// @notice Pulls the hull price in GameToken (approve first), routes the configured share to the
///         RewardVault, and mints the ship in the registry. Level gates are checked against PlayerProgression.
interface IShipShop {
    function priceOf(bytes32 hullId) external view returns (uint256);
    function vaultShareBps() external view returns (uint16);
    function canBuy(address player, bytes32 hullId) external view returns (bool ok, string memory reason);

    /// @dev Reverts unless the player has the level and the allowance. Emits Purchased on success.
    function buy(bytes32 hullId) external returns (uint256 shipId);

    event Purchased(address indexed player, bytes32 indexed hullId, uint256 indexed shipId, uint256 price, uint256 toVault);
}
