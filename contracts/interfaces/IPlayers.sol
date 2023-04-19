// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Skill} from "../globals/players.sol";

interface IPlayers {
  function clearEverythingBeforeTokenTransfer(address from, uint tokenId) external;

  function getURI(
    uint playerId,
    string calldata name,
    string calldata avatarName,
    string calldata avatarDescription,
    string calldata imageURI
  ) external view returns (string memory);

  function mintBatch(address to, uint[] calldata ids, uint256[] calldata amounts) external;

  function mintedPlayer(address from, uint playerId, Skill[2] calldata startSkills, bool makeActive) external;

  function isOwnerOfPlayer(address from, uint playerId) external view returns (bool);

  function isOwnerOfPlayerAndActive(address from, uint playerId) external view returns (bool);

  function activePlayer(address owner) external view returns (uint playerId);
}
