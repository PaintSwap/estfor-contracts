// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../globals/misc.sol";
import "../globals/players.sol";

interface IPlayers {
  function clearEverythingBeforeTokenTransfer(address from, uint256 tokenId) external;

  function beforeTokenTransferTo(address to, uint256 tokenId) external;

  function getURI(
    uint256 playerId,
    string calldata name,
    string calldata avatarName,
    string calldata avatarDescription,
    string calldata imageURI
  ) external view returns (string memory);

  function mintedPlayer(
    address from,
    uint256 playerId,
    Skill[2] calldata startSkills,
    bool makeActive,
    uint256[] calldata startingItemTokenIds,
    uint256[] calldata startingAmounts
  ) external;

  function upgradePlayer(uint256 playerId) external;

  function isPlayerUpgraded(uint256 playerId) external view returns (bool);

  function isOwnerOfPlayerAndActive(address from, uint256 playerId) external view returns (bool);

  function getActivePlayer(address owner) external view returns (uint256 playerId);

  function xp(uint256 playerId, Skill skill) external view returns (uint256 xp);

  function level(uint256 playerId, Skill skill) external view returns (uint256 level);

  function totalXP(uint256 playerId) external view returns (uint256 xp);

  function activeBoost(uint256 playerId) external view returns (PlayerBoostInfo memory);
}
