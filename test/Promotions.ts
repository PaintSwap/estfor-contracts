import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {playersFixture} from "./Players/PlayersFixture";

describe("Promotions", function () {
  this.retries(3);

  it("Only promotional admin can mint", async function () {
    const {promotions, alice, bob, playerId} = await loadFixture(playersFixture);

    const redeemCode = "1111111111111111";
    await expect(
      promotions.connect(bob).mintStarterPromotionalPack(alice.address, playerId, redeemCode)
    ).to.be.revertedWithCustomError(promotions, "NotPromotionalAdmin");
  });

  it("Starter promotional invalid mint redeem code", async function () {
    const {promotions, alice, playerId} = await loadFixture(playersFixture);
    await expect(promotions.mintStarterPromotionalPack(alice.address, playerId, "11231")).to.be.revertedWithCustomError(
      promotions,
      "InvalidRedeemCode"
    );
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
