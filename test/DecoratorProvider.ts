import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {playersFixture} from "./Players/PlayersFixture";

describe("DecoratorProvider", function () {
  async function deployContracts() {
    const fixture = await loadFixture(playersFixture);
    const {decorator, brush, artGallery, dev} = fixture;

    // Add an lp token
    const lp = await ethers.deployContract("MockBrushToken");
    await decorator.add("2000", lp.address, true);

    // Mock territories
    const mockTerritories = await ethers.deployContract("MockTerritories", [brush.address]);

    const DecoratorProvider = await ethers.getContractFactory("DecoratorProvider");
    const pid = 0;
    const decoratorProvider = await upgrades.deployProxy(DecoratorProvider, [
      decorator.address,
      artGallery.address,
      mockTerritories.address,
      brush.address,
      dev.address,
      pid,
    ]);

    return {...fixture, decoratorProvider, pid, lp, mockTerritories};
  }

  it("Deposit LP to decorator", async () => {
    const {decorator, decoratorProvider, owner, lp} = await loadFixture(deployContracts);

    const amount = 100;
    await lp.mint(owner.address, amount);
    await lp.approve(decoratorProvider.address, amount);
    // Takes it all
    await decoratorProvider.deposit();
    expect(await lp.balanceOf(decoratorProvider.address)).to.eq(0);
    expect(await lp.balanceOf(decorator.address)).to.eq(amount);
    expect(await lp.balanceOf(owner.address)).to.eq(0);
  });

  it("Harvest rewards", async () => {
    const {mockTerritories, decoratorProvider, artGallery, brush, brushPerSecond, owner, lp} = await loadFixture(
      deployContracts
    );

    const amount = 100;
    await lp.mint(owner.address, amount);
    await lp.approve(decoratorProvider.address, amount * 2);
    await decoratorProvider.deposit();

    await ethers.provider.send("evm_increaseTime", [1]);

    // Will fail until we need it double the rewards
    await expect(decoratorProvider.harvest()).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    await brush.mint(decoratorProvider.address, brushPerSecond.mul(3).div(2));
    await decoratorProvider.harvest();
    expect(await brush.balanceOf(artGallery.address)).to.eq(brushPerSecond.mul(3).div(2));

    expect(await mockTerritories.addUnclaimedEmissionsCBCount()).to.eq(1);
  });

  it("Retrieve art gallery rewards", async () => {
    const {decoratorProvider, brush, owner, lp, dev, brushPerSecond, artGalleryLockPeriod} = await loadFixture(
      deployContracts
    );

    const amount = 100;
    await lp.mint(owner.address, amount);
    await lp.approve(decoratorProvider.address, amount * 2);
    await decoratorProvider.deposit();

    await ethers.provider.send("evm_increaseTime", [1]);
    await brush.mint(decoratorProvider.address, brushPerSecond);
    await decoratorProvider.harvest();

    await ethers.provider.send("evm_increaseTime", [artGalleryLockPeriod]);
    await decoratorProvider.unlockFromArtGallery();

    // unlock from the art gallery
    expect(await brush.balanceOf(dev.address)).to.eq(brushPerSecond);
  });

  it("Set a new PID", async () => {
    const {decorator, decoratorProvider, brush, owner, dev, brushPerSecond, artGalleryLockPeriod} = await loadFixture(
      deployContracts
    );

    // Add an lp token
    const lp = await ethers.deployContract("MockBrushToken");
    await decorator.add("2000", lp.address, true);

    // Deposit
    const amount = 100;
    await lp.mint(owner.address, amount);
    await lp.approve(decoratorProvider.address, amount * 2);
    await expect(decoratorProvider.deposit()).to.be.revertedWithCustomError(decoratorProvider, "ZeroBalance");
    await decoratorProvider.setPID(1);
    await decoratorProvider.deposit();

    expect(await lp.balanceOf(decoratorProvider.address)).to.eq(0);
    expect(await lp.balanceOf(decorator.address)).to.eq(amount);
    expect(await lp.balanceOf(owner.address)).to.eq(0);
  });
});
