import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";

describe("RoyaltyReceiver", () => {
  async function deployContracts() {
    const [owner, alice, pool] = await ethers.getSigners();

    const MockBrushToken = await ethers.getContractFactory("MockBrushToken");
    const brush = await MockBrushToken.deploy();

    const wftm = owner.address; // doesn't matter
    const buyPath = [wftm, brush.address];

    const MockRouter = await ethers.getContractFactory("MockRouter");
    const router = await MockRouter.deploy();

    const RoyaltyReceiver = await ethers.getContractFactory("RoyaltyReceiver");
    const royaltyReceiver = await RoyaltyReceiver.deploy(router.address, pool.address, brush.address, buyPath);

    return {
      royaltyReceiver,
      owner,
      alice,
      pool,
      brush,
    };
  }

  it("Brush buyback", async () => {
    const {royaltyReceiver, alice, brush, pool} = await loadFixture(deployContracts);

    await alice.sendTransaction({
      to: royaltyReceiver.address,
      value: 100,
    });

    expect(await brush.balanceOf(pool.address)).to.equal(10);
  });
});
