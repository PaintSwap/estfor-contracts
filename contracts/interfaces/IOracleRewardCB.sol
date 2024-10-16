// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IOracleRewardCB {
  function newOracleRandomWords(uint256 randomWord) external;
}
