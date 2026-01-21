import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {GameSubsidisationRegistry} from "../../typechain-types";
import {playersFixture} from "../Players/PlayersFixture";

describe("GameSubsidisationRegistry", function () {
  async function deployContracts() {
    const baseFixture = await loadFixture(playersFixture);
    return {...baseFixture};
  }

  it("allows the owner to set and read function groups", async () => {
    const {gameSubsidisationRegistry, owner}: {gameSubsidisationRegistry: GameSubsidisationRegistry; owner: any} =
      await loadFixture(deployContracts);

    const selector = ethers.id("doThing()").slice(0, 10);
    await gameSubsidisationRegistry.setFunctionGroup(owner.address, selector, 2);

    expect(await gameSubsidisationRegistry.functionToLimitGroup(owner.address, selector)).to.eq(2);
  });

  it("blocks non-owners from setting function groups", async () => {
    const {gameSubsidisationRegistry, alice}: {gameSubsidisationRegistry: GameSubsidisationRegistry; alice: any} =
      await loadFixture(deployContracts);

    const selector = ethers.id("doThing()").slice(0, 10);

    await expect(
      gameSubsidisationRegistry.connect(alice).setFunctionGroup(alice.address, selector, 1)
    ).to.be.revertedWithCustomError(gameSubsidisationRegistry, "OwnableUnauthorizedAccount");
  });

  it("allows the owner to set and read group limits", async () => {
    const {gameSubsidisationRegistry, owner}: {gameSubsidisationRegistry: GameSubsidisationRegistry; owner: any} =
      await loadFixture(deployContracts);

    await gameSubsidisationRegistry.setGroupLimit(1, 5);

    expect(await gameSubsidisationRegistry.groupDailyLimits(1)).to.eq(5);
  });

  it("blocks non-owners from setting group limits", async () => {
    const {gameSubsidisationRegistry, alice}: {gameSubsidisationRegistry: GameSubsidisationRegistry; alice: any} =
      await loadFixture(deployContracts);

    await expect(gameSubsidisationRegistry.connect(alice).setGroupLimit(1, 5)).to.be.revertedWithCustomError(
      gameSubsidisationRegistry,
      "OwnableUnauthorizedAccount"
    );
  });

  it("can update existing mappings", async () => {
    const {gameSubsidisationRegistry, owner}: {gameSubsidisationRegistry: GameSubsidisationRegistry; owner: any} =
      await loadFixture(deployContracts);

    const selector = ethers.id("doThing()").slice(0, 10);

    await gameSubsidisationRegistry.setFunctionGroup(owner.address, selector, 1);
    await gameSubsidisationRegistry.setGroupLimit(1, 5);

    await gameSubsidisationRegistry.setFunctionGroup(owner.address, selector, 3);
    await gameSubsidisationRegistry.setGroupLimit(1, 9);

    expect(await gameSubsidisationRegistry.functionToLimitGroup(owner.address, selector)).to.eq(3);
    expect(await gameSubsidisationRegistry.groupDailyLimits(1)).to.eq(9);
  });
});
