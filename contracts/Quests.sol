// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IQuests} from "./interfaces/IQuests.sol";

/* solhint-disable no-global-import */
import "./globals/players.sol";
import "./globals/items.sol";
import "./globals/rewards.sol";

/* solhint-enable no-global-import */

interface Router {
  function swapExactETHForTokens(
    uint amountOutMin,
    address[] calldata path,
    address to,
    uint deadline
  ) external payable returns (uint[] memory amounts);
}

contract Quests is UUPSUpgradeable, OwnableUpgradeable, IQuests {
  event AddFixedQuest(Quest quest);
  event AddBaseRandomQuest(Quest quest);
  event RemoveQuest(uint questId);
  event NewRandomQuest(Quest randomQuest, uint oldQuestId);
  event ActivateNewQuest(uint playerId, uint questId);
  event DeactivateQuest(uint playerId, uint questId);
  event QuestCompleted(uint playerId, uint questId);
  event UpdateQuestProgress(uint playerId, QuestWithCompletionInfo questWithCompletionInfo);

  error NotWorld();
  error NotOwnerOfPlayer();
  error NotPlayers();
  error QuestDoesntExist();
  error InvalidQuestId();
  error CannotRemoveActiveRandomQuest();
  error QuestWithIdAlreadyExists();
  error QuestCompletedAlready();
  error InvalidRewardAmount();
  error InvalidReward();
  error InvalidActionNum();
  error InvalidActionChoiceNum();
  error LengthMismatch();
  error InvalidSkillXPGained();
  error InvalidFTMAmount();
  error InvalidActiveQuest();
  error NoActiveQuest();

  struct MinimumRequirement {
    Skill skill;
    uint64 xp;
  }

  uint constant QUEST_ID_STARTER_TRADER = 2; // MAKE SURE THIS MATCHES definitions

  struct PlayerQuestInfo {
    uint32 numFixedQuestsCompleted;
    uint32 numRandomQuestsCompleted;
  }

  address private world;
  address private players;
  uint40 public randomQuestId;
  mapping(uint questId => Quest quest) public allFixedQuests;
  mapping(uint playerId => mapping(uint questId => bool done)) public questsCompleted; // TODO: Could use bit mask
  mapping(uint playerId => QuestWithCompletionInfo quest) public activeQuests;
  mapping(uint playerId => QuestWithCompletionInfo quest) public inProgressRandomQuests;
  mapping(uint questId => MinimumRequirement[3]) minimumRequirements; // Not checked yet
  mapping(uint questId => bool isRandom) public isRandomQuest;
  mapping(uint playerId => PlayerQuestInfo) public playerInfo;
  Quest[] private randomQuests;
  Quest private previousRandomQuest; // Allow people to complete it if they didn't process it in the current day
  Quest private randomQuest; // Same for everyone
  Router private router;
  address private buyPath1;
  address private buyPath2;

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

  function initialize(address _world, Router _router, address[2] calldata _buyPath) public initializer {
    __Ownable_init();
    __UUPSUpgradeable_init();

    world = _world;
    router = _router;
    buyPath1 = _buyPath[0];
    buyPath2 = _buyPath[1];
  }

  function activateQuest(uint _playerId, uint _questId) external onlyPlayers {
    Quest storage quest = allFixedQuests[_questId];
    if (_questId == 0) {
      revert InvalidQuestId();
    }
    if (quest.questId != _questId) {
      revert QuestDoesntExist();
    }
    if (questsCompleted[_playerId][_questId]) {
      revert QuestCompletedAlready();
    }

    QuestWithCompletionInfo memory questCompletionInfo;
    questCompletionInfo.quest = quest;
    activeQuests[_playerId] = questCompletionInfo; // This overwrites an existing active quest
    randomQuestId = 65336;
    emit ActivateNewQuest(_playerId, _questId);
  }

  function deactivateQuest(uint _playerId) external onlyPlayers {
    QuestWithCompletionInfo storage questInfo = activeQuests[_playerId];
    uint questId = questInfo.quest.questId;
    if (questId == 0) {
      revert NoActiveQuest();
    }

    questsCompleted[_playerId][questId] = true;
    delete activeQuests[_playerId];

    emit DeactivateQuest(_playerId, questId);
  }

  function newOracleRandomWords(uint[3] calldata _randomWords) external override onlyWorld {
    // Pick a random quest which is assigned to everyone (could be random later)
    uint length = randomQuests.length;
    if (length == 0) {
      return; // Don't revert as this would mess up the chainlink callback
    }

    uint index = uint8(_randomWords[0]) % length;
    randomQuest = randomQuests[index];
    uint oldQuestId = randomQuest.questId;
    uint newQuestId = randomQuestId++;
    randomQuest.questId = uint24(newQuestId); // Update to a unique one so we can distinguish the same quests
    emit NewRandomQuest(randomQuest, oldQuestId);
  }

  function _questCompleted(uint _playerId, uint _questId) private {
    emit QuestCompleted(_playerId, _questId);
    questsCompleted[_playerId][_questId] = true;
    delete activeQuests[_playerId];

    if (isRandomQuest[_questId]) {
      ++playerInfo[_playerId].numRandomQuestsCompleted;
      delete inProgressRandomQuests[_playerId];
    } else {
      ++playerInfo[_playerId].numFixedQuestsCompleted;
    }
  }

  function processQuests(
    uint _playerId,
    uint[] calldata _choiceIds,
    uint[] calldata _choiceIdAmounts
  )
    external
    onlyPlayers
    returns (
      uint[] memory itemTokenIds,
      uint[] memory amounts,
      uint[] memory itemTokenIdsBurned,
      uint[] memory amountsBurned,
      Skill[] memory skillsGained,
      uint32[] memory xpGained,
      uint[] memory _questsCompleted,
      QuestWithCompletionInfo[] memory activeQuestsCompletionInfo
    )
  {
    // The items will get minted by the caller
    (
      itemTokenIds,
      amounts,
      itemTokenIdsBurned,
      amountsBurned,
      skillsGained,
      xpGained,
      _questsCompleted,
      activeQuestsCompletionInfo
    ) = processQuestsView(_playerId, _choiceIds, _choiceIdAmounts);
    if (_questsCompleted.length > 0) {
      for (uint i = 0; i < _questsCompleted.length; ++i) {
        uint questId = _questsCompleted[i];
        _questCompleted(_playerId, questId);
      }
    } else {
      // Update the quest progress
      bool foundActive;
      bool foundRandomQuest;
      for (uint i; i < _choiceIds.length; ++i) {
        uint choiceId = _choiceIds[i];
        uint amount = _choiceIdAmounts[i];
        if (activeQuests[_playerId].quest.actionChoiceId == choiceId) {
          activeQuests[_playerId].actionChoiceNum += uint24(amount);
          foundActive = true;
        }
        if (inProgressRandomQuests[_playerId].quest.actionChoiceId == choiceId) {
          inProgressRandomQuests[_playerId].actionChoiceNum += uint24(amount);
          foundRandomQuest = true;
        }
      }
      if (foundActive) {
        emit UpdateQuestProgress(_playerId, activeQuests[_playerId]);
      }
      if (foundRandomQuest) {
        emit UpdateQuestProgress(_playerId, inProgressRandomQuests[_playerId]);
      }
    }
  }

  function _processQuestView(
    uint[] calldata _choiceIds,
    uint[] calldata _choiceIdAmounts,
    QuestWithCompletionInfo memory questCompletionInfo
  )
    private
    pure
    returns (
      uint[] memory itemTokenIds,
      uint[] memory amounts,
      uint itemTokenIdBurned,
      uint amountBurned,
      Skill skillGained,
      uint32 xpGained,
      bool questCompleted
    )
  {
    for (uint i; i < _choiceIds.length; ++i) {
      uint choiceId = _choiceIds[i];
      uint amount = _choiceIdAmounts[i];
      if (questCompletionInfo.quest.actionChoiceId == choiceId) {
        questCompletionInfo.actionChoiceNum += uint24(amount);
      }
    }

    questCompleted = questCompletionInfo.actionChoiceNum >= questCompletionInfo.quest.actionChoiceNum;
    if (questCompleted) {
      // length can be 0, 1 or 2
      uint mintLength = questCompletionInfo.quest.rewardItemTokenId == NONE ? 0 : 1;
      mintLength += (questCompletionInfo.quest.rewardItemTokenId1 == NONE ? 0 : 1);

      itemTokenIds = new uint[](mintLength);
      amounts = new uint[](mintLength);
      if (questCompletionInfo.quest.rewardItemTokenId != NONE) {
        itemTokenIds[0] = questCompletionInfo.quest.rewardItemTokenId;
        amounts[0] = questCompletionInfo.quest.rewardAmount;
      }
      if (questCompletionInfo.quest.rewardItemTokenId1 != NONE) {
        itemTokenIds[1] = questCompletionInfo.quest.rewardItemTokenId1;
        amounts[1] = questCompletionInfo.quest.rewardAmount1;
      }
      itemTokenIdBurned = questCompletionInfo.quest.burnItemTokenId;
      amountBurned = questCompletionInfo.quest.burnAmount;
      skillGained = questCompletionInfo.quest.skillReward;
      xpGained = questCompletionInfo.quest.skillXPGained;
    }
  }

  function processQuestsView(
    uint _playerId,
    uint[] calldata _choiceIds,
    uint[] calldata _choiceIdAmounts
  )
    public
    view
    returns (
      uint[] memory itemTokenIds,
      uint[] memory amounts,
      uint[] memory itemTokenIdsBurned,
      uint[] memory amountsBurned,
      Skill[] memory skillsGained,
      uint32[] memory xpGained,
      uint[] memory _questsCompleted,
      QuestWithCompletionInfo[] memory activeQuestsCompletionInfo
    )
  {
    activeQuestsCompletionInfo = new QuestWithCompletionInfo[](2);
    if (_choiceIds.length != 0) {
      // Handle active rquest
      QuestWithCompletionInfo memory questCompletionInfo = activeQuests[_playerId];
      activeQuestsCompletionInfo[0] = questCompletionInfo;
      itemTokenIds = new uint[](2 * MAX_QUEST_REWARDS);
      amounts = new uint[](2 * MAX_QUEST_REWARDS);
      itemTokenIdsBurned = new uint[](2);
      amountsBurned = new uint[](2);
      skillsGained = new Skill[](2);
      xpGained = new uint32[](2);
      _questsCompleted = new uint[](2);
      uint itemTokenIdsLength;
      uint itemTokenIdsBurnedLength;
      uint skillsGainedLength;
      uint questsCompletedLength;
      if (questCompletionInfo.quest.questId != 0) {
        (
          uint[] memory _itemTokenIds,
          uint[] memory _amounts,
          uint itemTokenIdBurned,
          uint amountBurned,
          Skill skillGained,
          uint32 xp,
          bool questCompleted
        ) = _processQuestView(_choiceIds, _choiceIdAmounts, questCompletionInfo);

        for (uint i = 0; i < _itemTokenIds.length; ++i) {
          itemTokenIds[itemTokenIdsLength] = _itemTokenIds[i];
          amounts[itemTokenIdsLength++] = _amounts[i];
        }

        if (questCompleted) {
          _questsCompleted[questsCompletedLength++] = questCompletionInfo.quest.questId;
        }
        if (itemTokenIdBurned != NONE) {
          itemTokenIdsBurned[itemTokenIdsBurnedLength] = itemTokenIdBurned;
          amountsBurned[itemTokenIdsBurnedLength++] = amountBurned;
        }
        if (xp != 0) {
          skillsGained[skillsGainedLength] = skillGained;
          xpGained[skillsGainedLength++] = xp;
        }
      }
      // Handle random request
      if (randomQuest.questId != 0) {
        QuestWithCompletionInfo memory randomQuestCompletionInfo;
        if (randomQuest.questId == inProgressRandomQuests[_playerId].quest.questId) {
          randomQuestCompletionInfo = inProgressRandomQuests[_playerId];
        }
        activeQuestsCompletionInfo[1] = randomQuestCompletionInfo;
        (
          uint[] memory _itemTokenIds,
          uint[] memory _amounts,
          uint itemTokenIdBurned,
          uint amountBurned,
          Skill skillGained,
          uint32 xp,
          bool questCompleted
        ) = _processQuestView(_choiceIds, _choiceIdAmounts, randomQuestCompletionInfo);

        for (uint i = 0; i < _itemTokenIds.length; ++i) {
          itemTokenIds[itemTokenIdsLength] = _itemTokenIds[i];
          amounts[itemTokenIdsLength++] = _amounts[i];
        }

        if (questCompleted) {
          _questsCompleted[questsCompletedLength++] = randomQuestCompletionInfo.quest.questId;
        }

        if (itemTokenIdBurned != NONE) {
          itemTokenIdsBurned[itemTokenIdsBurnedLength] = itemTokenIdBurned;
          amountsBurned[itemTokenIdsBurnedLength++] = amountBurned;
        }
        if (xp != 0) {
          skillsGained[skillsGainedLength] = skillGained;
          xpGained[skillsGainedLength++] = xp;
        }
      }

      assembly ("memory-safe") {
        mstore(itemTokenIds, itemTokenIdsLength)
        mstore(amounts, itemTokenIdsLength)
        mstore(itemTokenIdsBurned, itemTokenIdsBurnedLength)
        mstore(amountsBurned, itemTokenIdsBurnedLength)
        mstore(skillsGained, skillsGainedLength)
        mstore(xpGained, skillsGainedLength)
        mstore(_questsCompleted, questsCompletedLength)
      }
    }
  }

  function _addQuest(
    Quest calldata _quest,
    bool _isRandom,
    MinimumRequirement[3] calldata _minimumRequirements
  ) private {
    if (_quest.rewardItemTokenId != NONE && _quest.rewardAmount == 0) {
      revert InvalidRewardAmount();
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

    bool anyMinimumRequirement;
    for (uint i = 0; i < _minimumRequirements.length; ++i) {
      if (_minimumRequirements[i].skill != Skill.NONE) {
        anyMinimumRequirement = true;
        break;
      }
    }

    if (anyMinimumRequirement) {
      minimumRequirements[_quest.questId] = _minimumRequirements;
    }

    if (_isRandom) {
      randomQuests.push(_quest);
      isRandomQuest[_quest.questId] = true;
      emit AddBaseRandomQuest(_quest);
    } else {
      if (allFixedQuests[_quest.questId].questId != 0) {
        revert QuestWithIdAlreadyExists();
      }

      allFixedQuests[_quest.questId] = _quest;
      emit AddFixedQuest(_quest);
    }
  }

  function buyBrushQuest(address _from, uint _playerId, uint _minimumBrushBack) external payable {
    QuestWithCompletionInfo storage questWithCompletionInfo = activeQuests[_playerId];
    buyBrush(_from, _minimumBrushBack);
    if (questWithCompletionInfo.quest.questId != QUEST_ID_STARTER_TRADER) {
      revert InvalidActiveQuest();
    }

    _questCompleted(_playerId, questWithCompletionInfo.quest.questId);
  }

  function buyBrush(address _to, uint minimumBrushBack) public payable {
    if (msg.value == 0) {
      revert InvalidFTMAmount();
    }

    uint deadline = block.timestamp + 10 minutes;
    // Buy brush and send it back to the user
    address[] memory buyPath = new address[](2);
    buyPath[0] = buyPath1;
    buyPath[1] = buyPath2;

    router.swapExactETHForTokens{value: msg.value}(minimumBrushBack, buyPath, _to, deadline);
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
    if (isRandomQuest[_questId]) {
      // Check it's not the active one
      if (randomQuest.questId == _questId) {
        revert CannotRemoveActiveRandomQuest();
      }
      delete isRandomQuest[_questId];

      // Remove from array
      for (uint i = 0; i < randomQuests.length; ++i) {
        if (randomQuests[i].questId == _questId) {
          randomQuests[i] = randomQuests[randomQuests.length - 1];
          randomQuests.pop();
          break;
        }
      }
    } else {
      Quest storage quest = allFixedQuests[_questId];
      if (quest.questId != _questId) {
        revert QuestDoesntExist();
      }

      delete allFixedQuests[_questId];
    }
    emit RemoveQuest(_questId);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
