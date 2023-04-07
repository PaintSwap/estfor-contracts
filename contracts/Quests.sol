// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IQuests} from "./interfaces/IQuests.sol";

/* solhint-disable no-global-import */
import "./globals/actions.sol";
import "./globals/items.sol";
import "./globals/rewards.sol";

/* solhint-enable no-global-import */

contract Quests is UUPSUpgradeable, OwnableUpgradeable, IQuests {
  event AddQuest(Quest quest);
  event RemoveQuest(uint questId);
  event NewRandomQuest(Quest randomQuest, uint pointerQuestId);
  event QuestCompleted(uint playerId, uint questId);

  error NotWorld();
  error NotOwnerOfPlayer();
  error NotPlayers();
  error QuestDoesntExist();
  error InvalidQuestId();
  error CannotRemoveActiveRandomQuest();
  error QuestWithIdAlreadyExists();
  error InvalidRewardAmount();
  error InvalidReward();
  error InvalidActionNum();
  error InvalidActionChoiceNum();
  error LengthMismatch();
  error InvalidSkillXPGained();

  struct MinimumRequirement {
    Skill skill;
    uint64 xp;
  }

  IERC1155 private playerNFT;
  address private world;
  address private players;
  mapping(uint questId => Quest quest) public allQuests;
  mapping(uint playerId => mapping(uint questId => bool done)) public questsCompleted; // TODO: Could use bit mask
  mapping(uint playerId => QuestWithCompletionInfo quest) public activeQuests;
  mapping(uint playerId => QuestWithCompletionInfo quest) public inProgressRandomQuests;
  mapping(uint questId => MinimumRequirement[3]) minimumRequirements; // Not checked yet
  mapping(uint questId => bool) public isRandomQuest;
  Quest[] public randomQuests;
  Quest public previousRandomQuest; // Allow people to complete it if they didn't process it in the current day
  Quest public randomQuest; // Same for everyone
  uint56 public randomQuestId;

  modifier onlyWorld() {
    if (msg.sender != world) {
      revert NotWorld();
    }
    _;
  }

  modifier onlyPlayers() {
    if (msg.sender != players) {
      revert NotPlayers();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(IERC1155 _playerNFT, address _world) public initializer {
    __Ownable_init();
    __UUPSUpgradeable_init();

    playerNFT = _playerNFT;
    world = _world;
  }

  function activateQuest(uint _playerId, uint _questId) external onlyPlayers {
    Quest storage quest = allQuests[_questId];
    if (_questId == 0) {
      revert InvalidQuestId();
    }
    if (quest.questId != _questId) {
      revert QuestDoesntExist();
    }
    QuestWithCompletionInfo memory questCompletionInfo;
    questCompletionInfo.quest = quest;
    activeQuests[_playerId] = questCompletionInfo;
    randomQuestId = 65336;
  }

  function newOracleRandomWords(uint[3] calldata _randomWords) external override onlyWorld {
    // Pick a random quest which is assigned to everyone (could be random later)
    uint length = randomQuests.length;
    if (length == 0) {
      return; // Don't revert as this would mess up the chainlink callback
    }

    uint index = uint8(_randomWords[0]) % length;
    randomQuest = randomQuests[index];
    uint pointerQuestId = randomQuest.questId;
    randomQuest.questId = randomQuestId++; // Update to a unique one so we can distinguish the same quests
    emit NewRandomQuest(randomQuest, pointerQuestId);
  }

  function processQuests(
    uint _playerId,
    uint[] calldata _choiceIds,
    uint[] calldata _choiceIdAmounts
  ) external onlyPlayers returns (uint[] memory itemTokenIds, uint[] memory amounts, uint[] memory _questsCompleted) {
    // The items will get minted by the caller
    (itemTokenIds, amounts, _questsCompleted) = processQuestsView(_playerId, _choiceIds, _choiceIdAmounts);
    for (uint i = 0; i < _questsCompleted.length; ++i) {
      emit QuestCompleted(_playerId, _questsCompleted[i]);
      questsCompleted[_playerId][_questsCompleted[i]] = true;

      if (isRandomQuest[_questsCompleted[i]]) {
        delete inProgressRandomQuests[_playerId];
      }
    }
  }

  function _processQuestView(
    uint[] calldata _choiceIds,
    uint[] calldata _choiceIdAmounts,
    QuestWithCompletionInfo memory questCompletionInfo
  ) private pure returns (uint[] memory itemTokenIds, uint[] memory amounts) {
    for (uint i; i < _choiceIds.length; ++i) {
      uint choiceId = _choiceIds[i];
      uint amount = _choiceIdAmounts[i];
      if (questCompletionInfo.quest.actionChoiceId == choiceId) {
        questCompletionInfo.actionChoiceNum += uint24(amount);
      }
    }

    // Quest completed?
    if (questCompletionInfo.actionChoiceNum >= questCompletionInfo.quest.actionChoiceNum) {
      itemTokenIds = new uint[](questCompletionInfo.quest.rewardItemTokenId1 == 0 ? 1 : 2);
      amounts = new uint[](questCompletionInfo.quest.rewardItemTokenId1 == 0 ? 1 : 2);
      itemTokenIds[0] = questCompletionInfo.quest.rewardItemTokenId;
      amounts[0] = questCompletionInfo.quest.rewardAmount;
      if (questCompletionInfo.quest.rewardItemTokenId1 != 0) {
        itemTokenIds[1] = questCompletionInfo.quest.rewardItemTokenId1;
        amounts[1] = questCompletionInfo.quest.rewardAmount1;
      }
    }
  }

  function processQuestsView(
    uint _playerId,
    uint[] calldata _choiceIds,
    uint[] calldata _choiceIdAmounts
  ) public view returns (uint[] memory itemTokenIds, uint[] memory amounts, uint[] memory _questsCompleted) {
    if (_choiceIds.length == 0) {
      return (new uint[](0), new uint[](0), new uint[](0));
    }

    // Handle active rquest
    QuestWithCompletionInfo memory questCompletionInfo = activeQuests[_playerId];
    itemTokenIds = new uint[](2 * MAX_QUEST_REWARDS);
    amounts = new uint[](2 * MAX_QUEST_REWARDS);
    _questsCompleted = new uint[](2);
    uint itemTokenIdsLength;
    uint amountsLength;
    uint questsCompletedLength;
    if (questCompletionInfo.quest.questId != 0) {
      (uint[] memory _itemTokenIds, uint[] memory _amounts) = _processQuestView(
        _choiceIds,
        _choiceIdAmounts,
        questCompletionInfo
      );

      if (_itemTokenIds.length > 0) {
        for (uint i = 0; i < _itemTokenIds.length; ++i) {
          itemTokenIds[itemTokenIdsLength++] = _itemTokenIds[i];
          amounts[amountsLength++] = _amounts[i];
        }
        _questsCompleted[questsCompletedLength++] = questCompletionInfo.quest.questId;
      }
    }
    // Handle random request
    if (randomQuest.questId != 0) {
      QuestWithCompletionInfo memory randomQuestCompletionInfo;
      if (randomQuest.questId == inProgressRandomQuests[_playerId].quest.questId) {
        randomQuestCompletionInfo = inProgressRandomQuests[_playerId];
      }
      (uint[] memory _itemTokenIds, uint[] memory _amounts) = _processQuestView(
        _choiceIds,
        _choiceIdAmounts,
        randomQuestCompletionInfo
      );

      if (_itemTokenIds.length > 0) {
        for (uint i = 0; i < _itemTokenIds.length; ++i) {
          itemTokenIds[itemTokenIdsLength++] = _itemTokenIds[i];
          amounts[amountsLength++] = _amounts[i];
        }
        _questsCompleted[questsCompletedLength++] = randomQuestCompletionInfo.quest.questId;
      }
    }

    assembly ("memory-safe") {
      mstore(itemTokenIds, itemTokenIdsLength)
      mstore(amounts, amountsLength)
      mstore(_questsCompleted, questsCompletedLength)
    }
  }

  function _addQuest(
    Quest calldata _quest,
    bool _isRandom,
    MinimumRequirement[3] calldata _minimumRequirements
  ) private {
    if (_isRandom) {
      randomQuests.push(_quest);
      isRandomQuest[_quest.questId] = true;
    }
    if (allQuests[_quest.questId].questId != 0) {
      revert QuestWithIdAlreadyExists();
    }
    if (_quest.rewardAmount == 0) {
      revert InvalidRewardAmount();
    }
    if (_quest.rewardItemTokenId == NONE) {
      revert InvalidReward();
    }
    if (_quest.rewardItemTokenId1 != NONE && _quest.rewardAmount1 == 0) {
      revert InvalidRewardAmount();
    }
    if (_quest.actionId != 0 && _quest.actionNum == 0) {
      revert InvalidActionNum();
    }
    if (_quest.actionId1 != 0 && _quest.actionNum1 == 0) {
      revert InvalidActionNum();
    }
    if (_quest.actionChoiceId != 0 && _quest.actionChoiceNum == 0) {
      revert InvalidActionChoiceNum();
    }
    if (_quest.skillReward != Skill.NONE && _quest.skillXPGained == 0) {
      revert InvalidSkillXPGained();
    }
    if (_quest.questId == 0) {
      revert InvalidQuestId();
    }

    minimumRequirements[_quest.questId] = _minimumRequirements;
    allQuests[_quest.questId] = _quest;
    emit AddQuest(_quest);
  }

  function setPlayers(address _players) external onlyOwner {
    players = _players;
  }

  function addQuest(
    Quest calldata _quest,
    bool _isRandom,
    MinimumRequirement[3] calldata _minimumRequirements
  ) external onlyOwner {
    _addQuest(_quest, _isRandom, _minimumRequirements);
  }

  function addQuests(
    Quest[] calldata _quests,
    bool[] calldata _isRandom,
    MinimumRequirement[3][] calldata _minimumRequirements
  ) external onlyOwner {
    if (_quests.length != _isRandom.length) {
      revert LengthMismatch();
    }
    for (uint i = 0; i < _quests.length; ++i) {
      _addQuest(_quests[i], _isRandom[i], _minimumRequirements[i]);
    }
  }

  function removeQuest(uint _questId) external onlyOwner {
    if (_questId == 0) {
      revert InvalidQuestId();
    }
    Quest storage quest = allQuests[_questId];
    if (quest.questId != _questId) {
      revert QuestDoesntExist();
    }

    if (isRandomQuest[_questId]) {
      // Check it's not the active one
      if (randomQuest.questId == _questId) {
        revert CannotRemoveActiveRandomQuest();
      }
      delete isRandomQuest[_questId];
    }

    delete allQuests[_questId];
    emit RemoveQuest(_questId);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
