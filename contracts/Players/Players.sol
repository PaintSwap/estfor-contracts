// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";

import {World} from "../World.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {AdminAccess} from "../AdminAccess.sol";
import {Quests} from "../Quests.sol";
import {Clans} from "../Clans/Clans.sol";
import {PlayerNFT} from "../PlayerNFT.sol";
import {PlayersBase} from "./PlayersBase.sol";
import {PlayersLibrary} from "./PlayersLibrary.sol";
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
    uint40 boostStartTime,
    ActionQueueStatus queueStatus
  ) external;

  function addXPThresholdRewards(XPThresholdReward[] calldata xpThresholdReward) external;

  function addFullAttireBonuses(FullAttireBonusInput[] calldata fullAttireBonuses) external;

  function mintedPlayer(address from, uint playerId, Skill[2] calldata startSkills) external;

  function clearEverything(address from, uint playerId) external;

  function setActivePlayer(address from, uint playerId) external;

  function unequipBoostVial(uint playerId) external;

  function testModifyXP(uint playerId, Skill skill, uint128 xp) external;

  function initialize(
    ItemNFT itemNFT,
    PlayerNFT playerNFT,
    World world,
    AdminAccess adminAccess,
    Quests quests,
    Clans clans,
    address implQueueActions,
    address implProcessActions,
    address implRewards,
    address implMisc,
    bool isAlpha
  ) external;
}

