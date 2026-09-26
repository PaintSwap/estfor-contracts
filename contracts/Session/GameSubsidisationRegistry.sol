// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IGameSubsidisationRegistry} from "../interfaces/IGameSubsidisationRegistry.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {ISubsidyFunctionDiscovery, DiscoveryStatus} from "../interfaces/IReconciliationDiscovery.sol";

/// @custom:oz-upgrades-from GameSubsidisationRegistryV2
contract GameSubsidisationRegistry is
  UUPSUpgradeable,
  OwnableUpgradeable,
  IGameSubsidisationRegistry,
  ISubsidyFunctionDiscovery
{
  using EnumerableSet for EnumerableSet.UintSet;

  // Group 0 = Disabled, Group 1 = Basic, Group 2 = Combat, etc.
  mapping(address => mapping(bytes4 => uint256)) private _functionToLimitGroup;
  mapping(uint256 => uint256) private _groupDailyLimits;
  uint256 private constant FEEM_PROJECT_ID = 15;

  EnumerableSet.UintSet private _subsidisedFunctions;
  DiscoveryStatus public discoveryStatus;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address owner) public initializer {
    __Ownable_init(owner);
    discoveryStatus = DiscoveryStatus.Complete;
  }

  function getSubsidisedFunctionCount() external view returns (uint256) {
    return _subsidisedFunctions.length();
  }

  function getSubsidisedFunctions(
    uint256 start,
    uint256 end
  ) external view returns (address[] memory contracts_, bytes4[] memory selectors) {
    require(start <= end && end <= _subsidisedFunctions.length() && end - start <= 1024, InvalidDiscoveryRange());
    contracts_ = new address[](end - start);
    selectors = new bytes4[](end - start);
    for (uint256 i; i < contracts_.length; ++i) {
      uint256 key = _subsidisedFunctions.at(start + i);
      contracts_[i] = address(uint160(key >> 32));
      selectors[i] = bytes4(uint32(key));
    }
  }

  function registerLegacyFunctions(address[] calldata contracts_, bytes4[] calldata selectors) external onlyOwner {
    require(contracts_.length == selectors.length, LengthMismatch());
    for (uint256 i; i < contracts_.length; ++i) {
      _syncFunction(contracts_[i], selectors[i], _functionToLimitGroup[contracts_[i]][selectors[i]]);
    }
  }

  function attestLegacyDiscovery(bytes32 evidenceHash) external onlyOwner {
    require(discoveryStatus == DiscoveryStatus.Incomplete && evidenceHash != bytes32(0), InvalidDiscoveryAttestation());
    discoveryStatus = DiscoveryStatus.LegacyAttested;
    emit LegacyDiscoveryAttested(evidenceHash);
  }

  function _syncFunction(address contract_, bytes4 selector, uint256 groupId) private {
    uint256 key = (uint256(uint160(contract_)) << 32) | uint32(selector);
    if (groupId != 0) {
      _subsidisedFunctions.add(key);
    } else {
      _subsidisedFunctions.remove(key);
    }
  }

  function functionToLimitGroup(address _contract, bytes4 _selector) external view override returns (uint256) {
    return _functionToLimitGroup[_contract][_selector];
  }

  function groupDailyLimits(uint256 _groupId) external view override returns (uint256) {
    return _groupDailyLimits[_groupId];
  }

  function getGroupAndLimit(
    address _contract,
    bytes4 _selector
  ) external view override returns (uint256 groupId, uint256 limit) {
    groupId = _functionToLimitGroup[_contract][_selector];
    limit = _groupDailyLimits[groupId];
  }

  function setFunctionGroup(address _contract, bytes4 _selector, uint256 _groupId) external override onlyOwner {
    _functionToLimitGroup[_contract][_selector] = _groupId;
    _syncFunction(_contract, _selector, _groupId);
  }

  function setFunctionGroups(
    address[] calldata _contracts,
    bytes4[] calldata _selectors,
    uint256[] calldata _groupIds
  ) external override onlyOwner {
    require(_contracts.length == _selectors.length && _selectors.length == _groupIds.length, LengthMismatch());
    for (uint256 i = 0; i < _contracts.length; ++i) {
      _functionToLimitGroup[_contracts[i]][_selectors[i]] = _groupIds[i];
      _syncFunction(_contracts[i], _selectors[i], _groupIds[i]);
    }
  }

  function setGroupLimit(uint256 _groupId, uint256 _limit) external override onlyOwner {
    _groupDailyLimits[_groupId] = _limit;
  }

  function setGroupLimits(uint256[] calldata _groupIds, uint256[] calldata _limits) external override onlyOwner {
    require(_groupIds.length == _limits.length, LengthMismatch());
    for (uint256 i = 0; i < _groupIds.length; ++i) {
      _groupDailyLimits[_groupIds[i]] = _limits[i];
    }
  }

  function registerFeeM() external {
    (bool _success, ) = address(0xDC2B0D2Dd2b7759D97D50db4eabDC36973110830).call(
      abi.encodeWithSignature("selfRegister(uint256)", FEEM_PROJECT_ID)
    );
    require(_success, "FeeM registration failed");
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
