import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {playersFixture} from "./Players/PlayersFixture";
import {ethers} from "hardhat";
import {Promotion} from "@paintswap/estfor-definitions/types";
import {requestAndFulfillRandomWords, timeTravel, timeTravel24Hours, timeTravelToNextCheckpoint} from "./utils";
import {
  TIER_2_DAILY_REWARD_START_XP,
  TIER_3_DAILY_REWARD_START_XP,
  TIER_4_DAILY_REWARD_START_XP,
  TIER_5_DAILY_REWARD_START_XP,
  TIER_6_DAILY_REWARD_START_XP,
  createPlayer
} from "../scripts/utils";
import {Block, parseEther} from "ethers";

type PromotionInfoInput = {
  promotion: Promotion;
  startTime: number;
  endTime: number; // Exclusive
  numDailyRandomItemsToPick: number; // Number of items to pick
  minTotalXP: number; // Minimum xp required to claim
  brushCost: bigint; // Cost in brush to start the promotion, max 16mil
  redeemCodeLength: number; // Length of the redeem code
  adminOnly: boolean; // Only admins can mint the promotion, like for 1kin (Not used yet)
  promotionTiedToUser: boolean; // If the promotion is tied to a user
  promotionTiedToPlayer: boolean; // If the promotion is tied to the player
  promotionMustOwnPlayer: boolean; // Must own the player to get the promotion
  // Evolution specific
  evolvedHeroOnly: boolean; // Only allow evolved heroes to claim
  // Multiday specific
  isMultiday: boolean; // The promotion is multi-day
  brushCostMissedDay: string; // Cost in brush to start the promotion, max 256
  numDaysHitNeededForStreakBonus: number; // How many days to hit for the streak bonus
  numDaysClaimablePeriodStreakBonus: number; // If there is a streak bonus, how many days to claim it after the promotion ends. If no final day bonus, set to 0
  numRandomStreakBonusItemsToPick1: number; // Number of items to pick for the streak bonus
  numRandomStreakBonusItemsToPick2: number; // Number of random items to pick for the streak bonus
  randomStreakBonusItemTokenIds1: number[];
  randomStreakBonusAmounts1: number[];
  randomStreakBonusItemTokenIds2: number[];
  randomStreakBonusAmounts2: number[];
  guaranteedStreakBonusItemTokenIds: number[];
  guaranteedStreakBonusAmounts: number[];
  // Single and multiday
  guaranteedItemTokenIds: number[]; // Guaranteed items for the promotions each day, if empty then they are handled in a specific way for the promotion like daily rewards
  guaranteedAmounts: number[]; // Corresponding amounts to the itemTokenIds
  randomItemTokenIds: number[]; // Possible items for the promotions each day, if empty then they are handled in a specific way for the promotion like daily rewards
  randomAmounts: number[]; // Corresponding amounts to the randomItemTokenIds
};

