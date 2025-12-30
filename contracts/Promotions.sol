// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {BitMaps} from "@openzeppelin/contracts/utils/structs/BitMaps.sol";
import {AdminAccess} from "./AdminAccess.sol";
import {ItemNFT} from "./ItemNFT.sol";
import {IPlayers} from "./interfaces/IPlayers.sol";
import {IBrushToken} from "./interfaces/external/IBrushToken.sol";
import {PlayerNFT} from "./PlayerNFT.sol";
import {RandomnessBeacon} from "./RandomnessBeacon.sol";
import {Quests} from "./Quests.sol";
import {PromotionsLibrary} from "./PromotionsLibrary.sol";
import {DailyRewardsScheduler} from "./DailyRewardsScheduler.sol";

import "./globals/items.sol";
import "./globals/rewards.sol";
import "./globals/promotions.sol";

contract Promotions is UUPSUpgradeable, OwnableUpgradeable {
  using BitMaps for BitMaps.BitMap;

  event PromotionRedeemed(
    address indexed to,
    uint256 playerId,
    Promotion promotion,
    string redeemCode,
    uint256[] itemTokenIds,
    uint256[] amounts,
    uint256[] daysRedeemed,
    uint256 tokenCost
  );

  event AddPromotions(PromotionInfoInput[] promotionInfos);
  event EditPromotions(PromotionInfoInput[] promotionInfos);
  event RemovePromotions(Promotion[] promotions);
  event ClearPlayerPromotions(uint256 playerId, Promotion[] promotions);
  event SetBrushDistributionPercentages(
    uint256 brushBurntPercentage,
    uint256 brushTreasuryPercentage,
    uint256 brushDevPercentage
  );

  error NotOwnerOfPlayer();
  error PromotionAlreadyClaimed();
  error InvalidRedeemCode();
  error NotPromotionalAdmin();
  error NotAdminAndBeta();
  error NotOwnerOfPlayerAndActive();
  error InvalidPromotion();
  error PlayerDoesNotQualify();
  error OracleNotCalled();
  error PromotionNotAdded();
  error MintingOutsideAvailableDate();
  error PromotionNotSet();
  error PlayerNotHitEnoughClaims();
  error InvalidBrushCost();
  error PlayerNotEvolved();
  error NotEnoughBrush();
  error MustBeAdminOnlyPromotion();
  error CannotPayForToday();
  error DaysArrayNotSortedOrDuplicates();
  error PromotionFinished();
  error PercentNotTotal100();
  error DependentQuestNotCompleted();

  AdminAccess private _adminAccess;
  IPlayers private _players;
  ItemNFT private _itemNFT;
  PlayerNFT private _playerNFT;
  IBrushToken private _brush;
  RandomnessBeacon private _randomnessBeacon;
  DailyRewardsScheduler private _dailyRewardsScheduler;
  Quests private _quests;
  address private _dev;
  address private _treasury;
  uint8 private _brushBurntPercentage;
  uint8 private _brushTreasuryPercentage;
  uint8 private _brushDevPercentage;
  bool private _isBeta;
  mapping(uint256 playerId => BitMaps.BitMap) private _singlePlayerPromotionsCompleted;
  mapping(Promotion promotion => PromotionInfo) private _activePromotions;
  mapping(uint256 playerId => mapping(Promotion promotion => uint8[32] daysCompleted))
    private _multidayPlayerPromotionsCompleted; // Total 31 days (1 month), last one indicates if the final day bonus has been claimed

  // Special promotions
  mapping(address user => BitMaps.BitMap) private _userPromotionsClaimed;
  mapping(uint256 playerId => BitMaps.BitMap) private _playerPromotionsClaimed;

  uint256 public constant FINAL_PROMOTION_DAY_INDEX = 31;

  modifier isOwnerOfPlayerAndActive(uint256 playerId) {
    require(_players.isOwnerOfPlayerAndActive(_msgSender(), playerId), NotOwnerOfPlayerAndActive());
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    IPlayers players,
    RandomnessBeacon randomnessBeacon,
    DailyRewardsScheduler dailyRewardsScheduler,
    ItemNFT itemNFT,
    PlayerNFT playerNFT,
    Quests quests,
    IBrushToken brush,
    address treasury,
    address dev,
    AdminAccess adminAccess,
    bool isBeta
  ) external initializer {
    __Ownable_init(_msgSender());
    __UUPSUpgradeable_init();

    _players = players;
    _randomnessBeacon = randomnessBeacon;
    _dailyRewardsScheduler = dailyRewardsScheduler;
    _itemNFT = itemNFT;
    _playerNFT = playerNFT;
    _quests = quests;
    _brush = brush;
    _treasury = treasury;
    _dev = dev;
    _adminAccess = adminAccess;
    _isBeta = isBeta;
  }

  modifier onlyPromotionalAdmin() {
    require(_adminAccess.isPromotionalAdmin(_msgSender()), NotPromotionalAdmin());
    _;
  }

  modifier isAdminAndBeta() {
    require(_adminAccess.isAdmin(_msgSender()) && _isBeta, NotAdminAndBeta());
    _;
  }

  // Keep for backwards compatibility for now
  function mintStarterPromotionalPack(
    address to,
    uint256 playerId,
    string calldata redeemCode
  ) external onlyPromotionalAdmin {
    require(!_userPromotionsClaimed[to].get(uint8(Promotion.STARTER)), PromotionAlreadyClaimed());
    require(bytes(redeemCode).length == 16, InvalidRedeemCode());
    require(_playerNFT.balanceOf(to, playerId) == 1, NotOwnerOfPlayer());

    uint256[] memory itemTokenIds = new uint256[](5);
    uint256[] memory amounts = new uint256[](5);
    uint256[] memory daysToSet = new uint256[](5);
    itemTokenIds[0] = XP_BOOST; // 5x XP Boost
    amounts[0] = 5;
    itemTokenIds[1] = SKILL_BOOST; // 3x Skill Boost
    amounts[1] = 3;
    itemTokenIds[2] = COOKED_FEOLA; // 200x Cooked Feola
    amounts[2] = 200;
    itemTokenIds[3] = SHADOW_SCROLL; // 300x Shadow Scrolls
    amounts[3] = 300;
    itemTokenIds[4] = SECRET_EGG_2_TIER1; // 1x Special Egg
    amounts[4] = 1;

    _userPromotionsClaimed[to].set(uint8(Promotion.STARTER));

    try _itemNFT.mintBatch(to, itemTokenIds, amounts) {} catch {
      assembly ("memory-safe") {
        mstore(itemTokenIds, 0)
        mstore(amounts, 0)
      }
    }

    for (uint256 i; i < daysToSet.length; ++i) {
      daysToSet[i] = FINAL_PROMOTION_DAY_INDEX;
    }

    emit PromotionRedeemed(to, playerId, Promotion.STARTER, redeemCode, itemTokenIds, amounts, daysToSet, 0);
  }

  function adminMintPromotionalPack(
    address to,
    uint256 playerId,
    string calldata redeemCode,
    Promotion promotion
  ) external onlyPromotionalAdmin {
    PromotionInfo storage promotionInfo = _activePromotions[promotion];

    require(promotionInfo.adminOnly, MustBeAdminOnlyPromotion());

    if (promotionInfo.promotionTiedToUser) {
      require(!_userPromotionsClaimed[to].get(uint8(promotion)), PromotionAlreadyClaimed());
      _userPromotionsClaimed[to].set(uint8(promotion));
    }

    if (promotionInfo.promotionTiedToPlayer) {
      require(!_playerPromotionsClaimed[playerId].get(uint8(promotion)), PromotionAlreadyClaimed());
      _playerPromotionsClaimed[playerId].set(uint8(promotion));
    }

    require(bytes(redeemCode).length == promotionInfo.redeemCodeLength, InvalidRedeemCode());
    require(promotionInfo.promotionMustOwnPlayer && _playerNFT.balanceOf(to, playerId) == 1, NotOwnerOfPlayer());

    uint256[] memory itemTokenIds = new uint256[](promotionInfo.guaranteedItemTokenIds.length);
    uint256[] memory amounts = new uint256[](promotionInfo.guaranteedItemTokenIds.length);
    uint256[] memory daysToSet = new uint256[](promotionInfo.guaranteedItemTokenIds.length);

    for (uint256 i; i < promotionInfo.guaranteedItemTokenIds.length; ++i) {
      itemTokenIds[i] = promotionInfo.guaranteedItemTokenIds[i];
      amounts[i] = promotionInfo.guaranteedAmounts[i];
      daysToSet[i] = FINAL_PROMOTION_DAY_INDEX;
    }

    try _itemNFT.mintBatch(to, itemTokenIds, amounts) {} catch {
      assembly ("memory-safe") {
        mstore(itemTokenIds, 0)
        mstore(amounts, 0)
      }
    }
    emit PromotionRedeemed(to, playerId, promotion, redeemCode, itemTokenIds, amounts, daysToSet, 0);
  }

  // 0 indexed
  function payMissedPromotionDays(
    uint256 playerId,
    Promotion promotion,
    uint256[] calldata missedDays
  ) external isOwnerOfPlayerAndActive(playerId) {
    PromotionInfo storage promotionInfo = _activePromotions[promotion];

    require(promotionInfo.isMultiday, PromotionNotSet());
    require(promotionInfo.brushCostMissedDay != 0, InvalidBrushCost());
    // Don't allow to pay if the promotion has finished
    require(
      promotionInfo.startTime + (promotionInfo.numDays + promotionInfo.numDaysClaimablePeriodStreakBonus) * 1 days >
        block.timestamp,
      PromotionFinished()
    );

    uint256[] memory itemTokenIds = new uint256[](missedDays.length);
    uint256[] memory amounts = new uint256[](missedDays.length);
    uint256[] memory daysToSet = new uint256[](missedDays.length);

    uint256 today = (block.timestamp - promotionInfo.startTime) / 1 days;

    // Check that the days are in order and there are no duplicates
    for (uint256 i; i < missedDays.length; ++i) {
      // Check you are not trying to claim todays one
      require(today != missedDays[i], CannotPayForToday());
      (
        uint256[] memory previousDayItemTokenIds,
        uint256[] memory previousDayAmounts,
        uint256[] memory previousDaysToSet,
        PromotionMintStatus promotionMintStatus
      ) = mintPromotionView(playerId, promotion, promotionInfo.startTime + missedDays[i] * 1 days);

      _checkPromotionMintStatus(promotionMintStatus);

      itemTokenIds[i] = previousDayItemTokenIds[0];
      amounts[i] = previousDayAmounts[0];
      daysToSet[i] = previousDaysToSet[0];
      _multidayPlayerPromotionsCompleted[playerId][promotion][missedDays[i]] = 0xFF;

      require(i == missedDays.length - 1 || missedDays[i] < missedDays[i + 1], DaysArrayNotSortedOrDuplicates());
    }

    uint256 totalCost = ((uint256(promotionInfo.brushCostMissedDay) * 1 ether) / BRUSH_COST_MISSED_DAY_MUL) *
      missedDays.length;
    _pay(totalCost);

    _itemNFT.mintBatch(_msgSender(), itemTokenIds, amounts);

    emit PromotionRedeemed(_msgSender(), playerId, promotion, "", itemTokenIds, amounts, daysToSet, totalCost);
  }

  function _checkPromotionMintStatus(PromotionMintStatus promotionMintStatus) private pure {
    if (promotionMintStatus != PromotionMintStatus.SUCCESS) {
      require(promotionMintStatus != PromotionMintStatus.PROMOTION_ALREADY_CLAIMED, PromotionAlreadyClaimed());
      require(promotionMintStatus != PromotionMintStatus.ORACLE_NOT_CALLED, OracleNotCalled());
      require(promotionMintStatus != PromotionMintStatus.MINTING_OUTSIDE_AVAILABLE_DATE, MintingOutsideAvailableDate());
      require(promotionMintStatus != PromotionMintStatus.PLAYER_DOES_NOT_QUALIFY, PlayerDoesNotQualify());
      require(
        promotionMintStatus != PromotionMintStatus.PLAYER_NOT_HIT_ENOUGH_CLAIMS_FOR_STREAK_BONUS,
        PlayerNotHitEnoughClaims()
      );
      require(promotionMintStatus != PromotionMintStatus.DEPENDENT_QUEST_NOT_COMPLETED, DependentQuestNotCompleted());
    }
  }

  function mintPromotion(uint256 playerId, Promotion promotion) external isOwnerOfPlayerAndActive(playerId) {
    (
      uint256[] memory itemTokenIds,
      uint256[] memory amounts,
      uint256[] memory daysToSet,
      PromotionMintStatus promotionMintStatus
    ) = mintPromotionView(playerId, promotion, block.timestamp);

    _checkPromotionMintStatus(promotionMintStatus);

    // Check they have paid or have an evolved hero if the promotion requires it
    PromotionInfo storage promotionInfo = _activePromotions[promotion];
    if (!hasClaimedAny(playerId, promotion)) {
      if (promotionInfo.tokenCost != 0) {
        _pay(promotionInfo.tokenCost * 1 ether);
      } else {
        require(!promotionInfo.evolvedHeroOnly || _players.isPlayerEvolved(playerId), PlayerNotEvolved());
      }
    }

    if (promotionInfo.isMultiday) {
      _multidayPlayerPromotionsCompleted[playerId][promotion][daysToSet[0]] = 0xFF;
    } else {
      // Mark the promotion as completed
      _singlePlayerPromotionsCompleted[playerId].set(uint256(promotion));
    }

    if (itemTokenIds.length != 0) {
      _itemNFT.mintBatch(_msgSender(), itemTokenIds, amounts);
    }

    emit PromotionRedeemed(_msgSender(), playerId, promotion, "", itemTokenIds, amounts, daysToSet, 0);
  }

  function mintPromotionViewNow(
    uint256 playerId,
    Promotion promotion
  )
    public
    view
    returns (
      uint256[] memory itemTokenIds,
      uint256[] memory amounts,
      uint256[] memory daysToSet,
      PromotionMintStatus promotionMintStatus
    )
  {
    return mintPromotionView(playerId, promotion, block.timestamp);
  }

  // Should not revert (outside of developer asserts)
  function mintPromotionView(
    uint256 playerId,
    Promotion promotion,
    uint256 timestamp
  )
    public
    view
    returns (
      uint256[] memory itemTokenIds,
      uint256[] memory amounts,
      uint256[] memory daysToSet,
      PromotionMintStatus promotionMintStatus
    )
  {
    PromotionInfo memory promotionInfo = _activePromotions[promotion];
    uint256 dayToSet = FINAL_PROMOTION_DAY_INDEX;
    if (promotionInfo.isMultiday) {
      (itemTokenIds, amounts, dayToSet, promotionMintStatus) = _handleMultidayPromotionView(
        playerId,
        promotion,
        timestamp
      );
    } else {
      // Single day promotion
      (itemTokenIds, amounts, promotionMintStatus) = _handleSinglePromotionView(playerId, promotion, timestamp);
    }

    daysToSet = new uint256[](itemTokenIds.length);
    for (uint256 i; i < daysToSet.length; ++i) {
      daysToSet[i] = dayToSet;
    }
  }

  function getActivePromotion(uint256 promotionId) external view returns (PromotionInfo memory) {
    return _activePromotions[Promotion(promotionId)];
  }

  function getMultidayPlayerPromotionsCompleted(
    uint256 playerId,
    Promotion promotion,
    uint256 day
  ) external view returns (uint8) {
    return _multidayPlayerPromotionsCompleted[playerId][promotion][day];
  }

  function _checkMintPromotion(
    uint256 playerId,
    Promotion promotion,
    uint256 timestamp
  ) private view returns (PromotionMintStatus) {
    PromotionInfo memory promotionInfo = _activePromotions[promotion];
    if (
      promotionInfo.startTime > timestamp || (promotionInfo.startTime + promotionInfo.numDays * 1 days) <= timestamp
    ) {
      return PromotionMintStatus.MINTING_OUTSIDE_AVAILABLE_DATE;
    }

    if (_singlePlayerPromotionsCompleted[playerId].get(uint256(promotion))) {
      return PromotionMintStatus.PROMOTION_ALREADY_CLAIMED;
    }

    if (promotionInfo.minTotalXP > _players.getTotalXP(playerId)) {
      return PromotionMintStatus.PLAYER_DOES_NOT_QUALIFY;
    }

    if (
      promotionInfo.questPrerequisiteId != 0 && !_quests.isQuestCompleted(playerId, promotionInfo.questPrerequisiteId)
    ) {
      return PromotionMintStatus.DEPENDENT_QUEST_NOT_COMPLETED;
    }

    return PromotionMintStatus.SUCCESS;
  }

  function _checkMultidayDailyMintPromotion(
    uint256 playerId,
    Promotion promotion,
    uint256 timestamp
  ) private view returns (PromotionMintStatus) {
    PromotionInfo memory promotionInfo = _activePromotions[promotion];
    if (
      promotionInfo.startTime > timestamp || (promotionInfo.startTime + promotionInfo.numDays * 1 days) <= timestamp
    ) {
      return PromotionMintStatus.MINTING_OUTSIDE_AVAILABLE_DATE;
    }

    // Have they minted today's promotion already?
    uint256 today = (timestamp - promotionInfo.startTime) / 1 days;
    if (_multidayPlayerPromotionsCompleted[playerId][promotion][today] != 0) {
      return PromotionMintStatus.PROMOTION_ALREADY_CLAIMED;
    }

    if (promotionInfo.minTotalXP > _players.getTotalXP(playerId)) {
      return PromotionMintStatus.PLAYER_DOES_NOT_QUALIFY;
    }
    return PromotionMintStatus.SUCCESS;
  }

  function _getTierReward(
    uint256 playerId,
    RandomnessBeacon randomnessBeacon,
    uint256 oracleTime,
    PromotionMintStatus oldStatus
  ) private view returns (uint256 itemTokenId, uint256 amount, PromotionMintStatus promotionMintStatus) {
    // No items specified to choose from so pick a random daily item from the tier above
    promotionMintStatus = oldStatus;
    uint256 totalXP = _players.getTotalXP(playerId);
    uint256 playerTier;

    // Work out the tier
    if (totalXP >= TIER_6_DAILY_REWARD_START_XP) {
      playerTier = 6; // Can't go higher than 6 currently
    } else if (totalXP >= TIER_5_DAILY_REWARD_START_XP) {
      playerTier = 5;
    } else if (totalXP >= TIER_4_DAILY_REWARD_START_XP) {
      playerTier = 5;
    } else if (totalXP >= TIER_3_DAILY_REWARD_START_XP) {
      playerTier = 4;
    } else if (totalXP >= TIER_2_DAILY_REWARD_START_XP) {
      playerTier = 3;
    } else {
      playerTier = 2;
    }

    if (!randomnessBeacon.hasRandomWord(oracleTime)) {
      promotionMintStatus = PromotionMintStatus.ORACLE_NOT_CALLED;
    } else {
      (itemTokenId, amount) = _dailyRewardsScheduler.getSpecificDailyReward(
        playerTier,
        playerId,
        0,
        randomnessBeacon.getRandomWord(oracleTime)
      );
    }
  }

  function _handleSinglePromotionView(
    uint256 playerId,
    Promotion promotion,
    uint256 timestamp
  )
    private
    view
    returns (uint256[] memory itemTokenIds, uint256[] memory amounts, PromotionMintStatus promotionMintStatus)
  {
    PromotionInfo memory promotionInfo = _activePromotions[promotion];
    promotionMintStatus = _checkMintPromotion(playerId, promotion, timestamp);
    if (promotionMintStatus == PromotionMintStatus.SUCCESS) {
      // TODO: Support more than 1 numDailyRandomItemsToPick later
      itemTokenIds = new uint256[](
        promotionInfo.numDailyRandomItemsToPick + promotionInfo.guaranteedItemTokenIds.length
      );
      amounts = new uint256[](promotionInfo.numDailyRandomItemsToPick + promotionInfo.guaranteedItemTokenIds.length);

      // First add the guaranteed items
      for (uint256 i; i < promotionInfo.guaranteedItemTokenIds.length; ++i) {
        itemTokenIds[i] = promotionInfo.guaranteedItemTokenIds[i];
        amounts[i] = promotionInfo.guaranteedAmounts[i];
      }

      // Pick a random item from the list, only supports 1 item atm
      uint256 numAvailableItems = promotionInfo.randomItemTokenIds.length;
      RandomnessBeacon randomnessBeacon = _randomnessBeacon;

      uint256 oracleTime = (promotionInfo.startTime / 1 days) * 1 days - 1;
      if (!randomnessBeacon.hasRandomWord(oracleTime)) {
        promotionMintStatus = PromotionMintStatus.ORACLE_NOT_CALLED;
      } else {
        uint256 randomWord = randomnessBeacon.getRandomWord(oracleTime);
        uint256 modifiedRandomWord = uint256(keccak256(abi.encodePacked(randomWord, playerId)));
        uint256 index = modifiedRandomWord % numAvailableItems;

        uint256 startIndex = promotionInfo.guaranteedItemTokenIds.length; // Guaranteed items are in front
        itemTokenIds[startIndex] = promotionInfo.randomItemTokenIds[index];
        amounts[startIndex] = promotionInfo.randomAmounts[index];
      }
    }
  }

  // TODO: Only really supporting xmas 2023 so far with tiered rewards (and halloween 2024)
  function _handleMultidayPromotionView(
    uint256 playerId,
    Promotion promotion,
    uint256 timestamp
  )
    private
    view
    returns (
      uint256[] memory itemTokenIds,
      uint256[] memory amounts,
      uint256 dayToSet,
      PromotionMintStatus promotionMintStatus
    )
  {
    PromotionInfo memory promotionInfo = _activePromotions[promotion];
    if (timestamp < promotionInfo.startTime) {
      return (itemTokenIds, amounts, dayToSet, PromotionMintStatus.MINTING_OUTSIDE_AVAILABLE_DATE);
    }

    uint256 today = (timestamp - promotionInfo.startTime) / 1 days;
    if (today < promotionInfo.numDays) {
      itemTokenIds = new uint256[](
        promotionInfo.numDailyRandomItemsToPick + promotionInfo.guaranteedItemTokenIds.length
      );
      amounts = new uint256[](promotionInfo.numDailyRandomItemsToPick + promotionInfo.guaranteedItemTokenIds.length);

      // First add the guaranteed items
      for (uint256 i; i < promotionInfo.guaranteedItemTokenIds.length; ++i) {
        itemTokenIds[i] = promotionInfo.guaranteedItemTokenIds[i];
        amounts[i] = promotionInfo.guaranteedAmounts[i];
      }

      promotionMintStatus = _checkMultidayDailyMintPromotion(playerId, promotion, timestamp);
      if (promotionMintStatus == PromotionMintStatus.SUCCESS) {
        // TODO: Update this on Sonic branch with better flags. Currently only supports tiered rewards
        if (promotionInfo.guaranteedItemTokenIds.length == 0 && promotionInfo.randomItemTokenIds.length == 0) {
          // Currently assumes tiered rewards
          uint256 oracleTime = ((promotionInfo.startTime / 1 days + today) * 1 days) - 1;
          uint256 startIndex = promotionInfo.guaranteedItemTokenIds.length; // Guaranteed items are in front
          (itemTokenIds[startIndex], amounts[startIndex], promotionMintStatus) = _getTierReward(
            playerId,
            _randomnessBeacon,
            oracleTime,
            promotionMintStatus
          );
        } else if (promotionInfo.guaranteedItemTokenIds.length != 0) {
          // TODO: Just temporary until the migration with better types to determine what rewards are given
        } else {
          // Not supported yet
          assert(false);
        }

        dayToSet = today;
      }
    } else if (today - promotionInfo.numDays < promotionInfo.numDaysClaimablePeriodStreakBonus) {
      promotionMintStatus = PromotionMintStatus.SUCCESS;

      // Check final day bonus hasn't been claimed and is within the claim period
      if (_multidayPlayerPromotionsCompleted[playerId][promotion][FINAL_PROMOTION_DAY_INDEX] != 0) {
        return (itemTokenIds, amounts, dayToSet, PromotionMintStatus.PROMOTION_ALREADY_CLAIMED);
      }

      // Have they actually claimed enough?
      uint256 totalClaimed;
      for (uint256 i; i < _multidayPlayerPromotionsCompleted[playerId][promotion].length; ++i) {
        if (_multidayPlayerPromotionsCompleted[playerId][promotion][i] != 0) {
          ++totalClaimed;
        }
      }

      if (totalClaimed < promotionInfo.numDaysHitNeededForStreakBonus) {
        return (itemTokenIds, amounts, dayToSet, PromotionMintStatus.PLAYER_NOT_HIT_ENOUGH_CLAIMS_FOR_STREAK_BONUS);
      }

      itemTokenIds = new uint256[](
        promotionInfo.numRandomStreakBonusItemsToPick1 +
          promotionInfo.numRandomStreakBonusItemsToPick2 +
          promotionInfo.guaranteedItemTokenIds.length
      );
      amounts = new uint256[](
        promotionInfo.numRandomStreakBonusItemsToPick1 +
          promotionInfo.numRandomStreakBonusItemsToPick2 +
          promotionInfo.guaranteedItemTokenIds.length
      );
      dayToSet = FINAL_PROMOTION_DAY_INDEX;

      // Mint the final day bonus
      uint256 numAvailableItems = promotionInfo.randomStreakBonusItemTokenIds1.length;

      uint256 endTime = promotionInfo.startTime + promotionInfo.numDays * 1 days;
      uint256 oracleTime = (endTime / 1 days) * 1 days - 1;
      if (!_randomnessBeacon.hasRandomWord(oracleTime)) {
        return (itemTokenIds, amounts, dayToSet, PromotionMintStatus.ORACLE_NOT_CALLED);
      }

      // The streak bonus random reward should be based on the last day of the promotion. Pick a random item from the list
      uint256 randomWord = _randomnessBeacon.getRandomWord(oracleTime);
      uint256 modifiedRandomWord = uint256(keccak256(abi.encodePacked(randomWord, playerId)));
      uint256 index = modifiedRandomWord % numAvailableItems;
      itemTokenIds[0] = promotionInfo.randomStreakBonusItemTokenIds1[index];
      amounts[0] = promotionInfo.randomStreakBonusAmounts1[index];
    } else {
      return (itemTokenIds, amounts, dayToSet, PromotionMintStatus.MINTING_OUTSIDE_AVAILABLE_DATE);
    }
  }

  function _pay(uint256 tokenCost) private {
    address sender = _msgSender();
    require(_brush.transferFrom(sender, _treasury, (tokenCost * _brushTreasuryPercentage) / 100), NotEnoughBrush());
    require(_brush.transferFrom(sender, _dev, (tokenCost * _brushDevPercentage) / 100), NotEnoughBrush());
    _brush.burnFrom(sender, (tokenCost * _brushBurntPercentage) / 100);
  }

  // Takes into account the current day for multiday promotions unless outside the range in which case checks the final day bonus.
  function hasCompletedPromotion(uint256 playerId, Promotion promotion) external view returns (bool) {
    PromotionInfo memory promotionInfo = _activePromotions[promotion];
    if (promotionInfo.isMultiday) {
      if (block.timestamp < promotionInfo.startTime) {
        return false;
      }

      uint256 today = (block.timestamp - promotionInfo.startTime) / 1 days;
      if (today <= promotionInfo.numDays) {
        return _multidayPlayerPromotionsCompleted[playerId][promotion][today] != 0;
      }

      return _multidayPlayerPromotionsCompleted[playerId][promotion][FINAL_PROMOTION_DAY_INDEX] != 0;
    }
    return _singlePlayerPromotionsCompleted[playerId].get(uint256(promotion));
  }

  function hasClaimedAny(uint256 playerId, Promotion promotion) public view returns (bool) {
    PromotionInfo storage promotionInfo = _activePromotions[promotion];
    if (promotionInfo.isMultiday) {
      bool anyClaimed;
      uint8[32] storage daysCompleted = _multidayPlayerPromotionsCompleted[playerId][promotion];
      assembly ("memory-safe") {
        // Anything set in the word would mean at least 1 is claimed
        anyClaimed := iszero(iszero(sload(daysCompleted.slot)))
      }
      return anyClaimed;
    }
    return _singlePlayerPromotionsCompleted[playerId].get(uint256(promotion));
  }

  function testClearPlayerPromotions(uint256 playerId, Promotion[] calldata promotions) external isAdminAndBeta {
    for (uint256 i; i < promotions.length; ++i) {
      _singlePlayerPromotionsCompleted[playerId].unset(uint256(promotions[i]));
      delete _multidayPlayerPromotionsCompleted[playerId][promotions[i]];
    }
    emit ClearPlayerPromotions(playerId, promotions);
  }

  function addPromotions(PromotionInfoInput[] calldata promotionInfoInput) external onlyOwner {
    for (uint256 i; i < promotionInfoInput.length; ++i) {
      PromotionsLibrary.addPromotion(_activePromotions, promotionInfoInput[i]);
    }
    emit AddPromotions(promotionInfoInput);
  }

  function editPromotions(PromotionInfoInput[] calldata promotionInfoInputs) external onlyOwner {
    for (uint256 i; i < promotionInfoInputs.length; ++i) {
      PromotionsLibrary.editPromotion(_activePromotions, promotionInfoInputs[i]);
    }
    emit EditPromotions(promotionInfoInputs);
  }

  function removePromotions(Promotion[] calldata promotions) external onlyOwner {
    for (uint256 i; i < promotions.length; ++i) {
      require(_activePromotions[promotions[i]].promotion != Promotion.NONE, PromotionNotAdded());
      delete _activePromotions[promotions[i]];
    }
    emit RemovePromotions(promotions);
  }

  function setBrushDistributionPercentages(
    uint8 brushBurntPercentage,
    uint8 brushTreasuryPercentage,
    uint8 brushDevPercentage
  ) external onlyOwner {
    require(brushBurntPercentage + brushTreasuryPercentage + brushDevPercentage == 100, PercentNotTotal100());
    _brushBurntPercentage = brushBurntPercentage;
    _brushTreasuryPercentage = brushTreasuryPercentage;
    _brushDevPercentage = brushDevPercentage;
    emit SetBrushDistributionPercentages(brushBurntPercentage, brushTreasuryPercentage, brushDevPercentage);
  }

  function setDevAddress(address dev) external onlyOwner {
    _dev = dev;
  }
  
  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
