// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";
import {BitMaps} from "@openzeppelin/contracts/utils/structs/BitMaps.sol";
import {AdminAccess} from "./AdminAccess.sol";
import {ItemNFT} from "./ItemNFT.sol";
import {IPlayers} from "./interfaces/IPlayers.sol";
import {IBrushToken} from "./interfaces/IBrushToken.sol";
import {PlayerNFT} from "./PlayerNFT.sol";
import {World} from "./World.sol";

import "./globals/items.sol";
import "./globals/rewards.sol";

contract Promotions is UUPSUpgradeable, OwnableUpgradeable {
  using BitMaps for BitMaps.BitMap;

  event PromotionRedeemedV2(
    address indexed to,
    uint playerId,
    Promotion promotion,
    string redeemCode,
    uint[] itemTokenIds,
    uint[] amounts,
    uint multiDaySet
  );

  event AddPromotion(PromotionInfoInput promotionInfo);
  event EditPromotion(PromotionInfoInput promotionInfo);
  event RemovePromotion(Promotion promotion);
  event ClearPlayerPromotion(uint playerId, Promotion promotion);

  // For previous versions of the events
  event PromotionAdded(PromotionInfoV1 promotionInfo);
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
  error NotOwnerOfPlayerAndActive();
  error InvalidPromotion();
  error PromotionAlreadyAdded();
  error PlayerDoesNotQualify();
  error OracleNotCalled();
  error PromotionNotAdded();
  error MintingOutsideAvailableDate();
  error InvalidMultidayPromotionTimeInterval();
  error LengthMismatch();
  error InvalidStreakBonus();
  error PickingTooManyItems();
  error NoNumItemsToPick();
  error StartTimeMustBeHigherEndTime();
  error MultidaySpecified();
  error PromotionNotSet();
  error MustBeRandomPromotion();
  error NoItemsToPickFrom();
  error InvalidNumDaysHitNeededForStreakBonus();
  error PlayerNotHitEnoughClaims();
  error InvalidBrushCost();
  error PlayerNotEvolved();
  error NotEnoughBrush();

  struct User {
    bool starterPromotionClaimed;
    bytes8 redeemCodeStarterPromotion;
  }

  struct PromotionInfoInput {
    Promotion promotion;
    uint40 startTime;
    uint40 endTime; // Exclusive
    uint8 numItemsToPick; // Number of items to pick
    bool isRandom; // The selection is random
    uint64 minTotalXP; // Minimum xp required to claim
    bool evolvedHeroOnly; // Only allow evolved heroes to claim
    // Multiday specific
    bool isMultiday; // The promotion is multi-day
    uint8 numDaysHitNeededForStreakBonus; // How many days to hit for the streak bonus
    uint8 numDaysClaimablePeriodStreakBonus; // If there is a streak bonus, how many days to claim it after the promotion ends. If no final day bonus, set to 0
    bool isStreakBonusRandom; // If the final day bonus is random
    uint8 numStreakBonusItemsToPick; // Number of items to pick for the streak bonus
    uint brushCost; // Cost in brush to mint the promotion (in ether), max 16mil
    uint16[] streakBonusItemTokenIds;
    uint32[] streakBonusAmounts;
    uint16[] itemTokenIds; // Possible items for the promotions each day, if empty then they are handled in a specific way for the promotion like daily rewards
    uint32[] amounts; // Corresponding amounts to the itemTokenIds
  }

  struct PromotionInfo {
    Promotion promotion;
    uint40 startTime;
    uint40 endTime; // Exclusive
    uint8 numItemsToPick; // Number of items to pick
    bool isRandom; // The selection is random
    uint64 minTotalXP; // Minimum xp required to claim#
    bool evolvedHeroOnly; // Only allow evolved heroes to claim
    uint24 brushCost; // Cost in brush to mint the promotion (in ether), max 16mil
    // Multiday specific
    bool isMultiday; // The promotion is multi-day
    uint8 numDaysHitNeededForStreakBonus; // How many days to hit for the streak bonus
    uint8 numDaysClaimablePeriodStreakBonus; // If there is a streak bonus, how many days to claim it after the promotion ends. If no final day bonus, set to 0
    bool isStreakBonusRandom; // If the final day bonus is random
    uint8 numStreakBonusItemsToPick; // Number of items to pick for the streak bonus
    uint16[] streakBonusItemTokenIds;
    uint32[] streakBonusAmounts;
    uint16[] itemTokenIds; // Possible items for the promotions each day, if empty then they are handled in a specific way for the promotion like daily rewards
    uint32[] amounts; // Corresponding amounts to the itemTokenIds
  }

  struct PromotionInfoV1 {
    Promotion promotion;
    uint40 dateStart;
    uint40 dateEnd; // Exclusive
    uint16 minTotalXP; // Minimum level required to claim
    uint8 numItemsToPick; // Number of items to pick
    bool isRandom; // The selection is random
    uint16[] itemTokenIds; // Possible items for the promotions each day, if empty then they are handled in a specific way for the promotion like daily rewards
    uint32[] amounts; // Corresponding amounts to the itemTokenIds
  }

  enum Promotion {
    NONE,
    STARTER,
    HALLOWEEN_2023,
    XMAS_2023,
    HOLIDAY3, // Just have placeholders for now
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
  PlayerNFT private playerNFT;
  bool private isBeta;
  mapping(uint playerId => BitMaps.BitMap) private singlePlayerPromotionsCompleted;
  mapping(Promotion promotion => PromotionInfo) public activePromotions;
  mapping(uint playerId => mapping(Promotion promotion => uint8[32] daysCompleted))
    private multidayPlayerPromotionsCompleted; // Total 31 days (1 month), last one indicates if the final day bonus has been claimed

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
    PlayerNFT _playerNFT,
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

    uint[] memory itemTokenIds = new uint[](5);
    uint[] memory amounts = new uint[](5);
    itemTokenIds[0] = XP_BOOST; // 5x XP Boost
    amounts[0] = 5;
    itemTokenIds[1] = SKILL_BOOST; // 3x Skill Boost
    amounts[1] = 3;
    itemTokenIds[2] = COOKED_FEOLA; // 200x Cooked Feola
    amounts[2] = 200;
    itemTokenIds[3] = SHADOW_SCROLL; // 300x Shadow Scrolls
    amounts[3] = 300;
    itemTokenIds[4] = SECRET_EGG_2; // 1x Special Egg
    amounts[4] = 1;
    users[_to].starterPromotionClaimed = true;
    users[_to].redeemCodeStarterPromotion = bytes8(bytes(_redeemCode));

    itemNFT.mintBatch(_to, itemTokenIds, amounts);
    emit PromotionRedeemed(_to, _playerId, Promotion.STARTER, _redeemCode, itemTokenIds, amounts);
  }

  function mintPromotion(uint _playerId, Promotion _promotion) external isOwnerOfPlayerAndActive(_playerId) {
    (uint[] memory itemTokenIds, uint[] memory amounts, uint dayToSet) = mintPromotionView(_playerId, _promotion);

    // Check they have paid if this is a paid promotion
    PromotionInfo storage promotionInfo = activePromotions[_promotion];

    if (!hasClaimedAny(_playerId, _promotion)) {
      if (promotionInfo.brushCost > 0) {
        _pay(promotionInfo.brushCost * 1 ether);
      } else if (promotionInfo.evolvedHeroOnly && !IPlayers(itemNFT.players()).isPlayerUpgraded(_playerId)) {
        revert PlayerNotEvolved();
      }
    }

    if (promotionInfo.isMultiday) {
      multidayPlayerPromotionsCompleted[_playerId][_promotion][dayToSet] = 0xFF;
    } else {
      // Mark the promotion as completed
      singlePlayerPromotionsCompleted[_playerId].set(uint(_promotion));
    }

    if (itemTokenIds.length != 0) {
      itemNFT.mintBatch(msg.sender, itemTokenIds, amounts);
    }

    emit PromotionRedeemedV2(msg.sender, _playerId, _promotion, "", itemTokenIds, amounts, dayToSet);
  }

  function mintPromotionView(
    uint _playerId,
    Promotion _promotion
  ) public view returns (uint[] memory itemTokenIds, uint[] memory amounts, uint dayToSet) {
    PromotionInfo memory promotionInfo = activePromotions[_promotion];

    if (promotionInfo.isMultiday) {
      (itemTokenIds, amounts, dayToSet) = _handleMultidayPromotion(_playerId, _promotion);
    } else {
      _checkMintPromotion(_playerId, _promotion);

      itemTokenIds = new uint[](promotionInfo.numItemsToPick);
      amounts = new uint[](promotionInfo.numItemsToPick);

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
        itemTokenIds[0] = promotionInfo.itemTokenIds[index];
        amounts[0] = promotionInfo.amounts[index];
      } else {
        // Give all items (TODO: Not implemented yet)
        assert(false);
      }
    }
  }

  function _checkMintPromotion(uint _playerId, Promotion _promotion) private view {
    PromotionInfo memory promotionInfo = activePromotions[_promotion];
    if (promotionInfo.startTime > block.timestamp || promotionInfo.endTime <= block.timestamp) {
      revert MintingOutsideAvailableDate();
    }

    if (singlePlayerPromotionsCompleted[_playerId].get(uint(_promotion))) {
      revert PromotionAlreadyClaimed();
    }

    if (promotionInfo.minTotalXP > IPlayers(itemNFT.players()).totalXP(_playerId)) {
      revert PlayerDoesNotQualify();
    }
  }

  function _checkMultidayDailyMintPromotion(uint _playerId, Promotion _promotion) private view {
    PromotionInfo memory promotionInfo = activePromotions[_promotion];
    if (promotionInfo.startTime > block.timestamp || promotionInfo.endTime <= block.timestamp) {
      revert MintingOutsideAvailableDate();
    }

    // Have they minted today's promotion already?
    uint today = (block.timestamp - promotionInfo.startTime) / 1 days;
    if (multidayPlayerPromotionsCompleted[_playerId][_promotion][today] > 0) {
      revert PromotionAlreadyClaimed();
    }

    if (promotionInfo.minTotalXP > IPlayers(itemNFT.players()).totalXP(_playerId)) {
      revert PlayerDoesNotQualify();
    }
  }

  function _getTierReward(uint _playerId, World _world) private view returns (uint itemTokenId, uint amount) {
    // No items specified to choose from so pick a random daily item from the tier above
    uint totalXP = IPlayers(itemNFT.players()).totalXP(_playerId);
    uint playerTier;

    // Work out the tier
    if (totalXP >= TIER_5_DAILY_REWARD_START_XP) {
      playerTier = 5; // Can't go higher than 5 currently
    } else if (totalXP >= TIER_4_DAILY_REWARD_START_XP) {
      playerTier = 5;
    } else if (totalXP >= TIER_3_DAILY_REWARD_START_XP) {
      playerTier = 4;
    } else if (totalXP >= TIER_2_DAILY_REWARD_START_XP) {
      playerTier = 3;
    } else {
      playerTier = 2;
    }

    if (!_world.hasRandomWord(block.timestamp - 1 days)) {
      revert OracleNotCalled();
    }
    (itemTokenId, amount) = _world.getDailyReward(playerTier, _playerId);
  }

  // TODO: Only really supporting xmas 2023 so far with tiered rewards
  function _handleMultidayPromotion(
    uint _playerId,
    Promotion _promotion
  ) private view returns (uint[] memory itemTokenIds, uint[] memory amounts, uint dayToSet) {
    PromotionInfo memory promotionInfo = activePromotions[_promotion];
    if (block.timestamp < promotionInfo.startTime) {
      revert MintingOutsideAvailableDate();
    }

    uint today = (block.timestamp - promotionInfo.startTime) / 1 days;
    uint numPromotionDays = (promotionInfo.endTime - promotionInfo.startTime) / 1 days;
    World world = itemNFT.world();
    if (today < numPromotionDays) {
      itemTokenIds = new uint[](promotionInfo.numItemsToPick);
      amounts = new uint[](promotionInfo.numItemsToPick);

      _checkMultidayDailyMintPromotion(_playerId, _promotion);

      if (promotionInfo.itemTokenIds.length == 0) {
        (itemTokenIds[0], amounts[0]) = _getTierReward(_playerId, world);
      } else {
        // Not supported yet
        assert(false);
      }

      dayToSet = today;
    } else if (today - numPromotionDays < promotionInfo.numDaysClaimablePeriodStreakBonus) {
      // Check final day bonus hasn't been claimed and is within the claim period
      if (multidayPlayerPromotionsCompleted[_playerId][_promotion][31] > 0) {
        revert PromotionAlreadyClaimed();
      }

      // Have they actually claimed enough?
      uint totalClaimed;
      for (uint i; i < multidayPlayerPromotionsCompleted[_playerId][_promotion].length; ++i) {
        if (multidayPlayerPromotionsCompleted[_playerId][_promotion][i] > 0) {
          ++totalClaimed;
        }
      }

      if (totalClaimed < promotionInfo.numDaysHitNeededForStreakBonus) {
        revert PlayerNotHitEnoughClaims();
      }

      itemTokenIds = new uint[](promotionInfo.numStreakBonusItemsToPick);
      amounts = new uint[](promotionInfo.numStreakBonusItemsToPick);
      dayToSet = 31;

      // Mint the final day bonus
      if (promotionInfo.isStreakBonusRandom) {
        // Pick a random item from the list, only supports 1 item atm
        uint numAvailableItems = promotionInfo.streakBonusItemTokenIds.length;
        if (!world.hasRandomWord(promotionInfo.endTime - 1)) {
          revert OracleNotCalled();
        }

        // The streak bonus random reward should be based on the last day of the promotion
        uint randomWord = itemNFT.world().getRandomWord(promotionInfo.endTime - 1);
        uint modifiedRandomWord = uint(keccak256(abi.encodePacked(randomWord, _playerId)));
        uint index = modifiedRandomWord % numAvailableItems;
        itemTokenIds[0] = promotionInfo.streakBonusItemTokenIds[index];
        amounts[0] = promotionInfo.streakBonusAmounts[index];
      } else {
        // Give all items (TODO: Not implemented yet)
        assert(false);
      }
    } else {
      revert MintingOutsideAvailableDate();
    }
  }

  function _pay(uint _brushCost) private {
    // Pay
    IBrushToken brush = playerNFT.brush();
    // Send half to the pool
    if (!brush.transferFrom(msg.sender, playerNFT.pool(), _brushCost / 2)) {
      revert NotEnoughBrush();
    }
    // Send half to the dev address
    if (!brush.transferFrom(msg.sender, playerNFT.dev(), _brushCost / 2)) {
      revert NotEnoughBrush();
    }
  }

  // Takes into account the current day for multiday promotions unless outside the range in which case checks the final day bonus.
  function hasCompletedPromotion(uint _playerId, Promotion _promotion) external view returns (bool) {
    PromotionInfo memory promotionInfo = activePromotions[_promotion];
    if (promotionInfo.isMultiday) {
      if (block.timestamp < promotionInfo.startTime) {
        return false;
      }

      uint today = (block.timestamp - promotionInfo.startTime) / 1 days;
      uint numPromotionDays = (promotionInfo.endTime - promotionInfo.startTime) / 1 days;
      if (today <= numPromotionDays) {
        return multidayPlayerPromotionsCompleted[_playerId][_promotion][today] > 0;
      }

      return multidayPlayerPromotionsCompleted[_playerId][_promotion][31] > 0;
    }
    return singlePlayerPromotionsCompleted[_playerId].get(uint(_promotion));
  }

  function _checkAddingGenericPromotion(PromotionInfoInput calldata _promotionInfo) private pure {
    if (_promotionInfo.itemTokenIds.length != _promotionInfo.amounts.length) {
      revert LengthMismatch();
    }

    if (_promotionInfo.promotion == Promotion.NONE) {
      revert PromotionNotSet();
    }

    if (_promotionInfo.startTime > _promotionInfo.endTime) {
      revert StartTimeMustBeHigherEndTime();
    }

    if (_promotionInfo.numItemsToPick == 0) {
      revert NoNumItemsToPick();
    }

    if (_promotionInfo.numItemsToPick != 1) {
      // TODO: Special handling for now, only allowing 1 item to be picked
      revert InvalidPromotion();
    }

    if (!_promotionInfo.isRandom) {
      // Special handling
      revert MustBeRandomPromotion();
    }

    // Check brush input is valid
    if (_promotionInfo.brushCost % 1 ether != 0) {
      revert InvalidBrushCost();
    }
  }

  // Precondition that the promotion is multiday
  function _checkAddingMultidayMintPromotion(PromotionInfoInput calldata _promotionInfo) private pure {
    if (_promotionInfo.streakBonusItemTokenIds.length != _promotionInfo.streakBonusAmounts.length) {
      revert LengthMismatch();
    }

    bool hasStreakBonus = _promotionInfo.numDaysClaimablePeriodStreakBonus != 0;

    // start and endTime must be factors of 24 hours apart
    if ((_promotionInfo.endTime - _promotionInfo.startTime) % 1 days != 0) {
      revert InvalidMultidayPromotionTimeInterval();
    }

    if (hasStreakBonus) {
      if (
        _promotionInfo.numStreakBonusItemsToPick == 0 ||
        _promotionInfo.streakBonusItemTokenIds.length == 0 ||
        _promotionInfo.numDaysHitNeededForStreakBonus == 0
      ) {
        revert InvalidStreakBonus();
      }

      if (
        _promotionInfo.numDaysHitNeededForStreakBonus > ((_promotionInfo.endTime - _promotionInfo.startTime) / 1 days)
      ) {
        revert InvalidNumDaysHitNeededForStreakBonus();
      }

      if (!_promotionInfo.isStreakBonusRandom) {
        revert InvalidStreakBonus();
      }
    } else {
      // No streak bonus
      if (
        _promotionInfo.streakBonusItemTokenIds.length != 0 ||
        _promotionInfo.numStreakBonusItemsToPick != 0 ||
        _promotionInfo.numDaysHitNeededForStreakBonus != 0
      ) {
        revert InvalidStreakBonus();
      }

      if (_promotionInfo.isStreakBonusRandom) {
        revert InvalidStreakBonus();
      }
    }

    if (_promotionInfo.numStreakBonusItemsToPick > _promotionInfo.streakBonusItemTokenIds.length) {
      revert PickingTooManyItems();
    }
  }

  function _checkAddingSinglePromotion(PromotionInfoInput calldata _promotionInfo) private pure {
    // Should not have any multi-day promotion specific fields set
    if (
      _promotionInfo.numDaysHitNeededForStreakBonus != 0 ||
      _promotionInfo.numDaysClaimablePeriodStreakBonus != 0 ||
      _promotionInfo.isStreakBonusRandom ||
      _promotionInfo.numStreakBonusItemsToPick != 0 ||
      _promotionInfo.streakBonusItemTokenIds.length != 0 ||
      _promotionInfo.streakBonusAmounts.length != 0
    ) {
      revert MultidaySpecified();
    }

    if (_promotionInfo.itemTokenIds.length == 0) {
      revert NoItemsToPickFrom();
    }

    if (_promotionInfo.numItemsToPick > _promotionInfo.itemTokenIds.length) {
      revert PickingTooManyItems();
    }
  }

  function _packPromotionInfo(
    PromotionInfoInput calldata _promotionInfoInput
  ) private pure returns (PromotionInfo memory promotionInfo) {
    promotionInfo = PromotionInfo({
      promotion: _promotionInfoInput.promotion,
      startTime: _promotionInfoInput.startTime,
      endTime: _promotionInfoInput.endTime,
      numItemsToPick: _promotionInfoInput.numItemsToPick,
      isRandom: _promotionInfoInput.isRandom,
      minTotalXP: _promotionInfoInput.minTotalXP,
      evolvedHeroOnly: _promotionInfoInput.evolvedHeroOnly,
      brushCost: uint24(_promotionInfoInput.brushCost / 1 ether),
      isMultiday: _promotionInfoInput.isMultiday,
      numDaysHitNeededForStreakBonus: _promotionInfoInput.numDaysHitNeededForStreakBonus,
      numDaysClaimablePeriodStreakBonus: _promotionInfoInput.numDaysClaimablePeriodStreakBonus,
      numStreakBonusItemsToPick: _promotionInfoInput.numStreakBonusItemsToPick,
      isStreakBonusRandom: _promotionInfoInput.isStreakBonusRandom,
      streakBonusItemTokenIds: _promotionInfoInput.streakBonusItemTokenIds,
      streakBonusAmounts: _promotionInfoInput.streakBonusAmounts,
      itemTokenIds: _promotionInfoInput.itemTokenIds,
      amounts: _promotionInfoInput.amounts
    });
  }

  function testClearPromotionalPack(address _toClear) external isAdminAndBeta {
    delete users[_toClear];
  }

  function testClearPlayerPromotion(uint _playerId, Promotion _promotion) external isAdminAndBeta {
    singlePlayerPromotionsCompleted[_playerId].unset(uint(_promotion));
    delete multidayPlayerPromotionsCompleted[_playerId][_promotion];
    emit ClearPlayerPromotion(_playerId, _promotion);
  }

  function addPromotion(PromotionInfoInput calldata _promotionInfo) external onlyOwner {
    _checkAddingGenericPromotion(_promotionInfo);
    if (activePromotions[_promotionInfo.promotion].promotion != Promotion.NONE) {
      revert PromotionAlreadyAdded();
    }

    if (_promotionInfo.isMultiday) {
      _checkAddingMultidayMintPromotion(_promotionInfo);
    } else {
      _checkAddingSinglePromotion(_promotionInfo);
    }

    activePromotions[_promotionInfo.promotion] = _packPromotionInfo(_promotionInfo);
    emit AddPromotion(_promotionInfo);
  }

  function editPromotion(PromotionInfoInput calldata _promotionInfo) external onlyOwner {
    _checkAddingGenericPromotion(_promotionInfo);

    if (_promotionInfo.isMultiday) {
      _checkAddingMultidayMintPromotion(_promotionInfo);
    } else {
      _checkAddingSinglePromotion(_promotionInfo);
    }

    activePromotions[_promotionInfo.promotion] = _packPromotionInfo(_promotionInfo);
    emit EditPromotion(_promotionInfo);
  }

  function hasClaimedAny(uint _playerId, Promotion _promotion) public view returns (bool) {
    PromotionInfo storage promotionInfo = activePromotions[_promotion];
    if (promotionInfo.isMultiday) {
      bool anyClaimed;
      uint8[32] storage daysCompleted = multidayPlayerPromotionsCompleted[_playerId][_promotion];
      assembly ("memory-safe") {
        anyClaimed := not(eq(sload(daysCompleted.slot), 0))
      }
      return anyClaimed;
    }
    return singlePlayerPromotionsCompleted[_playerId].get(uint(_promotion));
  }

  function removePromotion(Promotion _promotion) external onlyOwner {
    if (activePromotions[_promotion].promotion == Promotion.NONE) {
      revert PromotionNotAdded();
    }
    delete activePromotions[_promotion];
    emit RemovePromotion(_promotion);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
