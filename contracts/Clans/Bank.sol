// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";

import {IClans} from "../interfaces/IClans.sol";
import {IBank} from "../interfaces/IBank.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {BankRegistry} from "./BankRegistry.sol";
import {BulkTransferInfo} from "../globals/items.sol";

contract Bank is ERC1155Holder, IBank, ContextUpgradeable {
  using UnsafeMath for U256;
  using UnsafeMath for uint16;
  using UnsafeMath for uint256;

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

  modifier isOwnerOfPlayer(uint256 playerId) {
    require(_bankRegistry.getPlayerNFT().balanceOf(_msgSender(), playerId) == 1, NotOwnerOfPlayer());
    _;
  }

  modifier canWithdraw(uint256 playerId) {
    require(_bankRegistry.getClans().canWithdraw(_clanId, playerId), NotClanAdmin());
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
    _clanId = uint32(clanId);
    _bankRegistry = BankRegistry(bankRegistry);
    _reentrantStatus = NOT_ENTERED;
  }

  function depositItems(
    uint256 playerId,
    uint256[] calldata ids,
    uint256[] calldata values
  ) external isOwnerOfPlayer(playerId) {
    uint256 maxCapacity = _bankRegistry.getClans().maxBankCapacity(_clanId);
    U256 bounds = ids.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      _receivedItemUpdateUniqueItems(ids[iter.asUint256()], maxCapacity);
    }
    _bankRegistry.getItemNFT().safeBatchTransferFrom(_msgSender(), address(this), ids, values, "");
    emit DepositItems(_msgSender(), playerId, ids, values);
  }

  function getUniqueItemCount() external view returns (uint16) {
    return _uniqueItemCount;
  }

  function withdrawItems(
    address to,
    uint256 playerId,
    uint256[] calldata ids,
    uint256[] calldata amounts
  ) external isOwnerOfPlayer(playerId) canWithdraw(playerId) nonReentrant {
    ItemNFT itemNFT = _bankRegistry.getItemNFT();
    itemNFT.safeBatchTransferFrom(address(this), to, ids, amounts, "");

    // Update uniqueItemCount after withdrawing items
    U256 bounds = ids.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint256 id = ids[iter.asUint256()];
      if (_uniqueItems[id] && itemNFT.balanceOf(address(this), id) == 0) {
        _uniqueItemCount = uint16(_uniqueItemCount.dec());
        _uniqueItems[id] = false;
      }
    }
    emit WithdrawItems(_msgSender(), to, playerId, ids, amounts);
  }

  function withdrawItemsBulk(
    BulkTransferInfo[] calldata nftsInfo,
    uint256 playerId
  ) external isOwnerOfPlayer(playerId) canWithdraw(playerId) nonReentrant {
    ItemNFT itemNFT = _bankRegistry.getItemNFT();
    itemNFT.safeBulkTransfer(nftsInfo);

    // Update uniqueItemCount after withdrawing items
    for (uint256 i; i < nftsInfo.length; ++i) {
      U256 bounds = nftsInfo.length.asU256();
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        uint256[] calldata ids = nftsInfo[iter.asUint256()].tokenIds;
        for (uint256 j; j < ids.length; ++j) {
          uint256 id = ids[j];
          if (_uniqueItems[id] && itemNFT.balanceOf(address(this), id) == 0) {
            _uniqueItemCount = uint16(_uniqueItemCount.dec());
            _uniqueItems[id] = false;
          }
        }
      }
    }

    emit WithdrawItemsBulk(_msgSender(), nftsInfo, playerId);
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
      U256 bounds = ids.length.asU256();
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        _receivedItemUpdateUniqueItems(ids[iter.asUint256()], maxCapacity);
      }
      uint256 activePlayerId = _bankRegistry.getPlayers().getActivePlayer(from);
      emit DepositItems(from, activePlayerId, ids, values);
    }
    return super.onERC1155BatchReceived(operator, from, ids, values, data);
  }

  function depositFTM(uint256 playerId) external payable isOwnerOfPlayer(playerId) {
    if (msg.value != 0) {
      emit DepositFTM(_msgSender(), playerId, msg.value);
    }
  }

  // Untested
  function withdrawFTM(
    address to,
    uint256 playerId,
    uint256 amount
  ) external isOwnerOfPlayer(playerId) canWithdraw(playerId) {
    (bool success, ) = _msgSender().call{value: amount}("");
    require(success, WithdrawFailed());
    emit WithdrawFTM(_msgSender(), to, playerId, amount);
  }

  function depositToken(address from, uint256 playerId, address token, uint256 amount) external {
    require(from == _msgSender() || _msgSender() == address(_bankRegistry.getLockedBankVaults()), NotOwnerOfPlayer());
    require(_bankRegistry.getPlayerNFT().balanceOf(from, playerId) == 1, NotOwnerOfPlayer());

    bool success = IERC20(token).transferFrom(_msgSender(), address(this), amount);
    require(success, DepositFailed());

    emit DepositToken(from, playerId, token, amount);
  }

  function withdrawToken(
    uint256 playerId,
    address to,
    uint256 toPlayerId,
    address token,
    uint256 amount
  ) external isOwnerOfPlayer(playerId) canWithdraw(playerId) {
    require(_bankRegistry.getPlayerNFT().balanceOf(to, toPlayerId) == 1, ToIsNotOwnerOfPlayer());
    bool success = IERC20(token).transfer(to, amount);
    require(success, WithdrawFailed());
    emit WithdrawToken(_msgSender(), playerId, to, toPlayerId, token, amount);
  }

  function withdrawTokenToMany(
    uint256 playerId,
    address[] calldata tos,
    uint256[] calldata toPlayerIds,
    address token,
    uint256[] calldata _amounts
  ) external isOwnerOfPlayer(playerId) canWithdraw(playerId) {
    require(toPlayerIds.length == _amounts.length, LengthMismatch());
    require(toPlayerIds.length == tos.length, LengthMismatch());

    for (uint256 i = 0; i < toPlayerIds.length; ++i) {
      require(_bankRegistry.getPlayerNFT().balanceOf(tos[i], toPlayerIds[i]) == 1, ToIsNotOwnerOfPlayer());
      bool success = IERC20(token).transfer(tos[i], _amounts[i]);
      require(success, WithdrawFailed());
    }

    emit WithdrawTokens(_msgSender(), playerId, tos, toPlayerIds, token, _amounts);
  }

  function withdrawNFT(
    uint256 playerId,
    address to,
    uint256 toPlayerId,
    address nft,
    uint256 tokenId,
    uint256 amount
  ) external isOwnerOfPlayer(playerId) canWithdraw(playerId) {
    require(nft != address(_bankRegistry.getItemNFT()), UseWithdrawItemsForNFT());
    require(_bankRegistry.getPlayerNFT().balanceOf(to, toPlayerId) == 1, ToIsNotOwnerOfPlayer());
    require(IERC165(nft).supportsInterface(type(IERC1155).interfaceId), NFTTypeNotSupported());

    IERC1155(nft).safeTransferFrom(address(this), to, tokenId, amount, "");
    emit WithdrawNFT(_msgSender(), playerId, to, toPlayerId, nft, tokenId, amount);
  }

  function _receivedItemUpdateUniqueItems(uint256 id, uint256 maxCapacity) private {
    if (!_uniqueItems[id]) {
      require(_uniqueItemCount < maxCapacity, MaxBankCapacityReached());
      _uniqueItemCount = uint16(_uniqueItemCount.inc());
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
