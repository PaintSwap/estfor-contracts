// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IBank {
  function initialize() external;

  function initializeAddresses(
    uint256 clanId,
    address bankRegistry,
    address bankRelay,
    address playerNFT,
    address itemNFT,
    address clans,
    address players,
    address lockedBankVaults,
    address raids
  ) external;

  function depositToken(address sender, address from, uint256 playerId, address token, uint256 amount) external;

  function setAllowBreachedCapacity(bool allow) external;
}
