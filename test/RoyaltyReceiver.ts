import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";

describe("RoyaltyReceiver", function () {
  async function deployContracts() {
    const [owner, alice, pool] = await ethers.getSigners();

    const MockBrushToken = await ethers.getContractFactory("MockBrushToken");
    const brush = await MockBrushToken.deploy();

    const wftm = owner.address; // doesn't matter
    const buyPath: [string, string] = [wftm, brush.address];

    const MockRouter = await ethers.getContractFactory("MockRouter");
    const router = await MockRouter.deploy();

    const RoyaltyReceiver = await ethers.getContractFactory("RoyaltyReceiver");
    const royaltyReceiver = await upgrades.deployProxy(
      RoyaltyReceiver,
      [router.address, pool.address, brush.address, buyPath],
      {
        kind: "uups",
      }
    );

    return {
      RoyaltyReceiver,
      royaltyReceiver,
      owner,
      alice,
      pool,
      brush,
      buyPath,
      router,
    };
  }

  it("Brush buyback", async function () {
    const {royaltyReceiver, alice, brush, pool} = await loadFixture(deployContracts);

    await alice.sendTransaction({
      to: royaltyReceiver.address,
      value: 100,
    });

    expect(await brush.balanceOf(pool.address)).to.equal(10);
  });

  it("Incorrect brush path", async function () {
    const {pool, router, buyPath, RoyaltyReceiver} = await loadFixture(deployContracts);

    const incorrectBrushAddress = pool.address;
    await expect(
      upgrades.deployProxy(RoyaltyReceiver, [router.address, pool.address, incorrectBrushAddress, buyPath], {
        kind: "uups",
      })
    ).to.be.revertedWithCustomError(RoyaltyReceiver, "IncorrectBrushPath");
  });
});
