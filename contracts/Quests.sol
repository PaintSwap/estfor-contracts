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

  address private _world;
  IPlayers private _players;
  uint40 private _randomQuestId;
  uint16 private _numTotalQuests;
  mapping(uint256 questId => Quest quest) private _allFixedQuests;
  mapping(uint256 playerId => BitMaps.BitMap) private _questsCompleted;
  mapping(uint256 playerId => PlayerQuest playerQuest) private _activeQuests;
  mapping(uint256 playerId => PlayerQuest playerQuest) private _inProgressRandomQuests;
  mapping(uint256 playerId => mapping(uint256 queueId => PlayerQuest quest)) private _inProgressFixedQuests; // Only puts it here if changing active quest for something else
  mapping(uint256 questId => MinimumRequirement[3]) _minimumRequirements; // Not checked yet
  BitMaps.BitMap private _questIsRandom;
  mapping(uint256 playerId => PlayerQuestInfo) private _playerInfo;
  Quest[] private _randomQuests;
  Quest private _previousRandomQuest; // Allow people to complete it if they didn't process it in the current day
  Quest private _randomQuest; // Same for everyone
  IRouterV2 private _router;
  address private _buyPath1; // For buying brush
  address private _buyPath2;

  modifier onlyWorld() {
    if (msg.sender != _world) {
      revert NotWorld();
    }
    _;
  }

  modifier onlyPlayers() {
    if (msg.sender != address(_players)) {
      revert NotPlayers();
    }
    _;
  }

  modifier isOwnerOfPlayerAndActive(uint256 playerId) {
    if (!_players.isOwnerOfPlayerAndActive(msg.sender, playerId)) {
      revert NotOwnerOfPlayerAndActive();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address world, IRouterV2 router, address[2] calldata buyPath) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();

    _world = world;
    _router = router;
    _buyPath1 = buyPath[0];
    _buyPath2 = buyPath[1];

    IERC20(buyPath[1]).approve(address(router), type(uint256).max);
  }

  function allFixedQuests(uint256 questId) external view returns (Quest memory) {
    return _allFixedQuests[questId];
  }

  function activeQuests(uint256 playerId) external view returns (PlayerQuest memory) {
    return _activeQuests[playerId];
  }

  function activateQuest(address from, uint256 playerId, uint256 questId) external onlyPlayers {
    if (questId == 0) {
      revert InvalidQuestId();
    }
    if (!_questExists(questId)) {
      revert QuestDoesntExist();
    }
    if (_questsCompleted[playerId].get(questId)) {
      revert QuestCompletedAlready();
    }

    Quest storage quest = _allFixedQuests[questId];
    if (quest.dependentQuestId != 0) {
      if (!_questsCompleted[playerId].get(quest.dependentQuestId)) {
        revert DependentQuestNotCompleted(quest.dependentQuestId);
      }
    }

    if (_isQuestPackedDataFullMode(quest.packedData) && !_players.isPlayerUpgraded(playerId)) {
      revert CannotStartFullModeQuest();
    }

    for (uint256 i = 0; i < _minimumRequirements[questId].length; ++i) {
      MinimumRequirement storage minimumRequirement = _minimumRequirements[questId][i];
      if (minimumRequirement.skill != Skill.NONE) {
        uint256 xp = _players.getPlayerXP(playerId, minimumRequirement.skill);
        if (xp < minimumRequirement.xp) {
          revert InvalidMinimumRequirement();
        }
      }
    }

    uint256 existingActiveQuestId = _activeQuests[playerId].questId;
    if (existingActiveQuestId == questId) {
      revert ActivatingQuestAlreadyActivated();
    }

    if (existingActiveQuestId != 0) {
      // Another quest was activated
      emit DeactivateQuest(playerId, existingActiveQuestId);
      _inProgressFixedQuests[playerId][existingActiveQuestId] = _activeQuests[playerId];
    }

    if (_inProgressFixedQuests[playerId][questId].questId != 0) {
      // If the quest is already in progress, just activate it
      _activeQuests[playerId] = _inProgressFixedQuests[playerId][questId];
    } else {
      // Start fresh quest
      PlayerQuest memory playerQuest;
      playerQuest.questId = uint32(questId);
      playerQuest.isFixed = true;
      _activeQuests[playerId] = playerQuest;
    }
    emit ActivateQuest(from, playerId, questId);
  }

  function deactivateQuest(uint256 playerId) external onlyPlayers {
    PlayerQuest storage playerQuest = _activeQuests[playerId];
    uint256 questId = playerQuest.questId;
    if (questId == 0) {
      revert NoActiveQuest();
    }

    // Move it to in progress
    _inProgressFixedQuests[playerId][_activeQuests[playerId].questId] = _activeQuests[playerId];
    delete _activeQuests[playerId];

    emit DeactivateQuest(playerId, questId);
  }

  function newOracleRandomWords(uint256 randomWord) external override onlyWorld {
    // For later
  }

  function processQuests(
    address from,
    uint256 playerId,
    PlayerQuest[] calldata activeQuestInfo,
    uint256[] memory questsCompleted
  ) external onlyPlayers {
    if (questsCompleted.length != 0) {
      U256 bounds = questsCompleted.length.asU256();
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        uint256 i = iter.asUint256();
        uint256 questId = questsCompleted[i];
        _questCompleted(from, playerId, questId);
      }
    } else if (activeQuestInfo.length != 0) {
      PlayerQuest storage activeQuest = _activeQuests[playerId];
      // Only handling 1 active quest at a time currently
      PlayerQuest calldata activeQuestInfo0 = activeQuestInfo[0];
      bool hasQuestProgress = activeQuestInfo0.actionCompletedNum1 != activeQuest.actionCompletedNum1 ||
        activeQuestInfo0.actionChoiceCompletedNum != activeQuest.actionChoiceCompletedNum ||
        activeQuestInfo0.burnCompletedAmount != activeQuest.burnCompletedAmount;

      if (hasQuestProgress) {
        _activeQuests[playerId] = activeQuestInfo0;
        emit UpdateQuestProgress(playerId, activeQuestInfo0);
      }
    }
  }

  function buyBrushQuest(
    address from,
    address to,
    uint256 playerId,
    uint256 minimumBrushBack,
    bool useExactETH
  ) external payable onlyPlayers returns (bool success) {
    PlayerQuest storage playerQuest = _activeQuests[playerId];
    if (playerQuest.questId != QUEST_PURSE_STRINGS) {
      revert InvalidActiveQuest();
    }
    uint256[] memory amounts = buyBrush(to, minimumBrushBack, useExactETH);
    if (amounts[0] != 0) {
      // Refund the rest if it isn't players contract calling it otherwise do it elsewhere
      (success, ) = from.call{value: msg.value - amounts[0]}("");
      if (!success) {
        revert RefundFailed();
      }
    }
    _questCompleted(from, playerId, playerQuest.questId);
    success = true;
  }

  function buyBrush(
    address to,
    uint256 minimumBrushExpected,
    bool useExactETH
  ) public payable returns (uint256[] memory amounts) {
    require(msg.value != 0, InvalidFTMAmount());

    uint256 deadline = block.timestamp.add(10 minutes);
    // Buy brush and send it back to the user
    address[] memory buyPath = new address[](2);
    buyPath[0] = _buyPath1;
    buyPath[1] = _buyPath2;

    if (useExactETH) {
      uint256 amountOutMin = minimumBrushExpected;
      amounts = _router.swapExactETHForTokens{value: msg.value}(amountOutMin, buyPath, to, deadline);
    } else {
      uint256 amountOut = minimumBrushExpected;
      amounts = _router.swapETHForExactTokens{value: msg.value}(amountOut, buyPath, to, deadline);
      if (amounts[0] != 0 && msg.sender != address(_players)) {
        // Refund the rest if it isn't players contract calling it otherwise do it elsewhere
        (bool success, ) = msg.sender.call{value: msg.value - amounts[0]}("");
        require(success, RefundFailed());
      }
    }
  }

  // This doesn't really belong here, just for consistency
  function sellBrush(address to, uint256 brushAmount, uint256 minFTM, bool useExactETH) external {
    require(brushAmount != 0, InvalidBrushAmount());

    uint256 deadline = block.timestamp.add(10 minutes);
    // Sell brush and send ftm back to the user
    address[] memory sellPath = new address[](2);
    sellPath[0] = _buyPath2;
    sellPath[1] = _buyPath1;

    IERC20(_buyPath2).transferFrom(msg.sender, address(this), brushAmount);

    if (useExactETH) {
      uint256 amountOut = minFTM;
      uint256 amountInMax = brushAmount;
      _router.swapTokensForExactETH(amountOut, amountInMax, sellPath, to, deadline);
    } else {
      uint256 amountIn = brushAmount;
      uint256 amountOutMin = minFTM;
      _router.swapExactTokensForETH(amountIn, amountOutMin, sellPath, to, deadline);
    }
  }

  function processQuestsView(
    uint256 playerId,
    uint256[] calldata actionIds,
    uint256[] calldata actionAmounts,
    uint256[] calldata choiceIds,
    uint256[] calldata choiceAmounts,
    uint256 burnedAmountOwned
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
      uint256[] memory questsCompleted,
      PlayerQuest[] memory activeQuestsCompletionInfo
    )
  {
    // Handle active quest
    PlayerQuest memory questCompletionInfo = _activeQuests[playerId];
    if (questCompletionInfo.questId != 0) {
      activeQuestsCompletionInfo = new PlayerQuest[](2);
      itemTokenIds = new uint256[](2 * MAX_QUEST_REWARDS);
      amounts = new uint256[](2 * MAX_QUEST_REWARDS);
      itemTokenIdsBurned = new uint256[](2);
      amountsBurned = new uint256[](2);
      skillsGained = new Skill[](2);
      xpGained = new uint32[](2);
      questsCompleted = new uint256[](2);
      uint256 itemTokenIdsLength;
      uint256 itemTokenIdsBurnedLength;
      uint256 skillsGainedLength;
      uint256 questsCompletedLength;
      uint256 activeQuestsLength;

      (
        uint256[] memory itemTokenIds_,
        uint256[] memory amounts_,
        uint256 itemTokenIdBurned,
        uint256 amountBurned,
        Skill skillGained,
        uint32 xp,
        bool questCompleted
      ) = _processQuestView(actionIds, actionAmounts, choiceIds, choiceAmounts, questCompletionInfo, burnedAmountOwned);

      U256 bounds = itemTokenIds_.length.asU256();
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        uint256 i = iter.asUint256();
        itemTokenIds[itemTokenIdsLength] = itemTokenIds_[i];
        amounts[itemTokenIdsLength] = amounts_[i];
        itemTokenIdsLength = itemTokenIdsLength.inc();
      }

      if (questCompleted) {
        questsCompleted[questsCompletedLength++] = questCompletionInfo.questId;
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
        mstore(questsCompleted, questsCompletedLength)
        mstore(activeQuestsCompletionInfo, activeQuestsLength)
      }
    }
  }

  function isQuestCompleted(uint256 playerId, uint256 questId) external view returns (bool) {
    return _questsCompleted[playerId].get(questId);
  }

  function getActiveQuestId(uint256 playerId) external view returns (uint256) {
    return _activeQuests[playerId].questId;
  }

  function getActiveQuestBurnedItemTokenId(uint256 playerId) external view returns (uint256) {
    uint256 questId = _activeQuests[playerId].questId;
    if (questId == 0) {
      return NONE;
    }

    return _allFixedQuests[questId].burnItemTokenId;
  }

  function _questCompleted(address from, uint256 playerId, uint256 questId) private {
    emit QuestCompleted(from, playerId, questId);
    _questsCompleted[playerId].set(questId);
    delete _activeQuests[playerId];
    ++_playerInfo[playerId].numFixedQuestsCompleted;
  }

  function _addToBurn(
    Quest storage quest,
    PlayerQuest memory playerQuest,
    uint256 burnedAmountOwned
  ) private view returns (uint256 amountBurned) {
    // Handle quest that burns and requires actions to be done at the same time
    uint256 burnRemainingAmount = quest.burnAmount > playerQuest.burnCompletedAmount
      ? quest.burnAmount - playerQuest.burnCompletedAmount
      : 0;
    amountBurned = Math.min(burnRemainingAmount, burnedAmountOwned);
    if (amountBurned != 0) {
      playerQuest.burnCompletedAmount += uint16(amountBurned);
    }
  }

  function _processQuestView(
    uint256[] calldata actionIds,
    uint256[] calldata actionAmounts,
    uint256[] calldata choiceIds,
    uint256[] calldata choiceAmounts,
    PlayerQuest memory playerQuest,
    uint256 burnedAmountOwned
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
    Quest storage quest = _allFixedQuests[playerQuest.questId];
    U256 bounds = actionIds.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint256 i = iter.asUint256();
      if (quest.actionId1 == actionIds[i]) {
        uint256 remainingAmount = quest.actionNum1 > playerQuest.actionCompletedNum1
          ? quest.actionNum1 - playerQuest.actionCompletedNum1
          : 0;
        uint256 amount = Math.min(remainingAmount, actionAmounts[i]);
        if (quest.burnItemTokenId != NONE) {
          amount = Math.min(burnedAmountOwned, amount);
          burnedAmountOwned -= amount;
          amount = _addToBurn(quest, playerQuest, amount);
          amountBurned += amount;

          if (
            amount == 0 &&
            playerQuest.burnCompletedAmount >= quest.burnAmount &&
            playerQuest.actionCompletedNum1 < quest.actionNum1
          ) {
            // Needed in case the quest is changed later where the amount to burn has already been exceeded
            playerQuest.actionCompletedNum1 = playerQuest.burnCompletedAmount;
          }
        }
        playerQuest.actionCompletedNum1 += uint16(amount);
      }
    }

    bounds = choiceIds.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint256 i = iter.asUint256();
      if (quest.actionChoiceId == choiceIds[i]) {
        uint256 remainingAmount = quest.actionChoiceNum > playerQuest.actionChoiceCompletedNum
          ? quest.actionChoiceNum - playerQuest.actionChoiceCompletedNum
          : 0;
        uint256 amount = Math.min(remainingAmount, choiceAmounts[i]);
        if (quest.burnItemTokenId != NONE) {
          amount = Math.min(burnedAmountOwned, amount);
          burnedAmountOwned -= amount;
          amount = _addToBurn(quest, playerQuest, amount);
          amountBurned += amount;

          if (
            amount == 0 &&
            playerQuest.burnCompletedAmount >= quest.burnAmount &&
            playerQuest.actionChoiceCompletedNum < quest.actionChoiceNum
          ) {
            // Needed in case the quest is changed later where the amount to burn has already been exceeded
            playerQuest.actionChoiceCompletedNum = playerQuest.burnCompletedAmount;
          }
        }
        playerQuest.actionChoiceCompletedNum += uint16(amount);
      }
    }

    if (amountBurned != 0) {
      itemTokenIdBurned = quest.burnItemTokenId;
    }

    // Buy brush quest is handled specially for instance and doesn't have any of these set
    if (quest.actionNum1 != 0 || quest.actionChoiceNum != 0 || quest.burnAmount != 0) {
      questCompleted =
        playerQuest.actionCompletedNum1 >= quest.actionNum1 &&
        playerQuest.actionChoiceCompletedNum >= quest.actionChoiceNum &&
        playerQuest.burnCompletedAmount >= quest.burnAmount;
    }

    if (questCompleted) {
      (itemTokenIds, amounts, skillGained, xpGained) = getQuestCompletedRewards(playerQuest.questId);
    }
  }

  function getQuestCompletedRewards(
    uint256 questId
  ) public view returns (uint256[] memory itemTokenIds, uint256[] memory amounts, Skill skillGained, uint32 xpGained) {
    Quest storage quest = _allFixedQuests[questId];
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

  function _checkQuest(QuestInput calldata quest) private pure {
    require(quest.rewardItemTokenId1 == NONE || quest.rewardAmount1 != 0, InvalidRewardAmount());
    require(quest.rewardItemTokenId2 == NONE || quest.rewardAmount2 != 0, InvalidRewardAmount());
    require(quest.actionId1 == 0 || quest.actionNum1 != 0, InvalidActionNum());
    require(quest.actionId2 == 0 || quest.actionNum2 != 0, InvalidActionNum());
    require(quest.actionChoiceId == 0 || quest.actionChoiceNum != 0, InvalidActionChoiceNum());
    require(quest.skillReward == Skill.NONE || quest.skillXPGained != 0, InvalidSkillXPGained());
    require(quest.burnItemTokenId == NONE || quest.burnAmount != 0, InvalidBurnAmount());
    require(quest.questId != 0, InvalidQuestId());
  }

  function _addQuest(QuestInput calldata quest, MinimumRequirement[3] calldata minimumRequirements) private {
    _checkQuest(quest);

    bool anyMinimumRequirement;
    U256 bounds = minimumRequirements.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint256 i = iter.asUint256();
      if (minimumRequirements[i].skill != Skill.NONE) {
        anyMinimumRequirement = true;
        break;
      }
    }

    if (anyMinimumRequirement) {
      _minimumRequirements[quest.questId] = minimumRequirements;
    }

    require(!_questExists(quest.questId), QuestWithIdAlreadyExists());

    _allFixedQuests[quest.questId] = _packQuest(quest);
  }

  function _editQuest(QuestInput calldata quest, MinimumRequirement[3] calldata minimumRequirements) private {
    _checkQuest(quest);

    _minimumRequirements[quest.questId] = minimumRequirements;

    require(_questExists(quest.questId), QuestDoesntExist());
    // Cannot change from free to full-mode
    require(
      _isQuestPackedDataFullMode(_allFixedQuests[quest.questId].packedData) == quest.isFullModeOnly,
      CannotChangeBackToFullMode()
    );

    _allFixedQuests[quest.questId] = _packQuest(quest);
  }

  function _questExists(uint256 questId) private view returns (bool) {
    return
      _allFixedQuests[questId].actionId1 != NONE ||
      _allFixedQuests[questId].actionChoiceId != NONE ||
      _allFixedQuests[questId].skillReward != Skill.NONE ||
      _allFixedQuests[questId].rewardItemTokenId1 != NONE;
  }

  function _isQuestPackedDataFullMode(bytes1 packedData) private pure returns (bool) {
    return uint8(packedData >> IS_FULL_MODE_BIT) & 1 == 1;
  }

  function _packQuest(QuestInput calldata questInput) private pure returns (Quest memory quest) {
    bytes1 packedData = bytes1(uint8(questInput.isFullModeOnly ? 1 << IS_FULL_MODE_BIT : 0));
    quest = Quest({
      dependentQuestId: questInput.dependentQuestId,
      actionId1: questInput.actionId1,
      actionNum1: questInput.actionNum1,
      actionId2: questInput.actionId2,
      actionNum2: questInput.actionNum2,
      actionChoiceId: questInput.actionChoiceId,
      actionChoiceNum: questInput.actionChoiceNum,
      skillReward: questInput.skillReward,
      skillXPGained: questInput.skillXPGained,
      rewardItemTokenId1: questInput.rewardItemTokenId1,
      rewardAmount1: questInput.rewardAmount1,
      rewardItemTokenId2: questInput.rewardItemTokenId2,
      rewardAmount2: questInput.rewardAmount2,
      burnItemTokenId: questInput.burnItemTokenId,
      burnAmount: questInput.burnAmount,
      reserved: 0,
      packedData: packedData
    });
  }

  function setPlayers(IPlayers players) external onlyOwner {
    _players = players;
  }

  function addQuests(
    QuestInput[] calldata quests,
    MinimumRequirement[3][] calldata minimumRequirements
  ) external onlyOwner {
    if (quests.length != minimumRequirements.length) {
      revert LengthMismatch();
    }

    U256 bounds = quests.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint256 i = iter.asUint256();
      _addQuest(quests[i], minimumRequirements[i]);
    }
    _numTotalQuests += uint16(quests.length);
    emit AddQuests(quests, minimumRequirements);
  }

  function editQuests(
    QuestInput[] calldata quests,
    MinimumRequirement[3][] calldata minimumRequirements
  ) external onlyOwner {
    for (uint256 i = 0; i < quests.length; ++i) {
      _editQuest(quests[i], minimumRequirements[i]);
    }
    emit EditQuests(quests, minimumRequirements);
  }

  function removeQuest(uint256 questId) external onlyOwner {
    require(questId != 0, InvalidQuestId());
    require(_questExists(questId), QuestDoesntExist());

    delete _allFixedQuests[questId];
    emit RemoveQuest(questId);
    --_numTotalQuests;
  }

  receive() external payable {}

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
