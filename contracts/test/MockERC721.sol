//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockERC721 is ERC721 {
  constructor() ERC721("MockERC721", "MOCKERC721") {}

  uint256 currentId;

  function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
    return super.tokenURI(tokenId);
  }

  function mint(address _to) external {
    _safeMint(_to, ++currentId);
  }
}
