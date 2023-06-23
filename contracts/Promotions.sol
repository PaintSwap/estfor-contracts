// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";
import {AdminAccess} from "./AdminAccess.sol";
import {ItemNFT} from "./ItemNFT.sol";

import "./globals/items.sol";

contract Promotions is UUPSUpgradeable, OwnableUpgradeable {
  struct User {
    bool starterPromotionClaimed;
    bytes8 redeemCodeStarterPromotion;
  }

  enum Promotion {
    NONE,
    STARTER
  }

  event PromotionRedeemed(
    address indexed to,
    uint playerId,
    Promotion promotion,
    string redeemCode,
    uint[] itemTokenIds,
    uint[] amounts
  );

  error NotOwnerOfPlayer();
  error PromotionAlreadyClaimed();
  error InvalidRedeemCode();
  error NotPromotionalAdmin();
  error NotAdminAndBeta();

  mapping(address user => User) public users;
  AdminAccess private adminAccess;
  ItemNFT private itemNFT;
  IERC1155 private playerNFT;
  bool private isBeta;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    AdminAccess _adminAccess,
    ItemNFT _itemNFT,
    IERC1155 _playerNFT,
    bool _isBeta
  ) public initializer {
    __Ownable_init();
    __UUPSUpgradeable_init();
    itemNFT = _itemNFT;
    playerNFT = _playerNFT;
    adminAccess = _adminAccess;
    isBeta = _isBeta;
  }

  modifier onlyPromotionalAdmin() {
    if (!adminAccess.isPromotionalAdmin(_msgSender())) {
      revert NotPromotionalAdmin();
    }
    _;
  }

  modifier isAdminAndBeta() {
    if (!(adminAccess.isAdmin(_msgSender()) && isBeta)) {
      revert NotAdminAndBeta();
    }
    _;
  }

  function mintStarterPromotionalPack(
    address _to,
    uint _playerId,
    string calldata _redeemCode
  ) external onlyPromotionalAdmin {
    if (users[_to].starterPromotionClaimed) {
      revert PromotionAlreadyClaimed();
    }

    if (bytes(_redeemCode).length != 16) {
      revert InvalidRedeemCode();
    }

    if (playerNFT.balanceOf(_to, _playerId) != 1) {
      revert NotOwnerOfPlayer();
    }

    uint[] memory ids = new uint[](5);
    uint[] memory amounts = new uint[](5);
    ids[0] = XP_BOOST; // 5x XP Boost
    amounts[0] = 5;
    ids[1] = SKILL_BOOST; // 3x Skill Boost
    amounts[1] = 3;
    ids[2] = COOKED_FEOLA; // 200x Cooked Feola
    amounts[2] = 200;
    ids[3] = SHADOW_SCROLL; // 300x Shadow Scrolls
    amounts[3] = 300;
    ids[4] = SECRET_EGG_2; // 1x Special Egg
    amounts[4] = 1;
    users[_to].starterPromotionClaimed = true;
    users[_to].redeemCodeStarterPromotion = bytes8(bytes(_redeemCode));

    itemNFT.mintBatch(_to, ids, amounts);
    emit PromotionRedeemed(_to, _playerId, Promotion.STARTER, _redeemCode, ids, amounts);
  }

  function testClearPromotionalPack(address _toClear) external isAdminAndBeta {
    delete users[_toClear];
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
