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

import {LockedBankVaults} from "./LockedBankVaults.sol";
import {AdminAccess} from "../AdminAccess.sol";
import {ItemNFT} from "../ItemNFT.sol";

import {ClanRank, MAX_CLAN_COMBATANTS, CLAN_WARS_GAS_PRICE_WINDOW_SIZE} from "../globals/clans.sol";
import {Item, EquipPosition} from "../globals/players.sol";
import {BoostType, Skill} from "../globals/misc.sol";
import {BattleResultEnum} from "../globals/clans.sol";

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
    uint48[] attackingPlayerIds,
    uint48[] defendingPlayerIds,
    uint[] attackingRolls,
    uint[] defendingRolls,
    BattleResultEnum[] battleResults,
    Skill[] randomSkills,
    bool didAttackersWin,
    uint attackingClanId,
    uint defendingClanId,
    uint[] randomWords,
    uint territoryId
  );
  event Deposit(uint amount);
  event SetComparableSkills(Skill[] skills);
  event ClaimUnoccupiedTerritory(
    uint territoryId,
    uint clanId,
    address from,
    uint leaderPlayerId,
    uint cooldownTimestamp
  );
  event AssignCombatants(uint clanId, uint48[] playerIds, address from, uint leaderPlayerId, uint cooldownTimestamp);
  event RemoveCombatant(uint playerId, uint clanId);
  event Harvest(uint territoryId, address from, uint playerId, uint cooldownTimestamp, uint amount);
  event UpdateMovingAverageGasPrice(uint movingAverage);
  event SetExpectedGasLimitFulfill(uint expectedGasLimitFulfill);
  event SetBaseAttackCost(uint baseAttackCost);
  event BlockingAttacks(
    uint clanId,
    uint itemTokenId,
    address from,
    uint leaderPlayerId,
    uint blockAttacksTimestamp,
    uint blockAttacksCooldownTimestamp
  );

  error InvalidTerritory();
  error InvalidTerritoryId();
  error InvalidEmissionPercentage();
  error NoOccupier();
  error TransferFailed();
  error NotLeader();
  error ClanAttackingCooldown();
  error NotMemberOfClan();
  error InvalidSkill(Skill skill);
  error LengthMismatch();
  error OnlyClans();
  error OnlyCombatantsHelper();
  error NotOwnerOfPlayerAndActive();
  error HarvestingTooSoon();
  error NotAdminAndBeta();
  error CurrentlyOwnATerritory();
  error NoCombatants();
  error TooManyCombatants();
  error PlayerDefendingLockedVaults();
  error CannotChangeCombatantsDuringAttack();
  error NoEmissionsToHarvest();
  error CannotAttackWhileStillAttacking();
  error AmountTooLow();
  error ClanCombatantsChangeCooldown();
  error NotEnoughFTM();
  error RequestIdNotKnown();
  error ClanIsBlockingAttacks();
  error NotATerritoryDefenceItem();
  error BlockAttacksCooldown();
  error CannotAttackSelf();

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
    uint88 gasPaid;
    uint40 blockAttacksTimestamp;
    uint8 blockAttacksCooldownHours; // Have many hours after blockAttacksTimestamp there is a cooldown for
    uint48[] playerIds;
  }

  struct PendingAttack {
    uint40 clanId;
    uint16 territoryId;
    bool attackInProgress;
    uint40 attackingTimestamp;
    uint40 leaderPlayerId;
    address from;
  }

  mapping(uint pendingAttackId => PendingAttack pendingAttack) private pendingAttacks;
  mapping(bytes32 requestId => uint pendingAttackId) public requestToPendingAttackIds;
  mapping(uint territoryId => Territory territory) public territories;
  address private players;
  uint16 public nextTerritoryId;
  uint64 public nextPendingAttackId;
  IClans public clans;
  AdminAccess private adminAccess;
  bool private isBeta;
  LockedBankVaults private lockedBankVaults;
  ItemNFT private itemNFT;

  mapping(uint clanId => ClanInfo clanInfo) private clanInfos;
  uint16 public totalEmissionPercentage; // Multiplied by PERCENTAGE_EMISSION_MUL
  IBrushToken private brush;

  Skill[] private comparableSkills;

  address private combatantsHelper;

  address public airnode; // The address of the QRNG Airnode
  address public sponsorWallet; // The wallet that will cover the gas costs of the request
  bytes32 public endpointIdUint256; // The endpoint ID for requesting a single random number
  bytes32 public endpointIdUint256Array; // The endpoint ID for requesting an array of random numbers

  uint8 public indexGasPrice;
  uint64 public movingAverageGasPrice;
  uint88 public baseAttackCost; // To offset gas costs in response
  uint24 public expectedGasLimitFulfill;
  uint64[CLAN_WARS_GAS_PRICE_WINDOW_SIZE] private prices;

  uint private constant NUM_WORDS = 2;
  uint public constant MAX_DAILY_EMISSIONS = 10000 ether;
  uint public constant TERRITORY_ATTACKED_COOLDOWN_PLAYER = 24 * 3600;
  uint public constant MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN = 3 days;
  uint public constant PERCENTAGE_EMISSION_MUL = 10;
  uint public constant HARVESTING_COOLDOWN = 8 hours;

  modifier isOwnerOfPlayerAndActive(uint _playerId) {
    if (!IPlayers(players).isOwnerOfPlayerAndActive(msg.sender, _playerId)) {
      revert NotOwnerOfPlayerAndActive();
    }
    _;
  }

  modifier isAtLeastLeaderOfClan(uint _clanId, uint _playerId) {
    if (clans.getRank(_clanId, _playerId) < ClanRank.LEADER) {
      revert NotLeader();
    }
    _;
  }

  modifier isClanMember(uint _clanId, uint _playerId) {
    if (clans.getRank(_clanId, _playerId) == ClanRank.NONE) {
      revert NotMemberOfClan();
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

  modifier onlyCombatantsHelper() {
    if (msg.sender != combatantsHelper) {
      revert OnlyCombatantsHelper();
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
    LockedBankVaults _lockedBankVaults,
    ItemNFT _itemNFT,
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
    players = _players;
    clans = _clans;
    brush = _brush;
    lockedBankVaults = _lockedBankVaults;
    itemNFT = _itemNFT;
    nextTerritoryId = 1;
    nextPendingAttackId = 1;
    adminAccess = _adminAccess;
    isBeta = _isBeta;

    airnode = _airnode;
    endpointIdUint256 = _endpointIdUint256;
    endpointIdUint256Array = _endpointIdUint256Array;

    for (uint i; i < CLAN_WARS_GAS_PRICE_WINDOW_SIZE; ++i) {
      prices[i] = uint64(tx.gasprice);
    }
    _updateMovingAverageGasPrice(uint64(tx.gasprice));
    setBaseAttackCost(0.05 ether);
    setExpectedGasLimitFulfill(300_000);

    setComparableSkills(_comparableSkills);

    brush.approve(address(_lockedBankVaults), type(uint).max);

    _addTerritories(_territories);
  }

  function assignCombatants(
    uint _clanId,
    uint48[] calldata _playerIds,
    uint _combatantCooldownTimestamp,
    uint _leaderPlayerId
  ) external override onlyCombatantsHelper {
    _checkCanAssignCombatants(_clanId, _playerIds);

    clanInfos[_clanId].playerIds = _playerIds;
    clanInfos[_clanId].assignCombatantsCooldownTimestamp = uint40(
      block.timestamp + MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN
    );
    emit AssignCombatants(_clanId, _playerIds, msg.sender, _leaderPlayerId, _combatantCooldownTimestamp);
  }

  // This needs to call the oracle VRF on-demand and costs some ftm
  function attackTerritory(
    uint _clanId,
    uint _territoryId,
    uint _leaderPlayerId
  ) external payable isOwnerOfPlayerAndActive(_leaderPlayerId) isAtLeastLeaderOfClan(_clanId, _leaderPlayerId) {
    uint clanIdOccupier = territories[_territoryId].clanIdOccupier;

    _checkCanAttackTerritory(_clanId, clanIdOccupier, _territoryId);

    // Check they are paying enough
    if (msg.value < attackCost()) {
      revert NotEnoughFTM();
    }

    (bool success, ) = sponsorWallet.call{value: msg.value}("");
    if (!success) {
      revert TransferFailed();
    }

    uint64 _nextPendingAttackId = nextPendingAttackId++;
    uint40 attackingCooldownTimestamp = uint40(block.timestamp + TERRITORY_ATTACKED_COOLDOWN_PLAYER);
    ClanInfo storage clanInfo = clanInfos[_clanId];
    clanInfo.attackingCooldownTimestamp = attackingCooldownTimestamp;
    clanInfo.gasPaid = uint88(msg.value);

    clanInfo.currentlyAttacking = true;
    clanInfos[clanIdOccupier].attackingCooldownTimestamp = uint40(block.timestamp + TERRITORY_ATTACKED_COOLDOWN_PLAYER);

    pendingAttacks[_nextPendingAttackId] = PendingAttack({
      clanId: uint40(_clanId),
      territoryId: uint16(_territoryId),
      attackInProgress: true,
      attackingTimestamp: uint40(block.timestamp),
      leaderPlayerId: uint40(_leaderPlayerId),
      from: msg.sender
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

  /// @notice Called by the Airnode through the AirnodeRrp contract to fulfill the request
  function fulfillRandomWords(bytes32 _requestId, bytes calldata _data) external onlyAirnodeRrp {
    uint[] memory randomWords = abi.decode(_data, (uint[]));
    if (randomWords.length != NUM_WORDS) {
      revert LengthMismatch();
    }

    PendingAttack storage pendingAttack = pendingAttacks[requestToPendingAttackIds[_requestId]];
    if (!pendingAttack.attackInProgress) {
      revert RequestIdNotKnown();
    }

    uint attackingClanId = pendingAttack.clanId;
    uint16 territoryId = pendingAttack.territoryId;
    uint defendingClanId = territories[territoryId].clanIdOccupier;

    _updateAverageGasPrice();
    clanInfos[attackingClanId].currentlyAttacking = false;
    pendingAttack.attackInProgress = false;

    bool clanUnoccupied = defendingClanId == 0;
    if (clanUnoccupied) {
      _claimTerritory(territoryId, attackingClanId);
      emit ClaimUnoccupiedTerritory(
        territoryId,
        attackingClanId,
        pendingAttack.from,
        pendingAttack.leaderPlayerId,
        pendingAttack.attackingTimestamp
      );
      return;
    }

    // If the defenders happened to apply a block attacks item before the attack was fulfilled, then the attack is cancelled
    uint48[] memory attackingPlayerIds;
    uint48[] memory defendingPlayerIds;
    BattleResultEnum[] memory battleResults;
    uint[] memory attackingRolls;
    uint[] memory defendingRolls;
    Skill[] memory randomSkills;
    bool didAttackersWin;
    if (clanInfos[defendingClanId].blockAttacksTimestamp <= block.timestamp) {
      attackingPlayerIds = clanInfos[attackingClanId].playerIds;
      defendingPlayerIds = clanInfos[defendingClanId].playerIds;

      randomSkills = new Skill[](Math.max(attackingPlayerIds.length, defendingPlayerIds.length));
      for (uint i; i < randomSkills.length; ++i) {
        randomSkills[i] = comparableSkills[uint8(randomWords[0] >> (i * 8)) % comparableSkills.length];
      }

      (battleResults, attackingRolls, defendingRolls, didAttackersWin) = ClanBattleLibrary.doBattle(
        players,
        attackingPlayerIds,
        defendingPlayerIds,
        randomSkills,
        randomWords[0],
        randomWords[1]
      );
    }

    emit BattleResult(
      uint(_requestId),
      attackingPlayerIds,
      defendingPlayerIds,
      attackingRolls,
      defendingRolls,
      battleResults,
      randomSkills,
      didAttackersWin,
      attackingClanId,
      defendingClanId,
      randomWords,
      territoryId
    );

    if (didAttackersWin) {
      _claimTerritory(territoryId, attackingClanId);
      // Update old clan
      clanInfos[defendingClanId].ownsTerritoryId = 0;
    }
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
    territory.unclaimedEmissions = 0;
    if (unclaimedEmissions == 0) {
      revert NoEmissionsToHarvest();
    }

    lockedBankVaults.lockFunds(clanId, msg.sender, _playerId, unclaimedEmissions);
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

  function blockAttacks(
    uint _clanId,
    uint16 _itemTokenId,
    uint _playerId
  ) external isOwnerOfPlayerAndActive(_playerId) isClanMember(_clanId, _playerId) {
    Item memory item = itemNFT.getItem(_itemTokenId);
    if (item.equipPosition != EquipPosition.TERRITORY || item.boostType != BoostType.PVP_BLOCK) {
      revert NotATerritoryDefenceItem();
    }

    if (
      clanInfos[_clanId].blockAttacksTimestamp + clanInfos[_clanId].blockAttacksCooldownHours / 3600 > block.timestamp
    ) {
      revert BlockAttacksCooldown();
    }

    uint blockAttacksTimestamp = block.timestamp + item.boostDuration;
    clanInfos[_clanId].blockAttacksTimestamp = uint40(blockAttacksTimestamp);
    clanInfos[_clanId].blockAttacksCooldownHours = uint8(item.boostValue);

    itemNFT.burn(msg.sender, _itemTokenId, 1);

    emit BlockingAttacks(
      _clanId,
      _itemTokenId,
      msg.sender,
      _playerId,
      blockAttacksTimestamp,
      block.timestamp + uint(item.boostValue) * 3600
    );
  }

  // Remove a player combatant if they are currently assigned in this clan
  function clanMemberLeft(uint _clanId, uint _playerId) external override onlyClans {
    // Check if this player is in the defenders list and remove them if so
    ClanInfo storage clanInfo = clanInfos[_clanId];
    if (clanInfo.playerIds.length > 0) {
      uint searchIndex = EstforLibrary.binarySearch(clanInfo.playerIds, _playerId);
      if (searchIndex != type(uint).max) {
        // Not shifting it for gas reasons
        delete clanInfo.playerIds[searchIndex];
        emit RemoveCombatant(_playerId, _clanId);
      }
    }
  }

  function _updateAverageGasPrice() private {
    uint sum = 0;
    prices[indexGasPrice] = uint64(tx.gasprice);
    indexGasPrice = uint8((indexGasPrice + 1) % CLAN_WARS_GAS_PRICE_WINDOW_SIZE);

    for (uint i = 0; i < CLAN_WARS_GAS_PRICE_WINDOW_SIZE; ++i) {
      sum += prices[i];
    }

    _updateMovingAverageGasPrice(uint64(sum / CLAN_WARS_GAS_PRICE_WINDOW_SIZE));
  }

  function _checkCanAssignCombatants(uint _clanId, uint48[] calldata _playerIds) private view {
    if (clanInfos[_clanId].ownsTerritoryId != 0) {
      revert CurrentlyOwnATerritory();
    }

    if (_playerIds.length > MAX_CLAN_COMBATANTS) {
      revert TooManyCombatants();
    }

    // Can only change combatants every so often
    if (clanInfos[_clanId].assignCombatantsCooldownTimestamp > block.timestamp) {
      revert ClanCombatantsChangeCooldown();
    }
  }

  function _checkCanAttackTerritory(uint _clanId, uint _defendingClanId, uint _territoryId) private view {
    if (_clanId == _defendingClanId) {
      revert CannotAttackSelf();
    }

    if (territories[_territoryId].territoryId != _territoryId) {
      revert InvalidTerritory();
    }

    ClanInfo storage clanInfo = clanInfos[_clanId];
    // Must have at least 1 combatant
    if (clanInfo.playerIds.length == 0) {
      revert NoCombatants();
    }

    if (clanInfo.currentlyAttacking) {
      revert CannotChangeCombatantsDuringAttack();
    }

    if (clanInfo.attackingCooldownTimestamp > block.timestamp) {
      revert ClanAttackingCooldown();
    }

    if (clanInfos[_defendingClanId].blockAttacksTimestamp > block.timestamp) {
      revert ClanIsBlockingAttacks();
    }

    if (clanInfo.currentlyAttacking) {
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
  }

  function _updateMovingAverageGasPrice(uint64 _movingAverageGasPrice) private {
    movingAverageGasPrice = _movingAverageGasPrice;
    emit UpdateMovingAverageGasPrice(_movingAverageGasPrice);
  }

  function _claimTerritory(uint _territoryId, uint _attackingClanId) private {
    territories[_territoryId].clanIdOccupier = uint32(_attackingClanId);

    if (clanInfos[_attackingClanId].ownsTerritoryId != 0) {
      // This clan already owns a territory, so unclaim that one
      territories[clanInfos[_attackingClanId].ownsTerritoryId].clanIdOccupier = 0;
    }

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

  function attackCost() public view returns (uint) {
    return baseAttackCost + (movingAverageGasPrice * expectedGasLimitFulfill);
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

  function isCombatant(uint _clanId, uint _playerId) external view override returns (bool combatant) {
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

  function setCombatantsHelper(address _combatantsHelper) external onlyOwner {
    combatantsHelper = _combatantsHelper;
  }

  function setSponsorWallet(address _sponsorWallet) external onlyOwner {
    sponsorWallet = _sponsorWallet;
  }

  function setBaseAttackCost(uint88 _baseAttackCost) public onlyOwner {
    baseAttackCost = _baseAttackCost;
    emit SetBaseAttackCost(_baseAttackCost);
  }

  function setExpectedGasLimitFulfill(uint24 _expectedGasLimitFulfill) public onlyOwner {
    expectedGasLimitFulfill = _expectedGasLimitFulfill;
    emit SetExpectedGasLimitFulfill(_expectedGasLimitFulfill);
  }

  function clearCooldowns(uint _clanId) external isAdminAndBeta {
    ClanInfo storage clanInfo = clanInfos[_clanId];
    clanInfo.attackingCooldownTimestamp = 0;
    clanInfo.assignCombatantsCooldownTimestamp = 0;
    clanInfo.blockAttacksTimestamp = 0;
    clanInfo.blockAttacksCooldownHours = 0;
  }

  // Useful to re-run a battle for testing
  function setAttackInProgress(uint _requestId) public isAdminAndBeta {
    pendingAttacks[requestToPendingAttackIds[bytes32(_requestId)]].attackInProgress = true;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
