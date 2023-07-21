// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";

import {IBrushToken} from "./interfaces/IBrushToken.sol";
import {PlayerNFT} from "./PlayerNFT.sol";

contract Donation is UUPSUpgradeable, OwnableUpgradeable {
  event Donate(address from, uint playerId, uint amount, uint rolls);

  error NotOwnerOfPlayer();
  error NotEnoughBrush();

  IBrushToken public brush;
  PlayerNFT public playerNFT;
  address shop;

  modifier ownsPlayerOrEmpty(uint _playerId) {
    if (_playerId != 0 && playerNFT.balanceOf(msg.sender, _playerId) != 1) {
      revert NotOwnerOfPlayer();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(IBrushToken _brush, PlayerNFT _playerNFT, address _shop) public initializer {
    __Ownable_init();
    __UUPSUpgradeable_init();

    brush = _brush;
    playerNFT = _playerNFT;
    shop = _shop;
  }

  function donate(uint _amount, uint _playerId) external ownsPlayerOrEmpty(_playerId) {
    if (!brush.transferFrom(msg.sender, shop, _amount)) {
      revert NotEnoughBrush();
    }
    uint rolls = 0; // TODO Update later
    emit Donate(msg.sender, _playerId, _amount, rolls);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
