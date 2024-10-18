// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// solhint-disable-next-line no-global-import
import "./globals/promotions.sol";

// This file contains methods for interacting with the item NFT, used to decrease implementation deployment bytecode code.
library PromotionsLibrary {
  error PromotionAlreadyAdded();
  error LengthMismatch();
  error PromotionNotSet();
  error StartTimeMustBeHigherEndTime();
  error NoNumItemsToPick();
  error InvalidPromotion();
  error InvalidBrushCost();
  error InvalidMultidayPromotionTimeInterval();
  error InvalidStreakBonus();
  error InvalidNumDaysHitNeededForStreakBonus();
  error PickingTooManyItems();
  error MultidaySpecified();
  error NoItemsToPickFrom();

  function addPromotion(
    mapping(Promotion promotion => PromotionInfo) storage activePromotions,
    PromotionInfoInput calldata promotionInfoInput
  ) external {
    _checkAddingGenericPromotion(promotionInfoInput);
    if (activePromotions[promotionInfoInput.promotion].promotion != Promotion.NONE) {
      revert PromotionAlreadyAdded();
    }

    if (promotionInfoInput.isMultiday) {
      _checkAddingMultidayMintPromotion(promotionInfoInput);
    } else {
      _checkAddingSinglePromotion(promotionInfoInput);
    }

    activePromotions[promotionInfoInput.promotion] = _packPromotionInfo(promotionInfoInput);
  }

  function editPromotion(
    mapping(Promotion promotion => PromotionInfo) storage activePromotions,
    PromotionInfoInput calldata promotionInfoInput
  ) external {
    _checkAddingGenericPromotion(promotionInfoInput);

    if (promotionInfoInput.isMultiday) {
      _checkAddingMultidayMintPromotion(promotionInfoInput);
    } else {
      _checkAddingSinglePromotion(promotionInfoInput);
    }

    activePromotions[promotionInfoInput.promotion] = _packPromotionInfo(promotionInfoInput);
  }

  function _checkAddingGenericPromotion(PromotionInfoInput calldata promotionInfoInput) private pure {
    require(promotionInfoInput.randomItemTokenIds.length == promotionInfoInput.randomAmounts.length, LengthMismatch());
    require(promotionInfoInput.promotion != Promotion.NONE, PromotionNotSet());
    require(promotionInfoInput.startTime < promotionInfoInput.endTime, StartTimeMustBeHigherEndTime());
    require(promotionInfoInput.numDailyRandomItemsToPick != 0, NoNumItemsToPick());
    // TODO: Special handling for now, only allowing 1 item to be picked
    require(promotionInfoInput.numDailyRandomItemsToPick == 1, InvalidPromotion());
    // Check brush input is valid
    require(promotionInfoInput.brushCost % 1 ether == 0, InvalidBrushCost());
    // start and endTime must be factors of 24 hours apart
    require(
      (promotionInfoInput.endTime - promotionInfoInput.startTime) % 1 days == 0,
      InvalidMultidayPromotionTimeInterval()
    );
  }

  // Precondition that the promotion is multiday
  function _checkAddingMultidayMintPromotion(PromotionInfoInput calldata promotionInfoInput) private pure {
    bool hasStreakBonus = promotionInfoInput.numDaysClaimablePeriodStreakBonus != 0;

    if (hasStreakBonus) {
      require(
        promotionInfoInput.numRandomStreakBonusItemsToPick1 != 0 &&
          promotionInfoInput.randomStreakBonusItemTokenIds1.length != 0 &&
          promotionInfoInput.numDaysHitNeededForStreakBonus != 0,
        InvalidStreakBonus()
      );
      // Cannot specify pool2 without pool 1
      require(
        promotionInfoInput.numRandomStreakBonusItemsToPick1 != 0 ||
          promotionInfoInput.numRandomStreakBonusItemsToPick2 == 0,
        InvalidStreakBonus()
      );
      require(
        promotionInfoInput.numDaysHitNeededForStreakBonus <=
          ((promotionInfoInput.endTime - promotionInfoInput.startTime) / 1 days),
        InvalidNumDaysHitNeededForStreakBonus()
      );
      require(
        promotionInfoInput.randomStreakBonusItemTokenIds1.length == promotionInfoInput.randomStreakBonusAmounts1.length,
        LengthMismatch()
      );
      require(
        promotionInfoInput.randomStreakBonusItemTokenIds2.length == promotionInfoInput.randomStreakBonusAmounts2.length,
        LengthMismatch()
      );
      require(
        promotionInfoInput.guaranteedStreakBonusItemTokenIds.length ==
          promotionInfoInput.guaranteedStreakBonusAmounts.length,
        LengthMismatch()
      );
    } else {
      // No streak bonus
      require(
        promotionInfoInput.randomStreakBonusItemTokenIds1.length == 0 &&
          promotionInfoInput.randomStreakBonusItemTokenIds2.length == 0 &&
          promotionInfoInput.numRandomStreakBonusItemsToPick1 == 0 &&
          promotionInfoInput.numRandomStreakBonusItemsToPick2 == 0 &&
          promotionInfoInput.numDaysHitNeededForStreakBonus == 0 &&
          promotionInfoInput.guaranteedStreakBonusItemTokenIds.length == 0 &&
          promotionInfoInput.guaranteedStreakBonusAmounts.length == 0,
        InvalidStreakBonus()
      );
    }

    if (
      promotionInfoInput.numRandomStreakBonusItemsToPick1 > promotionInfoInput.randomStreakBonusItemTokenIds1.length
    ) {
      revert PickingTooManyItems();
    }
    if (
      promotionInfoInput.numRandomStreakBonusItemsToPick2 > promotionInfoInput.randomStreakBonusItemTokenIds2.length
    ) {
      revert PickingTooManyItems();
    }

    // Check brush input is valid
    if (promotionInfoInput.brushCostMissedDay % 1 ether != 0 || promotionInfoInput.brushCostMissedDay > 25 ether) {
      revert InvalidBrushCost();
    }
  }

  function _checkAddingSinglePromotion(PromotionInfoInput calldata promotionInfoInput) private pure {
    // Should not have any multi-day promotion specific fields set
    if (
      promotionInfoInput.numDaysHitNeededForStreakBonus != 0 ||
      promotionInfoInput.numDaysClaimablePeriodStreakBonus != 0 ||
      promotionInfoInput.numRandomStreakBonusItemsToPick1 != 0 ||
      promotionInfoInput.randomStreakBonusItemTokenIds1.length != 0 ||
      promotionInfoInput.randomStreakBonusAmounts1.length != 0 ||
      promotionInfoInput.numRandomStreakBonusItemsToPick2 != 0 ||
      promotionInfoInput.randomStreakBonusItemTokenIds2.length != 0 ||
      promotionInfoInput.randomStreakBonusAmounts2.length != 0
    ) {
      revert MultidaySpecified();
    }

    if (promotionInfoInput.randomItemTokenIds.length == 0) {
      revert NoItemsToPickFrom();
    }

    if (promotionInfoInput.numDailyRandomItemsToPick > promotionInfoInput.randomItemTokenIds.length) {
      revert PickingTooManyItems();
    }
  }

  function _packPromotionInfo(
    PromotionInfoInput calldata promotionInfoInput
  ) private pure returns (PromotionInfo memory) {
    return
      PromotionInfo({
        promotion: promotionInfoInput.promotion,
        startTime: promotionInfoInput.startTime,
        numDays: uint8((promotionInfoInput.endTime - promotionInfoInput.startTime) / 1 days),
        numDailyRandomItemsToPick: promotionInfoInput.numDailyRandomItemsToPick,
        minTotalXP: promotionInfoInput.minTotalXP,
        evolvedHeroOnly: promotionInfoInput.evolvedHeroOnly,
        brushCost: uint24(promotionInfoInput.brushCost / 1 ether),
        redeemCodeLength: promotionInfoInput.redeemCodeLength,
        adminOnly: promotionInfoInput.adminOnly,
        promotionTiedToUser: promotionInfoInput.promotionTiedToUser,
        promotionTiedToPlayer: promotionInfoInput.promotionTiedToPlayer,
        promotionMustOwnPlayer: promotionInfoInput.promotionMustOwnPlayer,
        isMultiday: promotionInfoInput.isMultiday,
        brushCostMissedDay: uint8((promotionInfoInput.brushCostMissedDay * BRUSH_COST_MISSED_DAY_MUL) / 1 ether),
        numDaysHitNeededForStreakBonus: promotionInfoInput.numDaysHitNeededForStreakBonus,
        numDaysClaimablePeriodStreakBonus: promotionInfoInput.numDaysClaimablePeriodStreakBonus,
        numRandomStreakBonusItemsToPick1: promotionInfoInput.numRandomStreakBonusItemsToPick1,
        randomStreakBonusItemTokenIds1: promotionInfoInput.randomStreakBonusItemTokenIds1,
        randomStreakBonusAmounts1: promotionInfoInput.randomStreakBonusAmounts1,
        numRandomStreakBonusItemsToPick2: promotionInfoInput.numRandomStreakBonusItemsToPick2,
        randomStreakBonusItemTokenIds2: promotionInfoInput.randomStreakBonusItemTokenIds2,
        randomStreakBonusAmounts2: promotionInfoInput.randomStreakBonusAmounts2,
        guaranteedStreakBonusItemTokenIds: promotionInfoInput.guaranteedStreakBonusItemTokenIds,
        guaranteedStreakBonusAmounts: promotionInfoInput.guaranteedStreakBonusAmounts,
        guaranteedItemTokenIds: promotionInfoInput.guaranteedItemTokenIds,
        guaranteedAmounts: promotionInfoInput.guaranteedAmounts,
        randomItemTokenIds: promotionInfoInput.randomItemTokenIds,
        randomAmounts: promotionInfoInput.randomAmounts
      });
  }
}
