import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {playersFixture} from "./Players/PlayersFixture";
import {TerritoryTreasury} from "../typechain-types";
import {timeTravel} from "./utils";

describe("TerritoryTreasury", function () {
  async function deployContracts() {
    const fixture = await loadFixture(playersFixture);
    const {decorator, brush, playerNFT, dev, treasury, shop, minHarvestInterval} = fixture;

    // Add an lp token
    const lp = await ethers.deployContract("MockBrushToken");
    await decorator.add("2000", lp, true);

    // Mock territories
    const mockTerritories = await ethers.deployContract("MockTerritories", [await brush.getAddress()]);

    const TerritoryTreasury = await ethers.getContractFactory("TerritoryTreasury");
    const pid = 0;
    const territoryTreasury = (await upgrades.deployProxy(TerritoryTreasury, [
      await mockTerritories.getAddress(),
      await brush.getAddress(),
      await playerNFT.getAddress(),
      dev.address,
      await treasury.getAddress(),
      minHarvestInterval,
      await decorator.getAddress(),
      pid
    ])) as unknown as TerritoryTreasury;

    await treasury.setSpenders([territoryTreasury, shop], true);
    const treasuryAccounts = [await shop.getAddress(), await territoryTreasury.getAddress()];
    const treasuryPercentages = [10, 90];
    await treasury.setFundAllocationPercentages(treasuryAccounts, treasuryPercentages);

    return {...fixture, territoryTreasury, pid, lp, mockTerritories};
  }

  it("Deposit LP to decorator", async function () {
    const {decorator, territoryTreasury, owner, lp} = await loadFixture(deployContracts);

    const amount = 100;
    await lp.mint(owner, amount);
    await lp.approve(territoryTreasury, amount);
    // Takes it all
    await territoryTreasury.deposit();
    expect(await lp.balanceOf(territoryTreasury)).to.eq(0);
    expect(await lp.balanceOf(decorator)).to.eq(amount);
    expect(await lp.balanceOf(owner)).to.eq(0);
  });

  it("Harvest rewards", async function () {
    const {mockTerritories, territoryTreasury, owner, lp, alice, playerId, brush, brushPerSecond} = await loadFixture(
      deployContracts
    );

    const amount = 100;
    await lp.mint(owner, amount);
    await lp.approve(territoryTreasury, amount * 2);
    await territoryTreasury.deposit();
    expect(await mockTerritories.addUnclaimedEmissionsCBCount()).to.eq(0n);
    await territoryTreasury.connect(alice).harvest(playerId);
    expect(await mockTerritories.addUnclaimedEmissionsCBCount()).to.eq(1n);
    expect(await brush.balanceOf(mockTerritories)).to.eq(brushPerSecond);
  });

  it("Harvest rewards with a treasury", async function () {
    const {mockTerritories, territoryTreasury, owner, lp, alice, playerId, brush, brushPerSecond, treasury} =
      await loadFixture(deployContracts);

    const amount = 100;
    await lp.mint(owner, amount);
    await lp.approve(territoryTreasury, amount * 2);
    await brush.mint(treasury, 1000);
    await territoryTreasury.deposit();
    await territoryTreasury.connect(alice).harvest(playerId);
    const totalClaimable = (1000n * 90n) / 100n;
    expect(await brush.balanceOf(mockTerritories)).to.eq(brushPerSecond + totalClaimable / 100n); // 1% of current balance goes to the territory each harvest
  });

  it("Set a new PID", async function () {
    const {decorator, territoryTreasury, owner} = await loadFixture(deployContracts);

    // Add an lp token
    const lp = await ethers.deployContract("MockBrushToken");
    await decorator.add("2000", lp, true);

    // Deposit
    const amount = 100;
    await lp.mint(owner, amount);
    await lp.approve(territoryTreasury, amount * 2);
    await expect(territoryTreasury.deposit()).to.be.revertedWithCustomError(territoryTreasury, "ZeroBalance");
    await territoryTreasury.setPID(1);
    await territoryTreasury.deposit();

    expect(await lp.balanceOf(territoryTreasury)).to.eq(0);
    expect(await lp.balanceOf(decorator)).to.eq(amount);
    expect(await lp.balanceOf(owner)).to.eq(0);
  });

  it("Cannot re-harvest too quickly", async function () {
    const {territoryTreasury, brush, brushPerSecond, owner, lp, alice, playerId, minHarvestInterval} =
      await loadFixture(deployContracts);

    const amount = 100;
    await lp.mint(owner, amount);
    await lp.approve(territoryTreasury, amount);
    await territoryTreasury.deposit();

    await timeTravel(1);

    // Will fail until we need it double the rewards
    await brush.mint(territoryTreasury, brushPerSecond * (minHarvestInterval + 10n));
    await territoryTreasury.connect(alice).harvest(playerId);

    await timeTravel(1);
    await expect(territoryTreasury.connect(alice).harvest(playerId)).to.be.revertedWithCustomError(
      territoryTreasury,
      "HarvestingTooSoon"
    );

    await timeTravel(Number(minHarvestInterval));

    await expect(territoryTreasury.connect(alice).harvest(playerId)).to.not.be.reverted;
  });

  it("pendingBrush", async function () {
    const {territoryTreasury, brushPerSecond, owner, lp} = await loadFixture(deployContracts);

    const amount = 100;
    await lp.mint(owner, amount);
    await lp.approve(territoryTreasury, amount);
    await territoryTreasury.deposit();

    await timeTravel(1);

    expect(await territoryTreasury.pendingBrush()).to.eq(brushPerSecond);
  });

  it("TODO test HarvestingTooMuch error", async function () {});
});
