//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IBankFactory {
  function getBankAddress(uint256 clanId) external view returns (address);

  function getCreatedHere(address bank) external view returns (bool);

  function createBank(address from, uint256 clanId) external returns (address);
}
