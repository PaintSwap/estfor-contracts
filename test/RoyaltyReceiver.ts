import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {MockTerritories, RoyaltyReceiver} from "../typechain-types";

describe("RoyaltyReceiver", function () {
  async function deployContracts() {
    const [owner, alice, pool, dev] = await ethers.getSigners();

    const brush = await ethers.deployContract("MockBrushToken");

    const wftm = owner.address; // doesn't matter

    const router = await ethers.deployContract("MockRouter");

    const RoyaltyReceiver = await ethers.getContractFactory("RoyaltyReceiver");
    const royaltyReceiver = (await upgrades.deployProxy(
      RoyaltyReceiver,
      [await router.getAddress(), pool.address, dev.address, await brush.getAddress(), wftm],
      {
        kind: "uups",
      },
    )) as unknown as RoyaltyReceiver;

    const mockTerritories = (await ethers.deployContract("MockTerritories", [
      await brush.getAddress(),
    ])) as MockTerritories;
    await royaltyReceiver.setTerritories(await mockTerritories.getAddress());

    return {
      RoyaltyReceiver,
      royaltyReceiver,
      owner,
      alice,
      pool,
      dev,
      brush,
      wftm,
      router,
      mockTerritories,
    };
  }

  it("Check recipients", async function () {
    const {royaltyReceiver, alice, brush, pool, dev} = await loadFixture(deployContracts);

    const beforeBalance = await ethers.provider.getBalance(dev.address);
    await alice.sendTransaction({
      to: await royaltyReceiver.getAddress(),
      value: 100,
    });

    // 1/3 to dao
    expect(await ethers.provider.getBalance(dev.address)).to.equal(beforeBalance + 33n);

    // 2/3 buys brush and sends to pool
    expect(await brush.balanceOf(pool.address)).to.equal(6);
  });

  it("Distribute brush", async function () {
    const {mockTerritories, brush, royaltyReceiver} = await loadFixture(deployContracts);

    const MIN_BRUSH_TO_DISTRIBUTE = await royaltyReceiver.MIN_BRUSH_TO_DISTRIBUTE();
    await brush.mint(await royaltyReceiver.getAddress(), MIN_BRUSH_TO_DISTRIBUTE - 1n);
    expect(await royaltyReceiver.canDistribute()).to.be.false;
    expect(await mockTerritories.addUnclaimedEmissionsCBCount()).to.eq(0);
    await expect(royaltyReceiver.distributeBrush()).to.be.revertedWithCustomError(
      royaltyReceiver,
      "BrushTooLowToDistribute",
    );
    await brush.mint(await royaltyReceiver.getAddress(), 1);
    expect(await royaltyReceiver.canDistribute()).to.be.true;
    await royaltyReceiver.distributeBrush();
    expect(await royaltyReceiver.canDistribute()).to.be.false;
    expect(await mockTerritories.addUnclaimedEmissionsCBCount()).to.eq(1);
  });
});
