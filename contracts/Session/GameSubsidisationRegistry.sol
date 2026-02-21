// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IGameSubsidisationRegistry} from "../interfaces/IGameSubsidisationRegistry.sol";

contract GameSubsidisationRegistry is UUPSUpgradeable, OwnableUpgradeable, IGameSubsidisationRegistry {
  // Group 0 = Disabled, Group 1 = Basic, Group 2 = Combat, etc.
  mapping(address => mapping(bytes4 => uint256)) private _functionToLimitGroup;
  mapping(uint256 => uint256) private _groupDailyLimits;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address owner) public initializer {
    __Ownable_init(owner);
  }

  function functionToLimitGroup(address _contract, bytes4 _selector) external view override returns (uint256) {
    return _functionToLimitGroup[_contract][_selector];
  }

  function groupDailyLimits(uint256 _groupId) external view override returns (uint256) {
    return _groupDailyLimits[_groupId];
  }

  function setFunctionGroup(address _contract, bytes4 _selector, uint256 _groupId) external override onlyOwner {
    _functionToLimitGroup[_contract][_selector] = _groupId;
  }

  function setGroupLimit(uint256 _groupId, uint256 _limit) external override onlyOwner {
    _groupDailyLimits[_groupId] = _limit;
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
