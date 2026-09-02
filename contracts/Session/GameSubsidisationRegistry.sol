// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IGameSubsidisationRegistry} from "../interfaces/IGameSubsidisationRegistry.sol";

contract GameSubsidisationRegistry is UUPSUpgradeable, OwnableUpgradeable, IGameSubsidisationRegistry {
  // Group 0 = Disabled, Group 1 = Basic, Group 2 = Combat, etc.
  mapping(address => mapping(bytes4 => uint256)) private _functionToLimitGroup;
  mapping(uint256 => uint256) private _groupDailyLimits;
  uint256 private constant FEEM_PROJECT_ID = 15;

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

  function getGroupAndLimit(
    address _contract,
    bytes4 _selector
  ) external view override returns (uint256 groupId, uint256 limit) {
    groupId = _functionToLimitGroup[_contract][_selector];
    limit = _groupDailyLimits[groupId];
  }

  function setFunctionGroup(address _contract, bytes4 _selector, uint256 _groupId) external override onlyOwner {
    _functionToLimitGroup[_contract][_selector] = _groupId;
  }

  function setFunctionGroups(
    address[] calldata _contracts,
    bytes4[] calldata _selectors,
    uint256[] calldata _groupIds
  ) external override onlyOwner {
    require(_contracts.length == _selectors.length && _selectors.length == _groupIds.length, LengthMismatch());
    for (uint256 i = 0; i < _contracts.length; ++i) {
      _functionToLimitGroup[_contracts[i]][_selectors[i]] = _groupIds[i];
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
