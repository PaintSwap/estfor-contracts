// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";

/* solhint-disable no-global-import */
import "./globals/items.sol";
import "./globals/players.sol";
import "./globals/actions.sol";
import "./globals/rewards.sol";

/* solhint-enable no-global-import */

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
  }

  // Random rewards have most common one first
  function setActionRandomRewards(Action calldata _action, ActionRewards storage actionReward) external {
    uint randomRewardsLength = _action.randomRewards.length;
    if (randomRewardsLength != 0) {
      actionReward.randomRewardTokenId1 = _action.randomRewards[0].itemTokenId;
      actionReward.randomRewardChance1 = _action.randomRewards[0].chance;
      actionReward.randomRewardAmount1 = _action.randomRewards[0].amount;
    }
    if (randomRewardsLength > 1) {
      actionReward.randomRewardTokenId2 = _action.randomRewards[1].itemTokenId;
      actionReward.randomRewardChance2 = _action.randomRewards[1].chance;
      actionReward.randomRewardAmount2 = _action.randomRewards[1].amount;

      if (actionReward.randomRewardChance2 > actionReward.randomRewardChance1) {
        revert RandomRewardsMustBeInOrder(_action.randomRewards[0].chance, _action.randomRewards[1].chance);
      }
      if (actionReward.randomRewardTokenId1 == actionReward.randomRewardTokenId2) {
        revert RandomRewardNoDuplicates();
      }
    }
    if (randomRewardsLength > 2) {
      actionReward.randomRewardTokenId3 = _action.randomRewards[2].itemTokenId;
      actionReward.randomRewardChance3 = _action.randomRewards[2].chance;
      actionReward.randomRewardAmount3 = _action.randomRewards[2].amount;

      if (actionReward.randomRewardChance3 > actionReward.randomRewardChance2) {
        revert RandomRewardsMustBeInOrder(_action.randomRewards[1].chance, _action.randomRewards[2].chance);
      }

      U256 bounds = randomRewardsLength.dec().asU256();
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        uint i = iter.asUint256();
        if (_action.randomRewards[i].itemTokenId == _action.randomRewards[randomRewardsLength.dec()].itemTokenId) {
          revert RandomRewardNoDuplicates();
        }
      }
    }
    if (_action.randomRewards.length > 3) {
      actionReward.randomRewardTokenId4 = _action.randomRewards[3].itemTokenId;
      actionReward.randomRewardChance4 = _action.randomRewards[3].chance;
      actionReward.randomRewardAmount4 = _action.randomRewards[3].amount;
      if (actionReward.randomRewardChance4 > actionReward.randomRewardChance3) {
        revert RandomRewardsMustBeInOrder(_action.randomRewards[2].chance, _action.randomRewards[3].chance);
      }
      U256 bounds = _action.randomRewards.length.dec().asU256();
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        uint i = iter.asUint256();
        if (
          _action.randomRewards[i].itemTokenId == _action.randomRewards[_action.randomRewards.length - 1].itemTokenId
        ) {
          revert RandomRewardNoDuplicates();
        }
      }
    }
  }

  function setActionGuaranteedRewards(Action calldata _action, ActionRewards storage _actionRewards) external {
    uint guaranteedRewardsLength = _action.guaranteedRewards.length;
    if (guaranteedRewardsLength != 0) {
      _actionRewards.guaranteedRewardTokenId1 = _action.guaranteedRewards[0].itemTokenId;
      _actionRewards.guaranteedRewardRate1 = _action.guaranteedRewards[0].rate;
    }
    if (guaranteedRewardsLength > 1) {
      _actionRewards.guaranteedRewardTokenId2 = _action.guaranteedRewards[1].itemTokenId;
      _actionRewards.guaranteedRewardRate2 = _action.guaranteedRewards[1].rate;
      if (_actionRewards.guaranteedRewardRate2 < _actionRewards.guaranteedRewardRate1) {
        revert GuaranteedRewardsMustBeInOrder();
      }
      if (_actionRewards.guaranteedRewardTokenId1 == _actionRewards.guaranteedRewardTokenId2) {
        revert GuaranteedRewardsNoDuplicates();
      }
    }
    if (guaranteedRewardsLength > 2) {
      _actionRewards.guaranteedRewardTokenId3 = _action.guaranteedRewards[2].itemTokenId;
      _actionRewards.guaranteedRewardRate3 = _action.guaranteedRewards[2].rate;

      if (_actionRewards.guaranteedRewardRate3 < _actionRewards.guaranteedRewardRate2) {
        revert GuaranteedRewardsMustBeInOrder();
      }

      U256 bounds = guaranteedRewardsLength.dec().asU256();
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        uint i = iter.asUint256();
        if (
          _action.guaranteedRewards[i].itemTokenId ==
          _action.guaranteedRewards[guaranteedRewardsLength.dec()].itemTokenId
        ) {
          revert GuaranteedRewardsNoDuplicates();
        }
      }
    }
  }
}
