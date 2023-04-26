// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";
import {World} from "../World.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {PlayerNFT} from "../PlayerNFT.sol";
import {AdminAccess} from "../AdminAccess.sol";
import {Quests} from "../Quests.sol";
import {Clans} from "../Clans/Clans.sol";
import {PlayersLibrary} from "./PlayersLibrary.sol";

/* solhint-disable no-global-import */
import "../globals/actions.sol";
import "../globals/players.sol";
import "../globals/items.sol";
import "../globals/rewards.sol";

/* solhint-enable no-global-import */

abstract contract PlayersBase {
  using UnsafeMath for U256;
  using UnsafeMath for uint256;

  event ClearAll(address from, uint playerId);
  event AddXP(address from, uint playerId, Skill skill, uint32 points);
  event SetActionQueue(address from, uint playerId, QueuedAction[] queuedActions, uint startTime);
  event ConsumeBoostVial(address from, uint playerId, PlayerBoostInfo playerBoostInfo);
  event UnconsumeBoostVial(address from, uint playerId);
  event SetActivePlayer(address account, uint oldPlayerId, uint newPlayerId);
  event AddPendingRandomReward(address from, uint playerId, uint queueId, uint startTime, uint elapsed);
  event PendingRandomRewardsClaimed(
    address from,
    uint playerId,
    uint numRemoved,
    uint[] itemTokenIds,
    uint[] amounts,
    uint[] queueIds
  );
  event AdminAddThresholdReward(XPThresholdReward xpThresholdReward);

  event BoostFinished(uint playerId);

  // For logging
  event Died(address from, uint playerId, uint queueId);
  event QuestRewards(address from, uint playerId, uint[] itemTokenIds, uint[] amounts);
  event QuestConsumes(address from, uint playerId, uint[] itemTokenIds, uint[] amounts);
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
  error DoNotHaveEnoughQuantityToEquipToAction();
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
  error ActionChoiceIdRequired();
  error InvalidEquipPosition();
  error NoActionsToProcess();
  error NotAdminAndAlpha();
  error XPThresholdNotFound();
  error InvalidItemTokenId();
  error ItemDoesNotExist();
  error InvalidAmount();
  error InvalidAction();
  error PlayerAlreadyActive();
  error TestInvalidXP();

  uint32 internal constant MAX_TIME_ = 1 days;
  uint internal constant START_XP_ = 374;
  // 90%, used for actions/actionChoices which can have a failure rate like thieving/cooking
  uint internal constant MAX_SUCCESS_PERCENT_CHANCE_ = 90;
  uint internal constant MAX_UNIQUE_TICKETS_ = 240;

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
  bool internal isAlpha;

  mapping(uint playerId => mapping(Skill skill => uint128 xp)) internal xp_;

  mapping(uint playerId => Player player) internal players_;
  mapping(uint playerId => mapping(uint queuedId => Attire attire)) internal attire_;
  ItemNFT internal itemNFT;
  PlayerNFT internal playerNFT;
  mapping(uint playerId => PendingRandomReward[] pendingRandomRewards) internal pendingRandomRewards; // queue, will be sorted by timestamp

  // First 7 bytes are whether that day has been claimed (Can be extended to 30 days), the last 2 bytes is the current checkpoint number (whether it needs clearing)
  mapping(uint playerId => bytes32) internal dailyRewardMasks;

  mapping(uint xp => Equipment[] equipments) internal xpRewardThresholds; // Thresholds and all items rewarded for it

  address internal implQueueActions;
  address internal implProcessActions;
  address internal implRewards;
  address internal implMisc;
  address internal reserved1;

  AdminAccess internal adminAccess;

  mapping(Skill skill => FullAttireBonus) internal fullAttireBonus;
  Quests internal quests;
  Clans internal clans;

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

  modifier isAdminAndAlpha() {
    if (!(adminAccess.isAdmin(msg.sender) && isAlpha)) {
      revert NotAdminAndAlpha();
    }
    _;
  }

  // Staticcall into ourselves and hit the fallback. This is done so that pendingQueuedActionState/dailyClaimedRewards can be exposed on the json abi.
  function pendingQueuedActionState(
    address _owner,
    uint _playerId
  ) public view returns (PendingQueuedActionState memory) {
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(IPlayersRewardsDelegateView.pendingQueuedActionStateImpl.selector, _owner, _playerId)
    );
    return abi.decode(data, (PendingQueuedActionState));
  }

  function dailyRewardsView(
    uint _playerId
  ) public view returns (uint[] memory itemTokenIds, uint[] memory amounts, bytes32 dailyRewardMask) {
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(IPlayersMiscDelegateView.dailyRewardsViewImpl.selector, _playerId)
    );
    return abi.decode(data, (uint[], uint[], bytes32));
  }

  function _extraXPFromBoost(
    uint _playerId,
    bool _isCombatSkill,
    uint _actionStartTime,
    uint _elapsedTime,
    uint24 _xpPerHour
  ) internal view returns (uint32 boostPointsAccrued) {
    return
      PlayersLibrary.extraXPFromBoost(
        _isCombatSkill,
        _actionStartTime,
        _elapsedTime,
        _xpPerHour,
        activeBoosts_[_playerId]
      );
  }

  function _extraXPFromFullAttire(
    address _from,
    Attire storage _attire,
    Skill _skill,
    uint _elapsedTime,
    uint24 _xpPerHour,
    PendingQueuedActionEquipmentState[] memory _pendingQueuedActionEquipmentStates
  ) internal view returns (uint32 extraPointsAccrued) {
    uint8 bonusPercent = fullAttireBonus[_skill].bonusXPPercent;
    if (bonusPercent == 0) {
      return 0;
    }

    // Check if they have the full equipment set, if so they can get some bonus
    bool skipNeck = true;
    (uint16[] memory itemTokenIds, uint[] memory balances) = _getAttireWithBalance(
      _from,
      _attire,
      skipNeck,
      _pendingQueuedActionEquipmentStates
    );
    bool hasFullAttire = PlayersLibrary.extraBoostFromFullAttire(
      itemTokenIds,
      balances,
      fullAttireBonus[_skill].itemTokenIds
    );
    if (hasFullAttire) {
      extraPointsAccrued = uint32((_elapsedTime * _xpPerHour * bonusPercent) / (3600 * 100));
    }
  }

  function _getHealthPointsFromCombat(
    uint _playerId,
    uint _combatPoints
  ) internal view returns (uint32 healthPointsAccured) {
    // Get 1/3 of the combat points as health
    healthPointsAccured = uint32(_combatPoints / 3);
    // Get bonus health points from avatar starting skills
    uint bonusPercent = _getBonusAvatarXPPercent(_playerId, Skill.HEALTH);
    healthPointsAccured += uint32((_combatPoints * bonusPercent) / (3600 * 100));
  }

  function _getBonusAvatarXPPercent(uint _playerId, Skill _skill) internal view returns (uint8 bonusPercent) {
    bool hasBonusSkill = players_[_playerId].skillBoosted1 == _skill || players_[_playerId].skillBoosted2 == _skill;
    if (!hasBonusSkill) {
      return 0;
    }
    bool bothSet = players_[_playerId].skillBoosted1 != Skill.NONE && players_[_playerId].skillBoosted2 != Skill.NONE;
    bonusPercent = bothSet ? 5 : 10;
  }

  function _extraFromAvatar(
    uint _playerId,
    Skill _skill,
    uint _elapsedTime,
    uint24 _xpPerHour
  ) internal view returns (uint32 extraPointsAccrued) {
    uint8 bonusPercent = _getBonusAvatarXPPercent(_playerId, _skill);
    extraPointsAccrued = uint32((_elapsedTime * _xpPerHour * bonusPercent) / (3600 * 100));
  }

  function _getPointsAccrued(
    address _from,
    uint _playerId,
    QueuedAction storage _queuedAction,
    uint _startTime,
    Skill _skill,
    uint _xpElapsedTime,
    PendingQueuedActionEquipmentState[] memory _pendingQueuedActionEquipmentStates
  ) internal view returns (uint32 pointsAccrued, uint32 pointsAccruedExclBaseBoost) {
    bool _isCombatSkill = _isCombatStyle(_queuedAction.combatStyle);
    uint24 xpPerHour = world.getXPPerHour(_queuedAction.actionId, _isCombatSkill ? NONE : _queuedAction.choiceId);
    pointsAccrued = uint32((_xpElapsedTime * xpPerHour) / 3600);
    pointsAccrued += _extraXPFromBoost(_playerId, _isCombatSkill, _startTime, _xpElapsedTime, xpPerHour);
    pointsAccrued += _extraXPFromFullAttire(
      _from,
      attire_[_playerId][_queuedAction.queueId],
      _skill,
      _xpElapsedTime,
      xpPerHour,
      _pendingQueuedActionEquipmentStates
    );
    pointsAccruedExclBaseBoost = pointsAccrued;
    pointsAccrued += _extraFromAvatar(_playerId, _skill, _xpElapsedTime, xpPerHour);
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

  function _updateStatsFromHandEquipment(
    address _from,
    uint16[2] memory _handEquipmentTokenIds,
    CombatStats memory _combatStats,
    bool _isCombat,
    PendingQueuedActionEquipmentState[] memory _pendingQueuedActionEquipmentStates
  ) internal view returns (bool missingRequiredHandEquipment) {
    U256 iter = _handEquipmentTokenIds.length.asU256();
    while (iter.neq(0)) {
      iter = iter.dec();
      uint16 i = iter.asUint16();
      uint16 handEquipmentTokenId = _handEquipmentTokenIds[i];
      if (handEquipmentTokenId != NONE) {
        uint256 balance = PlayersLibrary.getRealBalance(
          _from,
          handEquipmentTokenId,
          itemNFT,
          _pendingQueuedActionEquipmentStates
        );
        if (balance == 0) {
          // Assume that if the player doesn't have the non-combat item that this action cannot be done
          if (!_isCombat) {
            missingRequiredHandEquipment = true;
          }
        } else if (_isCombat) {
          // Update the combat stats
          Item memory item = itemNFT.getItem(handEquipmentTokenId);
          _updateCombatStatsFromItem(_combatStats, item);
        }
      }
    }
  }

  function _isCombatStyle(CombatStyle _combatStyle) internal pure returns (bool) {
    return _combatStyle != CombatStyle.NONE;
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

  function _getAttireWithBalance(
    address _from,
    Attire storage _attire,
    bool _skipNeck,
    PendingQueuedActionEquipmentState[] memory _pendingQueuedActionEquipmentStates
  ) internal view returns (uint16[] memory itemTokenIds, uint[] memory balances) {
    uint attireLength;
    itemTokenIds = new uint16[](8);
    if (_attire.head != NONE) {
      itemTokenIds[attireLength++] = _attire.head;
    }
    if (_attire.neck != NONE && !_skipNeck) {
      itemTokenIds[attireLength++] = _attire.neck;
    }
    if (_attire.body != NONE) {
      itemTokenIds[attireLength++] = _attire.body;
    }
    if (_attire.arms != NONE) {
      itemTokenIds[attireLength++] = _attire.arms;
    }
    if (_attire.legs != NONE) {
      itemTokenIds[attireLength++] = _attire.legs;
    }
    if (_attire.feet != NONE) {
      itemTokenIds[attireLength++] = _attire.feet;
    }

    assembly ("memory-safe") {
      mstore(itemTokenIds, attireLength)
    }

    if (attireLength != 0) {
      balances = PlayersLibrary.getRealBalances(_from, itemTokenIds, itemNFT, _pendingQueuedActionEquipmentStates);
    }
  }

  function _updateCombatStats(
    address _from,
    CombatStats memory _stats,
    Attire storage _attire,
    PendingQueuedActionEquipmentState[] memory _pendingQueuedActionEquipmentStates
  ) internal view {
    bool skipNeck;
    (uint16[] memory itemTokenIds, uint[] memory balances) = _getAttireWithBalance(
      _from,
      _attire,
      skipNeck,
      _pendingQueuedActionEquipmentStates
    );
    if (itemTokenIds.length != 0) {
      Item[] memory items = itemNFT.getItems(itemTokenIds);
      U256 iter = items.length.asU256();
      while (iter.neq(0)) {
        iter = iter.dec();
        uint i = iter.asUint256();
        if (balances[i] != 0) {
          _updateCombatStatsFromItem(_stats, items[i]);
        }
      }
    }
  }

  function _updateCombatStatsFromItem(CombatStats memory _combatStats, Item memory _item) private pure {
    if (_item.melee != 0) {
      _combatStats.melee += _item.melee;
    }
    if (_item.magic != 0) {
      _combatStats.magic += _item.magic;
    }
    if (_item.meleeDefence != 0) {
      _combatStats.meleeDefence += _item.meleeDefence;
    }
    if (_item.magicDefence != 0) {
      _combatStats.magicDefence += _item.magicDefence;
    }
    if (_item.health != 0) {
      _combatStats.health += _item.health;
    }
  }

  function _setActionQueue(
    address _from,
    uint _playerId,
    QueuedAction[] memory _queuedActions,
    uint _startTime
  ) internal {
    Player storage player = players_[_playerId];

    // If ids are the same as existing, then just change the first one. Optimization when just claiming loot
    bool same = true;
    if (player.actionQueue.length == _queuedActions.length) {
      for (uint i = 0; i < _queuedActions.length; ++i) {
        if (player.actionQueue[i].queueId != _queuedActions[i].queueId) {
          same = false;
          break;
        }
      }
    }

    if (same && player.actionQueue.length == _queuedActions.length && _queuedActions.length > 0) {
      player.actionQueue[0] = _queuedActions[0];
    } else {
      // Replace everything
      player.actionQueue = _queuedActions;
    }
    emit SetActionQueue(_from, _playerId, _queuedActions, _startTime);
  }

  function _updateXP(address _from, uint _playerId, Skill _skill, uint128 _pointsAccrued) internal {
    uint oldPoints = xp_[_playerId][_skill];
    uint newPoints = oldPoints.add(_pointsAccrued);
    if (newPoints > type(uint32).max) {
      newPoints = type(uint32).max;
    }
    xp_[_playerId][_skill] = uint32(newPoints);
    emit AddXP(_from, _playerId, _skill, uint32(newPoints));

    uint16 oldLevel = PlayersLibrary.getLevel(oldPoints);
    uint16 newLevel = PlayersLibrary.getLevel(newPoints);
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
    returns (QueuedAction[] memory remainingSkills, PendingQueuedActionXPGained memory pendingQueuedActionXPGained)
  {
    bytes memory data = _delegatecall(
      implProcessActions,
      abi.encodeWithSelector(IPlayersProcessActionsDelegate.processActions.selector, _from, _playerId)
    );
    return abi.decode(data, (QueuedAction[], PendingQueuedActionXPGained));
  }

  function _claimRandomRewards(
    uint _playerId,
    PendingQueuedActionXPGained memory _pendingQueuedActionXPGained
  ) internal {
    _delegatecall(
      implRewards,
      abi.encodeWithSelector(
        IPlayersRewardsDelegate.claimRandomRewards.selector,
        _playerId,
        _pendingQueuedActionXPGained
      )
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
