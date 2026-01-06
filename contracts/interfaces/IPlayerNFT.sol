// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

interface IPlayerNFT is IERC1155 {
  function applyAvatarToPlayer(uint256 playerId, uint24 avatarId) external;
  function unapplyAvatarFromPlayer(address owner, uint256 playerId) external;
}
