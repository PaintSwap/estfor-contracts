// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IClanMemberLeftCB {
  function clanMemberLeft(uint clanId, uint playerId) external;
}
