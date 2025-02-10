// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IItemNFT} from "../interfaces/IItemNFT.sol";

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IActivityPoints, ActivityType} from "./interfaces/IActivityPoints.sol";

import "hardhat/console.sol";

contract ActivityPoints is IActivityPoints, UUPSUpgradeable, AccessControlUpgradeable, OwnableUpgradeable {
  error CannotBeZeroAddress();
  error InvalidBoostMultiplier();
  error MustBeTokenIdOwner();

  bytes32 public constant ACTIVITY_POINT_CALLER = keccak256("ACTIVITY_POINT_CALLER");

  enum CalculationType {
    NONE,
    discrete,
    log2,
    log10,
    linear
  }

  struct Calculation {
    CalculationType use;
    uint16 base;
    uint16 multiplier;
    uint16 divider;
    uint64 maxPointsPerDay;
  }

  struct DailyCheckpoint {
    uint16 current;
    uint112 amount;
  }

  struct PointBoost {
    address nft;
    uint40 activated;
    uint256 tokenId;
  }

  struct BoostDailyCheckpoint {
    uint16 current;
    uint112 currentPoints;
    uint16 previous;
    uint112 previousPoints;
  }

  // The item NFT contract to mint points
  IItemNFT private _itemsNFT;
  // The token ID for the points
  uint16 private _itemTokenId;

  // The calculations for each activity type
  mapping(ActivityType => Calculation) private _calculations;

  // The daily checkpoints for each player and activity type
  mapping(address player => mapping(ActivityType => DailyCheckpoint)) private _checkpoints;

  // NFTs that can boost points
  mapping(address nft => bool isBoosted) private _boostedNFTs;
  // This tracks the owners of each token when it is registered to prevent transfer abuse
  mapping(address nft => mapping(uint256 tokenId => address player)) private _nftBoostOwners;
  // NFTs that are boosting points per player
  mapping(address player => PointBoost boost) private _boosts;

  // Track points earned by the boosted nfts and in total for today and the previous day, rolling

  mapping(address nft => BoostDailyCheckpoint checkpoint) private _boostNFTCheckpoints;
  BoostDailyCheckpoint private _boostCheckpoints;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address itemNFT, uint16 seasonTokenId) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init(_msgSender());

    _grantRole(ACTIVITY_POINT_CALLER, _msgSender());

    _itemsNFT = IItemNFT(itemNFT);
    _itemTokenId = seasonTokenId;

    // players
    _setPointsDiscreteCalculation(ActivityType.players_evt_actionfinished, 10, 2000);

    _setLog2PointsCalculation(ActivityType.players_evt_addxp, 15, 8, 10, 5000);
    _setLog2PointsCalculation(ActivityType.players_evt_levelup, 65, 5, 10, 5000);

    _setPointsDiscreteCalculation(ActivityType.players_evt_boostfinished, 250, 750);
    _setPointsDiscreteCalculation(ActivityType.players_evt_dailyreward, 225, 0);
    _setPointsDiscreteCalculation(ActivityType.players_evt_weeklyreward, 450, 0);
    _setPointsDiscreteCalculation(ActivityType.players_evt_claimedxpthresholdrewards, 100, 100);

    // instant actions
    _setPointsDiscreteCalculation(ActivityType.instantactions_evt_doinstantactions, 200, 0);
    _setPointsDiscreteCalculation(ActivityType.instantvrfactions_evt_doinstantvrfactions, 200, 0);

    // passive actions
    _setPointsDiscreteCalculation(ActivityType.passiveactions_evt_claimpassiveaction, 200, 0);

    // quests
    _setPointsDiscreteCalculation(ActivityType.quests_evt_questcompleted, 750, 3000);

    // shop
    _setLog2PointsCalculation(ActivityType.shop_evt_buy, 21, 10, 1, 2000);
    _setLog2PointsCalculation(ActivityType.shop_evt_sell, 5, 20, 1, 500);

    // wishing well
    _setLog10PointsCalculation(ActivityType.wishingwell_evt_donate, 100, 20, 1, 0);
    _setLog10PointsCalculation(ActivityType.wishingwell_evt_donatetoclan, 10, 20, 1, 0);

    // orderbook
    _setLog2PointsCalculation(ActivityType.orderbook_evt_ordersmatched, 21, 10, 1, 2000);

    // clans
    _setPointsDiscreteCalculation(ActivityType.clans_evt_clancreated, 500, 500);

    // locked bank vaults
    _setPointsDiscreteCalculation(ActivityType.lockedbankvaults_evt_attackvaults, 250, 250);

    // territories
    _setPointsDiscreteCalculation(ActivityType.territories_evt_attackterritory, 250, 250);
    _setPointsDiscreteCalculation(ActivityType.territories_evt_claimunoccupiedterritory, 100, 100);
  }

  function registerPointBoost(address nft, uint16 tokenId) external {
    address msgSender = _msgSender();
    require(IERC721(nft).ownerOf(tokenId) == msgSender, MustBeTokenIdOwner());
    _boosts[msgSender] = PointBoost(nft, uint40(block.timestamp), tokenId);
    _nftBoostOwners[nft][tokenId] = msgSender;
  }

  function reward(
    ActivityType activityType,
    address player,
    uint256 value
  ) public override onlyRole(ACTIVITY_POINT_CALLER) returns (uint256 points) {
    // get the calculation from the type
    Calculation memory calculation = _calculations[activityType];

    if (calculation.use == CalculationType.discrete) {
      points = calculation.base;
    } else if (calculation.use == CalculationType.log2) {
      points = calculation.base * Math.log2((value * calculation.multiplier) / calculation.divider);
    } else if (calculation.use == CalculationType.log10) {
      points = calculation.base * Math.log10((value * calculation.multiplier) / calculation.divider);
    } else if (calculation.use == CalculationType.linear) {
      points = (calculation.base * value * calculation.multiplier) / calculation.divider;
    }

    // if they have points...
    if (points != 0) {
      // increase the points by the multiplier if they have a boost
      points = _applyPointBoost(player, points);

      // apply the max points per day
      points = _applyMaxPointsPerDay(player, activityType, calculation.maxPointsPerDay, points);

      // console.log("ActivityPoints:reward - player: %s, type: %d, points: %d", player, uint8(activityType), points);
      if (points != 0) {
        emit ActivityPointsEarned(player, activityType, value, points);
        _itemsNFT.mint(player, _itemTokenId, points);
      }
    }
  }

  function getItemTokenId() external view returns (uint256) {
    return _itemTokenId;
  }

  function addPointsCalculation(
    ActivityType activityType,
    CalculationType calculation,
    uint16 base,
    uint16 multiplier,
    uint16 divider,
    uint64 maxPointsPerDay
  ) external onlyOwner {
    _calculations[activityType] = Calculation(calculation, base, multiplier, divider, maxPointsPerDay);
  }

  function addCallers(address[] calldata callers) external onlyOwner {
    for (uint256 i = 0; i < callers.length; ++i) {
      _grantRole(ACTIVITY_POINT_CALLER, callers[i]);
    }
  }

  function updateBoostedNFT(address nft, bool isBoosted) external onlyOwner {
    require(nft != address(0), CannotBeZeroAddress());
    _boostedNFTs[nft] = isBoosted;
  }

  function _applyPointBoost(address player, uint256 points) private returns (uint256 boosted) {
    boosted = points;
    PointBoost memory boost = _boosts[player];
    uint40 timestamp = uint40(block.timestamp);
    // check to see if the boost is active
    if (_boostedNFTs[boost.nft] && boost.activated + 1 days < timestamp) {
      address boostOwner = _nftBoostOwners[boost.nft][boost.tokenId];
      // the registered and current owner must be the same
      if (player == boostOwner && player == IERC721(boost.nft).ownerOf(boost.tokenId)) {
        uint16 current = uint16(timestamp / 1 days);
        BoostDailyCheckpoint storage checkpoint = _boostNFTCheckpoints[boost.nft];

        _rollCheckpoint(checkpoint, current);

        BoostDailyCheckpoint storage globalCheckpoint = _boostCheckpoints;

        if (checkpoint.previousPoints != 0) {
          _rollCheckpoint(globalCheckpoint, current);
          // use the previous checkpoint to calculate the multiplier, capped at 10%
          uint256 multiplier = 100 + Math.min(10, (checkpoint.previousPoints * 100) / globalCheckpoint.previousPoints);
          // calculate the boosted points
          boosted = (points * multiplier) / 100;
        }

        // update the checkpoint
        globalCheckpoint.currentPoints += uint112(boosted);
        checkpoint.currentPoints += uint112(boosted);
      }
    }
  }

  function _rollCheckpoint(BoostDailyCheckpoint storage checkpoint, uint16 current) private {
    if (checkpoint.current != current) {
      checkpoint.previous = checkpoint.current;
      checkpoint.previousPoints = checkpoint.currentPoints;

      checkpoint.current = uint16(block.timestamp / 1 days);
      checkpoint.currentPoints = 0;
    }
  }

  function _applyMaxPointsPerDay(
    address player,
    ActivityType activityType,
    uint256 maxPointsPerDay,
    uint256 points
  ) private returns (uint256 adjusted) {
    adjusted = points;
    if (maxPointsPerDay != 0) {
      DailyCheckpoint storage checkpoint = _checkpoints[player][activityType];
      uint112 amount = checkpoint.amount;
      // uint32 current = uint32(block.timestamp - (block.timestamp % 1 days));
      uint16 current = uint16(block.timestamp / 1 days);
      if (checkpoint.current != current) {
        // reset the checkoint
        checkpoint.current = current;
        amount = 0;
      } else if (amount >= maxPointsPerDay) {
        // at the max, no more points for this type
        return 0;
      }

      // if the current amount plus points exceeds the limit, adjust the points
      if (amount + points > maxPointsPerDay) {
        adjusted = maxPointsPerDay - amount;
      }

      // increment the amount
      amount += uint112(adjusted);

      // save it to the checkpoint
      checkpoint.amount = amount;
    }
  }

  /// @dev Add a discrete points calculation
  /// @param activityType The activity type
  /// @param points The points to add
  /// @param maxPointsPerDay The maximum points per day, 0 for no limit
  function _setPointsDiscreteCalculation(ActivityType activityType, uint16 points, uint64 maxPointsPerDay) private {
    _calculations[activityType] = Calculation(CalculationType.discrete, points, 1, 1, maxPointsPerDay);
  }

  /// @dev Add a log2 points calculation
  /// @param activityType The activity type
  /// @param base The base points
  /// @param multiplier The multiplier
  /// @param divider The divider
  /// @param maxPointsPerDay The maximum points per day, 0 for no limit
  function _setLog2PointsCalculation(
    ActivityType activityType,
    uint16 base,
    uint16 multiplier,
    uint16 divider,
    uint64 maxPointsPerDay
  ) private {
    _calculations[activityType] = Calculation(CalculationType.log2, base, multiplier, divider, maxPointsPerDay);
  }

  /// @dev Add a log10 points calculation
  /// @param activityType The activity type
  /// @param base The base points
  /// @param multiplier The multiplier
  /// @param divider The divider
  /// @param maxPointsPerDay The maximum points per day, 0 for no limit
  function _setLog10PointsCalculation(
    ActivityType activityType,
    uint16 base,
    uint16 multiplier,
    uint16 divider,
    uint64 maxPointsPerDay
  ) private {
    _calculations[activityType] = Calculation(CalculationType.log10, base, multiplier, divider, maxPointsPerDay);
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
