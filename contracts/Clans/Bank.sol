// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import {IClans} from "../interfaces/IClans.sol";
import {IBank} from "../interfaces/IBank.sol";
import {BankRegistry} from "./BankRegistry.sol";

contract Bank is ERC1155Holder, IBank, Initializable {
  event DepositItems(address from, uint playerId, uint[] id, uint[] value);
  event DepositItemNoPlayer(address from, uint id, uint value);
  event DepositItemsNoPlayer(address from, uint[] id, uint[] value);
  event WithdrawItems(address to, uint playerId, uint[] id, uint[] value);
  event DepositFTM(uint playerId, uint amount);
  event DepositFTMNoPlayer(address from, uint amount);
  event WithdrawFTM(address to, uint playerId, uint amount);
  event DepositToken(uint playerId, address token, uint amount);
  event DepositTokenNoPlayer(address from, address token, uint amount);
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

  modifier isClanAdmin(uint _playerId) {
    if (!bankRegistry.clans().isClanAdmin(clanId, _playerId)) {
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

  function depositItems(uint _playerId, uint[] memory ids, uint[] memory values) external isOwnerOfPlayer(_playerId) {
    uint maxCapacity = bankRegistry.clans().maxBankCapacity(clanId);
    for (uint i = 0; i < ids.length; ++i) {
      _receivedItemUpdateUniqueItems(ids[i], maxCapacity);
    }
    bankRegistry.itemNFT().safeBatchTransferFrom(msg.sender, address(this), ids, values, "");
    emit DepositItems(msg.sender, _playerId, ids, values);
  }

  function _receivedItemUpdateUniqueItems(uint id, uint maxCapacity) private {
    if (!uniqueItems[id]) {
      if (uniqueItemCount >= maxCapacity) {
        revert MaxBankCapacityReached();
      }
      ++uniqueItemCount;
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
      emit DepositItemNoPlayer(from, id, value);
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
      for (uint i = 0; i < ids.length; ++i) {
        _receivedItemUpdateUniqueItems(ids[i], maxCapacity);
      }
      emit DepositItemsNoPlayer(from, ids, values);
    }
    return super.onERC1155BatchReceived(operator, from, ids, values, data);
  }

  function depositFTM(uint _playerId) external payable isOwnerOfPlayer(_playerId) {
    if (msg.value > 0) {
      emit DepositFTM(_playerId, msg.value);
    }
  }

  function depositFTMNoPlayer() external payable {
    if (msg.value > 0) {
      emit DepositFTMNoPlayer(msg.sender, msg.value);
    }
  }

  function withdrawFTM(uint _playerId, uint amount) external isOwnerOfPlayer(_playerId) isClanAdmin(_playerId) {
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

    emit DepositToken(_playerId, token, amount);
  }

  function depositTokenNoPlayer(address token, uint amount) external {
    bool success = IERC20(token).transferFrom(msg.sender, address(this), amount);
    if (!success) {
      revert DepositFailed();
    }
    emit DepositTokenNoPlayer(msg.sender, token, amount);
  }

  function withdrawToken(
    uint _playerId,
    address token,
    uint amount
  ) external isOwnerOfPlayer(_playerId) isClanAdmin(_playerId) {
    bool success = IERC20(token).transfer(msg.sender, amount);
    if (!success) {
      revert WithdrawFailed();
    }
    emit WithdrawToken(msg.sender, _playerId, token, amount);
  }

  function withdrawItems(
    address _to,
    uint _playerId,
    uint[] memory ids,
    uint[] memory amounts
  ) external isOwnerOfPlayer(_playerId) isClanAdmin(_playerId) {
    bankRegistry.itemNFT().safeBatchTransferFrom(address(this), _to, ids, amounts, "");

    // Update uniqueItemCount after withdrawing items
    for (uint i = 0; i < ids.length; ++i) {
      uint id = ids[i];
      if (uniqueItems[id] && bankRegistry.itemNFT().balanceOf(address(this), id) == 0) {
        --uniqueItemCount;
        uniqueItems[id] = false;
      }
    }
    emit WithdrawItems(_to, _playerId, ids, amounts);
  }

  receive() external payable {
    // Accept FTM
  }
}
