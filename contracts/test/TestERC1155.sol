// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";

contract TestERC1155 is ERC1155, IERC2981 {
  address public immutable royaltyRecipient;
  uint64 public nextId = 1;
  uint64 public royaltyFee; // Base 10000

  constructor(address recipient) ERC1155("") {
    royaltyRecipient = recipient;
  }

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

  function royaltyInfo(
    uint256 /*_tokenId*/,
    uint256 salePrice
  ) external view override returns (address receiver, uint256 royaltyAmount) {
    uint256 amount = (salePrice * royaltyFee) / 10000;
    return (royaltyRecipient, amount);
  }

  function setRoyaltyFee(uint64 fee) external {
    royaltyFee = fee;
  }

  function supportsInterface(bytes4 interfaceId) public view override(ERC1155, IERC165) returns (bool) {
    return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
  }
}
