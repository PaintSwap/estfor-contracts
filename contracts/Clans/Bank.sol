// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";

import {IClans} from "../interfaces/IClans.sol";
import {IBank} from "../interfaces/IBank.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {BankRegistry} from "./BankRegistry.sol";
import {BulkTransferInfo} from "../globals/items.sol";

contract Bank is ERC1155Holder, IBank, Initializable {
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

  uint32 public clanId;
  BankRegistry public bankRegistry;
  uint16 public uniqueItemCount;
  uint8 private reentrantStatus;
  mapping(uint256 itemTokenId => bool hasAny) public uniqueItems;

  modifier isOwnerOfPlayer(uint256 _playerId) {
    if (bankRegistry.playerNFT().balanceOf(msg.sender, _playerId) != 1) {
      revert NotOwnerOfPlayer();
    }
    _;
  }

  modifier canWithdraw(uint256 _playerId) {
    if (!bankRegistry.clans().canWithdraw(clanId, _playerId)) {
      revert NotClanAdmin();
    }
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
    if (reentrantStatus == ENTERED) {
      revert ReentrancyGuardReentrantCall();
    }
    reentrantStatus = ENTERED;
    _;
    // By storing the original value once again, a refund is triggered (see
    // https://eips.ethereum.org/EIPS/eip-2200)
    reentrantStatus = NOT_ENTERED;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(uint256 _clanId, address _bankRegistry) external override initializer {
    clanId = uint32(_clanId);
    bankRegistry = BankRegistry(_bankRegistry);
    reentrantStatus = NOT_ENTERED;
  }

  function depositItems(
    uint256 _playerId,
    uint256[] calldata _ids,
    uint256[] calldata _values
  ) external isOwnerOfPlayer(_playerId) {
    uint256 maxCapacity = bankRegistry.clans().maxBankCapacity(clanId);
    U256 bounds = _ids.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      _receivedItemUpdateUniqueItems(_ids[iter.asUint256()], maxCapacity);
    }
    bankRegistry.itemNFT().safeBatchTransferFrom(msg.sender, address(this), _ids, _values, "");
    emit DepositItems(msg.sender, _playerId, _ids, _values);
  }

  function withdrawItems(
    address _to,
    uint256 _playerId,
    uint256[] calldata _ids,
    uint256[] calldata _amounts
  ) external isOwnerOfPlayer(_playerId) canWithdraw(_playerId) nonReentrant {
    ItemNFT itemNFT = bankRegistry.itemNFT();
    itemNFT.safeBatchTransferFrom(address(this), _to, _ids, _amounts, "");

    // Update uniqueItemCount after withdrawing items
    U256 bounds = _ids.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint256 id = _ids[iter.asUint256()];
      if (uniqueItems[id] && itemNFT.balanceOf(address(this), id) == 0) {
        uniqueItemCount = uint16(uniqueItemCount.dec());
        uniqueItems[id] = false;
      }
    }
    emit WithdrawItems(msg.sender, _to, _playerId, _ids, _amounts);
  }

  function withdrawItemsBulk(
    BulkTransferInfo[] calldata _nftsInfo,
    uint256 _playerId
  ) external isOwnerOfPlayer(_playerId) canWithdraw(_playerId) nonReentrant {
    ItemNFT itemNFT = bankRegistry.itemNFT();
    itemNFT.safeBulkTransfer(_nftsInfo);

    // Update uniqueItemCount after withdrawing items
    for (uint256 i; i < _nftsInfo.length; ++i) {
      U256 bounds = _nftsInfo.length.asU256();
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        uint256[] calldata ids = _nftsInfo[iter.asUint256()].tokenIds;
        for (uint256 j; j < ids.length; ++j) {
          uint256 id = ids[j];
          if (uniqueItems[id] && itemNFT.balanceOf(address(this), id) == 0) {
            uniqueItemCount = uint16(uniqueItemCount.dec());
            uniqueItems[id] = false;
          }
        }
      }
    }

    emit WithdrawItemsBulk(msg.sender, _nftsInfo, _playerId);
  }

  function onERC1155Received(
    address _operator,
    address _from,
    uint256 _id,
    uint256 _value,
    bytes memory _data
  ) public override returns (bytes4) {
    // Only care about itemNFTs sent from outside the bank here
    if (msg.sender == address(bankRegistry.itemNFT()) && _operator != address(this)) {
      uint256 maxCapacity = bankRegistry.clans().maxBankCapacity(clanId);
      _receivedItemUpdateUniqueItems(_id, maxCapacity);
      uint256 activePlayerId = bankRegistry.players().activePlayer(_from);
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
      uint256 maxCapacity = bankRegistry.clans().maxBankCapacity(clanId);
      U256 bounds = _ids.length.asU256();
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        _receivedItemUpdateUniqueItems(_ids[iter.asUint256()], maxCapacity);
      }
      uint256 activePlayerId = bankRegistry.players().activePlayer(_from);
      emit DepositItems(_from, activePlayerId, _ids, _values);
    }
    return super.onERC1155BatchReceived(_operator, _from, _ids, _values, _data);
  }

  function depositFTM(uint256 _playerId) external payable isOwnerOfPlayer(_playerId) {
    if (msg.value != 0) {
      emit DepositFTM(msg.sender, _playerId, msg.value);
    }
  }

  // Untested
  function withdrawFTM(
    address _to,
    uint256 _playerId,
    uint256 _amount
  ) external isOwnerOfPlayer(_playerId) canWithdraw(_playerId) {
    (bool success, ) = msg.sender.call{value: _amount}("");
    if (!success) {
      revert WithdrawFailed();
    }
    emit WithdrawFTM(msg.sender, _to, _playerId, _amount);
  }

  function depositToken(address _from, uint256 _playerId, address _token, uint256 _amount) external {
    if (_from != msg.sender && msg.sender != address(bankRegistry.lockedBankVaults())) {
      revert NotOwnerOfPlayer();
    }

    if (bankRegistry.playerNFT().balanceOf(_from, _playerId) != 1) {
      revert NotOwnerOfPlayer();
    }

    bool success = IERC20(_token).transferFrom(msg.sender, address(this), _amount);
    if (!success) {
      revert DepositFailed();
    }

    emit DepositToken(_from, _playerId, _token, _amount);
  }

  function withdrawToken(
    uint256 _playerId,
    address _to,
    uint256 _toPlayerId,
    address _token,
    uint256 _amount
  ) external isOwnerOfPlayer(_playerId) canWithdraw(_playerId) {
    if (bankRegistry.playerNFT().balanceOf(_to, _toPlayerId) != 1) {
      revert ToIsNotOwnerOfPlayer();
    }
    bool success = IERC20(_token).transfer(_to, _amount);
    if (!success) {
      revert WithdrawFailed();
    }
    emit WithdrawToken(msg.sender, _playerId, _to, _toPlayerId, _token, _amount);
  }

  function withdrawTokenToMany(
    uint256 _playerId,
    address[] calldata _tos,
    uint256[] calldata _toPlayerIds,
    address _token,
    uint256[] calldata _amounts
  ) external isOwnerOfPlayer(_playerId) canWithdraw(_playerId) {
    if (_toPlayerIds.length != _amounts.length) {
      revert LengthMismatch();
    }

    if (_toPlayerIds.length != _tos.length) {
      revert LengthMismatch();
    }

    for (uint256 i = 0; i < _toPlayerIds.length; ++i) {
      if (bankRegistry.playerNFT().balanceOf(_tos[i], _toPlayerIds[i]) != 1) {
        revert ToIsNotOwnerOfPlayer();
      }
      bool success = IERC20(_token).transfer(_tos[i], _amounts[i]);
      if (!success) {
        revert WithdrawFailed();
      }
    }

    emit WithdrawTokens(msg.sender, _playerId, _tos, _toPlayerIds, _token, _amounts);
  }

  function withdrawNFT(
    uint256 _playerId,
    address _to,
    uint256 _toPlayerId,
    address _nft,
    uint256 _tokenId,
    uint256 _amount
  ) external isOwnerOfPlayer(_playerId) canWithdraw(_playerId) {
    if (_nft == address(bankRegistry.itemNFT())) {
      revert UseWithdrawItemsForNFT();
    }
    if (bankRegistry.playerNFT().balanceOf(_to, _toPlayerId) != 1) {
      revert ToIsNotOwnerOfPlayer();
    }

    if (!IERC165(_nft).supportsInterface(type(IERC1155).interfaceId)) {
      revert NFTTypeNotSupported();
    }

    IERC1155(_nft).safeTransferFrom(address(this), _to, _tokenId, _amount, "");
    emit WithdrawNFT(msg.sender, _playerId, _to, _toPlayerId, _nft, _tokenId, _amount);
  }

  function _receivedItemUpdateUniqueItems(uint256 _id, uint256 _maxCapacity) private {
    if (!uniqueItems[_id]) {
      if (uniqueItemCount >= _maxCapacity) {
        revert MaxBankCapacityReached();
      }
      uniqueItemCount = uint16(uniqueItemCount.inc());
      uniqueItems[_id] = true;
    }
  }

  // Untested
  receive() external payable {
    // Accept FTM
    uint256 activePlayerId = bankRegistry.players().activePlayer(msg.sender);
    emit DepositFTM(msg.sender, activePlayerId, msg.value);
  }
}
