// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/// @notice This contract is used to store the gas price required to maintain VRF oracle balance used for VRF callbacks
contract VRFRequestInfo is UUPSUpgradeable, OwnableUpgradeable {
  event UpdateMovingAverageGasPrice(uint256 movingAverageGasPrice);
  event SetBaseRequestCost(uint256 baseRequestCost);

  error NotUpdater();

  uint256 constant GAS_PRICE_WINDOW_SIZE = 4;

  uint8 private _indexGasPrice;
  uint64 private _movingAverageGasPrice;
  uint88 private _baseRequestCost;
  uint64[GAS_PRICE_WINDOW_SIZE] private _prices;
  mapping(address account => bool isUpdater) private _updaters;

  modifier onlyUpdater() {
    require(_updaters[_msgSender()], NotUpdater());
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize() external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init(_msgSender());

    setBaseAttackCost(0.01 ether);
    _updateMovingAverageGasPrice(uint64(tx.gasprice));
    for (uint256 i; i < GAS_PRICE_WINDOW_SIZE; ++i) {
      _prices[i] = uint64(tx.gasprice);
    }
  }

  function updateAverageGasPrice() external onlyUpdater {
    uint256 _sum = 0;
    _prices[_indexGasPrice] = uint64(tx.gasprice);
    _indexGasPrice = uint8((_indexGasPrice + 1) % GAS_PRICE_WINDOW_SIZE);

    for (uint256 i = 0; i < GAS_PRICE_WINDOW_SIZE; ++i) {
      _sum += _prices[i];
    }

    _updateMovingAverageGasPrice(uint64(_sum / GAS_PRICE_WINDOW_SIZE));
  }

  function _updateMovingAverageGasPrice(uint64 movingAverageGasPrice) private {
    _movingAverageGasPrice = movingAverageGasPrice;
    emit UpdateMovingAverageGasPrice(movingAverageGasPrice);
  }

  function get() external view returns (uint64, uint88) {
    return (_movingAverageGasPrice, _baseRequestCost);
  }

  function getMovingAverageGasPrice() external view returns (uint64) {
    return _movingAverageGasPrice;
  }

  function getBaseRequestCost() external view returns (uint88) {
    return _baseRequestCost;
  }

  function setBaseAttackCost(uint88 baseRequestCost) public onlyOwner {
    _baseRequestCost = baseRequestCost;
    emit SetBaseRequestCost(baseRequestCost);
  }

  function setUpdaters(address[] calldata updaters, bool isUpdater) external onlyOwner {
    for (uint256 i; i < updaters.length; ++i) {
      _updaters[updaters[i]] = isUpdater;
    }
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
