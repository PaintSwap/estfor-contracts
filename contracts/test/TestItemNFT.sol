//SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "../ItemNFT.sol";
import "../interfaces/IBrushToken.sol";
import "../World.sol";
import "../Users.sol";

contract TestItemNFT is ItemNFT {
  constructor(IBrushToken _brush, World _world, Users _users) ItemNFT(_brush, _world, _users) {}

  function testMint(address _to, uint _tokenId, uint _amount) external {
    _mintItem(_to, _tokenId, _amount);
  }

  function testMints(address _to, uint[] calldata _tokenIds, uint[] calldata _amounts) external {
    _mintBatchItems(_to, _tokenIds, _amounts);
  }
}
