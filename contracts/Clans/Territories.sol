// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UUPSUpgradeable} from "../ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../ozUpgradeable/access/OwnableUpgradeable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {RrpRequesterV0Upgradeable} from "../legacy/RrpRequesterV0Upgradeable.sol";
import {IBrushToken} from "../interfaces/IBrushToken.sol";
import {IClans} from "../interfaces/IClans.sol";
import {ITerritories} from "../interfaces/ITerritories.sol";
import {IClanMemberLeftCB} from "../interfaces/IClanMemberLeftCB.sol";
import {IPlayers} from "../interfaces/IPlayers.sol";
import {IBank} from "../interfaces/IBank.sol";
import {ISamWitchVRF} from "../interfaces/ISamWitchVRF.sol";

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
  event RemoveTerritories(uint256[] territoryIds);
  event SetMinimumMMRs(uint256[] territoryIds, uint16[] minimumMMRs);
  event AttackTerritory(
    uint256 clanId,
    uint256 territoryId,
    address from,
    uint256 leaderPlayerId,
    uint256 requestId,
    uint256 pendingAttackId,
    uint256 attackingCooldownTimestamp
  );
  event BattleResult(
    uint256 requestId,
    uint48[] attackingPlayerIds,
    uint48[] defendingPlayerIds,
    uint256[] attackingRolls,
    uint256[] defendingRolls,
    BattleResultEnum[] battleResults,
    Skill[] randomSkills,
    bool didAttackersWin,
    uint256 attackingClanId,
    uint256 defendingClanId,
    uint256[] randomWords,
    uint256 territoryId
  );
  event Deposit(uint256 amount);
  event SetComparableSkills(Skill[] skills);
  event ClaimUnoccupiedTerritoryV2(
    uint256 territoryId,
    uint256 clanId,
    address from,
    uint256 leaderPlayerId,
    uint256 requestId
  );
  event AssignCombatants(
    uint256 clanId,
    uint48[] playerIds,
    address from,
    uint256 leaderPlayerId,
    uint256 cooldownTimestamp
  );
  event RemoveCombatant(uint256 playerId, uint256 clanId);
  event Harvest(uint256 territoryId, address from, uint256 playerId, uint256 cooldownTimestamp, uint256 amount);
  event UpdateMovingAverageGasPrice(uint256 movingAverage);
  event SetExpectedGasLimitFulfill(uint256 expectedGasLimitFulfill);
  event SetBaseAttackCost(uint256 baseAttackCost);
  event BlockingAttacks(
    uint256 clanId,
    uint256 itemTokenId,
    address from,
    uint256 leaderPlayerId,
    uint256 blockAttacksTimestamp,
    uint256 blockAttacksCooldownTimestamp
  );

  // Legacy for ABI/old event purposes
  event ClaimUnoccupiedTerritory(
    uint256 territoryId,
    uint256 clanId,
    address from,
    uint256 leaderPlayerId,
    uint256 cooldownTimestamp
  );

  error InvalidTerritory();
  error InvalidTerritoryId();
  error InvalidEmissionPercentage();
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
  error CallerNotSamWitchVRF();
  error NotEnoughMMR(uint256 minimumMMR);

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
    uint16 minimumMMR;
  }

  struct ClanInfo {
    uint16 ownsTerritoryId;
    uint40 attackingCooldownTimestamp;
    uint40 assignCombatantsCooldownTimestamp;
    bool currentlyAttacking;
    uint88 gasPaid; // TODO remove in migration
    uint40 blockAttacksTimestamp;
    uint8 blockAttacksCooldownHours; // Have many hours after blockAttacksTimestamp there is a cooldown for
    uint48[] playerIds;
  }

  struct PendingAttack {
    uint40 clanId;
    uint16 territoryId;
    bool attackInProgress;
    uint40 leaderPlayerId;
    address from;
  }

  mapping(uint256 pendingAttackId => PendingAttack pendingAttack) private _pendingAttacks;
  mapping(bytes32 requestId => uint256 pendingAttackId) private _requestToPendingAttackIds;
  mapping(uint256 territoryId => Territory territory) private _territories;
  address private _players;
  uint16 private _nextTerritoryId;
  uint64 private _nextPendingAttackId;
  IClans private _clans;
  AdminAccess private _adminAccess;
  bool private _isBeta;
  LockedBankVaults private _lockedBankVaults;
  ItemNFT private _itemNFT;

  mapping(uint256 clanId => ClanInfo clanInfo) private _clanInfos;
  uint16 public _totalEmissionPercentage; // Multiplied by PERCENTAGE_EMISSION_MUL
  IBrushToken private _brush;

  Skill[] private comparableSkills;

  address private _combatantsHelper;

  uint8 public indexGasPrice;
  uint64 public _movingAverageGasPrice;
  uint88 public _baseAttackCost; // To offset gas costs in response
  uint24 public _expectedGasLimitFulfill;
  uint64[CLAN_WARS_GAS_PRICE_WINDOW_SIZE] private prices;

  address private oracle;
  uint24 private combatantChangeCooldown;
  ISamWitchVRF private samWitchVRF;

  uint256 private constant NUM_WORDS = 3;
  uint256 private constant CALLBACK_GAS_LIMIT = 3_000_000;
  uint256 public constant MAX_DAILY_EMISSIONS = 10000 ether;
  uint256 public constant TERRITORY_ATTACKED_COOLDOWN_PLAYER = 24 * 3600;
  uint256 public constant PERCENTAGE_EMISSION_MUL = 10;
  uint256 public constant HARVESTING_COOLDOWN = 8 hours;

  modifier isOwnerOfPlayerAndActive(uint256 playerId) {
    if (!IPlayers(_players).isOwnerOfPlayerAndActive(_msgSender(), playerId)) {
      revert NotOwnerOfPlayerAndActive();
    }
    _;
  }

  modifier isAtLeastLeaderOfClan(uint256 clanId, uint256 playerId) {
    if (_clans.getRank(clanId, playerId) < ClanRank.LEADER) {
      revert NotLeader();
    }
    _;
  }

  modifier isClanMember(uint256 clanId, uint256 playerId) {
    if (_clans.getRank(clanId, playerId) == ClanRank.NONE) {
      revert NotMemberOfClan();
    }
    _;
  }

  modifier onlyClans() {
    if (_msgSender() != address(_clans)) {
      revert OnlyClans();
    }
    _;
  }

  modifier isAdminAndBeta() {
    if (!(_adminAccess.isAdmin(_msgSender()) && _isBeta)) {
      revert NotAdminAndBeta();
    }
    _;
  }

  modifier onlyCombatantsHelper() {
    if (_msgSender() != _combatantsHelper) {
      revert OnlyCombatantsHelper();
    }
    _;
  }

  /// @dev Reverts if the caller is not the SamWitchVRF contract.
  modifier onlySamWitchVRF() {
    if (_msgSender() != address(samWitchVRF)) {
      revert CallerNotSamWitchVRF();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    TerritoryInput[] calldata territories,
    address players,
    IClans clans,
    IBrushToken brush,
    LockedBankVaults lockedBankVaults,
    ItemNFT itemNFT,
    address _oracle,
    ISamWitchVRF _samWitchVRF,
    Skill[] calldata _comparableSkills,
    AdminAccess adminAccess,
    bool isBeta
  ) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();
    _players = players;
    _clans = clans;
    _brush = brush;
    _lockedBankVaults = lockedBankVaults;
    _itemNFT = itemNFT;
    oracle = _oracle;
    samWitchVRF = _samWitchVRF;
    _nextTerritoryId = 1;
    _nextPendingAttackId = 1;
    _adminAccess = adminAccess;
    _isBeta = isBeta;

    for (uint256 i; i < CLAN_WARS_GAS_PRICE_WINDOW_SIZE; ++i) {
      prices[i] = uint64(tx.gasprice);
    }
    _updateMovingAverageGasPrice(uint64(tx.gasprice));
    setBaseAttackCost(0.01 ether);
    _setExpectedGasLimitFulfill(1_500_000);

    setComparableSkills(_comparableSkills);

    _brush.approve(address(_lockedBankVaults), type(uint256).max);
    combatantChangeCooldown = _isBeta ? 5 minutes : 3 days;

    _addTerritories(territories);
  }

  function assignCombatants(
    uint256 clanId,
    uint48[] calldata playerIds,
    uint256 combatantCooldownTimestamp,
    uint256 leaderPlayerId
  ) external override onlyCombatantsHelper {
    _checkCanAssignCombatants(clanId, playerIds);

    _clanInfos[clanId].playerIds = playerIds;
    _clanInfos[clanId].assignCombatantsCooldownTimestamp = uint40(block.timestamp + combatantChangeCooldown);
    emit AssignCombatants(clanId, playerIds, _msgSender(), leaderPlayerId, combatantCooldownTimestamp);
  }

  // This needs to call the oracle VRF on-demand and calls the callback
  function attackTerritory(
    uint256 clanId,
    uint256 territoryId,
    uint256 leaderPlayerId
  ) external payable isOwnerOfPlayerAndActive(leaderPlayerId) isAtLeastLeaderOfClan(clanId, leaderPlayerId) {
    uint256 clanIdOccupier = _territories[territoryId].clanIdOccupier;

    _checkCanAttackTerritory(clanId, clanIdOccupier, territoryId);

    // Check they are paying enough
    if (msg.value < getAttackCost()) {
      revert NotEnoughFTM();
    }

    (bool success, ) = oracle.call{value: msg.value}("");
    if (!success) {
      revert TransferFailed();
    }

    uint64 nextPendingAttackId = _nextPendingAttackId++;
    uint40 attackingCooldownTimestamp = uint40(block.timestamp + TERRITORY_ATTACKED_COOLDOWN_PLAYER);
    ClanInfo storage clanInfo = _clanInfos[clanId];
    clanInfo.attackingCooldownTimestamp = attackingCooldownTimestamp;

    clanInfo.currentlyAttacking = true;

    _pendingAttacks[nextPendingAttackId] = PendingAttack({
      clanId: uint40(clanId),
      territoryId: uint16(territoryId),
      attackInProgress: true,
      leaderPlayerId: uint40(leaderPlayerId),
      from: _msgSender()
    });
    bytes32 requestId = _requestRandomWords();
    _requestToPendingAttackIds[requestId] = nextPendingAttackId;

    emit AttackTerritory(
      clanId,
      territoryId,
      _msgSender(),
      leaderPlayerId,
      uint256(requestId),
      nextPendingAttackId,
      attackingCooldownTimestamp
    );
  }

  /// @notice Called by the SamWitchVRF contract to fulfill the request
  function fulfillRandomWords(bytes32 requestId, uint256[] calldata randomWords) external onlySamWitchVRF {
    if (randomWords.length != NUM_WORDS) {
      revert LengthMismatch();
    }

    PendingAttack storage pendingAttack = _pendingAttacks[_requestToPendingAttackIds[requestId]];
    if (!pendingAttack.attackInProgress) {
      revert RequestIdNotKnown();
    }

    uint256 attackingClanId = pendingAttack.clanId;
    uint16 territoryId = pendingAttack.territoryId;
    uint256 defendingClanId = _territories[territoryId].clanIdOccupier;

    _updateAverageGasPrice();
    _clanInfos[attackingClanId].currentlyAttacking = false;
    pendingAttack.attackInProgress = false;

    bool clanUnoccupied = defendingClanId == 0;
    if (clanUnoccupied) {
      _claimTerritory(territoryId, attackingClanId);
      emit ClaimUnoccupiedTerritoryV2(
        territoryId,
        attackingClanId,
        pendingAttack.from,
        pendingAttack.leaderPlayerId,
        uint256(requestId)
      );
      return;
    }

    // If the defenders happened to apply a block attacks item before the attack was fulfilled, then the attack is cancelled
    uint48[] memory attackingPlayerIds;
    uint48[] memory defendingPlayerIds;
    BattleResultEnum[] memory battleResults;
    uint256[] memory attackingRolls;
    uint256[] memory defendingRolls;
    Skill[] memory randomSkills;
    bool didAttackersWin;
    if (_clanInfos[defendingClanId].blockAttacksTimestamp <= block.timestamp) {
      attackingPlayerIds = _clanInfos[attackingClanId].playerIds;
      defendingPlayerIds = _clanInfos[defendingClanId].playerIds;

      randomSkills = new Skill[](Math.max(attackingPlayerIds.length, defendingPlayerIds.length));
      for (uint256 i; i < randomSkills.length; ++i) {
        randomSkills[i] = comparableSkills[uint8(randomWords[2] >> (i * 8)) % comparableSkills.length];
      }

      (battleResults, attackingRolls, defendingRolls, didAttackersWin) = ClanBattleLibrary.doBattle(
        _players,
        attackingPlayerIds,
        defendingPlayerIds,
        randomSkills,
        [randomWords[0], randomWords[1]],
        0,
        0
      );
    }

    emit BattleResult(
      uint256(requestId),
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
      _clanInfos[defendingClanId].ownsTerritoryId = 0;
    }
  }

  function harvest(
    uint256 territoryId,
    uint256 playerId
  ) external isOwnerOfPlayerAndActive(playerId) isClanMember(_territories[territoryId].clanIdOccupier, playerId) {
    Territory storage territory = _territories[territoryId];
    uint256 unclaimedEmissions = territory.unclaimedEmissions;

    if (territory.lastClaimTimestamp + HARVESTING_COOLDOWN > block.timestamp) {
      revert HarvestingTooSoon();
    }

    territory.lastClaimTimestamp = uint40(block.timestamp);
    territory.unclaimedEmissions = 0;
    if (unclaimedEmissions == 0) {
      revert NoEmissionsToHarvest();
    }

    _lockedBankVaults.lockFunds(territory.clanIdOccupier, _msgSender(), playerId, unclaimedEmissions);
    emit Harvest(territoryId, _msgSender(), playerId, block.timestamp + HARVESTING_COOLDOWN, unclaimedEmissions);
  }

  function addUnclaimedEmissions(uint256 amount) external {
    if (amount < _totalEmissionPercentage) {
      revert AmountTooLow();
    }

    for (uint256 i = 1; i < _nextTerritoryId; ++i) {
      _territories[i].unclaimedEmissions += uint88(
        (amount * _territories[i].percentageEmissions) / _totalEmissionPercentage
      );
    }

    if (!_brush.transferFrom(_msgSender(), address(this), amount)) {
      revert TransferFailed();
    }
    emit Deposit(amount);
  }

  function blockAttacks(
    uint256 clanId,
    uint16 itemTokenId,
    uint256 playerId
  ) external isOwnerOfPlayerAndActive(playerId) isClanMember(clanId, playerId) {
    Item memory item = _itemNFT.getItem(itemTokenId);
    if (item.equipPosition != EquipPosition.TERRITORY || item.boostType != BoostType.PVP_BLOCK) {
      revert NotATerritoryDefenceItem();
    }

    if (
      (_clanInfos[clanId].blockAttacksTimestamp + uint256(_clanInfos[clanId].blockAttacksCooldownHours) * 3600) >
      block.timestamp
    ) {
      revert BlockAttacksCooldown();
    }

    uint256 blockAttacksTimestamp = block.timestamp + item.boostDuration;
    _clanInfos[clanId].blockAttacksTimestamp = uint40(blockAttacksTimestamp);
    _clanInfos[clanId].blockAttacksCooldownHours = uint8(item.boostValue);

    _itemNFT.burn(_msgSender(), itemTokenId, 1);

    emit BlockingAttacks(
      clanId,
      itemTokenId,
      _msgSender(),
      playerId,
      blockAttacksTimestamp,
      blockAttacksTimestamp + uint256(item.boostValue) * 3600
    );
  }

  function clanMemberLeft(uint256 clanId, uint256 playerId) external override onlyClans {
    // Remove a player combatant if they are currently assigned in this clan
    ClanInfo storage clanInfo = _clanInfos[clanId];
    if (clanInfo.playerIds.length != 0) {
      uint256 searchIndex = EstforLibrary._binarySearch(clanInfo.playerIds, playerId);
      if (searchIndex != type(uint256).max) {
        // Shift the whole array to delete the element
        for (uint256 i = searchIndex; i < clanInfo.playerIds.length - 1; ++i) {
          clanInfo.playerIds[i] = clanInfo.playerIds[i + 1];
        }
        clanInfo.playerIds.pop();
        emit RemoveCombatant(playerId, clanId);
      }
    }
  }

  function _updateAverageGasPrice() private {
    uint256 sum = 0;
    prices[indexGasPrice] = uint64(tx.gasprice);
    indexGasPrice = uint8((indexGasPrice + 1) % CLAN_WARS_GAS_PRICE_WINDOW_SIZE);

    for (uint256 i = 0; i < CLAN_WARS_GAS_PRICE_WINDOW_SIZE; ++i) {
      sum += prices[i];
    }

    _updateMovingAverageGasPrice(uint64(sum / CLAN_WARS_GAS_PRICE_WINDOW_SIZE));
  }

  function _checkCanAssignCombatants(uint256 clanId, uint48[] calldata playerIds) private view {
    if (playerIds.length > MAX_CLAN_COMBATANTS) {
      revert TooManyCombatants();
    }

    // Can only change combatants every so often
    if (_clanInfos[clanId].assignCombatantsCooldownTimestamp > block.timestamp) {
      revert ClanCombatantsChangeCooldown();
    }
  }

  function _checkCanAttackTerritory(uint256 clanId, uint256 defendingClanId, uint256 territoryId) private view {
    if (clanId == defendingClanId) {
      revert CannotAttackSelf();
    }

    Territory storage territory = _territories[territoryId];
    if (territory.territoryId != territoryId) {
      revert InvalidTerritory();
    }

    if (territory.minimumMMR > _clans.getMMR(clanId)) {
      revert NotEnoughMMR(territory.minimumMMR);
    }

    ClanInfo storage clanInfo = _clanInfos[clanId];
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

    if (_clanInfos[defendingClanId].blockAttacksTimestamp > block.timestamp) {
      revert ClanIsBlockingAttacks();
    }

    if (clanInfo.currentlyAttacking) {
      revert CannotAttackWhileStillAttacking();
    }
  }

  function _requestRandomWords() private returns (bytes32 requestId) {
    requestId = samWitchVRF.requestRandomWords(NUM_WORDS, CALLBACK_GAS_LIMIT);
  }

  function _updateMovingAverageGasPrice(uint64 movingAverageGasPrice) private {
    _movingAverageGasPrice = movingAverageGasPrice;
    emit UpdateMovingAverageGasPrice(movingAverageGasPrice);
  }

  function _claimTerritory(uint256 territoryId, uint256 attackingClanId) private {
    _territories[territoryId].clanIdOccupier = uint32(attackingClanId);

    if (_clanInfos[attackingClanId].ownsTerritoryId != 0) {
      // This clan already owns a territory, so unclaim that one
      _territories[_clanInfos[attackingClanId].ownsTerritoryId].clanIdOccupier = 0;
    }

    _clanInfos[attackingClanId].ownsTerritoryId = uint16(territoryId);
  }

  function _checkTerritory(TerritoryInput calldata territory) private pure {
    if (territory.territoryId == 0 || territory.percentageEmissions == 0) {
      revert InvalidTerritory();
    }
  }

  function _addTerritories(TerritoryInput[] calldata territories) private {
    uint256 totalEmissionPercentage = _totalEmissionPercentage;
    uint256 nextTerritoryId = _nextTerritoryId;
    for (uint256 i; i < territories.length; ++i) {
      TerritoryInput calldata territoryInput = territories[i];
      _checkTerritory(territories[i]);
      if (i + nextTerritoryId != territoryInput.territoryId) {
        revert InvalidTerritoryId();
      }

      _territories[territoryInput.territoryId] = Territory({
        territoryId: territoryInput.territoryId,
        clanIdOccupier: 0,
        percentageEmissions: territoryInput.percentageEmissions,
        unclaimedEmissions: 0,
        lastClaimTimestamp: 0,
        minimumMMR: 0
      });
      totalEmissionPercentage += territoryInput.percentageEmissions;
    }

    _nextTerritoryId = uint16(nextTerritoryId + territories.length);

    if (totalEmissionPercentage > 100 * PERCENTAGE_EMISSION_MUL) {
      revert InvalidEmissionPercentage();
    }

    _totalEmissionPercentage = uint16(totalEmissionPercentage);
    emit AddTerritories(territories);
  }

  function _setExpectedGasLimitFulfill(uint24 expectedGasLimitFulfill) private {
    _expectedGasLimitFulfill = expectedGasLimitFulfill;
    emit SetExpectedGasLimitFulfill(expectedGasLimitFulfill);
  }

  function getAttackCost() public view returns (uint256) {
    return _baseAttackCost + (_movingAverageGasPrice * _expectedGasLimitFulfill);
  }

  function getTerrorities() external view returns (Territory[] memory) {
    Territory[] memory territories = new Territory[](_nextTerritoryId - 1);
    for (uint256 i; i < territories.length; ++i) {
      territories[i] = _territories[i + 1];
    }
    return territories;
  }

  function getClanInfo(uint256 clanId) external view returns (ClanInfo memory clanInfo) {
    return _clanInfos[clanId];
  }

  function getPendingAttack(uint256 pendingAttackId) external view returns (PendingAttack memory pendingAttack) {
    return _pendingAttacks[pendingAttackId];
  }

  function getTerritory(uint256 territoryId) external view returns (Territory memory territory) {
    return _territories[territoryId];
  }

  function getMovingAverageGasPrice() external view returns (uint64 movingAverageGasPrice) {
    return _movingAverageGasPrice;
  }

  function getBaseAttackCost() external view returns (uint88 baseAttachCost) {
    return _baseAttackCost;
  }

  function getExpectedGasLimitFulfill() external view returns (uint88 expectedGasLimitFulfill) {
    return _expectedGasLimitFulfill;
  }

  function getTotalEmissionPercentage() external view returns (uint16 totalEmissionPercentage) {
    return _totalEmissionPercentage;
  }

  function isCombatant(uint256 clanId, uint256 playerId) external view override returns (bool combatant) {
    // Check if this player is in the defenders list and remove them if so
    if (_clanInfos[clanId].playerIds.length != 0) {
      uint256 searchIndex = EstforLibrary._binarySearch(_clanInfos[clanId].playerIds, playerId);
      combatant = searchIndex != type(uint256).max;
    }
  }

  function addTerritories(TerritoryInput[] calldata territories) external onlyOwner {
    _addTerritories(territories);
  }

  function editTerritories(TerritoryInput[] calldata territories) external onlyOwner {
    uint256 totalEmissionPercentage = _totalEmissionPercentage;
    for (uint256 i; i < territories.length; ++i) {
      _checkTerritory(territories[i]);
      totalEmissionPercentage -= _territories[territories[i].territoryId].percentageEmissions;
      totalEmissionPercentage += territories[i].percentageEmissions;
      _territories[territories[i].territoryId].percentageEmissions = territories[i].percentageEmissions;
    }

    if (totalEmissionPercentage > 100 * PERCENTAGE_EMISSION_MUL) {
      revert InvalidEmissionPercentage();
    }
    _totalEmissionPercentage = uint8(totalEmissionPercentage);
    emit EditTerritories(territories);
  }

  function removeTerritories(uint256[] calldata territoryIds) external onlyOwner {
    uint256 totalEmissionPercentage = _totalEmissionPercentage;
    for (uint256 i; i < territoryIds.length; ++i) {
      if (_territories[territoryIds[i]].territoryId == 0) {
        revert InvalidTerritoryId();
      }

      totalEmissionPercentage -= _territories[territoryIds[i]].percentageEmissions;
      delete _territories[territoryIds[i]];
    }

    _totalEmissionPercentage = uint16(totalEmissionPercentage);
    emit RemoveTerritories(territoryIds);
  }

  function setMinimumMMRs(uint256[] calldata territoryIds, uint16[] calldata minimumMMRs) external onlyOwner {
    if (territoryIds.length != minimumMMRs.length) {
      revert LengthMismatch();
    }

    for (uint256 i; i < territoryIds.length; ++i) {
      _territories[territoryIds[i]].minimumMMR = minimumMMRs[i];
    }
    emit SetMinimumMMRs(territoryIds, minimumMMRs); // TODO: Currently not used elsewhere
  }

  function setComparableSkills(Skill[] calldata skills) public onlyOwner {
    for (uint256 i = 0; i < skills.length; ++i) {
      if (skills[i] == Skill.NONE || skills[i] == Skill.COMBAT) {
        revert InvalidSkill(skills[i]);
      }

      comparableSkills.push(skills[i]);
    }
    emit SetComparableSkills(skills);
  }

  function setCombatantsHelper(address combatantsHelper) external onlyOwner {
    _combatantsHelper = combatantsHelper;
  }

  function setBaseAttackCost(uint88 baseAttackCost) public onlyOwner {
    _baseAttackCost = baseAttackCost;
    emit SetBaseAttackCost(baseAttackCost);
  }

  function setExpectedGasLimitFulfill(uint24 expectedGasLimitFulfill) public onlyOwner {
    _setExpectedGasLimitFulfill(expectedGasLimitFulfill);
  }

  function clearCooldowns(uint256 clanId) external isAdminAndBeta {
    ClanInfo storage clanInfo = _clanInfos[clanId];
    clanInfo.attackingCooldownTimestamp = 0;
    clanInfo.assignCombatantsCooldownTimestamp = 0;
    clanInfo.blockAttacksTimestamp = 0;
    clanInfo.blockAttacksCooldownHours = 0;
  }

  // Useful to re-run a battle for testing
  function setAttackInProgress(uint256 requestId) external isAdminAndBeta {
    _pendingAttacks[_requestToPendingAttackIds[bytes32(requestId)]].attackInProgress = true;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
