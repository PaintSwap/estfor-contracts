// SPDX-License-Identifier: GPL-3.0-or-later Or MIT
pragma solidity >=0.8.0 <0.9.0;

interface IArtGallery {
  function lock(address painter, uint256 amount) external;
}

interface IBEP20 {
  /**
   * @dev Returns the amount of tokens in existence.
   */
  function totalSupply() external view returns (uint256);

  /**
   * @dev Returns the token decimals.
   */
  function decimals() external view returns (uint8);

  /**
   * @dev Returns the token symbol.
   */
  function symbol() external view returns (string memory);

  /**
   * @dev Returns the token name.
   */
  function name() external view returns (string memory);

  /**
   * @dev Returns the bep token owner.
   */
  function getOwner() external view returns (address);

  /**
   * @dev Returns the amount of tokens owned by `account`.
   */
  function balanceOf(address account) external view returns (uint256);

  /**
   * @dev Moves `amount` tokens from the caller's account to `recipient`.
   *
   * Returns a boolean value indicating whether the operation succeeded.
   *
   * Emits a {Transfer} event.
   */
  function transfer(address recipient, uint256 amount) external returns (bool);

  /**
   * @dev Returns the remaining number of tokens that `spender` will be
   * allowed to spend on behalf of `owner` through {transferFrom}. This is
   * zero by default.
   *
   * This value changes when {approve} or {transferFrom} are called.
   */
  function allowance(address owner, address spender) external view returns (uint256);

  /**
   * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
   *
   * Returns a boolean value indicating whether the operation succeeded.
   *
   * IMPORTANT: Beware that changing an allowance with this method brings the risk
   * that someone may use both the old and the new allowance by unfortunate
   * transaction ordering. One possible solution to mitigate this race
   * condition is to first reduce the spender's allowance to 0 and set the
   * desired value afterwards:
   * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
   *
   * Emits an {Approval} event.
   */
  function approve(address spender, uint256 amount) external returns (bool);

  /**
   * @dev Moves `amount` tokens from `sender` to `recipient` using the
   * allowance mechanism. `amount` is then deducted from the caller's
   * allowance.
   *
   * Returns a boolean value indicating whether the operation succeeded.
   *
   * Emits a {Transfer} event.
   */
  function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

  /**
   * @dev Emitted when `value` tokens are moved from one account (`from`) to
   * another (`to`).
   *
   * Note that `value` may be zero.
   */
  event Transfer(address indexed from, address indexed to, uint256 value);

  /**
   * @dev Emitted when the allowance of a `spender` for an `owner` is set by
   * a call to {approve}. `value` is the new allowance.
   */
  event Approval(address indexed owner, address indexed spender, uint256 value);
}

/*
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with GSN meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
  function _msgSender() internal view virtual returns (address) {
    // payable
    return msg.sender;
  }

  function _msgData() internal view virtual returns (bytes memory) {
    this; // silence state mutability warning without generating bytecode - see https://github.com/ethereum/solidity/issues/2691
    return msg.data;
  }
}

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * By default, the owner account will be the one that deploys the contract. This
 * can later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
  address private _owner;

  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

  /**
   * @dev Initializes the contract setting the deployer as the initial owner.
   */
  constructor() {
    address msgSender = _msgSender();
    _owner = msgSender;
    emit OwnershipTransferred(address(0), msgSender);
  }

  /**
   * @dev Returns the address of the current owner.
   */
  function owner() public view returns (address) {
    return _owner;
  }

  /**
   * @dev Throws if called by any account other than the owner.
   */
  modifier onlyOwner() {
    require(_owner == _msgSender(), "Ownable: caller is not the owner");
    _;
  }

  /**
   * @dev Leaves the contract without owner. It will not be possible to call
   * `onlyOwner` functions anymore. Can only be called by the current owner.
   *
   * NOTE: Renouncing ownership will leave the contract without an owner,
   * thereby removing any functionality that is only available to the owner.
   */
  function renounceOwnership() public virtual onlyOwner {
    emit OwnershipTransferred(_owner, address(0));
    _owner = address(0);
  }

  /**
   * @dev Transfers ownership of the contract to a new account (`newOwner`).
   * Can only be called by the current owner.
   */
  function transferOwnership(address newOwner) public virtual onlyOwner {
    require(newOwner != address(0), "Ownable: new owner is the zero address");
    emit OwnershipTransferred(_owner, newOwner);
    _owner = newOwner;
  }
}

contract TestPaintSwapArtGallery is IArtGallery, Ownable {
  struct ArtEntry {
    uint256 amount; // How much to lock
    uint256 unlockTime; // When it is unlocked
  }

  // A wrapper around a mapping, enabling FIFO
  struct Collection {
    mapping(uint256 => ArtEntry) queue;
    uint256 first;
    uint256 count;
  }

  IBEP20 private immutable _brush;
  uint256 public immutable _lockDuration;

  mapping(address => Collection) private lockedUp;

  constructor(address brush, uint256 lockDuration) {
    _brush = IBEP20(brush);
    _lockDuration = lockDuration;
  }

  function lock(address painter, uint256 amount) external override onlyOwner {
    require(amount > 0);
    Collection storage collection = lockedUp[painter];
    collection.queue[collection.count] = ArtEntry({amount: amount, unlockTime: block.timestamp + _lockDuration});
    collection.count++;
  }

  function isUnlockable(uint256 _unlockTime) public view returns (bool) {
    return block.timestamp >= _unlockTime;
  }

  // Always use inspect() first to avoid spending gas without any unlocks
  function unlock() external {
    uint256 unlockedAmount;

    Collection storage collection = lockedUp[msg.sender];
    uint256 count = collection.count;
    while (collection.first < count) {
      ArtEntry storage entry = collection.queue[collection.first];
      if (!isUnlockable(entry.unlockTime)) {
        break;
      }
      unlockedAmount += entry.amount;
      delete collection.queue[collection.first];
      ++collection.first;
    }

    if (unlockedAmount > 0) {
      safeBrushTransfer(msg.sender, unlockedAmount);
    }
  }

  function inspect(
    address painter
  )
    public
    view
    returns (
      uint256 lockedCount, // How many art pieces are locked
      uint256 lockedAmount, // How much is locked in total
      uint256 unlockableCount,
      uint256 unlockableAmount,
      uint256 nextUnlockTime, // 0 if nothing locked; does not represent an immediate unlockable
      uint256 nextUnlockAmount
    )
  {
    Collection storage collection = lockedUp[painter];
    for (uint256 i = collection.first; i < collection.count; ++i) {
      ArtEntry storage entry = collection.queue[i];
      if (isUnlockable(entry.unlockTime)) {
        ++unlockableCount;
        unlockableAmount += entry.amount;
      } else {
        ++lockedCount;
        lockedAmount += entry.amount;
        if (lockedCount == 1) {
          nextUnlockTime = entry.unlockTime;
          nextUnlockAmount = entry.amount;
        }
      }
    }
  }

  // Safe brush transfer function, just in case if rounding error causes the gallery to not have enough BRUSHs.
  function safeBrushTransfer(address to, uint256 amount) internal {
    require(amount > 0);
    uint256 brushBal = _brush.balanceOf(address(this));
    if (amount > brushBal) {
      _brush.transfer(to, brushBal);
    } else {
      _brush.transfer(to, amount);
    }
  }
}
