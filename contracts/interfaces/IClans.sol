// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

struct Clan {
  uint80 owner; // player id
  uint24 imageId;
  uint16 memberCount;
  uint16 adminCount;
  uint40 createdTimestamp;
  uint8 tierId;
  string name;
  mapping(uint playerId => bool onlyClanAdmin) admins;
  mapping(uint playerId => bool isMember) members;
  mapping(uint playerId => bool invited) inviteRequests;
}

interface IClans {
  function isClanAdmin(uint clanId, uint playerId) external view returns (bool);

  function maxBankCapacity(uint clanId) external view returns (uint16);

  function maxMemberCapacity(uint clanId) external view returns (uint16);
}
