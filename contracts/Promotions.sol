// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";
import {BitMaps} from "@openzeppelin/contracts/utils/structs/BitMaps.sol";
import {AdminAccess} from "./AdminAccess.sol";
import {ItemNFT} from "./ItemNFT.sol";
import {IPlayers} from "./interfaces/IPlayers.sol";
import {IBrushToken} from "./interfaces/IBrushToken.sol";
import {PlayerNFT} from "./PlayerNFT.sol";
import {World} from "./World.sol";
import {PromotionsLibrary} from "./PromotionsLibrary.sol";

import "./globals/items.sol";
import "./globals/rewards.sol";
import "./globals/promotions.sol";

contract Promotions is UUPSUpgradeable, OwnableUpgradeable {
  using BitMaps for BitMaps.BitMap;

  event PromotionRedeemedV2(
    address indexed to,
    uint playerId,
    Promotion promotion,
    string redeemCode,
    uint[] itemTokenIds,
    uint[] amounts,
    uint[] daysRedeemed,
    uint brushPaid,
    uint brushBurnt,
    uint brushTreasure
  );

  event AddPromotion(PromotionInfoInput promotionInfo);
  event EditPromotion(PromotionInfoInput promotionInfo);
  event RemovePromotion(Promotion promotion);
  event ClearPlayerPromotion(uint playerId, Promotion promotion);

  // For previous versions of the events
  event PromotionAdded(PromotionInfoV1 promotionInfo);
  event PromotionRedeemed(
    address indexed to,
    uint playerId,
    Promotion promotion,
    string redeemCode,
    uint[] itemTokenIds,
    uint[] amounts
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

  struct PromotionInfoV1 {
    Promotion promotion;
    uint40 dateStart;
    uint40 dateEnd; // Exclusive
    uint16 minTotalXP; // Minimum level required to claim
    uint8 numItemsToPick; // Number of items to pick
    bool isRandom; // The selection is random
    uint16[] itemTokenIds; // Possible items for the promotions each day, if empty then they are handled in a specific way for the promotion like daily rewards
    uint32[] amounts; // Corresponding amounts to the itemTokenIds
  }

  mapping(address user => uint noLongerUsed) public users; // No longer used
  AdminAccess private adminAccess;
  ItemNFT private itemNFT;
  PlayerNFT private playerNFT;
  bool private isBeta;
  mapping(uint playerId => BitMaps.BitMap) private singlePlayerPromotionsCompleted;
  mapping(Promotion promotion => PromotionInfo) public activePromotions;
  mapping(uint playerId => mapping(Promotion promotion => uint8[32] daysCompleted))
    public multidayPlayerPromotionsCompleted; // Total 31 days (1 month), last one indicates if the final day bonus has been claimed

  // Special promotions
  mapping(address user => BitMaps.BitMap) private userPromotionsClaimed;
  mapping(uint playerId => BitMaps.BitMap) private playerPromotionsClaimed;

  uint public constant FINAL_PROMOTION_DAY_INDEX = 31;

  modifier isOwnerOfPlayerAndActive(uint _playerId) {
    if (!IPlayers(itemNFT.players()).isOwnerOfPlayerAndActive(msg.sender, _playerId)) {
      revert NotOwnerOfPlayerAndActive();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    AdminAccess _adminAccess,
    ItemNFT _itemNFT,
    PlayerNFT _playerNFT,
    bool _isBeta
  ) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();

    itemNFT = _itemNFT;
    playerNFT = _playerNFT;
    adminAccess = _adminAccess;
    isBeta = _isBeta;
  }

  modifier onlyPromotionalAdmin() {
    if (!adminAccess.isPromotionalAdmin(_msgSender())) {
      revert NotPromotionalAdmin();
    }
    _;
  }

  modifier isAdminAndBeta() {
    if (!(adminAccess.isAdmin(_msgSender()) && isBeta)) {
      revert NotAdminAndBeta();
    }
    _;
  }

  // Keep for backwards compatibility for now
  function mintStarterPromotionalPack(
    address _to,
    uint _playerId,
    string calldata _redeemCode
  ) external onlyPromotionalAdmin {
    if (userPromotionsClaimed[_to].get(uint8(Promotion.STARTER))) {
      revert PromotionAlreadyClaimed();
    }

    if (bytes(_redeemCode).length != 16) {
      revert InvalidRedeemCode();
    }

    if (playerNFT.balanceOf(_to, _playerId) != 1) {
      revert NotOwnerOfPlayer();
    }

    uint[] memory itemTokenIds = new uint[](5);
    uint[] memory amounts = new uint[](5);
    uint[] memory daysToSet = new uint[](5);
    itemTokenIds[0] = XP_BOOST; // 5x XP Boost
    amounts[0] = 5;
    itemTokenIds[1] = SKILL_BOOST; // 3x Skill Boost
    amounts[1] = 3;
    itemTokenIds[2] = COOKED_FEOLA; // 200x Cooked Feola
    amounts[2] = 200;
    itemTokenIds[3] = SHADOW_SCROLL; // 300x Shadow Scrolls
    amounts[3] = 300;
    itemTokenIds[4] = SECRET_EGG_2; // 1x Special Egg
    amounts[4] = 1;

    userPromotionsClaimed[_to].set(uint8(Promotion.STARTER));

    itemNFT.mintBatch(_to, itemTokenIds, amounts);

    for (uint i; i < daysToSet.length; ++i) {
      daysToSet[i] = FINAL_PROMOTION_DAY_INDEX;
    }

    emit PromotionRedeemedV2(_to, _playerId, Promotion.STARTER, _redeemCode, itemTokenIds, amounts, daysToSet, 0, 0, 0);
  }

  function adminMintPromotionalPack(
    address _to,
    uint _playerId,
    string calldata _redeemCode,
    Promotion _promotion
  ) external onlyPromotionalAdmin {
    PromotionInfo storage promotionInfo = activePromotions[_promotion];
    if (!promotionInfo.adminOnly) {
      revert MustBeAdminOnlyPromotion();
    }

    if (promotionInfo.promotionTiedToUser) {
      if (userPromotionsClaimed[_to].get(uint8(_promotion))) {
        revert PromotionAlreadyClaimed();
      }
      userPromotionsClaimed[_to].set(uint8(_promotion));
    }

    if (promotionInfo.promotionTiedToPlayer) {
      if (playerPromotionsClaimed[_playerId].get(uint8(_promotion))) {
        revert PromotionAlreadyClaimed();
      }
      playerPromotionsClaimed[_playerId].set(uint8(_promotion));
    }

    if (bytes(_redeemCode).length != promotionInfo.redeemCodeLength) {
      revert InvalidRedeemCode();
    }

    if (promotionInfo.promotionMustOwnPlayer && playerNFT.balanceOf(_to, _playerId) != 1) {
      revert NotOwnerOfPlayer();
    }

    uint[] memory itemTokenIds = new uint[](promotionInfo.guaranteedItemTokenIds.length);
    uint[] memory amounts = new uint[](promotionInfo.guaranteedItemTokenIds.length);
    uint[] memory daysToSet = new uint[](promotionInfo.guaranteedItemTokenIds.length);

    for (uint i; i < promotionInfo.guaranteedItemTokenIds.length; ++i) {
      itemTokenIds[i] = promotionInfo.guaranteedItemTokenIds[i];
      amounts[i] = promotionInfo.guaranteedAmounts[i];
      daysToSet[i] = FINAL_PROMOTION_DAY_INDEX;
    }

    itemNFT.mintBatch(_to, itemTokenIds, amounts);
    emit PromotionRedeemedV2(_to, _playerId, _promotion, _redeemCode, itemTokenIds, amounts, daysToSet, 0, 0, 0);
  }

  // 0 indexed
  function payMissedPromotionDays(
    uint _playerId,
    Promotion _promotion,
    uint[] calldata _days
  ) external isOwnerOfPlayerAndActive(_playerId) {
    PromotionInfo storage promotionInfo = activePromotions[_promotion];
    if (!promotionInfo.isMultiday) {
      revert PromotionNotSet();
    }

    if (promotionInfo.brushCostMissedDay == 0) {
      revert InvalidBrushCost();
    }

    uint[] memory itemTokenIds = new uint[](_days.length);
    uint[] memory amounts = new uint[](_days.length);
    uint[] memory daysToSet = new uint[](_days.length);

    uint today = (block.timestamp - promotionInfo.startTime) / 1 days;

    // Check that the days are in order and there are no duplicates
    for (uint i; i < _days.length; ++i) {
      // Check you are not trying to claim todays one
      if (today == _days[i]) {
        revert CannotPayForToday();
      }

      (
        uint[] memory previousDayItemTokenIds,
        uint[] memory previousDayAmounts,
        uint[] memory previousDaysToSet,
        PromotionMintStatus promotionMintStatus
      ) = mintPromotionView(_playerId, _promotion, promotionInfo.startTime + _days[i] * 1 days);

      _checkPromotionMintStatus(promotionMintStatus);

      itemTokenIds[i] = previousDayItemTokenIds[0];
      amounts[i] = previousDayAmounts[0];
      daysToSet[i] = previousDaysToSet[0];
      multidayPlayerPromotionsCompleted[_playerId][_promotion][_days[i]] = 0xFF;

      if (i != _days.length - 1 && _days[i] >= _days[i + 1]) {
        revert DaysArrayNotSortedOrDuplicates();
      }
    }

    uint totalCost = ((uint(promotionInfo.brushCostMissedDay) * 1 ether) / BRUSH_COST_MISSED_DAY_MUL) * _days.length;
    _pay(totalCost);

    itemNFT.mintBatch(msg.sender, itemTokenIds, amounts);
    emit PromotionRedeemedV2(
      msg.sender,
      _playerId,
      _promotion,
      "",
      itemTokenIds,
      amounts,
      daysToSet,
      totalCost,
      0,
      totalCost / 2
    );
  }

  function _checkPromotionMintStatus(PromotionMintStatus _promotionMintStatus) private pure {
    if (_promotionMintStatus != PromotionMintStatus.SUCCESS) {
      if (_promotionMintStatus == PromotionMintStatus.PROMOTION_ALREADY_CLAIMED) {
        revert PromotionAlreadyClaimed();
      } else if (_promotionMintStatus == PromotionMintStatus.ORACLE_NOT_CALLED) {
        revert OracleNotCalled();
      } else if (_promotionMintStatus == PromotionMintStatus.MINTING_OUTSIDE_AVAILABLE_DATE) {
        revert MintingOutsideAvailableDate();
      } else if (_promotionMintStatus == PromotionMintStatus.PLAYER_DOES_NOT_QUALIFY) {
        revert PlayerDoesNotQualify();
      } else if (_promotionMintStatus == PromotionMintStatus.PLAYER_NOT_HIT_ENOUGH_CLAIMS_FOR_STREAK_BONUS) {
        revert PlayerNotHitEnoughClaims();
      } else {
        revert InvalidPromotion();
      }
    }
  }

  function mintPromotion(uint _playerId, Promotion _promotion) external isOwnerOfPlayerAndActive(_playerId) {
    (
      uint[] memory itemTokenIds,
      uint[] memory amounts,
      uint[] memory daysToSet,
      PromotionMintStatus promotionMintStatus
    ) = mintPromotionView(_playerId, _promotion, block.timestamp);

    _checkPromotionMintStatus(promotionMintStatus);

    // Check they have paid or have an evolved hero if the promotion requires it
    PromotionInfo storage promotionInfo = activePromotions[_promotion];
    if (!hasClaimedAny(_playerId, _promotion)) {
      if (promotionInfo.brushCost > 0) {
        _pay(promotionInfo.brushCost * 1 ether);
      } else if (promotionInfo.evolvedHeroOnly && !IPlayers(itemNFT.players()).isPlayerUpgraded(_playerId)) {
        revert PlayerNotEvolved();
      }
    }

    if (promotionInfo.isMultiday) {
      multidayPlayerPromotionsCompleted[_playerId][_promotion][daysToSet[0]] = 0xFF;
    } else {
      // Mark the promotion as completed
      singlePlayerPromotionsCompleted[_playerId].set(uint(_promotion));
    }

    if (itemTokenIds.length != 0) {
      itemNFT.mintBatch(msg.sender, itemTokenIds, amounts);
    }

    emit PromotionRedeemedV2(msg.sender, _playerId, _promotion, "", itemTokenIds, amounts, daysToSet, 0, 0, 0);
  }

  function mintPromotionViewNow(
    uint _playerId,
    Promotion _promotion
  )
    public
    view
    returns (
      uint[] memory itemTokenIds,
      uint[] memory amounts,
      uint[] memory daysToSet,
      PromotionMintStatus promotionMintStatus
    )
  {
    return mintPromotionView(_playerId, _promotion, block.timestamp);
  }

  // Should not revert (outside of developer asserts)
  function mintPromotionView(
    uint _playerId,
    Promotion _promotion,
    uint _timestamp
  )
    public
    view
    returns (
      uint[] memory itemTokenIds,
      uint[] memory amounts,
      uint[] memory daysToSet,
      PromotionMintStatus promotionMintStatus
    )
  {
    PromotionInfo memory promotionInfo = activePromotions[_promotion];
    uint dayToSet = FINAL_PROMOTION_DAY_INDEX;
    if (promotionInfo.isMultiday) {
      (itemTokenIds, amounts, dayToSet, promotionMintStatus) = _handleMultidayPromotion(
        _playerId,
        _promotion,
        _timestamp
      );
    } else {
      // Single day promotion
      (itemTokenIds, amounts, promotionMintStatus) = _handleSinglePromotion(_playerId, _promotion, _timestamp);
    }

    daysToSet = new uint[](itemTokenIds.length);
    for (uint i; i < daysToSet.length; ++i) {
      daysToSet[i] = dayToSet;
    }
  }

  function _checkMintPromotion(
    uint _playerId,
    Promotion _promotion,
    uint _timestamp
  ) private view returns (PromotionMintStatus) {
    PromotionInfo memory promotionInfo = activePromotions[_promotion];
    if (
      promotionInfo.startTime > _timestamp || (promotionInfo.startTime + promotionInfo.numDays * 1 days) <= _timestamp
    ) {
      return PromotionMintStatus.MINTING_OUTSIDE_AVAILABLE_DATE;
    }

    if (singlePlayerPromotionsCompleted[_playerId].get(uint(_promotion))) {
      return PromotionMintStatus.PROMOTION_ALREADY_CLAIMED;
    }

    if (promotionInfo.minTotalXP > IPlayers(itemNFT.players()).totalXP(_playerId)) {
      return PromotionMintStatus.PLAYER_DOES_NOT_QUALIFY;
    }
    return PromotionMintStatus.SUCCESS;
  }

  function _checkMultidayDailyMintPromotion(
    uint _playerId,
    Promotion _promotion,
    uint _timestamp
  ) private view returns (PromotionMintStatus) {
    PromotionInfo memory promotionInfo = activePromotions[_promotion];
    if (
      promotionInfo.startTime > _timestamp || (promotionInfo.startTime + promotionInfo.numDays * 1 days) <= _timestamp
    ) {
      return PromotionMintStatus.MINTING_OUTSIDE_AVAILABLE_DATE;
    }

    // Have they minted today's promotion already?
    uint today = (_timestamp - promotionInfo.startTime) / 1 days;
    if (multidayPlayerPromotionsCompleted[_playerId][_promotion][today] > 0) {
      return PromotionMintStatus.PROMOTION_ALREADY_CLAIMED;
    }

    if (promotionInfo.minTotalXP > IPlayers(itemNFT.players()).totalXP(_playerId)) {
      return PromotionMintStatus.PLAYER_DOES_NOT_QUALIFY;
    }
    return PromotionMintStatus.SUCCESS;
  }

  function _getTierReward(
    uint _playerId,
    World _world,
    uint _oracleTime,
    PromotionMintStatus _oldStatus
  ) private view returns (uint itemTokenId, uint amount, PromotionMintStatus promotionMintStatus) {
    // No items specified to choose from so pick a random daily item from the tier above
    promotionMintStatus = _oldStatus;
    uint totalXP = IPlayers(itemNFT.players()).totalXP(_playerId);
    uint playerTier;

    // Work out the tier
    if (totalXP >= TIER_5_DAILY_REWARD_START_XP) {
      playerTier = 5; // Can't go higher than 5 currently
    } else if (totalXP >= TIER_4_DAILY_REWARD_START_XP) {
      playerTier = 5;
    } else if (totalXP >= TIER_3_DAILY_REWARD_START_XP) {
      playerTier = 4;
    } else if (totalXP >= TIER_2_DAILY_REWARD_START_XP) {
      playerTier = 3;
    } else {
      playerTier = 2;
    }

    if (!_world.hasRandomWord(_oracleTime)) {
      promotionMintStatus = PromotionMintStatus.ORACLE_NOT_CALLED;
    } else {
      (itemTokenId, amount) = _world.getDailyReward(playerTier, _playerId);
    }
  }

  function _handleSinglePromotion(
    uint _playerId,
    Promotion _promotion,
    uint _timestamp
  ) private view returns (uint[] memory itemTokenIds, uint[] memory amounts, PromotionMintStatus promotionMintStatus) {
    PromotionInfo memory promotionInfo = activePromotions[_promotion];
    promotionMintStatus = _checkMintPromotion(_playerId, _promotion, _timestamp);
    if (promotionMintStatus == PromotionMintStatus.SUCCESS) {
      // TODO: Support itemTokenIds later
      itemTokenIds = new uint[](promotionInfo.numDailyRandomItemsToPick + promotionInfo.guaranteedItemTokenIds.length);
      amounts = new uint[](promotionInfo.numDailyRandomItemsToPick + promotionInfo.guaranteedItemTokenIds.length);

      // Pick a random item from the list, only supports 1 item atm
      uint numAvailableItems = promotionInfo.randomItemTokenIds.length;
      World world = itemNFT.world();

      uint oracleTime = (promotionInfo.startTime / 1 days) * 1 days - 1;
      if (!world.hasRandomWord(oracleTime)) {
        promotionMintStatus = PromotionMintStatus.ORACLE_NOT_CALLED;
      } else {
        uint randomWord = itemNFT.world().getRandomWord(oracleTime);
        uint modifiedRandomWord = uint(keccak256(abi.encodePacked(randomWord, _playerId)));
        uint index = modifiedRandomWord % numAvailableItems;
        itemTokenIds[0] = promotionInfo.randomItemTokenIds[index];
        amounts[0] = promotionInfo.randomAmounts[index];
      }
    }
  }

  // TODO: Only really supporting xmas 2023 so far with tiered rewards
  function _handleMultidayPromotion(
    uint _playerId,
    Promotion _promotion,
    uint _timestamp
  )
    private
    view
    returns (uint[] memory itemTokenIds, uint[] memory amounts, uint dayToSet, PromotionMintStatus promotionMintStatus)
  {
    PromotionInfo memory promotionInfo = activePromotions[_promotion];
    if (_timestamp < promotionInfo.startTime) {
      return (itemTokenIds, amounts, dayToSet, PromotionMintStatus.MINTING_OUTSIDE_AVAILABLE_DATE);
    }

    uint today = (_timestamp - promotionInfo.startTime) / 1 days;
    World world = itemNFT.world();
    if (today < promotionInfo.numDays) {
      itemTokenIds = new uint[](promotionInfo.numDailyRandomItemsToPick + promotionInfo.guaranteedItemTokenIds.length);
      amounts = new uint[](promotionInfo.numDailyRandomItemsToPick + promotionInfo.guaranteedItemTokenIds.length);

      promotionMintStatus = _checkMultidayDailyMintPromotion(_playerId, _promotion, _timestamp);
      if (promotionMintStatus == PromotionMintStatus.SUCCESS) {
        if (promotionInfo.randomItemTokenIds.length == 0) {
          uint oracleTime = ((promotionInfo.startTime / 1 days + today) * 1 days) - 1;
          (itemTokenIds[0], amounts[0], promotionMintStatus) = _getTierReward(
            _playerId,
            world,
            oracleTime,
            promotionMintStatus
          );
        } else {
          // Not supported yet
          assert(false);
        }

        dayToSet = today;
      }
    } else if (today - promotionInfo.numDays < promotionInfo.numDaysClaimablePeriodStreakBonus) {
      promotionMintStatus = PromotionMintStatus.SUCCESS;

      // Check final day bonus hasn't been claimed and is within the claim period
      if (multidayPlayerPromotionsCompleted[_playerId][_promotion][FINAL_PROMOTION_DAY_INDEX] > 0) {
        return (itemTokenIds, amounts, dayToSet, PromotionMintStatus.PROMOTION_ALREADY_CLAIMED);
      }

      // Have they actually claimed enough?
      uint totalClaimed;
      for (uint i; i < multidayPlayerPromotionsCompleted[_playerId][_promotion].length; ++i) {
        if (multidayPlayerPromotionsCompleted[_playerId][_promotion][i] > 0) {
          ++totalClaimed;
        }
      }

      if (totalClaimed < promotionInfo.numDaysHitNeededForStreakBonus) {
        return (itemTokenIds, amounts, dayToSet, PromotionMintStatus.PLAYER_NOT_HIT_ENOUGH_CLAIMS_FOR_STREAK_BONUS);
      }

      itemTokenIds = new uint[](
        promotionInfo.numRandomStreakBonusItemsToPick1 +
          promotionInfo.numRandomStreakBonusItemsToPick2 +
          promotionInfo.guaranteedItemTokenIds.length
      );
      amounts = new uint[](
        promotionInfo.numRandomStreakBonusItemsToPick1 +
          promotionInfo.numRandomStreakBonusItemsToPick2 +
          promotionInfo.guaranteedItemTokenIds.length
      );
      dayToSet = FINAL_PROMOTION_DAY_INDEX;

      // Mint the final day bonus
      // Pick a random item from the list, only supports 1 item atm
      uint numAvailableItems = promotionInfo.numRandomStreakBonusItemsToPick1;

      uint endTime = promotionInfo.startTime + promotionInfo.numDays * 1 days;
      uint oracleTime = (endTime / 1 days) * 1 days - 1;
      if (!world.hasRandomWord(oracleTime)) {
        return (itemTokenIds, amounts, dayToSet, PromotionMintStatus.ORACLE_NOT_CALLED);
      }

      // The streak bonus random reward should be based on the last day of the promotion
      uint randomWord = itemNFT.world().getRandomWord(oracleTime);
      uint modifiedRandomWord = uint(keccak256(abi.encodePacked(randomWord, _playerId)));
      uint index = modifiedRandomWord % numAvailableItems;
      itemTokenIds[0] = promotionInfo.randomStreakBonusItemTokenIds1[index];
      amounts[0] = promotionInfo.randomStreakBonusAmounts1[index];
    } else {
      return (itemTokenIds, amounts, dayToSet, PromotionMintStatus.MINTING_OUTSIDE_AVAILABLE_DATE);
    }
  }

  function _pay(uint _brushCost) private {
    // Pay
    IBrushToken brush = playerNFT.brush();
    // Send half to the pool
    if (!brush.transferFrom(msg.sender, playerNFT.pool(), _brushCost / 2)) {
      revert NotEnoughBrush();
    }
    // Send half to the dev address
    if (!brush.transferFrom(msg.sender, playerNFT.dev(), _brushCost / 2)) {
      revert NotEnoughBrush();
    }
  }

  // Takes into account the current day for multiday promotions unless outside the range in which case checks the final day bonus.
  function hasCompletedPromotion(uint _playerId, Promotion _promotion) external view returns (bool) {
    PromotionInfo memory promotionInfo = activePromotions[_promotion];
    if (promotionInfo.isMultiday) {
      if (block.timestamp < promotionInfo.startTime) {
        return false;
      }

      uint today = (block.timestamp - promotionInfo.startTime) / 1 days;
      if (today <= promotionInfo.numDays) {
        return multidayPlayerPromotionsCompleted[_playerId][_promotion][today] > 0;
      }

      return multidayPlayerPromotionsCompleted[_playerId][_promotion][FINAL_PROMOTION_DAY_INDEX] > 0;
    }
    return singlePlayerPromotionsCompleted[_playerId].get(uint(_promotion));
  }

  function testClearPromotionalPack(address _toClear) external isAdminAndBeta {
    delete users[_toClear];
  }

  function testClearPlayerPromotion(uint _playerId, Promotion _promotion) external isAdminAndBeta {
    singlePlayerPromotionsCompleted[_playerId].unset(uint(_promotion));
    delete multidayPlayerPromotionsCompleted[_playerId][_promotion];
    emit ClearPlayerPromotion(_playerId, _promotion);
  }

  function addPromotion(PromotionInfoInput calldata _promotionInfoInput) external onlyOwner {
    PromotionsLibrary.addPromotion(activePromotions, _promotionInfoInput);
    emit AddPromotion(_promotionInfoInput);
  }

  function editPromotion(PromotionInfoInput calldata _promotionInfoInput) external onlyOwner {
    PromotionsLibrary.editPromotion(activePromotions, _promotionInfoInput);
    emit EditPromotion(_promotionInfoInput);
  }

  function hasClaimedAny(uint _playerId, Promotion _promotion) public view returns (bool) {
    PromotionInfo storage promotionInfo = activePromotions[_promotion];
    if (promotionInfo.isMultiday) {
      bool anyClaimed;
      uint8[32] storage daysCompleted = multidayPlayerPromotionsCompleted[_playerId][_promotion];
      assembly ("memory-safe") {
        // Anything set in the word would mean at least 1 is claimed
        anyClaimed := iszero(iszero(sload(daysCompleted.slot)))
      }
      return anyClaimed;
    }
    return singlePlayerPromotionsCompleted[_playerId].get(uint(_promotion));
  }

  function removePromotion(Promotion _promotion) external onlyOwner {
    if (activePromotions[_promotion].promotion == Promotion.NONE) {
      revert PromotionNotAdded();
    }
    delete activePromotions[_promotion];
    emit RemovePromotion(_promotion);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
