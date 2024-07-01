// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Item} from "../globals/players.sol";

interface IItemNFT {
  function balanceOfs(address account, uint16[] memory ids) external view returns (uint[] memory);

  function balanceOf(address account, uint256 id) external view returns (uint256);

  function getItem(uint16 tokenId) external view returns (Item memory);

  function getItems(uint16[] calldata tokenIds) external view returns (Item[] memory);
}
