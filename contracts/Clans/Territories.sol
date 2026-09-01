// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {PaintswapVRFConsumerUpgradeable} from "@paintswap/vrf/contracts/PaintswapVRFConsumerUpgradeable.sol";

import {IBrushToken} from "../interfaces/external/IBrushToken.sol";
import {IClans} from "../interfaces/IClans.sol";
import {ITerritories} from "../interfaces/ITerritories.sol";
import {ILockedBankVaults} from "../interfaces/ILockedBankVaults.sol";
import {IPlayers} from "../interfaces/IPlayers.sol";
import {IBank} from "../interfaces/IBank.sol";

import {AdminAccess} from "../AdminAccess.sol";
import {ItemNFT} from "../ItemNFT.sol";

import {ClanRank, MAX_CLAN_COMBATANTS, CLAN_WARS_GAS_PRICE_WINDOW_SIZE, XP_EMITTED_ELSEWHERE} from "../globals/clans.sol";
import {Item, EquipPosition} from "../globals/players.sol";
import {BoostType, Skill} from "../globals/misc.sol";
import {BattleResultEnum} from "../globals/clans.sol";

import {ClanBattleLibrary} from "./ClanBattleLibrary.sol";
import {EstforLibrary} from "../EstforLibrary.sol";

import {IActivityPoints, IActivityPointsCaller, ActivityType} from "../ActivityPoints/interfaces/IActivityPoints.sol";

