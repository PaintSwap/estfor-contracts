//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "../ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../ozUpgradeable/access/OwnableUpgradeable.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

import {IBankFactory} from "../interfaces/IBankFactory.sol";
import {IBank} from "../interfaces/IBank.sol";
import {IClans} from "../interfaces/IClans.sol";
import {BankRegistry} from "./BankRegistry.sol";

contract BankFactory is UUPSUpgradeable, OwnableUpgradeable, IBankFactory {
  event BankContractCreated(address creator, uint256 clanId, address newContract);

  error OnlyClans();
  error BankAlreadyCreated();

  mapping(uint256 clanId => address bank) private _bankAddress;
  // Keeps track of which vault addresses have been created here
  mapping(address => bool) private _createdHere;
  /// @custom:oz-renamed-from bankUpgradeableProxy
  address private _bankBeacon;
  address private _bankRegistry;

  modifier onlyClans() {
    require(address(BankRegistry(_bankRegistry).getClans()) == _msgSender(), OnlyClans());
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address bankRegistry, address bankBeacon) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();
    _bankRegistry = bankRegistry;
    _bankBeacon = bankBeacon;
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
      new BeaconProxy(_bankBeacon, abi.encodeWithSelector(IBank.initialize.selector, clanId, _bankRegistry))
    );
    _createdHere[proxy] = true;
    _bankAddress[clanId] = proxy;
    emit BankContractCreated(from, clanId, proxy);
    return proxy;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
