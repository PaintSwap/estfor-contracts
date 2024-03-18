// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.8.0) (token/ERC1155/ERC1155.sol)

pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/IERC1155MetadataURIUpgradeable.sol";
import "../../utils/AddressUpgradeable.sol";
import "../../utils/ContextUpgradeable.sol";
import "../../proxy/utils/Initializable.sol";
import "../../utils/introspection/ERC165Upgradeable.sol";

/**
 * @dev Implementation of the basic standard multi-token.
 * See https://eips.ethereum.org/EIPS/eip-1155
 * Originally based on code by Enjin: https://github.com/enjin/erc-1155
 *
 * _Available since v3.1._
 */
contract ERC1155UpgradeableSinglePerToken is
  Initializable,
  ContextUpgradeable,
  ERC165Upgradeable,
  IERC1155Upgradeable,
  IERC1155MetadataURIUpgradeable
{
  using AddressUpgradeable for address;

  error ERC1155TransferToNonERC1155Receiver();
  error ERC1155ReceiverRejectedTokens();
  error ERC1155SettingApprovalStatusForSelf();
  error ERC115BurnFromZeroAddress();
  error ERC1155LengthMismatch();
  error ERC115BurnAmountExceedsBalance();
  error ERC1155MintToZeroAddress();
  error ERC1155TransferToZeroAddress();
  error ERC1155InsufficientBalance();
  error ERC1155TransferFromNotApproved();
  error ERC1155ZeroAddressNotValidOwner();
  error ERC1155MintingMoreThanOneSameNFT();

  // Mapping from token ID to account balances
  mapping(uint256 tokenId => address owner) private _owner; // This is just the default, can be overriden

  // Mapping from account to operator approvals
  mapping(address => mapping(address => bool)) private _operatorApprovals;

  // Used as the URI for all token types by relying on ID substitution, e.g. https://token-cdn-domain/{id}.json
  string private _uri;

  uint40 internal _totalSupplyAll;

  /**
   * @dev See {_setURI}.
   */
  function __ERC1155_init(string memory uri_) internal onlyInitializing {
    __ERC1155_init_unchained(uri_);
  }

  function __ERC1155_init_unchained(string memory uri_) internal onlyInitializing {
    _setURI(uri_);
  }

  function totalSupply(uint _tokenId) public view returns (uint) {
    return exists(_tokenId) ? 1 : 0;
  }

  function totalSupply() external view returns (uint) {
    return _totalSupplyAll;
  }

  // Override this function is updateOwner is overrides
  function exists(uint _tokenId) public view virtual returns (bool) {
    return _owner[_tokenId] != address(0);
  }

  /**
   * @dev See {IERC165-supportsInterface}.
   */
  function supportsInterface(
    bytes4 interfaceId
  ) public view virtual override(ERC165Upgradeable, IERC165Upgradeable) returns (bool) {
    return
      interfaceId == type(IERC1155Upgradeable).interfaceId ||
      interfaceId == type(IERC1155MetadataURIUpgradeable).interfaceId ||
      super.supportsInterface(interfaceId);
  }

  /**
   * @dev See {IERC1155MetadataURI-uri}.
   *
   * This implementation returns the same URI for *all* token types. It relies
   * on the token type ID substitution mechanism
   * https://eips.ethereum.org/EIPS/eip-1155#metadata[defined in the EIP].
   *
   * Clients calling this function must replace the `\{id\}` substring with the
   * actual token type ID.
   */
  function uri(uint256) public view virtual override returns (string memory) {
    return _uri;
  }

  /**
   * @dev See {IERC1155-balanceOf}.
   *
   * Requirements:
   *
   * - `account` cannot be the zero address.
   */
  function balanceOf(address account, uint256 id) public view virtual override returns (uint256) {
    if (account == address(0)) {
      revert ERC1155ZeroAddressNotValidOwner();
    }
    return _getOwner(id) == account ? 1 : 0;
  }

  /**
   * Override this function to return the owner of the token if you have a better packed implementation
   */
  function _getOwner(uint256 id) public view virtual returns (address) {
    return _owner[id];
  }

  /**
   * @dev See {IERC1155-balanceOfBatch}.
   *
   * Requirements:
   *
   * - `accounts` and `ids` must have the same length.
   */
  function balanceOfBatch(
    address[] memory accounts,
    uint256[] memory ids
  ) public view virtual override returns (uint256[] memory) {
    if (accounts.length != ids.length) {
      revert ERC1155LengthMismatch();
    }

    uint256[] memory batchBalances = new uint256[](accounts.length);

    for (uint256 i = 0; i < accounts.length; ++i) {
      batchBalances[i] = balanceOf(accounts[i], ids[i]);
    }

    return batchBalances;
  }

  /**
   * @dev See {IERC1155-setApprovalForAll}.
   */
  function setApprovalForAll(address operator, bool approved) public virtual override {
    _setApprovalForAll(_msgSender(), operator, approved);
  }

  /**
   * @dev See {IERC1155-isApprovedForAll}.
   */
  function isApprovedForAll(address account, address operator) public view virtual override returns (bool) {
    return _operatorApprovals[account][operator];
  }

  /**
   * @dev See {IERC1155-safeTransferFrom}.
   */
  function safeTransferFrom(
    address from,
    address to,
    uint256 id,
    uint256 amount,
    bytes memory data
  ) public virtual override {
    if (from != _msgSender() && !isApprovedForAll(from, _msgSender())) {
      revert ERC1155TransferFromNotApproved();
    }
    _safeTransferFrom(from, to, id, amount, data);
  }

  /**
   * @dev See {IERC1155-safeBatchTransferFrom}.
   */
  function safeBatchTransferFrom(
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
  ) public virtual override {
    if (from != _msgSender() && !isApprovedForAll(from, _msgSender())) {
      revert ERC1155TransferFromNotApproved();
    }
    _safeBatchTransferFrom(from, to, ids, amounts, data);
  }

  /**
   * @dev Transfers `amount` tokens of token type `id` from `from` to `to`.
   *
   * Emits a {TransferSingle} event.
   *
   * Requirements:
   *
   * - `to` cannot be the zero address.
   * - `from` must have a balance of tokens of type `id` of at least `amount`.
   * - If `to` refers to a smart contract, it must implement {IERC1155Receiver-onERC1155Received} and return the
   * acceptance magic value.
   */
  function _safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes memory data) internal virtual {
    if (to == address(0)) {
      revert ERC1155TransferToZeroAddress();
    }

    address operator = _msgSender();
    uint256[] memory ids = _asSingletonArray(id);
    uint256[] memory amounts = _asSingletonArray(amount);

    _beforeTokenTransfer(operator, from, to, ids, amounts, data);

    uint256 fromBalance = _getOwner(id) == from ? 1 : 0;
    if (fromBalance < amount) {
      revert ERC1155InsufficientBalance();
    }
    bool isBurnt = to == 0x000000000000000000000000000000000000dEaD;
    if (isBurnt) {
      unchecked {
        --_totalSupplyAll;
      }
      _updateOwner(id, address(0));
    } else if (from != to) {
      _updateOwner(id, to);
    }

    emit TransferSingle(operator, from, to, id, amount);

    _afterTokenTransfer(operator, from, to, ids, amounts, data);

    _doSafeTransferAcceptanceCheck(operator, from, to, id, amount, data);
  }

  /**
   * @dev xref:ROOT:erc1155.adoc#batch-operations[Batched] version of {_safeTransferFrom}.
   *
   * Emits a {TransferBatch} event.
   *
   * Requirements:
   *
   * - If `to` refers to a smart contract, it must implement {IERC1155Receiver-onERC1155BatchReceived} and return the
   * acceptance magic value.
   */
  function _safeBatchTransferFrom(
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
  ) internal virtual {
    if (ids.length != amounts.length) {
      revert ERC1155LengthMismatch();
    }
    if (to == address(0)) {
      revert ERC1155TransferToZeroAddress();
    }

    address operator = _msgSender();

    _beforeTokenTransfer(operator, from, to, ids, amounts, data);

    for (uint256 i = 0; i < ids.length; ++i) {
      uint256 id = ids[i];
      uint256 amount = amounts[i];

      uint256 fromBalance = _getOwner(id) == from ? 1 : 0;
      if (fromBalance < amount) {
        revert ERC1155InsufficientBalance();
      }
      if (from != to) {
        _updateOwner(id, to);
      }
    }

    bool isBurnt = to == address(0) || to == 0x000000000000000000000000000000000000dEaD;
    if (isBurnt) {
      unchecked {
        _totalSupplyAll = uint40(_totalSupplyAll - ids.length);
      }
    }

    emit TransferBatch(operator, from, to, ids, amounts);

    _afterTokenTransfer(operator, from, to, ids, amounts, data);

    _doSafeBatchTransferAcceptanceCheck(operator, from, to, ids, amounts, data);
  }

  /**
   * @dev Sets a new URI for all token types, by relying on the token type ID
   * substitution mechanism
   * https://eips.ethereum.org/EIPS/eip-1155#metadata[defined in the EIP].
   *
   * By this mechanism, any occurrence of the `\{id\}` substring in either the
   * URI or any of the amounts in the JSON file at said URI will be replaced by
   * clients with the token type ID.
   *
   * For example, the `https://token-cdn-domain/\{id\}.json` URI would be
   * interpreted by clients as
   * `https://token-cdn-domain/000000000000000000000000000000000000000000000000000000000004cce0.json`
   * for token type ID 0x4cce0.
   *
   * See {uri}.
   *
   * Because these URIs cannot be meaningfully represented by the {URI} event,
   * this function emits no events.
   */
  function _setURI(string memory newuri) internal virtual {
    _uri = newuri;
  }

  /**
   * @dev Creates `amount` tokens of token type `id`, and assigns them to `to`.
   *
   * Emits a {TransferSingle} event.
   *
   * Requirements:
   *
   * - `to` cannot be the zero address.
   * - If `to` refers to a smart contract, it must implement {IERC1155Receiver-onERC1155Received} and return the
   * acceptance magic value.
   */
  function _mint(address to, uint256 id, uint256 amount, bytes memory data) internal virtual {
    if (to == address(0)) {
      revert ERC1155MintToZeroAddress();
    }

    if (amount > 1 || totalSupply(id) != 0) {
      revert ERC1155MintingMoreThanOneSameNFT();
    }

    address operator = _msgSender();
    uint256[] memory ids = _asSingletonArray(id);
    uint256[] memory amounts = _asSingletonArray(amount);

    _beforeTokenTransfer(operator, address(0), to, ids, amounts, data);

    unchecked {
      ++_totalSupplyAll;
    }
    _updateOwner(id, to);

    emit TransferSingle(operator, address(0), to, id, amount);

    _afterTokenTransfer(operator, address(0), to, ids, amounts, data);

    _doSafeTransferAcceptanceCheck(operator, address(0), to, id, amount, data);
  }

  /**
   * @dev xref:ROOT:erc1155.adoc#batch-operations[Batched] version of {_mint}.
   *
   * Emits a {TransferBatch} event.
   *
   * Requirements:
   *
   * - `ids` and `amounts` must have the same length.
   * - If `to` refers to a smart contract, it must implement {IERC1155Receiver-onERC1155BatchReceived} and return the
   * acceptance magic value.
   */
  function _mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data) internal virtual {
    if (to == address(0)) {
      revert ERC1155MintToZeroAddress();
    }
    if (ids.length != amounts.length) {
      revert ERC1155LengthMismatch();
    }

    address operator = _msgSender();

    _beforeTokenTransfer(operator, address(0), to, ids, amounts, data);

    for (uint256 i = 0; i < ids.length; ++i) {
      if (amounts[i] > 1 || totalSupply(ids[i]) != 0) {
        revert ERC1155MintingMoreThanOneSameNFT();
      }

      _updateOwner(ids[i], to);
    }

    unchecked {
      _totalSupplyAll += uint40(ids.length);
    }

    emit TransferBatch(operator, address(0), to, ids, amounts);

    _afterTokenTransfer(operator, address(0), to, ids, amounts, data);

    _doSafeBatchTransferAcceptanceCheck(operator, address(0), to, ids, amounts, data);
  }

  /**
   * @dev Destroys `amount` tokens of token type `id` from `from`
   *
   * Emits a {TransferSingle} event.
   *
   * Requirements:
   *
   * - `from` cannot be the zero address.
   * - `from` must have at least `amount` tokens of token type `id`.
   */
  function _burn(address from, uint256 id, uint256 amount) internal virtual {
    if (from == address(0)) {
      revert ERC115BurnFromZeroAddress();
    }

    address operator = _msgSender();
    uint256[] memory ids = _asSingletonArray(id);
    uint256[] memory amounts = _asSingletonArray(amount);

    _beforeTokenTransfer(operator, from, address(0), ids, amounts, ""); // This will handle burns

    uint256 fromBalance = _getOwner(id) == from ? 1 : 0;
    if (fromBalance < amount) {
      revert ERC115BurnAmountExceedsBalance();
    }
    unchecked {
      --_totalSupplyAll;
    }
    _updateOwner(id, address(0));

    emit TransferSingle(operator, from, address(0), id, amount);

    _afterTokenTransfer(operator, from, address(0), ids, amounts, "");
  }

  /**
   * @dev xref:ROOT:erc1155.adoc#batch-operations[Batched] version of {_burn}.
   *
   * Emits a {TransferBatch} event.
   *
   * Requirements:
   *
   * - `ids` and `amounts` must have the same length.
   */
  function _burnBatch(address from, uint256[] memory ids, uint256[] memory amounts) internal virtual {
    if (from == address(0)) {
      revert ERC115BurnFromZeroAddress();
    }
    if (ids.length != amounts.length) {
      revert ERC1155LengthMismatch();
    }

    address operator = _msgSender();

    _beforeTokenTransfer(operator, from, address(0), ids, amounts, "");

    for (uint256 i = 0; i < ids.length; i++) {
      uint256 id = ids[i];
      uint256 amount = amounts[i];

      uint256 fromBalance = _getOwner(id) == from ? 1 : 0;
      if (fromBalance < amount) {
        revert ERC115BurnAmountExceedsBalance();
      }

      _updateOwner(id, address(0));
    }

    unchecked {
      _totalSupplyAll -= uint40(ids.length);
    }

    emit TransferBatch(operator, from, address(0), ids, amounts);

    _afterTokenTransfer(operator, from, address(0), ids, amounts, "");
  }

  /**
   * @dev Approve `operator` to operate on all of `owner` tokens
   *
   * Emits an {ApprovalForAll} event.
   */
  function _setApprovalForAll(address owner, address operator, bool approved) internal virtual {
    if (owner == operator) {
      revert ERC1155SettingApprovalStatusForSelf();
    }
    _operatorApprovals[owner][operator] = approved;
    emit ApprovalForAll(owner, operator, approved);
  }

  /**
   * @dev Hook that is called before any token transfer. This includes minting
   * and burning, as well as batched variants.
   *
   * The same hook is called on both single and batched variants. For single
   * transfers, the length of the `ids` and `amounts` arrays will be 1.
   *
   * Calling conditions (for each `id` and `amount` pair):
   *
   * - When `from` and `to` are both non-zero, `amount` of ``from``'s tokens
   * of token type `id` will be  transferred to `to`.
   * - When `from` is zero, `amount` tokens of token type `id` will be minted
   * for `to`.
   * - when `to` is zero, `amount` of ``from``'s tokens of token type `id`
   * will be burned.
   * - `from` and `to` are never both zero.
   * - `ids` and `amounts` have the same, non-zero length.
   *
   * To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks].
   */
  function _beforeTokenTransfer(
    address operator,
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
  ) internal virtual {}

  /**
   * @dev Hook that is called after any token transfer. This includes minting
   * and burning, as well as batched variants.
   *
   * The same hook is called on both single and batched variants. For single
   * transfers, the length of the `id` and `amount` arrays will be 1.
   *
   * Calling conditions (for each `id` and `amount` pair):
   *
   * - When `from` and `to` are both non-zero, `amount` of ``from``'s tokens
   * of token type `id` will be  transferred to `to`.
   * - When `from` is zero, `amount` tokens of token type `id` will be minted
   * for `to`.
   * - when `to` is zero, `amount` of ``from``'s tokens of token type `id`
   * will be burned.
   * - `from` and `to` are never both zero.
   * - `ids` and `amounts` have the same, non-zero length.
   *
   * To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks].
   */
  function _afterTokenTransfer(
    address operator,
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
  ) internal virtual {}

  function _doSafeTransferAcceptanceCheck(
    address operator,
    address from,
    address to,
    uint256 id,
    uint256 amount,
    bytes memory data
  ) private {
    if (to.isContract()) {
      try IERC1155ReceiverUpgradeable(to).onERC1155Received(operator, from, id, amount, data) returns (
        bytes4 response
      ) {
        if (response != IERC1155ReceiverUpgradeable.onERC1155Received.selector) {
          revert ERC1155ReceiverRejectedTokens();
        }
      } catch Error(string memory reason) {
        revert(reason);
      } catch {
        revert ERC1155TransferToNonERC1155Receiver();
      }
    }
  }

  function _doSafeBatchTransferAcceptanceCheck(
    address operator,
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
  ) private {
    if (to.isContract()) {
      try IERC1155ReceiverUpgradeable(to).onERC1155BatchReceived(operator, from, ids, amounts, data) returns (
        bytes4 response
      ) {
        if (response != IERC1155ReceiverUpgradeable.onERC1155BatchReceived.selector) {
          revert ERC1155ReceiverRejectedTokens();
        }
      } catch Error(string memory reason) {
        revert(reason);
      } catch {
        revert ERC1155TransferToNonERC1155Receiver();
      }
    }
  }

  function _updateOwner(uint256 id, address to) internal virtual {
    _owner[id] = to;
  }

  function _asSingletonArray(uint256 element) private pure returns (uint256[] memory) {
    uint256[] memory array = new uint256[](1);
    array[0] = element;

    return array;
  }
}
