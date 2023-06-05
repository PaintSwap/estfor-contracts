//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UUPSUpgradeable} from "../ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../ozUpgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

import {IBankFactory} from "../interfaces/IBankFactory.sol";
import {IBank} from "../interfaces/IBank.sol";
import {IClans} from "../interfaces/IClans.sol";
import {BankRegistry} from "./BankRegistry.sol";

contract BankFactory is UUPSUpgradeable, OwnableUpgradeable, IBankFactory {
  event BankContractCreated(address creator, uint clanId, address newContract);

  error OnlyClans();
  error BankAlreadyCreated();

  mapping(uint clanId => address bank) public bankAddress;
  // Keeps track of which vault addresses have been created here
  mapping(address => bool) public createdHere;
  /// @custom:oz-renamed-from bankUpgradeableProxy
  address public bankBeacon;
  address public bankRegistry;

  modifier onlyClans() {
    if (address(BankRegistry(bankRegistry).clans()) != msg.sender) {
      revert OnlyClans();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address _bankRegistry, address _bankBeacon) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();
    bankRegistry = _bankRegistry;
    bankBeacon = _bankBeacon;
  }

  function createBank(address _from, uint _clanId) external onlyClans returns (address) {
    if (bankAddress[_clanId] != address(0)) {
      revert BankAlreadyCreated();
    }

    // Create new Bank contract with EIP 1167 beacon proxy
    address proxy = address(
      new BeaconProxy(bankBeacon, abi.encodeWithSelector(IBank.initialize.selector, _clanId, bankRegistry))
    );
    createdHere[proxy] = true;
    bankAddress[_clanId] = proxy;
    emit BankContractCreated(_from, _clanId, proxy);
    return proxy;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
