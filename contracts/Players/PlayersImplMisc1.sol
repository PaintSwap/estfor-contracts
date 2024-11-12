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

  function _fromBeforeItemNFTTransfer(
    address from,
    uint256 playerId,
    uint256[] memory ids,
    uint256[] memory amounts,
    uint256 nextCheckpointTimestamp,
    uint256 queuedIndex
  ) private {
    if (block.timestamp < nextCheckpointTimestamp) {
      // Action 1 has not finished yet
      for (uint256 i; i < ids.length; ++i) {
        uint256 itemId = ids[i];
        uint256 amount = amounts[i];
        if (itemId == 0) {
          continue;
        }
        for (uint256 j; j < _checkpointEquipments[playerId][queuedIndex].itemTokenIds.length; ++j) {
          if (_checkpointEquipments[playerId][queuedIndex].itemTokenIds[j] == itemId) {
            // An item being transferred is currently in use.
            uint256 checkpointBalance = _checkpointEquipments[playerId][queuedIndex].balances[j];
            if (checkpointBalance == type(uint16).max) {
              // special sentinel case of owning case
              // They own a lot so need to check balance
              checkpointBalance = _itemNFT.balanceOf(from, itemId) - amount;
              if (checkpointBalance > type(uint16).max) {
                // They will still own a lot after the transfer
                checkpointBalance = type(uint16).max; // Reset back to this sentinel value
              }
            } else {
              if (checkpointBalance >= amount) {
                checkpointBalance -= amount;
              } else {
                checkpointBalance = 0;
              }
            }
            _checkpointEquipments[playerId][queuedIndex].balances[j] = uint16(checkpointBalance);
          }
        }
      }
    }
  }

  function _toBeforeItemNFTTransfer(
    uint256 playerId,
    uint256[] memory ids,
    uint256[] memory amounts,
    uint256 checkpointTimestamp,
    uint256 queuedIndex
  ) private {
    bool hasActionStarted = checkpointTimestamp < block.timestamp;
    if (!hasActionStarted) {
      // Action has not started (Don't think it will ever happen with the first one)
      for (uint256 i; i < ids.length; ++i) {
        uint256 itemId = ids[i];
        uint256 amount = amounts[i];
        if (itemId == 0) {
          continue;
        }
        for (uint256 j; j < _checkpointEquipments[playerId][queuedIndex].itemTokenIds.length; ++j) {
          if (_checkpointEquipments[playerId][queuedIndex].itemTokenIds[j] == itemId) {
            // An item being transferred is currently in use.
            uint256 checkpointBlance = _checkpointEquipments[playerId][queuedIndex].balances[j] + amount;
            if (checkpointBlance > type(uint16).max) {
              checkpointBlance = type(uint16).max;
            }
            _checkpointEquipments[playerId][queuedIndex].balances[j] = uint16(checkpointBlance);
          }
        }
      }
    }
  }

  function beforeItemNFTTransfer(address from, address to, uint256[] memory ids, uint256[] memory amounts) external {
    bool isMinting = from == address(0);
    if (!isMinting) {
      uint256 playerId = _activePlayerInfos[from].playerId;
      if (playerId != 0) {
        uint256 checkpoint = _activePlayerInfos[from].checkpoint;
        if (checkpoint != 0) {
          // Got through all possible actions (max 3)
          uint256 nextCheckpointTimestamp = checkpoint;
          uint24[3] memory timespans = [
            _activePlayerInfos[from].timespan,
            _activePlayerInfos[from].timespan1,
            _activePlayerInfos[from].timespan2
          ];
          for (uint256 i; i < 3; ++i) {
            nextCheckpointTimestamp += timespans[i];
            _fromBeforeItemNFTTransfer(from, playerId, ids, amounts, nextCheckpointTimestamp, i);
          }
        }
      }
    }

    // Checkpoint balance only increases if the action hasn't started yet, otherwise is unaffected.
    bool isBurning = to == address(0);
    if (!isBurning) {
      uint256 playerId = _activePlayerInfos[to].playerId;
      if (playerId != 0) {
        uint256 checkpoint = _activePlayerInfos[to].checkpoint;
        if (checkpoint != 0) {
          // Got through all possible actions (max 3)
          uint256 checkpointTimestamp = checkpoint;
          uint24[3] memory timespans = [0, _activePlayerInfos[to].timespan, _activePlayerInfos[to].timespan1];
          for (uint256 i; i < 3; ++i) {
            checkpointTimestamp += timespans[i];
            _toBeforeItemNFTTransfer(playerId, ids, amounts, checkpointTimestamp, i);
          }
        }
      }
    }
  }

  function addFullAttireBonuses(FullAttireBonusInput[] calldata fullAttireBonuses) external {
    for (uint256 i; i < fullAttireBonuses.length; ++i) {
      FullAttireBonusInput calldata fullAttireBonus = fullAttireBonuses[i];

      require(fullAttireBonus.skill != Skill.NONE, InvalidSkill());
      EquipPosition[5] memory expectedEquipPositions = [
        EquipPosition.HEAD,
        EquipPosition.BODY,
        EquipPosition.ARMS,
        EquipPosition.LEGS,
        EquipPosition.FEET
      ];
      uint256 jbounds = expectedEquipPositions.length;
      for (uint256 j; j < jbounds; ++j) {
        require(fullAttireBonus.itemTokenIds[j] != NONE, InvalidItemTokenId());
        require(
          _itemNFT.getEquipPosition(fullAttireBonus.itemTokenIds[j]) == expectedEquipPositions[j],
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
