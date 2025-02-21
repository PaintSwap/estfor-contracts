// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

import {IItemNFT} from "../interfaces/IItemNFT.sol";
import {Item} from "../globals/players.sol";

contract MockItemNFT is IItemNFT, ERC1155 {
  constructor() ERC1155("MockItemNFT") {}

  function mint(address account, uint256 id, uint256 amount) external {
    _mint(account, id, amount, "");
  }

  function mintBatch(address to, uint256[] calldata ids, uint256[] calldata quantities) external {
    _mintBatch(to, ids, quantities, "");
  }

  function balanceOf(address account, uint256 id) public view override(ERC1155, IItemNFT) returns (uint256) {
    return super.balanceOf(account, id);
  }

  function balanceOfs(address account, uint16[] memory ids) external view returns (uint256[] memory) {
    uint256[] memory balances = new uint256[](ids.length);
    for (uint256 i = 0; i < ids.length; i++) {
      balances[i] = balanceOf(account, ids[i]);
    }
    return balances;
  }

  function balanceOfs10(address account, uint16[10] memory ids) external view returns (uint256[] memory) {
    uint256[] memory balances = new uint256[](10);
    for (uint256 i = 0; i < 10; i++) {
      balances[i] = balanceOf(account, ids[i]);
    }
    return balances;
  }

  function getItem(uint16 /* tokenId */) external pure returns (Item memory) {
    revert("not implemented");
  }

  function getItems(uint16[] calldata /* tokenIds */) external pure returns (Item[] memory) {
    revert("not implemented");
  }

  function totalSupply(
    uint256 /* id */
  )
    public
    pure
    override
    returns (
      uint256 // ERC1155Supply
    )
  {
    revert("not implemented");
  }

  function totalSupply()
    external
    pure
    returns (
      uint256 // ERC1155Supply
    )
  {
    revert("not implemented");
  }

  function burn(address account, uint256 id, uint256 value) external {
    _burn(account, id, value);
  }

  function burnBatch(address account, uint256[] calldata ids, uint256[] calldata values) external {
    _burnBatch(account, ids, values);
  }

  function getTimestampFirstMint(uint256 /* id */) external pure returns (uint256) {
    revert("not implemented");
  }

  function exists(uint256 /* id */) external pure returns (bool) {
    revert("not implemented");
  }
}
