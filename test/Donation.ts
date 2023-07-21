import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {playersFixture} from "./Players/PlayersFixture";

describe("Donation", function () {
  async function deployContracts() {
    const baseFixture = await loadFixture(playersFixture);
    return {...baseFixture};
  }

  it("Donate without player", async function () {
    const {shop, donation, brush, alice} = await loadFixture(deployContracts);
    const totalBrush = ethers.utils.parseEther("1");
    await brush.mint(alice.address, totalBrush);
    await brush.connect(alice).approve(donation.address, totalBrush);
    await donation.connect(alice).donate(100, 0);
    expect(await brush.balanceOf(alice.address)).to.eq(totalBrush.sub(100));
    expect(await brush.balanceOf(shop.address)).to.eq(100);
  });

  it("Donate with player", async function () {
    const {shop, donation, brush, alice, playerId} = await loadFixture(deployContracts);
    const totalBrush = ethers.utils.parseEther("1");
    await brush.mint(alice.address, totalBrush);
    await brush.connect(alice).approve(donation.address, totalBrush);
    await donation.connect(alice).donate(100, playerId);
    expect(await brush.balanceOf(alice.address)).to.eq(totalBrush.sub(100));
    expect(await brush.balanceOf(shop.address)).to.eq(100);

    await expect(donation.connect(alice).donate(100, playerId.add(1))).to.be.revertedWithCustomError(
      donation,
      "NotOwnerOfPlayer"
    );
  });
});
