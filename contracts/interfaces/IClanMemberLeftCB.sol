// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IClanMemberLeftCB {
  function clanMemberLeft(uint256 clanId, uint256 playerId) external;
}
