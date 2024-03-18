// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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
import "../interfaces/IPlayersDelegates.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

abstract contract PlayersBase {
  using UnsafeMath for U256;
  using UnsafeMath for uint256;

  event ClearAll(address from, uint playerId);
  event AddXP(address from, uint playerId, Skill skill, uint points);
  event SetActionQueue(address from, uint playerId, QueuedAction[] queuedActions, Attire[] attire, uint startTime);
  event ConsumeBoostVial(address from, uint playerId, BoostInfo playerBoostInfo);
  event ConsumeExtraBoostVial(address from, uint playerId, BoostInfo playerBoostInfo);
  event ConsumeGlobalBoostVial(address from, uint playerId, BoostInfo globalBoost);
  event ConsumeClanBoostVial(address from, uint playerId, uint clanId, BoostInfo clanBoost);
  event SetActivePlayer(address account, uint oldPlayerId, uint newPlayerId);
  event AddPendingRandomReward(address from, uint playerId, uint queueId, uint startTime, uint elapsed);
  event AddPendingRandomRewardV2(address from, uint playerId, uint queueId, uint startTime, uint elapsed, uint rolls);
  event PendingRandomRewardsClaimed(
    address from,
    uint playerId,
    uint numRemoved,
    uint[] itemTokenIds,
    uint[] amounts,
    uint[] queueIds
  );
  event AdminAddThresholdReward(XPThresholdReward xpThresholdReward);
  event AdminEditThresholdReward(XPThresholdReward xpThresholdReward);

  event BoostFinished(uint playerId);
  event ExtraBoostFinished(uint playerId);

  // For logging
  event Died(address from, uint playerId, uint queueId);
  event QuestRewardConsumes(
    address from,
    uint playerId,
    uint[] rewardItemTokenIds,
    uint[] rewardAmounts,
    uint[] consumedItemTokenIds,
    uint[] consumedAmounts
  );
  event Rewards(address from, uint playerId, uint queueId, uint[] itemTokenIds, uint[] amounts);
  event DailyReward(address from, uint playerId, uint itemTokenId, uint amount);
  event WeeklyReward(address from, uint playerId, uint itemTokenId, uint amount);
  event Consumes(address from, uint playerId, uint queueId, uint[] itemTokenIds, uint[] amounts);
  event ActionFinished(address from, uint playerId, uint queueId);
  event ActionPartiallyFinished(address from, uint playerId, uint queueId, uint elapsedTime);
  event ActionAborted(address from, uint playerId, uint queueId);
  event ClaimedXPThresholdRewards(address from, uint playerId, uint[] itemTokenIds, uint[] amounts);
  event LevelUp(address from, uint playerId, Skill skill, uint32 oldLevel, uint32 newLevel);
  event AddFullAttireBonus(Skill skill, uint16[5] itemTokenIds, uint8 bonusXPPercent, uint8 bonusRewardsPercent);

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
  error SecondSkillNotHandledYet();

  uint32 internal constant MAX_TIME_ = 1 days;
  uint internal constant START_XP_ = 374;
  // 90%, used for actions/actionChoices which can have a failure rate like thieving/cooking
  uint internal constant MAX_SUCCESS_PERCENT_CHANCE_ = 90;
  uint internal constant MAX_UNIQUE_TICKETS_ = 64;
  // The random chance where the odds are increased when there are dice roll overflows.
  // Don't set this above 1747 otherwise it can result in 100% chance for anything around that value
  uint internal constant RANDOM_REWARD_CHANCE_MULTIPLIER_CUTOFF_ = 1328;
  uint internal constant MAX_LEVEL = 100; // Original max level
  uint internal constant MAX_LEVEL_1 = 500; // TODO: Update later

  // *IMPORTANT* keep as the first non-constant state variable
  uint internal startSlot;

  mapping(address user => uint playerId) internal activePlayer_;

  mapping(uint playerId => PlayerBoostInfo boostInfo) internal activeBoosts_;

  World internal world;
  // Constants for the damage formula
  uint8 internal alphaCombat;
  uint8 internal betaCombat;
  uint64 internal nextQueueId; // Global queued action id
  bool internal dailyRewardsEnabled;
  bool internal isBeta;

  mapping(uint playerId => PackedXP packedXP) internal xp_;

  mapping(uint playerId => Player player) internal players_;
  mapping(uint playerId => mapping(uint queuedId => Attire attire)) internal attire_;
  ItemNFT internal itemNFT;
  PlayerNFT internal playerNFT;
  bool internal gamePaused;
  mapping(uint playerId => PendingRandomReward[] pendingRandomRewards) internal pendingRandomRewards; // queue, will be sorted by timestamp

  // First 7 bytes are whether that day has been claimed (Can be extended to 30 days), the last 2 bytes is the current checkpoint number (whether it needs clearing)
  mapping(uint playerId => bytes32) internal dailyRewardMasks;

  mapping(uint xp => Equipment[] equipments) internal xpRewardThresholds; // Thresholds and all items rewarded for it

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
  mapping(uint clanId => PlayerBoostInfo clanBoost) internal clanBoosts_; // Clan specific boosts

  mapping(address user => WalletDailyInfo walletDailyInfo) internal walletDailyInfo;

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

    if (_choice.skill != Skill.NONE) {
      skill = _choice.skill;
    } else {
      skill = world.getSkill(_actionId);
    }
  }

  function _isCombatStyle(CombatStyle _combatStyle) internal pure returns (bool) {
    return _combatStyle != CombatStyle.NONE;
  }

  function _isPlayerFullMode(uint _playerId) internal view returns (bool) {
    return uint8(players_[_playerId].packedData >> IS_FULL_MODE_BIT) & 1 == 1;
  }

  function _getElapsedTime(uint _startTime, uint _endTime) internal view returns (uint elapsedTime) {
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
    uint _playerId,
    QueuedAction[] memory _queuedActions,
    Attire[] memory _attire,
    uint _startTime
  ) internal {
    Player storage player = players_[_playerId];

    // If ids are the same as existing, then just change the first one. Optimization when just claiming loot
    bool sameQueueIds = true;
    if (player.actionQueue.length == _queuedActions.length) {
      for (uint i = 0; i < _queuedActions.length; ++i) {
        if (player.actionQueue[i].queueId != _queuedActions[i].queueId) {
          sameQueueIds = false;
          break;
        }
      }
    }

    if (sameQueueIds && player.actionQueue.length == _queuedActions.length && _queuedActions.length != 0) {
      player.actionQueue[0] = _queuedActions[0];
    } else {
      // Replace everything
      player.actionQueue = _queuedActions;
      for (uint i; i < _attire.length; ++i) {
        attire_[_playerId][player.actionQueue[i].queueId] = _attire[i];
      }
    }
    emit SetActionQueue(_from, _playerId, _queuedActions, _attire, _startTime);
  }

  // This does not update player.totalXP!!
  function _updateXP(address _from, uint _playerId, Skill _skill, uint128 _pointsAccrued) internal {
    PackedXP storage packedXP = xp_[_playerId];
    uint oldPoints = PlayersLibrary.readXP(_skill, packedXP);
    uint newPoints = oldPoints.add(_pointsAccrued);

    if (newPoints > type(uint32).max) {
      newPoints = type(uint32).max;
      _pointsAccrued = uint32(newPoints - oldPoints);
    }
    if (_pointsAccrued == 0) {
      return;
    }
    uint offset = 2; // Accounts for NONE & COMBAT skills
    uint skillOffsetted = uint8(_skill) - offset;
    uint slotNum = skillOffsetted / 6;
    uint relativePos = skillOffsetted % 6;

    // packedDataIsMaxedBitStart is the starting bit index for packedDataIsMaxed within the 256-bit storage slot
    uint packedDataIsMaxedBitStart = 240;
    uint bitsPerSkill = 2; // Two bits to store the max level version for each skill
    uint actualBitIndex = packedDataIsMaxedBitStart + relativePos * bitsPerSkill;

    uint16 newLevel = PlayersLibrary.getLevel(newPoints);

    // Determine the new max level version for this skill based on newLevel
    uint newMaxLevelVersion;
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

    emit AddXP(_from, _playerId, _skill, _pointsAccrued);

    uint16 oldLevel = PlayersLibrary.getLevel(oldPoints);
    // Update the player's level
    if (newLevel > oldLevel) {
      emit LevelUp(_from, _playerId, _skill, oldLevel, newLevel);
    }
  }

  function _processActions(
    address _from,
    uint _playerId
  )
    internal
    returns (QueuedAction[] memory remainingQueuedActions, PendingQueuedActionData memory currentActionProcessed)
  {
    bytes memory data = _delegatecall(
      implProcessActions,
      abi.encodeWithSelector(IPlayersProcessActionsDelegate.processActions.selector, _from, _playerId)
    );
    return abi.decode(data, (QueuedAction[], PendingQueuedActionData));
  }

  // Staticcall into ourselves and hit the fallback. This is done so that pendingQueuedActionState/dailyClaimedRewards can be exposed on the json abi.
  function _pendingQueuedActionState(
    address _owner,
    uint _playerId
  ) internal view returns (PendingQueuedActionState memory) {
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(IPlayersRewardsDelegateView.pendingQueuedActionStateImpl.selector, _owner, _playerId)
    );
    return abi.decode(data, (PendingQueuedActionState));
  }

  function _donate(address _from, uint _playerId, uint _amount) internal {
    _delegatecall(
      implProcessActions,
      abi.encodeWithSelector(IPlayersProcessActionsDelegate.donate.selector, _from, _playerId, _amount)
    );
  }

  function _claimableXPThresholdRewards(
    uint _oldTotalXP,
    uint _newTotalXP
  ) internal view returns (uint[] memory ids, uint[] memory amounts) {
    // Call self
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(
        IPlayersMiscDelegateView.claimableXPThresholdRewardsImpl.selector,
        _oldTotalXP,
        _newTotalXP
      )
    );
    return abi.decode(data, (uint[], uint[]));
  }

  function _checkStartSlot() internal pure {
    uint expectedStartSlotNumber = 251; // From the various slot arrays expected in the base classes
    uint slot;
    assembly ("memory-safe") {
      slot := startSlot.slot
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
    uint _playerId,
    uint[] memory itemTokenIds,
    uint[] memory amounts,
    uint[] memory queueIds,
    uint numPastRandomRewardInstancesToRemove
  ) internal {
    if (numPastRandomRewardInstancesToRemove != 0) {
      if (numPastRandomRewardInstancesToRemove == pendingRandomRewards[_playerId].length) {
        delete pendingRandomRewards[_playerId];
      } else {
        // Shift the remaining rewards to the front of the array
        U256 bounds = pendingRandomRewards[_playerId].length.asU256().sub(numPastRandomRewardInstancesToRemove);
        for (U256 iter; iter < bounds; iter = iter.inc()) {
          uint i = iter.asUint256();
          pendingRandomRewards[_playerId][i] = pendingRandomRewards[_playerId][
            i + numPastRandomRewardInstancesToRemove
          ];
        }
        for (U256 iter = numPastRandomRewardInstancesToRemove.asU256(); iter.neq(0); iter = iter.dec()) {
          pendingRandomRewards[_playerId].pop();
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
        _playerId,
        numPastRandomRewardInstancesToRemove,
        itemTokenIds,
        amounts,
        queueIds
      );
    }
  }

  function _clearPlayerMainBoost(uint _playerId) internal {
    PlayerBoostInfo storage playerBoost = activeBoosts_[_playerId];
    delete playerBoost.value;
    delete playerBoost.startTime;
    delete playerBoost.duration;
    delete playerBoost.value;
    delete playerBoost.itemTokenId;
    delete playerBoost.boostType;
    emit BoostFinished(_playerId);
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
