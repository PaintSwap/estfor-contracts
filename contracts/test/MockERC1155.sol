//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract MockERC1155 is ERC1155 {
  constructor() ERC1155("") {}

  uint currentId;

  function mint(address _to) external {
    _mint(_to, ++currentId, 1, "0x");
  }

  function mintSpecific(address _to, uint256 _id, uint256 _amount) external {
    _mint(_to, _id, _amount, "0x");
  }
}