contract Players is OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable, PlayersBase, IPlayers {
  using UnsafeMath for U256;

  error InvalidSelector();

  modifier isOwnerOfPlayerAndActiveMod(uint _playerId) {
    if (!isOwnerOfPlayerAndActive(msg.sender, _playerId)) {
      revert NotOwnerOfPlayerAndActive();
    }
    _;
  }

  modifier isOwnerOfPlayerMod(uint playerId) {
    if (playerNFT.balanceOf(msg.sender, playerId) != 1) {
      revert NotOwnerOfPlayer();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
    _checkStartSlot();
  }

  function initialize(
    ItemNFT _itemNFT,
    PlayerNFT _playerNFT,
    World _world,
    AdminAccess _adminAccess,
    Quests _quests,
    Clans _clans,
    address _implQueueActions,
    address _implProcessActions,
    address _implRewards,
    address _implMisc,
    bool _isAlpha
  ) public initializer {
    __Ownable_init();
    __UUPSUpgradeable_init();
    __ReentrancyGuard_init();

    _delegatecall(
      _implMisc,
      abi.encodeWithSelector(
        IPlayerDelegate.initialize.selector,
        _itemNFT,
        _playerNFT,
        _world,
        _adminAccess,
        _quests,
        _clans,
        _implQueueActions,
        _implProcessActions,
        _implRewards,
        _implMisc,
        _isAlpha
      )
    );
  }

  function startAction(
    uint _playerId,
    QueuedActionInput calldata _queuedAction,
    ActionQueueStatus _queueStatus
  ) external isOwnerOfPlayerAndActiveMod(_playerId) nonReentrant {
    QueuedActionInput[] memory queuedActions = new QueuedActionInput[](1);
    queuedActions[0] = _queuedAction;
    _startActions(_playerId, queuedActions, NONE, uint40(block.timestamp), _queueStatus);
  }

  /// @notice Start actions for a player
  /// @param _playerId Id for the player
  /// @param _queuedActions Actions to queue
  /// @param _queueStatus Can be either `ActionQueueStatus.NONE` for overwriting all actions,
  ///                     `ActionQueueStatus.KEEP_LAST_IN_PROGRESS` or `ActionQueueStatus.APPEND`
  function startActions(
    uint _playerId,
    QueuedActionInput[] calldata _queuedActions,
    ActionQueueStatus _queueStatus
  ) external isOwnerOfPlayerAndActiveMod(_playerId) nonReentrant {
    _startActions(_playerId, _queuedActions, NONE, uint40(block.timestamp), _queueStatus);
  }

  /// @notice Start actions for a player
  /// @param _playerId Id for the player
  /// @param _queuedActions Actions to queue
  /// @param _boostItemTokenId Which boost to consume, can be NONE
  /// @param _boostStartTime (Not used yet)
  /// @param _queueStatus Can be either `ActionQueueStatus.NONE` for overwriting all actions,
  ///                     `ActionQueueStatus.KEEP_LAST_IN_PROGRESS` or `ActionQueueStatus.APPEND`
  function startActionsExtra(
    uint _playerId,
    QueuedActionInput[] calldata _queuedActions,
    uint16 _boostItemTokenId,
    uint40 _boostStartTime, // Not used yet (always current time)
    ActionQueueStatus _queueStatus
  ) external isOwnerOfPlayerAndActiveMod(_playerId) nonReentrant {
    _startActions(_playerId, _queuedActions, _boostItemTokenId, uint40(block.timestamp), _queueStatus);
  }

  /// @notice Process actions for a player up to the current block timestamp
  function processActions(uint _playerId) external isOwnerOfPlayerAndActiveMod(_playerId) nonReentrant {
    if (players_[_playerId].actionQueue.length == 0) {
      revert NoActionsToProcess();
    }
    QueuedAction[] memory remainingSkillQueue = _processActions(msg.sender, _playerId);
    if (remainingSkillQueue.length != 0) {
      players_[_playerId].queuedActionStartTime = uint40(block.timestamp);
    }
    _setActionQueue(msg.sender, _playerId, remainingSkillQueue, block.timestamp);
  }

  function unequipBoostVial(uint _playerId) external isOwnerOfPlayerAndActiveMod(_playerId) nonReentrant {
    _delegatecall(implQueueActions, abi.encodeWithSelector(IPlayerDelegate.unequipBoostVial.selector, _playerId));
  }

  function getPendingRandomRewards(uint _playerId) external view returns (PendingRandomReward[] memory) {
    return pendingRandomRewards[_playerId];
  }

  function getActionQueue(uint _playerId) external view returns (QueuedAction[] memory) {
    return players_[_playerId].actionQueue;
  }

  function mintBatch(address _to, uint[] calldata _ids, uint256[] calldata _amounts) external override onlyPlayerNFT {
    itemNFT.mintBatch(_to, _ids, _amounts);
  }

  function getURI(
    uint _playerId,
    string calldata _name,
    string calldata _avatarName,
    string calldata _avatarDescription,
    string calldata imageURI
  ) external view override returns (string memory) {
    return
      PlayersLibrary.uri(
        _name,
        xp_[_playerId],
        _avatarName,
        _avatarDescription,
        imageURI,
        isAlpha,
        _playerId,
        clans.getClanNameOfPlayer(_playerId)
      );
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
      implMisc,
      abi.encodeWithSelector(IPlayerDelegate.mintedPlayer.selector, _from, _playerId, _startSkills)
    );
  }

  function clearEverything(uint _playerId) external isOwnerOfPlayerAndActiveMod(_playerId) nonReentrant {
    _clearEverything(msg.sender, _playerId);
  }

  /// @notice Called by the PlayerNFT contract before a player is transferred
  /// @param _from The owner of the player being transferred
  /// @param _playerId The id of the player being transferred
  function clearEverythingBeforeTokenTransfer(address _from, uint _playerId) external override onlyPlayerNFT {
    _clearEverything(_from, _playerId);
    // If it was the active player, then clear it
    uint existingActivePlayerId = activePlayer_[_from];
    if (existingActivePlayerId == _playerId) {
      delete activePlayer_[_from];
      emit SetActivePlayer(_from, existingActivePlayerId, 0);
    }
  }

  function _clearEverything(address _from, uint _playerId) private {
    _delegatecall(implQueueActions, abi.encodeWithSelector(IPlayerDelegate.clearEverything.selector, _from, _playerId));
  }

  function _startActions(
    uint _playerId,
    QueuedActionInput[] memory _queuedActions,
    uint16 _boostItemTokenId,
    uint40 _boostStartTime,
    ActionQueueStatus _queueStatus
  ) private {
    _delegatecall(
      implQueueActions,
      abi.encodeWithSelector(
        IPlayerDelegate.startActions.selector,
        _playerId,
        _queuedActions,
        _boostItemTokenId,
        _boostStartTime,
        _queueStatus
      )
    );
  }

  function _setActivePlayer(address _from, uint _playerId) private {
    _delegatecall(implQueueActions, abi.encodeWithSelector(IPlayerDelegate.setActivePlayer.selector, _from, _playerId));
  }

  function setActivePlayer(uint _playerId) external isOwnerOfPlayerMod(_playerId) {
    _setActivePlayer(msg.sender, _playerId);
  }

  function dailyClaimedRewards(uint _playerId) external view returns (bool[7] memory claimed) {
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(IPlayersMiscDelegateView.dailyClaimedRewardsImpl.selector, _playerId)
    );
    return abi.decode(data, (bool[7]));
  }

  function isOwnerOfPlayerAndActive(address _from, uint _playerId) public view override returns (bool) {
    return isOwnerOfPlayer(_from, _playerId) && activePlayer_[_from] == _playerId;
  }

  function isOwnerOfPlayer(address _from, uint _playerId) public view override returns (bool) {
    return playerNFT.balanceOf(_from, _playerId) == 1;
  }

  function MAX_TIME() external pure returns (uint32) {
    return MAX_TIME_;
  }

  function START_XP() external pure returns (uint) {
    return START_XP_;
  }

  function MAX_SUCCESS_PERCENT_CHANCE() external pure returns (uint) {
    return MAX_SUCCESS_PERCENT_CHANCE_;
  }

  function MAX_UNIQUE_TICKETS() external pure returns (uint) {
    return MAX_UNIQUE_TICKETS_;
  }

  function activePlayer(address _owner) external view override returns (uint playerId) {
    return activePlayer_[_owner];
  }

  function xp(uint _playerId, Skill _skill) external view returns (uint) {
    return xp_[_playerId][_skill];
  }

  function players(uint _playerId) external view returns (Player memory) {
    return players_[_playerId];
  }

  function activeBoosts(uint _playerId) external view returns (PlayerBoostInfo memory) {
    return activeBoosts_[_playerId];
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

  function setImpls(
    address _implQueueActions,
    address _implProcessActions,
    address _implRewards,
    address _implMisc
  ) external onlyOwner {
    implQueueActions = _implQueueActions;
    implProcessActions = _implProcessActions;
    implRewards = _implRewards;
    implMisc = _implMisc;
  }

  function addXPThresholdRewards(XPThresholdReward[] calldata _xpThresholdRewards) external onlyOwner {
    _delegatecall(
      implMisc,
      abi.encodeWithSelector(IPlayerDelegate.addXPThresholdRewards.selector, _xpThresholdRewards)
    );
  }

  function setDailyRewardsEnabled(bool _dailyRewardsEnabled) external onlyOwner {
    dailyRewardsEnabled = _dailyRewardsEnabled;
  }

  function addFullAttireBonuses(FullAttireBonusInput[] calldata _fullAttireBonuses) external onlyOwner {
    _delegatecall(implMisc, abi.encodeWithSelector(IPlayerDelegate.addFullAttireBonuses.selector, _fullAttireBonuses));
  }

  function testModifyXP(uint _playerId, Skill _skill, uint128 _xp) external isAdminAndAlpha {
    _delegatecall(
      implProcessActions,
      abi.encodeWithSelector(IPlayerDelegate.testModifyXP.selector, _playerId, _skill, _xp)
    );
  }

  // For the various view functions that require delegatecall
  fallback() external {
    bytes4 selector = bytes4(msg.data);

    address implementation;
    if (
      selector == IPlayersRewardsDelegateView.pendingQueuedActionStateImpl.selector ||
      selector == IPlayersRewardsDelegateView.getRewards.selector
    ) {
      implementation = implRewards;
    } else if (
      selector == IPlayersMiscDelegateView.claimableXPThresholdRewardsImpl.selector ||
      selector == IPlayersMiscDelegateView.dailyClaimedRewardsImpl.selector ||
      selector == IPlayersMiscDelegateView.dailyRewardsViewImpl.selector ||
      selector == IPlayersMiscDelegateView.processConsumablesViewImpl.selector
    ) {
      implementation = implMisc;
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
