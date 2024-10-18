// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";
import {World} from "../World.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {PlayerNFT} from "../PlayerNFT.sol";
import {PetNFT} from "../PetNFT.sol";
import {AdminAccess} from "../AdminAccess.sol";
import {Quests} from "../Quests.sol";
import {Clans} from "../Clans/Clans.sol";
import {WishingWell} from "../WishingWell.sol";
import {PlayersLibrary} from "./PlayersLibrary.sol";
import {SkillLibrary} from "../libraries/SkillLibrary.sol";
import "../interfaces/IPlayersDelegates.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

abstract contract PlayersBase {
  using UnsafeMath for U256;
  using UnsafeMath for uint256;
  using SkillLibrary for uint8;

  event ClearAll(address from, uint256 playerId);
  event SetActionQueueV2(
    address from,
    uint256 playerId,
    QueuedAction[] queuedActions,
    Attire[] attire,
    uint256 startTime,
    QueuedActionExtra[] queuedActionsExtra
  );
  event AddXP(address from, uint256 playerId, Skill skill, uint256 points);
  event ConsumeBoostVial(address from, uint256 playerId, BoostInfo playerBoostInfo);
  event ConsumeExtraBoostVial(address from, uint256 playerId, BoostInfo playerBoostInfo);
  event ConsumeGlobalBoostVial(address from, uint256 playerId, BoostInfo globalBoost);
  event ConsumeClanBoostVial(address from, uint256 playerId, uint256 clanId, BoostInfo clanBoost);
  event SetActivePlayer(address account, uint256 oldPlayerId, uint256 newPlayerId);
  event AddPendingRandomReward(address from, uint256 playerId, uint256 queueId, uint256 startTime, uint256 elapsed);
  event AddPendingRandomRewardV2(
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
  event LevelUp(address from, uint256 playerId, Skill skill, uint32 oldLevel, uint32 newLevel);
  event AddFullAttireBonus(Skill skill, uint16[5] itemTokenIds, uint8 bonusXPPercent, uint8 bonusRewardsPercent);

  // legacy
  event SetActionQueue(
    address from,
    uint256 playerId,
    QueuedActionV1[] queuedActions,
    Attire[] attire,
    uint256 startTime
  );

  struct FullAttireBonus {
    uint8 bonusXPPercent; // 3 = 3%
    uint8 bonusRewardsPercent; // 3 = 3%
    uint16[5] itemTokenIds; // 0 = head, 1 = body, 2 arms, 3 body, 4 = feet
  }

  struct WalletDailyInfo {
    uint40 lastDailyRewardClaimedTimestamp;
  }

  error NotOwnerOfPlayer();
  error NotOwnerOfPlayerAndActive();
  error EquipSameItem();
  error NotEquipped();
  error ArgumentLengthMismatch();
  error NotPlayerNFT();
  error NotItemNFT();
  error ActionNotAvailable();
  error UnsupportedAttire();
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
  error InvalidStartSlot();
  error NoItemBalance(uint16 itemTokenId);
  error CannotEquipTwoHandedAndOtherEquipment();
  error IncorrectRightHandEquipment(uint16 equippedItemTokenId);
  error IncorrectLeftHandEquipment(uint16 equippedItemTokenId);
  error IncorrectEquippedItem();
  error NotABoostVial();
  error StartTimeTooFarInTheFuture();
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
  error PetNotOwned();

  uint32 internal constant MAX_TIME_ = 1 days;
  uint256 internal constant START_XP_ = 374;
  // 90%, used for actions/actionChoices which can have a failure rate like thieving/cooking
  uint256 internal constant MAX_SUCCESS_PERCENT_CHANCE_ = 90;
  // The random chance where the odds are increased when there are dice roll overflows.
  // Don't set this above 1747 otherwise it can result in 100% chance for anything around that value
  uint256 internal constant RANDOM_REWARD_CHANCE_MULTIPLIER_CUTOFF_ = 1328;
  uint256 internal constant MAX_LEVEL = 100; // Original max level
  uint256 internal constant MAX_LEVEL_1 = 500; // TODO: Update later

  // *IMPORTANT* keep as the first non-constant state variable
  uint256 internal _startSlot;

  mapping(address user => uint256 playerId) internal activePlayer_;

  mapping(uint256 playerId => PlayerBoostInfo boostInfo) internal activeBoosts_;

  World internal world;
  // Constants for the damage formula
  uint8 internal alphaCombat;
  uint8 internal betaCombat;
  uint56 internal nextQueueId; // Global queued action id
  uint8 internal _alphaCombatHealing; // Healing formula constants
  bool internal dailyRewardsEnabled;
  bool internal isBeta;

  mapping(uint256 playerId => PackedXP packedXP) internal xp_;

  mapping(uint256 playerId => Player player) internal players_;
  mapping(uint256 playerId => mapping(uint256 queuedId => Attire attire)) internal attire_;
  ItemNFT internal itemNFT;
  PlayerNFT internal playerNFT;
  bool internal gamePaused;
  mapping(uint256 playerId => PendingRandomReward[] pendingRandomRewards) internal pendingRandomRewards; // queue, will be sorted by timestamp

  // First 7 bytes are whether that day has been claimed (Can be extended to 30 days), the last 2 bytes is the current checkpoint number (whether it needs clearing)
  mapping(uint256 playerId => bytes32) internal dailyRewardMasks;

  mapping(uint256 xp => Equipment[] equipments) internal xpRewardThresholds; // Thresholds and all items rewarded for it

  address internal implQueueActions;
  address internal implProcessActions;
  address internal implRewards;
  address internal implMisc;
  address internal implMisc1;

  AdminAccess internal adminAccess;

  mapping(Skill skill => FullAttireBonus) internal fullAttireBonus;
  Quests internal quests;
  Clans internal clans;
  WishingWell internal wishingWell;
  address internal reserved1;

  PlayerBoostInfo internal globalBoost_; // A boost shared by everyone
  mapping(uint256 clanId => PlayerBoostInfo clanBoost) internal clanBoosts_; // Clan specific boosts

  mapping(address user => WalletDailyInfo walletDailyInfo) internal walletDailyInfo;
  mapping(uint256 queueId => QueuedActionExtra queuedActionExtra) internal queuedActionsExtra;

  PetNFT internal petNFT;

  modifier onlyPlayerNFT() {
    if (msg.sender != address(playerNFT)) {
      revert NotPlayerNFT();
    }
    _;
  }

  modifier onlyItemNFT() {
    if (msg.sender != address(itemNFT)) {
      revert NotItemNFT();
    }
    _;
  }

  modifier isAdminAndBeta() {
    if (!(adminAccess.isAdmin(msg.sender) && isBeta)) {
      revert NotAdminAndBeta();
    }
    _;
  }

  function _getSkillFromChoiceOrStyle(
    ActionChoice memory _choice,
    CombatStyle _combatStyle,
    uint16 _actionId
  ) internal view returns (Skill skill) {
    if (_combatStyle == CombatStyle.DEFENCE) {
      return Skill.DEFENCE;
    }

    Skill choiceSkill = _choice.skill.asSkill();
    if (choiceSkill != Skill.NONE) {
      // If the skill is defence or health, then it's magic
      if (_combatStyle == CombatStyle.ATTACK && (choiceSkill == Skill.DEFENCE || choiceSkill == Skill.HEALTH)) {
        skill = Skill.MAGIC;
      } else {
        skill = choiceSkill;
      }
    } else {
      skill = world.getSkill(_actionId);
    }
  }

  function _isPlayerFullMode(uint256 playerId) internal view returns (bool) {
    return uint8(players_[playerId].packedData >> IS_FULL_MODE_BIT) & 1 == 1;
  }

  function _getElapsedTime(uint256 _startTime, uint256 _endTime) internal view returns (uint256 elapsedTime) {
    bool consumeAll = _endTime <= block.timestamp;
    if (consumeAll) {
      // Fully consume this skill
      elapsedTime = _endTime - _startTime;
    } else if (block.timestamp > _startTime) {
      // partially consume
      elapsedTime = block.timestamp - _startTime;
    }
  }

  function _setActionQueue(
    address _from,
    uint256 playerId,
    QueuedAction[] memory queuedActions,
    QueuedActionExtra[] memory _queuedActionsExtra,
    Attire[] memory _attire,
    uint256 _startTime
  ) internal {
    Player storage player = players_[playerId];

    // If ids are the same as existing, then just change the first one. Optimization when just claiming loot
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
      for (uint256 i; i < _attire.length; ++i) {
        attire_[playerId][player.actionQueue[i].queueId] = _attire[i];
      }
    }
    emit SetActionQueueV2(_from, playerId, queuedActions, _attire, _startTime, _queuedActionsExtra);
  }

  // This does not update player.totalXP!!
  function _updateXP(address _from, uint256 playerId, Skill _skill, uint128 _pointsAccrued) internal {
    PackedXP storage packedXP = xp_[playerId];
    uint256 oldPoints = PlayersLibrary.readXP(_skill, packedXP);
    uint256 newPoints = oldPoints.add(_pointsAccrued);

    if (newPoints > type(uint32).max) {
      newPoints = type(uint32).max;
      _pointsAccrued = uint32(newPoints - oldPoints);
    }
    if (_pointsAccrued == 0) {
      return;
    }
    uint256 offset = 2; // Accounts for NONE & COMBAT skills
    uint256 skillOffsetted = uint8(_skill) - offset;
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

    assembly ("memory-safe") {
      let val := sload(add(packedXP.slot, slotNum))

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

    emit AddXP(_from, playerId, _skill, _pointsAccrued);

    uint16 oldLevel = PlayersLibrary.getLevel(oldPoints);
    // Update the player's level
    if (newLevel > oldLevel) {
      emit LevelUp(_from, playerId, _skill, oldLevel, newLevel);
    }
  }

  function _processActions(
    address _from,
    uint256 playerId
  )
    internal
    returns (QueuedAction[] memory remainingQueuedActions, PendingQueuedActionData memory currentActionProcessed)
  {
    bytes memory data = _delegatecall(
      implProcessActions,
      abi.encodeWithSelector(IPlayersProcessActionsDelegate.processActions.selector, _from, playerId)
    );
    return abi.decode(data, (QueuedAction[], PendingQueuedActionData));
  }

  // Staticcall into ourselves and hit the fallback. This is done so that pendingQueuedActionState/dailyClaimedRewards can be exposed on the json abi.
  function _pendingQueuedActionState(
    address _owner,
    uint256 playerId
  ) internal view returns (PendingQueuedActionState memory) {
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(IPlayersRewardsDelegateView.pendingQueuedActionStateImpl.selector, _owner, playerId)
    );
    return abi.decode(data, (PendingQueuedActionState));
  }

  function _donate(address _from, uint256 playerId, uint256 _amount) internal {
    _delegatecall(
      implProcessActions,
      abi.encodeWithSelector(IPlayersProcessActionsDelegate.donate.selector, _from, playerId, _amount)
    );
  }

  function _claimableXPThresholdRewards(
    uint256 _oldTotalXP,
    uint256 _newTotalXP
  ) internal view returns (uint256[] memory ids, uint256[] memory amounts) {
    // Call self
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(
        IPlayersMiscDelegateView.claimableXPThresholdRewardsImpl.selector,
        _oldTotalXP,
        _newTotalXP
      )
    );
    return abi.decode(data, (uint256[], uint256[]));
  }

  function _checkStartSlot() internal pure {
    uint256 expectedStartSlotNumber = 251; // From the various slot arrays expected in the base classes
    uint256 slot;
    assembly ("memory-safe") {
      slot := _startSlot.slot
    }
    if (slot != expectedStartSlotNumber) {
      revert InvalidStartSlot();
    }
  }

  function _setPrevPlayerState(
    Player storage _player,
    PendingQueuedActionData memory _currentActionProcessed
  ) internal {
    _player.currentActionProcessedSkill1 = _currentActionProcessed.skill1;
    _player.currentActionProcessedXPGained1 = _currentActionProcessed.xpGained1;
    _player.currentActionProcessedSkill2 = _currentActionProcessed.skill2;
    _player.currentActionProcessedXPGained2 = _currentActionProcessed.xpGained2;
    _player.currentActionProcessedSkill3 = _currentActionProcessed.skill3;
    _player.currentActionProcessedXPGained3 = _currentActionProcessed.xpGained3;
    _player.currentActionProcessedFoodConsumed = _currentActionProcessed.foodConsumed;
    _player.currentActionProcessedBaseInputItemsConsumedNum = _currentActionProcessed.baseInputItemsConsumedNum;
  }

  function _processClaimableRewards(
    address _from,
    uint256 playerId,
    uint256[] memory itemTokenIds,
    uint256[] memory amounts,
    uint256[] memory queueIds,
    uint256 numPastRandomRewardInstancesToRemove
  ) internal {
    if (numPastRandomRewardInstancesToRemove != 0) {
      if (numPastRandomRewardInstancesToRemove == pendingRandomRewards[playerId].length) {
        delete pendingRandomRewards[playerId];
      } else {
        // Shift the remaining rewards to the front of the array
        U256 bounds = pendingRandomRewards[playerId].length.asU256().sub(numPastRandomRewardInstancesToRemove);
        for (U256 iter; iter < bounds; iter = iter.inc()) {
          uint256 i = iter.asUint256();
          pendingRandomRewards[playerId][i] = pendingRandomRewards[playerId][i + numPastRandomRewardInstancesToRemove];
        }
        for (U256 iter = numPastRandomRewardInstancesToRemove.asU256(); iter.neq(0); iter = iter.dec()) {
          pendingRandomRewards[playerId].pop();
        }
      }
    }
    if (itemTokenIds.length != 0) {
      itemNFT.mintBatch(_from, itemTokenIds, amounts);
    }

    if (numPastRandomRewardInstancesToRemove != 0 || itemTokenIds.length != 0) {
      // So this event can also be called when no dice rolls are used if the action (e.g thieving)
      // finished before 00:00 UTC and is called after the oracle is called
      emit PendingRandomRewardsClaimed(
        _from,
        playerId,
        numPastRandomRewardInstancesToRemove,
        itemTokenIds,
        amounts,
        queueIds
      );
    }
  }

  function _clearPlayerMainBoost(uint256 playerId) internal {
    PlayerBoostInfo storage playerBoost = activeBoosts_[playerId];
    delete playerBoost.value;
    delete playerBoost.startTime;
    delete playerBoost.duration;
    delete playerBoost.value;
    delete playerBoost.itemTokenId;
    delete playerBoost.boostType;
    emit BoostFinished(playerId);
  }

  function _hasPet(bytes1 _packed) internal pure returns (bool) {
    return uint8(_packed >> HAS_PET_BIT) & 1 == 1;
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
