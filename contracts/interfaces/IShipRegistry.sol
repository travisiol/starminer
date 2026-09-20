// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IShipRegistry — the hull catalogue and ship ownership.
/// @notice Ownership model is a deployment choice: the same interface can sit over an ERC-721
///         (transferable) or over a plain mapping (non-transferable game asset). The game UI never
///         exposes the difference; it only asks "which ships does this player own?".
interface IShipRegistry {
    struct Hull {
        bytes32 id;          // keccak256("scout-01")
        uint8 class;         // 0 scout … 5 capital
        uint32 fleetPower;   // base power at MK-I
        uint128 price;       // in token units
        uint8 levelRequired;
        bool available;
    }

    struct Ship {
        uint256 shipId;
        bytes32 hullId;
        uint8 mark;          // 1..5
        uint8 condition;     // 100 = pristine (reserved for the damage system)
        uint64 acquiredAt;
    }

    function hull(bytes32 hullId) external view returns (Hull memory);
    function hullIds() external view returns (bytes32[] memory);
    function ownerOf(uint256 shipId) external view returns (address);
    function ship(uint256 shipId) external view returns (Ship memory);
    function shipsOf(address player) external view returns (Ship[] memory);
    /// @dev Power of a ship at its current mark: base × (1 + markStepBps × (mark − 1) / 10000).
    function powerOf(uint256 shipId) external view returns (uint32);
    function transferable() external view returns (bool);

    /// @dev Only ShipShop may mint; only ShipUpgradeManager may set marks; only MissionManager may set condition.
    function mint(address to, bytes32 hullId) external returns (uint256 shipId);
    function setMark(uint256 shipId, uint8 mark) external;
    function setCondition(uint256 shipId, uint8 condition) external;

    event ShipMinted(address indexed to, uint256 indexed shipId, bytes32 indexed hullId);
    event ShipRefitted(uint256 indexed shipId, uint8 mark);
    event HullListed(bytes32 indexed hullId, uint32 fleetPower, uint128 price, uint8 levelRequired);
}
