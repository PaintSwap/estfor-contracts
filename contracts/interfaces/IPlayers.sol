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

  function isPlayerEvolved(uint256 playerId) external view returns (bool);

  function isOwnerOfPlayerAndActive(address from, uint256 playerId) external view returns (bool);

  function getAlphaCombatParams() external view returns (uint8 alphaCombat, uint8 betaCombat, uint8 alphaCombatHealing);

  function getActivePlayer(address owner) external view returns (uint256 playerId);

  function getPlayerXP(uint256 playerId, Skill skill) external view returns (uint256 xp);

  function getLevel(uint256 playerId, Skill skill) external view returns (uint256 level);

  function getTotalXP(uint256 playerId) external view returns (uint256 totalXP);

  function getTotalLevel(uint256 playerId) external view returns (uint256 totalLevel);

  function getActiveBoost(uint256 playerId) external view returns (ExtendedBoostInfo memory);

  function modifyXP(address from, uint256 playerId, Skill skill, uint56 xp, bool skipEffects) external;

  function beforeItemNFTTransfer(address from, address to, uint256[] calldata ids, uint256[] calldata amounts) external;
}
