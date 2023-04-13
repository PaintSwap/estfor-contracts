//SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

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
  address public bankUpgradeableProxy;
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

  function initialize(address _bankRegistry, address _bankUpgradeableProxy) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();
    bankRegistry = _bankRegistry;
    bankUpgradeableProxy = _bankUpgradeableProxy;
  }

  function createBank(address _from, uint _clanId) external onlyClans returns (address) {
    if (bankAddress[_clanId] != address(0)) {
      revert BankAlreadyCreated();
    }

    // Create new Bank contract with EIP 1167
    address bankContractClone = Clones.clone(bankUpgradeableProxy);
    IBank(bankContractClone).initialize(_clanId, bankRegistry);
    createdHere[bankContractClone] = true;
    bankAddress[_clanId] = bankContractClone;
    emit BankContractCreated(_from, _clanId, bankContractClone);
    return bankContractClone;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
