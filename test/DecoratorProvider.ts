import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {playersFixture} from "./Players/PlayersFixture";
import {DecoratorProvider} from "../typechain-types";

describe("DecoratorProvider", function () {
  async function deployContracts() {
    const fixture = await loadFixture(playersFixture);
    const {decorator, brush, artGallery, playerNFT, dev} = fixture;

    // Add an lp token
    const lp = await ethers.deployContract("MockBrushToken");
    await decorator.add("2000", await lp.getAddress(), true);

    // Mock territories
    const mockTerritories = await ethers.deployContract("MockTerritories", [await brush.getAddress()]);

    const DecoratorProvider = await ethers.getContractFactory("DecoratorProvider");
    const pid = 0;
    const decoratorProvider = (await upgrades.deployProxy(DecoratorProvider, [
      await decorator.getAddress(),
      await artGallery.getAddress(),
      await mockTerritories.getAddress(),
      await brush.getAddress(),
      await playerNFT.getAddress(),
      dev.address,
      pid,
    ])) as unknown as DecoratorProvider;

    return {...fixture, decoratorProvider, pid, lp, mockTerritories};
  }

  it("Deposit LP to decorator", async function () {
    const {decorator, decoratorProvider, owner, lp} = await loadFixture(deployContracts);

    const amount = 100;
    await lp.mint(owner.address, amount);
    await lp.approve(await decoratorProvider.getAddress(), amount);
    // Takes it all
    await decoratorProvider.deposit();
    expect(await lp.balanceOf(await decoratorProvider.getAddress())).to.eq(0);
    expect(await lp.balanceOf(await decorator.getAddress())).to.eq(amount);
    expect(await lp.balanceOf(owner.address)).to.eq(0);
  });

  it("Harvest rewards", async function () {
    const {mockTerritories, decoratorProvider, artGallery, brush, brushPerSecond, owner, lp, alice, playerId} =
      await loadFixture(deployContracts);

    const amount = 100;
    await lp.mint(owner.address, amount);
    await lp.approve(await decoratorProvider.getAddress(), amount * 2);
    await decoratorProvider.deposit();

    // Will fail until we need it double the rewards
    await expect(decoratorProvider.connect(alice).harvest(playerId)).to.be.revertedWithCustomError(
      brush,
      "ERC20InsufficientBalance"
    );
    await brush.mint(await decoratorProvider.getAddress(), (brushPerSecond * 3n) / 2n);
    await decoratorProvider.connect(alice).harvest(playerId);
    expect(await brush.balanceOf(await artGallery.getAddress())).to.eq((brushPerSecond * 3n) / 2n);

    expect(await mockTerritories.addUnclaimedEmissionsCBCount()).to.eq(1n);
  });

  it("Retrieve art gallery rewards", async function () {
    const {decoratorProvider, brush, owner, lp, dev, brushPerSecond, artGalleryLockPeriod, alice, playerId} =
      await loadFixture(deployContracts);

    const amount = 100;
    await lp.mint(owner.address, amount);
    await lp.approve(await decoratorProvider.getAddress(), amount * 2);
    await decoratorProvider.deposit();

    // await ethers.provider.send("evm_increaseTime", [1]);
    // await ethers.provider.send("evm_mine", []);
    await brush.mint(await decoratorProvider.getAddress(), brushPerSecond);
    await decoratorProvider.connect(alice).harvest(playerId);

    await ethers.provider.send("evm_increaseTime", [artGalleryLockPeriod]);
    await ethers.provider.send("evm_mine", []);
    await decoratorProvider.unlockFromArtGallery();

    // unlock from the art gallery
    expect(await brush.balanceOf(dev.address)).to.eq(brushPerSecond);
  });

  it("Set a new PID", async function () {
    const {decorator, decoratorProvider, owner} = await loadFixture(deployContracts);

    // Add an lp token
    const lp = await ethers.deployContract("MockBrushToken");
    await decorator.add("2000", await lp.getAddress(), true);

    // Deposit
    const amount = 100;
    await lp.mint(owner.address, amount);
    await lp.approve(await decoratorProvider.getAddress(), amount * 2);
    await expect(decoratorProvider.deposit()).to.be.revertedWithCustomError(decoratorProvider, "ZeroBalance");
    await decoratorProvider.setPID(1);
    await decoratorProvider.deposit();

    expect(await lp.balanceOf(await decoratorProvider.getAddress())).to.eq(0);
    expect(await lp.balanceOf(await decorator.getAddress())).to.eq(amount);
    expect(await lp.balanceOf(owner.address)).to.eq(0);
  });

  it("Cannot re-harvest too quickly", async function () {
    const {decoratorProvider, brush, brushPerSecond, owner, lp, alice, playerId} = await loadFixture(deployContracts);

    const amount = 100;
    await lp.mint(owner.address, amount);
    await lp.approve(await decoratorProvider.getAddress(), amount);
    await decoratorProvider.deposit();

    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine", []);

    // Will fail until we need it double the rewards
    const minInterval = await decoratorProvider.MIN_HARVEST_INTERVAL();
    await brush.mint(await decoratorProvider.getAddress(), brushPerSecond * (minInterval + 10n));
    await decoratorProvider.connect(alice).harvest(playerId);

    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine", []);
    await expect(decoratorProvider.connect(alice).harvest(playerId)).to.be.revertedWithCustomError(
      decoratorProvider,
      "HarvestingTooSoon"
    );

    await ethers.provider.send("evm_increaseTime", [Number(minInterval)]);
    await ethers.provider.send("evm_mine", []);
    await expect(decoratorProvider.connect(alice).harvest(playerId)).to.not.be.reverted;
  });

  it("pendingBrushInclArtGallery", async function () {
    const {decoratorProvider, brushPerSecond, owner, lp} = await loadFixture(deployContracts);

    const amount = 100;
    await lp.mint(owner.address, amount);
    await lp.approve(await decoratorProvider.getAddress(), amount);
    await decoratorProvider.deposit();

    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine", []);
    expect(await decoratorProvider.pendingBrushInclArtGallery()).to.eq(brushPerSecond);
  });

  it("TODO test HarvestingTooMuch error", async function () {});
});
