// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {IRewardTierDiscovery, DiscoveryStatus} from "./interfaces/IReconciliationDiscovery.sol";

import {IOracleCB} from "./interfaces/IOracleCB.sol";

import {Equipment} from "./globals/misc.sol";
import {NONE} from "./globals/items.sol";

/// @custom:oz-upgrades-from DailyRewardsSchedulerV2
contract DailyRewardsScheduler is UUPSUpgradeable, OwnableUpgradeable, IOracleCB, IRewardTierDiscovery {
  using EnumerableSet for EnumerableSet.UintSet;

  error CanOnlyRequestAfter1DayHasPassed();
  error InvalidReward();
  error TooManyRewardsInPool();
  error OnlyRandomnessBeacon();

  address private _randomnessBeacon;
  uint40 private _weeklyRewardCheckpoint;
  bytes8 private _thisWeeksRandomWordSegment; // Every 8 bits is a random segment for the day

  mapping(uint256 tier => Equipment[]) private _dailyRewardPool; // TODO: Could be a packed uint48 array but it doesn't help any readers
  mapping(uint256 tier => Equipment[]) private _weeklyRewardPool;

  EnumerableSet.UintSet private _dailyRewardTiers;
  EnumerableSet.UintSet private _weeklyRewardTiers;
  DiscoveryStatus public discoveryStatus;

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
    discoveryStatus = DiscoveryStatus.Complete;
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

  function getDailyRewardPool(uint256 tier) external view returns (Equipment[] memory) {
    return _dailyRewardPool[tier];
  }

  function getWeeklyRewardPool(uint256 tier) external view returns (Equipment[] memory) {
    return _weeklyRewardPool[tier];
  }

  function getDailyRewardTierCount() external view returns (uint256) {
    return _dailyRewardTiers.length();
  }

  function getWeeklyRewardTierCount() external view returns (uint256) {
    return _weeklyRewardTiers.length();
  }

  function getDailyRewardTiers(uint256 start, uint256 end) external view returns (uint256[] memory) {
    return _getRewardTiers(_dailyRewardTiers, start, end);
  }

  function getWeeklyRewardTiers(uint256 start, uint256 end) external view returns (uint256[] memory) {
    return _getRewardTiers(_weeklyRewardTiers, start, end);
  }

  function _getRewardTiers(
    EnumerableSet.UintSet storage tiers,
    uint256 start,
    uint256 end
  ) private view returns (uint256[] memory ids) {
    require(start <= end && end <= tiers.length() && end - start <= 1024, InvalidDiscoveryRange());
    ids = new uint256[](end - start);
    for (uint256 i; i < ids.length; ++i) {
      ids[i] = tiers.at(start + i);
    }
  }

  function registerLegacyRewardTiers(uint256[] calldata dailyTiers, uint256[] calldata weeklyTiers) external onlyOwner {
    for (uint256 i; i < dailyTiers.length; ++i) {
      _syncRewardTier(_dailyRewardTiers, dailyTiers[i], _dailyRewardPool[dailyTiers[i]].length);
    }
    for (uint256 i; i < weeklyTiers.length; ++i) {
      _syncRewardTier(_weeklyRewardTiers, weeklyTiers[i], _weeklyRewardPool[weeklyTiers[i]].length);
    }
  }

  function attestLegacyDiscovery(bytes32 evidenceHash) external onlyOwner {
    require(discoveryStatus == DiscoveryStatus.Incomplete && evidenceHash != bytes32(0), InvalidDiscoveryAttestation());
    discoveryStatus = DiscoveryStatus.LegacyAttested;
    emit LegacyDiscoveryAttested(evidenceHash);
  }

  function _syncRewardTier(EnumerableSet.UintSet storage tiers, uint256 tier, uint256 length) private {
    if (length != 0) {
      tiers.add(tier);
    } else {
      tiers.remove(tier);
    }
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
    _syncRewardTier(_dailyRewardTiers, tier, dailyRewards.length);
  }

  function setWeeklyRewardPool(uint256 tier, Equipment[] calldata weeklyRewards) external onlyOwner {
    require(weeklyRewards.length <= 255, TooManyRewardsInPool());

    delete _weeklyRewardPool[tier];

    for (uint256 i = 0; i < weeklyRewards.length; ++i) {
      require(weeklyRewards[i].itemTokenId != NONE && weeklyRewards[i].amount != 0, InvalidReward());
      _weeklyRewardPool[tier].push(weeklyRewards[i]);
    }
    _syncRewardTier(_weeklyRewardTiers, tier, weeklyRewards.length);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
