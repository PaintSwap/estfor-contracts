// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";

import {SkillLibrary} from "./libraries/SkillLibrary.sol";

// solhint-disable-next-line no-global-import
import "./globals/all.sol";

// This file contains methods for interacting with the World, used to decrease implementation deployment bytecode code.
library WorldLibrary {
  using UnsafeMath for U256;
  using UnsafeMath for uint256;
  using SkillLibrary for uint8;

  error InputSpecifiedWithoutAmount();
  error InputAmountsMustBeInOrder();
  error TooManyInputItems();
  error InvalidInputTokenId();
  error LengthMismatch();
  error InputItemNoDuplicates();
  error InvalidSkill();
  error MinimumSkillsNoDuplicates();
  error TooManyMinSkills();
  error OutputAmountCannotBeZero();
  error OutputSpecifiedWithoutAmount();
  error OutputTokenIdCannotBeEmpty();
  error RandomRewardsMustBeInOrder(uint16 chance1, uint16 chance2);
  error RandomRewardNoDuplicates();
  error GuaranteedRewardsNoDuplicates();
  error NotAFactorOf3600();
  error TooManyGuaranteedRewards();
  error TooManyRandomRewards();
  error FirstMinSkillMustBeActionChoiceSkill();

  function checkActionChoice(ActionChoiceInput calldata actionChoiceInput) external pure {
    uint16[] calldata inputTokenIds = actionChoiceInput.inputTokenIds;
    uint24[] calldata amounts = actionChoiceInput.inputAmounts;

    if (inputTokenIds.length > 3) {
      revert TooManyInputItems();
    }
    if (inputTokenIds.length != amounts.length) {
      revert LengthMismatch();
    }

    if (actionChoiceInput.outputTokenId != NONE && actionChoiceInput.outputAmount == 0) {
      revert OutputAmountCannotBeZero();
    }
    if (actionChoiceInput.outputTokenId == NONE && actionChoiceInput.outputAmount != 0) {
      revert OutputTokenIdCannotBeEmpty();
    }

    for (uint256 i; i < inputTokenIds.length; ++i) {
      if (inputTokenIds[i] == 0) {
        revert InvalidInputTokenId();
      }
      if (amounts[i] == 0) {
        revert InputSpecifiedWithoutAmount();
      }

      if (i != inputTokenIds.length - 1) {
        if (amounts[i] > amounts[i + 1]) {
          revert InputAmountsMustBeInOrder();
        }
        for (uint256 j; j < inputTokenIds.length; ++j) {
          if (j != i && inputTokenIds[i] == inputTokenIds[j]) {
            revert InputItemNoDuplicates();
          }
        }
      }
    }

    // Check minimum xp
    uint8[] calldata minSkills = actionChoiceInput.minSkills;
    uint32[] calldata minXPs = actionChoiceInput.minXPs;

    // First minSkill must be the same as the action choice skill
    if (minSkills.length != 0 && minSkills[0] != actionChoiceInput.skill) {
      revert FirstMinSkillMustBeActionChoiceSkill();
    }

    if (minSkills.length > 3) {
      revert TooManyMinSkills();
    }
    if (minSkills.length != minXPs.length) {
      revert LengthMismatch();
    }

    for (uint256 i; i < minSkills.length; ++i) {
      if (minSkills[i].isNone()) {
        revert InvalidSkill();
      }
      // Can only be 0 if it's the first one and there is more than one
      if (minXPs[i] == 0 && (i != 0 || minSkills.length == 1)) {
        revert InputSpecifiedWithoutAmount();
      }

      if (i != minSkills.length - 1) {
        for (uint256 j; j < minSkills.length; ++j) {
          if (j != i && minSkills[i] == minSkills[j]) {
            revert MinimumSkillsNoDuplicates();
          }
        }
      }
    }

    if (actionChoiceInput.rate != 0) {
      // Check that it is a factor of 3600
      if ((3600 * RATE_MUL) % actionChoiceInput.rate != 0) {
        revert NotAFactorOf3600();
      }
    }
  }

  function setActionGuaranteedRewards(
    GuaranteedReward[] calldata guaranteedRewards,
    ActionRewards storage actionRewards
  ) external {
    uint256 guaranteedRewardsLength = guaranteedRewards.length;
    if (guaranteedRewardsLength != 0) {
      actionRewards.guaranteedRewardTokenId1 = guaranteedRewards[0].itemTokenId;
      actionRewards.guaranteedRewardRate1 = guaranteedRewards[0].rate;
    }
    if (guaranteedRewardsLength > 1) {
      actionRewards.guaranteedRewardTokenId2 = guaranteedRewards[1].itemTokenId;
      actionRewards.guaranteedRewardRate2 = guaranteedRewards[1].rate;
      if (actionRewards.guaranteedRewardTokenId1 == actionRewards.guaranteedRewardTokenId2) {
        revert GuaranteedRewardsNoDuplicates();
      }
    }
    if (guaranteedRewardsLength > 2) {
      actionRewards.guaranteedRewardTokenId3 = guaranteedRewards[2].itemTokenId;
      actionRewards.guaranteedRewardRate3 = guaranteedRewards[2].rate;

      U256 _bounds = guaranteedRewardsLength.dec().asU256();
      for (U256 iter; iter < _bounds; iter = iter.inc()) {
        uint256 i = iter.asUint256();
        if (guaranteedRewards[i].itemTokenId == guaranteedRewards[guaranteedRewardsLength.dec()].itemTokenId) {
          revert GuaranteedRewardsNoDuplicates();
        }
      }
    }
    if (guaranteedRewardsLength > 3) {
      revert TooManyGuaranteedRewards();
    }
  }

  // Random rewards have most common one first
  function setActionRandomRewards(RandomReward[] calldata randomRewards, ActionRewards storage actionReward) external {
    uint256 randomRewardsLength = randomRewards.length;
    if (randomRewardsLength != 0) {
      actionReward.randomRewardTokenId1 = randomRewards[0].itemTokenId;
      actionReward.randomRewardChance1 = randomRewards[0].chance;
      actionReward.randomRewardAmount1 = randomRewards[0].amount;
    }
    if (randomRewardsLength > 1) {
      actionReward.randomRewardTokenId2 = randomRewards[1].itemTokenId;
      actionReward.randomRewardChance2 = randomRewards[1].chance;
      actionReward.randomRewardAmount2 = randomRewards[1].amount;

      if (actionReward.randomRewardChance2 > actionReward.randomRewardChance1) {
        revert RandomRewardsMustBeInOrder(randomRewards[0].chance, randomRewards[1].chance);
      }
      if (actionReward.randomRewardTokenId1 == actionReward.randomRewardTokenId2) {
        revert RandomRewardNoDuplicates();
      }
    }
    if (randomRewardsLength > 2) {
      actionReward.randomRewardTokenId3 = randomRewards[2].itemTokenId;
      actionReward.randomRewardChance3 = randomRewards[2].chance;
      actionReward.randomRewardAmount3 = randomRewards[2].amount;

      if (actionReward.randomRewardChance3 > actionReward.randomRewardChance2) {
        revert RandomRewardsMustBeInOrder(randomRewards[1].chance, randomRewards[2].chance);
      }

      U256 _bounds = randomRewardsLength.dec().asU256();
      for (U256 iter; iter < _bounds; iter = iter.inc()) {
        uint256 i = iter.asUint256();
        if (randomRewards[i].itemTokenId == randomRewards[randomRewardsLength.dec()].itemTokenId) {
          revert RandomRewardNoDuplicates();
        }
      }
    }
    if (randomRewards.length > 3) {
      actionReward.randomRewardTokenId4 = randomRewards[3].itemTokenId;
      actionReward.randomRewardChance4 = randomRewards[3].chance;
      actionReward.randomRewardAmount4 = randomRewards[3].amount;
      if (actionReward.randomRewardChance4 > actionReward.randomRewardChance3) {
        revert RandomRewardsMustBeInOrder(randomRewards[2].chance, randomRewards[3].chance);
      }
      U256 _bounds = randomRewards.length.dec().asU256();
      for (U256 iter; iter < _bounds; iter = iter.inc()) {
        uint256 i = iter.asUint256();
        if (randomRewards[i].itemTokenId == randomRewards[randomRewards.length - 1].itemTokenId) {
          revert RandomRewardNoDuplicates();
        }
      }
    }

    if (randomRewards.length > 4) {
      revert TooManyRandomRewards();
    }
  }
}
