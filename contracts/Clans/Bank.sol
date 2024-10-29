// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

import {IClans} from "../interfaces/IClans.sol";
import {IBank} from "../interfaces/IBank.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {BankRegistry} from "./BankRegistry.sol";
import {BulkTransferInfo} from "../globals/items.sol";

contract Bank is ERC1155Holder, IBank, ContextUpgradeable {
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
  error ReentrancyGuardReentrantCall();
  error UseWithdrawItemsForNFT();
  error NFTTypeNotSupported();

  uint8 private constant NOT_ENTERED = 1;
  uint8 private constant ENTERED = 2;

  uint32 private _clanId;
  BankRegistry private _bankRegistry;
  uint16 private _uniqueItemCount;
  uint8 private _reentrantStatus;
  mapping(uint256 itemTokenId => bool hasAny) private _uniqueItems;

  modifier onlyBankRelay() {
    require(_msgSender() == _bankRegistry.getBankRelay(), OnlyBankRelay());
    _;
  }

  modifier isOwnerOfPlayer(address sender, uint256 playerId) {
    require(_bankRegistry.getPlayerNFT().balanceOf(sender, playerId) == 1, NotOwnerOfPlayer());
    _;
  }

  /**
   * @dev Prevents a contract from calling itself, directly or indirectly.
   * Calling a `nonReentrant` function from another `nonReentrant`
   * function is not supported. It is possible to prevent this from happening
   * by making the `nonReentrant` function external, and making it call a
   * `private` function that does the actual work.
   */
  modifier nonReentrant() {
    // On the first call to nonReentrant, _status will be NOT_ENTERED
    require(_reentrantStatus != ENTERED, ReentrancyGuardReentrantCall());
    _reentrantStatus = ENTERED;
    _;
    // By storing the original value once again, a refund is triggered (see
    // https://eips.ethereum.org/EIPS/eip-2200)
    _reentrantStatus = NOT_ENTERED;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(uint256 clanId, address bankRegistry) external override initializer {
    __ReentrancyGuard_init();
    _clanId = uint32(clanId);
    _bankRegistry = BankRegistry(bankRegistry);
  }

  function depositItems(
    address sender,
    uint256 playerId,
    uint256[] calldata ids,
    uint256[] calldata values
  ) external onlyBankRelay isOwnerOfPlayer(sender, playerId) {
    uint256 maxCapacity = _bankRegistry.getClans().maxBankCapacity(_clanId);
    uint256 bounds = ids.length;
    for (uint256 iter; iter < bounds; iter++) {
      _receivedItemUpdateUniqueItems(ids[iter], maxCapacity);
    }
    _bankRegistry.getItemNFT().safeBatchTransferFrom(sender, address(this), ids, values, "");
    emit DepositItems(sender, playerId, ids, values);
  }

  function getUniqueItemCount() external view returns (uint16) {
    return _uniqueItemCount;
  }

  function withdrawItems(
    address sender,
    address to,
    uint256 playerId,
    uint256[] calldata ids,
    uint256[] calldata amounts
  ) external onlyBankRelay isOwnerOfPlayer(sender, playerId) canWithdraw(playerId) nonReentrant {
    ItemNFT itemNFT = _bankRegistry.getItemNFT();
    itemNFT.safeBatchTransferFrom(address(this), to, ids, amounts, "");

    // Update uniqueItemCount after withdrawing items
    uint256 bounds = ids.length;
    for (uint256 iter; iter < bounds; iter++) {
      uint256 id = ids[iter];
      if (_uniqueItems[id] && itemNFT.balanceOf(address(this), id) == 0) {
        _uniqueItemCount--;
        _uniqueItems[id] = false;
      }
    }
    emit WithdrawItems(sender, to, playerId, ids, amounts);
  }

  function withdrawItemsBulk(
    address sender,
    BulkTransferInfo[] calldata nftsInfo,
    uint256 playerId
  ) external onlyBankRelay isOwnerOfPlayer(sender, playerId) canWithdraw(playerId) nonReentrant {
    ItemNFT itemNFT = _bankRegistry.getItemNFT();
    itemNFT.safeBulkTransfer(nftsInfo);

    // Update uniqueItemCount after withdrawing items
    for (uint256 i; i < nftsInfo.length; ++i) {
      uint256 bounds = nftsInfo.length;
      for (uint256 iter; iter < bounds; iter++) {
        uint256[] calldata ids = nftsInfo[iter].tokenIds;
        for (uint256 j; j < ids.length; ++j) {
          uint256 id = ids[j];
          if (_uniqueItems[id] && itemNFT.balanceOf(address(this), id) == 0) {
            _uniqueItemCount--;
            _uniqueItems[id] = false;
          }
        }
      }
    }

    emit WithdrawItemsBulk(sender, nftsInfo, playerId);
  }

  function onERC1155Received(
    address operator,
    address from,
    uint256 id,
    uint256 value,
    bytes memory data
  ) public override returns (bytes4) {
    // Only care about itemNFTs sent from outside the bank here
    if (_msgSender() == address(_bankRegistry.getItemNFT()) && operator != address(this)) {
      uint256 maxCapacity = _bankRegistry.getClans().maxBankCapacity(_clanId);
      _receivedItemUpdateUniqueItems(id, maxCapacity);
      uint256 activePlayerId = _bankRegistry.getPlayers().getActivePlayer(from);
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
    if (_msgSender() == address(_bankRegistry.getItemNFT()) && operator != address(this)) {
      uint256 maxCapacity = _bankRegistry.getClans().maxBankCapacity(_clanId);
      uint256 bounds = ids.length;
      for (uint256 iter; iter < bounds; iter++) {
        _receivedItemUpdateUniqueItems(ids[iter], maxCapacity);
      }
      uint256 activePlayerId = _bankRegistry.getPlayers().getActivePlayer(from);
      emit DepositItems(from, activePlayerId, ids, values);
    }
    return super.onERC1155BatchReceived(operator, from, ids, values, data);
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
  ) external onlyBankRelay {
    require(playerOwner == sender || sender == address(_bankRegistry.getLockedBankVaults()), NotOwnerOfPlayer());
    require(_bankRegistry.getPlayerNFT().balanceOf(playerOwner, playerId) == 1, NotOwnerOfPlayer());
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
    require(_bankRegistry.getPlayerNFT().balanceOf(to, toPlayerId) == 1, ToIsNotOwnerOfPlayer());
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
    require(toPlayerIds.length == _amounts.length, LengthMismatch());
    require(toPlayerIds.length == tos.length, LengthMismatch());

    for (uint256 i = 0; i < toPlayerIds.length; ++i) {
      require(_bankRegistry.getPlayerNFT().balanceOf(tos[i], toPlayerIds[i]) == 1, ToIsNotOwnerOfPlayer());
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
    require(nft != address(_bankRegistry.getItemNFT()), UseWithdrawItemsForNFT());
    require(_bankRegistry.getPlayerNFT().balanceOf(to, toPlayerId) == 1, ToIsNotOwnerOfPlayer());
    require(IERC165(nft).supportsInterface(type(IERC1155).interfaceId), NFTTypeNotSupported());

    IERC1155(nft).safeTransferFrom(address(this), to, tokenId, amount, "");
    emit WithdrawNFT(sender, playerId, to, toPlayerId, nft, tokenId, amount);
  }

  function _receivedItemUpdateUniqueItems(uint256 id, uint256 maxCapacity) private {
    if (!_uniqueItems[id]) {
      require(_uniqueItemCount < maxCapacity, MaxBankCapacityReached());
      _uniqueItemCount++;
      _uniqueItems[id] = true;
    }
  }

  // Untested
  receive() external payable {
    // Accept FTM
    uint256 activePlayerId = _bankRegistry.getPlayers().getActivePlayer(_msgSender());
    emit DepositFTM(_msgSender(), activePlayerId, msg.value);
  }
}
