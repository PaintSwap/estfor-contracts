// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IBrushToken} from "./interfaces/external/IBrushToken.sol";
import {IPlayers} from "./interfaces/IPlayers.sol";
import {ISamWitchVRF} from "./interfaces/ISamWitchVRF.sol";

import {AdminAccess} from "./AdminAccess.sol";
import {ItemNFT} from "./ItemNFT.sol";
import {VRFRequestInfo} from "./VRFRequestInfo.sol";
import {PlayerNFT} from "./PlayerNFT.sol";

import {Item, EquipPosition} from "./globals/players.sol";
import {BoostType, Skill} from "./globals/misc.sol";
import {BattleResultEnum} from "./globals/clans.sol";

import {EstforLibrary} from "./EstforLibrary.sol";
import {PlayersLibrary} from "./Players/PlayersLibrary.sol";

// For battling a single player vs player
contract PVPBattleground is UUPSUpgradeable, OwnableUpgradeable {
  using SafeCast for uint256;

  event AttackPlayer(
    address from,
    uint256 playerId,
    uint256 defendingPlayerId,
    uint256 requestId,
    uint256 pendingAttackId,
    uint256 attackingCooldownTimestamp
  );
  event BattleResult(
    uint256 requestId,
    uint256 attackingPlayerId,
    uint256 defendingPlayerId,
    uint256[] attackingRolls,
    uint256[] defendingRolls,
    BattleResultEnum[] battleResults,
    Skill[] randomSkills,
    bool didAttackersWin,
    uint256[] randomWords
  );
  event SetComparableSkills(Skill[] skills, uint256 numSkillsToCompare);
  event SetExpectedGasLimitFulfill(uint256 expectedGasLimitFulfill);
  event SetAttackCooldown(uint256 attackCooldown);
  event SetPreventAttacks(bool preventAttacks);

  error TransferFailed();
  error PlayerAttackingCooldown();
  error PlayerIsBlockingAttacks();
  error InvalidSkill(Skill skill);
  error LengthMismatch();
  error NotOwnerOfPlayerAndActive();
  error NotAdminAndBeta();
  error CannotAttackWhileStillAttacking();
  error AmountTooLow();
  error InsufficientCost();
  error RequestIdNotKnown();
  error BlockAttacksCooldown();
  error CannotAttackSelf();
  error CallerNotSamWitchVRF();
  error NotEnoughRandomWords();
  error DefendingPlayerDoesntExist();
  error TooManySkillsToCompare();
  error AttacksPrevented();

  struct PlayerInfo {
    uint40 attackingCooldownTimestamp;
    bool currentlyAttacking;
    uint40 blockAttacksTimestamp;
    uint8 blockAttacksCooldownHours; // Have many hours after blockAttacksTimestamp there is a cooldown for
    //    uint40 numWins;
    //    uint40 numLosses; // Only includes ones that you initiated
    //    uint40 numLossesDefending; // Only includes ones that you were defending
  }

  struct PendingAttack {
    uint64 playerId;
    uint64 defendingPlayerId;
    bool attackInProgress;
  }

  uint256 private constant NUM_WORDS = 3;

  IPlayers private _players;
  uint64 private _nextPendingAttackId;
  uint24 private _attackingCooldown;
  bool private _preventAttacks;
  PlayerNFT private _playerNFT;
  AdminAccess private _adminAccess;
  bool private _isBeta;
  ItemNFT private _itemNFT;

  IBrushToken private _brush;

  address private _oracle;
  VRFRequestInfo private _vrfRequestInfo;
  ISamWitchVRF private _samWitchVRF;
  uint24 private _expectedGasLimitFulfill;
  uint8 private _numSkillsToCompare;

  Skill[] private _comparableSkills;
  mapping(uint256 playerId => PlayerInfo playerInfo) private _playerInfos;
  mapping(uint256 pendingAttackId => PendingAttack pendingAttack) private _pendingAttacks;
  mapping(bytes32 requestId => uint256 pendingAttackId) private _requestToPendingAttackIds;

  modifier isOwnerOfPlayerAndActive(uint256 playerId) {
    require(_players.isOwnerOfPlayerAndActive(_msgSender(), playerId), NotOwnerOfPlayerAndActive());
    _;
  }

  modifier isAdminAndBeta() {
    require(_adminAccess.isAdmin(_msgSender()) && _isBeta, NotAdminAndBeta());
    _;
  }

  /// @dev Reverts if the caller is not the SamWitchVRF contract.
  modifier onlySamWitchVRF() {
    require(_msgSender() == address(_samWitchVRF), CallerNotSamWitchVRF());
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    IPlayers players,
    PlayerNFT playerNFT,
    IBrushToken brush,
    ItemNFT itemNFT,
    address oracle,
    ISamWitchVRF samWitchVRF,
    VRFRequestInfo vrfRequestInfo,
    Skill[] calldata comparableSkills,
    uint24 pvpAttackingCooldown,
    AdminAccess adminAccess,
    bool isBeta
  ) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init(_msgSender());

    _players = players;
    _playerNFT = playerNFT;
    _brush = brush;
    _itemNFT = itemNFT;
    _oracle = oracle;
    _samWitchVRF = samWitchVRF;
    _vrfRequestInfo = vrfRequestInfo;

    _nextPendingAttackId = 1;
    _adminAccess = adminAccess;
    _isBeta = isBeta;

    setAttackCooldown(pvpAttackingCooldown);
    setExpectedGasLimitFulfill(1_000_000);
    setComparableSkills(comparableSkills, 8);
  }

  // This needs to call the oracle VRF on-demand and calls the callback
  function attackPlayer(
    uint256 playerId,
    uint256 defendingPlayerId
  ) external payable isOwnerOfPlayerAndActive(playerId) {
    require(!_preventAttacks, AttacksPrevented());
    _checkCanAttackPlayer(playerId, defendingPlayerId);

    // Check they are paying enough
    require(msg.value >= getAttackCost(), InsufficientCost());

    (bool success, ) = _oracle.call{value: msg.value}("");
    require(success, TransferFailed());

    uint64 nextPendingAttackId = _nextPendingAttackId++;
    uint40 attackingCooldownTimestamp = uint40(block.timestamp + _attackingCooldown);
    PlayerInfo storage playerInfo = _playerInfos[playerId];
    playerInfo.attackingCooldownTimestamp = attackingCooldownTimestamp;
    playerInfo.currentlyAttacking = true;

    _pendingAttacks[nextPendingAttackId] = PendingAttack({
      playerId: playerId.toUint48(),
      defendingPlayerId: defendingPlayerId.toUint48(),
      attackInProgress: true
    });
    bytes32 requestId = _requestRandomWords();
    _requestToPendingAttackIds[requestId] = nextPendingAttackId;
    emit AttackPlayer(
      _msgSender(),
      playerId,
      defendingPlayerId,
      uint256(requestId),
      nextPendingAttackId,
      attackingCooldownTimestamp
    );
  }

  /// @notice Called by the SamWitchVRF contract to fulfill the request
  function fulfillRandomWords(bytes32 requestId, uint256[] calldata randomWords) external onlySamWitchVRF {
    require(randomWords.length == NUM_WORDS, LengthMismatch());

    PendingAttack storage pendingAttack = _pendingAttacks[_requestToPendingAttackIds[requestId]];
    require(pendingAttack.defendingPlayerId != 0, RequestIdNotKnown());

    uint64 attackingPlayerId = pendingAttack.playerId;
    uint64 defendingPlayerId = pendingAttack.defendingPlayerId;

    _vrfRequestInfo.updateAverageGasPrice();
    _playerInfos[attackingPlayerId].currentlyAttacking = false;
    pendingAttack.defendingPlayerId = 0; // Used as a sentinel

    // If the defenders happened to apply a block attacks item before the attack was fulfilled, then the attack is cancelled
    BattleResultEnum[] memory battleResults;
    uint256[] memory attackingRolls;
    uint256[] memory defendingRolls;
    Skill[] memory randomSkills;
    bool didAttackersWin;
    if (_playerInfos[defendingPlayerId].blockAttacksTimestamp <= block.timestamp) {
      randomSkills = _getUniqueRandomSkills(randomWords);

      (battleResults, attackingRolls, defendingRolls, didAttackersWin) = determineBattleOutcome(
        attackingPlayerId,
        defendingPlayerId,
        randomSkills,
        randomWords,
        0,
        0
      );
    }

    emit BattleResult(
      uint256(requestId),
      attackingPlayerId,
      defendingPlayerId,
      attackingRolls,
      defendingRolls,
      battleResults,
      randomSkills,
      didAttackersWin,
      randomWords
    );
  }

  function _getUniqueRandomSkills(uint256[] memory randomWords) private view returns (Skill[] memory randomSkills) {
    // Create a copy of the skills array that we can modify
    uint256 originalLength = _comparableSkills.length;
    Skill[] memory availableSkills = new Skill[](originalLength);
    for (uint256 i; i < originalLength; ++i) {
      availableSkills[i] = _comparableSkills[i];
    }

    uint256 numSkillsToCompare = _numSkillsToCompare;
    randomSkills = new Skill[](numSkillsToCompare);
    uint256 remainingSkills = availableSkills.length;

    for (uint256 i; i < numSkillsToCompare; ++i) {
      // Get random index from remaining skills
      uint256 randomIndex = uint8(randomWords[NUM_WORDS - 1] >> (i * 8)) % remainingSkills;

      // Store selected skill
      randomSkills[i] = availableSkills[randomIndex];

      // Move last element to the selected position to avoid duplicates
      --remainingSkills;
      if (randomIndex != remainingSkills) {
        availableSkills[randomIndex] = availableSkills[remainingSkills];
      }
    }

    return randomSkills;
  }

  function _checkCanAttackPlayer(uint256 playerId, uint256 defendingPlayerId) private view {
    require(playerId != defendingPlayerId, CannotAttackSelf());

    PlayerInfo storage playerInfo = _playerInfos[playerId];
    require(playerInfo.attackingCooldownTimestamp <= block.timestamp, PlayerAttackingCooldown());
    require(!playerInfo.currentlyAttacking, CannotAttackWhileStillAttacking());

    PlayerInfo storage defendingPlayerInfo = _playerInfos[defendingPlayerId];
    require(defendingPlayerInfo.blockAttacksTimestamp <= block.timestamp, PlayerIsBlockingAttacks());

    require(_playerNFT.exists(defendingPlayerId), DefendingPlayerDoesntExist());
  }

  function _requestRandomWords() private returns (bytes32 requestId) {
    requestId = _samWitchVRF.requestRandomWords(NUM_WORDS, _expectedGasLimitFulfill);
  }

  function determineBattleOutcome(
    uint64 playerId, // [In/Out] gets shuffled
    uint64 defendingPlayerId, // [In/Out] gets shuffled
    Skill[] memory skills,
    uint256[] memory randomWords, // [1] is for the dice rolls for the attacker, [2] is for the dice rolls for the defender, [0] isn't used here. It's for the skills
    uint256 extraRollsA,
    uint256 extraRollsB
  )
    public
    view
    returns (BattleResultEnum[] memory battleResults, uint256[] memory rollsA, uint256[] memory rollsB, bool didAWin)
  {
    require(randomWords.length >= 2, NotEnoughRandomWords());

    battleResults = new BattleResultEnum[](skills.length);
    rollsA = new uint256[](skills.length);
    rollsB = new uint256[](skills.length);

    uint256 numWinnersA;
    uint256 numWinnersB;
    IPlayers players = _players;
    bool playerAUpgraded = players.isPlayerEvolved(playerId);
    bool playerBUpgraded = players.isPlayerEvolved(defendingPlayerId);

    for (uint256 i; i < skills.length; ++i) {
      // It's possible that there are empty entries if they left the clan
      uint256 levelA = PlayersLibrary._getLevel(players.getPlayerXP(playerId, Skill(skills[i])));
      uint256 levelB = PlayersLibrary._getLevel(players.getPlayerXP(defendingPlayerId, Skill(skills[i])));
      if (levelA > 20 * 12 || levelB > 20 * 12) {
        assert(false); // Unsupported
      }

      // Get two consecutive bytes for each player's rolls
      bytes2 bytesA = bytes2(uint16(randomWords[0] >> (i * 16)));
      bytes2 bytesB = bytes2(uint16(randomWords[1] >> (i * 16)));

      uint256 numRollsA = (levelA / 20) + (playerAUpgraded ? 2 : 1) + extraRollsA;
      // Check how many bits are set based on the number of rolls
      for (uint256 j; j < numRollsA; ++j) {
        rollsA[i] += uint16(bytesA >> j) & 1;
      }
      uint256 numRollsB = (levelB / 20) + (playerBUpgraded ? 2 : 1) + extraRollsB;
      for (uint256 j; j < numRollsB; ++j) {
        rollsB[i] += uint16(bytesB >> j) & 1;
      }

      if (rollsA[i] > rollsB[i]) {
        ++numWinnersA;
        battleResults[i] = BattleResultEnum.WIN;
      } else if (rollsB[i] > rollsA[i]) {
        ++numWinnersB;
        battleResults[i] = BattleResultEnum.LOSE;
      } else {
        battleResults[i] = BattleResultEnum.DRAW;
      }
    }

    didAWin = numWinnersA >= numWinnersB;
  }

  function getPlayerInfo(uint256 playerId) external view returns (PlayerInfo memory) {
    return _playerInfos[playerId];
  }

  function getAttackCost() public view returns (uint256) {
    (uint64 movingAverageGasPrice, uint88 baseRequestCost) = _vrfRequestInfo.get();
    return baseRequestCost + (movingAverageGasPrice * _expectedGasLimitFulfill);
  }

  function getPendingAttack(uint256 pendingAttackId) external view returns (PendingAttack memory pendingAttack) {
    return _pendingAttacks[pendingAttackId];
  }

  function getExpectedGasLimitFulfill() external view returns (uint88 expectedGasLimitFulfill) {
    return _expectedGasLimitFulfill;
  }

  function setComparableSkills(Skill[] calldata skills, uint8 numSkillsToCompare) public onlyOwner {
    require(numSkillsToCompare <= skills.length, TooManySkillsToCompare());
    for (uint256 i = 0; i < skills.length; ++i) {
      require(skills[i] != Skill.NONE && skills[i] != Skill.COMBAT, InvalidSkill(skills[i]));

      _comparableSkills.push(skills[i]);
    }

    _numSkillsToCompare = numSkillsToCompare;
    emit SetComparableSkills(skills, numSkillsToCompare);
  }

  function setExpectedGasLimitFulfill(uint24 expectedGasLimitFulfill) public onlyOwner {
    _expectedGasLimitFulfill = expectedGasLimitFulfill;
    emit SetExpectedGasLimitFulfill(expectedGasLimitFulfill);
  }

  function setAttackCooldown(uint24 attackCooldown) public onlyOwner {
    _attackingCooldown = attackCooldown;
    emit SetAttackCooldown(attackCooldown);
  }

  // TODO: Can delete if necessary
  function setPreventAttacks(bool preventAttacks) external onlyOwner {
    _preventAttacks = preventAttacks;
    emit SetPreventAttacks(preventAttacks);
  }

  function clearCooldowns(uint256 playerId) external isAdminAndBeta {
    // TODO:
  }

  // Useful to re-run a battle for testing
  function setAttackInProgress(uint256 requestId) external isAdminAndBeta {
    _pendingAttacks[_requestToPendingAttackIds[bytes32(requestId)]].attackInProgress = true;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
