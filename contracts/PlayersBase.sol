// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./World.sol";
import "./types.sol";
import "./items.sol";
import "./ItemNFT.sol";
import "./PlayerNFT.sol";

contract PlayersBase {
  event ActionUnequip(uint playerId, uint128 queueId, uint16 itemTokenId, uint amount);

  event ClearAll(uint playerId);

  event AddSkillPoints(uint playerId, Skill skill, uint32 points);

  event LevelUp(uint playerId, uint[] itemTokenIdsRewarded, uint[] amountTokenIdsRewarded);

  event SetActionQueue(uint playerId, QueuedAction[] queuedActions);

  event ConsumeBoostVial(uint playerId, PlayerBoostInfo playerBoostInfo);
  event UnconsumeBoostVial(uint playerId);

  event SetActivePlayer(address account, uint oldPlayerId, uint newPlayerId);

  event RemoveQueuedAction(uint playerId, uint128 queueId);

  event AddPendingRandomReward(uint playerId, uint timestamp, uint elapsed);

  // For logging
  event Died(address from, uint playerId, uint128 queueId);
  event Rewards(address from, uint playerId, uint128 queueId, uint[] itemTokenIds, uint[] amounts);
  event Reward(address from, uint playerId, uint128 queueId, uint16 itemTokenId, uint amount); // Used in PlayerLibrary too
  event Consume(address from, uint playerId, uint128 queueId, uint16 itemTokenId, uint amount); // Used in PlayerLibrary too
  event ActionFinished(address from, uint playerId, uint128 queueId);
  event ActionPartiallyFinished(address from, uint playerId, uint128 queueId, uint elapsedTime);

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

  uint32 public constant MAX_TIME = 1 days;

  uint constant MAX_MAIN_EQUIPMENT_ID = 65536 * 8;

  mapping(uint => uint) internal speedMultiplier; // 0 or 1 is diabled, for testing only

  mapping(address => uint) internal activePlayer;

  mapping(uint => PlayerBoostInfo) public activeBoosts; // player id => boost info

  uint64 internal latestQueueId; // Global queued action id
  World internal world;

  mapping(uint => mapping(Skill => uint32)) public skillPoints; // player -> skill -> points

  mapping(uint => Player) public players;
  ItemNFT internal itemNFT;
  PlayerNFT internal playerNFT;
  mapping(uint => PendingRandomReward[]) internal pendingRandomRewards; // queue, will be sorted by timestamp

  address implActions;

  enum ActionQueueStatus {
    NONE,
    APPEND,
    KEEP_LAST_IN_PROGRESS
  }

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
}
