// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

struct Clan {
  uint80 owner; // player id
  uint16 maxCapacity;
  uint24 maxImageId;
  uint24 imageId;
  uint16 memberCount;
  uint40 createdTimestamp;
  uint8 tierId;
  mapping(uint playerId => bool onlyClanAdmin) admins;
  mapping(uint playerId => bool isMember) members;
  mapping(uint playerId => bool invited) inviteRequests;
}

interface IClans {
  function isClanAdmin(uint clanId, uint playerId) external view returns (bool);

  function maxCapacity(uint clanId) external view returns (uint16);
}
