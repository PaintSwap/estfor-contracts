// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IQuests} from "./interfaces/IQuests.sol";
import {IPlayers} from "./interfaces/IPlayers.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";

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
  using UnsafeMath for uint256;
  using UnsafeMath for U256;

  event AddFixedQuest(Quest quest);
  event AddBaseRandomQuest(Quest quest);
  event RemoveQuest(uint questId);
  event NewRandomQuest(Quest randomQuest, uint oldQuestId);
  event ActivateNewQuest(uint playerId, uint questId);
  event DeactivateQuest(uint playerId, uint questId);
  event QuestCompleted(uint playerId, uint questId);
  event UpdateQuestProgress(uint playerId, PlayerQuest playerQuest);

  error NotWorld();
  error NotOwnerOfPlayerAndActive();
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
  error ActivatingQuestAlreadyActivated();

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
  IPlayers private players;
  uint40 public randomQuestId;
  mapping(uint questId => Quest quest) public allFixedQuests;
  mapping(uint playerId => mapping(uint questId => bool done)) public questsCompleted; // TODO: Could use bit mask
  mapping(uint playerId => PlayerQuest playerQuest) public activeQuests;
  mapping(uint playerId => PlayerQuest playerQuest) public inProgressRandomQuests;
  mapping(uint playerId => mapping(uint queueId => PlayerQuest quest)) public inProgressFixedQuests; // Only puts it here if changing active quest for something else
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
    if (msg.sender != address(players)) {
      revert NotPlayers();
    }
    _;
  }

  modifier isOwnerOfPlayerAndActive(uint _playerId) {
    if (!players.isOwnerOfPlayerAndActive(msg.sender, _playerId)) {
      revert NotOwnerOfPlayerAndActive();
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

  function activateQuest(uint _playerId, uint _questId) external isOwnerOfPlayerAndActive(_playerId) {
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

    uint existingActiveQuestId = activeQuests[_playerId].questId;
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
    emit ActivateNewQuest(_playerId, _questId);
  }

  function deactivateQuest(uint _playerId) external isOwnerOfPlayerAndActive(_playerId) {
    PlayerQuest storage playerQuest = activeQuests[_playerId];
    uint questId = playerQuest.questId;
    if (questId == 0) {
      revert NoActiveQuest();
    }

    // Move it to in progress
    inProgressFixedQuests[_playerId][activeQuests[_playerId].questId] = activeQuests[_playerId];
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
      PlayerQuest[] memory activeQuestInfo
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
      activeQuestInfo
    ) = processQuestsView(_playerId, _choiceIds, _choiceIdAmounts);
    if (_questsCompleted.length != 0) {
      U256 bounds = _questsCompleted.length.asU256();
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        uint i = iter.asUint256();
        uint questId = _questsCompleted[i];
        _questCompleted(_playerId, questId);
      }
    } else {
      // Update the quest progress
      bool foundActive;
      bool foundRandomQuest;
      U256 bounds = _choiceIds.length.asU256();
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        uint i = iter.asUint256();
        uint choiceId = _choiceIds[i];
        uint amount = _choiceIdAmounts[i];
        uint activeQuestId = activeQuests[_playerId].questId;
        if (allFixedQuests[activeQuestId].actionChoiceId == choiceId) {
          activeQuests[_playerId].actionChoiceCompletedNum += uint24(amount);
          foundActive = true;
        }

        uint randomQuestId = randomQuest.questId;
        if (randomQuest.actionChoiceId == choiceId) {
          if (inProgressRandomQuests[_playerId].questId != randomQuestId) {
            // If this is a new one clear it
            PlayerQuest memory playerQuest;
            inProgressRandomQuests[_playerId] = playerQuest;
          }
          inProgressRandomQuests[_playerId].actionChoiceCompletedNum += uint24(amount);
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

  function buyBrushQuest(
    address _to,
    uint _playerId,
    uint _minimumBrushBack
  ) external payable isOwnerOfPlayerAndActive(_playerId) {
    PlayerQuest storage playerQuest = activeQuests[_playerId];
    buyBrush(_to, _minimumBrushBack);
    if (playerQuest.questId != QUEST_ID_STARTER_TRADER) {
      revert InvalidActiveQuest();
    }

    _questCompleted(_playerId, playerQuest.questId);
  }

  function buyBrush(address _to, uint minimumBrushBack) public payable {
    if (msg.value == 0) {
      revert InvalidFTMAmount();
    }

    uint deadline = block.timestamp.add(10 minutes);
    // Buy brush and send it back to the user
    address[] memory buyPath = new address[](2);
    buyPath[0] = buyPath1;
    buyPath[1] = buyPath2;

    router.swapExactETHForTokens{value: msg.value}(minimumBrushBack, buyPath, _to, deadline);
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
      PlayerQuest[] memory activeQuestsCompletionInfo
    )
  {
    if (_choiceIds.length != 0) {
      // Handle active rquest
      activeQuestsCompletionInfo = new PlayerQuest[](2);
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
      uint activeQuestsLength;
      PlayerQuest memory questCompletionInfo = activeQuests[_playerId];
      if (questCompletionInfo.questId != 0) {
        (
          uint[] memory _itemTokenIds,
          uint[] memory _amounts,
          uint itemTokenIdBurned,
          uint amountBurned,
          Skill skillGained,
          uint32 xp,
          bool questCompleted
        ) = _processQuestView(_choiceIds, _choiceIdAmounts, questCompletionInfo);

        U256 bounds = _itemTokenIds.length.asU256();
        for (U256 iter; iter < bounds; iter = iter.inc()) {
          uint i = iter.asUint256();
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
      }
      // Handle random request
      if (randomQuest.questId != 0) {
        PlayerQuest memory randomQuestCompletionInfo;
        // TODO: This assumes that inProgressRandomQuests is set, which is not always the case.
        if (randomQuest.questId == inProgressRandomQuests[_playerId].questId) {
          randomQuestCompletionInfo = inProgressRandomQuests[_playerId];
        }
        activeQuestsCompletionInfo[activeQuestsLength++] = randomQuestCompletionInfo;
        (
          uint[] memory _itemTokenIds,
          uint[] memory _amounts,
          uint itemTokenIdBurned,
          uint amountBurned,
          Skill skillGained,
          uint32 xp,
          bool questCompleted
        ) = _processQuestView(_choiceIds, _choiceIdAmounts, randomQuestCompletionInfo);

        U256 bounds = _itemTokenIds.length.asU256();
        for (U256 iter; iter < bounds; iter = iter.inc()) {
          uint i = iter.asUint256();
          itemTokenIds[itemTokenIdsLength] = _itemTokenIds[i];
          amounts[itemTokenIdsLength++] = _amounts[i];
        }

        if (questCompleted) {
          _questsCompleted[questsCompletedLength++] = randomQuestCompletionInfo.questId;
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
        mstore(activeQuestsCompletionInfo, activeQuestsLength)
      }
    }
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

  function _processQuestView(
    uint[] calldata _choiceIds,
    uint[] calldata _choiceIdAmounts,
    PlayerQuest memory playerQuest
  )
    private
    view
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
    Quest memory quest = playerQuest.isFixed ? allFixedQuests[playerQuest.questId] : randomQuest;
    U256 bounds = _choiceIds.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint i = iter.asUint256();
      if (quest.actionChoiceId == _choiceIds[i]) {
        uint amount = _choiceIdAmounts[i];
        playerQuest.actionChoiceCompletedNum += uint24(amount);
      }
    }

    questCompleted = playerQuest.actionChoiceCompletedNum >= quest.actionChoiceNum;
    if (questCompleted) {
      // length can be 0, 1 or 2
      uint mintLength = quest.rewardItemTokenId == NONE ? 0 : 1;
      mintLength += (quest.rewardItemTokenId1 == NONE ? 0 : 1);

      itemTokenIds = new uint[](mintLength);
      amounts = new uint[](mintLength);
      if (quest.rewardItemTokenId != NONE) {
        itemTokenIds[0] = quest.rewardItemTokenId;
        amounts[0] = quest.rewardAmount;
      }
      if (quest.rewardItemTokenId1 != NONE) {
        itemTokenIds[1] = quest.rewardItemTokenId1;
        amounts[1] = quest.rewardAmount1;
      }
      itemTokenIdBurned = quest.burnItemTokenId;
      amountBurned = quest.burnAmount;
      skillGained = quest.skillReward;
      xpGained = quest.skillXPGained;
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
    U256 bounds = _minimumRequirements.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint i = iter.asUint256();
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

  function setPlayers(IPlayers _players) external onlyOwner {
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
    U256 bounds = _quests.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint i = iter.asUint256();
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
      U256 bounds = randomQuests.length.asU256();
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        uint i = iter.asUint256();
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