describe("Promotions", function () {
  const promotionFixture = async function () {
    const fixture = await loadFixture(playersFixture);
    await requestAndFulfillRandomWords(fixture.world, fixture.mockVRF);
    return {...fixture};
  };
  describe("1kin", function () {
    it("Only promotional admin can mint", async function () {
      const {promotions, alice, bob, playerId} = await loadFixture(playersFixture);

      const redeemCode = "1111111111111111";
      await expect(
        promotions.connect(bob).mintStarterPromotionalPack(alice.address, playerId, redeemCode)
      ).to.be.revertedWithCustomError(promotions, "NotPromotionalAdmin");
    });

    it("Starter promotional invalid mint redeem code", async function () {
      const {promotions, alice, playerId} = await loadFixture(playersFixture);
      await expect(
        promotions.mintStarterPromotionalPack(alice.address, playerId, "11231")
      ).to.be.revertedWithCustomError(promotions, "InvalidRedeemCode");
    });

    it("Must own the player", async function () {
      const {promotions, owner, playerId} = await loadFixture(playersFixture);

      const redeemCode = "1111111111111111";

      await expect(
        promotions.mintStarterPromotionalPack(owner.address, playerId, redeemCode)
      ).to.be.revertedWithCustomError(promotions, "NotOwnerOfPlayer");
    });

    it("Starter promotion mints", async function () {
      const {itemNFT, promotions, alice, playerId} = await loadFixture(playersFixture);

      const redeemCode = "1111111111111111";

      await promotions.mintStarterPromotionalPack(alice.address, playerId, redeemCode);
      await expect(
        promotions.mintStarterPromotionalPack(alice.address, playerId, redeemCode)
      ).to.be.revertedWithCustomError(promotions, "PromotionAlreadyClaimed");

      const balances = await itemNFT.balanceOfs(alice.address, [
        EstforConstants.XP_BOOST,
        EstforConstants.SKILL_BOOST,
        EstforConstants.COOKED_FEOLA,
        EstforConstants.SHADOW_SCROLL,
        EstforConstants.SECRET_EGG_2_TIER1
      ]);

      expect(balances).to.deep.eq([5, 3, 200, 300, 1]);
    });
  });

  async function getBasicSingleMintPromotion(): Promise<PromotionInfoInput> {
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    return {
      promotion: Promotion.HALLOWEEN_2023,
      startTime: NOW,
      endTime: NOW + 24 * 3600,
      minTotalXP: 0,
      evolvedHeroOnly: false,
      redeemCodeLength: 0,
      adminOnly: false,
      promotionTiedToUser: false,
      promotionTiedToPlayer: false,
      promotionMustOwnPlayer: false,
      numDailyRandomItemsToPick: 1,
      isMultiday: false,
      brushCostMissedDay: "0",
      numDaysClaimablePeriodStreakBonus: 0,
      numDaysHitNeededForStreakBonus: 0,
      numRandomStreakBonusItemsToPick1: 0,
      numRandomStreakBonusItemsToPick2: 0,
      brushCost: 0n,
      randomStreakBonusItemTokenIds1: [],
      randomStreakBonusAmounts1: [],
      randomStreakBonusItemTokenIds2: [],
      randomStreakBonusAmounts2: [],
      guaranteedStreakBonusItemTokenIds: [],
      guaranteedStreakBonusAmounts: [],
      guaranteedItemTokenIds: [],
      guaranteedAmounts: [],
      randomItemTokenIds: [
        EstforConstants.HALLOWEEN_BONUS_1,
        EstforConstants.HALLOWEEN_BONUS_2,
        EstforConstants.HALLOWEEN_BONUS_3
      ],
      randomAmounts: [1, 1, 1]
    };
  }

  describe("Generic", function () {
    it("Editing a promotion", async function () {
      const {promotions, alice} = await loadFixture(playersFixture);

      const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
      const promotion = await getBasicSingleMintPromotion();
      await promotions.addPromotion(promotion);

      const newStartTime = NOW - 24 * 3600;
      const editedPromotion = {
        ...promotion,
        startTime: newStartTime
      };

      // Only owner can edit
      await expect(promotions.connect(alice).editPromotion(editedPromotion)).to.be.revertedWithCustomError(
        promotions,
        "CallerIsNotOwner"
      );

      await expect(promotions.editPromotion(editedPromotion)).to.emit(promotions, "EditPromotion");

      const activePromotion = await promotions.activePromotions(promotion.promotion);
      expect(activePromotion.startTime).to.eq(newStartTime);
    });

    it("Removing a promotion", async function () {
      const {promotions, alice} = await loadFixture(playersFixture);
      const promotion = await getBasicSingleMintPromotion();
      await promotions.addPromotion(promotion);

      // Only owner can remove
      await expect(promotions.connect(alice).removePromotion(promotion.promotion)).to.be.revertedWithCustomError(
        promotions,
        "CallerIsNotOwner"
      );

      await expect(promotions.removePromotion(promotion.promotion)).to.emit(promotions, "RemovePromotion");

      const activePromotion = await promotions.activePromotions(promotion.promotion);
      expect(activePromotion.startTime).to.eq(0);
    });

    it("Evolved hero only promotion", async function () {
      const {promotions, playerId, playerNFT, brush, upgradePlayerBrushPrice, origName, alice} = await loadFixture(
        promotionFixture
      );
      let promotion = await getBasicSingleMintPromotion();
      promotion = {...promotion, evolvedHeroOnly: true};
      await promotions.addPromotion(promotion);
      await expect(
        promotions.connect(alice).mintPromotion(playerId, Promotion.HALLOWEEN_2023)
      ).to.be.revertedWithCustomError(promotions, "PlayerNotEvolved");

      // Evolve player
      await brush.mint(alice.address, upgradePlayerBrushPrice);
      await brush.connect(alice).approve(await playerNFT.getAddress(), upgradePlayerBrushPrice);
      const discord = "";
      const twitter = "";
      const telegram = "";
      await playerNFT.connect(alice).editPlayer(playerId, origName, discord, twitter, telegram, true);
      await promotions.connect(alice).mintPromotion(playerId, Promotion.HALLOWEEN_2023);
    });

    it("mintPromotionView status codes", async function () {
      const {promotions, playerId, alice} = await loadFixture(playersFixture);
      const promotionView = await promotions.connect(alice).mintPromotionViewNow(playerId, Promotion.HALLOWEEN_2023);
      expect(promotionView.promotionMintStatus).to.eq(EstforTypes.PromotionMintStatus.MINTING_OUTSIDE_AVAILABLE_DATE);
      // TODO: Check them all.
    });

    it("Check minting before and after 00:00 does not give a different daily reward (many)", async function () {});

    // This test might fail if called around 00:00
    it("If an event starts at 00:00 it can use previous day's oracle", async function () {
      const {promotions, playerId, alice, world, mockVRF} = await loadFixture(promotionFixture);

      // Go to the next 00:00
      const oneDay = 24 * 3600;
      let {timestamp: currentTimestamp} = (await ethers.provider.getBlock("latest")) as Block;
      let timestamp = Math.floor(currentTimestamp / oneDay) * oneDay + oneDay;
      let promotion = await getBasicSingleMintPromotion();
      promotion = {...promotion, startTime: timestamp, endTime: timestamp + oneDay};
      await timeTravelToNextCheckpoint();
      await requestAndFulfillRandomWords(world, mockVRF);
      await promotions.addPromotion(promotion);
      await promotions.connect(alice).mintPromotion(playerId, Promotion.HALLOWEEN_2023);
    });
  });

  describe("Holiday season promotion", function () {
    it("Cannot mint a non-existent promotion", async function () {
      const {promotions, playerId, alice} = await loadFixture(promotionFixture);
      await expect(
        promotions.connect(alice).mintPromotion(playerId, Promotion.HALLOWEEN_2023)
      ).to.be.revertedWithCustomError(promotions, "MintingOutsideAvailableDate");
    });

    it("Must own the player for promotions", async function () {
      const {promotions, playerId} = await loadFixture(promotionFixture);
      const promotion = await getBasicSingleMintPromotion();
      await promotions.addPromotion(promotion);
      await expect(promotions.mintPromotion(playerId, Promotion.HALLOWEEN_2023)).to.be.revertedWithCustomError(
        promotions,
        "NotOwnerOfPlayerAndActive"
      );
    });

    describe("Single mint promotion", function () {
      it("Random item mint", async function () {
        // Pick 1 out of 3 items (like halloween 2023)
        const {itemNFT, promotions, alice, playerId} = await loadFixture(promotionFixture);

        const promotion = await getBasicSingleMintPromotion();
        await promotions.addPromotion(promotion);
        await promotions.connect(alice).mintPromotion(playerId, Promotion.HALLOWEEN_2023);

        const balances = await itemNFT.balanceOfs(alice.address, [
          EstforConstants.HALLOWEEN_BONUS_1,
          EstforConstants.HALLOWEEN_BONUS_2,
          EstforConstants.HALLOWEEN_BONUS_3
        ]);

        expect(balances).to.deep.include(1n);
      });

      it("Random mint (many)", async function () {
        // Just tests that all masks are minted (halloween 2023 example)
        const {itemNFT, playerNFT, promotions, alice, playerId} = await loadFixture(promotionFixture);

        const promotion = await getBasicSingleMintPromotion();
        await promotions.addPromotion(promotion);

        for (let i = 0n; i < 25n; ++i) {
          await createPlayer(playerNFT, 1, alice, "name" + i, true);
          await promotions.connect(alice).mintPromotion(playerId + (i + 1n), Promotion.HALLOWEEN_2023);
        }

        expect(await itemNFT["totalSupply(uint256)"](EstforConstants.HALLOWEEN_BONUS_1)).to.be.gt(0n);
        expect(await itemNFT["totalSupply(uint256)"](EstforConstants.HALLOWEEN_BONUS_2)).to.be.gt(0n);
        expect(await itemNFT["totalSupply(uint256)"](EstforConstants.HALLOWEEN_BONUS_3)).to.be.gt(0n);
      });

      it("Minting before start date not allowed", async function () {
        const {promotions, alice, playerId} = await loadFixture(promotionFixture);

        const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;

        let promotion = await getBasicSingleMintPromotion();
        promotion = {...promotion, startTime: NOW + 50, endTime: NOW + 50 + 24 * 3600};
        await promotions.addPromotion(promotion);
        await expect(
          promotions.connect(alice).mintPromotion(playerId, Promotion.HALLOWEEN_2023)
        ).to.be.revertedWithCustomError(promotions, "MintingOutsideAvailableDate");
      });

      it("Minting after end date not allowed", async function () {
        const {promotions, alice, playerId} = await loadFixture(promotionFixture);

        const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
        let promotion = await getBasicSingleMintPromotion();
        promotion = {...promotion, startTime: NOW - 24 * 3600, endTime: NOW};
        await promotions.addPromotion(promotion);
        await expect(
          promotions.connect(alice).mintPromotion(playerId, Promotion.HALLOWEEN_2023)
        ).to.be.revertedWithCustomError(promotions, "MintingOutsideAvailableDate");
      });

      it("Must have the minimum required XP", async function () {
        const {promotions, alice, players, playerId} = await loadFixture(promotionFixture);

        let promotion = await getBasicSingleMintPromotion();
        promotion = {...promotion, minTotalXP: 10000};
        await promotions.addPromotion(promotion);
        await expect(
          promotions.connect(alice).mintPromotion(playerId, Promotion.HALLOWEEN_2023)
        ).to.be.revertedWithCustomError(promotions, "PlayerDoesNotQualify");

        await players.testModifyXP(alice.address, playerId, EstforTypes.Skill.FIREMAKING, 100000, false);
        await promotions.connect(alice).mintPromotion(playerId, Promotion.HALLOWEEN_2023);
      });

      it("Cannot mint if oracle has not been called for previous day", async function () {
        const {promotions, playerId, alice} = await loadFixture(playersFixture);
        let promotion = await getBasicSingleMintPromotion();
        promotion = {...promotion, endTime: promotion.startTime + 3600 * 24 * 2};

        await timeTravel24Hours();
        await promotions.addPromotion(promotion);
        await expect(
          promotions.connect(alice).mintPromotion(playerId, Promotion.HALLOWEEN_2023)
        ).to.be.revertedWithCustomError(promotions, "OracleNotCalled");
      });

      it("Cannot mint twice", async function () {
        const {promotions, playerId, alice} = await loadFixture(promotionFixture);

        const promotion = await getBasicSingleMintPromotion();
        await promotions.addPromotion(promotion);
        await promotions.connect(alice).mintPromotion(playerId, Promotion.HALLOWEEN_2023);
        await expect(
          promotions.connect(alice).mintPromotion(playerId, Promotion.HALLOWEEN_2023)
        ).to.be.revertedWithCustomError(promotions, "PromotionAlreadyClaimed");
      });

      it("Brush cost to enter promotion", async function () {
        const {promotions, playerId, brush, alice, shop, dev, world, mockVRF} = await loadFixture(playersFixture);
        let promotion = await getBasicSingleMintPromotion();
        promotion = {...promotion, brushCost: parseEther("1")};
        await promotions.addPromotion(promotion);
        await requestAndFulfillRandomWords(world, mockVRF);
        await brush.connect(alice).approve(await promotions.getAddress(), parseEther("1"));
        await expect(
          promotions.connect(alice).mintPromotion(playerId, Promotion.HALLOWEEN_2023)
        ).to.be.revertedWithCustomError(brush, "ERC20InsufficientBalance");

        await brush.mint(alice.address, parseEther("1"));
        await promotions.connect(alice).mintPromotion(playerId, Promotion.HALLOWEEN_2023);

        expect(await brush.balanceOf(alice.address)).to.eq(0);
        expect(await brush.balanceOf(await shop.getAddress())).to.eq(parseEther("0.5"));
        expect(await brush.balanceOf(dev.address)).to.eq(parseEther("0.5"));
      });
    });
  });

  describe("Multi-day with streak bonus holiday promotion", async function () {
    async function getBasicMultidayMintPromotion(): Promise<PromotionInfoInput> {
      const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;

      return {
        promotion: Promotion.XMAS_2023,
        startTime: NOW,
        endTime: NOW + 24 * 3600,
        minTotalXP: 0,
        evolvedHeroOnly: false,
        redeemCodeLength: 0,
        adminOnly: false,
        promotionTiedToUser: false,
        promotionTiedToPlayer: false,
        promotionMustOwnPlayer: false,
        numDailyRandomItemsToPick: 1,
        isMultiday: true,
        brushCostMissedDay: "0",
        brushCost: 0n,
        numDaysClaimablePeriodStreakBonus: 0,
        numDaysHitNeededForStreakBonus: 0,
        numRandomStreakBonusItemsToPick1: 0,
        numRandomStreakBonusItemsToPick2: 0,
        randomStreakBonusItemTokenIds1: [],
        randomStreakBonusAmounts1: [],
        randomStreakBonusItemTokenIds2: [],
        randomStreakBonusAmounts2: [],
        guaranteedStreakBonusItemTokenIds: [],
        guaranteedStreakBonusAmounts: [],
        guaranteedItemTokenIds: [],
        guaranteedAmounts: [],
        randomItemTokenIds: [],
        randomAmounts: []
      };
    }

    it("End time must be a multiple of days", async function () {
      const {promotions, promotionsLibrary} = await loadFixture(promotionFixture);
      let promotion = await getBasicMultidayMintPromotion();
      promotion = {...promotion, endTime: promotion.startTime + 1000};
      await expect(promotions.addPromotion(promotion)).to.be.revertedWithCustomError(
        promotionsLibrary,
        "InvalidMultidayPromotionTimeInterval"
      );
    });

    describe("Paying for missed days", function () {
      it("Pay for 1 missed day", async function () {
        const {playerId, promotions, brush, alice, world, mockVRF} = await loadFixture(promotionFixture);

        const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
        let promotion = await getBasicMultidayMintPromotion();
        promotion = {
          ...promotion,
          endTime: NOW + 3 * 24 * 3600,
          brushCostMissedDay: parseEther("10").toString()
        };

        await promotions.addPromotion(promotion);

        await brush.connect(alice).approve(await promotions.getAddress(), parseEther("20"));
        await brush.mint(alice.address, parseEther("20"));

        // Miss a day
        await ethers.provider.send("evm_increaseTime", [3600 * 24]);
        await ethers.provider.send("evm_mine", []);
        await requestAndFulfillRandomWords(world, mockVRF);

        const mintView = await promotions.mintPromotionViewNow(playerId, promotion.promotion);
        expect(mintView.daysToSet[0]).to.eq(1);

        expect(await brush.balanceOf(alice.address)).to.eq(parseEther("20"));
        await promotions.connect(alice).payMissedPromotionDays(playerId, promotion.promotion, [0]);
        expect(await brush.balanceOf(alice.address)).to.eq(parseEther("10"));
      });

      it("Pay for multiple missed days", async function () {
        const {playerId, promotions, brush, alice, world, mockVRF} = await loadFixture(promotionFixture);

        const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
        let promotion = await getBasicMultidayMintPromotion();
        promotion = {
          ...promotion,
          endTime: NOW + 4 * 24 * 3600,
          brushCostMissedDay: parseEther("10").toString()
        };
        await promotions.addPromotion(promotion);

        await brush.connect(alice).approve(await promotions.getAddress(), parseEther("10") * 2n);
        await brush.mint(alice.address, parseEther("10") * 2n);

        // Miss a couple days
        await timeTravel(3600 * 24 * 3);
        await requestAndFulfillRandomWords(world, mockVRF);
        await requestAndFulfillRandomWords(world, mockVRF);
        await requestAndFulfillRandomWords(world, mockVRF);

        const mintView = await promotions.mintPromotionViewNow(playerId, promotion.promotion);
        expect(mintView.daysToSet[0]).to.eq(3);

        await promotions.connect(alice).payMissedPromotionDays(playerId, promotion.promotion, [0, 2]);
        expect(await brush.balanceOf(alice.address)).to.eq(0);

        expect(await promotions.multidayPlayerPromotionsCompleted(playerId, promotion.promotion, 0)).to.eq(0xff);
        expect(await promotions.multidayPlayerPromotionsCompleted(playerId, promotion.promotion, 1)).to.eq(0);
        expect(await promotions.multidayPlayerPromotionsCompleted(playerId, promotion.promotion, 2)).to.eq(0xff);
      });

      it("Paying for a previous day should use a different random word (give different rewards)", async function () {
        const {playerId, promotions, brush, alice, world, mockVRF, itemNFT} = await loadFixture(promotionFixture);

        const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
        let promotion = await getBasicMultidayMintPromotion();
        promotion = {
          ...promotion,
          endTime: NOW + 10 * 24 * 3600,
          brushCostMissedDay: parseEther("10").toString()
        };
        await promotions.addPromotion(promotion);

        await brush.connect(alice).approve(await promotions.getAddress(), parseEther("10") * 10n);
        await brush.mint(alice.address, parseEther("10") * 10n);

        await world.setDailyRewardPool(2, [
          {itemTokenId: EstforConstants.IRON_ARROW, amount: 10},
          {itemTokenId: EstforConstants.ADAMANTINE_ARROW, amount: 10}
        ]);

        await ethers.provider.send("evm_increaseTime", [3600 * 24 * 9]);
        await ethers.provider.send("evm_mine", []);
        await requestAndFulfillRandomWords(world, mockVRF);
        await requestAndFulfillRandomWords(world, mockVRF);
        await requestAndFulfillRandomWords(world, mockVRF);
        await requestAndFulfillRandomWords(world, mockVRF);
        await requestAndFulfillRandomWords(world, mockVRF);
        await requestAndFulfillRandomWords(world, mockVRF);
        await requestAndFulfillRandomWords(world, mockVRF);
        await requestAndFulfillRandomWords(world, mockVRF);
        await requestAndFulfillRandomWords(world, mockVRF);

        const mintView = await promotions.mintPromotionViewNow(playerId, promotion.promotion);
        expect(mintView.daysToSet[0]).to.eq(9);

        // Mint the current one
        await promotions.connect(alice).mintPromotion(playerId, promotion.promotion);
        await promotions.connect(alice).payMissedPromotionDays(playerId, promotion.promotion, [0, 1, 2, 3, 4, 5, 6, 7]);

        expect(await itemNFT.balanceOf(alice.address, EstforConstants.IRON_ARROW)).to.be.gt(0);
        expect(await itemNFT.balanceOf(alice.address, EstforConstants.ADAMANTINE_ARROW)).to.be.gt(0);
      });

      it("Check payees", async function () {
        // TODO, balanceOf of pool, dev, burn etc
      });

      it("Cannot pay for today if it is claimable", async function () {
        const {playerId, promotions, brush, alice} = await loadFixture(promotionFixture);

        const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
        let promotion = await getBasicMultidayMintPromotion();
        promotion = {
          ...promotion,
          endTime: NOW + 3 * 24 * 3600,
          brushCostMissedDay: parseEther("10").toString()
        };
        await promotions.addPromotion(promotion);

        await brush.connect(alice).approve(await promotions.getAddress(), promotion.brushCostMissedDay);
        await brush.mint(alice.address, promotion.brushCostMissedDay);

        const mintView = await promotions.mintPromotionViewNow(playerId, promotion.promotion);
        expect(mintView.daysToSet[0]).to.eq(0);

        await expect(
          promotions.connect(alice).payMissedPromotionDays(playerId, promotion.promotion, [0])
        ).to.be.revertedWithCustomError(promotions, "CannotPayForToday");
      });

      it("Cannot have duplicates or unsorted in the days array", async function () {
        const {playerId, promotions, brush, alice, world, mockVRF} = await loadFixture(promotionFixture);
        const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
        let promotion = await getBasicMultidayMintPromotion();
        promotion = {
          ...promotion,
          endTime: NOW + 3 * 24 * 3600,
          brushCostMissedDay: parseEther("10").toString()
        };
        await promotions.addPromotion(promotion);

        await brush.connect(alice).approve(await promotions.getAddress(), parseEther("20"));
        await brush.mint(alice.address, parseEther("20"));

        const mintView = await promotions.mintPromotionViewNow(playerId, promotion.promotion);
        expect(mintView.daysToSet[0]).to.eq(0);

        // Miss a day
        await timeTravel(3600 * 24 * 2);
        await requestAndFulfillRandomWords(world, mockVRF);
        await requestAndFulfillRandomWords(world, mockVRF);

        await expect(
          promotions.connect(alice).payMissedPromotionDays(playerId, promotion.promotion, [0, 0])
        ).to.be.revertedWithCustomError(promotions, "DaysArrayNotSortedOrDuplicates");
        await expect(
          promotions.connect(alice).payMissedPromotionDays(playerId, promotion.promotion, [1, 0])
        ).to.be.revertedWithCustomError(promotions, "DaysArrayNotSortedOrDuplicates");
        await promotions.connect(alice).payMissedPromotionDays(playerId, promotion.promotion, [0, 1]);
      });

      it("Cannot pay after the entire streak bonus deadline has passed", async function () {
        const {playerId, promotions, brush, alice, world, mockVRF} = await loadFixture(promotionFixture);
        let promotion = await getBasicMultidayMintPromotion();
        promotion = {
          ...promotion,
          brushCostMissedDay: parseEther("10").toString()
        };
        await promotions.addPromotion(promotion);

        await brush.connect(alice).approve(await promotions.getAddress(), promotion.brushCostMissedDay);
        await brush.mint(alice.address, promotion.brushCostMissedDay);

        await ethers.provider.send("evm_increaseTime", [3600 * 24 * 2]);
        await ethers.provider.send("evm_mine", []);
        await requestAndFulfillRandomWords(world, mockVRF);
        await requestAndFulfillRandomWords(world, mockVRF);
        await expect(
          promotions.connect(alice).payMissedPromotionDays(playerId, promotion.promotion, [0])
        ).to.be.revertedWithCustomError(promotions, "PromotionFinished");
      });

      it("Cannot pay in the future", async function () {
        const {playerId, promotions, brush, alice, world, mockVRF} = await loadFixture(promotionFixture);

        const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
        let promotion = await getBasicMultidayMintPromotion();
        promotion = {
          ...promotion,
          endTime: NOW + 3 * 24 * 3600,
          brushCostMissedDay: parseEther("10").toString()
        };
        await promotions.addPromotion(promotion);

        await brush.connect(alice).approve(await promotions.getAddress(), promotion.brushCostMissedDay);
        await brush.mint(alice.address, promotion.brushCostMissedDay);

        const mintView = await promotions.mintPromotionViewNow(playerId, promotion.promotion);
        expect(mintView.daysToSet[0]).to.eq(0);

        await expect(
          promotions.connect(alice).payMissedPromotionDays(playerId, promotion.promotion, [1])
        ).to.be.revertedWithCustomError(promotions, "OracleNotCalled");
      });
    });

    it("Check tiered minting is working correctly based on XP", async function () {
      const {promotions, alice, playerId, players, itemNFT, world, mockVRF} = await loadFixture(promotionFixture);

      const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
      let promotion = await getBasicMultidayMintPromotion();
      promotion = {...promotion, startTime: NOW, endTime: NOW + 7 * 24 * 3600};
      await promotions.addPromotion(promotion);

      await players.setDailyRewardsEnabled(true);
      await world.setDailyRewardPool(1, [{itemTokenId: EstforConstants.BRONZE_ARROW, amount: 10}]);
      await world.setDailyRewardPool(2, [{itemTokenId: EstforConstants.IRON_ARROW, amount: 10}]);
      await world.setDailyRewardPool(3, [{itemTokenId: EstforConstants.MITHRIL_ARROW, amount: 10}]);
      await world.setDailyRewardPool(4, [{itemTokenId: EstforConstants.ADAMANTINE_ARROW, amount: 10}]);
      await world.setDailyRewardPool(5, [{itemTokenId: EstforConstants.RUNITE_ARROW, amount: 10}]);

      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(world, mockVRF);
      await promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023);

      expect(await itemNFT.balanceOf(alice.address, EstforConstants.IRON_ARROW)).to.eq(10);

      await players.testModifyXP(
        alice.address,
        playerId,
        EstforTypes.Skill.FIREMAKING,
        TIER_2_DAILY_REWARD_START_XP,
        false
      );
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(world, mockVRF);
      await promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.MITHRIL_ARROW)).to.eq(10);

      await players.testModifyXP(
        alice.address,
        playerId,
        EstforTypes.Skill.FIREMAKING,
        TIER_3_DAILY_REWARD_START_XP,
        false
      );
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(world, mockVRF);
      await promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.ADAMANTINE_ARROW)).to.eq(10);

      await players.testModifyXP(
        alice.address,
        playerId,
        EstforTypes.Skill.FIREMAKING,
        TIER_4_DAILY_REWARD_START_XP,
        false
      );
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(world, mockVRF);
      await promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.RUNITE_ARROW)).to.eq(10);

      await players.testModifyXP(
        alice.address,
        playerId,
        EstforTypes.Skill.FIREMAKING,
        TIER_5_DAILY_REWARD_START_XP,
        false
      );
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(world, mockVRF);
      await promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.RUNITE_ARROW)).to.eq(20);

      await players.testModifyXP(
        alice.address,
        playerId,
        EstforTypes.Skill.FIREMAKING,
        TIER_6_DAILY_REWARD_START_XP,
        false
      );
      // Just get more of runite for now
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(world, mockVRF);
      await promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023);
      expect(await itemNFT.balanceOf(alice.address, EstforConstants.RUNITE_ARROW)).to.eq(30);
    });

    it("Minting before start date not allowed", async function () {
      const {promotions, alice, playerId} = await loadFixture(promotionFixture);

      const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;

      let promotion = await getBasicMultidayMintPromotion();
      promotion = {...promotion, startTime: NOW + 50, endTime: NOW + 50 + 7 * 24 * 3600};
      await promotions.addPromotion(promotion);

      await expect(
        promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023)
      ).to.be.revertedWithCustomError(promotions, "MintingOutsideAvailableDate");
    });

    it("Minting after end date + num days streak bonus is not allowed", async function () {
      const {promotions, alice, playerId} = await loadFixture(promotionFixture);

      const promotion = await getBasicMultidayMintPromotion();
      await promotions.addPromotion(promotion);
      await ethers.provider.send("evm_increaseTime", [2 * 3600 * 24 + 1]);
      await ethers.provider.send("evm_mine", []);
      await expect(
        promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023)
      ).to.be.revertedWithCustomError(promotions, "MintingOutsideAvailableDate");
    });

    it("Must have the minimum required XP", async function () {
      const {promotions, alice, players, playerId} = await loadFixture(promotionFixture);

      let promotion = await getBasicMultidayMintPromotion();
      promotion = {...promotion, minTotalXP: 10000};
      await promotions.addPromotion(promotion);
      await expect(
        promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023)
      ).to.be.revertedWithCustomError(promotions, "PlayerDoesNotQualify");

      await players.testModifyXP(alice.address, playerId, EstforTypes.Skill.FIREMAKING, 100000, false);
      await promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023);
    });

    it("Cannot mint if oracle has not been called for previous day", async function () {
      const {promotions, playerId, alice} = await loadFixture(promotionFixture);

      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine", []);

      const promotion = await getBasicMultidayMintPromotion();
      await promotions.addPromotion(promotion);
      await expect(
        promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023)
      ).to.be.revertedWithCustomError(promotions, "OracleNotCalled");
    });

    it("Cannot mint twice", async function () {
      const {promotions, playerId, alice} = await loadFixture(promotionFixture);
      const promotion = await getBasicMultidayMintPromotion();
      await promotions.addPromotion(promotion);
      await promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023);
      await expect(
        promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023)
      ).to.be.revertedWithCustomError(promotions, "PromotionAlreadyClaimed");
    });

    describe("Streak inputs", function () {
      async function getOriginalPromotion(): Promise<PromotionInfoInput> {
        const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
        return {
          promotion: Promotion.XMAS_2023,
          startTime: NOW,
          endTime: NOW + 24 * 3600,
          minTotalXP: 0,
          evolvedHeroOnly: false,
          redeemCodeLength: 0,
          adminOnly: false,
          promotionTiedToUser: false,
          promotionTiedToPlayer: false,
          promotionMustOwnPlayer: false,
          numDailyRandomItemsToPick: 1,
          isMultiday: true,
          brushCostMissedDay: "0",
          brushCost: 0n,
          numDaysClaimablePeriodStreakBonus: 1,
          numDaysHitNeededForStreakBonus: 1,
          numRandomStreakBonusItemsToPick1: 1,
          numRandomStreakBonusItemsToPick2: 0,
          randomStreakBonusItemTokenIds1: [
            EstforConstants.HALLOWEEN_BONUS_1,
            EstforConstants.HALLOWEEN_BONUS_2,
            EstforConstants.HALLOWEEN_BONUS_3
          ],
          randomStreakBonusAmounts1: [1, 1, 1],
          randomStreakBonusItemTokenIds2: [],
          randomStreakBonusAmounts2: [],
          guaranteedStreakBonusItemTokenIds: [],
          guaranteedStreakBonusAmounts: [],
          guaranteedItemTokenIds: [],
          guaranteedAmounts: [],
          randomItemTokenIds: [],
          randomAmounts: []
        };
      }

      it("Check streak bonus inputs when numDaysClaimablePeriodStreakBonus=0", async function () {
        const {promotions, promotionsLibrary} = await loadFixture(promotionFixture);

        let promotion = {...(await getOriginalPromotion())};
        promotion.numDaysClaimablePeriodStreakBonus = 0;
        await expect(promotions.addPromotion(promotion)).to.be.revertedWithCustomError(
          promotionsLibrary,
          "InvalidStreakBonus"
        );

        promotion.numDaysHitNeededForStreakBonus = 0;
        await expect(promotions.addPromotion(promotion)).to.be.revertedWithCustomError(
          promotionsLibrary,
          "InvalidStreakBonus"
        );

        promotion.numRandomStreakBonusItemsToPick1 = 0;
        await expect(promotions.addPromotion(promotion)).to.be.revertedWithCustomError(
          promotionsLibrary,
          "InvalidStreakBonus"
        );

        // Works
        promotion.randomStreakBonusItemTokenIds1 = [];
        promotion.randomStreakBonusAmounts1 = [];
        await promotions.addPromotion(promotion);
        await promotions.removePromotion(Promotion.XMAS_2023);

        promotion = {...(await getOriginalPromotion())};

        // Wrong itemTokenIds length
        promotion.randomStreakBonusItemTokenIds1 = [EstforConstants.HALLOWEEN_BONUS_1];
        await expect(promotions.addPromotion(promotion)).to.be.revertedWithCustomError(
          promotionsLibrary,
          "LengthMismatch"
        );
        // reset those
        promotion.randomStreakBonusItemTokenIds1 = [
          EstforConstants.HALLOWEEN_BONUS_1,
          EstforConstants.HALLOWEEN_BONUS_2,
          EstforConstants.HALLOWEEN_BONUS_3
        ];
      });

      it("Check streak bonus inputs when isMultiday=false", async function () {
        const {promotions, promotionsLibrary} = await loadFixture(promotionFixture);

        const promotion = {...(await getOriginalPromotion())};
        // isMultiday is false so none of the multiday ones should be set, like previously
        promotion.isMultiday = false;
        promotion.numDaysClaimablePeriodStreakBonus = 0;
        promotion.numDaysHitNeededForStreakBonus = 0;
        promotion.numRandomStreakBonusItemsToPick1 = 0;
        await expect(promotions.addPromotion(promotion)).to.be.revertedWithCustomError(
          promotionsLibrary,
          "MultidaySpecified"
        );
        promotion.randomStreakBonusItemTokenIds1 = [];
        promotion.randomStreakBonusAmounts1 = [];
        await expect(promotions.addPromotion(promotion)).to.be.revertedWithCustomError(
          promotionsLibrary,
          "NoItemsToPickFrom"
        );
      });

      it("Check streak rewards are randomized", async function () {
        const {promotions, playerNFT, players, itemNFT, alice, playerId, world, mockVRF} = await loadFixture(
          promotionFixture
        );

        const promotion = {...(await getOriginalPromotion())};
        promotion.isMultiday = true;
        promotion.numDaysClaimablePeriodStreakBonus = 1;
        promotion.numDaysHitNeededForStreakBonus = 1;
        promotion.numRandomStreakBonusItemsToPick1 = 1;
        promotion.randomStreakBonusItemTokenIds1 = [
          EstforConstants.SECRET_EGG_3_TIER1,
          EstforConstants.SECRET_EGG_4_TIER1
        ];
        promotion.randomStreakBonusAmounts1 = [1, 1];
        promotion.promotionTiedToPlayer = false;
        promotion.promotionTiedToUser = false;
        await promotions.addPromotion(promotion);

        for (let i = 0n; i < 25n; ++i) {
          await createPlayer(playerNFT, 1, alice, "name" + i, true);
          await promotions.connect(alice).mintPromotion(playerId + (i + 1n), Promotion.XMAS_2023);
        }

        // increase time 1 day
        await ethers.provider.send("evm_increaseTime", [3600 * 24]);
        await ethers.provider.send("evm_mine", []);
        await requestAndFulfillRandomWords(world, mockVRF);

        // mint the streak bonus
        for (let i = 0n; i < 25n; ++i) {
          await players.connect(alice).setActivePlayer(playerId + (i + 1n));
          await promotions.connect(alice).mintPromotion(playerId + (i + 1n), Promotion.XMAS_2023);
        }

        expect(await itemNFT["totalSupply(uint256)"](EstforConstants.SECRET_EGG_3_TIER1)).to.be.gt(0n);
        expect(await itemNFT["totalSupply(uint256)"](EstforConstants.SECRET_EGG_4_TIER1)).to.be.gt(0n);
      });

      it("Check streak bonus inputs when isMultiday=true", async function () {
        const {promotions, promotionsLibrary} = await loadFixture(promotionFixture);

        const promotion = {...(await getOriginalPromotion())};

        promotion.numDaysHitNeededForStreakBonus = 0;
        await expect(promotions.addPromotion(promotion)).to.be.revertedWithCustomError(
          promotionsLibrary,
          "InvalidStreakBonus"
        );

        promotion.numDaysHitNeededForStreakBonus = 1;
        promotion.numRandomStreakBonusItemsToPick1 = 0;
        await expect(promotions.addPromotion(promotion)).to.be.revertedWithCustomError(
          promotionsLibrary,
          "InvalidStreakBonus"
        );

        promotion.numRandomStreakBonusItemsToPick1 = 1;
        promotion.randomStreakBonusItemTokenIds1 = [];
        promotion.randomStreakBonusAmounts1 = [];

        await expect(promotions.addPromotion(promotion)).to.be.revertedWithCustomError(
          promotionsLibrary,
          "InvalidStreakBonus"
        );

        promotion.randomStreakBonusItemTokenIds1 = (await getOriginalPromotion()).randomStreakBonusItemTokenIds1;
        promotion.randomStreakBonusAmounts1 = (await getOriginalPromotion()).randomStreakBonusAmounts1;
        await promotions.addPromotion(promotion);
      });
    });

    describe("Streak bonus", function () {
      async function getStreakBonusPromotion(): Promise<PromotionInfoInput> {
        const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
        return {
          promotion: Promotion.XMAS_2023,
          startTime: NOW,
          endTime: NOW + 24 * 3600 * 3, // 3 days
          minTotalXP: 0,
          evolvedHeroOnly: false,
          redeemCodeLength: 0,
          adminOnly: false,
          promotionTiedToUser: false,
          promotionTiedToPlayer: false,
          promotionMustOwnPlayer: false,
          numDailyRandomItemsToPick: 1,
          isMultiday: true,
          brushCostMissedDay: "0",
          brushCost: 0n,
          numDaysClaimablePeriodStreakBonus: 1,
          numDaysHitNeededForStreakBonus: 2,
          numRandomStreakBonusItemsToPick1: 1,
          numRandomStreakBonusItemsToPick2: 0,
          randomStreakBonusItemTokenIds1: [
            EstforConstants.HALLOWEEN_BONUS_1,
            EstforConstants.HALLOWEEN_BONUS_2,
            EstforConstants.HALLOWEEN_BONUS_3
          ],
          randomStreakBonusAmounts1: [1, 1, 1],
          randomStreakBonusItemTokenIds2: [],
          randomStreakBonusAmounts2: [],
          guaranteedStreakBonusItemTokenIds: [],
          guaranteedStreakBonusAmounts: [],
          guaranteedItemTokenIds: [],
          guaranteedAmounts: [],
          randomItemTokenIds: [],
          randomAmounts: []
        };
      }

      it("Claim streak bonus", async function () {
        const {players, promotions, itemNFT, alice, playerId, world, mockVRF} = await loadFixture(promotionFixture);

        const promotion = await getStreakBonusPromotion();
        await players.setDailyRewardsEnabled(true);
        await world.setDailyRewardPool(2, [{itemTokenId: EstforConstants.BRONZE_ARROW, amount: 10}]);

        await promotions.addPromotion(promotion);
        await ethers.provider.send("evm_increaseTime", [3600 * 24]);
        await ethers.provider.send("evm_mine", []);
        await expect(
          promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023)
        ).to.be.revertedWithCustomError(promotions, "OracleNotCalled");
        await requestAndFulfillRandomWords(world, mockVRF);
        await promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023);
        expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_ARROW)).to.eq(10);

        await ethers.provider.send("evm_increaseTime", [3600 * 24]);
        await ethers.provider.send("evm_mine", []);
        await requestAndFulfillRandomWords(world, mockVRF);
        await promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023);

        // Hit 2 check now
        await ethers.provider.send("evm_increaseTime", [3600 * 24]);
        await ethers.provider.send("evm_mine", []);

        // Now in the final day, should be able to claim the streak bonus when the oracle is claimed at least
        await expect(
          promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023)
        ).to.be.revertedWithCustomError(promotions, "OracleNotCalled");
        await requestAndFulfillRandomWords(world, mockVRF);

        await ethers.provider.send("evm_increaseTime", [3600 * 24 - 20]);
        await ethers.provider.send("evm_mine", []);
        await requestAndFulfillRandomWords(world, mockVRF);
        await promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023);
        const balances = await itemNFT.balanceOfs(alice.address, [
          EstforConstants.HALLOWEEN_BONUS_1,
          EstforConstants.HALLOWEEN_BONUS_2,
          EstforConstants.HALLOWEEN_BONUS_3
        ]);

        expect(balances).to.not.deep.eq([0, 0, 0]);
      });

      it("Cannot claim streak bonus twice", async function () {
        const {players, playerId, alice, promotions, world, mockVRF} = await loadFixture(promotionFixture);

        const promotion = await getStreakBonusPromotion();
        await players.setDailyRewardsEnabled(true);
        await world.setDailyRewardPool(2, [{itemTokenId: EstforConstants.BRONZE_ARROW, amount: 10}]);

        await promotions.addPromotion(promotion);
        await promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023);
        await ethers.provider.send("evm_increaseTime", [3600 * 24]);
        await ethers.provider.send("evm_mine", []);
        await requestAndFulfillRandomWords(world, mockVRF);
        await promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023);
        await ethers.provider.send("evm_increaseTime", [2 * 3600 * 24 - 20]);
        await ethers.provider.send("evm_mine", []);
        await requestAndFulfillRandomWords(world, mockVRF);

        await promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023);
        await expect(
          promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023)
        ).to.be.revertedWithCustomError(promotions, "PromotionAlreadyClaimed");
      });

      it("Claim outside claim period", async function () {
        const {players, playerId, alice, promotions, world, mockVRF} = await loadFixture(promotionFixture);

        const promotion = await getStreakBonusPromotion();
        await players.setDailyRewardsEnabled(true);
        await world.setDailyRewardPool(2, [{itemTokenId: EstforConstants.BRONZE_ARROW, amount: 10}]);

        await promotions.addPromotion(promotion);
        await promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023);
        await ethers.provider.send("evm_increaseTime", [3600 * 24]);
        await ethers.provider.send("evm_mine", []);
        await requestAndFulfillRandomWords(world, mockVRF);
        await promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023);
        await ethers.provider.send("evm_increaseTime", [3 * 3600 * 24]); // Extra day has passed
        await ethers.provider.send("evm_mine", []);

        await expect(promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023)).to.revertedWithCustomError(
          promotions,
          "MintingOutsideAvailableDate"
        );
      });

      it("Not claimed enough days to get streak bonus", async function () {
        const {players, playerId, alice, promotions, world, mockVRF} = await loadFixture(promotionFixture);

        const promotion = await getStreakBonusPromotion();
        await players.setDailyRewardsEnabled(true);
        await world.setDailyRewardPool(2, [{itemTokenId: EstforConstants.BRONZE_ARROW, amount: 10}]);

        await promotions.addPromotion(promotion);
        await ethers.provider.send("evm_increaseTime", [3600 * 24]);
        await ethers.provider.send("evm_mine", []);
        await requestAndFulfillRandomWords(world, mockVRF);
        await promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023);
        await ethers.provider.send("evm_increaseTime", [3 * 3600 * 24 - 20]);
        await ethers.provider.send("evm_mine", []);

        await expect(promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023)).to.revertedWithCustomError(
          promotions,
          "PlayerNotHitEnoughClaims"
        );
      });

      it("The streak bonus rewards should not change during the claimable period", async function () {
        const {players, playerId, alice, promotions, itemNFT, world, mockVRF} = await loadFixture(promotionFixture);

        let promotion = await getStreakBonusPromotion();
        promotion = {...promotion, numDaysClaimablePeriodStreakBonus: 10};

        await players.setDailyRewardsEnabled(true);
        await world.setDailyRewardPool(2, [{itemTokenId: EstforConstants.BRONZE_ARROW, amount: 10}]);

        await promotions.addPromotion(promotion);
        await promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023);
        await ethers.provider.send("evm_increaseTime", [3600 * 24]);
        await ethers.provider.send("evm_mine", []);
        await requestAndFulfillRandomWords(world, mockVRF);
        await promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023);
        await ethers.provider.send("evm_increaseTime", [2 * 3600 * 24]);
        await ethers.provider.send("evm_mine", []);
        await requestAndFulfillRandomWords(world, mockVRF);
        await requestAndFulfillRandomWords(world, mockVRF);

        const promotionClaim = await promotions.mintPromotionViewNow(playerId, Promotion.XMAS_2023);
        expect(promotionClaim.itemTokenIds.length).to.eq(1);
        expect(promotionClaim.daysToSet.length).to.eq(1);
        expect(promotionClaim.daysToSet[0]).to.eq(31);
        expect(promotionClaim.promotionMintStatus).to.eq(EstforTypes.PromotionMintStatus.SUCCESS);
        const itemTokenId = promotionClaim.itemTokenIds[0];
        expect(parseInt(itemTokenId.toString(), 10)).to.be.oneOf([
          EstforConstants.HALLOWEEN_BONUS_1,
          EstforConstants.HALLOWEEN_BONUS_2,
          EstforConstants.HALLOWEEN_BONUS_3
        ]);

        expect(await promotions.hasCompletedPromotion(playerId, Promotion.XMAS_2023)).to.eq(false);
        // For the remainder of the days the streak bonus should be the same
        for (let i = 0; i < promotion.numDaysClaimablePeriodStreakBonus - 2; ++i) {
          await ethers.provider.send("evm_increaseTime", [3600 * 24]);
          await ethers.provider.send("evm_mine", []);
          await requestAndFulfillRandomWords(world, mockVRF);
          expect(itemTokenId).to.eq(
            (await promotions.mintPromotionViewNow(playerId, Promotion.XMAS_2023)).itemTokenIds[0]
          );
        }

        // Now claim it
        await promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023);
        expect(await promotions.hasCompletedPromotion(playerId, Promotion.XMAS_2023)).to.eq(true);
        expect(await itemNFT.balanceOf(alice.address, itemTokenId)).to.eq(1n);
      });

      it("Brush cost to enter promotion", async function () {
        const {promotions, playerId, brush, alice, shop, dev, world, mockVRF} = await loadFixture(promotionFixture);

        let promotion = await getStreakBonusPromotion();
        promotion = {...promotion, brushCost: parseEther("1")};

        await promotions.addPromotion(promotion);
        await brush.connect(alice).approve(await promotions.getAddress(), parseEther("1"));

        await expect(
          promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023)
        ).to.be.revertedWithCustomError(brush, "ERC20InsufficientBalance");

        await brush.mint(alice.address, parseEther("1"));
        await promotions.connect(alice).mintPromotion(playerId, Promotion.XMAS_2023);

        expect(await brush.balanceOf(alice.address)).to.eq(0);
        expect(await brush.balanceOf(await shop.getAddress())).to.eq(parseEther("0.5"));
        expect(await brush.balanceOf(dev.address)).to.eq(parseEther("0.5"));
      });
    });
  });
});
