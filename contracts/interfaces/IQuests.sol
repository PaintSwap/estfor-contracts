// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IQuests {
  function newOracleRandomWords(uint[3] calldata randomWords) external;
}
