import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {RoyaltyReceiver} from "../typechain-types";

describe("RoyaltyReceiver", function () {
  async function deployContracts() {
    const [owner, alice, treasury, dev] = await ethers.getSigners();

    const brush = await ethers.deployContract("MockBrushToken");

    const wftm = owner.address; // doesn't matter

    const router = await ethers.deployContract("MockRouter");

    const RoyaltyReceiver = await ethers.getContractFactory("RoyaltyReceiver");
    const royaltyReceiver = (await upgrades.deployProxy(
      RoyaltyReceiver,
      [await router.getAddress(), treasury.address, dev.address, await brush.getAddress(), wftm],
      {
        kind: "uups"
      }
    )) as unknown as RoyaltyReceiver;

    return {
      RoyaltyReceiver,
      royaltyReceiver,
      owner,
      alice,
      treasury,
      dev,
      brush,
      wftm,
      router
    };
  }

  it("Check recipients", async function () {
    const {royaltyReceiver, alice, brush, treasury, dev} = await loadFixture(deployContracts);

    const beforeBalance = await ethers.provider.getBalance(dev);
    await alice.sendTransaction({
      to: await royaltyReceiver.getAddress(),
      value: 100
    });

    // 1/3 to dao
    expect(await ethers.provider.getBalance(dev)).to.equal(beforeBalance + 33n);

    // 2/3 buys brush and sends to treasury
    expect(await brush.balanceOf(treasury)).to.equal(6);
  });

  it("Distribute brush", async function () {
    const {treasury, brush, royaltyReceiver} = await loadFixture(deployContracts);
    expect(await brush.balanceOf(treasury)).to.eq(0);
    await brush.mint(royaltyReceiver, 100);
    await royaltyReceiver.distributeBrush();
    expect(await brush.balanceOf(treasury)).to.eq(100);
  });
});
