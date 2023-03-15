// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Skill} from "../globals/players.sol";

interface IPlayers {
  function clearEverythingBeforeTokenTransfer(address from, uint tokenId) external;

  function getURI(
    uint playerId,
    bytes32 name,
    bytes32 avatarName,
    string calldata avatarDescription,
    string calldata imageURI
  ) external view returns (string memory);

  function mintBatch(address to, uint[] calldata ids, uint256[] calldata amounts) external;

  function itemBeforeTokenTransfer(address from, uint[] calldata tokenIds, uint256[] calldata amounts) external;

  function mintedPlayer(address from, uint playerId, Skill[2] calldata startSkills, bool makeActive) external;
}
