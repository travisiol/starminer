// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IFleetManager — the active fleet: at most three ships, one fleet per player (MVP).
/// @notice Fleet Power is computed here from the registry so the number the UI shows is the number
///         MissionManager uses. Slots are frozen while a mission is in progress.
interface IFleetManager {
    uint8 constant MAX_SHIPS = 3;

    function fleetOf(address player) external view returns (uint256[3] memory shipIds);
    /// @return basePower sum of ship powers; totalPower after class traits and commander bonus.
    function fleetPower(address player) external view returns (uint32 basePower, uint32 totalPower);
    function isLocked(address player) external view returns (bool);

    function equip(uint8 slot, uint256 shipId) external;
    function unequip(uint8 slot) external;

    event FleetChanged(address indexed player, uint256[3] shipIds, uint32 totalPower);
}
