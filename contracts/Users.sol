// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./ItemNFT.sol";
import "./PlayerNFT.sol";

// This contains things related to addresses (EOAs & contracts) representing a user
// which may be in control of many players. For instance keep track of how many items this user has equipped
contract Users is Ownable {
  ItemNFT private itemsNFT;
  PlayerNFT private playerNFT;

  mapping(address => mapping(uint256 => uint256)) public numEquipped; // user => tokenId => num equipped
  mapping(address => mapping(uint256 => uint256)) public numInventory; // user => tokenId => num inventory

  modifier onlyPlayerNFT() {
    require(address(playerNFT) == msg.sender);
    _;
  }

  function setItemsNFT(ItemNFT _itemsNFT) external onlyOwner {
    itemsNFT = _itemsNFT;
  }

  function setPlayerNFT(PlayerNFT _playerNFT) external onlyOwner {
    playerNFT = _playerNFT;
  }

  // This will revert if there is not enough free balance to equip
  function equip(address _from, uint256 _tokenId) external onlyPlayerNFT {
    uint256 balance = itemsNFT.balanceOf(_from, _tokenId);
    require(
      balance >= numEquipped[_from][_tokenId] + 1 + numInventory[_from][_tokenId],
      "Do not have enough quantity to equip"
    );
    require(_tokenId > 1 && _tokenId < 256);
    numEquipped[_from][_tokenId] += 1;
  }

  function unequip(address _from, uint256 _tokenId) external onlyPlayerNFT {
    numEquipped[_from][_tokenId] -= 1;
  }

  function addInventory(
    address _from,
    uint256 _tokenId,
    uint256 _amount
  ) external onlyPlayerNFT {
    uint256 balance = itemsNFT.balanceOf(_from, _tokenId);
    require(
      balance >= numInventory[_from][_tokenId] + numEquipped[_from][_tokenId] + _amount,
      "Do not have enough quantity to add to inventory"
    );
    require(_tokenId > 1 && _tokenId < 256);
    numInventory[_from][_tokenId] += _amount;
  }

  function removeInventory(
    address _from,
    uint256 _tokenId,
    uint256 _amount
  ) external onlyPlayerNFT {
    numInventory[_from][_tokenId] -= _amount;
  }

  function itemAmountUnavailable(address _from, uint _tokenId) external view returns (uint) {
    return numEquipped[_from][_tokenId] + numInventory[_from][_tokenId];
  }
}
