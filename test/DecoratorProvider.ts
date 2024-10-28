import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {playersFixture} from "./Players/PlayersFixture";
import {DecoratorProvider} from "../typechain-types";
import {timeTravel} from "./utils";

describe("DecoratorProvider", function () {
  async function deployContracts() {
    const fixture = await loadFixture(playersFixture);
    const {decorator, brush, playerNFT, dev} = fixture;

    // Add an lp token
    const lp = await ethers.deployContract("MockBrushToken");
    await decorator.add("2000", lp, true);

    // Mock territories
    const mockTerritories = await ethers.deployContract("MockTerritories", [await brush.getAddress()]);

    const DecoratorProvider = await ethers.getContractFactory("DecoratorProvider");
    const pid = 0;
    const decoratorProvider = (await upgrades.deployProxy(DecoratorProvider, [
      await decorator.getAddress(),
      await mockTerritories.getAddress(),
      await brush.getAddress(),
      await playerNFT.getAddress(),
      dev.address,
      pid
    ])) as unknown as DecoratorProvider;

    return {...fixture, decoratorProvider, pid, lp, mockTerritories};
  }

  it("Deposit LP to decorator", async function () {
    const {decorator, decoratorProvider, owner, lp} = await loadFixture(deployContracts);

    const amount = 100;
    await lp.mint(owner.address, amount);
    await lp.approve(decoratorProvider, amount);
    // Takes it all
    await decoratorProvider.deposit();
    expect(await lp.balanceOf(decoratorProvider)).to.eq(0);
    expect(await lp.balanceOf(decorator)).to.eq(amount);
    expect(await lp.balanceOf(owner.address)).to.eq(0);
  });

  it("Harvest rewards", async function () {
    const {mockTerritories, decoratorProvider, owner, lp, alice, playerId} = await loadFixture(deployContracts);

    const amount = 100;
    await lp.mint(owner.address, amount);
    await lp.approve(decoratorProvider, amount * 2);
    await decoratorProvider.deposit();

    await decoratorProvider.connect(alice).harvest(playerId);

    expect(await mockTerritories.addUnclaimedEmissionsCBCount()).to.eq(1n);
  });

  it("Set a new PID", async function () {
    const {decorator, decoratorProvider, owner} = await loadFixture(deployContracts);

    // Add an lp token
    const lp = await ethers.deployContract("MockBrushToken");
    await decorator.add("2000", lp, true);

    // Deposit
    const amount = 100;
    await lp.mint(owner, amount);
    await lp.approve(decoratorProvider, amount * 2);
    await expect(decoratorProvider.deposit()).to.be.revertedWithCustomError(decoratorProvider, "ZeroBalance");
    await decoratorProvider.setPID(1);
    await decoratorProvider.deposit();

    expect(await lp.balanceOf(decoratorProvider)).to.eq(0);
    expect(await lp.balanceOf(decorator)).to.eq(amount);
    expect(await lp.balanceOf(owner)).to.eq(0);
  });

  it("Cannot re-harvest too quickly", async function () {
    const {decoratorProvider, brush, brushPerSecond, owner, lp, alice, playerId} = await loadFixture(deployContracts);

    const amount = 100;
    await lp.mint(owner, amount);
    await lp.approve(decoratorProvider, amount);
    await decoratorProvider.deposit();

    await timeTravel(1);

    // Will fail until we need it double the rewards
    const minInterval = await decoratorProvider.MIN_HARVEST_INTERVAL();
    await brush.mint(decoratorProvider, brushPerSecond * (minInterval + 10n));
    await decoratorProvider.connect(alice).harvest(playerId);

    await timeTravel(1);
    await expect(decoratorProvider.connect(alice).harvest(playerId)).to.be.revertedWithCustomError(
      decoratorProvider,
      "HarvestingTooSoon"
    );

    await timeTravel(Number(minInterval));

    await expect(decoratorProvider.connect(alice).harvest(playerId)).to.not.be.reverted;
  });

  it("pendingBrush", async function () {
    const {decoratorProvider, brushPerSecond, owner, lp} = await loadFixture(deployContracts);

    const amount = 100;
    await lp.mint(owner, amount);
    await lp.approve(decoratorProvider, amount);
    await decoratorProvider.deposit();

    await timeTravel(1);

    expect(await decoratorProvider.pendingBrush()).to.eq(brushPerSecond);
  });

  it("TODO test HarvestingTooMuch error", async function () {});
});
