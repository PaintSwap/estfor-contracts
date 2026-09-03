// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {IItemNFT} from "./interfaces/IItemNFT.sol";
import {IPlayerNFT} from "./interfaces/IPlayerNFT.sol";

import {CosmeticInfo, EquipPosition} from "./globals/players.sol";

/// @custom:oz-upgrades-from CosmeticsV1
contract Cosmetics is UUPSUpgradeable, OwnableUpgradeable {
  uint256 public constant MAX_STATE_READ_LENGTH = 1024;

  error LengthMismatch();
  error NotEquippableCosmetic();
  error NoCosmeticEquipped();
  error CosmeticSlotOccupied();
  error NotOwnerOfPlayer();
  error InvalidStateReadRange();

  event SetCosmetics(uint16[] itemTokenIds, CosmeticInfo[] cosmeticInfos);
  event CosmeticApplied(uint256 indexed playerId, uint16 indexed itemTokenId, EquipPosition slot);
  event CosmeticRemoved(uint256 indexed playerId, EquipPosition slot);
  event RemoveCosmetics(uint16[] itemTokenIds);

  IItemNFT private _itemNFT;
  IPlayerNFT private _playerNFT;
  mapping(uint16 => CosmeticInfo) private _cosmetics;
  mapping(uint256 => mapping(EquipPosition => uint16)) private _equippedCosmetics;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address owner, IItemNFT itemNFT, IPlayerNFT playerNFT) public initializer {
    __Ownable_init(owner);
    _itemNFT = itemNFT;
    _playerNFT = playerNFT;
  }

  modifier isOwnerOfPlayer(uint256 playerId) {
    require(_playerNFT.balanceOf(_msgSender(), playerId) == 1, NotOwnerOfPlayer());
    _;
  }

  function applyCosmetic(uint256 playerId, uint16 itemTokenId) external isOwnerOfPlayer(playerId) {
    CosmeticInfo memory cosmeticInfo = _cosmetics[itemTokenId];
    require(cosmeticInfo.itemTokenId != 0, NotEquippableCosmetic());
    require(_equippedCosmetics[playerId][cosmeticInfo.cosmeticPosition] == 0, CosmeticSlotOccupied());

    // Special handling for avatar cosmetics as the skills need to be applied to the player
    _equippedCosmetics[playerId][cosmeticInfo.cosmeticPosition] = itemTokenId;
    if (cosmeticInfo.cosmeticPosition == EquipPosition.AVATAR) {
      _playerNFT.applyAvatarToPlayer(_msgSender(), playerId, cosmeticInfo.avatarId);
    }

    _itemNFT.burn(_msgSender(), itemTokenId, 1);

    emit CosmeticApplied(playerId, itemTokenId, cosmeticInfo.cosmeticPosition);
  }

  function removeCosmetic(uint256 playerId, EquipPosition slot) external isOwnerOfPlayer(playerId) {
    uint16 equippedCosmeticTokenId = _equippedCosmetics[playerId][slot];
    require(equippedCosmeticTokenId != 0, NoCosmeticEquipped());

    // Special handling for avatar cosmetics as the skills need to be applied to the player
    delete _equippedCosmetics[playerId][slot];
    if (slot == EquipPosition.AVATAR) {
      _playerNFT.unapplyAvatarFromPlayer(_msgSender(), playerId);
    }

    _itemNFT.mint(_msgSender(), equippedCosmeticTokenId, 1);

    emit CosmeticRemoved(playerId, slot);
  }

  function getCosmetic(uint16 itemTokenId) external view returns (CosmeticInfo memory) {
    return _cosmetics[itemTokenId];
  }

  function getCosmeticItemTokenIds(
    uint256 startItemTokenId,
    uint256 endItemTokenId
  ) external view returns (uint16[] memory itemTokenIds) {
    if (
      startItemTokenId >= endItemTokenId ||
      endItemTokenId > uint256(type(uint16).max) + 1 ||
      endItemTokenId - startItemTokenId > MAX_STATE_READ_LENGTH
    ) revert InvalidStateReadRange();

    uint256 count;
    for (uint256 itemTokenId = startItemTokenId; itemTokenId < endItemTokenId; ++itemTokenId) {
      if (_cosmetics[uint16(itemTokenId)].itemTokenId != 0) ++count;
    }

    itemTokenIds = new uint16[](count);
    uint256 index;
    for (uint256 itemTokenId = startItemTokenId; itemTokenId < endItemTokenId; ++itemTokenId) {
      if (_cosmetics[uint16(itemTokenId)].itemTokenId != 0) itemTokenIds[index++] = uint16(itemTokenId);
    }
  }

  function setCosmetics(uint16[] calldata itemTokenIds, CosmeticInfo[] calldata cosmeticInfos) external onlyOwner {
    require(itemTokenIds.length == cosmeticInfos.length, LengthMismatch());
    for (uint16 i; i < itemTokenIds.length; ++i) {
      _cosmetics[itemTokenIds[i]] = cosmeticInfos[i];
    }
    emit SetCosmetics(itemTokenIds, cosmeticInfos);
  }

  function removeCosmeticItems(uint16[] calldata itemTokenIds) external onlyOwner {
    for (uint16 i; i < itemTokenIds.length; ++i) {
      delete _cosmetics[itemTokenIds[i]];
    }
    emit RemoveCosmetics(itemTokenIds);
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
