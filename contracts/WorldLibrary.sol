// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {SkillLibrary} from "./libraries/SkillLibrary.sol";

// solhint-disable-next-line no-global-import
import "./globals/all.sol";

// This file contains methods for interacting with the World, used to decrease implementation deployment bytecode code.
library WorldLibrary {
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

    require(inputTokenIds.length <= 3, TooManyInputItems());
    require(inputTokenIds.length == amounts.length, LengthMismatch());

    require(
      !(actionChoiceInput.outputTokenId != NONE && actionChoiceInput.outputAmount == 0),
      OutputAmountCannotBeZero()
    );
    require(
      !(actionChoiceInput.outputTokenId == NONE && actionChoiceInput.outputAmount != 0),
      OutputTokenIdCannotBeEmpty()
    );

    for (uint256 i; i < inputTokenIds.length; ++i) {
      require(inputTokenIds[i] != 0, InvalidInputTokenId());
      require(amounts[i] != 0, InputSpecifiedWithoutAmount());

      if (i != inputTokenIds.length - 1) {
        require(amounts[i] <= amounts[i + 1], InputAmountsMustBeInOrder());
        for (uint256 j; j < inputTokenIds.length; ++j) {
          require(j == i || inputTokenIds[i] != inputTokenIds[j], InputItemNoDuplicates());
        }
      }
    }

    // Check minimum xp
    uint8[] calldata minSkills = actionChoiceInput.minSkills;
    uint32[] calldata minXPs = actionChoiceInput.minXPs;

    // First minSkill must be the same as the action choice skill
    require(minSkills.length == 0 || minSkills[0] == actionChoiceInput.skill, FirstMinSkillMustBeActionChoiceSkill());
    require(minSkills.length <= 3, TooManyMinSkills());
    require(minSkills.length == minXPs.length, LengthMismatch());

    for (uint256 i; i < minSkills.length; ++i) {
      require(!minSkills[i]._isSkillNone(), InvalidSkill());
      // Can only be 0 if it's the first one and there is more than one
      require(!(minXPs[i] == 0 && (i != 0 || minSkills.length == 1)), InputSpecifiedWithoutAmount());

      if (i != minSkills.length - 1) {
        for (uint256 j; j < minSkills.length; ++j) {
          require(j == i || minSkills[i] != minSkills[j], MinimumSkillsNoDuplicates());
        }
      }
    }

    if (actionChoiceInput.rate != 0) {
      // Check that it is a factor of 3600
      require((3600 * RATE_MUL) % actionChoiceInput.rate == 0, NotAFactorOf3600());
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
      require(
        actionRewards.guaranteedRewardTokenId1 != actionRewards.guaranteedRewardTokenId2,
        GuaranteedRewardsNoDuplicates()
      );
    }
    if (guaranteedRewardsLength > 2) {
      actionRewards.guaranteedRewardTokenId3 = guaranteedRewards[2].itemTokenId;
      actionRewards.guaranteedRewardRate3 = guaranteedRewards[2].rate;

      uint256 _bounds = guaranteedRewardsLength - 1;
      for (uint256 i; i < _bounds; ++i) {
        require(
          guaranteedRewards[i].itemTokenId != guaranteedRewards[guaranteedRewardsLength - 1].itemTokenId,
          GuaranteedRewardsNoDuplicates()
        );
      }
    }
    require(guaranteedRewardsLength <= 3, TooManyGuaranteedRewards());
  }

  // Random rewards have most common one first
  function setActionRandomRewards(RandomReward[] calldata randomRewards, ActionRewards storage actionRewards) external {
    uint256 randomRewardsLength = randomRewards.length;
    if (randomRewardsLength != 0) {
      actionRewards.randomRewardTokenId1 = randomRewards[0].itemTokenId;
      actionRewards.randomRewardChance1 = randomRewards[0].chance;
      actionRewards.randomRewardAmount1 = randomRewards[0].amount;
    }
    if (randomRewardsLength > 1) {
      actionRewards.randomRewardTokenId2 = randomRewards[1].itemTokenId;
      actionRewards.randomRewardChance2 = randomRewards[1].chance;
      actionRewards.randomRewardAmount2 = randomRewards[1].amount;

      require(
        actionRewards.randomRewardChance2 <= actionRewards.randomRewardChance1,
        RandomRewardsMustBeInOrder(randomRewards[0].chance, randomRewards[1].chance)
      );
      require(actionRewards.randomRewardTokenId1 != actionRewards.randomRewardTokenId2, RandomRewardNoDuplicates());
    }
    if (randomRewardsLength > 2) {
      actionRewards.randomRewardTokenId3 = randomRewards[2].itemTokenId;
      actionRewards.randomRewardChance3 = randomRewards[2].chance;
      actionRewards.randomRewardAmount3 = randomRewards[2].amount;

      require(
        actionRewards.randomRewardChance3 <= actionRewards.randomRewardChance2,
        RandomRewardsMustBeInOrder(randomRewards[1].chance, randomRewards[2].chance)
      );

      uint256 _bounds = randomRewardsLength - 1;
      for (uint256 i; i < _bounds; ++i) {
        require(
          randomRewards[i].itemTokenId != randomRewards[randomRewardsLength - 1].itemTokenId,
          RandomRewardNoDuplicates()
        );
      }
    }
    if (randomRewards.length > 3) {
      actionRewards.randomRewardTokenId4 = randomRewards[3].itemTokenId;
      actionRewards.randomRewardChance4 = randomRewards[3].chance;
      actionRewards.randomRewardAmount4 = randomRewards[3].amount;
      require(
        actionRewards.randomRewardChance4 <= actionRewards.randomRewardChance3,
        RandomRewardsMustBeInOrder(randomRewards[2].chance, randomRewards[3].chance)
      );
      uint256 _bounds = randomRewards.length - 1;
      for (uint256 i; i < _bounds; ++i) {
        require(
          randomRewards[i].itemTokenId != randomRewards[randomRewards.length - 1].itemTokenId,
          RandomRewardNoDuplicates()
        );
      }
    }

    require(randomRewards.length <= 4, TooManyRandomRewards());
  }
}
