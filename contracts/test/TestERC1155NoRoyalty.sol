// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";

contract TestERC1155NoRoyalty is ERC1155 {
  uint64 public nextId = 1;

  constructor() ERC1155("") {}

  function mint(address to, uint256 quantity) external {
    _mint(to, nextId++, quantity, "");
  }

  function mintSpecificId(address to, uint256 id, uint256 quantity) external {
    _mint(to, id, quantity, "");
  }

  function mintBatch(address to, uint256[] memory amounts) external {
    uint256[] memory ids = new uint256[](amounts.length);
    for (uint256 i = 0; i < amounts.length; ++i) {
      ids[i] = nextId++;
    }
    _mintBatch(to, ids, amounts, "");
  }
}
