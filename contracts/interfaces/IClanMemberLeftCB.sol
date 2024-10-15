// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IClanMemberLeftCB {
  function clanMemberLeft(uint clanId, uint playerId) external;
}
