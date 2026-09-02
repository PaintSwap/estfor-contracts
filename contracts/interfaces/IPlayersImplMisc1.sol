// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "../globals/all.sol";
import {IPlayersBase} from "./IPlayersBase.sol";
interface IPlayersImplMisc1 is IPlayersBase {
  function addFullAttireBonuses(FullAttireBonusInput[] calldata fullAttireBonuses) external;
  function beforeItemNFTTransfer(address from, address to, uint256[] calldata ids, uint256[] calldata amounts) external;
  function getCheckpointEquipments(uint256 playerId) external view returns (CheckpointEquipments[3] memory);
  function getClanBoost(uint256 clanId) external view returns (StandardBoostInfo memory);
  function getGlobalBoost() external view returns (StandardBoostInfo memory);
  function getPackedXP(uint256 playerId) external view returns (PackedXP memory);
  function getPlayer(uint256 playerId) external view returns (Player memory);
  function uri(
    string calldata playerName,
    string calldata avatarName,
    string calldata avatarDescription,
    string calldata imageURI,
    uint256 playerId
  ) external view returns (string memory);
  error InvalidXPSkill();
}
