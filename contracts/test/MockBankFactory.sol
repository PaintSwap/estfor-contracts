//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MockBankFactory {
  function getCreatedHere(address bank) external view returns (bool) {
    return false;
  }
}
