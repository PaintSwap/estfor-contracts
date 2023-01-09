//SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "../NFT.sol";

contract TestPaintScapeNFT is PaintScapeNFT {
  constructor(address _brush) PaintScapeNFT(_brush) {}

  function testMint(
    address _to,
    uint256 _tokenId,
    uint256 _amount
  ) external {
    _mint(_to, _tokenId, _amount, "");
  }
}
