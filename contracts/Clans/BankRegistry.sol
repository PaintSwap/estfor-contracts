// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UUPSUpgradeable} from "../ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../ozUpgradeable/access/OwnableUpgradeable.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import {IClans} from "../interfaces/IClans.sol";
import {IPlayers} from "../interfaces/IPlayers.sol";

contract BankRegistry is UUPSUpgradeable, OwnableUpgradeable {
  /// @custom:oz-renamed-from bankImpl
  address public dummy;
  IERC1155 public itemNFT;
  IERC1155 public playerNFT;
  IClans public clans;
  IPlayers public players;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(IERC1155 _itemNFT, IERC1155 _playerNFT, IClans _clans, IPlayers _players) public initializer {
    __Ownable_init();
    __UUPSUpgradeable_init();
    itemNFT = _itemNFT;
    playerNFT = _playerNFT;
    clans = _clans;
    players = _players;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
