import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";

describe("RoyaltyReceiver", function () {
  async function deployContracts() {
    const [owner, alice, pool, dev] = await ethers.getSigners();

    const MockBrushToken = await ethers.getContractFactory("MockBrushToken");
    const brush = await MockBrushToken.deploy();

    const wftm = owner.address; // doesn't matter
    const buyPath: [string, string] = [wftm, brush.address];

    const MockRouter = await ethers.getContractFactory("MockRouter");
    const router = await MockRouter.deploy();

    const RoyaltyReceiver = await ethers.getContractFactory("RoyaltyReceiver");
    const royaltyReceiver = await upgrades.deployProxy(
      RoyaltyReceiver,
      [router.address, pool.address, dev.address, brush.address, buyPath],
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
      dev,
      brush,
      buyPath,
      router,
    };
  }

  it("Check recipients", async function () {
    const {royaltyReceiver, alice, brush, pool, dev} = await loadFixture(deployContracts);

    const beforeBalance = await ethers.provider.getBalance(dev.address);
    await alice.sendTransaction({
      to: royaltyReceiver.address,
      value: 100,
    });

    // 1/3 to dao
    expect(await ethers.provider.getBalance(dev.address)).to.equal(beforeBalance.add(33));

    // 2/3 buys brush and sends to pool
    expect(await brush.balanceOf(pool.address)).to.equal(6);
  });

  it("Incorrect brush path", async function () {
    const {pool, dev, router, buyPath, RoyaltyReceiver} = await loadFixture(deployContracts);

    const incorrectBrushAddress = pool.address;
    await expect(
      upgrades.deployProxy(
        RoyaltyReceiver,
        [router.address, pool.address, dev.address, incorrectBrushAddress, buyPath],
        {
          kind: "uups",
        }
      )
    ).to.be.revertedWithCustomError(RoyaltyReceiver, "IncorrectBrushPath");
  });
});
