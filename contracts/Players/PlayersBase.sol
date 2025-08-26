// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {RandomnessBeacon} from "../RandomnessBeacon.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {PlayerNFT} from "../PlayerNFT.sol";
import {PetNFT} from "../PetNFT.sol";
import {AdminAccess} from "../AdminAccess.sol";
import {Quests} from "../Quests.sol";
import {Clans} from "../Clans/Clans.sol";
import {WishingWell} from "../WishingWell.sol";
import {PlayersLibrary} from "./PlayersLibrary.sol";
import {SkillLibrary} from "../libraries/SkillLibrary.sol";
import {IWorldActions} from "../interfaces/IWorldActions.sol";
import {DailyRewardsScheduler} from "../DailyRewardsScheduler.sol";
import "../interfaces/IPlayersDelegates.sol";

import {IActivityPoints, ActivityType} from "../ActivityPoints/interfaces/IActivityPoints.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

abstract contract PlayersBase {
  using SkillLibrary for uint8;

  event ClearAll(address from, uint256 playerId);
  event SetActionQueue(
    address from,
    uint256 playerId,
    QueuedAction[] queuedActions,
    Attire[] attire,
    uint256 startTime
  );
  event AddXP(address from, uint256 playerId, Skill skill, uint256 points);
  event ConsumeBoostVial(address from, uint256 playerId, BoostInfo playerBoostInfo);
  event ConsumeExtraBoostVial(address from, uint256 playerId, BoostInfo playerBoostInfo);
  event ConsumeGlobalBoostVial(address from, uint256 playerId, BoostInfo globalBoost);
  event ConsumeClanBoostVial(address from, uint256 playerId, uint256 clanId, BoostInfo clanBoost);
  event SetActivePlayer(address account, uint256 oldPlayerId, uint256 newPlayerId);
  event AddPendingRandomReward(
    address from,
    uint256 playerId,
    uint256 queueId,
    uint256 startTime,
    uint256 elapsed,
    uint256 rolls
  );
  event PendingRandomRewardsClaimed(
    address from,
    uint256 playerId,
    uint256 numRemoved,
    uint256[] itemTokenIds,
    uint256[] amounts,
    uint256[] queueIds
  );
  event AdminAddThresholdReward(XPThresholdReward xpThresholdReward);
  event AdminEditThresholdReward(XPThresholdReward xpThresholdReward);

  event BoostFinished(uint256 playerId);
  event ExtraBoostFinished(uint256 playerId);
  event SetCombatParams(uint256 alphaCombat, uint256 betaCombat, uint256 alphaCombatHealing);
  event UpdateLastBoost(uint256 playerId, BoostInfo boostInfo);
  event UpdateLastExtraBoost(uint256 playerId, BoostInfo boostInfo);

  // For logging
  event Died(address from, uint256 playerId, uint256 queueId);
  event QuestRewardConsumes(
    address from,
    uint256 playerId,
    uint256[] rewardItemTokenIds,
    uint256[] rewardAmounts,
    uint256[] consumedItemTokenIds,
    uint256[] consumedAmounts
  );
  event Rewards(address from, uint256 playerId, uint256 queueId, uint256[] itemTokenIds, uint256[] amounts);
  event DailyReward(address from, uint256 playerId, uint256 itemTokenId, uint256 amount);
  event WeeklyReward(address from, uint256 playerId, uint256 itemTokenId, uint256 amount);
  event Consumes(address from, uint256 playerId, uint256 queueId, uint256[] itemTokenIds, uint256[] amounts);
  event ActionFinished(address from, uint256 playerId, uint256 queueId);
  event ActionPartiallyFinished(address from, uint256 playerId, uint256 queueId, uint256 elapsedTime);
  event ActionAborted(address from, uint256 playerId, uint256 queueId);
  event ClaimedXPThresholdRewards(address from, uint256 playerId, uint256[] itemTokenIds, uint256[] amounts);
  event LevelUp(address from, uint256 playerId, Skill skill, uint256 oldLevel, uint256 newLevel);
  event AddFullAttireBonus(Skill skill, uint16[5] itemTokenIds, uint256 bonusXPPercent, uint256 bonusRewardsPercent);

  error NotOwnerOfPlayer();
  error NotOwnerOfPlayerAndActive();
  error EquipSameItem();
  error NotEquipped();
  error ArgumentLengthMismatch();
  error NotPlayerNFT();
  error NotItemNFT();
  error ActionNotAvailable();
  error UnsupportedAttire(uint16 itemTokenId);
  error UnsupportedChoiceId();
  error InvalidHandEquipment(uint16 itemTokenId);
  error NoActiveBoost();
  error BoostTimeAlreadyStarted();
  error TooManyActionsQueued();
  error TooManyActionsQueuedSomeAlreadyExist();
  error ActionTimespanExceedsMaxTime();
  error ActionTimespanZero();
  error ActionMinimumXPNotReached();
  error ActionChoiceMinimumXPNotReached();
  error ItemMinimumXPNotReached();
  error AttireMinimumXPNotReached();
  error ConsumableMinimumXPNotReached();
  error NoItemBalance(uint16 itemTokenId);
  error CannotEquipTwoHandedAndOtherEquipment();
  error IncorrectRightHandEquipment(uint16 equippedItemTokenId);
  error IncorrectLeftHandEquipment(uint16 equippedItemTokenId);
  error IncorrectEquippedItem();
  error NotABoostVial();
  error UnsupportedRegenerateItem();
  error InvalidCombatStyle();
  error InvalidSkill();
  error InvalidTravellingTimespan();
  error ActionChoiceIdRequired();
  error ActionChoiceIdNotRequired();
  error InvalidEquipPosition();
  error NoActionsToProcess();
  error NotAdminAndBeta();
  error XPThresholdNotFound();
  error XPThresholdAlreadyExists();
  error XPThresholdDoesNotExist();
  error InvalidItemTokenId();
  error ItemDoesNotExist();
  error InvalidAmount();
  error EmptyTimespan();
  error PlayerAlreadyActive();
  error TestInvalidXP();
  error HasQueuedActions();
  error CannotCallInitializerOnImplementation();
  error InvalidReward();
  error BuyBrushFailed();
  error NonInstanceConsumeNotSupportedYet();
  error AlreadyUpgraded();
  error PlayerNotUpgraded();
  error ActionChoiceNotAvailable();
  error PetNotOwned();
  error DependentQuestNotCompleted();

  struct FullAttireBonus {
    uint8 bonusXPPercent; // 3 = 3%
    uint8 bonusRewardsPercent; // 3 = 3%
    uint16[5] itemTokenIds; // 0 = head, 1 = body, 2 arms, 3 body, 4 = feet
  }

  struct WalletDailyInfo {
    uint40 lastDailyRewardClaimedTimestamp;
  }

  uint32 internal constant MAX_TIME = 1 days;
  uint256 internal constant START_XP = 374; // Needs to be an even number as could be divided by 2 for the start skills
  // 90%, used for actions/actionChoices which can have a failure rate like thieving/cooking
  uint256 internal constant MAX_SUCCESS_PERCENT_CHANCE = 90;
  // The random chance where the odds are increased when there are dice roll overflows.
  // Don't set this above 1747 otherwise it can result in 100% chance for anything around that value
  uint256 internal constant RANDOM_REWARD_CHANCE_MULTIPLIER_CUTOFF = 1328;

  RandomnessBeacon internal _randomnessBeacon;
  IWorldActions internal _worldActions;
  DailyRewardsScheduler internal _dailyRewardsScheduler;
  bool internal _dailyRewardsEnabled;
  ItemNFT internal _itemNFT;
  // Combat formula constants
  uint8 internal _alphaCombat;
  uint8 internal _betaCombat;
  uint8 internal _alphaCombatHealing;
  PlayerNFT internal _playerNFT;
  uint64 internal _nextQueueId; // Global queued action id
  bool internal _gamePaused;

  AdminAccess internal _adminAccess;
  bool internal _isBeta;

  // Where most of the logic is location
  address internal _implQueueActions;
  address internal _implProcessActions;
  address internal _implRewards;
  address internal _implMisc;
  address internal _implMisc1;

  Quests internal _quests;
  Clans internal _clans;
  WishingWell internal _wishingWell;
  PetNFT internal _petNFT;

  StandardBoostInfo internal _globalBoost; // A boost shared by all heroes

  mapping(address user => ActivePlayerInfo playerInfo) internal _activePlayerInfos;
  mapping(uint256 playerId => ExtendedBoostInfo boostInfo) internal _activeBoosts;
  mapping(uint256 playerId => PackedXP packedXP) internal _playerXP;
  mapping(uint256 playerId => Player player) internal _players;
  mapping(uint256 playerId => mapping(uint256 queuedId => Attire attire)) internal _attire;
  mapping(uint256 playerId => PendingRandomReward[] pendingRandomRewards) internal _pendingRandomRewards; // queue, will be sorted by timestamp

  // First 7 bytes are whether that day has been claimed (Can be extended to 30 days), the last 2 bytes is the current checkpoint number (whether it needs clearing)
  mapping(uint256 playerId => bytes32) internal _dailyRewardMasks;
  mapping(uint256 xp => Equipment[] equipments) internal _xpRewardThresholds; // Thresholds and all items rewarded for it
  mapping(Skill skill => FullAttireBonus) internal _fullAttireBonus;
  mapping(uint256 clanId => StandardBoostInfo clanBoost) internal _clanBoosts; // Clan specific boosts
  mapping(address user => WalletDailyInfo walletDailyInfo) internal _walletDailyInfo;
  mapping(uint256 playerId => CheckpointEquipments[3] checkpointEquipments) internal _checkpointEquipments;
  mapping(address account => bool isModifier) internal _xpModifiers;

  address internal _bridge; // TODO: Remove later

  IActivityPoints internal _activityPoints;

  modifier onlyPlayerNFT() {
    require(msg.sender == address(_playerNFT), NotPlayerNFT());
    _;
  }

  modifier onlyItemNFT() {
    require(msg.sender == address(_itemNFT), NotItemNFT());
    _;
  }

  function _getSkillFromChoiceOrStyle(
    ActionChoice memory choice,
    CombatStyle combatStyle,
    uint16 actionId
  ) internal view returns (Skill skill) {
    if (combatStyle == CombatStyle.DEFENCE) {
      return Skill.DEFENCE;
    }

    Skill choiceSkill = choice.skill._asSkill();
    if (choiceSkill != Skill.NONE) {
      // If the skill is defence or health, then it's magic
      if (combatStyle == CombatStyle.ATTACK && (choiceSkill == Skill.DEFENCE || choiceSkill == Skill.HEALTH)) {
        skill = Skill.MAGIC;
      } else {
        skill = choiceSkill;
      }
    } else {
      skill = _worldActions.getSkill(actionId);
    }
  }

  function _isEvolved(uint256 playerId) internal view returns (bool) {
    return uint8(_players[playerId].packedData >> IS_FULL_MODE_BIT) & 1 == 1;
  }

  function _getElapsedTime(uint256 startTime, uint256 endTime) internal view returns (uint256 elapsedTime) {
    bool consumeAll = endTime <= block.timestamp;
    if (consumeAll) {
      // Fully consume this skill
      elapsedTime = endTime - startTime;
    } else if (block.timestamp > startTime) {
      // partially consume
      elapsedTime = block.timestamp - startTime;
    }
  }

  function _setInitialCheckpoints(
    address from,
    uint256 playerId,
    uint256 numActionsFinished,
    QueuedAction[] memory queuedActions,
    Attire[] memory attire
  ) internal {
    _delegatecall(
      _implQueueActions,
      abi.encodeWithSelector(
        IPlayersQueuedActionsDelegate.setInitialCheckpoints.selector,
        from,
        playerId,
        numActionsFinished,
        queuedActions,
        attire
      )
    );
  }

  function _setActionQueue(
    address from,
    uint256 playerId,
    QueuedAction[] memory queuedActions,
    Attire[] memory attire,
    uint256 startTime
  ) internal {
    Player storage player = _players[playerId];

    // If ids are the same as existing, then just change the first one. Optimization when only claiming loot
    bool sameQueueIds = true;
    if (player.actionQueue.length == queuedActions.length) {
      for (uint256 i = 0; i < queuedActions.length; ++i) {
        if (player.actionQueue[i].queueId != queuedActions[i].queueId) {
          sameQueueIds = false;
          break;
        }
      }
    }

    if (sameQueueIds && player.actionQueue.length == queuedActions.length && queuedActions.length != 0) {
      player.actionQueue[0] = queuedActions[0];
    } else {
      player.actionQueue = queuedActions;
      for (uint256 i; i < attire.length; ++i) {
        _attire[playerId][player.actionQueue[i].queueId] = attire[i];
      }
    }

    player.lastActiveTimestamp = uint40(block.timestamp);
    emit SetActionQueue(from, playerId, queuedActions, attire, startTime);
  }

  // This does not update player.totalXP or player.totalLevel!
  function _updateXP(
    address from,
    uint256 playerId,
    Skill skill,
    uint128 pointsAccrued,
    bool isNewOrBridgedPlayer
  ) internal returns (uint8 levelsGained) {
    PackedXP storage packedXP = _playerXP[playerId];
    uint256 oldPoints = PlayersLibrary.readXP(skill, packedXP);
    uint256 newPoints = oldPoints + pointsAccrued;

    if (newPoints > type(uint32).max) {
      newPoints = type(uint32).max;
      pointsAccrued = uint32(newPoints - oldPoints);
    }
    if (pointsAccrued == 0) {
      return 0;
    }
    uint256 offset = 2; // Accounts for NONE & COMBAT skills
    uint256 skillOffsetted = uint8(skill) - offset;
    uint256 slotNum = skillOffsetted / 6;
    uint256 relativePos = skillOffsetted % 6;

    // packedDataIsMaxedBitStart is the starting bit index for packedDataIsMaxed within the 256-bit storage slot
    uint256 packedDataIsMaxedBitStart = 240;
    uint256 bitsPerSkill = 2; // Two bits to store the max level version for each skill
    uint256 actualBitIndex = packedDataIsMaxedBitStart + relativePos * bitsPerSkill;

    uint16 newLevel = PlayersLibrary.getLevel(newPoints);
    // Determine the new max level version for this skill based on newLevel
    uint256 newMaxLevelVersion;
    /*if (newLevel == MAX_LEVEL_1) { // Not used yet
      newMaxLevelVersion = 2;
    } else */ if (
      newLevel == MAX_LEVEL
    ) {
      newMaxLevelVersion = 1;
    } else {
      newMaxLevelVersion = 0;
    }

    uint256 oldMaxLevelVersion;
    assembly ("memory-safe") {
      let val := sload(add(packedXP.slot, slotNum))

      oldMaxLevelVersion := and(shr(actualBitIndex, val), 0x3)

      // Clear the 5 bytes containing the old xp
      val := and(val, not(shl(mul(relativePos, 40), 0xffffffffff)))
      // Now set new xp
      val := or(val, shl(mul(relativePos, 40), newPoints))

      // Clear the bits for this skill in packedDataIsMaxed
      val := and(val, not(shl(actualBitIndex, 0x3))) // This shifts 11 (in binary) to the index and then negates it
      // Set the new max level version for this skill in packedDataIsMaxed
      val := or(val, shl(actualBitIndex, newMaxLevelVersion))

      sstore(add(packedXP.slot, slotNum), val)
    }

    emit AddXP(from, playerId, skill, pointsAccrued);

    bool isEvolved = _isEvolved(playerId);
    // assign the activity points for the action
    if (!isNewOrBridgedPlayer) {
      _activityPoints.rewardBlueTickets(ActivityType.players_evt_addxp, from, isEvolved, pointsAccrued);
    }

    uint256 oldLevel = PlayersLibrary.getLevel(oldPoints);
    if (oldMaxLevelVersion != newMaxLevelVersion && oldLevel == newLevel) {
      assert(false); // This should never happen yet
      // This user already has exceeded the new max level, so we want to properly upgrade them from the real old level (Untested)
      if (newMaxLevelVersion == 2) {
        oldLevel = MAX_LEVEL;
      } else if (newMaxLevelVersion == 3) {
        oldLevel = MAX_LEVEL_1;
      }
    }
    // Update the player's level
    levelsGained = uint8(newLevel - oldLevel);
    if (levelsGained != 0) {
      // assign activity points for the new level
      emit LevelUp(from, playerId, skill, oldLevel, newLevel);
      if (!isNewOrBridgedPlayer) {
        _activityPoints.rewardBlueTickets(ActivityType.players_evt_levelup, from, isEvolved, newLevel);
      }
    }
  }

  function _processActions(
    address from,
    uint256 playerId
  )
    internal
    returns (QueuedAction[] memory remainingQueuedActions, PendingQueuedActionData memory currentActionProcessed)
  {
    bytes memory data = _delegatecall(
      _implProcessActions,
      abi.encodeWithSelector(IPlayersProcessActionsDelegate.processActions.selector, from, playerId)
    );
    return abi.decode(data, (QueuedAction[], PendingQueuedActionData));
  }

  // Staticcall into ourselves and hit the fallback. This is done so that pendingQueuedActionState/dailyClaimedRewards can be exposed on the json abi.
  function _pendingQueuedActionState(
    address playerOwner,
    uint256 playerId
  ) internal view returns (PendingQueuedActionState memory) {
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(IPlayersRewardsDelegateView.pendingQueuedActionStateImpl.selector, playerOwner, playerId)
    );
    return abi.decode(data, (PendingQueuedActionState));
  }

  function _donate(address from, uint256 playerId, uint256 amount) internal {
    _delegatecall(
      _implProcessActions,
      abi.encodeWithSelector(IPlayersProcessActionsDelegate.donate.selector, from, playerId, amount)
    );
  }

  function _claimableXPThresholdRewards(
    uint256 oldTotalXP,
    uint256 newTotalXP
  ) internal view returns (uint256[] memory ids, uint256[] memory amounts) {
    // Call self
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(IPlayersMiscDelegateView.claimableXPThresholdRewardsImpl.selector, oldTotalXP, newTotalXP)
    );
    return abi.decode(data, (uint256[], uint256[]));
  }

  function _setPrevPlayerState(Player storage player, PendingQueuedActionData memory currentActionProcessed) internal {
    player.currentActionProcessedSkill1 = currentActionProcessed.skill1;
    player.currentActionProcessedXPGained1 = currentActionProcessed.xpGained1;
    player.currentActionProcessedSkill2 = currentActionProcessed.skill2;
    player.currentActionProcessedXPGained2 = currentActionProcessed.xpGained2;
    player.currentActionProcessedSkill3 = currentActionProcessed.skill3;
    player.currentActionProcessedXPGained3 = currentActionProcessed.xpGained3;
    player.currentActionProcessedFoodConsumed = currentActionProcessed.foodConsumed;
    player.currentActionProcessedBaseInputItemsConsumedNum = currentActionProcessed.baseInputItemsConsumedNum;
  }

  function _processClaimableRewards(
    address from,
    uint256 playerId,
    uint256[] memory itemTokenIds,
    uint256[] memory amounts,
    uint256[] memory queueIds,
    uint256 numPastRandomRewardInstancesToRemove
  ) internal {
    if (numPastRandomRewardInstancesToRemove != 0) {
      if (numPastRandomRewardInstancesToRemove == _pendingRandomRewards[playerId].length) {
        delete _pendingRandomRewards[playerId];
      } else {
        // Shift the remaining rewards to the front of the array
        uint256 bounds = _pendingRandomRewards[playerId].length - numPastRandomRewardInstancesToRemove;
        for (uint256 i; i < bounds; ++i) {
          _pendingRandomRewards[playerId][i] = _pendingRandomRewards[playerId][
            i + numPastRandomRewardInstancesToRemove
          ];
        }
        for (uint256 i = 0; i < numPastRandomRewardInstancesToRemove; ++i) {
          _pendingRandomRewards[playerId].pop();
        }
      }
    }
    if (itemTokenIds.length != 0) {
      _itemNFT.mintBatch(from, itemTokenIds, amounts);
    }

    if (numPastRandomRewardInstancesToRemove != 0 || itemTokenIds.length != 0) {
      // So this event can also be called when no dice rolls are used if the action (e.g thieving)
      // finished before 00:00 UTC and is called after the oracle is called
      emit PendingRandomRewardsClaimed(
        from,
        playerId,
        numPastRandomRewardInstancesToRemove,
        itemTokenIds,
        amounts,
        queueIds
      );
    }
  }

  // Caller must check that this is appropriate to delete
  function _clearPlayerMainBoost(address from, uint256 playerId) internal {
    ExtendedBoostInfo storage playerBoost = _activeBoosts[playerId];
    delete playerBoost.value;
    delete playerBoost.startTime;
    delete playerBoost.duration;
    delete playerBoost.value;
    delete playerBoost.itemTokenId;
    delete playerBoost.boostType;

    _activityPoints.rewardBlueTickets(ActivityType.players_evt_boostfinished, from, _isEvolved(playerId), 1);

    emit BoostFinished(playerId);
  }

  // Caller must check that this is appropriate to delete
  function _clearPlayerLastBoost(uint256 playerId) internal {
    ExtendedBoostInfo storage playerBoost = _activeBoosts[playerId];
    delete playerBoost.lastValue;
    delete playerBoost.lastStartTime;
    delete playerBoost.lastDuration;
    delete playerBoost.lastValue;
    delete playerBoost.lastItemTokenId;
    delete playerBoost.lastBoostType;

    // At the beginning of Estfor on Sonic (Dec 2024) there was no support for "last" boosts and it used to be lastOrExtra
    // So we need to check which version it is (0 means old) just to keep events in sync. If everyone who bridged has a last timestamp > Feb 2025 or no extra boost active
    // then this check can be removed and just use LastBoostFinished. TODO
    bool isVersion0 = (playerBoost.packedData & bytes1(uint8(1))) == 0;
    if (isVersion0) {
      emit ExtraBoostFinished(playerId);
    } else {
      BoostInfo memory boostInfo;
      emit UpdateLastBoost(playerId, boostInfo);
    }
  }

  function _clearPlayerExtraBoost(uint256 playerId) internal {
    ExtendedBoostInfo storage playerBoost = _activeBoosts[playerId];
    delete playerBoost.extraValue;
    delete playerBoost.extraStartTime;
    delete playerBoost.extraDuration;
    delete playerBoost.extraValue;
    delete playerBoost.extraItemTokenId;
    delete playerBoost.extraBoostType;

    // Clear the has extra boost of packedData if it's no longer relevant. Assumes last boost is always lower in timestamp so always clear
    playerBoost.packedData &= bytes1(uint8(0xFF) ^ uint8((1 << HAS_EXTRA_BOOST_BIT)));
    emit ExtraBoostFinished(playerId);
  }

  function _clearPlayerLastExtraBoost(uint256 playerId) internal {
    ExtendedBoostInfo storage playerBoost = _activeBoosts[playerId];
    delete playerBoost.lastExtraValue;
    delete playerBoost.lastExtraStartTime;
    delete playerBoost.lastExtraDuration;
    delete playerBoost.lastExtraValue;
    delete playerBoost.lastExtraItemTokenId;
    delete playerBoost.lastExtraBoostType;
    if (playerBoost.extraValue == 0) {
      bytes1 packedData = playerBoost.packedData;
      packedData &= bytes1(uint8(0xFF) ^ uint8((1 << HAS_EXTRA_BOOST_BIT)));
      playerBoost.packedData = packedData;
    }
    BoostInfo memory boostInfo;
    emit UpdateLastExtraBoost(playerId, boostInfo);
  }

  // Is there a current boost ongoing when this one will be overriden? If so set last* up to the current time so that it can be used
  // to give the player the remaining boost time for any queued actions on-going at this time.
  function _setLastBoost(uint256 playerId, ExtendedBoostInfo storage playerBoost, uint24 lastDuration) internal {
    playerBoost.lastStartTime = playerBoost.startTime;
    playerBoost.lastDuration = lastDuration;
    playerBoost.lastValue = playerBoost.value;
    playerBoost.lastBoostType = playerBoost.boostType;
    playerBoost.lastItemTokenId = playerBoost.itemTokenId;
    playerBoost.packedData |= bytes1(uint8(1));
    emit UpdateLastBoost(
      playerId,
      BoostInfo({
        startTime: playerBoost.lastStartTime,
        duration: playerBoost.lastDuration,
        value: playerBoost.lastValue,
        boostType: playerBoost.lastBoostType,
        itemTokenId: playerBoost.lastItemTokenId
      })
    );
  }

  function _hasPet(bytes1 packed) internal pure returns (bool) {
    return uint8(packed >> HAS_PET_BIT) & 1 == 1;
  }

  function _delegatecall(address target, bytes memory data) internal returns (bytes memory returndata) {
    bool success;
    (success, returndata) = target.delegatecall(data);
    if (!success) {
      if (returndata.length == 0) revert();
      assembly ("memory-safe") {
        revert(add(32, returndata), mload(returndata))
      }
    }
  }

  function _staticcall(address target, bytes memory data) internal view returns (bytes memory returndata) {
    bool success;
    (success, returndata) = target.staticcall(data);
    if (!success) {
      if (returndata.length == 0) revert();
      assembly ("memory-safe") {
        revert(add(32, returndata), mload(returndata))
      }
    }
  }
}
