// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "../World.sol";
import "../types.sol";
import "../items.sol";
import "../ItemNFT.sol";
import "../PlayerNFT.sol";

import {PlayerLibrary} from "./PlayerLibrary.sol";

abstract contract PlayersBase {
  event ClearAll(uint playerId);

  event AddSkillPoints(uint playerId, Skill skill, uint32 points);

  event SetActionQueue(uint playerId, QueuedAction[] queuedActions);

  event ConsumeBoostVial(uint playerId, PlayerBoostInfo playerBoostInfo);

  event UnconsumeBoostVial(uint playerId);

  event SetActivePlayer(address account, uint oldPlayerId, uint newPlayerId);

  event AddPendingRandomReward(uint playerId, uint timestamp, uint elapsed);

  event AdminAddThresholdReward(XPThresholdReward xpThresholdReward);

  // For logging
  event Died(address from, uint playerId, uint128 queueId);
  event Rewards(address from, uint playerId, uint128 queueId, uint[] itemTokenIds, uint[] amounts);
  event Reward(address from, uint playerId, uint128 queueId, uint16 itemTokenId, uint amount);
  event Consume(address from, uint playerId, uint128 queueId, uint16 itemTokenId, uint amount);
  event ActionFinished(address from, uint playerId, uint128 queueId);
  event ActionPartiallyFinished(address from, uint playerId, uint128 queueId, uint elapsedTime);
  event ActionAborted(uint playerId, uint128 queueId);
  event XPThresholdRewards(uint[] itemTokenIds, uint[] amounts);
  event LevelUp(uint playerId, Skill skill, uint32 level);

  error SkillsArrayZero();
  error NotOwner();
  error NotActive();
  error EquipSameItem();
  error NotEquipped();
  error ArgumentLengthMismatch();
  error NotPlayerNFT();
  error NotItemNFT();
  error ActionNotAvailable();
  error UnsupportedAttire();
  error InvalidArmEquipment(uint16 itemTokenId);
  error DoNotHaveEnoughQuantityToEquipToAction();
  error NoActiveBoost();
  error BoostTimeAlreadyStarted();
  error TooManyActionsQueued();
  error TooManyActionsQueuedSomeAlreadyExist();
  error ActionTimespanExceedsMaxTime();
  error ActionTimespanZero();
  error MinimumSkillPointsNotReached();

  uint32 public constant MAX_TIME = 1 days;

  uint constant MAX_MAIN_EQUIPMENT_ID = 65536 * 8;

  uint internal startSlot; // Keep as the first non-constant state variable

  mapping(uint playerId => uint multiplier) internal speedMultiplier; // 0 or 1 is diabled, for testing only

  mapping(address user => uint playerId) internal activePlayer;

  mapping(uint playerId => PlayerBoostInfo boostInfo) public activeBoosts;

  uint64 internal latestQueueId; // Global queued action id
  World internal world;

  mapping(uint playerId => mapping(Skill skill => uint32 skillPoint)) public skillPoints;

  mapping(uint playerId => Player player) public players;
  ItemNFT internal itemNFT;
  PlayerNFT internal playerNFT;
  mapping(uint playerId => PendingRandomReward[] pendingRandomRewards) internal pendingRandomRewards; // queue, will be sorted by timestamp

  // Constants for the damage formula
  uint128 alphaCombat;
  uint128 betaCombat;

  // 4 bytes for each threshold, starts at 500 xp in decimal
  bytes constant xpRewardBytes =
    hex"00000000000001F4000003E8000009C40000138800002710000075300000C350000186A00001D4C0000493E0000557300007A120000927C0000B71B0";
  mapping(uint xp => Equipment[] equipments) xpRewardThresholds; // Thresholds and all items rewarded for it

  address implQueueActions;
  address implProcessActions;
  address implRewards;
  address reserved1;

  modifier isOwnerOfPlayer(uint playerId) {
    if (playerNFT.balanceOf(msg.sender, playerId) != 1) {
      revert NotOwner();
    }
    _;
  }

  modifier isOwnerOfPlayerAndActive(uint _playerId) {
    if (playerNFT.balanceOf(msg.sender, _playerId) != 1) {
      revert NotOwner();
    }
    if (activePlayer[msg.sender] != _playerId) {
      revert NotActive();
    }
    _;
  }

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

  function _extraXPFromBoost(
    uint _playerId,
    bool _isCombatSkill,
    uint _actionStartTime,
    uint _elapsedTime,
    uint16 _xpPerHour
  ) internal view returns (uint32 boostPointsAccrued) {
    return
      PlayerLibrary.extraXPFromBoost(
        _isCombatSkill,
        _actionStartTime,
        _elapsedTime,
        _xpPerHour,
        activeBoosts[_playerId]
      );
  }

  function _extraXPFromFullEquipment(
    address _from,
    Attire storage _attire,
    Skill _skill,
    uint _elapsedTime,
    uint16 _xpPerHour
  ) internal view returns (uint32 extraPointsAccrued) {
    if (_skill == Skill.THIEVING || _skill == Skill.CRAFTING || _skill == Skill.WOODCUTTING) {
      // Check if they have the full equipment set, if so they can get some bonus
      bool skipNeck = true;
      (uint16[] memory itemTokenIds, uint[] memory balances) = _getAttireWithBalance(_from, _attire, skipNeck);
      uint extraBoost = PlayerLibrary.extraBoostFromFullEquipment(_skill, itemTokenIds, balances);

      if (extraBoost > 0) {
        extraPointsAccrued = uint32((_elapsedTime * _xpPerHour * extraBoost) / (3600 * 100));
      }
    }
  }

  function _getPointsAccrued(
    address _from,
    uint _playerId,
    QueuedAction storage _queuedAction,
    Skill _skill,
    uint _xpElapsedTime
  ) internal view returns (uint32 pointsAccrued) {
    bool _isCombatSkill = _isCombatStyle(_queuedAction.combatStyle);
    uint16 xpPerHour = world.getXPPerHour(_queuedAction.actionId, _isCombatSkill ? NONE : _queuedAction.choiceId);
    pointsAccrued = uint32((_xpElapsedTime * xpPerHour) / 3600);
    pointsAccrued += _extraXPFromBoost(_playerId, _isCombatSkill, _queuedAction.startTime, _xpElapsedTime, xpPerHour);
    pointsAccrued += _extraXPFromFullEquipment(_from, _queuedAction.attire, _skill, _xpElapsedTime, xpPerHour);
  }

  function _updateStatsFromHandEquipment(
    address _from,
    uint16[2] memory _handEquipmentTokenIds,
    CombatStats memory _combatStats,
    bool _isCombat
  ) internal view returns (bool missingRequiredHandEquipment) {
    uint i;
    while (i < _handEquipmentTokenIds.length) {
      uint16 handEquipmentTokenId = _handEquipmentTokenIds[i];
      if (handEquipmentTokenId != NONE) {
        uint256 balance = itemNFT.balanceOf(_from, handEquipmentTokenId);
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
      unchecked {
        ++i;
      }
    }
  }

  function _isCombatStyle(CombatStyle _combatStyle) internal pure returns (bool) {
    return _combatStyle != CombatStyle.NONE;
  }

  function _getElapsedTime(
    uint _playerId,
    uint _skillEndTime,
    QueuedAction storage _queuedAction
  ) internal view returns (uint elapsedTime) {
    uint _speedMultiplier = speedMultiplier[_playerId];
    bool consumeAll = _skillEndTime <= block.timestamp;

    if (consumeAll) {
      // Fully consume this skill
      elapsedTime = _queuedAction.timespan;
    } else if (block.timestamp > _queuedAction.startTime) {
      // partially consume
      elapsedTime = block.timestamp - _queuedAction.startTime;
      uint modifiedElapsedTime = _speedMultiplier > 1 ? uint(elapsedTime) * _speedMultiplier : elapsedTime;
      // Up to timespan
      if (modifiedElapsedTime > _queuedAction.timespan) {
        elapsedTime = _queuedAction.timespan;
      }
    }
  }

  function _getAttireWithBalance(
    address _from,
    Attire storage _attire,
    bool _skipNeck
  ) internal view returns (uint16[] memory itemTokenIds, uint[] memory balances) {
    uint attireLength;
    itemTokenIds = new uint16[](8);
    if (_attire.helmet != NONE) {
      itemTokenIds[attireLength++] = _attire.helmet;
    }
    if (_attire.amulet != NONE && !_skipNeck) {
      itemTokenIds[attireLength++] = _attire.amulet;
    }
    if (_attire.armor != NONE) {
      itemTokenIds[attireLength++] = _attire.armor;
    }
    if (_attire.gauntlets != NONE) {
      itemTokenIds[attireLength++] = _attire.gauntlets;
    }
    if (_attire.tassets != NONE) {
      itemTokenIds[attireLength++] = _attire.tassets;
    }
    if (_attire.boots != NONE) {
      itemTokenIds[attireLength++] = _attire.boots;
    }

    assembly ("memory-safe") {
      mstore(itemTokenIds, attireLength)
    }

    if (attireLength > 0) {
      balances = itemNFT.balanceOfs(_from, itemTokenIds);
    }
  }

  function _updateCombatStats(address _from, CombatStats memory _stats, Attire storage _attire) internal view {
    bool skipNeck = false;
    (uint16[] memory itemTokenIds, uint[] memory balances) = _getAttireWithBalance(_from, _attire, skipNeck);
    if (itemTokenIds.length > 0) {
      Item[] memory items = itemNFT.getItems(itemTokenIds);
      uint i;
      while (i < items.length) {
        if (balances[i] > 0) {
          _updateCombatStatsFromItem(_stats, items[i]);
        }
        unchecked {
          ++i;
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
    if (_item.range != 0) {
      _combatStats.range += _item.range;
    }
    if (_item.meleeDefence != 0) {
      _combatStats.meleeDefence += _item.meleeDefence;
    }
    if (_item.magicDefence != 0) {
      _combatStats.magicDefence += _item.magicDefence;
    }
    if (_item.rangeDefence != 0) {
      _combatStats.rangeDefence += _item.rangeDefence;
    }
    if (_item.health != 0) {
      _combatStats.health += _item.health;
    }
  }

  function _getCachedCombatStats(Player storage _player) internal view returns (CombatStats memory combatStats) {
    combatStats.melee = _player.melee;
    combatStats.magic = _player.magic;
    //    combatStats.range = _player.range;
    combatStats.health = _player.health;
    combatStats.meleeDefence = _player.defence;
    combatStats.magicDefence = _player.defence;
    //    combatStats.rangeDefence = _player.defence;
  }

  function _processActions(address _from, uint _playerId) internal returns (QueuedAction[] memory remainingSkills) {
    (bool success, bytes memory data) = implProcessActions.delegatecall(
      abi.encodeWithSignature("processActions(address,uint256)", _from, _playerId)
    );
    require(success);
    return abi.decode(data, (QueuedAction[]));
  }

  // Index not level, add one after (check for > max)
  function _findBaseXPThreshold(uint256 _xp) internal pure returns (uint16) {
    uint256 low = 0;
    uint256 high = xpRewardBytes.length / 4;

    while (low < high) {
      uint256 mid = (low + high) / 2;

      // Note that mid will always be strictly less than high (i.e. it will be a valid array index)
      // Math.average rounds down (it does integer division with truncation).
      if (_getXPReward(mid) > _xp) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }

    if (low > 0) {
      return uint16(low - 1);
    } else {
      return 0;
    }
  }

  function _getXPReward(uint256 _index) internal pure returns (uint32) {
    uint256 index = _index * 4;
    return
      uint32(
        xpRewardBytes[index] |
          (bytes4(xpRewardBytes[index + 1]) >> 8) |
          (bytes4(xpRewardBytes[index + 2]) >> 16) |
          (bytes4(xpRewardBytes[index + 3]) >> 24)
      );
  }

  function _claimRandomRewards(uint _playerId) internal {
    (bool success, ) = implRewards.delegatecall(abi.encodeWithSignature("claimRandomRewards(uint256)", _playerId));
    require(success);
  }

  function _checkStartSlot() internal pure {
    uint expectedStartSlotNumber = 251; // From the various slot arrays expected in the base classes
    uint slot;
    assembly ("memory-safe") {
      slot := startSlot.slot
    }
    require(slot == expectedStartSlotNumber);
  }
}
