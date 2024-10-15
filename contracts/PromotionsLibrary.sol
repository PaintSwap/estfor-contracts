// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

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
    mapping(Promotion promotion => PromotionInfo) storage _activePromotions,
    PromotionInfoInput calldata _promotionInfoInput
  ) external {
    _checkAddingGenericPromotion(_promotionInfoInput);
    if (_activePromotions[_promotionInfoInput.promotion].promotion != Promotion.NONE) {
      revert PromotionAlreadyAdded();
    }

    if (_promotionInfoInput.isMultiday) {
      _checkAddingMultidayMintPromotion(_promotionInfoInput);
    } else {
      _checkAddingSinglePromotion(_promotionInfoInput);
    }

    _activePromotions[_promotionInfoInput.promotion] = _packPromotionInfo(_promotionInfoInput);
  }

  function editPromotion(
    mapping(Promotion promotion => PromotionInfo) storage _activePromotions,
    PromotionInfoInput calldata _promotionInfoInput
  ) external {
    _checkAddingGenericPromotion(_promotionInfoInput);

    if (_promotionInfoInput.isMultiday) {
      _checkAddingMultidayMintPromotion(_promotionInfoInput);
    } else {
      _checkAddingSinglePromotion(_promotionInfoInput);
    }

    _activePromotions[_promotionInfoInput.promotion] = _packPromotionInfo(_promotionInfoInput);
  }

  function _checkAddingGenericPromotion(PromotionInfoInput calldata _promotionInfoInput) private pure {
    if (_promotionInfoInput.guaranteedItemTokenIds.length != _promotionInfoInput.guaranteedAmounts.length) {
      revert LengthMismatch();
    }

    if (_promotionInfoInput.promotion == Promotion.NONE) {
      revert PromotionNotSet();
    }

    if (_promotionInfoInput.startTime > _promotionInfoInput.endTime) {
      revert StartTimeMustBeHigherEndTime();
    }

    if (_promotionInfoInput.numDailyRandomItemsToPick == 0) {
      revert NoNumItemsToPick();
    }

    if (_promotionInfoInput.numDailyRandomItemsToPick != 1) {
      // TODO: Special handling for now, only allowing 1 item to be picked
      revert InvalidPromotion();
    }

    // Check brush input is valid
    if (_promotionInfoInput.brushCost % 1 ether != 0) {
      revert InvalidBrushCost();
    }

    // start and endTime must be factors of 24 hours apart
    if ((_promotionInfoInput.endTime - _promotionInfoInput.startTime) % 1 days != 0) {
      revert InvalidMultidayPromotionTimeInterval();
    }
  }

  // Precondition that the promotion is multiday
  function _checkAddingMultidayMintPromotion(PromotionInfoInput calldata _promotionInfoInput) private pure {
    bool hasStreakBonus = _promotionInfoInput.numDaysClaimablePeriodStreakBonus != 0;

    if (hasStreakBonus) {
      if (
        _promotionInfoInput.numRandomStreakBonusItemsToPick1 == 0 ||
        _promotionInfoInput.randomStreakBonusItemTokenIds1.length == 0 ||
        _promotionInfoInput.numDaysHitNeededForStreakBonus == 0
      ) {
        revert InvalidStreakBonus();
      }

      // Cannot specify pool2 without pool 1
      if (
        _promotionInfoInput.numRandomStreakBonusItemsToPick1 == 0 &&
        _promotionInfoInput.numRandomStreakBonusItemsToPick2 != 0
      ) {
        revert InvalidStreakBonus();
      }

      if (
        _promotionInfoInput.numDaysHitNeededForStreakBonus >
        ((_promotionInfoInput.endTime - _promotionInfoInput.startTime) / 1 days)
      ) {
        revert InvalidNumDaysHitNeededForStreakBonus();
      }

      if (
        _promotionInfoInput.randomStreakBonusItemTokenIds1.length !=
        _promotionInfoInput.randomStreakBonusAmounts1.length
      ) {
        revert LengthMismatch();
      }

      if (
        _promotionInfoInput.randomStreakBonusItemTokenIds2.length !=
        _promotionInfoInput.randomStreakBonusAmounts2.length
      ) {
        revert LengthMismatch();
      }

      if (
        _promotionInfoInput.guaranteedStreakBonusItemTokenIds.length !=
        _promotionInfoInput.guaranteedStreakBonusAmounts.length
      ) {
        revert LengthMismatch();
      }
    } else {
      // No streak bonus
      if (
        _promotionInfoInput.randomStreakBonusItemTokenIds1.length != 0 ||
        _promotionInfoInput.randomStreakBonusItemTokenIds2.length != 0 ||
        _promotionInfoInput.numRandomStreakBonusItemsToPick1 != 0 ||
        _promotionInfoInput.numRandomStreakBonusItemsToPick2 != 0 ||
        _promotionInfoInput.numDaysHitNeededForStreakBonus != 0 ||
        _promotionInfoInput.guaranteedStreakBonusItemTokenIds.length != 0 ||
        _promotionInfoInput.guaranteedStreakBonusAmounts.length != 0
      ) {
        revert InvalidStreakBonus();
      }
    }

    if (
      _promotionInfoInput.numRandomStreakBonusItemsToPick1 > _promotionInfoInput.randomStreakBonusItemTokenIds1.length
    ) {
      revert PickingTooManyItems();
    }
    if (
      _promotionInfoInput.numRandomStreakBonusItemsToPick2 > _promotionInfoInput.randomStreakBonusItemTokenIds2.length
    ) {
      revert PickingTooManyItems();
    }

    // Check brush input is valid
    if (_promotionInfoInput.brushCostMissedDay % 1 ether != 0 || _promotionInfoInput.brushCostMissedDay > 25 ether) {
      revert InvalidBrushCost();
    }
  }

  function _checkAddingSinglePromotion(PromotionInfoInput calldata _promotionInfoInput) private pure {
    // Should not have any multi-day promotion specific fields set
    if (
      _promotionInfoInput.numDaysHitNeededForStreakBonus != 0 ||
      _promotionInfoInput.numDaysClaimablePeriodStreakBonus != 0 ||
      _promotionInfoInput.numRandomStreakBonusItemsToPick1 != 0 ||
      _promotionInfoInput.randomStreakBonusItemTokenIds1.length != 0 ||
      _promotionInfoInput.randomStreakBonusAmounts1.length != 0 ||
      _promotionInfoInput.numRandomStreakBonusItemsToPick2 != 0 ||
      _promotionInfoInput.randomStreakBonusItemTokenIds2.length != 0 ||
      _promotionInfoInput.randomStreakBonusAmounts2.length != 0
    ) {
      revert MultidaySpecified();
    }

    if (_promotionInfoInput.randomItemTokenIds.length == 0) {
      revert NoItemsToPickFrom();
    }

    if (_promotionInfoInput.numDailyRandomItemsToPick > _promotionInfoInput.randomItemTokenIds.length) {
      revert PickingTooManyItems();
    }
  }

  function _packPromotionInfo(
    PromotionInfoInput calldata _promotionInfoInput
  ) private pure returns (PromotionInfo memory) {
    return
      PromotionInfo({
        promotion: _promotionInfoInput.promotion,
        startTime: _promotionInfoInput.startTime,
        numDays: uint8((_promotionInfoInput.endTime - _promotionInfoInput.startTime) / 1 days),
        numDailyRandomItemsToPick: _promotionInfoInput.numDailyRandomItemsToPick,
        minTotalXP: _promotionInfoInput.minTotalXP,
        evolvedHeroOnly: _promotionInfoInput.evolvedHeroOnly,
        brushCost: uint24(_promotionInfoInput.brushCost / 1 ether),
        redeemCodeLength: _promotionInfoInput.redeemCodeLength,
        adminOnly: _promotionInfoInput.adminOnly,
        promotionTiedToUser: _promotionInfoInput.promotionTiedToUser,
        promotionTiedToPlayer: _promotionInfoInput.promotionTiedToPlayer,
        promotionMustOwnPlayer: _promotionInfoInput.promotionMustOwnPlayer,
        isMultiday: _promotionInfoInput.isMultiday,
        brushCostMissedDay: uint8((_promotionInfoInput.brushCostMissedDay * BRUSH_COST_MISSED_DAY_MUL) / 1 ether),
        numDaysHitNeededForStreakBonus: _promotionInfoInput.numDaysHitNeededForStreakBonus,
        numDaysClaimablePeriodStreakBonus: _promotionInfoInput.numDaysClaimablePeriodStreakBonus,
        numRandomStreakBonusItemsToPick1: _promotionInfoInput.numRandomStreakBonusItemsToPick1,
        randomStreakBonusItemTokenIds1: _promotionInfoInput.randomStreakBonusItemTokenIds1,
        randomStreakBonusAmounts1: _promotionInfoInput.randomStreakBonusAmounts1,
        numRandomStreakBonusItemsToPick2: _promotionInfoInput.numRandomStreakBonusItemsToPick2,
        randomStreakBonusItemTokenIds2: _promotionInfoInput.randomStreakBonusItemTokenIds2,
        randomStreakBonusAmounts2: _promotionInfoInput.randomStreakBonusAmounts2,
        guaranteedStreakBonusItemTokenIds: _promotionInfoInput.guaranteedStreakBonusItemTokenIds,
        guaranteedStreakBonusAmounts: _promotionInfoInput.guaranteedStreakBonusAmounts,
        guaranteedItemTokenIds: _promotionInfoInput.guaranteedItemTokenIds,
        guaranteedAmounts: _promotionInfoInput.guaranteedAmounts,
        randomItemTokenIds: _promotionInfoInput.randomItemTokenIds,
        randomAmounts: _promotionInfoInput.randomAmounts
      });
  }
}
