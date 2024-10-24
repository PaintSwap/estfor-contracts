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
    require(isOwnerOfPlayerAndActive(_msgSender(), playerId), NotOwnerOfPlayerAndActive());
    _;
  }

  modifier isOwnerOfPlayerMod(uint256 playerId) {
    require(_playerNFT.balanceOf(_msgSender(), playerId) == 1, NotOwnerOfPlayer());
    _;
  }

  modifier isOwnerOfPlayerOrEmpty(uint256 playerId) {
    require(playerId == 0 || _playerNFT.balanceOf(_msgSender(), playerId) == 1, NotOwnerOfPlayer());
    _;
  }

  modifier isBetaMod() {
    require(_isBeta, NotBeta());
    _;
  }

  modifier gameNotPaused() {
    require(!_gamePaused, GameIsPaused());
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
    _checkStartSlot();
  }

  function initialize(
    ItemNFT itemNFT,
    PlayerNFT playerNFT,
    PetNFT petNFT,
    World world,
    AdminAccess adminAccess,
    Quests quests,
    Clans clans,
    WishingWell wishingWell,
    address implQueueActions,
    address implProcessActions,
    address implRewards,
    address implMisc,
    address implMisc1,
    bool isBeta
  ) external initializer {
    __Ownable_init();
    __UUPSUpgradeable_init();
    __ReentrancyGuard_init();

    _delegatecall(
      implMisc1,
      abi.encodeWithSelector(
        IPlayersDelegate.initialize.selector,
        itemNFT,
        playerNFT,
        petNFT,
        world,
        adminAccess,
        quests,
        clans,
        wishingWell,
        implQueueActions,
        implProcessActions,
        implRewards,
        implMisc,
        implMisc1,
        isBeta
      )
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
    _startActions(playerId, queuedActions, NONE, uint40(block.timestamp), 0, 0, queueStatus);
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
      queuedActions,
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
      _implMisc,
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
    require(!_isPlayerFullMode(playerId), AlreadyUpgraded());

    _players[playerId].packedData = _players[playerId].packedData | (bytes1(uint8(0x1)) << IS_FULL_MODE_BIT);
  }

  // This is a special type of quest.
  function buyBrushQuest(
    address _to,
    uint256 playerId,
    uint256 questId,
    bool _useExactETH
  ) external payable isOwnerOfPlayerAndActiveMod(playerId) nonReentrant gameNotPaused {
    _delegatecall(
      _implMisc,
      abi.encodeWithSelector(IPlayersDelegate.buyBrushQuest.selector, _to, playerId, questId, _useExactETH)
    );
  }

  function activateQuest(
    uint256 playerId,
    uint256 questId
  ) external isOwnerOfPlayerAndActiveMod(playerId) nonReentrant gameNotPaused {
    if (_players[playerId].actionQueue.length != 0) {
      _processActionsAndSetState(playerId);
    }
    _quests.activateQuest(_msgSender(), playerId, questId);
  }

  function deactivateQuest(uint256 playerId) external isOwnerOfPlayerAndActiveMod(playerId) nonReentrant gameNotPaused {
    if (_players[playerId].actionQueue.length != 0) {
      _processActionsAndSetState(playerId);
    }
    // Quest may hve been completed as a result of this so don't bother trying to deactivate it
    if (_quests.getActiveQuestId(playerId) != 0) {
      _quests.deactivateQuest(playerId);
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
    uint256[] memory balances = _itemNFT.balanceOfs(_to, boostItemTokenIds);
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
    address from = _msgSender();
    bool isEmergency = true;
    _clearEverything(from, playerId, !isEmergency);
  }

  function _clearEverything(address _from, uint256 playerId, bool _processTheActions) private {
    _delegatecall(
      _implQueueActions,
      abi.encodeWithSelector(IPlayersDelegate.clearEverything.selector, _from, playerId, _processTheActions)
    );
  }

  function _startActions(
    uint256 playerId,
    QueuedActionInput[] memory queuedActions,
    uint16 boostItemTokenId,
    uint40 boostStartTime,
    uint256 questId,
    uint256 donationAmount,
    ActionQueueStatus queueStatus
  ) private {
    _delegatecall(
      _implQueueActions,
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
      _implProcessActions,
      abi.encodeWithSelector(IPlayersProcessActionsDelegate.processActionsAndSetState.selector, playerId)
    );
  }

  function _setActivePlayer(address _from, uint256 playerId) private {
    require(block.timestamp >= _activeBoosts[playerId].cooldown, PlayerLocked());

    uint256 existingActivePlayerId = _activePlayers[_from];
    _activePlayers[_from] = playerId;
    require(existingActivePlayerId != playerId, PlayerAlreadyActive());

    if (existingActivePlayerId != 0) {
      _clearEverything(_from, existingActivePlayerId, true);
    }
    emit SetActivePlayer(_from, existingActivePlayerId, playerId);
  }

  function setActivePlayer(uint256 playerId) external isOwnerOfPlayerMod(playerId) {
    _setActivePlayer(_msgSender(), playerId);
  }

  function donate(uint256 playerId, uint256 _amount) external isOwnerOfPlayerOrEmpty(playerId) {
    _donate(_msgSender(), playerId, _amount);
  }

  function dailyClaimedRewards(uint256 playerId) external view returns (bool[7] memory claimed) {
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(IPlayersMiscDelegateView.dailyClaimedRewardsImpl.selector, playerId)
    );
    return abi.decode(data, (bool[7]));
  }

  /// @notice Validate if these actions can occur
  /// @param playerId Id for the player
  /// @param queuedActions Actions to queue
  function validateActions(
    address owner_,
    uint256 playerId,
    QueuedActionInput[] calldata queuedActions
  ) external view returns (bool[] memory successes, bytes[] memory reasons) {
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(
        IPlayersQueuedActionsDelegateView.validateActionsImpl.selector,
        owner_,
        playerId,
        queuedActions
      )
    );
    return abi.decode(data, (bool[], bytes[]));
  }

  function isOwnerOfPlayerAndActive(address _from, uint256 playerId) public view override returns (bool) {
    return _playerNFT.balanceOf(_from, playerId) == 1 && _activePlayers[_from] == playerId;
  }

  function getPendingRandomRewards(uint256 playerId) external view returns (PendingRandomReward[] memory) {
    return _pendingRandomRewards[playerId];
  }

  function getActionQueue(uint256 playerId) external view returns (QueuedAction[] memory) {
    return _players[playerId].actionQueue;
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
    return _players[playerId].totalXP;
  }

  function packedXP(uint256 playerId) external view returns (PackedXP memory) {
    return _playerXP[playerId];
  }

  function players(uint256 playerId) external view returns (Player memory) {
    return _players[playerId];
  }

  // Only used by a test, could remove and replace with getStorageAt like another test uses
  function activeBoost(uint256 playerId) external view override returns (PlayerBoostInfo memory) {
    return _activeBoosts[playerId];
  }

  function clanBoost(uint256 _clanId) external view returns (PlayerBoostInfo memory) {
    return _clanBoosts[_clanId];
  }

  function globalBoost() external view returns (PlayerBoostInfo memory) {
    return _globalBoost;
  }

  function RANDOM_REWARD_CHANCE_MULTIPLIER_CUTOFF() external pure returns (uint256) {
    return RANDOM_REWARD_CHANCE_MULTIPLIER_CUTOFF_;
  }

  function isPlayerUpgraded(uint256 playerId) external view override returns (bool) {
    return _isPlayerFullMode(playerId);
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

  function setImpls(
    address implQueueActions,
    address implProcessActions,
    address implRewards,
    address implMisc,
    address implMisc1
  ) external onlyOwner {
    _implQueueActions = implQueueActions;
    _implProcessActions = implProcessActions;
    _implRewards = implRewards;
    _implMisc = implMisc;
    _implMisc1 = implMisc1;
  }

  // TODO: Can remove after integrated on live contracts
  function setAlphaCombatHealing(uint8 alphaCombatHealing) external onlyOwner {
    _alphaCombatHealing = alphaCombatHealing;
  }

  function addXPThresholdRewards(XPThresholdReward[] calldata _xpThresholdRewards) external onlyOwner {
    _delegatecall(
      _implMisc,
      abi.encodeWithSelector(IPlayersDelegate.addXPThresholdRewards.selector, _xpThresholdRewards)
    );
  }

  function editXPThresholdRewards(XPThresholdReward[] calldata _xpThresholdRewards) external onlyOwner {
    _delegatecall(
      _implMisc,
      abi.encodeWithSelector(IPlayersDelegate.editXPThresholdRewards.selector, _xpThresholdRewards)
    );
  }

  function setDailyRewardsEnabled(bool dailyRewardsEnabled) external onlyOwner {
    _dailyRewardsEnabled = dailyRewardsEnabled;
  }

  function pauseGame(bool gamePaused) external onlyOwner {
    _gamePaused = gamePaused;
    emit GamePaused(gamePaused);
  }

  function addFullAttireBonuses(FullAttireBonusInput[] calldata _fullAttireBonuses) external onlyOwner {
    _delegatecall(
      _implMisc1,
      abi.encodeWithSelector(IPlayersDelegate.addFullAttireBonuses.selector, _fullAttireBonuses)
    );
  }

  function testModifyXP(address from, uint256 playerId, Skill skill, uint56 xp, bool force) external isAdminAndBeta {
    _delegatecall(
      _implProcessActions,
      abi.encodeWithSelector(IPlayersDelegate.testModifyXP.selector, from, playerId, skill, xp, force)
    );
  }

  // For the various view functions that require delegatecall
  fallback() external {
    bytes4 selector = msg.sig;

    address implementation;
    if (selector == IPlayersRewardsDelegateView.pendingQueuedActionStateImpl.selector) {
      implementation = _implRewards;
    } else if (
      selector == IPlayersMiscDelegateView.claimableXPThresholdRewardsImpl.selector ||
      selector == IPlayersMiscDelegateView.dailyClaimedRewardsImpl.selector ||
      selector == IPlayersMiscDelegateView.dailyRewardsViewImpl.selector ||
      selector == IPlayersMiscDelegateView.processConsumablesView.selector ||
      selector == IPlayersMiscDelegateView.getRandomRewards.selector
    ) {
      implementation = _implMisc;
    } else if (
      selector == IPlayersQueuedActionsDelegateView.validateActionsImpl.selector ||
      selector == IPlayersQueuedActionsDelegateView.checkAddToQueue.selector
    ) {
      implementation = _implQueueActions;
    } else if (selector == IPlayersMisc1DelegateView.uri.selector) {
      implementation = _implMisc1;
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
