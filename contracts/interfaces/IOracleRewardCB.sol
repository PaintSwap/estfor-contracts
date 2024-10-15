// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IOracleRewardCB {
  function newOracleRandomWords(uint randomWord) external;
}
