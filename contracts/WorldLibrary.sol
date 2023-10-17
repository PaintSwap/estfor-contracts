// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";

// solhint-disable-next-line no-global-import
import "./globals/all.sol";

// This file contains methods for interacting with the World, used to decrease implementation deployment bytecode code.
library WorldLibrary {
  using UnsafeMath for U256;
  using UnsafeMath for uint;

  error InputSpecifiedWithoutAmount();
  error PreviousInputTokenIdMustBeSpecified();
  error InputAmountsMustBeInOrder();
  error OutputSpecifiedWithoutAmount();
  error RandomRewardsMustBeInOrder(uint16 chance1, uint16 chance2);
  error RandomRewardNoDuplicates();
  error GuaranteedRewardsMustBeInOrder();
  error GuaranteedRewardsNoDuplicates();
  error NotAFactorOf3600();
  error PackedDataAlwaysZeroForNow();
  error TooManyGuaranteedRewards();
  error TooManyRandomRewards();

  function checkActionChoice(ActionChoice calldata _actionChoice) external pure {
    if (_actionChoice.inputTokenId1 != NONE && _actionChoice.inputAmount1 == 0) {
      revert InputSpecifiedWithoutAmount();
    }
    if (_actionChoice.inputTokenId2 != NONE) {
      if (_actionChoice.inputAmount2 == 0) {
        revert InputSpecifiedWithoutAmount();
      }
      if (_actionChoice.inputTokenId1 == NONE) {
        revert PreviousInputTokenIdMustBeSpecified();
      }
      if (_actionChoice.inputAmount2 < _actionChoice.inputAmount1) {
        revert InputAmountsMustBeInOrder();
      }
    }
    if (_actionChoice.inputTokenId3 != NONE) {
      if (_actionChoice.inputAmount3 == 0) {
        revert InputSpecifiedWithoutAmount();
      }
      if (_actionChoice.inputTokenId2 == NONE) {
        revert PreviousInputTokenIdMustBeSpecified();
      }
      if (_actionChoice.inputAmount3 < _actionChoice.inputAmount2) {
        revert InputAmountsMustBeInOrder();
      }
    }

    if (_actionChoice.outputTokenId != 0 && _actionChoice.outputAmount == 0) {
      revert OutputSpecifiedWithoutAmount();
    }

    if (_actionChoice.rate != 0) {
      // Check that it is a factor of 3600
      if ((3600 * RATE_MUL) % _actionChoice.rate != 0) {
        revert NotAFactorOf3600();
      }
    }

    if (_actionChoice.packedData != 0x0) {
      revert PackedDataAlwaysZeroForNow();
    }
  }

  function setActionGuaranteedRewards(
    GuaranteedReward[] calldata _guaranteedRewards,
    ActionRewards storage _actionRewards
  ) external {
    uint guaranteedRewardsLength = _guaranteedRewards.length;
    if (guaranteedRewardsLength != 0) {
      _actionRewards.guaranteedRewardTokenId1 = _guaranteedRewards[0].itemTokenId;
      _actionRewards.guaranteedRewardRate1 = _guaranteedRewards[0].rate;
    }
    if (guaranteedRewardsLength > 1) {
      _actionRewards.guaranteedRewardTokenId2 = _guaranteedRewards[1].itemTokenId;
      _actionRewards.guaranteedRewardRate2 = _guaranteedRewards[1].rate;
      if (_actionRewards.guaranteedRewardRate2 < _actionRewards.guaranteedRewardRate1) {
        revert GuaranteedRewardsMustBeInOrder();
      }
      if (_actionRewards.guaranteedRewardTokenId1 == _actionRewards.guaranteedRewardTokenId2) {
        revert GuaranteedRewardsNoDuplicates();
      }
    }
    if (guaranteedRewardsLength > 2) {
      _actionRewards.guaranteedRewardTokenId3 = _guaranteedRewards[2].itemTokenId;
      _actionRewards.guaranteedRewardRate3 = _guaranteedRewards[2].rate;

      if (_actionRewards.guaranteedRewardRate3 < _actionRewards.guaranteedRewardRate2) {
        revert GuaranteedRewardsMustBeInOrder();
      }

      U256 bounds = guaranteedRewardsLength.dec().asU256();
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        uint i = iter.asUint256();
        if (_guaranteedRewards[i].itemTokenId == _guaranteedRewards[guaranteedRewardsLength.dec()].itemTokenId) {
          revert GuaranteedRewardsNoDuplicates();
        }
      }
    }

    if (guaranteedRewardsLength > 3) {
      revert TooManyGuaranteedRewards();
    }
  }

  // Random rewards have most common one first
  function setActionRandomRewards(RandomReward[] calldata _randomRewards, ActionRewards storage actionReward) external {
    uint randomRewardsLength = _randomRewards.length;
    if (randomRewardsLength != 0) {
      actionReward.randomRewardTokenId1 = _randomRewards[0].itemTokenId;
      actionReward.randomRewardChance1 = _randomRewards[0].chance;
      actionReward.randomRewardAmount1 = _randomRewards[0].amount;
    }
    if (randomRewardsLength > 1) {
      actionReward.randomRewardTokenId2 = _randomRewards[1].itemTokenId;
      actionReward.randomRewardChance2 = _randomRewards[1].chance;
      actionReward.randomRewardAmount2 = _randomRewards[1].amount;

      if (actionReward.randomRewardChance2 > actionReward.randomRewardChance1) {
        revert RandomRewardsMustBeInOrder(_randomRewards[0].chance, _randomRewards[1].chance);
      }
      if (actionReward.randomRewardTokenId1 == actionReward.randomRewardTokenId2) {
        revert RandomRewardNoDuplicates();
      }
    }
    if (randomRewardsLength > 2) {
      actionReward.randomRewardTokenId3 = _randomRewards[2].itemTokenId;
      actionReward.randomRewardChance3 = _randomRewards[2].chance;
      actionReward.randomRewardAmount3 = _randomRewards[2].amount;

      if (actionReward.randomRewardChance3 > actionReward.randomRewardChance2) {
        revert RandomRewardsMustBeInOrder(_randomRewards[1].chance, _randomRewards[2].chance);
      }

      U256 bounds = randomRewardsLength.dec().asU256();
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        uint i = iter.asUint256();
        if (_randomRewards[i].itemTokenId == _randomRewards[randomRewardsLength.dec()].itemTokenId) {
          revert RandomRewardNoDuplicates();
        }
      }
    }
    if (_randomRewards.length > 3) {
      actionReward.randomRewardTokenId4 = _randomRewards[3].itemTokenId;
      actionReward.randomRewardChance4 = _randomRewards[3].chance;
      actionReward.randomRewardAmount4 = _randomRewards[3].amount;
      if (actionReward.randomRewardChance4 > actionReward.randomRewardChance3) {
        revert RandomRewardsMustBeInOrder(_randomRewards[2].chance, _randomRewards[3].chance);
      }
      U256 bounds = _randomRewards.length.dec().asU256();
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        uint i = iter.asUint256();
        if (_randomRewards[i].itemTokenId == _randomRewards[_randomRewards.length - 1].itemTokenId) {
          revert RandomRewardNoDuplicates();
        }
      }
    }

    if (_randomRewards.length > 4) {
      revert TooManyRandomRewards();
    }
  }
}
