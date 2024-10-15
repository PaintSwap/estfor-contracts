// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

enum Promotion {
  NONE,
  STARTER,
  HALLOWEEN_2023,
  XMAS_2023,
  HOLIDAY3, // Just have placeholders for now
  HOLIDAY4,
  HOLIDAY5,
  HOLIDAY6,
  HOLIDAY7,
  HOLIDAY8,
  HOLIDAY9,
  HOLIDAY10
}

enum PromotionMintStatus {
  NONE,
  SUCCESS,
  PROMOTION_ALREADY_CLAIMED,
  ORACLE_NOT_CALLED,
  MINTING_OUTSIDE_AVAILABLE_DATE,
  PLAYER_DOES_NOT_QUALIFY,
  PLAYER_NOT_HIT_ENOUGH_CLAIMS_FOR_STREAK_BONUS
}

struct PromotionInfoInput {
  Promotion promotion;
  uint40 startTime;
  uint40 endTime; // Exclusive
  uint8 numDailyRandomItemsToPick; // Number of items to pick
  uint40 minTotalXP; // Minimum xp required to claim
  uint brushCost; // Cost in brush to start the promotion, max 16mil
  // Special promotion specific (like 1kin)
  uint8 redeemCodeLength; // Length of the redeem code
  bool adminOnly; // Only admins can mint the promotion, like for 1kin (Not used yet)
  bool promotionTiedToUser; // If the promotion is tied to a user
  bool promotionTiedToPlayer; // If the promotion is tied to the player
  bool promotionMustOwnPlayer; // Must own the player to get the promotion
  // Evolution specific
  bool evolvedHeroOnly; // Only allow evolved heroes to claim
  // Multiday specific
  bool isMultiday; // The promotion is multi-day
  uint brushCostMissedDay; // Cost in brush to mint the promotion if they miss a day (in ether), max 25.6 (base 100)
  uint8 numDaysHitNeededForStreakBonus; // How many days to hit for the streak bonus
  uint8 numDaysClaimablePeriodStreakBonus; // If there is a streak bonus, how many days to claim it after the promotion ends. If no final day bonus, set to 0
  uint8 numRandomStreakBonusItemsToPick1; // Number of items to pick for the streak bonus
  uint8 numRandomStreakBonusItemsToPick2; // Number of random items to pick for the streak bonus
  uint16[] randomStreakBonusItemTokenIds1;
  uint32[] randomStreakBonusAmounts1;
  uint16[] randomStreakBonusItemTokenIds2;
  uint32[] randomStreakBonusAmounts2;
  uint16[] guaranteedStreakBonusItemTokenIds;
  uint16[] guaranteedStreakBonusAmounts;
  // Single and multiday
  uint16[] guaranteedItemTokenIds; // Guaranteed items for the promotions each day, if empty then they are handled in a specific way for the promotion like daily rewards
  uint32[] guaranteedAmounts; // Corresponding amounts to the itemTokenIds
  uint16[] randomItemTokenIds; // Possible items for the promotions each day, if empty then they are handled in a specific way for the promotion like daily rewards
  uint32[] randomAmounts; // Corresponding amounts to the randomItemTokenIds
}

struct PromotionInfo {
  Promotion promotion;
  uint40 startTime;
  uint8 numDays;
  uint8 numDailyRandomItemsToPick; // Number of items to pick
  uint40 minTotalXP; // Minimum xp required to claim
  uint24 brushCost; // Cost in brush to mint the promotion (in ether), max 16mil
  // Special promotion specific (like 1kin), could pack these these later
  uint8 redeemCodeLength; // Length of the redeem code
  bool adminOnly; // Only admins can mint the promotion, like for 1kin
  bool promotionTiedToUser; // If the promotion is tied to a user
  bool promotionTiedToPlayer; // If the promotion is tied to the player
  bool promotionMustOwnPlayer; // Must own the player to get the promotion
  // Evolution specific
  bool evolvedHeroOnly; // Only allow evolved heroes to claim
  // Multiday specific
  bool isMultiday; // The promotion is multi-day
  uint8 brushCostMissedDay; // Cost in brush to mint the promotion if they miss a day (in ether), max 25.5, base 100
  uint8 numDaysHitNeededForStreakBonus; // How many days to hit for the streak bonus
  uint8 numDaysClaimablePeriodStreakBonus; // If there is a streak bonus, how many days to claim it after the promotion ends. If no final day bonus, set to 0
  uint8 numRandomStreakBonusItemsToPick1; // Number of items to pick for the streak bonus
  uint8 numRandomStreakBonusItemsToPick2; // Number of random items to pick for the streak bonus
  uint16[] randomStreakBonusItemTokenIds1;
  uint32[] randomStreakBonusAmounts1;
  uint16[] randomStreakBonusItemTokenIds2; // Not used yet
  uint32[] randomStreakBonusAmounts2; // Not used yet
  uint16[] guaranteedStreakBonusItemTokenIds; // Not used yet
  uint16[] guaranteedStreakBonusAmounts; // Not used yet
  // Single and multiday
  uint16[] guaranteedItemTokenIds; // Guaranteed items for the promotions each day, if empty then they are handled in a specific way for the promotion like daily rewards
  uint32[] guaranteedAmounts; // Corresponding amounts to the itemTokenIds
  uint16[] randomItemTokenIds; // Possible items for the promotions each day, if empty then they are handled in a specific way for the promotion like daily rewards
  uint32[] randomAmounts; // Corresponding amounts to the randomItemTokenIds
}

uint constant BRUSH_COST_MISSED_DAY_MUL = 10;
