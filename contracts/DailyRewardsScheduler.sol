// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {IOracleCB} from "./interfaces/IOracleCB.sol";

import {Equipment} from "./globals/misc.sol";
import {NONE} from "./globals/items.sol";

contract DailyRewardsScheduler is UUPSUpgradeable, OwnableUpgradeable, IOracleCB {
  error CanOnlyRequestAfter1DayHasPassed();
  error InvalidReward();
  error TooManyRewardsInPool();
  error OnlyRandomnessBeacon();

  address private _randomnessBeacon;
  uint40 private _weeklyRewardCheckpoint;
  bytes8 private _thisWeeksRandomWordSegment; // Every 8 bits is a random segment for the day

  mapping(uint256 tier => Equipment[]) private _dailyRewardPool; // TODO: Could be a packed uint48 array but it doesn't help any readers
  mapping(uint256 tier => Equipment[]) private _weeklyRewardPool;

  modifier onlyWorld() {
    require(_randomnessBeacon == _msgSender(), OnlyRandomnessBeacon());
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address randomnessBeacon) external initializer {
    __Ownable_init(_msgSender());
    __UUPSUpgradeable_init();

    _randomnessBeacon = randomnessBeacon;
    _weeklyRewardCheckpoint = uint40((block.timestamp - 4 days) / 1 weeks) * 1 weeks + 4 days + 1 weeks;
  }

  function newOracleRandomWords(uint256 randomWord) external override onlyWorld {
    // Are we at the threshold for a new week
    if (_weeklyRewardCheckpoint <= ((block.timestamp) / 1 days) * 1 days) {
      // Issue new daily rewards for each tier based on the new random words
      _thisWeeksRandomWordSegment = bytes8(uint64(randomWord));

      _weeklyRewardCheckpoint = uint40((block.timestamp - 4 days) / 1 weeks) * 1 weeks + 4 days + 1 weeks;
    }
  }

  function _getRewardIndex(
    uint256 playerId,
    uint256 day,
    uint256 randomWord,
    uint256 length
  ) private pure returns (uint256) {
    return uint256(keccak256(abi.encodePacked(randomWord, playerId)) >> (day * 8)) % length;
  }

  function getWeeklyReward(uint256 tier, uint256 playerId) public view returns (uint16 itemTokenId, uint24 amount) {
    uint256 day = 7;
    uint256 index = _getRewardIndex(playerId, day, uint64(_thisWeeksRandomWordSegment), _weeklyRewardPool[tier].length);
    Equipment storage equipment = _weeklyRewardPool[tier][index];
    return (equipment.itemTokenId, equipment.amount);
  }

  function getSpecificDailyReward(
    uint256 tier,
    uint256 playerId,
    uint256 day,
    uint256 randomWord
  ) public view returns (uint16 itemTokenId, uint24 amount) {
    uint256 index = _getRewardIndex(playerId, day, randomWord, _dailyRewardPool[tier].length);
    Equipment storage equipment = _dailyRewardPool[tier][index];
    return (equipment.itemTokenId, equipment.amount);
  }

  function getDailyReward(uint256 tier, uint256 playerId) external view returns (uint256 itemTokenId, uint256 amount) {
    uint256 checkpoint = ((block.timestamp - 4 days) / 1 weeks) * 1 weeks + 4 days;
    uint256 day = ((block.timestamp / 1 days) * 1 days - checkpoint) / 1 days;
    return getSpecificDailyReward(tier, playerId, day, uint64(_thisWeeksRandomWordSegment));
  }

  function getActiveDailyAndWeeklyRewards(
    uint256 tier,
    uint256 playerId
  ) external view returns (Equipment[8] memory rewards) {
    for (uint256 i; i < 7; ++i) {
      (rewards[i].itemTokenId, rewards[i].amount) = getSpecificDailyReward(
        tier,
        playerId,
        i,
        uint64(_thisWeeksRandomWordSegment)
      );
    }
    (rewards[7].itemTokenId, rewards[7].amount) = getWeeklyReward(tier, playerId);
  }

  function getThisWeeksRandomWordSegment() external view returns (bytes8) {
    return _thisWeeksRandomWordSegment;
  }

  function setDailyRewardPool(uint256 tier, Equipment[] calldata dailyRewards) external onlyOwner {
    require(dailyRewards.length <= 255, TooManyRewardsInPool());
    delete _dailyRewardPool[tier];

    for (uint256 i = 0; i < dailyRewards.length; ++i) {
      // Amount should be divisible by 10 to allow percentage increases to be applied (like clan bonuses)
      require(
        dailyRewards[i].itemTokenId != 0 && dailyRewards[i].amount != 0 && dailyRewards[i].amount % 10 == 0,
        InvalidReward()
      );
      _dailyRewardPool[tier].push(dailyRewards[i]);
    }
  }

  function setWeeklyRewardPool(uint256 tier, Equipment[] calldata weeklyRewards) external onlyOwner {
    require(weeklyRewards.length <= 255, TooManyRewardsInPool());

    delete _weeklyRewardPool[tier];

    for (uint256 i = 0; i < weeklyRewards.length; ++i) {
      require(weeklyRewards[i].itemTokenId != NONE && weeklyRewards[i].amount != 0, InvalidReward());
      _weeklyRewardPool[tier].push(weeklyRewards[i]);
    }
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
