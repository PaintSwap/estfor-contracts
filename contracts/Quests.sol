// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IQuests} from "./interfaces/IQuests.sol";

/* solhint-disable no-global-import */
import "./globals/actions.sol";
import "./globals/items.sol";

/* solhint-enable no-global-import */

contract Quests is UUPSUpgradeable, OwnableUpgradeable, IQuests {
  error NotWorld();
  error NotOwnerOfPlayer();
  error QuestDoesntExist();
  error InvalidQuestId();
  error CannotRemoveActiveRandomQuest();
  error QuestWithIdAlreadyExists();
  error InvalidRewardAmount();
  error InvalidReward();
  error InvalidActionNum();
  error InvalidActionChoiceNum();
  error LengthMismatch();

  struct Quest {
    uint16 actionId;
    uint16 actionNum;
    uint16 actionId1;
    uint16 actionNum1;
    uint16 actionChoiceId;
    uint16 actionChoiceNum;
    uint16 actionChoiceId1;
    uint16 actionChoiceNum1;
    // 128 bits left under here
    uint64 questId;
    uint16 rewardItemTokenId;
    uint16 rewardAmount;
    uint16 rewardItemTokenId1;
    uint16 rewardAmount1;
  }

  address private world;
  IERC1155 private playerNFT;
  mapping(uint questId => Quest quest) public allQuests;
  mapping(uint playerId => mapping(uint questId => bool done)) public questsCompleted; // TODO: Could use bit mask
  mapping(uint playerId => Quest quest) public activeQuests;
  mapping(uint questId => bool) public isRandomQuest;
  Quest[] public randomQuests;
  Quest public previousRandomQuest; // Allow people to complete it if they didn't process it in the current day
  Quest public randomQuest; // Same for everyone

  event AddQuest(Quest quest);
  event RemoveQuest(uint questId);
  event RemoveRandomQuest(uint questId);

  modifier onlyWorld() {
    if (msg.sender != world) {
      revert NotWorld();
    }
    _;
  }

  modifier isOwnerOfPlayer(uint playerId) {
    if (playerNFT.balanceOf(_msgSender(), playerId) != 1) {
      revert NotOwnerOfPlayer();
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

  function activateQuest(uint _playerId, uint _questId) external isOwnerOfPlayer(_playerId) {
    Quest storage quest = allQuests[_questId];
    if (_questId == 0) {
      revert InvalidQuestId();
    }
    if (quest.questId != _questId) {
      revert QuestDoesntExist();
    }
    activeQuests[_playerId] = quest;
  }

  function newOracleRandomWords(uint[3] calldata _randomWords) external override onlyWorld {
    // Remove the old one
    if (randomQuest.questId != 0) {
      emit RemoveRandomQuest(randomQuest.questId);
    }
    // Pick a random quest which is assigned to everyone (could be random later)
    uint length = randomQuests.length;
    if (length == 0) {
      return; // Don't revert as this would mess up the chainlink callback
    }

    uint index = uint8(_randomWords[0]) % length;
    randomQuest = randomQuests[index];
  }

  function _addQuest(Quest calldata _quest, bool _isRandom) private {
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
    if (_quest.actionChoiceId1 != 0 && _quest.actionChoiceNum1 == 0) {
      revert InvalidActionChoiceNum();
    }
    if (_quest.questId == 0) {
      revert InvalidQuestId();
    }

    allQuests[_quest.questId] = _quest;
    emit AddQuest(_quest);
  }

  function addQuest(Quest calldata _quest, bool _isRandom) external onlyOwner {
    _addQuest(_quest, _isRandom);
  }

  function addQuests(Quest[] calldata _quests, bool[] calldata _isRandom) external onlyOwner {
    if (_quests.length != _isRandom.length) {
      revert LengthMismatch();
    }
    for (uint i = 0; i < _quests.length; ++i) {
      _addQuest(_quests[i], _isRandom[i]);
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
