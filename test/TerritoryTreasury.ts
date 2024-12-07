import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {playersFixture} from "./Players/PlayersFixture";
import {TerritoryTreasury} from "../typechain-types";
import {timeTravel} from "./utils";

describe("TerritoryTreasury", function () {
  async function deployContracts() {
    const fixture = await loadFixture(playersFixture);
    const {brush, playerNFT, dev, treasury, shop, minHarvestInterval} = fixture;

    // Mock territories
    const mockTerritories = await ethers.deployContract("MockTerritories", [await brush.getAddress()]);

    const TerritoryTreasury = await ethers.getContractFactory("TerritoryTreasury");
    const territoryTreasury = (await upgrades.deployProxy(TerritoryTreasury, [
      await mockTerritories.getAddress(),
      await brush.getAddress(),
      await playerNFT.getAddress(),
      dev.address,
      await treasury.getAddress(),
      minHarvestInterval
    ])) as unknown as TerritoryTreasury;

    await treasury.setSpenders([territoryTreasury, shop], true);
    const treasuryAccounts = [await shop.getAddress(), await territoryTreasury.getAddress()];
    const treasuryPercentages = [10, 90];
    await treasury.setFundAllocationPercentages(treasuryAccounts, treasuryPercentages);

    return {...fixture, territoryTreasury, mockTerritories};
  }

  it("Harvest rewards with a treasury", async function () {
    const {mockTerritories, territoryTreasury, alice, playerId, brush, treasury} = await loadFixture(deployContracts);

    const amount = 1000n;
    await brush.mint(treasury, amount);
    const totalClaimable = (amount * 90n) / 100n;
    await territoryTreasury.connect(alice).harvest(playerId);
    expect(await brush.balanceOf(mockTerritories)).to.eq(totalClaimable / 100n); // 1% of current balance goes to the territory each harvest
  });

  it("Cannot re-harvest too quickly", async function () {
    const {territoryTreasury, brush, treasury, alice, playerId, minHarvestInterval} = await loadFixture(
      deployContracts
    );

    await brush.mint(treasury, 1000);
    await territoryTreasury.connect(alice).harvest(playerId);

    await expect(territoryTreasury.connect(alice).harvest(playerId)).to.be.revertedWithCustomError(
      territoryTreasury,
      "HarvestingTooSoon"
    );

    await timeTravel(minHarvestInterval);

    await expect(territoryTreasury.connect(alice).harvest(playerId)).to.not.be.reverted;
  });

  it("pendingBrush", async function () {
    const {territoryTreasury, brush, treasury} = await loadFixture(deployContracts);

    const amount = 1000n;
    await brush.mint(treasury, amount);
    const totalClaimable = (amount * 90n) / 100n;
    expect(await territoryTreasury.pendingBrush()).to.eq(totalClaimable / 100n); // 1% of current balance goes to the territory each harvest
  });

  it("TODO test HarvestingTooMuch error", async function () {});
});
