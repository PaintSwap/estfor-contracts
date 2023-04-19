// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import {IClans} from "../interfaces/IClans.sol";
import {IPlayers} from "../interfaces/IPlayers.sol";

contract BankRegistry is UUPSUpgradeable, OwnableUpgradeable {
  address public bankImpl;
  IERC1155 public itemNFT;
  IERC1155 public playerNFT;
  IClans public clans;
  IPlayers public players;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    address _bankImpl,
    IERC1155 _itemNFT,
    IERC1155 _playerNFT,
    IClans _clans,
    IPlayers _players
  ) public initializer {
    __Ownable_init();
    __UUPSUpgradeable_init();
    bankImpl = _bankImpl;
    itemNFT = _itemNFT;
    playerNFT = _playerNFT;
    clans = _clans;
    players = _players;
  }

  function setBankImpl(address _bankImpl) external onlyOwner {
    bankImpl = _bankImpl;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
