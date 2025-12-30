// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OAppUpgradeable, Origin, MessagingFee} from "@layerzerolabs/oapp-evm-upgradeable/contracts/oapp/OAppUpgradeable.sol";

import {PetNFT} from "../PetNFT.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {PlayerNFT} from "../PlayerNFT.sol";
import {Players} from "../Players/Players.sol";
import {Clans} from "../Clans/Clans.sol";
import {Quests} from "../Quests.sol";
import {PassiveActions} from "../PassiveActions.sol";

import {PlayerQuest} from "../globals/quests.sol";
import {Skill} from "../globals/players.sol";

import {PlayersLibrary} from "../Players/PlayersLibrary.sol";

contract Bridge is UUPSUpgradeable, OAppUpgradeable {
  error InvalidInputLength();
  error MessageAlreadyProcessed();
  error InvalidSourceChain();
  error UnknownMessageType();
  error PlayerAlreadyExists();

  PetNFT private _petNFT;
  PlayerNFT private _playerNFT;
  Players private _players;
  ItemNFT private _itemNFT;
  Clans private _clans;
  Quests private _quests;
  PassiveActions private _passiveActions;
  uint32 _srcEid;

  // Mapping to track processed message guids
  mapping(bytes32 guids => bool isProcessed) private processedMessages;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor(address lzEndpoint) OAppUpgradeable(lzEndpoint) {
    _disableInitializers();
  }

  /// @custom:oz-upgrades-unsafe-allow missing-initializer-call
  function initialize(uint32 srcEid) public initializer {
    __Ownable_init(_msgSender());
    __OApp_init(_msgSender());
    __UUPSUpgradeable_init();
    _srcEid = srcEid;
  }

  /**
   * @dev Called when data is received from the protocol. It overrides the equivalent function in the parent contract.
   * Protocol messages are defined as packets, comprised of the following parameters.
   * @param origin A struct containing information about where the packet came from.
   * @param guid A global unique identifier for tracking the packet.
   * @param payload Encoded message.
   */
  function _lzReceive(
    Origin calldata origin,
    bytes32 guid,
    bytes calldata payload,
    address executor, // Executor address as specified by the OApp.
    bytes calldata extraData // Any extra data or options to trigger on receipt.
  ) internal override {
    // Prevent duplicate messages
    require(!processedMessages[guid], MessageAlreadyProcessed());

    // Only needed if you want to restrict to specific source chain
    require(origin.srcEid == _srcEid, InvalidSourceChain());

    // Mark message as processed
    processedMessages[guid] = true;

    // Determine the type from the first byte of the payload
    uint8 messageType = abi.decode(payload, (uint8));

    if (messageType == 1) {
      _handlePetMessage(payload);
    } else if (messageType == 2) {
      _handleItemMessage(payload);
    } else if (messageType == 3) {
      _handlePlayerMessage(payload);
    } else {
      revert UnknownMessageType();
    }
  }

  function _handlePetMessage(bytes calldata payload) private {
    (
      uint256 messageType,
      address from,
      uint256[] memory petIds,
      uint24[] memory basePetIds,
      string[] memory petNames,
      Skill[] memory skillEnhancement1s,
      uint8[] memory skillFixedEnhancement1s,
      uint8[] memory skillPercentageEnhancement1,
      Skill[] memory skillEnhancement2s,
      uint8[] memory skillFixedEnhancement2s,
      uint8[] memory skillPercentageEnhancement2s
    ) = abi.decode(
        payload,
        (uint256, address, uint256[], uint24[], string[], Skill[], uint8[], uint8[], Skill[], uint8[], uint8[])
      );

    // Mint the pet
    _petNFT.mintBridge(
      from,
      petIds,
      basePetIds,
      petNames,
      skillEnhancement1s,
      skillFixedEnhancement1s,
      skillPercentageEnhancement1,
      skillEnhancement2s,
      skillFixedEnhancement2s,
      skillPercentageEnhancement2s
    );
  }

  function _handleItemMessage(bytes calldata payload) private {
    (uint256 messageType, address to, uint256[] memory ids, uint256[] memory amounts) = abi.decode(
      payload,
      (uint256, address, uint256[], uint256[])
    );
    _itemNFT.mintBatch(to, ids, amounts);
  }

  function _handlePlayerMessage(bytes calldata payload) private {
    (
      uint256 messageType,
      address from,
      uint256 playerId,
      uint256 avatarId,
      string memory heroName,
      string memory discord,
      string memory twitter,
      string memory telegram,
      bool isUpgraded,
      Skill[] memory skills,
      uint256[] memory xps,
      uint256 clanId,
      string memory clanName,
      string memory clanDiscord,
      string memory clanTelegram,
      string memory clanTwitter,
      uint256 clanImageId,
      uint256 clanCreatedTimestamp,
      uint256 clanTierId,
      uint256 clanMMR,
      bool clanDisableJoinRequests,
      uint256[] memory questsCompleted,
      uint256[] memory questIds,
      uint256[] memory questActionCompletedNum1s,
      uint256[] memory questActionCompletedNum2s,
      uint256[] memory questActionChoiceCompletedNums,
      uint256[] memory questBurnCompletedAmounts,
      uint256 passiveActionId,
      uint256 passiveActionStartTime
    ) = abi.decode(
        payload,
        (
          uint256,
          address,
          uint256,
          uint256,
          string,
          string,
          string,
          string,
          bool,
          Skill[],
          uint256[],
          uint256,
          string,
          string,
          string,
          string,
          uint256,
          uint256,
          uint256,
          uint256,
          bool,
          uint256[],
          uint256[],
          uint256[],
          uint256[],
          uint256[],
          uint256[],
          uint256,
          uint256
        )
      );

    // Check player does not exist
    require(!_playerNFT.exists(playerId), PlayerAlreadyExists());

    // Mint the player
    _playerNFT.mintBridge(from, playerId, avatarId, heroName, discord, twitter, telegram, isUpgraded);

    // Update all xps for the skills
    uint256 totalXP;
    uint256 totalLevel;
    bool skipEffects = true;
    for (uint256 i = 0; i < skills.length; ++i) {
      uint56 skillXP = uint56(xps[i]);
      if (skillXP > 0) {
        _players.modifyXP(from, playerId, skills[i], skillXP, skipEffects);
      }
      totalXP += skillXP;
      totalLevel += PlayersLibrary._getLevel(skillXP);
    }
    // Need to add Level 1 for farming as it didn't exist on Fantom
    totalLevel += 1;
    _players.bridgePlayer(playerId, totalXP, totalLevel);

    // Create clan. Not worrying about the clan items, only clan itself
    if (clanId != 0) {
      _clans.createClanBridge(
        from,
        playerId,
        clanId,
        clanName,
        clanDiscord,
        clanTelegram,
        clanTwitter,
        clanImageId,
        clanCreatedTimestamp,
        clanTierId,
        clanMMR,
        clanDisableJoinRequests
      );
    }

    // Update quests
    _quests.processQuestsBridge(
      from,
      playerId,
      questsCompleted,
      questIds,
      questActionCompletedNum1s,
      questActionCompletedNum2s,
      questActionChoiceCompletedNums,
      questBurnCompletedAmounts
    );

    _passiveActions.addPassiveActionBridge(playerId, passiveActionId, passiveActionStartTime);
  }

  function initializeAddresses(
    PetNFT petNFT,
    ItemNFT itemNFT,
    PlayerNFT playerNFT,
    Players players,
    Clans clans,
    Quests quests,
    PassiveActions passiveActions
  ) external onlyOwner {
    _petNFT = petNFT;
    _itemNFT = itemNFT;
    _playerNFT = playerNFT;
    _players = players;
    _clans = clans;
    _quests = quests;
    _passiveActions = passiveActions;
  }

  function _authorizeUpgrade(address) internal override onlyOwner {}
}
