// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UUPSUpgradeable} from "../ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../ozUpgradeable/access/OwnableUpgradeable.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import {IClans} from "../interfaces/IClans.sol";
import {IPlayers} from "../interfaces/IPlayers.sol";

contract BankRegistry is UUPSUpgradeable, OwnableUpgradeable {
  address public bankImpl; // Keep this same as it's used by the deleted BankProxy which is used by some old banks
  IERC1155 public itemNFT;
  IERC1155 public playerNFT;
  IClans public clans;
  IPlayers public players;
  address public lockedBankVaults;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(IERC1155 _itemNFT, IERC1155 _playerNFT, IClans _clans, IPlayers _players) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();

    itemNFT = _itemNFT;
    playerNFT = _playerNFT;
    clans = _clans;
    players = _players;
  }

  // This is only to allow upgrading the bank implementation of old beta clans created.
  // In the first week which did not use the beacon proxy setup, used the now deleted BankProxy.sol
  function setBankImpl(address _bankImpl) external onlyOwner {
    bankImpl = _bankImpl;
  }

  function setLockedBankVaults(address _lockedBankVaults) external onlyOwner {
    lockedBankVaults = _lockedBankVaults;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
