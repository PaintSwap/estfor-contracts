// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IClans {
  function canWithdraw(uint _clanId, uint _playerId) external view returns (bool);

  function isClanMember(uint clanId, uint playerId) external view returns (bool);

  function maxBankCapacity(uint clanId) external view returns (uint16);

  function maxMemberCapacity(uint clanId) external view returns (uint16);
}
