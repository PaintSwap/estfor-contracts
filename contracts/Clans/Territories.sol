// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UUPSUpgradeable} from "../ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../ozUpgradeable/access/OwnableUpgradeable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {RrpRequesterV0Upgradeable} from "../RrpRequesterV0Upgradeable.sol";
import {IBrushToken} from "../interfaces/IBrushToken.sol";
import {IClans} from "../interfaces/IClans.sol";
import {ITerritories} from "../interfaces/ITerritories.sol";
import {IClanMemberLeftCB} from "../interfaces/IClanMemberLeftCB.sol";
import {IPlayers} from "../interfaces/IPlayers.sol";
import {IBank} from "../interfaces/IBank.sol";

import {LockedBankVault} from "./LockedBankVault.sol";
import {AdminAccess} from "../AdminAccess.sol";

import {ClanRank, MAX_CLAN_COMBATANTS} from "../globals/clans.sol";
import {Skill} from "../globals/misc.sol";

import {ClanBattleLibrary} from "./ClanBattleLibrary.sol";
import {EstforLibrary} from "../EstforLibrary.sol";

contract Territories is
  RrpRequesterV0Upgradeable,
  UUPSUpgradeable,
  OwnableUpgradeable,
  ITerritories,
  IClanMemberLeftCB
{
  event AddTerritories(TerritoryInput[] territories);
  event EditTerritories(TerritoryInput[] territories);
  event RemoveTerritories(uint[] territoryIds);
  event AttackTerritory(
    uint clanId,
    uint territoryId,
    address from,
    uint leaderPlayerId,
    uint requestId,
    uint pendingAttackId,
    uint attackingCooldownTimestamp
  );
  event BattleResult(
    uint requestId,
    uint[] winnerPlayerIds,
    uint[] loserPlayerIds,
    Skill[] randomSkills,
    bool didAttackersWin,
    uint attackingClanId,
    uint defendingClanId,
    uint[] randomWords,
    uint attackingTimestamp,
    uint territoryId
  );
  event Deposit(uint amount);
  event SetComparableSkills(Skill[] skills);
  event ClaimUnoccupiedTerritory(uint territoryId, uint clanId, address from, uint leaderPlayerId);
  event AssignCombatants(uint clanId, uint48[] playerIds, address from, uint leaderPlayerId, uint cooldownTimestamp);
  event RemoveCombatant(uint playerId, uint clanId);
  event Harvest(uint territoryId, address from, uint playerId, uint cooldownTimestamp, uint amount);

  error InvalidTerritory();
  error InvalidTerritoryId();
  error InvalidEmissionPercentage();
  error NoOccupier();
  error TransferFailed();
  error AlreadyOwnATerritory();
  error NotLeader();
  error ClanAttackingCooldown();
  error NotMemberOfClan();
  error InvalidSkill(Skill skill);
  error LengthMismatch();
  error OnlyClans();
  error PlayerIdsNotSortedOrDuplicates();
  error NotOwnerOfPlayerAndActive();
  error HarvestingTooSoon();
  error NotAdminAndBeta();
  error CurrentlyOwnATerritory();
  error NoCombatants();
  error TooManyCombatants();
  error PlayerCombatantCooldownTimestamp();
  error PlayerDefendingLockedVaults();
  error CannotChangeCombatantsDuringAttack();
  error NoEmissionsToHarvest();
  error CannotAttackWhileStillAttacking();
  error AmountTooLow();
  error RequestIdNotKnown();

  struct TerritoryInput {
    uint16 territoryId;
    uint16 percentageEmissions; // Is multiplied by PERCENTAGE_EMISSION_MUL
  }

  struct Territory {
    uint16 territoryId; // TODO: Could be removed if necessary
    uint16 percentageEmissions; // Is multiplied by PERCENTAGE_EMISSION_MUL
    uint40 clanIdOccupier;
    uint88 unclaimedEmissions;
    uint40 lastClaimTimestamp;
  }

  struct ClanInfo {
    uint16 ownsTerritoryId;
    uint40 attackingCooldownTimestamp;
    uint40 assignCombatantsCooldownTimestamp;
    bool currentlyAttacking;
    uint48[] playerIds;
  }

  struct PlayerInfo {
    uint40 combatantCooldownTimestamp;
  }

  struct PendingAttack {
    uint40 clanId;
    uint16 territoryId;
    uint40 timestamp;
    bool attackInProgress;
  }

  mapping(uint pendingAttackId => PendingAttack pendingAttack) private pendingAttacks;
  mapping(bytes32 requestId => uint pendingAttackId) public requestToPendingAttackIds;
  mapping(uint territoryId => Territory territory) public territories;
  address public players;
  uint16 public nextTerritoryId;
  uint64 public nextPendingAttackId;
  IClans public clans;
  AdminAccess public adminAccess;
  bool isBeta;
  LockedBankVault public lockedBankVault;

  mapping(uint clanId => ClanInfo clanInfo) private clanInfos;
  uint16 public totalEmissionPercentage; // Multiplied by PERCENTAGE_EMISSION_MUL
  IBrushToken public brush;

  mapping(uint playerId => PlayerInfo playerInfo) public playerInfos;

  Skill[] private comparableSkills;

  address public airnode; // The address of the QRNG Airnode
  bytes32 public endpointIdUint256; // The endpoint ID for requesting a single random number
  bytes32 public endpointIdUint256Array; // The endpoint ID for requesting an array of random numbers
  address public sponsorWallet; // The wallet that will cover the gas costs of the request

  mapping(bytes32 => bool) public expectingRequestWithIdToBeFulfilled;
  uint public constant WINDOW_SIZE = 4;

  uint64[WINDOW_SIZE] private prices;
  uint8 public index;
  uint64 public movingAverage;
  uint private constant NUM_WORDS = 2;
  uint public constant MAX_DAILY_EMISSIONS = 10000 ether;
  uint public constant TERRITORY_ATTACKED_COOLDOWN_PLAYER = 24 * 3600;
  uint public constant MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN = 3 days;
  uint public constant COMBATANT_COOLDOWN = MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN;
  uint public constant PERCENTAGE_EMISSION_MUL = 10;
  uint public constant HARVESTING_COOLDOWN = 8 hours;

  modifier isOwnerOfPlayerAndActive(uint _playerId) {
    if (!IPlayers(players).isOwnerOfPlayerAndActive(msg.sender, _playerId)) {
      revert NotOwnerOfPlayerAndActive();
    }
    _;
  }

  modifier isLeaderOfClan(uint _clanId, uint _playerId) {
    if (clans.getRank(_clanId, _playerId) < ClanRank.LEADER) {
      revert NotLeader();
    }
    _;
  }

  modifier onlyClans() {
    if (msg.sender != address(clans)) {
      revert OnlyClans();
    }
    _;
  }

  modifier isAdminAndBeta() {
    if (!(adminAccess.isAdmin(msg.sender) && isBeta)) {
      revert NotAdminAndBeta();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    TerritoryInput[] calldata _territories,
    address _players,
    IClans _clans,
    IBrushToken _brush,
    LockedBankVault _lockedBankVault,
    Skill[] calldata _comparableSkills,
    address _airnodeRrp,
    address _airnode,
    bytes32 _endpointIdUint256,
    bytes32 _endpointIdUint256Array,
    AdminAccess _adminAccess,
    bool _isBeta
  ) external initializer {
    __RrpRequesterV0_init(_airnodeRrp);
    __UUPSUpgradeable_init();
    __Ownable_init();
    clans = _clans;
    brush = _brush;
    lockedBankVault = _lockedBankVault;
    players = _players;
    nextTerritoryId = 1;
    nextPendingAttackId = 1;
    adminAccess = _adminAccess;
    isBeta = _isBeta;

    airnode = _airnode;
    endpointIdUint256 = _endpointIdUint256;
    endpointIdUint256Array = _endpointIdUint256Array;

    for (uint i; i < WINDOW_SIZE; ++i) {
      prices[i] = uint64(tx.gasprice);
    }

    setComparableSkills(_comparableSkills);

    brush.approve(address(_lockedBankVault), type(uint).max);

    _addTerritories(_territories);
  }

  function assignCombatants(
    uint _clanId,
    uint48[] calldata _playerIds,
    uint _leaderPlayerId
  ) external isOwnerOfPlayerAndActive(_leaderPlayerId) isLeaderOfClan(_clanId, _leaderPlayerId) {
    _checkCanAssignCombatants(_clanId, _playerIds);

    for (uint i; i < _playerIds.length; ++i) {
      playerInfos[_playerIds[i]].combatantCooldownTimestamp = uint40(block.timestamp + COMBATANT_COOLDOWN);
    }

    clanInfos[_clanId].playerIds = _playerIds;
    clanInfos[_clanId].assignCombatantsCooldownTimestamp = uint40(
      block.timestamp + MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN
    );
    emit AssignCombatants(_clanId, _playerIds, msg.sender, _leaderPlayerId, block.timestamp + COMBATANT_COOLDOWN);
  }

  // This needs to call the oracle VRF on-demand and costs some brush
  function attackTerritory(
    uint _clanId,
    uint _territoryId,
    uint _leaderPlayerId
  ) external isOwnerOfPlayerAndActive(_leaderPlayerId) isLeaderOfClan(_clanId, _leaderPlayerId) {
    _checkCanAttackTerritory(_clanId, _territoryId);

    uint64 _nextPendingAttackId = nextPendingAttackId++;
    uint clanIdOccupier = territories[_territoryId].clanIdOccupier;
    bool clanUnoccupied = clanIdOccupier == 0;

    uint40 attackingCooldownTimestamp = uint40(block.timestamp + TERRITORY_ATTACKED_COOLDOWN_PLAYER);
    clanInfos[_clanId].attackingCooldownTimestamp = attackingCooldownTimestamp;

    // In theory this could be done in the fulfill callback, but it's easier to do it here and be consistent witht he player defenders/
    // which are set here to reduce amount of gas used by oracle callback
    if (clanUnoccupied) {
      _claimTerritory(_territoryId, _clanId);
      emit ClaimUnoccupiedTerritory(_territoryId, _clanId, msg.sender, _leaderPlayerId);
    } else {
      clanInfos[_clanId].currentlyAttacking = true;
      clanInfos[clanIdOccupier].attackingCooldownTimestamp = uint40(
        block.timestamp + TERRITORY_ATTACKED_COOLDOWN_PLAYER
      );

      pendingAttacks[_nextPendingAttackId] = PendingAttack({
        clanId: uint40(_clanId),
        territoryId: uint16(_territoryId),
        timestamp: uint40(block.timestamp),
        attackInProgress: true
      });
      bytes32 requestId = _requestRandomWords();
      requestToPendingAttackIds[requestId] = _nextPendingAttackId;

      emit AttackTerritory(
        _clanId,
        _territoryId,
        msg.sender,
        _leaderPlayerId,
        uint(requestId),
        _nextPendingAttackId,
        attackingCooldownTimestamp
      );
    }
  }

  /// @notice Called by the Airnode through the AirnodeRrp contract to fulfill the request
  function fulfillRandomWords(bytes32 _requestId, bytes calldata _data) external onlyAirnodeRrp {
    if (!expectingRequestWithIdToBeFulfilled[_requestId]) {
      revert RequestIdNotKnown();
    }
    expectingRequestWithIdToBeFulfilled[_requestId] = false;
    uint[] memory randomWords = abi.decode(_data, (uint[]));
    if (randomWords.length != NUM_WORDS) {
      revert LengthMismatch();
    }

    PendingAttack storage pendingAttack = pendingAttacks[requestToPendingAttackIds[_requestId]];
    uint attackingClanId = pendingAttack.clanId;
    uint48[] storage playerIdAttackers = clanInfos[attackingClanId].playerIds;
    uint16 territoryId = pendingAttack.territoryId;
    uint defendingClanId = territories[territoryId].clanIdOccupier;
    uint48[] storage playerIdDefenders = clanInfos[defendingClanId].playerIds;

    Skill[] memory randomSkills = new Skill[](Math.max(playerIdAttackers.length, playerIdDefenders.length));
    for (uint i; i < randomSkills.length; ++i) {
      randomSkills[i] = comparableSkills[uint8(randomWords[0] >> (i * 8)) % comparableSkills.length];
    }

    (uint[] memory winners, uint[] memory losers, bool didAttackersWin) = ClanBattleLibrary.doBattle(
      players,
      playerIdAttackers,
      playerIdDefenders,
      randomSkills,
      randomWords[0],
      randomWords[1]
    );

    uint timestamp = pendingAttack.timestamp;
    pendingAttack.attackInProgress = false;
    clanInfos[attackingClanId].currentlyAttacking = false;

    if (didAttackersWin) {
      _claimTerritory(territoryId, attackingClanId);
      // Update old clan
      clanInfos[defendingClanId].ownsTerritoryId = 0;
    }
    emit BattleResult(
      uint(_requestId),
      winners,
      losers,
      randomSkills,
      didAttackersWin,
      attackingClanId,
      defendingClanId,
      randomWords,
      timestamp,
      territoryId
    );
  }

  function harvest(uint _territoryId, uint _playerId) external isOwnerOfPlayerAndActive(_playerId) {
    Territory storage territory = territories[_territoryId];
    uint clanId = territory.clanIdOccupier;
    if (clanId == 0) {
      revert NoOccupier();
    }

    uint unclaimedEmissions = territory.unclaimedEmissions;

    if (territory.lastClaimTimestamp + HARVESTING_COOLDOWN > block.timestamp) {
      revert HarvestingTooSoon();
    }

    territory.lastClaimTimestamp = uint40(block.timestamp);
    if (unclaimedEmissions == 0) {
      revert NoEmissionsToHarvest();
    }
    lockedBankVault.lockFunds(clanId, msg.sender, _playerId, unclaimedEmissions);
    emit Harvest(_territoryId, msg.sender, _playerId, block.timestamp + HARVESTING_COOLDOWN, unclaimedEmissions);
  }

  function addUnclaimedEmissions(uint _amount) external {
    if (_amount < totalEmissionPercentage) {
      revert AmountTooLow();
    }

    for (uint i = 1; i < nextTerritoryId; ++i) {
      territories[i].unclaimedEmissions += uint88(
        (_amount * territories[i].percentageEmissions) / totalEmissionPercentage
      );
    }

    if (!brush.transferFrom(msg.sender, address(this), _amount)) {
      revert TransferFailed();
    }
    emit Deposit(_amount);
  }

  // Remove a player combatant if they are currently assigned in this clan
  function clanMemberLeft(uint _clanId, uint _playerId) external override onlyClans {
    // Check if this player is in the defenders list and remove them if so
    if (clanInfos[_clanId].playerIds.length > 0) {
      uint searchIndex = EstforLibrary.binarySearch(clanInfos[_clanId].playerIds, _playerId);
      if (searchIndex != type(uint).max) {
        // Not shifting it for gas reasons
        delete clanInfos[_clanId].playerIds[searchIndex];
        emit RemoveCombatant(_playerId, _clanId);
      }
    }
  }

  function _checkCanAssignCombatants(uint _clanId, uint48[] calldata _playerIds) private view {
    if (clanInfos[_clanId].ownsTerritoryId != 0) {
      revert CurrentlyOwnATerritory();
    }

    if (_playerIds.length == 0) {
      revert NoCombatants();
    }

    if (_playerIds.length > MAX_CLAN_COMBATANTS) {
      revert TooManyCombatants();
    }

    // Check the cooldown periods on player combatants (because they might have just joined another clan)
    for (uint i; i < _playerIds.length; ++i) {
      if (playerInfos[_playerIds[i]].combatantCooldownTimestamp > block.timestamp) {
        revert PlayerCombatantCooldownTimestamp();
      }

      // Check they are part of the clan
      if (clans.getRank(_clanId, _playerIds[i]) == ClanRank.NONE) {
        revert NotMemberOfClan();
      }

      // Check they are not combatants in locked vaults
      bool isDefendingALockedVault = lockedBankVault.isCombatant(_clanId, _playerIds[i]);
      if (isDefendingALockedVault) {
        revert PlayerDefendingLockedVaults();
      }

      if (i != _playerIds.length - 1 && _playerIds[i] >= _playerIds[i + 1]) {
        revert PlayerIdsNotSortedOrDuplicates();
      }
    }
  }

  function _checkCanAttackTerritory(uint _clanId, uint _territoryId) private view {
    if (territories[_territoryId].territoryId != _territoryId) {
      revert InvalidTerritory();
    }

    // Must have at least 1 combatant
    if (clanInfos[_clanId].playerIds.length == 0) {
      revert NoCombatants();
    }

    if (clanInfos[_clanId].currentlyAttacking) {
      revert CannotChangeCombatantsDuringAttack();
    }

    if (clanInfos[_clanId].ownsTerritoryId != 0) {
      revert AlreadyOwnATerritory();
    }

    if (clanInfos[_clanId].attackingCooldownTimestamp > block.timestamp) {
      revert ClanAttackingCooldown();
    }

    if (clanInfos[_clanId].currentlyAttacking) {
      revert CannotAttackWhileStillAttacking();
    }
  }

  function _requestRandomWords() private returns (bytes32 requestId) {
    requestId = airnodeRrp.makeFullRequest(
      airnode,
      endpointIdUint256Array,
      address(this),
      sponsorWallet,
      address(this),
      this.fulfillRandomWords.selector,
      // Using Airnode ABI to encode the parameters
      abi.encode(bytes32("1u"), bytes32("size"), NUM_WORDS)
    );
    expectingRequestWithIdToBeFulfilled[requestId] = true;
  }

  function _claimTerritory(uint _territoryId, uint _attackingClanId) private {
    territories[_territoryId].clanIdOccupier = uint32(_attackingClanId);
    clanInfos[_attackingClanId].ownsTerritoryId = uint16(_territoryId);
  }

  function _checkTerritory(TerritoryInput calldata _territory) private pure {
    if (_territory.territoryId == 0 || _territory.percentageEmissions == 0) {
      revert InvalidTerritory();
    }
  }

  function _addTerritories(TerritoryInput[] calldata _territories) private {
    uint _totalEmissionPercentage = totalEmissionPercentage;
    uint _nextTerritoryId = nextTerritoryId;
    for (uint i; i < _territories.length; ++i) {
      TerritoryInput calldata territoryInput = _territories[i];
      _checkTerritory(_territories[i]);
      if (i + _nextTerritoryId != territoryInput.territoryId) {
        revert InvalidTerritoryId();
      }

      territories[territoryInput.territoryId] = Territory({
        territoryId: territoryInput.territoryId,
        clanIdOccupier: 0,
        percentageEmissions: territoryInput.percentageEmissions,
        unclaimedEmissions: 0,
        lastClaimTimestamp: 0
      });
      _totalEmissionPercentage += territoryInput.percentageEmissions;
    }

    nextTerritoryId = uint16(_nextTerritoryId + _territories.length);

    if (_totalEmissionPercentage > 100 * PERCENTAGE_EMISSION_MUL) {
      revert InvalidEmissionPercentage();
    }

    totalEmissionPercentage = uint16(_totalEmissionPercentage);
    emit AddTerritories(_territories);
  }

  function getTerrorities() external view returns (Territory[] memory) {
    Territory[] memory _territories = new Territory[](nextTerritoryId - 1);
    for (uint i; i < _territories.length; ++i) {
      _territories[i] = territories[i + 1];
    }
    return _territories;
  }

  function getClanInfo(uint _clanId) external view returns (ClanInfo memory clanInfo) {
    return clanInfos[_clanId];
  }

  function getPendingAttack(uint _pendingAttackId) external view returns (PendingAttack memory pendingAttack) {
    return pendingAttacks[_pendingAttackId];
  }

  function isCombatant(uint _clanId, uint _playerId) external view returns (bool combatant) {
    // Check if this player is in the defenders list and remove them if so
    if (clanInfos[_clanId].playerIds.length > 0) {
      uint searchIndex = EstforLibrary.binarySearch(clanInfos[_clanId].playerIds, _playerId);
      combatant = searchIndex != type(uint).max;
    }
  }

  function addTerritories(TerritoryInput[] calldata _territories) external onlyOwner {
    _addTerritories(_territories);
  }

  function editTerritories(TerritoryInput[] calldata _territories) external onlyOwner {
    uint _totalEmissionPercentage = totalEmissionPercentage;
    for (uint i; i < _territories.length; ++i) {
      _checkTerritory(_territories[i]);
      _totalEmissionPercentage -= territories[_territories[i].territoryId].percentageEmissions;
      _totalEmissionPercentage += _territories[i].percentageEmissions;
      territories[_territories[i].territoryId].percentageEmissions = _territories[i].percentageEmissions;
    }

    if (_totalEmissionPercentage > 100 * PERCENTAGE_EMISSION_MUL) {
      revert InvalidEmissionPercentage();
    }
    totalEmissionPercentage = uint8(_totalEmissionPercentage);
    emit EditTerritories(_territories);
  }

  function removeTerritories(uint[] calldata _territoryIds) external onlyOwner {
    uint _totalEmissionPercentage = totalEmissionPercentage;
    for (uint i; i < _territoryIds.length; ++i) {
      if (territories[_territoryIds[i]].territoryId == 0) {
        revert InvalidTerritoryId();
      }

      _totalEmissionPercentage -= territories[_territoryIds[i]].percentageEmissions;
      delete territories[_territoryIds[i]];
    }

    totalEmissionPercentage = uint16(_totalEmissionPercentage);
    emit RemoveTerritories(_territoryIds);
  }

  function setComparableSkills(Skill[] calldata _skills) public onlyOwner {
    for (uint i = 0; i < _skills.length; ++i) {
      if (_skills[i] == Skill.NONE || _skills[i] == Skill.COMBAT) {
        revert InvalidSkill(_skills[i]);
      }

      comparableSkills.push(_skills[i]);
    }
    emit SetComparableSkills(_skills);
  }

  function setSponsorWallet(address _sponsorWallet) external onlyOwner {
    sponsorWallet = _sponsorWallet;
  }

  function clearCooldowns(uint _clanId) external isAdminAndBeta {
    clanInfos[_clanId].attackingCooldownTimestamp = 0;
    clanInfos[_clanId].assignCombatantsCooldownTimestamp = 0;
    for (uint i; i < clanInfos[_clanId].playerIds.length; ++i) {
      playerInfos[clanInfos[_clanId].playerIds[i]].combatantCooldownTimestamp = 0;
    }
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
