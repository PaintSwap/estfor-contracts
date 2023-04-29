// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";

import {IClans} from "../interfaces/IClans.sol";
import {IBank} from "../interfaces/IBank.sol";
import {BankRegistry} from "./BankRegistry.sol";

contract Bank is ERC1155Holder, IBank, Initializable {
  using UnsafeMath for U256;
  using UnsafeMath for uint16;
  using UnsafeMath for uint256;

  event DepositItems(address from, uint playerId, uint[] id, uint[] value);
  event DepositItem(address from, uint playerId, uint id, uint value);
  event WithdrawItems(address to, uint playerId, uint[] id, uint[] value);
  event DepositFTM(address from, uint playerId, uint amount);
  event WithdrawFTM(address to, uint playerId, uint amount);
  event DepositToken(address from, uint playerId, address token, uint amount);
  event WithdrawToken(address to, uint playerId, address token, uint amount);

  error MaxBankCapacityReached();
  error NotClanAdmin();
  error NotOwnerOfPlayer();
  error DepositFailed();
  error WithdrawFailed();

  uint32 public clanId;
  BankRegistry public bankRegistry;
  uint16 public uniqueItemCount;
  mapping(uint itemTokenId => bool hasAny) public uniqueItems;

  modifier isOwnerOfPlayer(uint _playerId) {
    if (bankRegistry.playerNFT().balanceOf(msg.sender, _playerId) != 1) {
      revert NotOwnerOfPlayer();
    }
    _;
  }

  modifier canWithdraw(uint _playerId) {
    if (!bankRegistry.clans().canWithdraw(clanId, _playerId)) {
      revert NotClanAdmin();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(uint _clanId, address _bankRegistry) external override initializer {
    clanId = uint32(_clanId);
    bankRegistry = BankRegistry(_bankRegistry);
  }

  function depositItems(
    uint _playerId,
    uint[] calldata ids,
    uint[] calldata values
  ) external isOwnerOfPlayer(_playerId) {
    uint maxCapacity = bankRegistry.clans().maxBankCapacity(clanId);
    U256 bounds = ids.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      _receivedItemUpdateUniqueItems(ids[iter.asUint256()], maxCapacity);
    }
    bankRegistry.itemNFT().safeBatchTransferFrom(msg.sender, address(this), ids, values, "");
    emit DepositItems(msg.sender, _playerId, ids, values);
  }

  function withdrawItems(
    address _to,
    uint _playerId,
    uint[] calldata ids,
    uint[] calldata amounts
  ) external isOwnerOfPlayer(_playerId) canWithdraw(_playerId) {
    bankRegistry.itemNFT().safeBatchTransferFrom(address(this), _to, ids, amounts, "");

    // Update uniqueItemCount after withdrawing items
    U256 bounds = ids.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint id = ids[iter.asUint256()];
      if (uniqueItems[id] && bankRegistry.itemNFT().balanceOf(address(this), id) == 0) {
        uniqueItemCount = uint16(uniqueItemCount.dec());
        uniqueItems[id] = false;
      }
    }
    emit WithdrawItems(_to, _playerId, ids, amounts);
  }

  function _receivedItemUpdateUniqueItems(uint id, uint maxCapacity) private {
    if (!uniqueItems[id]) {
      if (uniqueItemCount >= maxCapacity) {
        revert MaxBankCapacityReached();
      }
      uniqueItemCount = uint16(uniqueItemCount.inc());
      uniqueItems[id] = true;
    }
  }

  function onERC1155Received(
    address operator,
    address from,
    uint id,
    uint value,
    bytes memory data
  ) public override returns (bytes4) {
    // Only care about itemNFTs sent from outside the bank here
    if (msg.sender == address(bankRegistry.itemNFT()) && operator != address(this)) {
      uint maxCapacity = bankRegistry.clans().maxBankCapacity(clanId);
      _receivedItemUpdateUniqueItems(id, maxCapacity);
      uint activePlayerId = bankRegistry.players().activePlayer(from);
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
    if (msg.sender == address(bankRegistry.itemNFT()) && operator != address(this)) {
      uint maxCapacity = bankRegistry.clans().maxBankCapacity(clanId);
      U256 bounds = ids.length.asU256();
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        _receivedItemUpdateUniqueItems(ids[iter.asUint256()], maxCapacity);
      }
      uint activePlayerId = bankRegistry.players().activePlayer(from);
      emit DepositItems(from, activePlayerId, ids, values);
    }
    return super.onERC1155BatchReceived(operator, from, ids, values, data);
  }

  function depositFTM(uint _playerId) external payable isOwnerOfPlayer(_playerId) {
    if (msg.value != 0) {
      emit DepositFTM(msg.sender, _playerId, msg.value);
    }
  }

  function withdrawFTM(uint _playerId, uint amount) external isOwnerOfPlayer(_playerId) canWithdraw(_playerId) {
    (bool success, ) = msg.sender.call{value: amount}("");
    if (!success) {
      revert WithdrawFailed();
    }
    emit WithdrawFTM(msg.sender, _playerId, amount);
  }

  function depositToken(uint _playerId, address token, uint amount) external isOwnerOfPlayer(_playerId) {
    bool success = IERC20(token).transferFrom(msg.sender, address(this), amount);
    if (!success) {
      revert DepositFailed();
    }

    emit DepositToken(msg.sender, _playerId, token, amount);
  }

  function withdrawToken(
    uint _playerId,
    address token,
    uint amount
  ) external isOwnerOfPlayer(_playerId) canWithdraw(_playerId) {
    bool success = IERC20(token).transfer(msg.sender, amount);
    if (!success) {
      revert WithdrawFailed();
    }
    emit WithdrawToken(msg.sender, _playerId, token, amount);
  }

  receive() external payable {
    // Accept FTM
    uint activePlayerId = bankRegistry.players().activePlayer(msg.sender);
    emit DepositFTM(msg.sender, activePlayerId, msg.value);
  }
}
