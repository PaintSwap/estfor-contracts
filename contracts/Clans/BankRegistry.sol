// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import {IClans} from "../interfaces/IClans.sol";
import {IPlayers} from "../interfaces/IPlayers.sol";
import {ItemNFT} from "../ItemNFT.sol";

contract BankRegistry is UUPSUpgradeable, OwnableUpgradeable {
  address private _bankImpl; // Keep this same as it's used by the deleted BankProxy which is used by some old banks
  ItemNFT private _itemNFT;
  IERC1155 private _playerNFT;
  IClans private _clans;
  IPlayers private _players;
  address private _lockedBankVaults;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(ItemNFT itemNFT, IERC1155 playerNFT, IClans clans, IPlayers players) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init(_msgSender());

    _itemNFT = itemNFT;
    _playerNFT = playerNFT;
    _clans = clans;
    _players = players;
  }

  function getClans() external view returns (IClans) {
    return _clans;
  }

  function getPlayers() external view returns (IPlayers) {
    return _players;
  }

  function getPlayerNFT() external view returns (IERC1155) {
    return _playerNFT;
  }

  function getItemNFT() external view returns (ItemNFT) {
    return _itemNFT;
  }

  function getLockedBankVaults() external view returns (address) {
    return _lockedBankVaults;
  }

  function setLockedBankVaults(address lockedBankVaults) external onlyOwner {
    _lockedBankVaults = lockedBankVaults;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
