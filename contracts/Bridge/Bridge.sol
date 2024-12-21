// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OAppCoreUpgradeable, OAppSenderUpgradeable, Origin, MessagingFee} from "@layerzerolabs/oapp-evm-upgradeable/contracts/oapp/OAppUpgradeable.sol";
import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";

import {PetNFT} from "../PetNFT.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {PlayerNFT} from "../PlayerNFT.sol";
import {Players} from "../Players/Players.sol";
import {Clans} from "../Clans/Clans.sol";
import {Quests} from "../Quests.sol";
import {PassiveActions} from "../PassiveActions.sol";

import {PlayerQuest} from "../globals/quests.sol";
import {Skill} from "../globals/players.sol";

contract Bridge is UUPSUpgradeable, OAppSenderUpgradeable {
  error NotOwnerOfPlayer();
  error SendingNoItems();
  error SendingTooManyItems();
  error SendingNoPets();
  error SendingTooManyPets();

  PetNFT private petNFT;
  PlayerNFT private playerNFT;
  Players private players;
  ItemNFT private itemNFT;
  Clans private clans;
  Quests private quests;
  PassiveActions private passiveActions;
  uint32 private dstEid;

  modifier isOwnerOfPlayer(uint _playerId) {
    if (playerNFT.balanceOf(_msgSender(), _playerId) == 0) {
      revert NotOwnerOfPlayer();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor(address _lzEndpoint) OAppCoreUpgradeable(_lzEndpoint) {
    _disableInitializers();
  }

  function initialize(
    uint32 _dstEid,
    PetNFT _petNFT,
    ItemNFT _itemNFT,
    PlayerNFT _playerNFT,
    Players _players,
    Clans _clans,
    Quests _quests,
    PassiveActions _passiveActions
  ) public initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();
    __OAppSender_init(_msgSender());
    dstEid = _dstEid;
    petNFT = _petNFT;
    itemNFT = _itemNFT;
    playerNFT = _playerNFT;
    players = _players;
    clans = _clans;
    quests = _quests;
    passiveActions = _passiveActions;
  }

  uint8 internal constant OPTION_TYPE_LZRECEIVE = 1;
  uint8 internal constant WORKER_ID = 1;

  function encodeLzReceiveOption(uint128 _gas, uint128 _value) internal pure returns (bytes memory) {
    return _value == 0 ? abi.encodePacked(_gas) : abi.encodePacked(_gas, _value);
  }

  function _addExecutorOption(
    bytes memory _options, // [in]/[out]
    uint8 _optionType,
    bytes memory _option
  ) private pure returns (bytes memory options) {
    options = abi.encodePacked(
      _options,
      WORKER_ID,
      uint16(_option.length + 1), // +1 for optionType
      _optionType,
      _option
    );
  }

  function _sendPetsView(
    address to,
    uint256[] calldata _petIds,
    bool _throwOnError
  ) private view returns (bytes memory payload, bytes memory options) {
    uint256 messageType = 1;
    if (_petIds.length == 0) {
      revert SendingNoPets();
    }
    if (_petIds.length > 32) {
      revert SendingTooManyPets();
    }

    (
      uint24[] memory basePetIds,
      string[] memory petNames,
      Skill[] memory skillEnhancement1s,
      uint8[] memory skillFixedEnhancement1s,
      uint8[] memory skillPercentageEnhancement1,
      Skill[] memory skillEnhancement2s,
      uint8[] memory skillFixedEnhancement2s,
      uint8[] memory skillPercentageEnhancement2s
    ) = petNFT.getBridgeablePets(to, _petIds, _throwOnError);

    uint128 gas = 300_000; // base gas
    gas += uint128(100_000 * _petIds.length);

    uint128 value = 0;
    bytes memory option = encodeLzReceiveOption(gas, value);
    options = OptionsBuilder.newOptions();
    options = _addExecutorOption(options, OPTION_TYPE_LZRECEIVE, option);
    payload = abi.encode(
      messageType,
      msg.sender,
      _petIds,
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

  function quoteSendPets(uint256[] calldata _petIds) external view returns (uint256 nativeFee) {
    (bytes memory payload, bytes memory options) = _sendPetsView(_msgSender(), _petIds, false);
    MessagingFee memory fee = _quote(dstEid, payload, options, false);
    return fee.nativeFee;
  }

  function sendPets(uint256[] calldata _petIds) external payable {
    (bytes memory payload, bytes memory options) = _sendPetsView(_msgSender(), _petIds, true);
    petNFT.bridgePets(_msgSender(), _petIds); // this burns the items basically
    _lzSend(dstEid, payload, options, MessagingFee(msg.value, 0), payable(_msgSender()));
  }

  function _sendItemsView(
    uint256[] calldata _itemTokenIds,
    uint256[] calldata _amounts
  ) private view returns (bytes memory payload, bytes memory options) {
    if (_itemTokenIds.length == 0) {
      revert SendingNoItems();
    }
    if (_itemTokenIds.length > 150) {
      revert SendingTooManyItems();
    }
    uint256 messageType = 2;
    uint128 gas = 300_000; // base gas
    gas += uint128(50_000 * _itemTokenIds.length); // for minting all the items

    uint128 value = 0;
    bytes memory option = encodeLzReceiveOption(gas, value);
    options = OptionsBuilder.newOptions();
    options = _addExecutorOption(options, OPTION_TYPE_LZRECEIVE, option);
    payload = abi.encode(messageType, msg.sender, _itemTokenIds, _amounts);
  }

  /* @dev Quotes the gas needed to pay for the full omnichain transaction.
   * @return nativeFee Estimated gas fee in native gas.
   */
  function quoteSendItems(
    uint256[] calldata _itemTokenIds,
    uint256[] calldata _amounts
  ) external view returns (uint256 nativeFee) {
    (bytes memory payload, bytes memory options) = _sendItemsView(_itemTokenIds, _amounts);
    MessagingFee memory fee = _quote(dstEid, payload, options, false);
    return fee.nativeFee;
  }

  function sendItems(uint256[] calldata _itemTokenIds, uint256[] calldata _amounts) external payable {
    itemNFT.bridgeItems(_msgSender(), _itemTokenIds, _amounts); // this burns the items basically
    (bytes memory payload, bytes memory options) = _sendItemsView(_itemTokenIds, _amounts);
    _lzSend(dstEid, payload, options, MessagingFee(msg.value, 0), payable(_msgSender()));
  }

  function _sendPlayerView(
    uint256 _playerId,
    string memory _discord,
    string memory _twitter,
    string memory _telegram,
    uint256 _clanId,
    string memory _clanDiscord,
    string memory _clanTelegram,
    string memory _clanTwitter
  ) private view returns (bytes memory payload, bytes memory options) {
    uint256 messageType = 3;
    uint128 gas = 1_500_000; // base gas for all the skills

    // Players
    bool isPlayerUpgraded;
    if (address(players) != address(0)) {
      isPlayerUpgraded = players.getBridgeablePlayer(_playerId); // Does a loot too
    }

    (uint24 avatarId, string memory heroName) = playerNFT.getBridgeablePlayer(_playerId, _discord, _twitter, _telegram);

    // Clan
    (
      string memory clanName,
      uint16 clanImageId,
      uint40 clanCreatedTimestamp,
      uint8 clanTierId,
      uint16 clanMMR,
      bool clanDisableJoinRequests
    ) = clans.getBridgeableClan(_playerId, _clanId, _clanDiscord, _clanTelegram, _clanTwitter);

    if (_clanId != 0) {
      gas += 1_000_000;
    }

    // Quests
    (
      uint256[] memory questsCompleted,
      uint256[] memory questIds,
      uint256[] memory questActionCompletedNum1s,
      uint256[] memory questActionCompletedNum2s,
      uint256[] memory questActionChoiceCompletedNums,
      uint256[] memory questBurnCompletedAmounts
    ) = quests.getBridgeableQuests(_playerId);

    gas += uint128(questIds.length * 100_000);
    gas += uint128(questsCompleted.length * 100_000); // In case some are the quests that give XP

    // Bridge the skills
    Skill[] memory skills = new Skill[](16);
    skills[0] = Skill.MELEE;
    skills[1] = Skill.RANGED;
    skills[2] = Skill.MAGIC;
    skills[3] = Skill.DEFENCE;
    skills[4] = Skill.HEALTH;
    skills[5] = Skill.MINING;
    skills[6] = Skill.WOODCUTTING;
    skills[7] = Skill.FISHING;
    skills[8] = Skill.SMITHING;
    skills[9] = Skill.THIEVING;
    skills[10] = Skill.CRAFTING;
    skills[11] = Skill.COOKING;
    skills[12] = Skill.FIREMAKING;
    skills[13] = Skill.ALCHEMY;
    skills[14] = Skill.FLETCHING;
    skills[15] = Skill.FORGING;

    uint256[] memory xps = new uint256[](16);
    for (uint i = 0; i < 16; i++) {
      xps[i] = players.xp(_playerId, skills[i]);
    }

    // Wishing well, total donated (do if time)

    // Passive action
    (uint16 passiveActionId, uint40 passiveActionStartTime) = passiveActions.getBridgeablePassiveAction(_playerId);
    if (passiveActionId != 0) {
      gas += 200_000;
    }

    uint128 value = 0;
    bytes memory option = encodeLzReceiveOption(gas, value);
    options = OptionsBuilder.newOptions();
    options = _addExecutorOption(options, OPTION_TYPE_LZRECEIVE, option);

    payload = abi.encode(
      messageType,
      msg.sender,
      _playerId,
      avatarId,
      heroName,
      _discord,
      _twitter,
      _telegram,
      isPlayerUpgraded,
      skills,
      xps,
      _clanId,
      clanName,
      _clanDiscord,
      _clanTelegram,
      _clanTwitter,
      clanImageId,
      clanCreatedTimestamp,
      clanTierId,
      clanMMR,
      clanDisableJoinRequests,
      questsCompleted,
      questIds,
      questActionCompletedNum1s,
      questActionCompletedNum2s,
      questActionChoiceCompletedNums,
      questBurnCompletedAmounts,
      passiveActionId,
      passiveActionStartTime
    );
  }

  function quoteSendPlayer(
    uint256 _playerId,
    string memory _discord,
    string memory _twitter,
    string memory _telegram,
    uint256 _clanId,
    string memory _clanDiscord,
    string memory _clanTelegram,
    string memory _clanTwitter
  ) external view returns (uint256 nativeFee) {
    (bytes memory payload, bytes memory options) = _sendPlayerView(
      _playerId,
      _discord,
      _twitter,
      _telegram,
      _clanId,
      _clanDiscord,
      _clanTelegram,
      _clanTwitter
    );
    MessagingFee memory fee = _quote(dstEid, payload, options, false);
    return fee.nativeFee;
  }

  // Also sends the clan if they are the owner
  function sendPlayer(
    uint256 _playerId,
    string memory _discord,
    string memory _twitter,
    string memory _telegram,
    uint256 _clanId,
    string memory _clanDiscord,
    string memory _clanTelegram,
    string memory _clanTwitter
  ) external payable isOwnerOfPlayer(_playerId) {
    uint256 messageType = 2;

    (bytes memory payload, bytes memory options) = _sendPlayerView(
      _playerId,
      _discord,
      _twitter,
      _telegram,
      _clanId,
      _clanDiscord,
      _clanTelegram,
      _clanTwitter
    );

    // Bridge the clan (delete it)
    clans.bridgeClan(_clanId);

    // Loot player
    players.bridgePlayer(_msgSender(), _playerId);

    // Delete player
    playerNFT.bridgePlayer(_msgSender(), _playerId);

    _lzSend(dstEid, payload, options, MessagingFee(msg.value, 0), payable(_msgSender()));
  }

  function _authorizeUpgrade(address) internal override onlyOwner {}
}
