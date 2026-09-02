// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../globals/actions.sol";
import "../globals/clans.sol";
import "../globals/items.sol";
import "../globals/misc.sol";
import "../globals/pets.sol";
import "../globals/players.sol";
import "../globals/promotions.sol";
import "../globals/quests.sol";
import "../globals/rewards.sol";
import {AdminAccess} from "../AdminAccess.sol";
import {DailyRewardsScheduler} from "../DailyRewardsScheduler.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {RandomnessBeacon} from "../RandomnessBeacon.sol";
import {IPlayers} from "./IPlayers.sol";
import {IBrushToken} from "./external/IBrushToken.sol";

interface IPromotions {
  function FINAL_PROMOTION_DAY_INDEX() external view returns (uint256);
  function addPromotions(PromotionInfoInput[] calldata promotionInfoInput) external;
  function adminMintPromotionalPack(
    address to,
    uint256 playerId,
    string calldata redeemCode,
    Promotion promotion
  ) external;
  function editPromotions(PromotionInfoInput[] calldata promotionInfoInputs) external;
  function getActivePromotion(uint256 promotionId) external view returns (PromotionInfo memory);
  function getMultidayPlayerPromotionsCompleted(
    uint256 playerId,
    Promotion promotion,
    uint256 day
  ) external view returns (uint8);
  function hasClaimedAny(uint256 playerId, Promotion promotion) external view returns (bool);
  function hasCompletedPromotion(uint256 playerId, Promotion promotion) external view returns (bool);
  function initialize(
    IPlayers players,
    RandomnessBeacon randomnessBeacon,
    DailyRewardsScheduler dailyRewardsScheduler,
    ItemNFT itemNFT,
    address playerNFT,
    address quests,
    IBrushToken brush,
    address treasury,
    address dev,
    AdminAccess adminAccess,
    bool isBeta
  ) external;
  function mintPromotion(uint256 playerId, Promotion promotion) external;
  function mintPromotionView(
    uint256 playerId,
    Promotion promotion,
    uint256 timestamp
  )
    external
    view
    returns (
      uint256[] memory itemTokenIds,
      uint256[] memory amounts,
      uint256[] memory daysToSet,
      PromotionMintStatus promotionMintStatus
    );
  function mintPromotionViewNow(
    uint256 playerId,
    Promotion promotion
  )
    external
    view
    returns (
      uint256[] memory itemTokenIds,
      uint256[] memory amounts,
      uint256[] memory daysToSet,
      PromotionMintStatus promotionMintStatus
    );
  function mintStarterPromotionalPack(address to, uint256 playerId, string calldata redeemCode) external;
  function payMissedPromotionDays(uint256 playerId, Promotion promotion, uint256[] calldata missedDays) external;
  function removePromotions(Promotion[] calldata promotions) external;
  function setBrushDistributionPercentages(
    uint8 brushBurntPercentage,
    uint8 brushTreasuryPercentage,
    uint8 brushDevPercentage
  ) external;
  function setDevAddress(address dev) external;
  function testClearPlayerPromotions(uint256 playerId, Promotion[] calldata promotions) external;
  event AddPromotions(PromotionInfoInput[] promotionInfos);
  event ClearPlayerPromotions(uint256 playerId, Promotion[] promotions);
  event EditPromotions(PromotionInfoInput[] promotionInfos);
  event PromotionRedeemed(
    address indexed to,
    uint256 playerId,
    Promotion promotion,
    string redeemCode,
    uint256[] itemTokenIds,
    uint256[] amounts,
    uint256[] daysRedeemed,
    uint256 tokenCost
  );
  event RemovePromotions(Promotion[] promotions);
  event SetBrushDistributionPercentages(
    uint256 brushBurntPercentage,
    uint256 brushTreasuryPercentage,
    uint256 brushDevPercentage
  );
  error CannotPayForToday();
  error DaysArrayNotSortedOrDuplicates();
  error DependentQuestNotCompleted();
  error InvalidBrushCost();
  error InvalidPromotion();
  error InvalidRedeemCode();
  error MintingOutsideAvailableDate();
  error MustBeAdminOnlyPromotion();
  error NotAdminAndBeta();
  error NotEnoughBrush();
  error NotOwnerOfPlayer();
  error NotOwnerOfPlayerAndActive();
  error NotPromotionalAdmin();
  error OracleNotCalled();
  error PercentNotTotal100();
  error PlayerDoesNotQualify();
  error PlayerNotEvolved();
  error PlayerNotHitEnoughClaims();
  error PromotionAlreadyClaimed();
  error PromotionFinished();
  error PromotionNotAdded();
  error PromotionNotSet();
}
