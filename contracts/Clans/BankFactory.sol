//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

import {IBankFactory} from "../interfaces/IBankFactory.sol";
import {IBank} from "../interfaces/IBank.sol";
import {IClans} from "../interfaces/IClans.sol";

contract BankFactory is UUPSUpgradeable, OwnableUpgradeable, IBankFactory {
  event BankContractCreated(address creator, uint256 clanId, address newContract);

  error OnlyClans();
  error BankAlreadyCreated();
  error BankRelayAlreadySet();

  mapping(uint256 clanId => address bank) private _bankAddress;
  // Keeps track of which vault addresses have been created here
  mapping(address => bool) private _createdHere;
  /// @custom:oz-renamed-from bankUpgradeableProxy
  address private _bankBeacon;
  address private _bankRegistry;
  address private _bankRelay;
  address private _playerNFT;
  address private _itemNFT;
  address private _clans;
  address private _players;
  address private _lockedBankVaults;

  modifier onlyClans() {
    require(address(_clans) == _msgSender(), OnlyClans());
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    address bankBeacon,
    address bankRegistry,
    address bankRelay,
    address playerNFT,
    address itemNFT,
    address clans,
    address players,
    address lockedBankVaults
  ) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init(_msgSender());

    _bankBeacon = bankBeacon;
    _bankRegistry = bankRegistry;
    _bankRelay = bankRelay;
    _playerNFT = playerNFT;
    _itemNFT = itemNFT;
    _clans = clans;
    _players = players;
    _lockedBankVaults = lockedBankVaults;
  }

  function getBankAddress(uint256 clanId) external view override returns (address) {
    return _bankAddress[clanId];
  }

  function getCreatedHere(address bank) external view override returns (bool) {
    return _createdHere[bank];
  }

  function createBank(address from, uint256 clanId) external onlyClans returns (address) {
    require(_bankAddress[clanId] == address(0), BankAlreadyCreated());

    // Create new Bank contract with EIP 1167 beacon proxy
    address proxy = address(
      new BeaconProxy(
        _bankBeacon,
        abi.encodeWithSelector(
          IBank.initialize.selector,
          clanId,
          _bankRegistry,
          _bankRelay,
          _playerNFT,
          _itemNFT,
          _clans,
          _players,
          _lockedBankVaults
        )
      )
    );

    _createdHere[proxy] = true;
    _bankAddress[clanId] = proxy;
    emit BankContractCreated(from, clanId, proxy);
    return proxy;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
