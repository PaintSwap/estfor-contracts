// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardTransientUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardTransientUpgradeable.sol";

import {RandomnessBeacon} from "../RandomnessBeacon.sol";
import {DailyRewardsScheduler} from "../DailyRewardsScheduler.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {PetNFT} from "../PetNFT.sol";
import {AdminAccess} from "../AdminAccess.sol";
import {Quests} from "../Quests.sol";
import {Clans} from "../Clans/Clans.sol";
import {WishingWell} from "../WishingWell.sol";
import {PlayerNFT} from "../PlayerNFT.sol";
import {PlayersBase} from "./PlayersBase.sol";
import {IPlayers} from "../interfaces/IPlayers.sol";
import {IPlayersDelegate, IPlayersMiscDelegate, IPlayersMisc1Delegate, IPlayersMiscDelegateView, IPlayersRewardsDelegateView, IPlayersQueuedActionsDelegateView, IPlayersProcessActionsDelegate, IPlayersMisc1DelegateView} from "../interfaces/IPlayersDelegates.sol";
import {IWorldActions} from "../interfaces/IWorldActions.sol";

import {PlayersLibrary} from "./PlayersLibrary.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

contract Players is UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuardTransientUpgradeable, PlayersBase, IPlayers {
  event GamePaused(bool gamePaused);
  event LockPlayer(uint256 playerId, uint256 cooldownTimestamp);
  event UnlockPlayer(uint256 playerId);

  error InvalidSelector();
  error GameIsPaused();
  error PlayerLocked();
  error NotBridge();

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

  modifier isXPModifier() {
    require(_xpModifiers[msg.sender] || (_isBeta && _adminAccess.isAdmin(msg.sender)));
    _;
  }

  modifier gameNotPaused() {
    require(!_gamePaused, GameIsPaused());
    _;
  }

  modifier onlyBridge() {
    require(_msgSender() == _bridge, NotBridge());
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    ItemNFT itemNFT,
    PlayerNFT playerNFT,
    PetNFT petNFT,
    IWorldActions worldActions,
    RandomnessBeacon randomnessBeacon,
    DailyRewardsScheduler dailyRewardsScheduler,
    AdminAccess adminAccess,
    Quests quests,
    Clans clans,
    WishingWell wishingWell,
    address implQueueActions,
    address implProcessActions,
    address implRewards,
    address implMisc,
    address implMisc1,
    address bridge,
    bool isBeta
  ) external initializer {
    __Ownable_init(_msgSender());
    __UUPSUpgradeable_init();
    __ReentrancyGuardTransient_init();

    _itemNFT = itemNFT;
    _playerNFT = playerNFT;
    _petNFT = petNFT;
    _worldActions = worldActions;
    _randomnessBeacon = randomnessBeacon;
    _dailyRewardsScheduler = dailyRewardsScheduler;
    _adminAccess = adminAccess;
    _quests = quests;
    _clans = clans;
    _wishingWell = wishingWell;
    _implQueueActions = implQueueActions;
    _implProcessActions = implProcessActions;
    _implRewards = implRewards;
    _implMisc = implMisc;
    _implMisc1 = implMisc1;
    _bridge = bridge;
    _isBeta = isBeta;

    _nextQueueId = 1;
    setAlphaCombatParams(1, 1, 8);
  }

  /// @notice Start actions for a player
  /// @param playerId Id for the player
  /// @param queuedActions Actions to queue
  /// @param queueStrategy Can be either:
  ///                     `ActionQueueStrategy.OVERWRITE_ALL` for overwriting all actions,
  ///                     `ActionQueueStrategy.KEEP_LAST_IN_PROGRESS` when removes any not started actions and keeps the current in-progress one or
  ///                     `ActionQueueStrategy.APPEND` which adds to the end
  function startActions(
    uint256 playerId,
    QueuedActionInput[] calldata queuedActions,
    ActionQueueStrategy queueStrategy
  ) external isOwnerOfPlayerAndActiveMod(playerId) nonReentrant gameNotPaused {
    _startActions(playerId, queuedActions, NONE, 0, 0, 0, queueStrategy);
  }

  /// @notice Start actions for a player, has more advanced options
  /// @param playerId Id for the player
  /// @param queuedActions Actions to queue
  /// @param boostItemTokenId Which boost to consume, can be NONE
  /// @param boostStartReverseIndex when the boost should start. Starts from the end, if it goes too far it starts from the current timestamp.
  /// @param questId Quest to start, can be 0
  /// @param donationAmount Amount to donate, can be 0
  /// @param queueStrategy Can be either:
  ///                     `ActionQueueStrategy.OVERWRITE_ALL` for overwriting all actions,
  ///                     `ActionQueueStrategy.KEEP_LAST_IN_PROGRESS` when removes any not started actions and keeps the current in-progress one or
  ///                     `ActionQueueStrategy.APPEND` which adds to the end
  function startActionsAdvanced(
    uint256 playerId,
    QueuedActionInput[] calldata queuedActions,
    uint16 boostItemTokenId,
    uint8 boostStartReverseIndex, // If true, then the boost will start when the next action starts, else starts now.
    uint256 questId,
    uint256 donationAmount,
    ActionQueueStrategy queueStrategy
  ) external isOwnerOfPlayerAndActiveMod(playerId) nonReentrant gameNotPaused {
    _startActions(
      playerId,
      queuedActions,
      boostItemTokenId,
      boostStartReverseIndex,
      questId,
      donationAmount,
      queueStrategy
    );
  }

  /// @notice Process actions for a player up to the current block timestamp
  function processActions(uint256 playerId) external isOwnerOfPlayerAndActiveMod(playerId) nonReentrant gameNotPaused {
    _processActionsAndSetState(playerId);
  }

  // Callback after minting a player
  function mintedPlayer(
    address from,
    uint256 playerId,
    Skill[2] calldata startSkills,
    bool makeActive,
    uint256[] calldata startingItemTokenIds,
    uint256[] calldata startingAmounts
  ) external override onlyPlayerNFT {
    if (makeActive) {
      _setActivePlayer(from, playerId);
    }

    _delegatecall(
      _implMisc,
      abi.encodeWithSelector(
        IPlayersMiscDelegate.mintedPlayer.selector,
        from,
        playerId,
        startSkills,
        startingItemTokenIds,
        startingAmounts
      )
    );
  }

  function beforeItemNFTTransfer(
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts
  ) external override onlyItemNFT {
    _delegatecall(
      _implMisc1,
      abi.encodeWithSelector(IPlayersMisc1Delegate.beforeItemNFTTransfer.selector, from, to, ids, amounts)
    );
  }

  // Callback after upgrading a player
  function upgradePlayer(uint256 playerId) external override onlyPlayerNFT {
    require(!_isEvolved(playerId), AlreadyUpgraded());

    _players[playerId].packedData = _players[playerId].packedData | (bytes1(uint8(0x1)) << IS_FULL_MODE_BIT);
  }

  // This is a special type of quest.
  function buyBrushQuest(
    address to,
    uint256 playerId,
    uint256 questId,
    bool useExactETH
  ) external payable isOwnerOfPlayerAndActiveMod(playerId) nonReentrant gameNotPaused {
    _delegatecall(
      _implMisc,
      abi.encodeWithSelector(IPlayersDelegate.buyBrushQuest.selector, to, playerId, questId, useExactETH)
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
  /// @param from The owner of the player being transferred
  /// @param playerId The id of the player being transferred
  function clearEverythingBeforeTokenTransfer(address from, uint256 playerId) external override onlyPlayerNFT {
    _clearEverything(from, playerId, true);
    // If it was the active player, then clear it
    uint256 existingActivePlayerId = _activePlayerInfos[from].playerId;
    if (existingActivePlayerId == playerId) {
      delete _activePlayerInfos[from];
      emit SetActivePlayer(from, existingActivePlayerId, 0);
    }
  }

  /// @notice Called by the PlayerNFT contract before a player is transferred to an account
  /// @param to The new owner of the player
  /// @param playerId The id of the player being transferred
  function beforeTokenTransferTo(address to, uint256 playerId) external override onlyPlayerNFT {
    // Does this account have any boosts? If so, then set a lock on the player when trying to set it as active
    uint16[] memory boostItemTokenIds = new uint16[](4);
    boostItemTokenIds[0] = COMBAT_BOOST;
    boostItemTokenIds[1] = XP_BOOST;
    boostItemTokenIds[2] = GATHERING_BOOST;
    boostItemTokenIds[3] = SKILL_BOOST;
    uint256[] memory balances = _itemNFT.balanceOfs(to, boostItemTokenIds);
    bool hasBoost;
    for (uint256 i; i < balances.length; ++i) {
      hasBoost = hasBoost || balances[i] != 0;
    }

    if (hasBoost) {
      // The account this player is being transferred to has a boost nft, so lock the player for 1 day, prevents sharing boosts so easily.
      uint40 cooldownTimestamp = uint40(block.timestamp + 1 days);
      _activeBoosts[playerId].cooldown = cooldownTimestamp;
      emit LockPlayer(playerId, cooldownTimestamp);
    } else if (_activeBoosts[playerId].cooldown > block.timestamp) {
      // Remove the lock when transferring to a player without boosts
      _activeBoosts[playerId].cooldown = 0;
      emit UnlockPlayer(playerId);
    }
  }

  function _clearEverything(address from, uint256 playerId, bool processTheActions) private {
    _delegatecall(
      _implQueueActions,
      abi.encodeWithSelector(IPlayersDelegate.clearEverything.selector, from, playerId, processTheActions)
    );
  }

  function _startActions(
    uint256 playerId,
    QueuedActionInput[] memory queuedActions,
    uint16 boostItemTokenId,
    uint8 boostStartReverseIndex,
    uint256 questId,
    uint256 donationAmount,
    ActionQueueStrategy queueStrategy
  ) private {
    _delegatecall(
      _implQueueActions,
      abi.encodeWithSelector(
        IPlayersDelegate.startActions.selector,
        playerId,
        queuedActions,
        boostItemTokenId,
        boostStartReverseIndex,
        questId,
        donationAmount,
        queueStrategy
      )
    );
  }

  function _processActionsAndSetState(uint256 playerId) private {
    // Read current actions which are completed
    Player storage player = _players[playerId];
    uint256 existingActionQueueLength = player.actionQueue.length;

    bytes memory data = _delegatecall(
      _implProcessActions,
      abi.encodeWithSelector(IPlayersProcessActionsDelegate.processActionsAndSetState.selector, playerId)
    );
    (QueuedAction[] memory remainingQueuedActions, Attire[] memory remainingAttire) = abi.decode(
      data,
      (QueuedAction[], Attire[])
    );
    // Put here due to stack too deep error if doing it inside processActionsAndSetState
    _setInitialCheckpoints(msg.sender, playerId, existingActionQueueLength, remainingQueuedActions, remainingAttire);
  }

  function _setActivePlayer(address from, uint256 playerId) private {
    require(block.timestamp >= _activeBoosts[playerId].cooldown, PlayerLocked());

    uint256 existingActivePlayerId = _activePlayerInfos[from].playerId;
    _activePlayerInfos[from] = ActivePlayerInfo(uint64(playerId), 0, 0, 0, 0);
    require(existingActivePlayerId != playerId, PlayerAlreadyActive());

    if (existingActivePlayerId != 0) {
      _clearEverything(from, existingActivePlayerId, true);
    }
    emit SetActivePlayer(from, existingActivePlayerId, playerId);
  }

  function setActivePlayer(uint256 playerId) external isOwnerOfPlayerMod(playerId) {
    _setActivePlayer(_msgSender(), playerId);
  }

  function donate(uint256 playerId, uint256 amount) external isOwnerOfPlayerOrEmpty(playerId) {
    _donate(_msgSender(), playerId, amount);
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

  function isOwnerOfPlayerAndActive(address from, uint256 playerId) public view override returns (bool) {
    return _playerNFT.balanceOf(from, playerId) == 1 && _activePlayerInfos[from].playerId == playerId;
  }

  function getPendingRandomRewards(uint256 playerId) external view returns (PendingRandomReward[] memory) {
    return _pendingRandomRewards[playerId];
  }

  function getActionQueue(uint256 playerId) external view returns (QueuedAction[] memory) {
    return _players[playerId].actionQueue;
  }

  function getURI(
    uint256 playerId,
    string calldata name,
    string calldata avatarName,
    string calldata avatarDescription,
    string calldata imageURI
  ) external view override returns (string memory) {
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(
        IPlayersMisc1DelegateView.uri.selector,
        name,
        avatarName,
        avatarDescription,
        imageURI,
        playerId
      )
    );
    return abi.decode(data, (string));
  }

  // Staticcall into ourselves and hit the fallback. This is done so that pendingQueuedActionState/dailyClaimedRewards can be exposed on the json abi.
  function getPendingQueuedActionState(
    address owner,
    uint256 playerId
  ) public view returns (PendingQueuedActionState memory) {
    bytes memory data = _staticcall(
      address(this),
      abi.encodeWithSelector(IPlayersRewardsDelegateView.pendingQueuedActionStateImpl.selector, owner, playerId)
    );
    return abi.decode(data, (PendingQueuedActionState));
  }

  function getActivePlayer(address owner) external view override returns (uint256 playerId) {
    return _activePlayerInfos[owner].playerId; // TODO: Can use activePlayerInfo?
  }

  function getActivePlayerInfo(address owner) external view returns (ActivePlayerInfo memory) {
    return _activePlayerInfos[owner];
  }

  function getPlayerXP(uint256 playerId, Skill skill) external view override returns (uint256) {
    return PlayersLibrary._readXP(skill, _playerXP[playerId]);
  }

  function getLevel(uint256 playerId, Skill skill) external view override returns (uint256 level) {
    return PlayersLibrary._getLevel(PlayersLibrary._readXP(skill, _playerXP[playerId]));
  }

  function getTotalXP(uint256 playerId) external view override returns (uint256 totalXP) {
    return _players[playerId].totalXP;
  }

  /* TODO: When there is a new skill can use this to update totalLevel properly (needs testing)
  function calibrate(uint256 playerId) public {
    // Get total level of all skills, check if it matches total level on player
    uint256 end = START_LEVEL + 2; // Accounts for NONE & COMBAT meta-skills
    uint16 totalLevel;
    for (uint256 i = 2; i < end; ++i) {
      Skill skill = Skill(i);
      uint256 skillXP = PlayersLibrary._readXP(skill, _playerXP[playerId]);
      totalLevel += PlayersLibrary._getLevel(skillXP);
    }
    // Set new totalLevel
    _players[playerId].totalLevel = totalLevel;
  } */

  function getTotalLevel(uint256 playerId) external view override returns (uint256 totalLevel) {
    return _players[playerId].totalLevel;
  }

  function getPackedXP(uint256 playerId) external view returns (PackedXP memory) {
    return _playerXP[playerId];
  }

  function getPlayer(uint256 playerId) external view returns (Player memory) {
    return _players[playerId];
  }

  // Only used by tests, could remove and replace with getStorageAt like another test uses
  function getActiveBoost(uint256 playerId) external view override returns (PlayerBoostInfo memory) {
    return _activeBoosts[playerId];
  }

  // Only used by tests, could remove and replace with getStorageAt like another test uses
  function getClanBoost(uint256 clanId) external view returns (PlayerBoostInfo memory) {
    return _clanBoosts[clanId];
  }

  // Only used by tests, could remove and replace with getStorageAt like another test uses
  function getGlobalBoost() external view returns (PlayerBoostInfo memory) {
    return _globalBoost;
  }

  function isPlayerEvolved(uint256 playerId) external view override returns (bool) {
    return _isEvolved(playerId);
  }

  function getAlphaCombatParams()
    external
    view
    override
    returns (uint8 alphaCombat, uint8 betaCombat, uint8 alphaCombatHealing)
  {
    return (_alphaCombat, _betaCombat, _alphaCombatHealing);
  }

  function modifyXP(address from, uint256 playerId, Skill skill, uint56 xp, bool skipEffects) external isXPModifier {
    _delegatecall(
      _implMisc,
      abi.encodeWithSelector(IPlayersMiscDelegate.modifyXP.selector, from, playerId, skill, xp, skipEffects)
    );
  }

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

  function setAlphaCombatParams(uint8 alphaCombat, uint8 betaCombat, uint8 alphaCombatHealing) public onlyOwner {
    _alphaCombat = alphaCombat;
    _betaCombat = betaCombat;
    _alphaCombatHealing = alphaCombatHealing;
    emit SetCombatParams(alphaCombat, betaCombat, alphaCombatHealing);
  }

  function addXPThresholdRewards(XPThresholdReward[] calldata xpThresholdRewards) external onlyOwner {
    _delegatecall(
      _implMisc,
      abi.encodeWithSelector(IPlayersDelegate.addXPThresholdRewards.selector, xpThresholdRewards)
    );
  }

  function editXPThresholdRewards(XPThresholdReward[] calldata xpThresholdRewards) external onlyOwner {
    _delegatecall(
      _implMisc,
      abi.encodeWithSelector(IPlayersDelegate.editXPThresholdRewards.selector, xpThresholdRewards)
    );
  }

  function setDailyRewardsEnabled(bool dailyRewardsEnabled) external onlyOwner {
    _dailyRewardsEnabled = dailyRewardsEnabled;
  }

  function pauseGame(bool gamePaused) external onlyOwner {
    _gamePaused = gamePaused;
    emit GamePaused(gamePaused);
  }

  function addFullAttireBonuses(FullAttireBonusInput[] calldata fullAttireBonuses) external onlyOwner {
    _delegatecall(
      _implMisc1,
      abi.encodeWithSelector(IPlayersDelegate.addFullAttireBonuses.selector, fullAttireBonuses)
    );
  }

  function setXPModifiers(address[] calldata accounts, bool isModifier) external onlyOwner {
    for (uint256 i; i < accounts.length; ++i) {
      _xpModifiers[accounts[i]] = isModifier;
    }
  }

  function bridgePlayer(uint256 playerId, uint256 totalXP, uint256 totalLevel) external onlyBridge {
    Player storage player = _players[playerId];
    player.totalXP = uint48(totalXP);
    player.totalLevel = uint16(totalLevel);
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

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
