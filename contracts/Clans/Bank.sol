// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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

  event DepositItems(address from, uint playerId, uint[] ids, uint[] values);
  event DepositItem(address from, uint playerId, uint id, uint value);
  event WithdrawItems(address from, address to, uint playerId, uint[] ids, uint[] values);
  event DepositFTM(address from, uint playerId, uint amount);
  event WithdrawFTM(address from, address to, uint playerId, uint amount);
  event DepositToken(address from, uint playerId, address token, uint amount);
  event WithdrawToken(address from, address to, uint playerId, address token, uint amount);

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
    uint[] calldata _ids,
    uint[] calldata _values
  ) external isOwnerOfPlayer(_playerId) {
    uint maxCapacity = bankRegistry.clans().maxBankCapacity(clanId);
    U256 bounds = _ids.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      _receivedItemUpdateUniqueItems(_ids[iter.asUint256()], maxCapacity);
    }
    bankRegistry.itemNFT().safeBatchTransferFrom(msg.sender, address(this), _ids, _values, "");
    emit DepositItems(msg.sender, _playerId, _ids, _values);
  }

  function withdrawItems(
    address _to,
    uint _playerId,
    uint[] calldata _ids,
    uint[] calldata _amounts
  ) external isOwnerOfPlayer(_playerId) canWithdraw(_playerId) {
    bankRegistry.itemNFT().safeBatchTransferFrom(address(this), _to, _ids, _amounts, "");

    // Update uniqueItemCount after withdrawing items
    U256 bounds = _ids.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint id = _ids[iter.asUint256()];
      if (uniqueItems[id] && bankRegistry.itemNFT().balanceOf(address(this), id) == 0) {
        uniqueItemCount = uint16(uniqueItemCount.dec());
        uniqueItems[id] = false;
      }
    }
    emit WithdrawItems(msg.sender, _to, _playerId, _ids, _amounts);
  }

  function _receivedItemUpdateUniqueItems(uint _id, uint _maxCapacity) private {
    if (!uniqueItems[_id]) {
      if (uniqueItemCount >= _maxCapacity) {
        revert MaxBankCapacityReached();
      }
      uniqueItemCount = uint16(uniqueItemCount.inc());
      uniqueItems[_id] = true;
    }
  }

  function onERC1155Received(
    address _operator,
    address _from,
    uint _id,
    uint _value,
    bytes memory _data
  ) public override returns (bytes4) {
    // Only care about itemNFTs sent from outside the bank here
    if (msg.sender == address(bankRegistry.itemNFT()) && _operator != address(this)) {
      uint maxCapacity = bankRegistry.clans().maxBankCapacity(clanId);
      _receivedItemUpdateUniqueItems(_id, maxCapacity);
      uint activePlayerId = bankRegistry.players().activePlayer(_from);
      emit DepositItem(_from, activePlayerId, _id, _value);
    }
    return super.onERC1155Received(_operator, _from, _id, _value, _data);
  }

  function onERC1155BatchReceived(
    address _operator,
    address _from,
    uint256[] memory _ids,
    uint256[] memory _values,
    bytes memory _data
  ) public override returns (bytes4) {
    // Only care about itemNFTs sent from outside the bank here
    if (msg.sender == address(bankRegistry.itemNFT()) && _operator != address(this)) {
      uint maxCapacity = bankRegistry.clans().maxBankCapacity(clanId);
      U256 bounds = _ids.length.asU256();
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        _receivedItemUpdateUniqueItems(_ids[iter.asUint256()], maxCapacity);
      }
      uint activePlayerId = bankRegistry.players().activePlayer(_from);
      emit DepositItems(_from, activePlayerId, _ids, _values);
    }
    return super.onERC1155BatchReceived(_operator, _from, _ids, _values, _data);
  }

  function depositFTM(uint _playerId) external payable isOwnerOfPlayer(_playerId) {
    if (msg.value != 0) {
      emit DepositFTM(msg.sender, _playerId, msg.value);
    }
  }

  // Untested
  function withdrawFTM(
    address _to,
    uint _playerId,
    uint _amount
  ) external isOwnerOfPlayer(_playerId) canWithdraw(_playerId) {
    (bool success, ) = msg.sender.call{value: _amount}("");
    if (!success) {
      revert WithdrawFailed();
    }
    emit WithdrawFTM(msg.sender, _to, _playerId, _amount);
  }

  function depositToken(uint _playerId, address _token, uint _amount) external {
    if (_playerId != 0) {
      if (bankRegistry.playerNFT().balanceOf(msg.sender, _playerId) != 1) {
        revert NotOwnerOfPlayer();
      }
    }

    bool success = IERC20(_token).transferFrom(msg.sender, address(this), _amount);
    if (!success) {
      revert DepositFailed();
    }

    emit DepositToken(msg.sender, _playerId, _token, _amount);
  }

  function withdrawToken(
    address _to,
    uint _playerId,
    address _token,
    uint _amount
  ) external isOwnerOfPlayer(_playerId) canWithdraw(_playerId) {
    bool success = IERC20(_token).transfer(_to, _amount);
    if (!success) {
      revert WithdrawFailed();
    }
    emit WithdrawToken(msg.sender, _to, _playerId, _token, _amount);
  }

  // Untested
  receive() external payable {
    // Accept FTM
    uint activePlayerId = bankRegistry.players().activePlayer(msg.sender);
    emit DepositFTM(msg.sender, activePlayerId, msg.value);
  }
}
