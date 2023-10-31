// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";
import {BitMaps} from "@openzeppelin/contracts/utils/structs/BitMaps.sol";
import {AdminAccess} from "./AdminAccess.sol";
import {ItemNFT} from "./ItemNFT.sol";
import {IPlayers} from "./interfaces/IPlayers.sol";
import {World} from "./World.sol";

import "./globals/items.sol";

contract Promotions is UUPSUpgradeable, OwnableUpgradeable {
  using BitMaps for BitMaps.BitMap;

  event PromotionRedeemed(
    address indexed to,
    uint playerId,
    Promotion promotion,
    string redeemCode,
    uint[] itemTokenIds,
    uint[] amounts
  );

  event PromotionAdded(PromotionInfo promotionInfo);
  event PromotionDeleted(Promotion promotion);

  error NotOwnerOfPlayer();
  error PromotionAlreadyClaimed();
  error InvalidRedeemCode();
  error NotPromotionalAdmin();
  error NotAdminAndBeta();
  error NotOwnerOfPlayerAndActive();
  error InvalidPromotion();
  error PromotionAlreadyAdded();
  error PlayerDoesNotQualify();
  error OracleNotCalled();
  error PromotionNotAdded();
  error MintingOutsideAvailableDate();

  struct User {
    bool starterPromotionClaimed;
    bytes8 redeemCodeStarterPromotion;
  }

  struct PromotionInfo {
    Promotion promotion;
    uint40 dateStart;
    uint40 dateEnd; // Exclusive
    uint16 minTotalXP; // Minimum level required to claim
    uint8 numItemsToPick; // Number of items to pick
    bool isRandom; // The selection is random
    uint16[] itemTokenIds; // Possible itemTokenIds
    uint32[] amounts;
  }

  enum Promotion {
    NONE,
    STARTER,
    HALLOWEEN_2023,
    HOLIDAY2, // Just have placeholders for now
    HOLIDAY3,
    HOLIDAY4,
    HOLIDAY5,
    HOLIDAY6,
    HOLIDAY7,
    HOLIDAY8,
    HOLIDAY9,
    HOLIDAY10
  }

  mapping(address user => User) public users;
  AdminAccess private adminAccess;
  ItemNFT private itemNFT;
  IERC1155 private playerNFT;
  bool private isBeta;
  mapping(uint playerId => BitMaps.BitMap) private playerPromotionsCompleted;
  mapping(Promotion promotion => PromotionInfo) public activePromotions;

  modifier isOwnerOfPlayerAndActive(uint _playerId) {
    if (!IPlayers(itemNFT.players()).isOwnerOfPlayerAndActive(msg.sender, _playerId)) {
      revert NotOwnerOfPlayerAndActive();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    AdminAccess _adminAccess,
    ItemNFT _itemNFT,
    IERC1155 _playerNFT,
    bool _isBeta
  ) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();

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

  function _checkMintPromotion(uint _playerId, Promotion _promotion) private view {
    PromotionInfo memory promotionInfo = activePromotions[_promotion];
    if (promotionInfo.dateStart > block.timestamp || promotionInfo.dateEnd <= block.timestamp) {
      revert MintingOutsideAvailableDate();
    }

    if (playerPromotionsCompleted[_playerId].get(uint(_promotion))) {
      revert PromotionAlreadyClaimed();
    }

    if (promotionInfo.minTotalXP > IPlayers(itemNFT.players()).totalXP(_playerId)) {
      revert PlayerDoesNotQualify();
    }
  }

  function mintPromotion(uint _playerId, Promotion _promotion) external isOwnerOfPlayerAndActive(_playerId) {
    _checkMintPromotion(_playerId, _promotion);

    // Mark the promotion as completed
    playerPromotionsCompleted[_playerId].set(uint(_promotion));

    PromotionInfo memory promotionInfo = activePromotions[_promotion];
    uint[] memory ids = new uint[](promotionInfo.numItemsToPick);
    uint[] memory amounts = new uint[](promotionInfo.numItemsToPick);

    if (promotionInfo.isRandom) {
      // Pick a random item from the list, only supports 1 item atm
      uint numAvailableItems = promotionInfo.itemTokenIds.length;
      World world = itemNFT.world();

      if (!world.hasRandomWord(block.timestamp - 1 days)) {
        revert OracleNotCalled();
      }

      uint randomWord = itemNFT.world().getRandomWord(block.timestamp - 1 days);
      uint modifiedRandomWord = uint(keccak256(abi.encodePacked(randomWord, _playerId)));
      uint index = modifiedRandomWord % numAvailableItems;
      ids[0] = promotionInfo.itemTokenIds[index];
      amounts[0] = promotionInfo.amounts[index];
    } else {
      // Give all items (TODO: Not implemented yet)
      assert(false);
    }

    if (ids.length != 0) {
      itemNFT.mintBatch(msg.sender, ids, amounts);
    }
    emit PromotionRedeemed(msg.sender, _playerId, _promotion, "", ids, amounts);
  }

  function hasCompletedPromotion(uint _playerId, Promotion _promotion) external view returns (bool) {
    return playerPromotionsCompleted[_playerId].get(uint(_promotion));
  }

  function testClearPromotionalPack(address _toClear) external isAdminAndBeta {
    delete users[_toClear];
  }

  function addPromotion(PromotionInfo calldata _promotionInfo) external onlyOwner {
    if (
      _promotionInfo.itemTokenIds.length == 0 || _promotionInfo.itemTokenIds.length != _promotionInfo.amounts.length
    ) {
      revert InvalidPromotion();
    }

    if (_promotionInfo.numItemsToPick > _promotionInfo.itemTokenIds.length) {
      revert InvalidPromotion();
    }

    if (_promotionInfo.numItemsToPick == 0) {
      revert InvalidPromotion();
    }

    if (_promotionInfo.dateStart >= _promotionInfo.dateEnd) {
      revert InvalidPromotion();
    }

    if (_promotionInfo.numItemsToPick != 1) {
      // TODO: Special handling for now, only allowing 1 item to be picked
      revert InvalidPromotion();
    }

    if (!_promotionInfo.isRandom) {
      // Special handling
      revert InvalidPromotion();
    }

    if (_promotionInfo.promotion == Promotion.NONE) {
      revert InvalidPromotion();
    }

    // Already added
    if (activePromotions[_promotionInfo.promotion].promotion != Promotion.NONE) {
      revert PromotionAlreadyAdded();
    }

    activePromotions[_promotionInfo.promotion] = _promotionInfo;

    emit PromotionAdded(_promotionInfo);
  }

  function removePromotion(Promotion _promotion) external onlyOwner {
    if (activePromotions[_promotion].promotion == Promotion.NONE) {
      revert PromotionNotAdded();
    }
    delete activePromotions[_promotion];
    emit PromotionDeleted(_promotion);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
