// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "../ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../ozUpgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "../ozUpgradeable/security/ReentrancyGuardUpgradeable.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";

import {World} from "../World.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {PetNFT} from "../PetNFT.sol";
import {AdminAccess} from "../AdminAccess.sol";
import {Quests} from "../Quests.sol";
import {Clans} from "../Clans/Clans.sol";
import {WishingWell} from "../WishingWell.sol";
import {PlayerNFT} from "../PlayerNFT.sol";
import {PlayersBase} from "./PlayersBase.sol";
import {PlayersLibrary} from "./PlayersLibrary.sol";
import {IPlayers} from "../interfaces/IPlayers.sol";
import {IPlayersDelegate, IPlayersMiscDelegateView, IPlayersRewardsDelegateView, IPlayersQueuedActionsDelegateView, IPlayersProcessActionsDelegate, IPlayersMisc1DelegateView} from "../interfaces/IPlayersDelegates.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

contract Players is OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable, PlayersBase, IPlayers {
  using UnsafeMath for U256;

  event GamePaused(bool gamePaused);
  event LockPlayer(uint256 playerId, uint256 cooldownTimestamp);
  event UnlockPlayer(uint256 playerId);

  error InvalidSelector();
  error GameIsPaused();
  error NotBeta();
  error PlayerLocked();

  modifier isOwnerOfPlayerAndActiveMod(uint256 playerId) {
    if (!isOwnerOfPlayerAndActive(msg.sender, playerId)) {
      revert NotOwnerOfPlayerAndActive();
    }
    _;
  }

  modifier isOwnerOfPlayerMod(uint256 playerId) {
    if (playerNFT.balanceOf(msg.sender, playerId) != 1) {
      revert NotOwnerOfPlayer();
    }
    _;
  }

  modifier isOwnerOfPlayerOrEmpty(uint256 playerId) {
    if (playerId != 0 && playerNFT.balanceOf(msg.sender, playerId) != 1) {
      revert NotOwnerOfPlayer();
    }
    _;
  }

  modifier isBetaMod() {
    if (!isBeta) {
      revert NotBeta();
    }
    _;
  }

  modifier gameNotPaused() {
    if (gamePaused) {
      revert GameIsPaused();
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
    PetNFT _petNFT,
    World _world,
    AdminAccess _adminAccess,
    Quests _quests,
    Clans _clans,
    WishingWell _wishingWell,
    address _implQueueActions,
    address _implProcessActions,
    address _implRewards,
    address _implMisc,
    address _implMisc1,
    bool _isBeta
  ) external initializer {
    __Ownable_init();
    __UUPSUpgradeable_init();
    __ReentrancyGuard_init();

    _delegatecall(
      _implMisc1,
      abi.encodeWithSelector(
        IPlayersDelegate.initialize.selector,
        _itemNFT,
        _playerNFT,
        _petNFT,
        _world,
        _adminAccess,
        _quests,
        _clans,
        _wishingWell,
        _implQueueActions,
        _implProcessActions,
        _implRewards,
        _implMisc,
        _implMisc1,
        _isBeta
      )
    );
  }

  /// @notice Start actions for a player
  /// @param playerId Id for the player
  /// @param queuedActions Actions to queue
  /// @param queueStatus Can be either `ActionQueueStatus.NONE` for overwriting all actions,
  ///                     `ActionQueueStatus.KEEP_LAST_IN_PROGRESS` or `ActionQueueStatus.APPEND`
  function startActionsV2(
    uint256 playerId,
    QueuedActionInputV2[] calldata queuedActions,
    ActionQueueStatus queueStatus
  ) external isOwnerOfPlayerAndActiveMod(playerId) nonReentrant gameNotPaused {
    _startActions(playerId, queuedActions, NONE, uint40(block.timestamp), 0, 0, queueStatus);
  }

  /// @notice Start actions for a player
  /// @param playerId Id for the player
  /// @param queuedActions Actions to queue
  /// @param boostItemTokenId Which boost to consume, can be NONE
  /// @param boostStartTime (Not used yet)
  /// @param queueStatus Can be either `ActionQueueStatus.NONE` for overwriting all actions,
  ///                     `ActionQueueStatus.KEEP_LAST_IN_PROGRESS` or `ActionQueueStatus.APPEND`
  function startActionsExtraV2(
    uint256 playerId,
    QueuedActionInputV2[] calldata queuedActions,
    uint16 boostItemTokenId,
    uint40 boostStartTime, // Not used yet (always current time)
    uint256 questId,
    uint256 donationAmount,
    ActionQueueStatus queueStatus
  ) external isOwnerOfPlayerAndActiveMod(playerId) nonReentrant gameNotPaused {
    _startActions(
      playerId,
      queuedActions,
      boostItemTokenId,
      uint40(block.timestamp),
      questId,
      donationAmount,
      queueStatus
    );
  }

  /// @notice Start actions for a player
  /// @param playerId Id for the player
  /// @param queuedActions Actions to queue
  /// @param queueStatus Can be either `ActionQueueStatus.NONE` for overwriting all actions,
  ///                     `ActionQueueStatus.KEEP_LAST_IN_PROGRESS` or `ActionQueueStatus.APPEND`
  function startActions(
    uint256 playerId,
    QueuedActionInput[] calldata queuedActions,
    ActionQueueStatus queueStatus
  ) external isOwnerOfPlayerAndActiveMod(playerId) nonReentrant gameNotPaused {
    _startActions(
      playerId,
      _convertQueuedActionInputV1ToV2(queuedActions),
      NONE,
      uint40(block.timestamp),
      0,
      0,
      queueStatus
    );
  }

  /// @notice Start actions for a player
  /// @param playerId Id for the player
  /// @param queuedActions Actions to queue
  /// @param boostItemTokenId Which boost to consume, can be NONE
  /// @param boostStartTime (Not used yet)
  /// @param queueStatus Can be either `ActionQueueStatus.NONE` for overwriting all actions,
  ///                     `ActionQueueStatus.KEEP_LAST_IN_PROGRESS` or `ActionQueueStatus.APPEND`
  function startActionsExtra(
    uint256 playerId,
    QueuedActionInput[] calldata queuedActions,
    uint16 boostItemTokenId,
    uint40 boostStartTime, // Not used yet (always current time)
    uint256 questId,
    uint256 donationAmount,
    ActionQueueStatus queueStatus
  ) external isOwnerOfPlayerAndActiveMod(playerId) nonReentrant gameNotPaused {
    _startActions(
      playerId,
      _convertQueuedActionInputV1ToV2(queuedActions),
      boostItemTokenId,
      uint40(block.timestamp),
      questId,
      donationAmount,
      queueStatus
    );
  }

  /// @notice Process actions for a player up to the current block timestamp
  function processActions(uint256 playerId) external isOwnerOfPlayerAndActiveMod(playerId) nonReentrant gameNotPaused {
    _processActionsAndSetState(playerId);
  }

  // Callback after minting a player
  function mintedPlayer(
    address _from,
    uint256 playerId,
    Skill[2] calldata _startSkills,
    bool _makeActive,
    uint256[] calldata _startingItemTokenIds,
    uint256[] calldata _startingAmounts
  ) external override onlyPlayerNFT {
    if (_makeActive) {
      _setActivePlayer(_from, playerId);
    }

    _delegatecall(
      implMisc,
      abi.encodeWithSelector(
        IPlayersDelegate.mintedPlayer.selector,
        _from,
        playerId,
        _startSkills,
        _startingItemTokenIds,
        _startingAmounts
      )
    );
  }

  // Callback after upgrading a player
  function upgradePlayer(uint256 playerId) external override onlyPlayerNFT {
    if (_isPlayerFullMode(playerId)) {
      revert AlreadyUpgraded();
    }

    players_[playerId].packedData = players_[playerId].packedData | (bytes1(uint8(0x1)) << IS_FULL_MODE_BIT);
  }

  // This is a special type of quest.
  function buyBrushQuest(
    address _to,
    uint256 playerId,
    uint256 questId,
    bool _useExactETH
  ) external payable isOwnerOfPlayerAndActiveMod(playerId) nonReentrant gameNotPaused {
    _delegatecall(
      implMisc,
      abi.encodeWithSelector(IPlayersDelegate.buyBrushQuest.selector, _to, playerId, questId, _useExactETH)
    );
  }

  function activateQuest(
    uint256 playerId,
    uint256 questId
  ) external isOwnerOfPlayerAndActiveMod(playerId) nonReentrant gameNotPaused {
    if (players_[playerId].actionQueue.length != 0) {
      _processActionsAndSetState(playerId);
    }
    quests.activateQuest(msg.sender, playerId, questId);
  }

  function deactivateQuest(uint256 playerId) external isOwnerOfPlayerAndActiveMod(playerId) nonReentrant gameNotPaused {
    if (players_[playerId].actionQueue.length != 0) {
      _processActionsAndSetState(playerId);
    }
    // Quest may hve been completed as a result of this so don't bother trying to deactivate it
    if (quests.getActiveQuestId(playerId) != 0) {
      quests.deactivateQuest(playerId);
    }
  }

  /// @notice Called by the PlayerNFT contract before a player is transferred from an account
  /// @param _from The owner of the player being transferred
  /// @param playerId The id of the player being transferred
  function clearEverythingBeforeTokenTransfer(address _from, uint256 playerId) external override onlyPlayerNFT {
    _clearEverything(_from, playerId, true);
    // If it was the active player, then clear it
    uint256 existingActivePlayerId = _activePlayers[_from];
    if (existingActivePlayerId == playerId) {
      delete _activePlayers[_from];
      emit SetActivePlayer(_from, existingActivePlayerId, 0);
    }
  }

  /// @notice Called by the PlayerNFT contract before a player is transferred to an account
  /// @param _to The new owner of the player
  /// @param playerId The id of the player being transferred
  function beforeTokenTransferTo(address _to, uint256 playerId) external override onlyPlayerNFT {
    // Does this account have any boosts? If so, then set a lock on the player when trying to set it as active
    uint16[] memory boostItemTokenIds = new uint16[](4);
    boostItemTokenIds[0] = COMBAT_BOOST;
    boostItemTokenIds[1] = XP_BOOST;
    boostItemTokenIds[2] = GATHERING_BOOST;
    boostItemTokenIds[3] = SKILL_BOOST;
    uint256[] memory balances = itemNFT.balanceOfs(_to, boostItemTokenIds);
    bool hasBoost;
    for (uint256 i; i < balances.length; ++i) {
      hasBoost = hasBoost || balances[i] != 0;
    }

    if (hasBoost) {
      // The account this player is being transferred to has a boost, so lock the player for 1 day.
      uint40 cooldownTimestamp = uint40(block.timestamp + 1 days);
      _activeBoosts[playerId].cooldown = cooldownTimestamp;
      emit LockPlayer(playerId, cooldownTimestamp);
    } else if (_activeBoosts[playerId].cooldown > block.timestamp) {
      // Remove the lock when transferring to a player without boosts
      _activeBoosts[playerId].cooldown = 0;
      emit UnlockPlayer(playerId);
    }
  }

  function clearEverything(uint256 playerId) external isOwnerOfPlayerAndActiveMod(playerId) isBetaMod {
    address from = msg.sender;
    bool isEmergency = true;
    _clearEverything(from, playerId, !isEmergency);
  }

  function _clearEverything(address _from, uint256 playerId, bool _processTheActions) private {
    _delegatecall(
      implQueueActions,
      abi.encodeWithSelector(IPlayersDelegate.clearEverything.selector, _from, playerId, _processTheActions)
    );
  }

  function _startActions(
    uint256 playerId,
    QueuedActionInputV2[] memory queuedActions,
    uint16 boostItemTokenId,
    uint40 boostStartTime,
    uint256 questId,
    uint256 donationAmount,
    ActionQueueStatus queueStatus
  ) private {
    _delegatecall(
      implQueueActions,
      abi.encodeWithSelector(
        IPlayersDelegate.startActions.selector,
        playerId,
        queuedActions,
        boostItemTokenId,
        boostStartTime,
        questId,
        donationAmount,
        queueStatus
      )
    );
  }

  function _processActionsAndSetState(uint256 playerId) private {
    _delegatecall(
      implProcessActions,
      abi.encodeWithSelector(IPlayersProcessActionsDelegate.processActionsAndSetState.selector, playerId)
    );
  }

  function _setActivePlayer(address _from, uint256 playerId) private {
    if (block.timestamp < _activeBoosts[playerId].cooldown) {
      revert PlayerLocked();
    }

    uint256 existingActivePlayerId = _activePlayers[_from];
    _activePlayers[_from] = playerId;
    if (existingActivePlayerId == playerId) {
      revert PlayerAlreadyActive();
    }

    if (existingActivePlayerId != 0) {
      _clearEverything(_from, existingActivePlayerId, true);
    }
    emit SetActivePlayer(_from, existingActivePlayerId, playerId);
  }

  function _convertQueuedActionInputV1ToV2(
    QueuedActionInput[] calldata queuedActions
  ) private pure returns (QueuedActionInputV2[] memory) {
    QueuedActionInputV2[] memory actions = new QueuedActionInputV2[](queuedActions.length);
    for (uint256 i; i < queuedActions.length; ++i) {
      actions[i] = QueuedActionInputV2(
        queuedActions[i].attire,
        queuedActions[i].actionId,
        queuedActions[i].regenerateId,
        queuedActions[i].choiceId,
        queuedActions[i].rightHandEquipmentTokenId,
        queuedActions[i].leftHandEquipmentTokenId,
        queuedActions[i].timespan,
        queuedActions[i].combatStyle,
        0
      );
    }
    return actions;
  }

  function setActivePlayer(uint256 playerId) external isOwnerOfPlayerMod(playerId) {
    _setActivePlayer(msg.sender, playerId);
  }

  function donate(uint256 playerId, uint256 _amount) external isOwnerOfPlayerOrEmpty(playerId) {
    _donate(msg.sender, playerId, _amount);
  }

  function dailyClaimedRewards(uint256 playerId) external view returns (bool[7] memory claimed) {
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(IPlayersMiscDelegateView.dailyClaimedRewardsImpl.selector, playerId)
    );
    return abi.decode(data, (bool[7]));
  }

  function validateActionsV2(
    address _owner,
    uint256 playerId,
    QueuedActionInputV2[] calldata queuedActions
  ) external view returns (bool[] memory successes, bytes[] memory reasons) {
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(
        IPlayersQueuedActionsDelegateView.validateActionsImpl.selector,
        _owner,
        playerId,
        queuedActions
      )
    );
    return abi.decode(data, (bool[], bytes[]));
  }

  /// @notice Validate if these actions can occur
  /// @param playerId Id for the player
  /// @param queuedActions Actions to queue
  function validateActions(
    address _owner,
    uint256 playerId,
    QueuedActionInput[] calldata queuedActions
  ) external view returns (bool[] memory successes, bytes[] memory reasons) {
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(
        IPlayersQueuedActionsDelegateView.validateActionsImpl.selector,
        _owner,
        playerId,
        _convertQueuedActionInputV1ToV2(queuedActions)
      )
    );
    return abi.decode(data, (bool[], bytes[]));
  }

  function isOwnerOfPlayerAndActive(address _from, uint256 playerId) public view override returns (bool) {
    return playerNFT.balanceOf(_from, playerId) == 1 && _activePlayers[_from] == playerId;
  }

  function getPendingRandomRewards(uint256 playerId) external view returns (PendingRandomReward[] memory) {
    return pendingRandomRewards[playerId];
  }

  function getActionQueue(uint256 playerId) external view returns (QueuedAction[] memory) {
    return players_[playerId].actionQueue;
  }

  function getURI(
    uint256 playerId,
    string calldata _name,
    string calldata _avatarName,
    string calldata _avatarDescription,
    string calldata imageURI
  ) external view override returns (string memory) {
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(
        IPlayersMisc1DelegateView.uri.selector,
        _name,
        _avatarName,
        _avatarDescription,
        imageURI,
        playerId
      )
    );
    return abi.decode(data, (string));
  }

  // Staticcall into ourselves and hit the fallback. This is done so that pendingQueuedActionState/dailyClaimedRewards can be exposed on the json abi.
  function pendingQueuedActionState(
    address _owner,
    uint256 playerId
  ) public view returns (PendingQueuedActionState memory) {
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(IPlayersRewardsDelegateView.pendingQueuedActionStateImpl.selector, _owner, playerId)
    );
    return abi.decode(data, (PendingQueuedActionState));
  }

  function getActivePlayer(address _owner) external view override returns (uint256 playerId) {
    return _activePlayers[_owner];
  }

  function getPlayerXP(uint256 playerId, Skill _skill) external view override returns (uint256) {
    return PlayersLibrary.readXP(_skill, _playerXP[playerId]);
  }

  function level(uint256 playerId, Skill _skill) external view override returns (uint256) {
    return PlayersLibrary._getLevel(PlayersLibrary.readXP(_skill, _playerXP[playerId]));
  }

  function totalXP(uint256 playerId) external view override returns (uint256) {
    return players_[playerId].totalXP;
  }

  function packedXP(uint256 playerId) external view returns (PackedXP memory) {
    return _playerXP[playerId];
  }

  function players(uint256 playerId) external view returns (Player memory) {
    return players_[playerId];
  }

  // Only used by a test, could remove and replace with getStorageAt like another test uses
  function activeBoost(uint256 playerId) external view override returns (PlayerBoostInfo memory) {
    return _activeBoosts[playerId];
  }

  function clanBoost(uint256 _clanId) external view returns (PlayerBoostInfo memory) {
    return clanBoosts_[_clanId];
  }

  function globalBoost() external view returns (PlayerBoostInfo memory) {
    return globalBoost_;
  }

  function RANDOM_REWARD_CHANCE_MULTIPLIER_CUTOFF() external pure returns (uint256) {
    return RANDOM_REWARD_CHANCE_MULTIPLIER_CUTOFF_;
  }

  function isPlayerUpgraded(uint256 playerId) external view override returns (bool) {
    return _isPlayerFullMode(playerId);
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

  function setImpls(
    address _implQueueActions,
    address _implProcessActions,
    address _implRewards,
    address _implMisc,
    address _implMisc1
  ) external onlyOwner {
    implQueueActions = _implQueueActions;
    implProcessActions = _implProcessActions;
    implRewards = _implRewards;
    implMisc = _implMisc;
    implMisc1 = _implMisc1;
  }

  // TODO: Can remove after integrated on live contracts
  function setAlphaCombatHealing(uint8 alphaCombatHealing) external onlyOwner {
    _alphaCombatHealing = alphaCombatHealing;
  }

  function addXPThresholdRewards(XPThresholdReward[] calldata _xpThresholdRewards) external onlyOwner {
    _delegatecall(
      implMisc,
      abi.encodeWithSelector(IPlayersDelegate.addXPThresholdRewards.selector, _xpThresholdRewards)
    );
  }

  function editXPThresholdRewards(XPThresholdReward[] calldata _xpThresholdRewards) external onlyOwner {
    _delegatecall(
      implMisc,
      abi.encodeWithSelector(IPlayersDelegate.editXPThresholdRewards.selector, _xpThresholdRewards)
    );
  }

  function setDailyRewardsEnabled(bool _dailyRewardsEnabled) external onlyOwner {
    dailyRewardsEnabled = _dailyRewardsEnabled;
  }

  function pauseGame(bool _gamePaused) external onlyOwner {
    gamePaused = _gamePaused;
    emit GamePaused(_gamePaused);
  }

  function addFullAttireBonuses(FullAttireBonusInput[] calldata _fullAttireBonuses) external onlyOwner {
    _delegatecall(
      implMisc1,
      abi.encodeWithSelector(IPlayersDelegate.addFullAttireBonuses.selector, _fullAttireBonuses)
    );
  }

  function testModifyXP(address from, uint256 playerId, Skill skill, uint56 xp, bool force) external isAdminAndBeta {
    _delegatecall(
      implProcessActions,
      abi.encodeWithSelector(IPlayersDelegate.testModifyXP.selector, from, playerId, skill, xp, force)
    );
  }

  // For the various view functions that require delegatecall
  fallback() external {
    bytes4 selector = msg.sig;

    address implementation;
    if (selector == IPlayersRewardsDelegateView.pendingQueuedActionStateImpl.selector) {
      implementation = implRewards;
    } else if (
      selector == IPlayersMiscDelegateView.claimableXPThresholdRewardsImpl.selector ||
      selector == IPlayersMiscDelegateView.dailyClaimedRewardsImpl.selector ||
      selector == IPlayersMiscDelegateView.dailyRewardsViewImpl.selector ||
      selector == IPlayersMiscDelegateView.processConsumablesView.selector ||
      selector == IPlayersMiscDelegateView.getRandomRewards.selector
    ) {
      implementation = implMisc;
    } else if (
      selector == IPlayersQueuedActionsDelegateView.validateActionsImpl.selector ||
      selector == IPlayersQueuedActionsDelegateView.checkAddToQueue.selector
    ) {
      implementation = implQueueActions;
    } else if (selector == IPlayersMisc1DelegateView.uri.selector) {
      implementation = implMisc1;
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
