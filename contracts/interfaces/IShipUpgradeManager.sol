// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IShipUpgradeManager — refits MK-I → MK-V (optional module, secondary sink).
/// @notice Cost = price × costRateBps × targetMark / 10000; power step per mark comes from the registry.
///         Marks stop at 5: upgrades never scale infinitely.
interface IShipUpgradeManager {
    function maxMark() external view returns (uint8);
    function refitCost(uint256 shipId) external view returns (uint256 cost, uint8 targetMark);
    function refit(uint256 shipId) external;

    event Refitted(address indexed player, uint256 indexed shipId, uint8 mark, uint256 cost, uint256 toVault);
}
