// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {PlayersBase} from "./PlayersBase.sol";
import {PlayersLibrary} from "./PlayersLibrary.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {PlayerNFT} from "../PlayerNFT.sol";
import {PetNFT} from "../PetNFT.sol";
import {RandomnessBeacon} from "../RandomnessBeacon.sol";
import {AdminAccess} from "../AdminAccess.sol";
import {Quests} from "../Quests.sol";
import {Clans} from "../Clans/Clans.sol";
import {WishingWell} from "../WishingWell.sol";
import {IPlayersMisc1DelegateView} from "../interfaces/IPlayersDelegates.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

contract PlayersImplMisc1 is PlayersBase, IPlayersMisc1DelegateView {
  using Strings for uint32;
  using Strings for uint256;
  using Strings for bytes32;

  // Show all the player stats, return metadata json
  function uri(
    string calldata playerName,
    string calldata avatarName,
    string calldata avatarDescription,
    string calldata imageURI,
    uint256 playerId
  ) external view returns (string memory) {
    PackedXP storage packedXP = _playerXP[playerId];
    uint256 overallLevel = PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.MELEE, packedXP)) +
      PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.RANGED, packedXP)) +
      PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.MAGIC, packedXP)) +
      PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.DEFENCE, packedXP)) +
      PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.HEALTH, packedXP)) +
      PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.MINING, packedXP)) +
      PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.WOODCUTTING, packedXP)) +
      PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.FISHING, packedXP)) +
      PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.SMITHING, packedXP)) +
      PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.THIEVING, packedXP)) +
      PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.CRAFTING, packedXP)) +
      PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.COOKING, packedXP)) +
      PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.FIREMAKING, packedXP)) +
      PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.ALCHEMY, packedXP)) +
      PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.FLETCHING, packedXP)) +
      PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.FARMING, packedXP)) +
      PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.FORGING, packedXP));

    string memory attributes = string(
      abi.encodePacked(
        _getTraitStringJSON("Avatar", avatarName),
        ",",
        _getTraitStringJSON("Clan", _clans.getClanNameOfPlayer(playerId)),
        ",",
        _getTraitStringJSON("Full version", _isEvolved(playerId) ? "true" : "false"),
        ",",
        _getTraitNumberJSON("Melee level", PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.MELEE, packedXP))),
        ",",
        _getTraitNumberJSON("Ranged level", PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.RANGED, packedXP))),
        ",",
        _getTraitNumberJSON("Magic level", PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.MAGIC, packedXP))),
        ",",
        _getTraitNumberJSON("Defence level", PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.DEFENCE, packedXP))),
        ",",
        _getTraitNumberJSON("Health level", PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.HEALTH, packedXP))),
        ",",
        _getTraitNumberJSON("Mining level", PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.MINING, packedXP))),
        ",",
        _getTraitNumberJSON(
          "Woodcutting level",
          PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.WOODCUTTING, packedXP))
        ),
        ",",
        _getTraitNumberJSON("Fishing level", PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.FISHING, packedXP))),
        ",",
        _getTraitNumberJSON(
          "Smithing level",
          PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.SMITHING, packedXP))
        ),
        ",",
        _getTraitNumberJSON(
          "Thieving level",
          PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.THIEVING, packedXP))
        ),
        ",",
        _getTraitNumberJSON(
          "Crafting level",
          PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.CRAFTING, packedXP))
        ),
        ",",
        _getTraitNumberJSON("Cooking level", PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.COOKING, packedXP))),
        ",",
        _getTraitNumberJSON(
          "Firemaking level",
          PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.FIREMAKING, packedXP))
        ),
        ",",
        _getTraitNumberJSON("Alchemy level", PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.ALCHEMY, packedXP))),
        ",",
        _getTraitNumberJSON(
          "Fletching level",
          PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.FLETCHING, packedXP))
        ),
        ",",
        _getTraitNumberJSON("Forging level", PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.FORGING, packedXP))),
        ",",
        _getTraitNumberJSON("Farming level", PlayersLibrary._getLevel(PlayersLibrary._readXP(Skill.FARMING, packedXP))),
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
      // Action has not finished yet
      for (uint256 i; i < ids.length; ++i) {
        uint256 itemTokenId = ids[i];
        uint256 amount = amounts[i];
        if (itemTokenId == 0) {
          continue;
        }
        for (uint256 j; j < _checkpointEquipments[playerId][queuedIndex].itemTokenIds.length; ++j) {
          if (_checkpointEquipments[playerId][queuedIndex].itemTokenIds[j] == itemTokenId) {
            // An item being transferred is currently in use.
            uint256 originalBalance = _checkpointEquipments[playerId][queuedIndex].balances[j];
            uint256 checkpointBalance = originalBalance;
            if (checkpointBalance == type(uint16).max) {
              // special sentinel case of owning more than 65k
              // They own a lot so need to check balance
              checkpointBalance = _itemNFT.balanceOf(from, itemTokenId) - amount;
              if (checkpointBalance > type(uint16).max) {
                // They will still own a lot after the transfer
                checkpointBalance = type(uint16).max; // Reset back to this sentinel value
              }
            } else {
              if (checkpointBalance > amount) {
                checkpointBalance -= amount;
              } else {
                // Before setting to 0, check if current amount being sent is more than the balance
                uint256 balance = _itemNFT.balanceOf(from, itemId);
                if (balance <= amount) {
                  checkpointBalance = 0;
                } else {
                  checkpointBalance = uint16(balance - amount);
                }
              }
            }
            if (originalBalance != checkpointBalance) {
              _checkpointEquipments[playerId][queuedIndex].balances[j] = uint16(checkpointBalance);
            }
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

  // Only used in tests
  function getPackedXP(uint256 playerId) external view returns (PackedXP memory) {
    return _playerXP[playerId];
  }

  function getPlayer(uint256 playerId) external view returns (Player memory) {
    return _players[playerId];
  }

  function getClanBoost(uint256 clanId) external view returns (StandardBoostInfo memory) {
    return _clanBoosts[clanId];
  }

  function getGlobalBoost() external view returns (StandardBoostInfo memory) {
    return _globalBoost;
  }

  function getCheckpointEquipments(
    uint256 playerId
  ) external view returns (CheckpointEquipments[3] memory checkpointEquipments) {
    return _checkpointEquipments[playerId];
  }
}
