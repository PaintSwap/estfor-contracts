// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import {IBrushToken} from "./interfaces/IBrushToken.sol";
import {ITerritories} from "./interfaces/ITerritories.sol";
import {IPaintSwapDecorator} from "./interfaces/IPaintSwapDecorator.sol";
import {IPaintSwapArtGallery} from "./interfaces/IPaintSwapArtGallery.sol";

contract DecoratorProvider is UUPSUpgradeable, OwnableUpgradeable {
  event Deposit(uint amount);
  event Harvest(address from, uint playerId, uint amount, uint nextHarvestAllowedTimestamp);
  event SetPID(uint pid);
  event UnlockFromArtGallery(uint amount);

  error InvalidPool();
  error ZeroBalance();
  error TransferFailed();
  error HarvestingTooSoon();
  error HarvestingTooMuch();
  error NotOwnerOfPlayer();

  IPaintSwapDecorator public decorator;
  IPaintSwapArtGallery public artGallery;
  ITerritories public territories;
  IBrushToken public brush;
  address public dev;
  IERC1155 public playerNFT;
  uint16 public pid;
  uint40 public nextHarvestAllowedTimestamp;
  uint16 public numUnclaimedHarvests;
  IERC20 public lpToken;

  uint public constant MAX_UNCLAIMED_HARVESTS = 600;
  uint public constant MIN_HARVEST_INTERVAL = 3 hours + 45 minutes;

  modifier isOwnerOfPlayer(uint _playerId) {
    if (playerNFT.balanceOf(msg.sender, _playerId) == 0) {
      revert NotOwnerOfPlayer();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    IPaintSwapDecorator _decorator,
    IPaintSwapArtGallery _artGallery,
    ITerritories _territories,
    IBrushToken _brush,
    IERC1155 _playerNFT,
    address _dev,
    uint _pid
  ) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();
    territories = _territories;
    playerNFT = _playerNFT;
    brush = _brush;
    artGallery = _artGallery;
    decorator = _decorator;
    dev = _dev;
    _brush.approve(address(_territories), type(uint256).max);
    setPID(_pid);
  }

  function deposit() external {
    uint balance = lpToken.balanceOf(msg.sender);
    if (balance == 0) {
      revert ZeroBalance();
    }
    if (!lpToken.transferFrom(msg.sender, address(this), balance)) {
      revert TransferFailed();
    }
    decorator.deposit(pid, balance);
    emit Deposit(balance);
  }

  function harvest(uint _playerId) external isOwnerOfPlayer(_playerId) {
    // Max harvest once every 30 minutes
    uint _nextHarvestAllowedTimestamp = nextHarvestAllowedTimestamp;
    if (block.timestamp < _nextHarvestAllowedTimestamp) {
      revert HarvestingTooSoon();
    }

    // Can not go above 600 unclaimed harvests
    if (numUnclaimedHarvests > MAX_UNCLAIMED_HARVESTS) {
      revert HarvestingTooMuch();
    }

    nextHarvestAllowedTimestamp = uint40(block.timestamp + MIN_HARVEST_INTERVAL);
    ++numUnclaimedHarvests;
    decorator.updatePool(pid);
    uint amountBrush = decorator.pendingBrush(pid, address(this));
    if (amountBrush == 0) {
      revert ZeroBalance();
    }
    decorator.deposit(pid, 0); // get rewards
    uint fullBrushAmount = amountBrush * 2; // There will be funds here which are used to offset the art gallery rewards
    territories.addUnclaimedEmissions(fullBrushAmount);
    emit Harvest(msg.sender, _playerId, fullBrushAmount, uint40(block.timestamp + MIN_HARVEST_INTERVAL));
  }

  function unlockFromArtGallery() external {
    (, , uint256 unlockableCount, uint256 unlockableAmount, , ) = artGallery.inspect(address(this));
    if (unlockableAmount == 0) {
      revert ZeroBalance();
    }

    artGallery.unlock();
    numUnclaimedHarvests -= uint16(unlockableCount);
    // Dev address gets the funds because it is using it to offset art gallery rewards currently
    brush.transfer(dev, unlockableAmount);
    emit UnlockFromArtGallery(unlockableAmount);
  }

  function setPID(uint _pid) public onlyOwner {
    (address _lpToken, , , ) = decorator.poolInfo(_pid);
    if (_lpToken == address(0)) {
      revert InvalidPool();
    }

    lpToken = IERC20(_lpToken);
    pid = uint16(_pid);
    lpToken.approve(address(decorator), type(uint256).max);
    emit SetPID(_pid);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
