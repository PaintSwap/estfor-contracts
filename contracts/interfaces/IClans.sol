// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ClanRank} from "../globals/clans.sol";

interface IClans {
  function canWithdraw(uint256 _clanId, uint256 _playerId) external view returns (bool);

  function isClanMember(uint256 clanId, uint256 playerId) external view returns (bool);

  function maxBankCapacity(uint256 clanId) external view returns (uint16);

  function maxMemberCapacity(uint256 clanId) external view returns (uint16);

  function getRank(uint256 clanId, uint256 playerId) external view returns (ClanRank);

  function setMMR(uint256 clanId, uint16 mmr) external;

  function getMMR(uint256 clanId) external view returns (uint16);
}
