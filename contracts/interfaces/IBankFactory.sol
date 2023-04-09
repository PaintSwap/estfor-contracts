//SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IBankFactory {
  function bankAddress(uint clanId) external view returns (address);

  function createdHere(address bank) external view returns (bool);

  function createBank(address from, uint clanId) external returns (address);
}
