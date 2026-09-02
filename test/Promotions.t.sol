// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IOwnable} from "../contracts/interfaces/IOwnable.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

import {FullGameStack} from "./utils/FullGameStack.sol";
import {IPromotions} from "../contracts/interfaces/IPromotions.sol";
import {PromotionsLibrary} from "../contracts/PromotionsLibrary.sol";
import {IQuests} from "../contracts/interfaces/IQuests.sol";
import {Promotion, PromotionInfoInput, PromotionMintStatus} from "../contracts/globals/promotions.sol";
import {Equipment, Skill} from "../contracts/globals/misc.sol";
import {QuestInput, QUEST_PURSE_STRINGS} from "../contracts/globals/quests.sol";
import {XP_BOOST, SKILL_BOOST, COOKED_FEOLA, SHADOW_SCROLL, SECRET_EGG_2_TIER1} from "../contracts/globals/items.sol";
import {TIER_2_DAILY_REWARD_START_XP, TIER_3_DAILY_REWARD_START_XP, TIER_4_DAILY_REWARD_START_XP, TIER_5_DAILY_REWARD_START_XP, TIER_6_DAILY_REWARD_START_XP} from "../contracts/globals/rewards.sol";

contract PromotionTest is FullGameStack {
  uint16 private constant BRONZE_ARROW = 11776;
  uint16 private constant IRON_ARROW = BRONZE_ARROW + 1;
  uint16 private constant MITHRIL_ARROW = BRONZE_ARROW + 2;
  uint16 private constant ADAMANTINE_ARROW = BRONZE_ARROW + 3;
  uint16 private constant RUNITE_ARROW = BRONZE_ARROW + 4;
  uint16 private constant ORICHALCUM_ARROW = BRONZE_ARROW + 6;
  uint16 private constant SECRET_EGG_3_TIER1 = 12546;
  uint16 private constant SECRET_EGG_4_TIER1 = 12547;
  uint16 private constant HALLOWEEN_BONUS_1 = 13312;
  uint16 private constant HALLOWEEN_BONUS_2 = 13313;
  uint16 private constant HALLOWEEN_BONUS_3 = 13314;
  uint16 private constant COIN = 65480;

  function setUp() public {
    deployFullGame();
    for (uint256 tier = 1; tier <= 6; ++tier) {
      _setDailyRewardPool(tier, _equipment(COIN, 10));
    }
  }

  function testOnlyPromotionalAdminCanMintStarterPack() public {
    vm.prank(BOB);
    vm.expectRevert(IPromotions.NotPromotionalAdmin.selector);
    promotions.mintStarterPromotionalPack(ALICE, playerId, "1111111111111111");
  }

  function testStarterPackRejectsInvalidRedeemCode() public {
    vm.expectRevert(IPromotions.InvalidRedeemCode.selector);
    promotions.mintStarterPromotionalPack(ALICE, playerId, "11231");
  }

  function testStarterPackRequiresPlayerOwnership() public {
    vm.expectRevert(IPromotions.NotOwnerOfPlayer.selector);
    promotions.mintStarterPromotionalPack(address(this), playerId, "1111111111111111");
  }

  function testStarterPackMintsItemsAndCannotBeClaimedTwice() public {
    promotions.mintStarterPromotionalPack(ALICE, playerId, "1111111111111111");

    vm.expectRevert(IPromotions.PromotionAlreadyClaimed.selector);
    promotions.mintStarterPromotionalPack(ALICE, playerId, "1111111111111111");

    assertEq(itemNFT.balanceOf(ALICE, XP_BOOST), 5);
    assertEq(itemNFT.balanceOf(ALICE, SKILL_BOOST), 3);
    assertEq(itemNFT.balanceOf(ALICE, COOKED_FEOLA), 200);
    assertEq(itemNFT.balanceOf(ALICE, SHADOW_SCROLL), 300);
    assertEq(itemNFT.balanceOf(ALICE, SECRET_EGG_2_TIER1), 1);
  }

  function testOwnerCanEditPromotion() public {
    PromotionInfoInput memory promotion = _basicSinglePromotion();
    _addPromotion(promotion);
    promotion.startTime = uint40(block.timestamp - 1 days);

    vm.prank(ALICE);
    vm.expectRevert(abi.encodeWithSelector(IOwnable.OwnableUnauthorizedAccount.selector, ALICE));
    promotions.editPromotions(_promotions(promotion));

    vm.expectEmit(false, false, false, false, address(promotions));
    emit IPromotions.EditPromotions(_promotions(promotion));
    promotions.editPromotions(_promotions(promotion));
    assertEq(promotions.getActivePromotion(uint256(Promotion.HALLOWEEN_2023)).startTime, promotion.startTime);
  }

  function testOwnerCanRemovePromotion() public {
    PromotionInfoInput memory promotion = _basicSinglePromotion();
    _addPromotion(promotion);

    vm.prank(ALICE);
    vm.expectRevert(abi.encodeWithSelector(IOwnable.OwnableUnauthorizedAccount.selector, ALICE));
    promotions.removePromotions(_promotionIds(Promotion.HALLOWEEN_2023));

    promotions.removePromotions(_promotionIds(Promotion.HALLOWEEN_2023));
    assertEq(promotions.getActivePromotion(uint256(Promotion.HALLOWEEN_2023)).startTime, 0);
  }

  function testEvolvedHeroOnlyPromotion() public {
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _basicSinglePromotion();
    promotion.evolvedHeroOnly = true;
    _addPromotion(promotion);

    vm.prank(ALICE);
    vm.expectRevert(IPromotions.PlayerNotEvolved.selector);
    promotions.mintPromotion(playerId, Promotion.HALLOWEEN_2023);

    brush.mint(ALICE, 1 ether);
    vm.startPrank(ALICE);
    brush.approve(address(playerNFT), 1 ether);
    playerNFT.editPlayer(playerId, ORIG_NAME, "", "", "", true);
    promotions.mintPromotion(playerId, Promotion.HALLOWEEN_2023);
    vm.stopPrank();
  }

  function testMintPromotionViewReportsOutsideAvailableDate() public view {
    (, , , PromotionMintStatus status) = promotions.mintPromotionViewNow(playerId, Promotion.HALLOWEEN_2023);
    assertEq(uint256(status), uint256(PromotionMintStatus.MINTING_OUTSIDE_AVAILABLE_DATE));
  }

  function testPromotionStartingAtMidnightUsesPreviousDaysOracle() public {
    _requestAndFulfillRandomWords();
    uint256 nextMidnight = (block.timestamp / 1 days + 1) * 1 days;
    vm.warp(nextMidnight);
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _basicSinglePromotion();
    promotion.startTime = uint40(nextMidnight);
    promotion.endTime = uint40(nextMidnight + 1 days);
    _addPromotion(promotion);

    vm.prank(ALICE);
    promotions.mintPromotion(playerId, Promotion.HALLOWEEN_2023);
  }

  function testPromotionQuestRequirementMustBeCompleted() public {
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _basicSinglePromotion();
    promotion.questPrerequisiteId = uint16(QUEST_PURSE_STRINGS);
    _addPromotion(promotion);

    vm.prank(ALICE);
    vm.expectRevert(IPromotions.DependentQuestNotCompleted.selector);
    promotions.mintPromotion(playerId, Promotion.HALLOWEEN_2023);

    _completePurseStringsQuest();
    vm.prank(ALICE);
    promotions.mintPromotion(playerId, Promotion.HALLOWEEN_2023);
  }

  function testCannotMintNonexistentPromotion() public {
    _requestAndFulfillRandomWords();
    vm.prank(ALICE);
    vm.expectRevert(IPromotions.MintingOutsideAvailableDate.selector);
    promotions.mintPromotion(playerId, Promotion.HALLOWEEN_2023);
  }

  function testGenericPromotionRequiresActivePlayerOwnership() public {
    _requestAndFulfillRandomWords();
    _addPromotion(_basicSinglePromotion());
    vm.expectRevert(IPromotions.NotOwnerOfPlayerAndActive.selector);
    promotions.mintPromotion(playerId, Promotion.HALLOWEEN_2023);
  }

  function testSinglePromotionMintsOneRandomItem() public {
    _requestAndFulfillRandomWords();
    _addPromotion(_basicSinglePromotion());
    vm.prank(ALICE);
    promotions.mintPromotion(playerId, Promotion.HALLOWEEN_2023);

    uint256 total = itemNFT.balanceOf(ALICE, HALLOWEEN_BONUS_1) +
      itemNFT.balanceOf(ALICE, HALLOWEEN_BONUS_2) +
      itemNFT.balanceOf(ALICE, HALLOWEEN_BONUS_3);
    assertEq(total, 1);
  }

  function testSinglePromotionRandomnessCanSelectEveryItem() public {
    _requestAndFulfillRandomWords();
    _addPromotion(_basicSinglePromotion());
    for (uint256 i; i < 25; ++i) {
      uint256 id = _createPlayer(ALICE, 1, string.concat("name", vm.toString(i)), true);
      vm.prank(ALICE);
      promotions.mintPromotion(id, Promotion.HALLOWEEN_2023);
    }
    assertGt(itemNFT.totalSupply(HALLOWEEN_BONUS_1), 0);
    assertGt(itemNFT.totalSupply(HALLOWEEN_BONUS_2), 0);
    assertGt(itemNFT.totalSupply(HALLOWEEN_BONUS_3), 0);
  }

  function testSinglePromotionCannotMintBeforeStart() public {
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _basicSinglePromotion();
    promotion.startTime += 50;
    promotion.endTime += 50;
    _addPromotion(promotion);
    vm.prank(ALICE);
    vm.expectRevert(IPromotions.MintingOutsideAvailableDate.selector);
    promotions.mintPromotion(playerId, Promotion.HALLOWEEN_2023);
  }

  function testSinglePromotionCannotMintAtOrAfterEnd() public {
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _basicSinglePromotion();
    promotion.startTime = uint40(block.timestamp - 1 days);
    promotion.endTime = uint40(block.timestamp);
    _addPromotion(promotion);
    vm.prank(ALICE);
    vm.expectRevert(IPromotions.MintingOutsideAvailableDate.selector);
    promotions.mintPromotion(playerId, Promotion.HALLOWEEN_2023);
  }

  function testSinglePromotionRequiresMinimumXP() public {
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _basicSinglePromotion();
    promotion.minTotalXP = 10_000;
    _addPromotion(promotion);
    vm.prank(ALICE);
    vm.expectRevert(IPromotions.PlayerDoesNotQualify.selector);
    promotions.mintPromotion(playerId, Promotion.HALLOWEEN_2023);

    players.modifyXP(ALICE, playerId, Skill.FIREMAKING, 100_000, true);
    vm.prank(ALICE);
    promotions.mintPromotion(playerId, Promotion.HALLOWEEN_2023);
  }

  function testSinglePromotionRequiresPreviousDaysOracle() public {
    PromotionInfoInput memory promotion = _basicSinglePromotion();
    promotion.endTime += 1 days;
    vm.warp(vm.getBlockTimestamp() + 1 days);
    _addPromotion(promotion);
    vm.prank(ALICE);
    vm.expectRevert(IPromotions.OracleNotCalled.selector);
    promotions.mintPromotion(playerId, Promotion.HALLOWEEN_2023);
  }

  function testSinglePromotionCannotMintTwice() public {
    _requestAndFulfillRandomWords();
    _addPromotion(_basicSinglePromotion());
    vm.startPrank(ALICE);
    promotions.mintPromotion(playerId, Promotion.HALLOWEEN_2023);
    vm.expectRevert(IPromotions.PromotionAlreadyClaimed.selector);
    promotions.mintPromotion(playerId, Promotion.HALLOWEEN_2023);
    vm.stopPrank();
  }

  function testSinglePromotionChargesBrushAndDistributesIt() public {
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _basicSinglePromotion();
    promotion.tokenCost = 1 ether;
    _addPromotion(promotion);
    vm.prank(ALICE);
    brush.approve(address(promotions), 1 ether);

    vm.prank(ALICE);
    vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, ALICE, 0, 0.5 ether));
    promotions.mintPromotion(playerId, Promotion.HALLOWEEN_2023);

    brush.mint(ALICE, 1 ether);
    vm.prank(ALICE);
    promotions.mintPromotion(playerId, Promotion.HALLOWEEN_2023);
    assertEq(brush.balanceOf(ALICE), 0);
    assertEq(brush.balanceOf(address(treasury)), 0.5 ether);
    assertEq(brush.balanceOf(DEV), 0.25 ether);
  }

  function testSinglePromotionMintsGuaranteedItems() public {
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _basicSinglePromotion();
    promotion.guaranteedItemTokenIds = _uint16s(COIN);
    promotion.guaranteedAmounts = _uint32s(5);
    _addPromotion(promotion);
    vm.prank(ALICE);
    promotions.mintPromotion(playerId, Promotion.HALLOWEEN_2023);
    assertEq(itemNFT.balanceOf(ALICE, COIN), 5);
  }

  function testMultidayEndTimeMustBeWholeDaysFromStart() public {
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _basicMultidayPromotion();
    promotion.endTime = promotion.startTime + 1000;
    vm.expectRevert(PromotionsLibrary.InvalidMultidayPromotionTimeInterval.selector);
    _addPromotion(promotion);
  }

  function testMultidayPromotionMintsGuaranteedItemsEveryDayWithoutOracle() public {
    PromotionInfoInput memory promotion = _basicMultidayPromotion();
    promotion.endTime = uint40(block.timestamp + 3 days);
    promotion.numDailyRandomItemsToPick = 0;
    promotion.guaranteedItemTokenIds = _uint16s(COIN);
    promotion.guaranteedAmounts = _uint32s(5);
    _addPromotion(promotion);

    vm.startPrank(ALICE);
    promotions.mintPromotion(playerId, Promotion.XMAS_2023);
    vm.warp(vm.getBlockTimestamp() + 1 days);
    promotions.mintPromotion(playerId, Promotion.XMAS_2023);
    vm.warp(vm.getBlockTimestamp() + 1 days);
    promotions.mintPromotion(playerId, Promotion.XMAS_2023);
    vm.stopPrank();
    assertEq(itemNFT.balanceOf(ALICE, COIN), 15);
  }

  function testPayForOneMissedDay() public {
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _missedDaysPromotion(3);
    _addPromotion(promotion);
    _fundAndApprovePromotion(20 ether);
    vm.warp(vm.getBlockTimestamp() + 1 days);
    _requestAndFulfillRandomWords();

    (, , uint256[] memory daysToSet, ) = promotions.mintPromotionViewNow(playerId, promotion.promotion);
    assertEq(daysToSet[0], 1);
    vm.prank(ALICE);
    promotions.payMissedPromotionDays(playerId, promotion.promotion, _uints(0));
    assertEq(brush.balanceOf(ALICE), 10 ether);
  }

  function testPayForMultipleMissedDays() public {
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _missedDaysPromotion(4);
    _addPromotion(promotion);
    _fundAndApprovePromotion(20 ether);
    _advanceDaysWithOracle(3);

    (, , uint256[] memory daysToSet, ) = promotions.mintPromotionViewNow(playerId, promotion.promotion);
    assertEq(daysToSet[0], 3);
    vm.prank(ALICE);
    promotions.payMissedPromotionDays(playerId, promotion.promotion, _uints(0, 2));
    assertEq(brush.balanceOf(ALICE), 0);
    assertEq(promotions.getMultidayPlayerPromotionsCompleted(playerId, promotion.promotion, 0), 0xff);
    assertEq(promotions.getMultidayPlayerPromotionsCompleted(playerId, promotion.promotion, 1), 0);
    assertEq(promotions.getMultidayPlayerPromotionsCompleted(playerId, promotion.promotion, 2), 0xff);
  }

  function testMissedDaysUseDifferentRandomWords() public {
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _missedDaysPromotion(10);
    _addPromotion(promotion);
    _fundAndApprovePromotion(100 ether);
    _setDailyRewardPool(2, _equipment(IRON_ARROW, 10, ADAMANTINE_ARROW, 10));
    _advanceDaysWithOracle(9);

    vm.startPrank(ALICE);
    promotions.mintPromotion(playerId, promotion.promotion);
    promotions.payMissedPromotionDays(playerId, promotion.promotion, _range(8));
    vm.stopPrank();
    assertGt(itemNFT.balanceOf(ALICE, IRON_ARROW), 0);
    assertGt(itemNFT.balanceOf(ALICE, ADAMANTINE_ARROW), 0);
  }

  function testCannotPayForCurrentClaimableDay() public {
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _missedDaysPromotion(3);
    _addPromotion(promotion);
    _fundAndApprovePromotion(10 ether);
    vm.prank(ALICE);
    vm.expectRevert(IPromotions.CannotPayForToday.selector);
    promotions.payMissedPromotionDays(playerId, promotion.promotion, _uints(0));
  }

  function testMissedDaysMustBeSortedAndUnique() public {
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _missedDaysPromotion(3);
    _addPromotion(promotion);
    _fundAndApprovePromotion(20 ether);
    _advanceDaysWithOracle(2);

    vm.prank(ALICE);
    vm.expectRevert(IPromotions.DaysArrayNotSortedOrDuplicates.selector);
    promotions.payMissedPromotionDays(playerId, promotion.promotion, _uints(0, 0));
    vm.prank(ALICE);
    vm.expectRevert(IPromotions.DaysArrayNotSortedOrDuplicates.selector);
    promotions.payMissedPromotionDays(playerId, promotion.promotion, _uints(1, 0));
    vm.prank(ALICE);
    promotions.payMissedPromotionDays(playerId, promotion.promotion, _uints(0, 1));
  }

  function testCannotPayAfterPromotionDeadline() public {
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _missedDaysPromotion(1);
    _addPromotion(promotion);
    _fundAndApprovePromotion(10 ether);
    _advanceDaysWithOracle(2);
    vm.prank(ALICE);
    vm.expectRevert(IPromotions.PromotionFinished.selector);
    promotions.payMissedPromotionDays(playerId, promotion.promotion, _uints(0));
  }

  function testCannotPayForFutureDay() public {
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _missedDaysPromotion(3);
    _addPromotion(promotion);
    _fundAndApprovePromotion(10 ether);
    vm.prank(ALICE);
    vm.expectRevert(IPromotions.OracleNotCalled.selector);
    promotions.payMissedPromotionDays(playerId, promotion.promotion, _uints(1));
  }

  function testCannotPayWhenMissedDayCostIsZero() public {
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _basicMultidayPromotion();
    promotion.endTime = uint40(block.timestamp + 3 days);
    _addPromotion(promotion);
    vm.warp(vm.getBlockTimestamp() + 1 days);
    _requestAndFulfillRandomWords();
    vm.prank(ALICE);
    vm.expectRevert(IPromotions.InvalidBrushCost.selector);
    promotions.payMissedPromotionDays(playerId, promotion.promotion, _uints(0));
  }

  function testMultidayTieredRewardsFollowXP() public {
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _basicMultidayPromotion();
    promotion.endTime = uint40(block.timestamp + 7 days);
    _addPromotion(promotion);
    players.setDailyRewardsEnabled(true);
    _setDailyRewardPool(1, _equipment(BRONZE_ARROW, 10));
    _setDailyRewardPool(2, _equipment(IRON_ARROW, 10));
    _setDailyRewardPool(3, _equipment(MITHRIL_ARROW, 10));
    _setDailyRewardPool(4, _equipment(ADAMANTINE_ARROW, 10));
    _setDailyRewardPool(5, _equipment(RUNITE_ARROW, 10));
    _setDailyRewardPool(6, _equipment(ORICHALCUM_ARROW, 10));

    _advanceAndMintTierReward(0, IRON_ARROW, 10);
    _advanceAndMintTierReward(TIER_2_DAILY_REWARD_START_XP, MITHRIL_ARROW, 10);
    _advanceAndMintTierReward(TIER_3_DAILY_REWARD_START_XP, ADAMANTINE_ARROW, 10);
    _advanceAndMintTierReward(TIER_4_DAILY_REWARD_START_XP, RUNITE_ARROW, 10);
    _advanceAndMintTierReward(TIER_5_DAILY_REWARD_START_XP, RUNITE_ARROW, 20);
    _advanceAndMintTierReward(TIER_6_DAILY_REWARD_START_XP, ORICHALCUM_ARROW, 10);
  }

  function testMultidayPromotionCannotMintBeforeStart() public {
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _basicMultidayPromotion();
    promotion.startTime += 50;
    promotion.endTime = promotion.startTime + 7 days;
    _addPromotion(promotion);
    vm.prank(ALICE);
    vm.expectRevert(IPromotions.MintingOutsideAvailableDate.selector);
    promotions.mintPromotion(playerId, Promotion.XMAS_2023);
  }

  function testMultidayPromotionCannotMintAfterEndAndStreakPeriod() public {
    _requestAndFulfillRandomWords();
    _addPromotion(_basicMultidayPromotion());
    vm.warp(vm.getBlockTimestamp() + 2 days + 1);
    vm.prank(ALICE);
    vm.expectRevert(IPromotions.MintingOutsideAvailableDate.selector);
    promotions.mintPromotion(playerId, Promotion.XMAS_2023);
  }

  function testMultidayPromotionRequiresMinimumXP() public {
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _basicMultidayPromotion();
    promotion.minTotalXP = 10_000;
    _addPromotion(promotion);
    vm.prank(ALICE);
    vm.expectRevert(IPromotions.PlayerDoesNotQualify.selector);
    promotions.mintPromotion(playerId, Promotion.XMAS_2023);
    players.modifyXP(ALICE, playerId, Skill.FIREMAKING, 100_000, true);
    vm.prank(ALICE);
    promotions.mintPromotion(playerId, Promotion.XMAS_2023);
  }

  function testMultidayPromotionRequiresPreviousDaysOracle() public {
    vm.warp(vm.getBlockTimestamp() + 1 days);
    PromotionInfoInput memory promotion = _basicMultidayPromotion();
    _addPromotion(promotion);
    vm.prank(ALICE);
    vm.expectRevert(IPromotions.OracleNotCalled.selector);
    promotions.mintPromotion(playerId, Promotion.XMAS_2023);
  }

  function testMultidayPromotionCannotMintTwiceInOneDay() public {
    _requestAndFulfillRandomWords();
    _addPromotion(_basicMultidayPromotion());
    vm.startPrank(ALICE);
    promotions.mintPromotion(playerId, Promotion.XMAS_2023);
    vm.expectRevert(IPromotions.PromotionAlreadyClaimed.selector);
    promotions.mintPromotion(playerId, Promotion.XMAS_2023);
    vm.stopPrank();
  }

  function testStreakInputsMustBeEmptyWhenClaimPeriodIsZero() public {
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _originalStreakInputPromotion();
    promotion.numDaysClaimablePeriodStreakBonus = 0;
    vm.expectRevert(PromotionsLibrary.InvalidStreakBonus.selector);
    _addPromotion(promotion);
    promotion.numDaysHitNeededForStreakBonus = 0;
    vm.expectRevert(PromotionsLibrary.InvalidStreakBonus.selector);
    _addPromotion(promotion);
    promotion.numRandomStreakBonusItemsToPick1 = 0;
    vm.expectRevert(PromotionsLibrary.InvalidStreakBonus.selector);
    _addPromotion(promotion);

    promotion.randomStreakBonusItemTokenIds1 = new uint16[](0);
    promotion.randomStreakBonusAmounts1 = new uint32[](0);
    _addPromotion(promotion);
  }

  function testStreakInputArrayLengthsMustMatch() public {
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _originalStreakInputPromotion();
    promotion.randomStreakBonusItemTokenIds1 = _uint16s(HALLOWEEN_BONUS_1);
    vm.expectRevert(PromotionsLibrary.LengthMismatch.selector);
    _addPromotion(promotion);
  }

  function testSinglePromotionRejectsMultidayStreakFields() public {
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _originalStreakInputPromotion();
    promotion.isMultiday = false;
    promotion.numDaysClaimablePeriodStreakBonus = 0;
    promotion.numDaysHitNeededForStreakBonus = 0;
    promotion.numRandomStreakBonusItemsToPick1 = 0;
    vm.expectRevert(PromotionsLibrary.MultidaySpecified.selector);
    _addPromotion(promotion);

    promotion.randomStreakBonusItemTokenIds1 = new uint16[](0);
    promotion.randomStreakBonusAmounts1 = new uint32[](0);
    vm.expectRevert(PromotionsLibrary.NoItemsToPickFrom.selector);
    _addPromotion(promotion);
  }

  function testStreakRewardsCanSelectEveryItem() public {
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _originalStreakInputPromotion();
    promotion.randomStreakBonusItemTokenIds1 = _uint16s(SECRET_EGG_3_TIER1, SECRET_EGG_4_TIER1);
    promotion.randomStreakBonusAmounts1 = _uint32s(1, 1);
    _addPromotion(promotion);

    uint256[] memory ids = new uint256[](25);
    for (uint256 i; i < ids.length; ++i) {
      ids[i] = _createPlayer(ALICE, 1, string.concat("name", vm.toString(i)), true);
      vm.prank(ALICE);
      promotions.mintPromotion(ids[i], Promotion.XMAS_2023);
    }
    vm.warp(vm.getBlockTimestamp() + 1 days);
    _requestAndFulfillRandomWords();
    for (uint256 i; i < ids.length; ++i) {
      vm.startPrank(ALICE);
      players.setActivePlayer(ids[i]);
      promotions.mintPromotion(ids[i], Promotion.XMAS_2023);
      vm.stopPrank();
    }
    assertGt(itemNFT.totalSupply(SECRET_EGG_3_TIER1), 0);
    assertGt(itemNFT.totalSupply(SECRET_EGG_4_TIER1), 0);
  }

  function testMultidayStreakInputsAreValidated() public {
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _originalStreakInputPromotion();
    promotion.numDaysHitNeededForStreakBonus = 0;
    vm.expectRevert(PromotionsLibrary.InvalidStreakBonus.selector);
    _addPromotion(promotion);
    promotion.numDaysHitNeededForStreakBonus = 1;
    promotion.numRandomStreakBonusItemsToPick1 = 0;
    vm.expectRevert(PromotionsLibrary.InvalidStreakBonus.selector);
    _addPromotion(promotion);
    promotion.numRandomStreakBonusItemsToPick1 = 1;
    promotion.randomStreakBonusItemTokenIds1 = new uint16[](0);
    promotion.randomStreakBonusAmounts1 = new uint32[](0);
    vm.expectRevert(PromotionsLibrary.InvalidStreakBonus.selector);
    _addPromotion(promotion);

    promotion.randomStreakBonusItemTokenIds1 = _uint16s(HALLOWEEN_BONUS_1, HALLOWEEN_BONUS_2, HALLOWEEN_BONUS_3);
    promotion.randomStreakBonusAmounts1 = _uint32s(1, 1, 1);
    _addPromotion(promotion);
  }

  function testCanClaimStreakBonus() public {
    _prepareTwoDayStreak();
    vm.warp(vm.getBlockTimestamp() + 1 days);
    _requestAndFulfillRandomWords();
    vm.prank(ALICE);
    promotions.mintPromotion(playerId, Promotion.XMAS_2023);

    uint256 total = itemNFT.balanceOf(ALICE, HALLOWEEN_BONUS_1) +
      itemNFT.balanceOf(ALICE, HALLOWEEN_BONUS_2) +
      itemNFT.balanceOf(ALICE, HALLOWEEN_BONUS_3);
    assertEq(total, 1);
  }

  function testCannotClaimStreakBonusTwice() public {
    _prepareTwoDayStreak();
    vm.warp(vm.getBlockTimestamp() + 1 days);
    _requestAndFulfillRandomWords();
    vm.startPrank(ALICE);
    promotions.mintPromotion(playerId, Promotion.XMAS_2023);
    vm.expectRevert(IPromotions.PromotionAlreadyClaimed.selector);
    promotions.mintPromotion(playerId, Promotion.XMAS_2023);
    vm.stopPrank();
  }

  function testCannotClaimStreakBonusOutsideClaimPeriod() public {
    _prepareTwoDayStreak();
    vm.warp(vm.getBlockTimestamp() + 2 days);
    vm.prank(ALICE);
    vm.expectRevert(IPromotions.MintingOutsideAvailableDate.selector);
    promotions.mintPromotion(playerId, Promotion.XMAS_2023);
  }

  function testStreakBonusRequiresEnoughClaimedDays() public {
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _streakBonusPromotion();
    _addPromotion(promotion);
    vm.warp(vm.getBlockTimestamp() + 1 days);
    _requestAndFulfillRandomWords();
    vm.prank(ALICE);
    promotions.mintPromotion(playerId, Promotion.XMAS_2023);
    vm.warp(vm.getBlockTimestamp() + 2 days);
    _requestAndFulfillRandomWords();
    vm.prank(ALICE);
    vm.expectRevert(IPromotions.PlayerNotHitEnoughClaims.selector);
    promotions.mintPromotion(playerId, Promotion.XMAS_2023);
  }

  function testStreakRewardDoesNotChangeDuringClaimPeriod() public {
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _streakBonusPromotion();
    promotion.numDaysClaimablePeriodStreakBonus = 10;
    _addPromotion(promotion);
    vm.prank(ALICE);
    promotions.mintPromotion(playerId, Promotion.XMAS_2023);
    vm.warp(vm.getBlockTimestamp() + 1 days);
    _requestAndFulfillRandomWords();
    vm.prank(ALICE);
    promotions.mintPromotion(playerId, Promotion.XMAS_2023);
    _advanceDaysWithOracle(2);

    (uint256[] memory itemTokenIds, , uint256[] memory daysToSet, PromotionMintStatus status) = promotions
      .mintPromotionViewNow(playerId, Promotion.XMAS_2023);
    assertEq(itemTokenIds.length, 1);
    assertEq(daysToSet[0], 31);
    assertEq(uint256(status), uint256(PromotionMintStatus.SUCCESS));
    uint256 expectedItemTokenId = itemTokenIds[0];
    for (uint256 i; i < 8; ++i) {
      vm.warp(vm.getBlockTimestamp() + 1 days);
      _requestAndFulfillRandomWords();
      (uint256[] memory currentItemTokenIds, , , ) = promotions.mintPromotionViewNow(playerId, Promotion.XMAS_2023);
      assertEq(currentItemTokenIds[0], expectedItemTokenId);
    }
    vm.prank(ALICE);
    promotions.mintPromotion(playerId, Promotion.XMAS_2023);
    assertTrue(promotions.hasCompletedPromotion(playerId, Promotion.XMAS_2023));
    assertEq(itemNFT.balanceOf(ALICE, expectedItemTokenId), 1);
  }

  function testMultidayPromotionChargesBrushOnlyOnFirstClaim() public {
    _requestAndFulfillRandomWords();
    PromotionInfoInput memory promotion = _streakBonusPromotion();
    promotion.tokenCost = 1 ether;
    _addPromotion(promotion);
    vm.prank(ALICE);
    brush.approve(address(promotions), 1 ether);
    vm.prank(ALICE);
    vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, ALICE, 0, 0.5 ether));
    promotions.mintPromotion(playerId, Promotion.XMAS_2023);
    brush.mint(ALICE, 1 ether);
    vm.prank(ALICE);
    promotions.mintPromotion(playerId, Promotion.XMAS_2023);
    assertEq(brush.balanceOf(ALICE), 0);
    assertEq(brush.balanceOf(address(treasury)), 0.5 ether);
    assertEq(brush.balanceOf(DEV), 0.25 ether);
  }

  function _basicSinglePromotion() private view returns (PromotionInfoInput memory promotion) {
    promotion.promotion = Promotion.HALLOWEEN_2023;
    promotion.startTime = uint40(block.timestamp);
    promotion.endTime = uint40(block.timestamp + 1 days);
    promotion.numDailyRandomItemsToPick = 1;
    promotion.randomItemTokenIds = _uint16s(HALLOWEEN_BONUS_1, HALLOWEEN_BONUS_2, HALLOWEEN_BONUS_3);
    promotion.randomAmounts = _uint32s(1, 1, 1);
  }

  function _basicMultidayPromotion() private view returns (PromotionInfoInput memory promotion) {
    promotion.promotion = Promotion.XMAS_2023;
    promotion.startTime = uint40(block.timestamp);
    promotion.endTime = uint40(block.timestamp + 1 days);
    promotion.numDailyRandomItemsToPick = 1;
    promotion.isMultiday = true;
  }

  function _missedDaysPromotion(uint256 daysLong) private view returns (PromotionInfoInput memory promotion) {
    promotion = _basicMultidayPromotion();
    promotion.endTime = uint40(block.timestamp + daysLong * 1 days);
    promotion.brushCostMissedDay = 10 ether;
  }

  function _originalStreakInputPromotion() private view returns (PromotionInfoInput memory promotion) {
    promotion = _basicMultidayPromotion();
    promotion.numDaysClaimablePeriodStreakBonus = 1;
    promotion.numDaysHitNeededForStreakBonus = 1;
    promotion.numRandomStreakBonusItemsToPick1 = 1;
    promotion.randomStreakBonusItemTokenIds1 = _uint16s(HALLOWEEN_BONUS_1, HALLOWEEN_BONUS_2, HALLOWEEN_BONUS_3);
    promotion.randomStreakBonusAmounts1 = _uint32s(1, 1, 1);
  }

  function _streakBonusPromotion() private view returns (PromotionInfoInput memory promotion) {
    promotion = _originalStreakInputPromotion();
    promotion.endTime = uint40(block.timestamp + 3 days);
    promotion.numDaysHitNeededForStreakBonus = 2;
  }

  function _prepareTwoDayStreak() private {
    _requestAndFulfillRandomWords();
    _addPromotion(_streakBonusPromotion());
    vm.prank(ALICE);
    promotions.mintPromotion(playerId, Promotion.XMAS_2023);
    vm.warp(vm.getBlockTimestamp() + 1 days);
    _requestAndFulfillRandomWords();
    vm.prank(ALICE);
    promotions.mintPromotion(playerId, Promotion.XMAS_2023);
    vm.warp(vm.getBlockTimestamp() + 1 days);
    _requestAndFulfillRandomWords();
  }

  function _completePurseStringsQuest() private {
    QuestInput[] memory inputs = new QuestInput[](1);
    inputs[0].questId = uint16(QUEST_PURSE_STRINGS);
    inputs[0].skillReward = Skill.FIREMAKING;
    inputs[0].skillXPGained = 1;
    IQuests.MinimumRequirement[3][] memory requirements = new IQuests.MinimumRequirement[3][](1);
    quests.addQuests(inputs, requirements);
    vm.deal(ALICE, 1 ether);
    vm.startPrank(ALICE);
    players.activateQuest(playerId, QUEST_PURSE_STRINGS);
    players.buyBrushQuest{value: 10}(ALICE, playerId, 0, true);
    vm.stopPrank();
  }

  function _advanceAndMintTierReward(uint256 xp, uint16 itemTokenId, uint256 expectedBalance) private {
    if (xp != 0) players.modifyXP(ALICE, playerId, Skill.FIREMAKING, uint56(xp), true);
    vm.warp(vm.getBlockTimestamp() + 1 days);
    _requestAndFulfillRandomWords();
    vm.prank(ALICE);
    promotions.mintPromotion(playerId, Promotion.XMAS_2023);
    assertEq(itemNFT.balanceOf(ALICE, itemTokenId), expectedBalance);
  }

  function _advanceDaysWithOracle(uint256 daysToAdvance) private {
    for (uint256 i; i < daysToAdvance; ++i) {
      vm.warp(vm.getBlockTimestamp() + 1 days);
      _requestAndFulfillRandomWords();
    }
  }

  function _requestAndFulfillRandomWords() private {
    uint256 requestId = randomnessBeacon.requestRandomWords();
    mockVRF.fulfill(requestId, address(randomnessBeacon));
  }

  function _fundAndApprovePromotion(uint256 amount) private {
    brush.mint(ALICE, amount);
    vm.prank(ALICE);
    brush.approve(address(promotions), amount);
  }

  function _setDailyRewardPool(uint256 tier, Equipment[] memory rewards) private {
    dailyRewardsScheduler.setDailyRewardPool(tier, rewards);
  }

  function _addPromotion(PromotionInfoInput memory promotion) private {
    promotions.addPromotions(_promotions(promotion));
  }

  function _promotions(
    PromotionInfoInput memory promotion
  ) private pure returns (PromotionInfoInput[] memory promotions_) {
    promotions_ = new PromotionInfoInput[](1);
    promotions_[0] = promotion;
  }

  function _promotionIds(Promotion promotion) private pure returns (Promotion[] memory promotions_) {
    promotions_ = new Promotion[](1);
    promotions_[0] = promotion;
  }

  function _uint32s(uint32 a) private pure returns (uint32[] memory values) {
    values = new uint32[](1);
    values[0] = a;
  }

  function _uint32s(uint32 a, uint32 b) private pure returns (uint32[] memory values) {
    values = new uint32[](2);
    values[0] = a;
    values[1] = b;
  }

  function _equipment(uint16 itemTokenId, uint24 amount) private pure returns (Equipment[] memory values) {
    values = new Equipment[](1);
    values[0] = Equipment(itemTokenId, amount);
  }

  function _equipment(
    uint16 itemTokenIdA,
    uint24 amountA,
    uint16 itemTokenIdB,
    uint24 amountB
  ) private pure returns (Equipment[] memory values) {
    values = new Equipment[](2);
    values[0] = Equipment(itemTokenIdA, amountA);
    values[1] = Equipment(itemTokenIdB, amountB);
  }

  function _range(uint256 length) private pure returns (uint256[] memory values) {
    values = new uint256[](length);
    for (uint256 i; i < length; ++i) {
      values[i] = i;
    }
  }
}
