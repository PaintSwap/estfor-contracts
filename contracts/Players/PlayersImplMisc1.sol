// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

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

  constructor() {
    _checkStartSlot();
  }

  // Show all the player stats, return metadata json
  function uri(
    string calldata playerName,
    string calldata avatarName,
    string calldata avatarDescription,
    string calldata imageURI,
    uint256 playerId
  ) external view returns (string memory) {
    PackedXP storage packedXP = _playerXP[playerId];
    uint256 overallLevel = PlayersLibrary.getLevel(PlayersLibrary.readXP(Skill.MELEE, packedXP)) +
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
        _getTraitStringJSON("Avatar", avatarName),
        ",",
        _getTraitStringJSON("Clan", _clans.getClanNameOfPlayer(playerId)),
        ",",
        _getTraitStringJSON("Full version", _isPlayerFullMode(playerId) ? "true" : "false"),
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

    bytes memory fullName = abi.encodePacked(playerName, " (", overallLevel.toString(), ")");
    bytes memory externalURL = abi.encodePacked(
      "https://",
      _isBeta ? "beta." : "",
      "estfor.com/journal/",
      playerId.toString()
    );

    string memory json = Base64.encode(
      abi.encodePacked(
        '{"name":"',
        fullName,
        '","description":"',
        avatarDescription,
        '","attributes":[',
        attributes,
        '],"image":"',
        imageURI,
        '", "external_url":"',
        externalURL,
        '"}'
      )
    );

    return string(abi.encodePacked("data:application/json;base64,", json));
  }

  function _getTraitStringJSON(string memory traitType, string memory value) private pure returns (bytes memory) {
    return abi.encodePacked(_getTraitTypeJSON(traitType), '"', value, '"}');
  }

  function _getTraitNumberJSON(string memory traitType, uint32 value) private pure returns (bytes memory) {
    return abi.encodePacked(_getTraitTypeJSON(traitType), value.toString(), "}");
  }

  function _getTraitTypeJSON(string memory traitType) private pure returns (bytes memory) {
    return abi.encodePacked('{"trait_type":"', traitType, '","value":');
  }

  function addFullAttireBonuses(FullAttireBonusInput[] calldata fullAttireBonuses) external {
    uint256 bounds = fullAttireBonuses.length;
    for (uint256 iter; iter < bounds; iter++) {
      FullAttireBonusInput calldata fullAttireBonus = fullAttireBonuses[iter];

      require(fullAttireBonus.skill != Skill.NONE, InvalidSkill());
      EquipPosition[5] memory expectedEquipPositions = [
        EquipPosition.HEAD,
        EquipPosition.BODY,
        EquipPosition.ARMS,
        EquipPosition.LEGS,
        EquipPosition.FEET
      ];
      uint256 jbounds = expectedEquipPositions.length;
      for (uint256 jter; jter < jbounds; jter++) {
        require(fullAttireBonus.itemTokenIds[jter] != NONE, InvalidItemTokenId());
        require(
          _itemNFT.getEquipPosition(fullAttireBonus.itemTokenIds[jter]) == expectedEquipPositions[jter],
          InvalidEquipPosition()
        );
      }

      _fullAttireBonus[fullAttireBonus.skill] = FullAttireBonus(
        fullAttireBonus.bonusXPPercent,
        fullAttireBonus.bonusRewardsPercent,
        fullAttireBonus.itemTokenIds
      );
      emit AddFullAttireBonus(
        fullAttireBonus.skill,
        fullAttireBonus.itemTokenIds,
        fullAttireBonus.bonusXPPercent,
        fullAttireBonus.bonusRewardsPercent
      );
    }
  }
}
