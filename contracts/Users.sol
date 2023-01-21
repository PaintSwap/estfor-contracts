// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./ItemNFT.sol";
import "./PlayerNFT.sol";

// This contains things related to addresses (EOAs & contracts) representing a user
// which may be in control of many players. For instance keep track of how many items this user has equipped
contract Users is Ownable {
  ItemNFT private itemNFT;
  PlayerNFT private playerNFT;

  mapping(address => mapping(uint => uint)) public numEquipped; // user => item tokenId => num equipped

  modifier onlyPlayerNFT() {
    require(address(playerNFT) == msg.sender, "Not a player");
    _;
  }

  function setNFTs(PlayerNFT _playerNFT, ItemNFT _itemNFT) external onlyOwner {
    require(address(_playerNFT) != address(0));
    require(address(_itemNFT) != address(0));
    playerNFT = _playerNFT;
    itemNFT = _itemNFT;
  }

  function minorEquip(address _from, uint16 _itemTokenId, uint8 _amount) external onlyPlayerNFT {
    numEquipped[_from][_itemTokenId] += _amount;
  }

  // This will revert if there is not enough free balance to equip
  function equip(address _from, uint16 _itemTokenId) external onlyPlayerNFT {
    uint256 balance = itemNFT.balanceOf(_from, uint(_itemTokenId));
    require(balance >= numEquipped[_from][_itemTokenId] + 1, "Do not have enough quantity to equip");
    //    require(_tokenId > 1 && _tokenId < 256);
    numEquipped[_from][_itemTokenId] += 1;
  }

  function unequip(address _from, uint _itemTokenId) external onlyPlayerNFT {
    numEquipped[_from][_itemTokenId] -= 1;
  }

  function minorUnequip(address _from, uint16 _itemTokenId, uint8 _amount) external onlyPlayerNFT {
    numEquipped[_from][_itemTokenId] -= _amount;
  }

  function itemAmountUnavailable(address _from, uint _itemTokenId) external view returns (uint) {
    return numEquipped[_from][_itemTokenId];
  }
}
