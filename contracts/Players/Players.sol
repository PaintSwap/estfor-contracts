// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import {UnsafeU256, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeU256.sol";

import {World} from "../World.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {PlayerNFT} from "../PlayerNFT.sol";
import {PlayersBase} from "./PlayersBase.sol";
import {PlayerLibrary} from "./PlayerLibrary.sol";

// solhint-disable-next-line no-global-import
import "../globals/players.sol";
// solhint-disable-next-line no-global-import
import "../globals/items.sol";
// solhint-disable-next-line no-global-import
import "../globals/actions.sol";
// solhint-disable-next-line no-global-import
import "../globals/rewards.sol";

// External view functions that are in other implementation files
interface PlayersDelegateView {
  function pendingRewardsImpl(
    address _owner,
    uint _playerId,
    PendingFlags memory _flags
  ) external view returns (PendingOutput memory pendingOutput);
}

// Functions to help with delegatecall selectors
interface IPlayerDelegate {
  function startActions(
    uint _playerId,
    QueuedAction[] memory _queuedActions,
    uint16 _boostItemTokenId,
    ActionQueueStatus _queueStatus
  ) external;
}

contract Players is OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable, PlayersBase, Multicall {
  using UnsafeU256 for U256;

  error InvalidSelector();
  error XPThresholdNotFound();

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
    _checkStartSlot();
  }

  function initialize(
    ItemNFT _itemNFT,
    PlayerNFT _playerNFT,
    World _world,
    address _implQueueActions,
    address _implProcessActions,
    address _implRewards
  ) public initializer {
    __Ownable_init();
    __UUPSUpgradeable_init();
    __ReentrancyGuard_init();

    itemNFT = _itemNFT;
    playerNFT = _playerNFT;
    world = _world;
    implQueueActions = _implQueueActions;
    implProcessActions = _implProcessActions;
    implRewards = _implRewards;

    nextQueueId = 1;
    alphaCombat = 1;
    betaCombat = 1;
  }

  function startAction(
    uint _playerId,
    QueuedAction calldata _queuedAction,
    ActionQueueStatus _queueStatus
  ) external isOwnerOfPlayerAndActive(_playerId) nonReentrant {
    QueuedAction[] memory queuedActions = new QueuedAction[](1);
    queuedActions[0] = _queuedAction;
    _startActions(_playerId, queuedActions, NONE, _queueStatus);
  }

  // Queue them up (Skill X for some amount of time, Skill Y for some amount of time, SKill Z for some amount of time)
  function startActions(
    uint _playerId,
    QueuedAction[] calldata _queuedActions,
    uint16 _boostItemTokenId,
    ActionQueueStatus _queueStatus
  ) external isOwnerOfPlayerAndActive(_playerId) nonReentrant {
    _startActions(_playerId, _queuedActions, _boostItemTokenId, _queueStatus);
  }

  function processActions(uint _playerId) external isOwnerOfPlayerAndActive(_playerId) nonReentrant {
    QueuedAction[] memory remainingSkillQueue = _processActions(msg.sender, _playerId);
    _setActionQueue(_playerId, remainingSkillQueue);
  }

  function claimRandomRewards(uint _playerId) external nonReentrant {
    _claimRandomRewards(_playerId);
  }

  function consumeBoost(
    uint _playerId,
    uint16 _itemTokenId,
    uint40 _startTime
  ) external isOwnerOfPlayerAndActive(_playerId) nonReentrant {
    _delegatecall(
      implQueueActions,
      abi.encodeWithSignature("consumeBoost(uint256,uint16,uint40)", _playerId, _itemTokenId, _startTime)
    );
  }

  function unequipBoostVial(uint _playerId) external isOwnerOfPlayerAndActive(_playerId) nonReentrant {
    if (activeBoosts[_playerId].boostType == BoostType.NONE) {
      revert NoActiveBoost();
    }
    if (activeBoosts[_playerId].startTime > block.timestamp) {
      revert BoostTimeAlreadyStarted();
    }
    address from = msg.sender;
    itemNFT.mint(from, activeBoosts[_playerId].itemTokenId, 1);
    emit UnconsumeBoostVial(_playerId);
  }

  function getPendingRandomRewards(uint _playerId) external view returns (PendingRandomReward[] memory) {
    return pendingRandomRewards[_playerId];
  }

  function getActionQueue(uint _playerId) external view returns (QueuedAction[] memory) {
    return players[_playerId].actionQueue;
  }

  function actionQueueLength(uint _playerId) external view returns (uint256) {
    return players[_playerId].actionQueue.length;
  }

  function mintBatch(address _to, uint[] calldata _ids, uint256[] calldata _amounts) external onlyPlayerNFT {
    itemNFT.mintBatch(_to, _ids, _amounts);
  }

  function setSpeedMultiplier(uint _playerId, uint16 multiplier) external {
    // Disable for production code
    speedMultiplier[_playerId] = multiplier;
  }

  function getURI(
    uint _playerId,
    bytes32 _name,
    bytes32 _avatarName,
    string calldata _avatarDescription,
    string calldata imageURI
  ) external view returns (string memory) {
    return PlayerLibrary.uri(_name, xp[_playerId], _avatarName, _avatarDescription, imageURI);
  }

  // Callback after minting a player. If they aren't the active player then set it.
  function mintedPlayer(address _from, uint _playerId, bool makeActive) external onlyPlayerNFT {
    if (makeActive) {
      _setActivePlayer(_from, _playerId);
    }
    Player storage player = players[_playerId];
    player.health = 1;
    player.melee = 1;
    player.magic = 1;
    player.range = 1;
    player.defence = 1;
  }

  function clearEverything(uint _playerId) external isOwnerOfPlayerAndActive(_playerId) nonReentrant {
    _clearEverything(msg.sender, _playerId);
  }

  function clearEverythingBeforeTokenTransfer(address _from, uint _playerId) external onlyPlayerNFT {
    _clearEverything(_from, _playerId);
  }

  function itemBeforeTokenTransfer(
    address _from,
    uint[] calldata /*_itemTokenIds*/,
    uint[] calldata /*_amounts*/
  ) external view onlyItemNFT {
    uint playerId = activePlayer[_from];
    if (playerId == 0) {
      return;
    }

    // TODO: Check if the player is currently using any of the items, and record all which are 0 and left/right arm items
    // emit QueuedActionValid(true/false)
  }

  // Consumes all the actions in the queue up to this time.
  // Unequips everything which is just emitting an event
  // Mints the boost vial if it hasn't been consumed at all yet
  // Removes all the actions from the queue
  function _clearEverything(address _from, uint _playerId) private {
    _processActions(_from, _playerId);
    emit ClearAll(_playerId);
    _clearActionQueue(_playerId);
    // Can re-mint boost if it hasn't been consumed at all yet
    if (activeBoosts[_playerId].boostType != BoostType.NONE && activeBoosts[_playerId].startTime < block.timestamp) {
      uint itemTokenId = activeBoosts[_playerId].itemTokenId;
      delete activeBoosts[_playerId];
      itemNFT.mint(_from, itemTokenId, 1);
    }
  }

  function _clearActionQueue(uint _playerId) private {
    QueuedAction[] memory queuedActions;
    _setActionQueue(_playerId, queuedActions);
  }

  function _setActionQueue(uint _playerId, QueuedAction[] memory _queuedActions) private {
    Player storage player = players[_playerId];
    player.actionQueue = _queuedActions;
    emit SetActionQueue(_playerId, player.actionQueue);
  }

  function _startActions(
    uint _playerId,
    QueuedAction[] memory _queuedActions,
    uint16 _boostItemTokenId,
    ActionQueueStatus _queueStatus
  ) private {
    _delegatecall(
      implQueueActions,
      abi.encodeWithSelector(
        IPlayerDelegate.startActions.selector,
        _playerId,
        _queuedActions,
        _boostItemTokenId,
        _queueStatus
      )
    );
  }

  function _setActivePlayer(address _from, uint _playerId) private {
    uint existingActivePlayer = activePlayer[_from];
    // All attire and actions can be made for this player
    activePlayer[_from] = _playerId;
    if (existingActivePlayer != 0) {
      // If there is an existing active player, unequip all items
      _clearEverything(_from, existingActivePlayer);
    }
    emit SetActivePlayer(_from, existingActivePlayer, _playerId);
  }

  function setActivePlayer(uint _playerId) external isOwnerOfPlayer(_playerId) {
    _setActivePlayer(msg.sender, _playerId);
  }

  function pendingRewards(
    address _owner,
    uint _playerId,
    PendingFlags memory _flags
  ) external view returns (PendingOutput memory pendingOutput) {
    // Staticcall into ourselves and hit the fallback. This is done so that pendingRewards can be exposed on the json abi.
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(PlayersDelegateView.pendingRewardsImpl.selector, _owner, _playerId, _flags)
    );
    return abi.decode(data, (PendingOutput));
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

  function setImpls(address _implQueueActions, address _implProcessActions, address _implRewards) external onlyOwner {
    implQueueActions = _implQueueActions;
    implProcessActions = _implProcessActions;
    implRewards = _implRewards;
  }

  function _addXPThresholdReward(XPThresholdReward calldata _xpThresholdReward) private {
    // Check that it is part of the hexBytes
    uint16 index = _findBaseXPThreshold(_xpThresholdReward.xpThreshold);
    uint32 xpThreshold = _getXPReward(index);
    if (_xpThresholdReward.xpThreshold != xpThreshold) {
      revert XPThresholdNotFound();
    }

    xpRewardThresholds[_xpThresholdReward.xpThreshold] = _xpThresholdReward.rewards;
    emit AdminAddThresholdReward(_xpThresholdReward);
  }

  function addXPThresholdReward(XPThresholdReward calldata _xpThresholdReward) external onlyOwner {
    _addXPThresholdReward(_xpThresholdReward);
  }

  function addXPThresholdRewards(XPThresholdReward[] calldata _xpThresholdRewards) external onlyOwner {
    U256 iter = U256.wrap(_xpThresholdRewards.length);
    while (iter.neq(0)) {
      iter = iter.dec();
      _addXPThresholdReward(_xpThresholdRewards[iter.asUint256()]);
    }
  }

  function setDailyRewardsEnabled(bool _dailyRewardsEnabled) external onlyOwner {
    dailyRewardsEnabled = _dailyRewardsEnabled;
  }

  function testOnlyModifyLevel(uint _playerId, Skill _skill, uint32 _xp) external onlyOwner {
    xp[_playerId][_skill] = _xp;
  }

  // For the various view functions that require delegatecall
  fallback() external {
    bytes4 selector = bytes4(msg.data);

    address implementation;
    if (selector == PlayersDelegateView.pendingRewardsImpl.selector) {
      implementation = implRewards;
    } else {
      revert InvalidSelector();
    }

    assembly ("memory-safe") {
      calldatacopy(0, 0, calldatasize())
      let result := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)
      returndatacopy(0, 0, returndatasize())
      switch result
      case 0 {
        revert(0, returndatasize())
      }
      default {
        return(0, returndatasize())
      }
    }
  }
}
