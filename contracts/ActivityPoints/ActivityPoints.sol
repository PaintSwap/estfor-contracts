// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IItemNFT} from "../interfaces/IItemNFT.sol";

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IBank} from "../interfaces/IBank.sol";
import {IActivityPoints, ActivityType} from "./interfaces/IActivityPoints.sol";

contract ActivityPoints is IActivityPoints, UUPSUpgradeable, AccessControlUpgradeable, OwnableUpgradeable {
  error CannotBeZeroAddress();
  error InvalidBoostMultiplier();
  error MustBeBoostedTokenIdOwner();

  event UpdatePointBoostNFT(address indexed nft, NFTContractType contractType);
  event RegisterPointBoost(
    address indexed nft,
    NFTContractType contractType,
    uint256 indexed tokenId,
    address indexed recipient,
    uint40 timestamp
  );
  event AddPointsCalculation(
    ActivityType indexed activityType,
    CalculationType indexed calculation,
    uint16 base,
    uint16 multiplier,
    uint16 divider,
    uint64 maxPointsPerDay
  );

  bytes32 public constant ACTIVITY_POINT_CALLER = keccak256("ACTIVITY_POINT_CALLER");

  enum NFTContractType {
    NONE,
    ERC721,
    ERC1155
  }

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
    uint16 tokenId;
  }

  struct BoostDailyCheckpoint {
    uint16 current;
    uint112 currentPoints;
    uint16 previous;
    uint112 previousPoints;
  }

  // The item NFT contract to mint points
  IItemNFT private _itemNFT;
  // The token ID for the points
  uint16 private _blueTicketItemId;
  uint16 private _greenTicketItemId;

  // The calculations for each activity type
  mapping(ActivityType => Calculation) private _calculations;

  // The daily checkpoints for each recipient and activity type
  mapping(address recipient => mapping(ActivityType => DailyCheckpoint)) private _checkpoints;

  // NFTs that can boost points
  mapping(address nft => NFTContractType contractType) private _boostedNFTs;
  // This tracks the owners of each token when it is registered to prevent transfer abuse
  mapping(address nft => mapping(uint256 tokenId => address recipient)) private _nftBoostOwners;
  // NFTs that are boosting points per recipient
  mapping(address recipient => PointBoost boost) private _boosts;

  // Track points earned by the boosted nfts and in total for today and the previous day, rolling

  mapping(address nft => BoostDailyCheckpoint checkpoint) private _boostNFTCheckpoints;
  BoostDailyCheckpoint private _boostCheckpoints;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address itemNFT, uint16 blueTokenId, uint16 greenTokenId) external initializer {
    __Ownable_init(_msgSender());
    __UUPSUpgradeable_init();

    _grantRole(ACTIVITY_POINT_CALLER, _msgSender());

    _itemNFT = IItemNFT(itemNFT);
    _blueTicketItemId = blueTokenId;
    _greenTicketItemId = greenTokenId;

    // players
    _setPointsDiscreteCalculation(ActivityType.players_evt_actionfinished, 23, 2001);

    _setLog2PointsCalculation(ActivityType.players_evt_addxp, 5, 8, 10, 5000);
    _setLog2PointsCalculation(ActivityType.players_evt_levelup, 33, 5, 10, 5000);

    _setPointsDiscreteCalculation(ActivityType.players_evt_boostfinished, 75, 750);
    _setPointsDiscreteCalculation(ActivityType.players_evt_dailyreward, 80, 0);
    _setPointsDiscreteCalculation(ActivityType.players_evt_weeklyreward, 450, 0);
    _setPointsDiscreteCalculation(ActivityType.players_evt_claimedxpthresholdrewards, 100, 100);

    // instant actions
    _setPointsDiscreteCalculation(ActivityType.instantactions_evt_doinstantactions, 5, 0);
    _setPointsDiscreteCalculation(ActivityType.instantvrfactions_evt_doinstantvrfactions, 5, 0);

    // passive actions
    _setPointsDiscreteCalculation(ActivityType.passiveactions_evt_claimpassiveaction, 200, 0);

    // quests
    _setPointsDiscreteCalculation(ActivityType.quests_evt_questcompleted, 250, 1000);

    // shop
    _setLog2PointsCalculation(ActivityType.shop_evt_buy, 11, 10, 1, 2000);
    _setLog2PointsCalculation(ActivityType.shop_evt_sell, 3, 20, 1, 500);

    // orderbook
    _setLog2PointsCalculation(ActivityType.orderbook_evt_ordersmatched, 11, 10, 1, 2000);

    // wishing well
    _setLog10PointsCalculation(ActivityType.wishingwell_evt_donate, 50, 20, 1, 0);
    _setLog10PointsCalculation(ActivityType.wishingwell_evt_donatetoclan, 5, 20, 1, 0);

    // clans
    _setPointsDiscreteCalculation(ActivityType.clans_evt_clancreated, 300, 300);

    // locked bank vaults
    _setPointsDiscreteCalculation(ActivityType.lockedbankvaults_evt_attackvaults, 50, 250);

    // territories
    _setPointsDiscreteCalculation(ActivityType.territories_evt_attackterritory, 250, 250);
    _setPointsDiscreteCalculation(ActivityType.territories_evt_claimunoccupiedterritory, 100, 100);
  }

  /// @notice Register an NFT to boost points for a user wallet.
  /// @notice Daily points are tracked by the NFT collection and used to calculate the boost.
  /// @param nft The NFT contract address
  /// @param tokenId The token ID
  function registerPointBoost(address nft, uint16 tokenId) external {
    address msgSender = _msgSender();
    bool isHolder = _isHolder(_boostedNFTs[nft], nft, tokenId, msgSender);
    require(isHolder, MustBeBoostedTokenIdOwner());
    _registerPointBoost(msgSender, NFTContractType.ERC721, nft, tokenId);
  }

  function _registerPointBoost(address msgSender, NFTContractType contractType, address nft, uint16 tokenId) private {
    uint40 activated = uint40(block.timestamp + 1 days);
    _boosts[msgSender] = PointBoost(nft, activated, tokenId);
    _nftBoostOwners[nft][tokenId] = msgSender;
    emit RegisterPointBoost(nft, contractType, tokenId, msgSender, activated);
  }

  /// @notice Get the registered nft boost for a user wallet
  /// @param user The user wallet
  /// @return The boost information. ERC721=1, ERC1155=2
  function getBoostForUser(address user) external view returns (PointBoost memory) {
    PointBoost memory boost = _boosts[user];
    if (boost.nft != address(0)) {
      bool isHolder = _isHolder(_boostedNFTs[boost.nft], boost.nft, boost.tokenId, user);
      if (isHolder) {
        return boost;
      }
    }
    return PointBoost(address(0), 0, 0);
  }

  function rewardBlueTickets(
    ActivityType activityType,
    address recipient,
    bool isEvolvedOrNA,
    uint256 value
  ) external override onlyRole(ACTIVITY_POINT_CALLER) returns (uint256 points) {
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
      points = _applyPointBoost(recipient, points);

      // apply the max points per day
      points = _applyMaxPointsPerDay(recipient, activityType, calculation.maxPointsPerDay, points);

      if (points != 0) {
        // adjust for non-evolved heroes
        if (!isEvolvedOrNA) {
          points /= 2; // %50 reduction for non-evolved heroes
        }

        emit ActivityPointsEarned(activityType, value, recipient, _blueTicketItemId, points);

        bool isBankRecipient = _isClanActivityType(activityType);
        if (isBankRecipient) {
          IBank(recipient).setAllowBreachedCapacity(true);
        }
        _itemNFT.mint(recipient, _blueTicketItemId, points);
        if (isBankRecipient) {
          IBank(recipient).setAllowBreachedCapacity(false);
        }
      }
    }
  }

  function rewardGreenTickets(
    ActivityType activityType,
    address recipient,
    bool isEvolved
  ) external override onlyRole(ACTIVITY_POINT_CALLER) returns (uint256 tickets) {
    if (isEvolved) {
      if (activityType == ActivityType.players_dailyreward) {
        tickets = 8;
      } else if (activityType == ActivityType.wishingwell_luckofthedraw) {
        tickets = 3;
      } else if (activityType == ActivityType.wishingwell_luckypotion) {
        tickets = 50;
      }
      if (tickets != 0) {
        emit ActivityPointsEarned(activityType, 0, recipient, _greenTicketItemId, tickets);
        _itemNFT.mint(recipient, _greenTicketItemId, tickets);
      }
    }
  }

  function addPointsCalculation(
    ActivityType activityType,
    CalculationType calculation,
    uint16 base,
    uint16 multiplier,
    uint16 divider,
    uint64 maxPointsPerDay
  ) external onlyOwner {
    _addPointsCalculation(activityType, calculation, base, multiplier, divider, maxPointsPerDay);
  }

  function addCallers(address[] calldata callers) external onlyOwner {
    for (uint256 i = 0; i < callers.length; ++i) {
      _grantRole(ACTIVITY_POINT_CALLER, callers[i]);
    }
  }

  function setBoostedNFTs(address[] calldata nfts, NFTContractType[] calldata contractTypes) external onlyOwner {
    for (uint256 i = 0; i < nfts.length; ++i) {
      emit UpdatePointBoostNFT(nfts[i], contractTypes[i]);
      _boostedNFTs[nfts[i]] = contractTypes[i];
    }
  }

  function _isClanActivityType(ActivityType activityType) private pure returns (bool) {
    return (activityType == ActivityType.clans_evt_clancreated ||
      activityType == ActivityType.lockedbankvaults_evt_attackvaults ||
      activityType == ActivityType.territories_evt_attackterritory ||
      activityType == ActivityType.territories_evt_claimunoccupiedterritory);
  }

  function _isHolder(
    NFTContractType contractType,
    address nft,
    uint256 tokenId,
    address msgSender
  ) private view returns (bool isHolder) {
    if (contractType == NFTContractType.ERC721) {
      isHolder = IERC721(nft).ownerOf(tokenId) == msgSender;
    } else if (contractType == NFTContractType.ERC1155) {
      isHolder = IERC1155(nft).balanceOf(msgSender, tokenId) == 1;
    }
  }

  function _applyPointBoost(address recipient, uint256 points) private returns (uint256 boosted) {
    boosted = points;
    uint40 timestamp = uint40(block.timestamp);
    PointBoost memory boost = _boosts[recipient];
    // check to see if the boost is active
    NFTContractType contractType = _boostedNFTs[boost.nft];
    if (
      contractType != NFTContractType.NONE &&
      boost.activated < timestamp &&
      // the registered and current owner must be the same
      recipient == _nftBoostOwners[boost.nft][boost.tokenId]
    ) {
      bool isOwner;
      if (contractType == NFTContractType.ERC721) {
        isOwner = IERC721(boost.nft).ownerOf(boost.tokenId) == recipient;
      } else if (contractType == NFTContractType.ERC1155) {
        isOwner = IERC1155(boost.nft).balanceOf(recipient, boost.tokenId) == 1;
      }

      if (isOwner) {
        uint16 current = uint16(timestamp / 1 days);
        BoostDailyCheckpoint storage checkpoint = _boostNFTCheckpoints[boost.nft];

        _rollCheckpoint(checkpoint, current);

        BoostDailyCheckpoint storage globalCheckpoint = _boostCheckpoints;

        if (checkpoint.previousPoints != 0) {
          _rollCheckpoint(globalCheckpoint, current);

          // use the previous checkpoint to calculate the multiplier out of 50, capped at 10%, at least 1%
          uint256 multiplier = 100 +
            Math.max(1, Math.min(10, (checkpoint.previousPoints * 50 * 100) / globalCheckpoint.previousPoints / 100));
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
    address recipient,
    ActivityType activityType,
    uint256 maxPointsPerDay,
    uint256 points
  ) private returns (uint256 adjusted) {
    adjusted = points;
    if (maxPointsPerDay != 0) {
      DailyCheckpoint storage checkpoint = _checkpoints[recipient][activityType];
      uint112 amount = checkpoint.amount;
      uint16 current = uint16(block.timestamp / 1 days);
      if (checkpoint.current != current) {
        // reset the checkpoint
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
    _addPointsCalculation(activityType, CalculationType.discrete, points, 1, 1, maxPointsPerDay);
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
    _addPointsCalculation(activityType, CalculationType.log2, base, multiplier, divider, maxPointsPerDay);
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
    _addPointsCalculation(activityType, CalculationType.log10, base, multiplier, divider, maxPointsPerDay);
  }

  function _addPointsCalculation(
    ActivityType activityType,
    CalculationType calculation,
    uint16 base,
    uint16 multiplier,
    uint16 divider,
    uint64 maxPointsPerDay
  ) private {
    _calculations[activityType] = Calculation(calculation, base, multiplier, divider, maxPointsPerDay);
    emit AddPointsCalculation(activityType, calculation, base, multiplier, divider, maxPointsPerDay);
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
