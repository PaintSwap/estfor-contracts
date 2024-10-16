// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";
import {BitMaps} from "@openzeppelin/contracts/utils/structs/BitMaps.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IOracleRewardCB} from "./interfaces/IOracleRewardCB.sol";
import {IPlayers} from "./interfaces/IPlayers.sol";
import {IRouterV2} from "./interfaces/IRouterV2.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

// solhint-disable-next-line no-global-import
import "./globals/all.sol";

contract Quests is UUPSUpgradeable, OwnableUpgradeable, IOracleRewardCB {
  using UnsafeMath for uint256;
  using UnsafeMath for U256;
  using Math for uint256;
  using BitMaps for BitMaps.BitMap;

  event AddQuests(QuestInput[] quests, MinimumRequirement[3][] minimumRequirements);
  event EditQuests(QuestInput[] quests, MinimumRequirement[3][] minimumRequirements);
  event RemoveQuest(uint256 questId);
  event ActivateQuest(address from, uint256 playerId, uint256 questId);
  event DeactivateQuest(uint256 playerId, uint256 questId);
  event QuestCompleted(address from, uint256 playerId, uint256 questId);
  event UpdateQuestProgress(uint256 playerId, PlayerQuest playerQuest);

  // Legacy for abi and old beta
  event ActivateNewQuest(uint256 playerId, uint256 questId);
  event AddFixedQuest(QuestV1 quest, MinimumRequirement[3] minimumRequirements);
  event EditQuest(QuestV1 quest, MinimumRequirement[3] minimumRequirements);

  error NotWorld();
  error NotOwnerOfPlayerAndActive();
  error NotPlayers();
  error QuestDoesntExist();
  error InvalidQuestId();
  error QuestWithIdAlreadyExists();
  error QuestCompletedAlready();
  error InvalidRewardAmount();
  error InvalidActionNum();
  error InvalidActionChoiceNum();
  error LengthMismatch();
  error InvalidSkillXPGained();
  error InvalidFTMAmount();
  error InvalidBrushAmount();
  error InvalidActiveQuest();
  error InvalidBurnAmount();
  error NoActiveQuest();
  error ActivatingQuestAlreadyActivated();
  error DependentQuestNotCompleted(uint16 dependentQuestId);
  error RefundFailed();
  error InvalidMinimumRequirement();
  error NotSupported();
  error CannotStartFullModeQuest();
  error CannotChangeBackToFullMode();

  struct MinimumRequirement {
    Skill skill;
    uint64 xp;
  }

  struct PlayerQuestInfo {
    uint32 numFixedQuestsCompleted;
  }

  address private world;
  IPlayers private players;
  uint40 public randomQuestId;
  uint16 public numTotalQuests;
  mapping(uint256 questId => Quest quest) public allFixedQuests;
  mapping(uint256 playerId => BitMaps.BitMap) private questsCompleted;
  mapping(uint256 playerId => PlayerQuest playerQuest) public activeQuests;
  mapping(uint256 playerId => PlayerQuest playerQuest) public inProgressRandomQuests;
  mapping(uint256 playerId => mapping(uint256 queueId => PlayerQuest quest)) public inProgressFixedQuests; // Only puts it here if changing active quest for something else
  mapping(uint256 questId => MinimumRequirement[3]) minimumRequirements; // Not checked yet
  BitMaps.BitMap private questIsRandom;
  mapping(uint256 playerId => PlayerQuestInfo) public playerInfo;
  Quest[] private randomQuests;
  Quest private previousRandomQuest; // Allow people to complete it if they didn't process it in the current day
  Quest private randomQuest; // Same for everyone
  IRouterV2 private router;
  address private buyPath1; // For buying brush
  address private buyPath2;

  modifier onlyWorld() {
    if (msg.sender != world) {
      revert NotWorld();
    }
    _;
  }

  modifier onlyPlayers() {
    if (msg.sender != address(players)) {
      revert NotPlayers();
    }
    _;
  }

  modifier isOwnerOfPlayerAndActive(uint256 _playerId) {
    if (!players.isOwnerOfPlayerAndActive(msg.sender, _playerId)) {
      revert NotOwnerOfPlayerAndActive();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address _world, IRouterV2 _router, address[2] calldata _buyPath) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();

    world = _world;
    router = _router;
    buyPath1 = _buyPath[0];
    buyPath2 = _buyPath[1];

    IERC20(buyPath2).approve(address(_router), type(uint256).max);
  }

  function activateQuest(address _from, uint256 _playerId, uint256 _questId) external onlyPlayers {
    if (_questId == 0) {
      revert InvalidQuestId();
    }
    if (!_questExists(_questId)) {
      revert QuestDoesntExist();
    }
    if (questsCompleted[_playerId].get(_questId)) {
      revert QuestCompletedAlready();
    }

    Quest storage quest = allFixedQuests[_questId];
    if (quest.dependentQuestId != 0) {
      if (!questsCompleted[_playerId].get(quest.dependentQuestId)) {
        revert DependentQuestNotCompleted(quest.dependentQuestId);
      }
    }

    if (_isQuestPackedDataFullMode(quest.packedData) && !players.isPlayerUpgraded(_playerId)) {
      revert CannotStartFullModeQuest();
    }

    for (uint256 i = 0; i < minimumRequirements[_questId].length; ++i) {
      MinimumRequirement storage minimumRequirement = minimumRequirements[_questId][i];
      if (minimumRequirement.skill != Skill.NONE) {
        uint256 xp = players.xp(_playerId, minimumRequirement.skill);
        if (xp < minimumRequirement.xp) {
          revert InvalidMinimumRequirement();
        }
      }
    }

    uint256 existingActiveQuestId = activeQuests[_playerId].questId;
    if (existingActiveQuestId == _questId) {
      revert ActivatingQuestAlreadyActivated();
    }

    if (existingActiveQuestId != 0) {
      // Another quest was activated
      emit DeactivateQuest(_playerId, existingActiveQuestId);
      inProgressFixedQuests[_playerId][existingActiveQuestId] = activeQuests[_playerId];
    }

    if (inProgressFixedQuests[_playerId][_questId].questId != 0) {
      // If the quest is already in progress, just activate it
      activeQuests[_playerId] = inProgressFixedQuests[_playerId][_questId];
    } else {
      // Start fresh quest
      PlayerQuest memory playerQuest;
      playerQuest.questId = uint32(_questId);
      playerQuest.isFixed = true;
      activeQuests[_playerId] = playerQuest;
    }
    emit ActivateQuest(_from, _playerId, _questId);
  }

  function deactivateQuest(uint256 _playerId) external onlyPlayers {
    PlayerQuest storage playerQuest = activeQuests[_playerId];
    uint256 questId = playerQuest.questId;
    if (questId == 0) {
      revert NoActiveQuest();
    }

    // Move it to in progress
    inProgressFixedQuests[_playerId][activeQuests[_playerId].questId] = activeQuests[_playerId];
    delete activeQuests[_playerId];

    emit DeactivateQuest(_playerId, questId);
  }

  function newOracleRandomWords(uint256 _randomWord) external override onlyWorld {
    // For later
  }

  function processQuests(
    address _from,
    uint256 _playerId,
    PlayerQuest[] calldata _activeQuestInfo,
    uint256[] memory _questsCompleted
  ) external onlyPlayers {
    if (_questsCompleted.length != 0) {
      U256 bounds = _questsCompleted.length.asU256();
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        uint256 i = iter.asUint256();
        uint256 questId = _questsCompleted[i];
        _questCompleted(_from, _playerId, questId);
      }
    } else if (_activeQuestInfo.length != 0) {
      PlayerQuest storage activeQuest = activeQuests[_playerId];
      // Only handling 1 active quest at a time currently
      PlayerQuest calldata activeQuestInfo = _activeQuestInfo[0];
      bool hasQuestProgress = activeQuestInfo.actionCompletedNum1 != activeQuest.actionCompletedNum1 ||
        activeQuestInfo.actionChoiceCompletedNum != activeQuest.actionChoiceCompletedNum ||
        activeQuestInfo.burnCompletedAmount != activeQuest.burnCompletedAmount;

      if (hasQuestProgress) {
        activeQuests[_playerId] = activeQuestInfo;
        emit UpdateQuestProgress(_playerId, activeQuestInfo);
      }
    }
  }

  function buyBrushQuest(
    address _from,
    address _to,
    uint256 _playerId,
    uint256 _minimumBrushBack,
    bool _useExactETH
  ) external payable onlyPlayers returns (bool success) {
    PlayerQuest storage playerQuest = activeQuests[_playerId];
    if (playerQuest.questId != QUEST_PURSE_STRINGS) {
      revert InvalidActiveQuest();
    }
    uint256[] memory amounts = buyBrush(_to, _minimumBrushBack, _useExactETH);
    if (amounts[0] != 0) {
      // Refund the rest if it isn't players contract calling it otherwise do it elsewhere
      (success, ) = _from.call{value: msg.value - amounts[0]}("");
      if (!success) {
        revert RefundFailed();
      }
    }
    _questCompleted(_from, _playerId, playerQuest.questId);
    success = true;
  }

  function buyBrush(
    address _to,
    uint256 _minimumBrushExpected,
    bool _useExactETH
  ) public payable returns (uint256[] memory amounts) {
    if (msg.value == 0) {
      revert InvalidFTMAmount();
    }

    uint256 deadline = block.timestamp.add(10 minutes);
    // Buy brush and send it back to the user
    address[] memory buyPath = new address[](2);
    buyPath[0] = buyPath1;
    buyPath[1] = buyPath2;

    if (_useExactETH) {
      uint256 amountOutMin = _minimumBrushExpected;
      amounts = router.swapExactETHForTokens{value: msg.value}(amountOutMin, buyPath, _to, deadline);
    } else {
      uint256 amountOut = _minimumBrushExpected;
      amounts = router.swapETHForExactTokens{value: msg.value}(amountOut, buyPath, _to, deadline);
      if (amounts[0] != 0 && msg.sender != address(players)) {
        // Refund the rest if it isn't players contract calling it otherwise do it elsewhere
        (bool success, ) = msg.sender.call{value: msg.value - amounts[0]}("");
        if (!success) {
          revert RefundFailed();
        }
      }
    }
  }

  // This doesn't really belong here, just for consistency
  function sellBrush(address _to, uint256 _brushAmount, uint256 _minFTM, bool _useExactETH) external {
    if (_brushAmount == 0) {
      revert InvalidBrushAmount();
    }

    uint256 deadline = block.timestamp.add(10 minutes);
    // Sell brush and send ftm back to the user
    address[] memory sellPath = new address[](2);
    sellPath[0] = buyPath2;
    sellPath[1] = buyPath1;

    IERC20(buyPath2).transferFrom(msg.sender, address(this), _brushAmount);

    if (_useExactETH) {
      uint256 amountOut = _minFTM;
      uint256 amountInMax = _brushAmount;
      router.swapTokensForExactETH(amountOut, amountInMax, sellPath, _to, deadline);
    } else {
      uint256 amountIn = _brushAmount;
      uint256 amountOutMin = _minFTM;
      router.swapExactTokensForETH(amountIn, amountOutMin, sellPath, _to, deadline);
    }
  }

  function processQuestsView(
    uint256 _playerId,
    uint256[] calldata _actionIds,
    uint256[] calldata _actionAmounts,
    uint256[] calldata _choiceIds,
    uint256[] calldata _choiceAmounts,
    uint256 _burnedAmountOwned
  )
    external
    view
    returns (
      uint256[] memory itemTokenIds,
      uint256[] memory amounts,
      uint256[] memory itemTokenIdsBurned,
      uint256[] memory amountsBurned,
      Skill[] memory skillsGained,
      uint32[] memory xpGained,
      uint256[] memory _questsCompleted,
      PlayerQuest[] memory activeQuestsCompletionInfo
    )
  {
    // Handle active quest
    PlayerQuest memory questCompletionInfo = activeQuests[_playerId];
    if (questCompletionInfo.questId != 0) {
      activeQuestsCompletionInfo = new PlayerQuest[](2);
      itemTokenIds = new uint256[](2 * MAX_QUEST_REWARDS);
      amounts = new uint256[](2 * MAX_QUEST_REWARDS);
      itemTokenIdsBurned = new uint256[](2);
      amountsBurned = new uint256[](2);
      skillsGained = new Skill[](2);
      xpGained = new uint32[](2);
      _questsCompleted = new uint256[](2);
      uint256 itemTokenIdsLength;
      uint256 itemTokenIdsBurnedLength;
      uint256 skillsGainedLength;
      uint256 questsCompletedLength;
      uint256 activeQuestsLength;

      (
        uint256[] memory _itemTokenIds,
        uint256[] memory _amounts,
        uint256 itemTokenIdBurned,
        uint256 amountBurned,
        Skill skillGained,
        uint32 xp,
        bool questCompleted
      ) = _processQuestView(
          _actionIds,
          _actionAmounts,
          _choiceIds,
          _choiceAmounts,
          questCompletionInfo,
          _burnedAmountOwned
        );

      U256 bounds = _itemTokenIds.length.asU256();
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        uint256 i = iter.asUint256();
        itemTokenIds[itemTokenIdsLength] = _itemTokenIds[i];
        amounts[itemTokenIdsLength] = _amounts[i];
        itemTokenIdsLength = itemTokenIdsLength.inc();
      }

      if (questCompleted) {
        _questsCompleted[questsCompletedLength++] = questCompletionInfo.questId;
      } else {
        activeQuestsCompletionInfo[activeQuestsLength++] = questCompletionInfo;
      }
      if (itemTokenIdBurned != NONE) {
        itemTokenIdsBurned[itemTokenIdsBurnedLength] = itemTokenIdBurned;
        amountsBurned[itemTokenIdsBurnedLength++] = amountBurned;
      }
      if (xp != 0) {
        skillsGained[skillsGainedLength] = skillGained;
        xpGained[skillsGainedLength++] = xp;
      }

      assembly ("memory-safe") {
        mstore(itemTokenIds, itemTokenIdsLength)
        mstore(amounts, itemTokenIdsLength)
        mstore(itemTokenIdsBurned, itemTokenIdsBurnedLength)
        mstore(amountsBurned, itemTokenIdsBurnedLength)
        mstore(skillsGained, skillsGainedLength)
        mstore(xpGained, skillsGainedLength)
        mstore(_questsCompleted, questsCompletedLength)
        mstore(activeQuestsCompletionInfo, activeQuestsLength)
      }
    }
  }

  function isQuestCompleted(uint256 _playerId, uint256 _questId) external view returns (bool) {
    return questsCompleted[_playerId].get(_questId);
  }

  function getActiveQuestId(uint256 _player) external view returns (uint256) {
    return activeQuests[_player].questId;
  }

  function getActiveQuestBurnedItemTokenId(uint256 _playerId) external view returns (uint256) {
    uint256 questId = activeQuests[_playerId].questId;
    if (questId == 0) {
      return NONE;
    }

    return allFixedQuests[questId].burnItemTokenId;
  }

  function _questCompleted(address _from, uint256 _playerId, uint256 _questId) private {
    emit QuestCompleted(_from, _playerId, _questId);
    questsCompleted[_playerId].set(_questId);
    delete activeQuests[_playerId];
    ++playerInfo[_playerId].numFixedQuestsCompleted;
  }

  function _addToBurn(
    Quest storage _quest,
    PlayerQuest memory _playerQuest,
    uint256 _burnedAmountOwned
  ) private view returns (uint256 amountBurned) {
    // Handle quest that burns and requires actions to be done at the same time
    uint256 burnRemainingAmount = _quest.burnAmount > _playerQuest.burnCompletedAmount
      ? _quest.burnAmount - _playerQuest.burnCompletedAmount
      : 0;
    amountBurned = Math.min(burnRemainingAmount, _burnedAmountOwned);
    if (amountBurned != 0) {
      _playerQuest.burnCompletedAmount += uint16(amountBurned);
    }
  }

  function _processQuestView(
    uint256[] calldata _actionIds,
    uint256[] calldata _actionAmounts,
    uint256[] calldata _choiceIds,
    uint256[] calldata _choiceAmounts,
    PlayerQuest memory _playerQuest,
    uint256 _burnedAmountOwned
  )
    private
    view
    returns (
      uint256[] memory itemTokenIds,
      uint256[] memory amounts,
      uint256 itemTokenIdBurned,
      uint256 amountBurned,
      Skill skillGained,
      uint32 xpGained,
      bool questCompleted
    )
  {
    Quest storage quest = allFixedQuests[_playerQuest.questId];
    U256 bounds = _actionIds.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint256 i = iter.asUint256();
      if (quest.actionId1 == _actionIds[i]) {
        uint256 remainingAmount = quest.actionNum1 > _playerQuest.actionCompletedNum1
          ? quest.actionNum1 - _playerQuest.actionCompletedNum1
          : 0;
        uint256 amount = Math.min(remainingAmount, _actionAmounts[i]);
        if (quest.burnItemTokenId != NONE) {
          amount = Math.min(_burnedAmountOwned, amount);
          _burnedAmountOwned -= amount;
          amount = _addToBurn(quest, _playerQuest, amount);
          amountBurned += amount;

          if (
            amount == 0 &&
            _playerQuest.burnCompletedAmount >= quest.burnAmount &&
            _playerQuest.actionCompletedNum1 < quest.actionNum1
          ) {
            // Needed in case the quest is changed later where the amount to burn has already been exceeded
            _playerQuest.actionCompletedNum1 = _playerQuest.burnCompletedAmount;
          }
        }
        _playerQuest.actionCompletedNum1 += uint16(amount);
      }
    }

    bounds = _choiceIds.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint256 i = iter.asUint256();
      if (quest.actionChoiceId == _choiceIds[i]) {
        uint256 remainingAmount = quest.actionChoiceNum > _playerQuest.actionChoiceCompletedNum
          ? quest.actionChoiceNum - _playerQuest.actionChoiceCompletedNum
          : 0;
        uint256 amount = Math.min(remainingAmount, _choiceAmounts[i]);
        if (quest.burnItemTokenId != NONE) {
          amount = Math.min(_burnedAmountOwned, amount);
          _burnedAmountOwned -= amount;
          amount = _addToBurn(quest, _playerQuest, amount);
          amountBurned += amount;

          if (
            amount == 0 &&
            _playerQuest.burnCompletedAmount >= quest.burnAmount &&
            _playerQuest.actionChoiceCompletedNum < quest.actionChoiceNum
          ) {
            // Needed in case the quest is changed later where the amount to burn has already been exceeded
            _playerQuest.actionChoiceCompletedNum = _playerQuest.burnCompletedAmount;
          }
        }
        _playerQuest.actionChoiceCompletedNum += uint16(amount);
      }
    }

    if (amountBurned != 0) {
      itemTokenIdBurned = quest.burnItemTokenId;
    }

    // Buy brush quest is handled specially for instance and doesn't have any of these set
    if (quest.actionNum1 != 0 || quest.actionChoiceNum != 0 || quest.burnAmount != 0) {
      questCompleted =
        _playerQuest.actionCompletedNum1 >= quest.actionNum1 &&
        _playerQuest.actionChoiceCompletedNum >= quest.actionChoiceNum &&
        _playerQuest.burnCompletedAmount >= quest.burnAmount;
    }

    if (questCompleted) {
      (itemTokenIds, amounts, skillGained, xpGained) = getQuestCompletedRewards(_playerQuest.questId);
    }
  }

  function getQuestCompletedRewards(
    uint256 _questId
  ) public view returns (uint256[] memory itemTokenIds, uint256[] memory amounts, Skill skillGained, uint32 xpGained) {
    Quest storage quest = allFixedQuests[_questId];
    // length can be 0, 1 or 2
    uint256 mintLength = quest.rewardItemTokenId1 == NONE ? 0 : 1;
    mintLength += (quest.rewardItemTokenId2 == NONE ? 0 : 1);

    itemTokenIds = new uint256[](mintLength);
    amounts = new uint256[](mintLength);
    if (quest.rewardItemTokenId1 != NONE) {
      itemTokenIds[0] = quest.rewardItemTokenId1;
      amounts[0] = quest.rewardAmount1;
    }
    if (quest.rewardItemTokenId2 != NONE) {
      itemTokenIds[1] = quest.rewardItemTokenId2;
      amounts[1] = quest.rewardAmount2;
    }
    skillGained = quest.skillReward;
    xpGained = quest.skillXPGained;
  }

  function _checkQuest(QuestInput calldata _quest) private pure {
    if (_quest.rewardItemTokenId1 != NONE && _quest.rewardAmount1 == 0) {
      revert InvalidRewardAmount();
    }
    if (_quest.rewardItemTokenId2 != NONE && _quest.rewardAmount2 == 0) {
      revert InvalidRewardAmount();
    }
    if (_quest.actionId1 != 0 && _quest.actionNum1 == 0) {
      revert InvalidActionNum();
    }
    if (_quest.actionId2 != 0 && _quest.actionNum2 == 0) {
      revert InvalidActionNum();
    }
    if (_quest.actionChoiceId != 0 && _quest.actionChoiceNum == 0) {
      revert InvalidActionChoiceNum();
    }
    if (_quest.skillReward != Skill.NONE && _quest.skillXPGained == 0) {
      revert InvalidSkillXPGained();
    }
    if (_quest.burnItemTokenId != NONE && _quest.burnAmount == 0) {
      revert InvalidBurnAmount();
    }
    if (_quest.questId == 0) {
      revert InvalidQuestId();
    }
  }

  function _addQuest(QuestInput calldata _quest, MinimumRequirement[3] calldata _minimumRequirements) private {
    _checkQuest(_quest);

    bool anyMinimumRequirement;
    U256 bounds = _minimumRequirements.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint256 i = iter.asUint256();
      if (_minimumRequirements[i].skill != Skill.NONE) {
        anyMinimumRequirement = true;
        break;
      }
    }

    if (anyMinimumRequirement) {
      minimumRequirements[_quest.questId] = _minimumRequirements;
    }

    if (_questExists(_quest.questId)) {
      revert QuestWithIdAlreadyExists();
    }

    allFixedQuests[_quest.questId] = _packQuest(_quest);
  }

  function _editQuest(QuestInput calldata _quest, MinimumRequirement[3] calldata _minimumRequirements) private {
    _checkQuest(_quest);

    minimumRequirements[_quest.questId] = _minimumRequirements;

    if (!_questExists(_quest.questId)) {
      revert QuestDoesntExist();
    }

    // Cannot change from free to full-mode
    if (!_isQuestPackedDataFullMode(allFixedQuests[_quest.questId].packedData) && _quest.isFullModeOnly) {
      revert CannotChangeBackToFullMode();
    }

    allFixedQuests[_quest.questId] = _packQuest(_quest);
  }

  function _questExists(uint256 _questId) private view returns (bool) {
    return
      allFixedQuests[_questId].actionId1 != NONE ||
      allFixedQuests[_questId].actionChoiceId != NONE ||
      allFixedQuests[_questId].skillReward != Skill.NONE ||
      allFixedQuests[_questId].rewardItemTokenId1 != NONE;
  }

  function _isQuestPackedDataFullMode(bytes1 _packedData) private pure returns (bool) {
    return uint8(_packedData >> IS_FULL_MODE_BIT) & 1 == 1;
  }

  function _packQuest(QuestInput calldata _questInput) private pure returns (Quest memory quest) {
    bytes1 packedData = bytes1(uint8(_questInput.isFullModeOnly ? 1 << IS_FULL_MODE_BIT : 0));
    quest = Quest({
      dependentQuestId: _questInput.dependentQuestId,
      actionId1: _questInput.actionId1,
      actionNum1: _questInput.actionNum1,
      actionId2: _questInput.actionId2,
      actionNum2: _questInput.actionNum2,
      actionChoiceId: _questInput.actionChoiceId,
      actionChoiceNum: _questInput.actionChoiceNum,
      skillReward: _questInput.skillReward,
      skillXPGained: _questInput.skillXPGained,
      rewardItemTokenId1: _questInput.rewardItemTokenId1,
      rewardAmount1: _questInput.rewardAmount1,
      rewardItemTokenId2: _questInput.rewardItemTokenId2,
      rewardAmount2: _questInput.rewardAmount2,
      burnItemTokenId: _questInput.burnItemTokenId,
      burnAmount: _questInput.burnAmount,
      reserved: 0,
      packedData: packedData
    });
  }

  function setPlayers(IPlayers _players) external onlyOwner {
    players = _players;
  }

  function addQuests(
    QuestInput[] calldata _quests,
    MinimumRequirement[3][] calldata _minimumRequirements
  ) external onlyOwner {
    if (_quests.length != _minimumRequirements.length) {
      revert LengthMismatch();
    }

    U256 bounds = _quests.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint256 i = iter.asUint256();
      _addQuest(_quests[i], _minimumRequirements[i]);
    }
    numTotalQuests += uint16(_quests.length);
    emit AddQuests(_quests, _minimumRequirements);
  }

  function editQuests(
    QuestInput[] calldata _quests,
    MinimumRequirement[3][] calldata _minimumRequirements
  ) external onlyOwner {
    for (uint256 i = 0; i < _quests.length; ++i) {
      _editQuest(_quests[i], _minimumRequirements[i]);
    }
    emit EditQuests(_quests, _minimumRequirements);
  }

  function removeQuest(uint256 _questId) external onlyOwner {
    if (_questId == 0) {
      revert InvalidQuestId();
    }
    if (!_questExists(_questId)) {
      revert QuestDoesntExist();
    }

    delete allFixedQuests[_questId];
    emit RemoveQuest(_questId);
    --numTotalQuests;
  }

  receive() external payable {}

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
