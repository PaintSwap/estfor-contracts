// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./ItemNFT.sol";

// This contains things related to addresses (EOAs & contracts) representing a user
// which may be in control of many players. For instance keep track of how many items this user has equipped
contract Users is OwnableUpgradeable, UUPSUpgradeable {
  ItemNFT private itemNFT;
  address private players;

  mapping(address => mapping(uint => uint)) public numEquipped; // user => item tokenId => num equipped

  modifier onlyPlayers() {
    require(msg.sender == players, "Not a player");
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize() public initializer {
    __Ownable_init();
    __UUPSUpgradeable_init();
  }

  function set(address _players, ItemNFT _itemNFT) external onlyOwner {
    require(_players != address(0));
    require(address(_itemNFT) != address(0));
    players = _players;
    itemNFT = _itemNFT;
  }

  function minorEquip(address _from, uint16 _itemTokenId, uint16 _amount) external onlyPlayers {
    numEquipped[_from][_itemTokenId] += _amount;
  }

  // This will revert if there is not enough free balance to equip
  function equip(address _from, uint16 _itemTokenId) external onlyPlayers {
    uint256 balance = itemNFT.balanceOf(_from, uint(_itemTokenId));
    require(balance >= numEquipped[_from][_itemTokenId] + 1, "Do not have enough quantity to equip");
    //    require(_tokenId > 1 && _tokenId < 256);
    numEquipped[_from][_itemTokenId] += 1;
  }

  function unequip(address _from, uint _itemTokenId) external onlyPlayers {
    numEquipped[_from][_itemTokenId] -= 1;
  }

  function minorUnequip(address _from, uint16 _itemTokenId, uint16 _amount) external onlyPlayers {
    numEquipped[_from][_itemTokenId] -= _amount;
  }

  function itemAmountUnavailable(address _from, uint _itemTokenId) external view returns (uint) {
    return numEquipped[_from][_itemTokenId];
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
