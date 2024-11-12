// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Item} from "../globals/players.sol";

interface IItemNFT {
  function balanceOfs(address account, uint16[] memory ids) external view returns (uint256[] memory);

  function balanceOfs10(address account, uint16[10] memory ids) external view returns (uint256[] memory);

  function balanceOf(address account, uint256 id) external view returns (uint256);

  function getItem(uint16 tokenId) external view returns (Item memory);

  function getItems(uint16[] calldata tokenIds) external view returns (Item[] memory);

  function totalSupply(uint256 id) external view returns (uint256); // ERC1155Supply

  function totalSupply() external view returns (uint256); // ERC1155Supply

  function mint(address to, uint256 id, uint256 quantity) external;

  function mintBatch(address to, uint256[] calldata ids, uint256[] calldata quantities) external;

  function burn(address account, uint256 id, uint256 value) external;

  function burnBatch(address account, uint256[] calldata ids, uint256[] calldata values) external;

  function getTimestampFirstMint(uint256 id) external view returns (uint256);

  function exists(uint256 id) external view returns (bool);
}
