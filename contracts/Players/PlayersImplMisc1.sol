// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";

import {PlayersImplBase} from "./PlayersImplBase.sol";
import {PlayersBase} from "./PlayersBase.sol";
import {PlayersLibrary} from "./PlayersLibrary.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {PlayerNFT} from "../PlayerNFT.sol";
import {PetNFT} from "../PetNFT.sol";
import {World} from "../World.sol";
import {AdminAccess} from "../AdminAccess.sol";
import {Quests} from "../Quests.sol";
import {Clans} from "../Clans/Clans.sol";
import {WishingWell} from "../WishingWell.sol";
import {IPlayersMisc1DelegateView} from "../interfaces/IPlayersDelegates.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

contract PlayersImplMisc1 is PlayersImplBase, PlayersBase, IPlayersMisc1DelegateView {
  using Strings for uint32;
  using Strings for uint256;
  using Strings for bytes32;

  using UnsafeMath for U256;
  using UnsafeMath for uint256;

  address immutable _this;

  constructor() {
    _checkStartSlot();
    _this = address(this);
  }

  function initialize(
    ItemNFT _itemNFT,
    PlayerNFT _playerNFT,
    PetNFT _petNFT,
    World _world,
    AdminAccess _adminAccess,
    Quests _quests,
    Clans _clans,
    WishingWell _wishingWell,
    address _implQueueActions,
    address _implProcessActions,
    address _implRewards,
    address _implMisc,
    address _implMisc1,
    bool _isBeta
  ) external {
    if (address(this) == _this) {
      revert CannotCallInitializerOnImplementation();
    }

    itemNFT = _itemNFT;
    playerNFT = _playerNFT;
    petNFT = _petNFT;
    world = _world;
    adminAccess = _adminAccess;
    quests = _quests;
    clans = _clans;
    wishingWell = _wishingWell;
    implQueueActions = _implQueueActions;
    implProcessActions = _implProcessActions;
    implRewards = _implRewards;
    implMisc = _implMisc;
    implMisc1 = _implMisc1;

    nextQueueId = 1;
    alphaCombat = 1;
    betaCombat = 1;
    alphaCombatHealing = 8;
    isBeta = _isBeta;
  }

  // Show all the player stats, return metadata json
  function uri(
    string calldata _playerName,
    string calldata _avatarName,
    string calldata _avatarDescription,
    string calldata _imageURI,
    uint _playerId
  ) external view returns (string memory) {
    PackedXP storage packedXP = xp_[_playerId];
    uint overallLevel = PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.MELEE, packedXP)) +
      PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.RANGED, packedXP)) +
      PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.MAGIC, packedXP)) +
      PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.DEFENCE, packedXP)) +
      PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.HEALTH, packedXP)) +
      PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.MINING, packedXP)) +
      PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.WOODCUTTING, packedXP)) +
      PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.FISHING, packedXP)) +
      PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.SMITHING, packedXP)) +
      PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.THIEVING, packedXP)) +
      PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.CRAFTING, packedXP)) +
      PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.COOKING, packedXP)) +
      PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.FIREMAKING, packedXP)) +
      PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.ALCHEMY, packedXP)) +
      PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.FLETCHING, packedXP)) +
      PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.FORGING, packedXP));

    string memory attributes = string(
      abi.encodePacked(
        _getTraitStringJSON("Avatar", _avatarName),
        ",",
        _getTraitStringJSON("Clan", clans.getClanNameOfPlayer(_playerId)),
        ",",
        _getTraitStringJSON("Full version", _isPlayerFullMode(_playerId) ? "true" : "false"),
        ",",
        _getTraitNumberJSON("Melee level", PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.MELEE, packedXP))),
        ",",
        _getTraitNumberJSON("Ranged level", PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.RANGED, packedXP))),
        ",",
        _getTraitNumberJSON("Magic level", PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.MAGIC, packedXP))),
        ",",
        _getTraitNumberJSON("Defence level", PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.DEFENCE, packedXP))),
        ",",
        _getTraitNumberJSON("Health level", PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.HEALTH, packedXP))),
        ",",
        _getTraitNumberJSON("Mining level", PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.MINING, packedXP))),
        ",",
        _getTraitNumberJSON(
          "Woodcutting level",
          PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.WOODCUTTING, packedXP))
        ),
        ",",
        _getTraitNumberJSON("Fishing level", PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.FISHING, packedXP))),
        ",",
        _getTraitNumberJSON("Smithing level", PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.SMITHING, packedXP))),
        ",",
        _getTraitNumberJSON("Thieving level", PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.THIEVING, packedXP))),
        ",",
        _getTraitNumberJSON("Crafting level", PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.CRAFTING, packedXP))),
        ",",
        _getTraitNumberJSON("Cooking level", PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.COOKING, packedXP))),
        ",",
        _getTraitNumberJSON(
          "Firemaking level",
          PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.FIREMAKING, packedXP))
        ),
        ",",
        _getTraitNumberJSON("Alchemy level", PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.ALCHEMY, packedXP))),
        ",",
        _getTraitNumberJSON(
          "Fletching level",
          PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.FLETCHING, packedXP))
        ),
        ",",
        _getTraitNumberJSON("Forging level", PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.FORGING, packedXP))),
        ",",
        _getTraitNumberJSON("Total level", uint16(overallLevel))
      )
    );

    bytes memory fullName = abi.encodePacked(_playerName, " (", overallLevel.toString(), ")");
    bytes memory externalURL = abi.encodePacked(
      "https://",
      isBeta ? "beta." : "",
      "estfor.com/journal/",
      _playerId.toString()
    );

    string memory json = Base64.encode(
      abi.encodePacked(
        '{"name":"',
        fullName,
        '","description":"',
        _avatarDescription,
        '","attributes":[',
        attributes,
        '],"image":"',
        _imageURI,
        '", "external_url":"',
        externalURL,
        '"}'
      )
    );

    return string(abi.encodePacked("data:application/json;base64,", json));
  }

  function _getTraitStringJSON(string memory _traitType, string memory _value) private pure returns (bytes memory) {
    return abi.encodePacked(_getTraitTypeJSON(_traitType), '"', _value, '"}');
  }

  function _getTraitNumberJSON(string memory _traitType, uint32 _value) private pure returns (bytes memory) {
    return abi.encodePacked(_getTraitTypeJSON(_traitType), _value.toString(), "}");
  }

  function _getTraitTypeJSON(string memory _traitType) private pure returns (bytes memory) {
    return abi.encodePacked('{"trait_type":"', _traitType, '","value":');
  }

  function addFullAttireBonuses(FullAttireBonusInput[] calldata _fullAttireBonuses) external {
    U256 bounds = _fullAttireBonuses.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint i = iter.asUint256();
      FullAttireBonusInput calldata _fullAttireBonus = _fullAttireBonuses[i];

      if (_fullAttireBonus.skill == Skill.NONE) {
        revert InvalidSkill();
      }
      EquipPosition[5] memory expectedEquipPositions = [
        EquipPosition.HEAD,
        EquipPosition.BODY,
        EquipPosition.ARMS,
        EquipPosition.LEGS,
        EquipPosition.FEET
      ];
      U256 jbounds = expectedEquipPositions.length.asU256();
      for (U256 jter; jter < jbounds; jter = jter.inc()) {
        uint j = jter.asUint256();
        if (_fullAttireBonus.itemTokenIds[j] == NONE) {
          revert InvalidItemTokenId();
        }
        if (itemNFT.getEquipPosition(_fullAttireBonus.itemTokenIds[j]) != expectedEquipPositions[j]) {
          revert InvalidEquipPosition();
        }
      }

      fullAttireBonus[_fullAttireBonus.skill] = FullAttireBonus(
        _fullAttireBonus.bonusXPPercent,
        _fullAttireBonus.bonusRewardsPercent,
        _fullAttireBonus.itemTokenIds
      );
      emit AddFullAttireBonus(
        _fullAttireBonus.skill,
        _fullAttireBonus.itemTokenIds,
        _fullAttireBonus.bonusXPPercent,
        _fullAttireBonus.bonusRewardsPercent
      );
    }
  }
}
