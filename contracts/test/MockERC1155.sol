//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract MockERC1155 is ERC1155 {
  constructor() ERC1155("") {}

  uint256 currentId;

  function mint(address to) external {
    _mint(to, ++currentId, 1, "0x");
  }

  function mintSpecific(address to, uint256 id, uint256 amount) external {
    _mint(to, id, amount, "0x");
  }
}
