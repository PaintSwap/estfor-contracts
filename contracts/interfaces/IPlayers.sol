// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../globals/misc.sol";

interface IPlayers {
  function clearEverythingBeforeTokenTransfer(address from, uint tokenId) external;

  function getURI(
    uint playerId,
    string calldata name,
    string calldata avatarName,
    string calldata avatarDescription,
    string calldata imageURI
  ) external view returns (string memory);

  function mintedPlayer(
    address from,
    uint playerId,
    Skill[2] calldata startSkills,
    bool makeActive,
    uint[] calldata startingItemTokenIds,
    uint[] calldata startingAmounts
  ) external;

  function isOwnerOfPlayerAndActive(address from, uint playerId) external view returns (bool);

  function activePlayer(address owner) external view returns (uint playerId);
}
