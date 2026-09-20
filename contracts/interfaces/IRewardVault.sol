// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IRewardVault — the finite pool mining rewards are paid from.
/// @notice Only MissionManager may pay out; a payout larger than the balance pays the balance.
///         ShipShop and ShipUpgradeManager deposit their configured share of every spend.
interface IRewardVault {
    function available() external view returns (uint256);
    function distributed() external view returns (uint256);
    function missionsPaid() external view returns (uint256);

    function deposit(uint256 amount) external;
    /// @return paid the amount actually transferred (≤ amount).
    function pay(address to, uint256 amount) external returns (uint256 paid);

    event Deposited(address indexed from, uint256 amount);
    event Paid(address indexed to, uint256 requested, uint256 paid);
}
