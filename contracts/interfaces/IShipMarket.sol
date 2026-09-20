// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IShipMarket — commanders sell hulls to each other.
/// @notice Listing escrows the ship in the registry (it leaves the seller's fleet); buying pulls the
///         price in GameToken, pays the seller minus `feeBps`, routes the fee to the RewardVault and
///         hands the ship to the buyer. Requires a transferable registry (ERC-721 mode).
interface IShipMarket {
    enum Status { Open, Sold, Cancelled }

    struct Listing {
        uint256 id;
        uint256 shipId;
        address seller;
        uint256 price;
        uint64 listedAt;
        Status status;
        address buyer;
    }

    function feeBps() external view returns (uint16);
    function listing(uint256 listingId) external view returns (Listing memory);
    function openListings(uint256 offset, uint256 limit) external view returns (Listing[] memory);
    function listingsOf(address seller) external view returns (Listing[] memory);
    /// @return value the hull's shop price at its current mark — the reference the UI shows next to the ask.
    function referenceValue(uint256 shipId) external view returns (uint256 value);

    function list(uint256 shipId, uint256 price) external returns (uint256 listingId);
    function cancel(uint256 listingId) external;
    function buy(uint256 listingId) external;

    event Listed(uint256 indexed listingId, uint256 indexed shipId, address indexed seller, uint256 price);
    event Cancelled(uint256 indexed listingId);
    event Sold(uint256 indexed listingId, address indexed buyer, uint256 price, uint256 fee);
}
