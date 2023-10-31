import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {playersFixture} from "./Players/PlayersFixture";
import {ethers} from "hardhat";
import {Promotion} from "@paintswap/estfor-definitions/types";
import {requestAndFulfillRandomWords} from "./utils";
import {createPlayer} from "../scripts/utils";

describe("Promotions", function () {
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
        EstforConstants.SECRET_EGG_2,
      ]);

      expect(balances).to.deep.eq([5, 3, 200, 300, 1]);
    });
  });

  describe("Holiday season promotion", async function () {
    const promotionFixture = async function () {
      const fixture = await loadFixture(playersFixture);
      await requestAndFulfillRandomWords(fixture.world, fixture.mockOracleClient);
      return {...fixture};
    };

    it("Random item mint", async function () {
      // Pick 1 out of 3 items (like halloween 2023)
      const {itemNFT, promotions, alice, playerId} = await loadFixture(promotionFixture);

      const {timestamp: NOW} = await ethers.provider.getBlock("latest");

      await promotions.addPromotion({
        promotion: Promotion.HALLOWEEN_2023,
        dateStart: NOW,
        dateEnd: NOW + 1000,
        minTotalXP: 0,
        numItemsToPick: 1,
        isRandom: true,
        itemTokenIds: [
          EstforConstants.HALLOWEEN_BONUS_1,
          EstforConstants.HALLOWEEN_BONUS_2,
          EstforConstants.HALLOWEEN_BONUS_3,
        ],
        amounts: [1, 1, 1],
      });

      await promotions.connect(alice).mintPromotion(playerId, Promotion.HALLOWEEN_2023);

      const balances = await itemNFT.balanceOfs(alice.address, [
        EstforConstants.HALLOWEEN_BONUS_1,
        EstforConstants.HALLOWEEN_BONUS_2,
        EstforConstants.HALLOWEEN_BONUS_3,
      ]);

      expect(balances).to.deep.include(ethers.BigNumber.from("1"));
    });

    it("Random mint (many)", async function () {
      // Just tests that all masks are minted (halloween 2023 example)
      const {itemNFT, playerNFT, promotions, alice, playerId} = await loadFixture(promotionFixture);

      const {timestamp: NOW} = await ethers.provider.getBlock("latest");

      await promotions.addPromotion({
        promotion: Promotion.HALLOWEEN_2023,
        dateStart: NOW,
        dateEnd: NOW + 1000,
        minTotalXP: 0,
        numItemsToPick: 1,
        isRandom: true,
        itemTokenIds: [
          EstforConstants.HALLOWEEN_BONUS_1,
          EstforConstants.HALLOWEEN_BONUS_2,
          EstforConstants.HALLOWEEN_BONUS_3,
        ],
        amounts: [1, 1, 1],
      });

      for (let i = 0; i < 25; ++i) {
        await createPlayer(playerNFT, 1, alice, "name" + i, true);
        await promotions.connect(alice).mintPromotion(playerId.add(i + 1), Promotion.HALLOWEEN_2023);
      }

      expect((await itemNFT["totalSupply(uint256)"](EstforConstants.HALLOWEEN_BONUS_1)).toNumber()).to.be.gt(0);
      expect((await itemNFT["totalSupply(uint256)"](EstforConstants.HALLOWEEN_BONUS_2)).toNumber()).to.be.gt(0);
      expect((await itemNFT["totalSupply(uint256)"](EstforConstants.HALLOWEEN_BONUS_3)).toNumber()).to.be.gt(0);
    });

    it("Minting before start date not allowed", async function () {
      const {promotions, alice, playerId} = await loadFixture(promotionFixture);
      const {timestamp: NOW} = await ethers.provider.getBlock("latest");

      await promotions.addPromotion({
        promotion: Promotion.HALLOWEEN_2023,
        dateStart: NOW + 50,
        dateEnd: NOW + 1000,
        minTotalXP: 0,
        numItemsToPick: 1,
        isRandom: true,
        itemTokenIds: [
          EstforConstants.HALLOWEEN_BONUS_1,
          EstforConstants.HALLOWEEN_BONUS_2,
          EstforConstants.HALLOWEEN_BONUS_3,
        ],
        amounts: [1, 1, 1],
      });
      await expect(
        promotions.connect(alice).mintPromotion(playerId, Promotion.HALLOWEEN_2023)
      ).to.be.revertedWithCustomError(promotions, "MintingOutsideAvailableDate");
    });

    it("Minting after end date not allowed", async function () {
      const {promotions, alice, playerId} = await loadFixture(promotionFixture);

      const {timestamp: NOW} = await ethers.provider.getBlock("latest");

      await promotions.addPromotion({
        promotion: Promotion.HALLOWEEN_2023,
        dateStart: NOW - 2,
        dateEnd: NOW - 1,
        minTotalXP: 0,
        numItemsToPick: 1,
        isRandom: true,
        itemTokenIds: [
          EstforConstants.HALLOWEEN_BONUS_1,
          EstforConstants.HALLOWEEN_BONUS_2,
          EstforConstants.HALLOWEEN_BONUS_3,
        ],
        amounts: [1, 1, 1],
      });
      await expect(
        promotions.connect(alice).mintPromotion(playerId, Promotion.HALLOWEEN_2023)
      ).to.be.revertedWithCustomError(promotions, "MintingOutsideAvailableDate");
    });

    it("Must have the minimum required XP", async function () {
      const {promotions, alice, players, playerId} = await loadFixture(promotionFixture);

      const {timestamp: NOW} = await ethers.provider.getBlock("latest");

      await promotions.addPromotion({
        promotion: Promotion.HALLOWEEN_2023,
        dateStart: NOW,
        dateEnd: NOW + 1000,
        minTotalXP: 10000,
        numItemsToPick: 1,
        isRandom: true,
        itemTokenIds: [
          EstforConstants.HALLOWEEN_BONUS_1,
          EstforConstants.HALLOWEEN_BONUS_2,
          EstforConstants.HALLOWEEN_BONUS_3,
        ],
        amounts: [1, 1, 1],
      });
      await expect(
        promotions.connect(alice).mintPromotion(playerId, Promotion.HALLOWEEN_2023)
      ).to.be.revertedWithCustomError(promotions, "PlayerDoesNotQualify");

      await players.testModifyXP(alice.address, playerId, EstforTypes.Skill.FIREMAKING, 100000, false);
      await promotions.connect(alice).mintPromotion(playerId, Promotion.HALLOWEEN_2023);
    });

    it("Must own the player for promotions", async function () {
      const {promotions, playerId} = await loadFixture(promotionFixture);
      const {timestamp: NOW} = await ethers.provider.getBlock("latest");

      await promotions.addPromotion({
        promotion: Promotion.HALLOWEEN_2023,
        dateStart: NOW,
        dateEnd: NOW + 10000,
        minTotalXP: 0,
        numItemsToPick: 1,
        isRandom: true,
        itemTokenIds: [
          EstforConstants.HALLOWEEN_BONUS_1,
          EstforConstants.HALLOWEEN_BONUS_2,
          EstforConstants.HALLOWEEN_BONUS_3,
        ],
        amounts: [1, 1, 1],
      });
      await expect(promotions.mintPromotion(playerId, Promotion.HALLOWEEN_2023)).to.be.revertedWithCustomError(
        promotions,
        "NotOwnerOfPlayerAndActive"
      );
    });

    it("Cannot mint if oracle has not been called for previous day", async function () {
      const {promotions, playerId, alice} = await loadFixture(promotionFixture);
      const {timestamp: NOW} = await ethers.provider.getBlock("latest");

      await ethers.provider.send("evm_increaseTime", [60 * 60 * 24]);

      await promotions.addPromotion({
        promotion: Promotion.HALLOWEEN_2023,
        dateStart: NOW,
        dateEnd: NOW + 60 * 60 * 24 + 10000,
        minTotalXP: 0,
        numItemsToPick: 1,
        isRandom: true,
        itemTokenIds: [
          EstforConstants.HALLOWEEN_BONUS_1,
          EstforConstants.HALLOWEEN_BONUS_2,
          EstforConstants.HALLOWEEN_BONUS_3,
        ],
        amounts: [1, 1, 1],
      });

      await expect(
        promotions.connect(alice).mintPromotion(playerId, Promotion.HALLOWEEN_2023)
      ).to.be.revertedWithCustomError(promotions, "OracleNotCalled");
    });

    it("Cannot mint twice", async function () {
      const {promotions, playerId, alice} = await loadFixture(promotionFixture);

      const {timestamp: NOW} = await ethers.provider.getBlock("latest");
      await promotions.addPromotion({
        promotion: Promotion.HALLOWEEN_2023,
        dateStart: NOW,
        dateEnd: NOW + 10000,
        minTotalXP: 0,
        numItemsToPick: 1,
        isRandom: true,
        itemTokenIds: [
          EstforConstants.HALLOWEEN_BONUS_1,
          EstforConstants.HALLOWEEN_BONUS_2,
          EstforConstants.HALLOWEEN_BONUS_3,
        ],
        amounts: [1, 1, 1],
      });
      await promotions.connect(alice).mintPromotion(playerId, Promotion.HALLOWEEN_2023);
      await expect(
        promotions.connect(alice).mintPromotion(playerId, Promotion.HALLOWEEN_2023)
      ).to.be.revertedWithCustomError(promotions, "PromotionAlreadyClaimed");
    });

    it("Cannot mint a non-existent promotion", async function () {
      const {promotions, playerId, alice} = await loadFixture(promotionFixture);
      await expect(
        promotions.connect(alice).mintPromotion(playerId, Promotion.HALLOWEEN_2023)
      ).to.be.revertedWithCustomError(promotions, "MintingOutsideAvailableDate");
    });
  });
});
