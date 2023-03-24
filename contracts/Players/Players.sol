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
import {IPlayers} from "../interfaces/IPlayers.sol";

/* solhint-disable no-global-import */
import "../globals/players.sol";
import "../globals/items.sol";
import "../globals/actions.sol";
import "../globals/rewards.sol";

/* solhint-enable no-global-import */

// Functions to help with delegatecall selectors
interface IPlayerDelegate {
  function startActions(
    uint playerId,
    QueuedActionInput[] calldata queuedActions,
    uint16 boostItemTokenId,
    ActionQueueStatus queueStatus
  ) external;

  function addXPThresholdReward(XPThresholdReward calldata xpThresholdReward) external;

  function addFullAttireBonus(FullAttireBonusInput calldata _fullAttireBonus) external;

  function mintedPlayer(address from, uint playerId, Skill[2] calldata startSkills) external;
}

contract Players is OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable, PlayersBase, Multicall, IPlayers {
  using UnsafeU256 for U256;

  error InvalidSelector();

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
    _checkStartSlot();
  }

  function initialize(
    ItemNFT _itemNFT,
    PlayerNFT _playerNFT,
    World _world,
    address[] calldata _admins,
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
    for (uint i = 0; i < _admins.length; ++i) {
      admins[_admins[i]] = true;
    }
  }

  function startAction(
    uint _playerId,
    QueuedActionInput calldata _queuedAction,
    ActionQueueStatus _queueStatus
  ) external isOwnerOfPlayerAndActive(_playerId) nonReentrant {
    QueuedActionInput[] memory queuedActions = new QueuedActionInput[](1);
    queuedActions[0] = _queuedAction;
    _startActions(_playerId, queuedActions, NONE, _queueStatus);
  }

  // Queue them up (Skill X for some amount of time, Skill Y for some amount of time, SKill Z for some amount of time)
  function startActions(
    uint _playerId,
    QueuedActionInput[] calldata _queuedActions,
    uint16 _boostItemTokenId,
    ActionQueueStatus _queueStatus
  ) external isOwnerOfPlayerAndActive(_playerId) nonReentrant {
    _startActions(_playerId, _queuedActions, _boostItemTokenId, _queueStatus);
  }

  function processActions(uint _playerId) external isOwnerOfPlayerAndActive(_playerId) nonReentrant {
    if (players[_playerId].actionQueue.length == 0) {
      revert NoActionsToProcess();
    }
    QueuedAction[] memory remainingSkillQueue = _processActions(msg.sender, _playerId);
    _setActionQueue(msg.sender, _playerId, remainingSkillQueue);
  }

  function claimRandomRewards(uint _playerId) external isOwnerOfPlayerAndActive(_playerId) nonReentrant {
    bool separateTransaction = true;
    _claimRandomRewards(_playerId, separateTransaction);
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
    emit UnconsumeBoostVial(from, _playerId);
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

  function mintBatch(address _to, uint[] calldata _ids, uint256[] calldata _amounts) external override onlyPlayerNFT {
    itemNFT.mintBatch(_to, _ids, _amounts);
  }

  function setSpeedMultiplier(uint _playerId, uint16 _multiplier) external isAdmin {
    if (_multiplier < 1) {
      revert InvalidSpeedMultiplier();
    }
    // Disable for production code
    speedMultiplier[_playerId] = _multiplier;
    emit SetSpeedMultiplier(_playerId, _multiplier);
  }

  function getURI(
    uint _playerId,
    bytes32 _name,
    bytes32 _avatarName,
    string calldata _avatarDescription,
    string calldata imageURI
  ) external view override returns (string memory) {
    return PlayerLibrary.uri(_name, xp[_playerId], _avatarName, _avatarDescription, imageURI);
  }

  // Callback after minting a player. If they aren't the active player then set it.
  function mintedPlayer(
    address _from,
    uint _playerId,
    Skill[2] calldata _startSkills,
    bool _makeActive
  ) external override onlyPlayerNFT {
    if (_makeActive) {
      _setActivePlayer(_from, _playerId);
    }

    _delegatecall(
      implProcessActions,
      abi.encodeWithSelector(IPlayerDelegate.mintedPlayer.selector, _from, _playerId, _startSkills)
    );
  }

  function clearEverything(uint _playerId) external isOwnerOfPlayerAndActive(_playerId) nonReentrant {
    _clearEverything(msg.sender, _playerId);
  }

  function clearEverythingBeforeTokenTransfer(address _from, uint _playerId) external override onlyPlayerNFT {
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
    emit ClearAll(_from, _playerId);
    _clearActionQueue(_from, _playerId);
    // Can re-mint boost if it hasn't been consumed at all yet
    if (activeBoosts[_playerId].boostType != BoostType.NONE && activeBoosts[_playerId].startTime > block.timestamp) {
      uint itemTokenId = activeBoosts[_playerId].itemTokenId;
      delete activeBoosts[_playerId];
      itemNFT.mint(_from, itemTokenId, 1);
    }
  }

  function _clearActionQueue(address _from, uint _playerId) private {
    QueuedAction[] memory queuedActions;
    _setActionQueue(_from, _playerId, queuedActions);
  }

  function _setActionQueue(address _from, uint _playerId, QueuedAction[] memory _queuedActions) private {
    Player storage player = players[_playerId];
    player.actionQueue = _queuedActions;
    emit SetActionQueue(_from, _playerId, player.actionQueue);
  }

  function _startActions(
    uint _playerId,
    QueuedActionInput[] memory _queuedActions,
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

  function _addXPThresholdReward(XPThresholdReward calldata _xpThresholdReward) private {
    _delegatecall(
      implRewards,
      abi.encodeWithSelector(IPlayerDelegate.addXPThresholdReward.selector, _xpThresholdReward)
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

  // Staticcall into ourselves and hit the fallback. This is done so that pendingRewards/dailyClaimedRewards/getRandomBytes can be exposed on the json abi.
  function pendingRewards(
    address _owner,
    uint _playerId,
    PendingFlags memory _flags
  ) external view returns (PendingOutput memory pendingOutput) {
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(IPlayersDelegateView.pendingRewardsImpl.selector, _owner, _playerId, _flags)
    );
    return abi.decode(data, (PendingOutput));
  }

  function dailyClaimedRewards(uint _playerId) external view returns (bool[7] memory claimed) {
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(IPlayersDelegateView.dailyClaimedRewardsImpl.selector, _playerId)
    );
    return abi.decode(data, (bool[7]));
  }

  function getRandomBytes(uint _numTickets, uint _skillEndTime, uint _playerId) external view returns (bytes memory b) {
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(IPlayersDelegateView.getRandomBytesImpl.selector, _numTickets, _skillEndTime, _playerId)
    );
    return abi.decode(data, (bytes));
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

  function setImpls(address _implQueueActions, address _implProcessActions, address _implRewards) external onlyOwner {
    implQueueActions = _implQueueActions;
    implProcessActions = _implProcessActions;
    implRewards = _implRewards;
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

  function _addFullAttireBonus(FullAttireBonusInput calldata _fullAttireBonus) private {
    _delegatecall(
      implProcessActions,
      abi.encodeWithSelector(IPlayerDelegate.addFullAttireBonus.selector, _fullAttireBonus)
    );
  }

  function addFullAttireBonus(FullAttireBonusInput calldata _fullAttireBonus) external onlyOwner {
    _addFullAttireBonus(_fullAttireBonus);
  }

  function addFullAttireBonuses(FullAttireBonusInput[] calldata _fullAttireBonuses) external onlyOwner {
    for (uint i = 0; i < _fullAttireBonuses.length; i++) {
      _addFullAttireBonus(_fullAttireBonuses[i]);
    }
  }

  // For the various view functions that require delegatecall
  fallback() external {
    bytes4 selector = bytes4(msg.data);

    address implementation;
    if (
      selector == IPlayersDelegateView.pendingRewardsImpl.selector ||
      selector == IPlayersDelegateView.dailyClaimedRewardsImpl.selector ||
      selector == IPlayersDelegateView.getRandomBytesImpl.selector
    ) {
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
