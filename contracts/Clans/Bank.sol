// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {BitMaps} from "@openzeppelin/contracts/utils/structs/BitMaps.sol";

import {IPlayers} from "../interfaces/IPlayers.sol";
import {IClans} from "../interfaces/IClans.sol";
import {IBank} from "../interfaces/IBank.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {BankRegistry} from "./BankRegistry.sol";
import {BulkTransferInfo} from "../globals/items.sol";

contract Bank is ERC1155Holder, ReentrancyGuardUpgradeable, ContextUpgradeable, IBank {
  using SafeCast for uint256;
  using BitMaps for BitMaps.BitMap;

  event DepositItems(address from, uint256 playerId, uint256[] ids, uint256[] values);
  event DepositItem(address from, uint256 playerId, uint256 id, uint256 value);
  event WithdrawItems(address from, address to, uint256 playerId, uint256[] ids, uint256[] values);
  event WithdrawItemsBulk(address from, BulkTransferInfo[] nftTransferInfos, uint256 playerId);
  event DepositFTM(address from, uint256 playerId, uint256 amount);
  event WithdrawFTM(address from, address to, uint256 playerId, uint256 amount);
  event DepositToken(address from, uint256 playerId, address token, uint256 amount);
  event WithdrawToken(address from, uint256 playerId, address to, uint256 toPlayerId, address token, uint256 amount);
  event WithdrawTokens(
    address from,
    uint256 playerId,
    address[] tos,
    uint256[] toPlayerIds,
    address token,
    uint256[] amounts
  );
  event WithdrawNFT(
    address from,
    uint256 playerId,
    address to,
    uint256 toPlayerId,
    address nft,
    uint256 tokenId,
    uint256 amount
  );

  error OnlyBankRelay();
  error MaxBankCapacityReached();
  error NotClanAdmin();
  error NotOwnerOfPlayer();
  error DepositFailed();
  error WithdrawFailed();
  error LengthMismatch();
  error ToIsNotOwnerOfPlayer();
  error UseWithdrawItemsForNFT();
  error NFTTypeNotSupported();
  error NotForceItemDepositor();

  uint40 private _clanId;
  BankRegistry private _bankRegistry;
  address private _bankRelay;
  IERC1155 private _playerNFT;
  ItemNFT private _itemNFT;
  uint16 private _uniqueItemCount;
  IClans private _clans;
  IPlayers private _players;
  address private _lockedBankVaults;
  address private _raids;
  bool private _allowBreachedCapacity; // Be nice if this is transient storage

  BitMaps.BitMap private _uniqueItems; // itemTokenId => bool hasAny

  modifier onlyBankRelay() {
    require(_msgSender() == _bankRelay, OnlyBankRelay());
    _;
  }

  modifier isOwnerOfPlayer(address sender, uint256 playerId) {
    require(_playerNFT.balanceOf(sender, playerId) == 1, NotOwnerOfPlayer());
    _;
  }

  modifier canWithdraw(uint256 playerId) {
    require(_clans.canWithdraw(_clanId, playerId), NotClanAdmin());
    _;
  }

  modifier onlyForceItemDepositor() {
    require(_isForceItemDepositor(_msgSender()), NotForceItemDepositor());
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    uint256 clanId,
    address bankRegistry,
    address bankRelay,
    address playerNFT,
    address itemNFT,
    address clans,
    address players,
    address lockedBankVaults,
    address raids
  ) external override initializer {
    __ReentrancyGuard_init();
    _clanId = clanId.toUint40();
    _bankRegistry = BankRegistry(bankRegistry);
    _bankRelay = bankRelay;
    _playerNFT = IERC1155(playerNFT);
    _itemNFT = ItemNFT(itemNFT);
    _clans = IClans(clans);
    _players = IPlayers(players);
    _lockedBankVaults = lockedBankVaults;
    _raids = raids;
  }

  function depositItems(
    address sender,
    uint256 playerId,
    uint256[] calldata ids,
    uint256[] calldata values
  ) external onlyBankRelay isOwnerOfPlayer(sender, playerId) {
    uint256 maxCapacity = _clans.maxBankCapacity(_clanId);
    uint256 bounds = ids.length;
    uint16 newUniqueItemCount = _uniqueItemCount;
    bool isForceItemDepositor = false;
    for (uint256 i; i < bounds; ++i) {
      (newUniqueItemCount, isForceItemDepositor) = _receivedItemUpdateUniqueItems(
        ids[i],
        maxCapacity,
        newUniqueItemCount,
        isForceItemDepositor
      );
    }
    _uniqueItemCount = newUniqueItemCount;
    _itemNFT.safeBatchTransferFrom(sender, address(this), ids, values, "");
    emit DepositItems(sender, playerId, ids, values);
  }

  function getUniqueItemCount() external view returns (uint16) {
    return _uniqueItemCount;
  }

  function _withdraw(uint256[] calldata ids) private returns (uint256 uniqueItemsToRemove) {
    for (uint256 i; i < ids.length; ++i) {
      uint256 id = ids[i];
      if (_uniqueItems.get(id) && _itemNFT.balanceOf(address(this), id) == 0) {
        ++uniqueItemsToRemove;
        _uniqueItems.unset(id);
      }
    }
  }

  function withdrawItems(
    address sender,
    address to,
    uint256 playerId,
    uint256[] calldata ids,
    uint256[] calldata amounts
  ) external onlyBankRelay isOwnerOfPlayer(sender, playerId) canWithdraw(playerId) nonReentrant {
    _itemNFT.safeBatchTransferFrom(address(this), to, ids, amounts, "");

    // Update uniqueItemCount after trasnferring the items
    _withdraw(ids);
    emit WithdrawItems(sender, to, playerId, ids, amounts);
  }

  function withdrawItemsBulk(
    address sender,
    BulkTransferInfo[] calldata nftsInfo,
    uint256 playerId
  ) external onlyBankRelay isOwnerOfPlayer(sender, playerId) canWithdraw(playerId) nonReentrant {
    _itemNFT.safeBulkTransfer(nftsInfo);

    // Update uniqueItemCount after trasnferring the items
    uint256 uniqueItemsToRemove;
    for (uint256 i; i < nftsInfo.length; ++i) {
      uniqueItemsToRemove += _withdraw(nftsInfo[i].tokenIds);
    }
    _uniqueItemCount -= uint16(uniqueItemsToRemove);
    emit WithdrawItemsBulk(sender, nftsInfo, playerId);
  }

  function depositFTM(
    address sender,
    uint256 playerId
  ) external payable onlyBankRelay isOwnerOfPlayer(sender, playerId) {
    if (msg.value != 0) {
      emit DepositFTM(sender, playerId, msg.value);
    }
  }

  // Untested
  function withdrawFTM(
    address sender,
    address to,
    uint256 playerId,
    uint256 amount
  ) external onlyBankRelay isOwnerOfPlayer(sender, playerId) canWithdraw(playerId) {
    (bool success, ) = sender.call{value: amount}("");
    require(success, WithdrawFailed());
    emit WithdrawFTM(sender, to, playerId, amount);
  }

  function depositToken(
    address sender, // either Player owner or LockedBankVaults
    address playerOwner,
    uint256 playerId,
    address token,
    uint256 amount
  ) external onlyBankRelay isOwnerOfPlayer(playerOwner, playerId) {
    require(playerOwner == sender || sender == _lockedBankVaults, NotOwnerOfPlayer());
    bool success = IERC20(token).transferFrom(sender, address(this), amount);
    require(success, DepositFailed());
    emit DepositToken(playerOwner, playerId, token, amount);
  }

  function withdrawToken(
    address sender,
    uint256 playerId,
    address to,
    uint256 toPlayerId,
    address token,
    uint256 amount
  ) external onlyBankRelay isOwnerOfPlayer(sender, playerId) canWithdraw(playerId) {
    require(_playerNFT.balanceOf(to, toPlayerId) == 1, ToIsNotOwnerOfPlayer());
    bool success = IERC20(token).transfer(to, amount);
    require(success, WithdrawFailed());
    emit WithdrawToken(sender, playerId, to, toPlayerId, token, amount);
  }

  function withdrawTokenToMany(
    address sender,
    uint256 playerId,
    address[] calldata tos,
    uint256[] calldata toPlayerIds,
    address token,
    uint256[] calldata _amounts
  ) external onlyBankRelay isOwnerOfPlayer(sender, playerId) canWithdraw(playerId) {
    require(toPlayerIds.length == _amounts.length && toPlayerIds.length == tos.length, LengthMismatch());

    IERC1155 playerNFT = _playerNFT;
    for (uint256 i = 0; i < toPlayerIds.length; ++i) {
      require(playerNFT.balanceOf(tos[i], toPlayerIds[i]) == 1, ToIsNotOwnerOfPlayer());
      bool success = IERC20(token).transfer(tos[i], _amounts[i]);
      require(success, WithdrawFailed());
    }

    emit WithdrawTokens(sender, playerId, tos, toPlayerIds, token, _amounts);
  }

  function withdrawNFT(
    address sender,
    uint256 playerId,
    address to,
    uint256 toPlayerId,
    address nft,
    uint256 tokenId,
    uint256 amount
  ) external onlyBankRelay isOwnerOfPlayer(sender, playerId) canWithdraw(playerId) {
    require(nft != address(_itemNFT), UseWithdrawItemsForNFT());
    require(_playerNFT.balanceOf(to, toPlayerId) == 1, ToIsNotOwnerOfPlayer());
    require(IERC165(nft).supportsInterface(type(IERC1155).interfaceId), NFTTypeNotSupported());

    IERC1155(nft).safeTransferFrom(address(this), to, tokenId, amount, "");
    emit WithdrawNFT(sender, playerId, to, toPlayerId, nft, tokenId, amount);
  }

  function onERC1155Received(
    address operator,
    address from,
    uint256 id,
    uint256 value,
    bytes memory data
  ) public override returns (bytes4) {
    // Only care about itemNFTs sent from outside the bank here
    if (_msgSender() == address(_itemNFT) && operator != address(this)) {
      uint256 maxCapacity = _clans.maxBankCapacity(_clanId);
      bool dummyIsForceItemDepositor = false;
      (uint16 newUniqueItemCount, ) = _receivedItemUpdateUniqueItems(
        id,
        maxCapacity,
        _uniqueItemCount,
        dummyIsForceItemDepositor
      );
      _uniqueItemCount = newUniqueItemCount;
      uint256 activePlayerId = _players.getActivePlayer(from);
      emit DepositItem(from, activePlayerId, id, value);
    }
    return super.onERC1155Received(operator, from, id, value, data);
  }

  function onERC1155BatchReceived(
    address operator,
    address from,
    uint256[] memory ids,
    uint256[] memory values,
    bytes memory data
  ) public override returns (bytes4) {
    // Only care about itemNFTs sent from outside the bank here
    if (_msgSender() == address(_itemNFT) && operator != address(this)) {
      uint256 maxCapacity = _clans.maxBankCapacity(_clanId);
      uint256 bounds = ids.length;
      uint16 newUniqueItemCount = _uniqueItemCount;
      bool isForceItemDepositor = false;
      for (uint256 i; i < bounds; ++i) {
        (newUniqueItemCount, isForceItemDepositor) = _receivedItemUpdateUniqueItems(
          ids[i],
          maxCapacity,
          newUniqueItemCount,
          isForceItemDepositor
        );
      }
      _uniqueItemCount = newUniqueItemCount;
      uint256 activePlayerId = _players.getActivePlayer(from);
      emit DepositItems(from, activePlayerId, ids, values);
    }
    return super.onERC1155BatchReceived(operator, from, ids, values, data);
  }

  function _receivedItemUpdateUniqueItems(
    uint256 id,
    uint256 maxCapacity,
    uint16 uniqueItemCount,
    bool isForceItemDepositor
  ) private returns (uint16 newUniqueItemCount, bool isForceItemDepositor_) {
    bool isNewItem = !_uniqueItems.get(id);
    isForceItemDepositor_ = isForceItemDepositor;
    if (isNewItem) {
      if (uniqueItemCount >= maxCapacity && !isForceItemDepositor) {
        // Only a force depositor is able to extend the bank capacity, stuff like raid loot
        require(_allowBreachedCapacity, MaxBankCapacityReached());
        isForceItemDepositor_ = true;
      }
      _uniqueItems.set(id);
      newUniqueItemCount = uniqueItemCount + 1;
    } else {
      newUniqueItemCount = uniqueItemCount;
    }
  }

  function _isForceItemDepositor(address account) private view returns (bool) {
    return account == _raids;
  }

  function setAllowBreachedCapacity(bool allow) external override onlyForceItemDepositor {
    _allowBreachedCapacity = allow;
  }

  // Untested
  receive() external payable {
    // Accept FTM
    uint256 activePlayerId = _players.getActivePlayer(_msgSender());
    emit DepositFTM(_msgSender(), activePlayerId, msg.value);
  }
}