contract Territories is
  UUPSUpgradeable,
  OwnableUpgradeable,
  PaintswapVRFConsumerUpgradeable,
  ITerritories,
  IActivityPointsCaller
{
  using SafeCast for uint256;

  uint256 private constant NUM_WORDS = 7;
  uint256 public constant override MAX_DAILY_EMISSIONS = 10000 ether;
  uint256 public constant override TERRITORY_ATTACKED_COOLDOWN_PLAYER = 24 * 3600;
  uint256 public constant override PERCENTAGE_EMISSION_MUL = 10;
  uint256 public constant override HARVESTING_COOLDOWN = 8 hours;
  uint40 private constant CLAN_XP_GAINED_ON_TERRITORY_WIN = 10;
  address private constant DAO_MULTISIG_ADDRESS = 0xC7073F6317813C3EDB09FA2d19A6cA259A9d4aD9;

  mapping(uint256 pendingAttackId => PendingAttack pendingAttack) private _pendingAttacks;
  mapping(uint256 requestId => uint256 pendingAttackId) private _requestToPendingAttackIds;
  mapping(uint256 territoryId => Territory territory) private _territories;
  address private _players;
  uint16 private _nextTerritoryId;
  uint24 private _attackingCooldown;
  uint56 private _nextPendingAttackId;
  IClans private _clans;
  AdminAccess private _adminAccess;
  bool private _isBeta;
  ILockedBankVaults private _lockedBankVaults;
  ItemNFT private _itemNFT;

  mapping(uint256 clanId => ClanInfo clanInfo) private _clanInfos;
  uint16 private _totalEmissionPercentage; // Multiplied by PERCENTAGE_EMISSION_MUL
  IBrushToken private _brush;

  Skill[] private _comparableSkills;

  address private _combatantsHelper;
  uint8 private _maxClanCombatants;

  address private _unused; // Unused, previously was oracle
  address private _unused1; // Unused, previously was vrfRequestInfo
  uint24 private _combatantChangeCooldown;
  address private _unused2; // Unused, previously was samwitchVRF
  uint24 private _expectedGasLimitFulfill;

  IActivityPoints private _activityPoints;

  modifier isOwnerOfPlayerAndActive(uint256 playerId) {
    require(IPlayers(_players).isOwnerOfPlayerAndActive(_msgSender(), playerId), NotOwnerOfPlayerAndActive());
    _;
  }

  modifier isMinimumRank(uint256 clanId, uint256 playerId, ClanRank clanRank) {
    require(_clans.getRank(clanId, playerId) >= clanRank, RankNotHighEnough());
    _;
  }

  modifier isClanMember(uint256 clanId, uint256 playerId) {
    require(_clans.getRank(clanId, playerId) != ClanRank.NONE, NotMemberOfClan());
    _;
  }

  modifier isAdminAndBeta() {
    require(_adminAccess.isAdmin(_msgSender()) && _isBeta, NotAdminAndBeta());
    _;
  }

  modifier onlyClans() {
    require(_msgSender() == address(_clans), OnlyClans());
    _;
  }

  modifier onlyCombatantsHelper() {
    require(_msgSender() == _combatantsHelper, OnlyCombatantsHelper());
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
    ILockedBankVaults lockedBankVaults,
    ItemNFT itemNFT,
    address paintswapVRFConsumer,
    Skill[] calldata comparableSkills,
    uint8 maxClanCombatants,
    uint24 attackingCooldown,
    AdminAccess adminAccess,
    IActivityPoints activityPoints,
    bool isBeta
  ) external override initializer {
    __Ownable_init(_msgSender());
    __UUPSUpgradeable_init();
    __PaintswapVRFConsumerUpgradeable_init(paintswapVRFConsumer);

    _players = players;
    _clans = clans;
    _brush = brush;
    _lockedBankVaults = lockedBankVaults;
    _itemNFT = itemNFT;

    _activityPoints = activityPoints;

    _nextTerritoryId = 1;
    _nextPendingAttackId = 1;
    _adminAccess = adminAccess;
    _isBeta = isBeta;

    _brush.approve(address(_lockedBankVaults), type(uint256).max);
    _combatantChangeCooldown = isBeta ? 5 minutes : 3 days;

    setAttackCooldown(attackingCooldown);
    setExpectedGasLimitFulfill(3_000_000);
    setComparableSkills(comparableSkills);
    setMaxClanCombatants(maxClanCombatants);
    addTerritories(territories);
  }

  // TODO: remove in prod
  function setActivityPoints(address activityPoints) external override(ITerritories, IActivityPointsCaller) onlyOwner {
    _activityPoints = IActivityPoints(activityPoints);
  }

  function initializeV3(address paintswapVRFConsumer) external override reinitializer(3) {
    __PaintswapVRFConsumerUpgradeable_init(paintswapVRFConsumer);
  }

  function assignCombatants(
    uint256 clanId,
    uint64[] calldata playerIds,
    uint256 combatantCooldownTimestamp,
    uint256 leaderPlayerId
  ) external override onlyCombatantsHelper {
    _checkCanAssignCombatants(clanId, playerIds);

    _clanInfos[clanId].playerIds = playerIds;
    _clanInfos[clanId].assignCombatantsCooldownTimestamp = uint40(block.timestamp + _combatantChangeCooldown);
    emit AssignCombatants(clanId, playerIds, _msgSender(), leaderPlayerId, combatantCooldownTimestamp);
  }

  // This calls the VRF to get the result
  function attackTerritory(
    uint256 clanId,
    uint256 territoryId,
    uint256 leaderPlayerId
  ) external payable override isOwnerOfPlayerAndActive(leaderPlayerId) isMinimumRank(clanId, leaderPlayerId, ClanRank.COLONEL) {
    uint256 clanIdOccupier = _territories[territoryId].clanIdOccupier;

    _checkCanAttackTerritory(clanId, clanIdOccupier, territoryId);

    uint56 nextPendingAttackId = _nextPendingAttackId++;
    uint40 attackingCooldownTimestamp = uint40(block.timestamp + _attackingCooldown);
    ClanInfo storage clanInfo = _clanInfos[clanId];
    clanInfo.attackingCooldownTimestamp = attackingCooldownTimestamp;

    clanInfo.currentlyAttacking = true;

    address msgSender = _msgSender();
    _pendingAttacks[nextPendingAttackId] = PendingAttack({
      clanId: clanId.toUint32(),
      territoryId: uint16(territoryId),
      attackInProgress: true,
      leaderPlayerId: uint40(leaderPlayerId),
      from: msgSender
    });
    uint256 requestId = _requestRandomWords();
    _requestToPendingAttackIds[requestId] = nextPendingAttackId;

    emit AttackTerritory(
      clanId,
      territoryId,
      msgSender,
      leaderPlayerId,
      uint256(requestId),
      nextPendingAttackId,
      attackingCooldownTimestamp
    );

    _activityPoints.rewardBlueTickets(
      ActivityType.territories_evt_attackterritory,
      _clans.getClanBankAddress(clanId),
      IPlayers(_players).isPlayerEvolved(leaderPlayerId),
      1
    );
  }

  /// @notice Called by the PaintswapVRF contract to fulfill the request
  function _fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
    require(randomWords.length == NUM_WORDS, LengthMismatch());

    PendingAttack storage pendingAttack = _pendingAttacks[_requestToPendingAttackIds[requestId]];
    require(pendingAttack.attackInProgress, RequestIdNotKnown());

    uint256 attackingClanId = pendingAttack.clanId;
    uint16 territoryId = pendingAttack.territoryId;
    uint256 defendingClanId = _territories[territoryId].clanIdOccupier;

    _clanInfos[attackingClanId].currentlyAttacking = false;
    pendingAttack.attackInProgress = false;

    bool clanUnoccupied = defendingClanId == 0;
    if (clanUnoccupied) {
      _claimTerritory(territoryId, attackingClanId);

      emit ClaimUnoccupiedTerritory(
        territoryId,
        attackingClanId,
        pendingAttack.from,
        pendingAttack.leaderPlayerId,
        uint256(requestId)
      );

      _activityPoints.rewardBlueTickets(
        ActivityType.territories_evt_claimunoccupiedterritory,
        _clans.getClanBankAddress(attackingClanId),
        IPlayers(_players).isPlayerEvolved(pendingAttack.leaderPlayerId),
        1
      );

      return;
    }

    // If the defenders happened to apply a block attacks item before the attack was fulfilled, then the attack is cancelled
    uint64[] memory attackingPlayerIds;
    uint64[] memory defendingPlayerIds;
    uint8[] memory battleResults;
    uint256[] memory attackingRolls;
    uint256[] memory defendingRolls;
    uint8[] memory randomSkills;
    bool didAttackersWin;
    if (_clanInfos[defendingClanId].blockAttacksTimestamp <= block.timestamp) {
      attackingPlayerIds = _clanInfos[attackingClanId].playerIds;
      defendingPlayerIds = _clanInfos[defendingClanId].playerIds;

      randomSkills = new uint8[](Math.max(attackingPlayerIds.length, defendingPlayerIds.length));
      for (uint256 i; i < randomSkills.length; ++i) {
        randomSkills[i] = uint8(
          _comparableSkills[uint8(randomWords[NUM_WORDS - 1] >> (i * 8)) % _comparableSkills.length]
        );
      }

      (battleResults, attackingRolls, defendingRolls, didAttackersWin) = ClanBattleLibrary._determineBattleOutcome(
        _players,
        attackingPlayerIds,
        defendingPlayerIds,
        randomSkills,
        randomWords,
        0,
        0
      );
    }

    uint40 clanXPGainedWinner = didAttackersWin ? CLAN_XP_GAINED_ON_TERRITORY_WIN : 0;

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
      territoryId,
      clanXPGainedWinner
    );

    if (didAttackersWin) {
      _claimTerritory(territoryId, attackingClanId);
      // Update old clan
      _clanInfos[defendingClanId].ownsTerritoryId = 0;
      _clans.addXP(attackingClanId, clanXPGainedWinner, XP_EMITTED_ELSEWHERE);
    }
  }

  function harvest(
    uint256 territoryId,
    uint256 playerId
  ) external override isOwnerOfPlayerAndActive(playerId) isClanMember(_territories[territoryId].clanIdOccupier, playerId) {
    Territory storage territory = _territories[territoryId];
    uint256 unclaimedEmissions = territory.unclaimedEmissions;

    require(territory.lastClaimTimestamp + HARVESTING_COOLDOWN <= block.timestamp, HarvestingTooSoon());

    territory.lastClaimTimestamp = uint40(block.timestamp);
    territory.unclaimedEmissions = 0;
    require(unclaimedEmissions != 0, NoEmissionsToHarvest());

    _lockedBankVaults.lockFunds(territory.clanIdOccupier, _msgSender(), playerId, unclaimedEmissions);
    emit Harvest(territoryId, _msgSender(), playerId, block.timestamp + HARVESTING_COOLDOWN, unclaimedEmissions);
  }

  function addUnclaimedEmissions(uint256 amount) external override {
    require(amount >= _totalEmissionPercentage, AmountTooLow());

    for (uint256 i = 1; i < _nextTerritoryId; ++i) {
      _territories[i].unclaimedEmissions += uint88(
        (amount * _territories[i].percentageEmissions) / _totalEmissionPercentage
      );
    }

    require(_brush.transferFrom(_msgSender(), address(this), amount), TransferFailed());
    emit Deposit(amount);
  }

  function blockAttacks(
    uint256 clanId,
    uint16 itemTokenId,
    uint256 playerId
  ) external override isOwnerOfPlayerAndActive(playerId) isClanMember(clanId, playerId) {
    Item memory item = _itemNFT.getItem(itemTokenId);
    require(
      item.equipPosition == EquipPosition.TERRITORY && item.boostType == BoostType.PVP_BLOCK,
      NotATerritoryDefenceItem()
    );

    ClanInfo storage clanInfo = _clanInfos[clanId];
    require(
      (clanInfo.blockAttacksTimestamp + uint256(clanInfo.blockAttacksCooldownHours) * 3600) <= block.timestamp,
      BlockAttacksCooldown()
    );

    uint256 blockAttacksTimestamp = block.timestamp + item.boostDuration;
    clanInfo.blockAttacksTimestamp = uint40(blockAttacksTimestamp);
    clanInfo.blockAttacksCooldownHours = uint8(item.boostValue);

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

  function _checkCanAssignCombatants(uint256 clanId, uint64[] calldata playerIds) private view {
    require(playerIds.length <= _maxClanCombatants, TooManyCombatants());
    // Can only change combatants every so often
    require(_clanInfos[clanId].assignCombatantsCooldownTimestamp <= block.timestamp, ClanCombatantsChangeCooldown());
  }

  function _checkCanAttackTerritory(uint256 clanId, uint256 defendingClanId, uint256 territoryId) private view {
    require(clanId != defendingClanId, CannotAttackSelf());

    Territory storage territory = _territories[territoryId];
    require(territory.territoryId == territoryId, InvalidTerritory());
    require(territory.minimumMMR <= _clans.getMMR(clanId), NotEnoughMMR(territory.minimumMMR));

    ClanInfo storage clanInfo = _clanInfos[clanId];
    // Must have at least 1 combatant
    require(clanInfo.playerIds.length != 0, NoCombatants());
    require(!clanInfo.currentlyAttacking, CannotAttackWhileStillAttacking());
    require(clanInfo.attackingCooldownTimestamp <= block.timestamp, ClanAttackingCooldown());
    require(_clanInfos[defendingClanId].blockAttacksTimestamp <= block.timestamp, ClanIsBlockingAttacks());
    require(clanInfo.playerIds.length != 0, CannotChangeCombatantsDuringAttack());
  }

  function _requestRandomWords() private returns (uint256 requestId) {
    requestId = _requestRandomnessPayInNative(_expectedGasLimitFulfill, NUM_WORDS, DAO_MULTISIG_ADDRESS, msg.value);
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
    require(territory.territoryId != 0 && territory.percentageEmissions != 0, InvalidTerritory());
  }

  function getAttackCost() public view override returns (uint256) {
    return _calculateRequestPriceNative(_expectedGasLimitFulfill);
  }

  function getTerrorities() external view override returns (Territory[] memory) {
    Territory[] memory territories = new Territory[](_nextTerritoryId - 1);
    for (uint256 i; i < territories.length; ++i) {
      territories[i] = _territories[i + 1];
    }
    return territories;
  }

  function getClanInfo(uint256 clanId) external view override returns (ClanInfo memory clanInfo) {
    return _clanInfos[clanId];
  }

  function getPendingAttack(uint256 pendingAttackId) external view override returns (PendingAttack memory pendingAttack) {
    return _pendingAttacks[pendingAttackId];
  }

  function getTerritory(uint256 territoryId) external view override returns (Territory memory territory) {
    return _territories[territoryId];
  }

  function getExpectedGasLimitFulfill() external view override returns (uint88 expectedGasLimitFulfill) {
    return _expectedGasLimitFulfill;
  }

  function getTotalEmissionPercentage() external view override returns (uint16 totalEmissionPercentage) {
    return _totalEmissionPercentage;
  }

  function isCombatant(uint256 clanId, uint256 playerId) external view override returns (bool combatant) {
    // Check if this player is in the defenders list and remove them if so
    if (_clanInfos[clanId].playerIds.length != 0) {
      uint256 searchIndex = EstforLibrary._binarySearch(_clanInfos[clanId].playerIds, playerId);
      combatant = searchIndex != type(uint256).max;
    }
  }

  function addTerritories(TerritoryInput[] calldata territories) public override onlyOwner {
    uint256 totalEmissionPercentage = _totalEmissionPercentage;
    uint256 nextTerritoryId = _nextTerritoryId;
    for (uint256 i; i < territories.length; ++i) {
      TerritoryInput calldata territoryInput = territories[i];
      _checkTerritory(territories[i]);
      require(i + nextTerritoryId == territoryInput.territoryId, InvalidTerritoryId());

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

    require(totalEmissionPercentage <= 100 * PERCENTAGE_EMISSION_MUL, InvalidEmissionPercentage());

    _totalEmissionPercentage = uint16(totalEmissionPercentage);
    emit AddTerritories(territories);
  }

  function editTerritories(TerritoryInput[] calldata territories) external override onlyOwner {
    uint256 totalEmissionPercentage = _totalEmissionPercentage;
    for (uint256 i; i < territories.length; ++i) {
      _checkTerritory(territories[i]);
      totalEmissionPercentage -= _territories[territories[i].territoryId].percentageEmissions;
      totalEmissionPercentage += territories[i].percentageEmissions;
      _territories[territories[i].territoryId].percentageEmissions = territories[i].percentageEmissions;
    }

    require(totalEmissionPercentage <= 100 * PERCENTAGE_EMISSION_MUL, InvalidEmissionPercentage());
    _totalEmissionPercentage = uint8(totalEmissionPercentage);
    emit EditTerritories(territories);
  }

  function removeTerritories(uint256[] calldata territoryIds) external override onlyOwner {
    uint256 totalEmissionPercentage = _totalEmissionPercentage;
    for (uint256 i; i < territoryIds.length; ++i) {
      require(_territories[territoryIds[i]].territoryId != 0, InvalidTerritoryId());

      totalEmissionPercentage -= _territories[territoryIds[i]].percentageEmissions;
      delete _territories[territoryIds[i]];
    }

    _totalEmissionPercentage = uint16(totalEmissionPercentage);
    emit RemoveTerritories(territoryIds);
  }

  function setMinimumMMRs(uint256[] calldata territoryIds, uint16[] calldata minimumMMRs) external override onlyOwner {
    require(territoryIds.length == minimumMMRs.length, LengthMismatch());

    for (uint256 i; i < territoryIds.length; ++i) {
      _territories[territoryIds[i]].minimumMMR = minimumMMRs[i];
    }
    emit SetMinimumMMRs(territoryIds, minimumMMRs); // TODO: Currently not used elsewhere
  }

  function setComparableSkills(Skill[] calldata skills) public override onlyOwner {
    for (uint256 i = 0; i < skills.length; ++i) {
      require(skills[i] != Skill.NONE && skills[i] != Skill.COMBAT, InvalidSkill(skills[i]));

      _comparableSkills.push(skills[i]);
    }
    emit SetComparableSkills(skills);
  }

  function setCombatantsHelper(address combatantsHelper) external override onlyOwner {
    _combatantsHelper = combatantsHelper;
  }

  function setExpectedGasLimitFulfill(uint24 expectedGasLimitFulfill) public override onlyOwner {
    _expectedGasLimitFulfill = expectedGasLimitFulfill;
    emit SetExpectedGasLimitFulfill(expectedGasLimitFulfill);
  }

  function setMaxClanCombatants(uint8 maxClanCombatants) public override onlyOwner {
    _maxClanCombatants = maxClanCombatants;
    emit SetMaxClanCombatants(maxClanCombatants);
  }

  function setAttackCooldown(uint24 attackCooldown) public override onlyOwner {
    _attackingCooldown = attackCooldown;
    emit SetAttackCooldown(attackCooldown);
  }

  function clearCooldowns(uint256 clanId) external override isAdminAndBeta {
    ClanInfo storage clanInfo = _clanInfos[clanId];
    clanInfo.attackingCooldownTimestamp = 0;
    clanInfo.assignCombatantsCooldownTimestamp = 0;
    clanInfo.blockAttacksTimestamp = 0;
    clanInfo.blockAttacksCooldownHours = 0;
  }

  // Useful to re-run a battle for testing
  function setAttackInProgress(uint256 requestId) external override isAdminAndBeta {
    _pendingAttacks[_requestToPendingAttackIds[requestId]].attackInProgress = true;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
