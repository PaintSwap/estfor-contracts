//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract TestERC721 is ERC721 {
  constructor() ERC721("TestERC721", "TESTERC721") {}

  uint256 currentId;

  function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
    return super.tokenURI(tokenId);
  }

  function mint(address to) external {
    _safeMint(to, ++currentId);
  }
}
