import {ethers, upgrades} from "hardhat";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {Treasury} from "../typechain-types";

describe("Treasury", function () {
  async function deployTreasuryFixture() {
    const [owner, alice, bob, territories, shop] = await ethers.getSigners();

    const BrushToken = await ethers.getContractFactory("MockBrushToken");
    const brushToken = await BrushToken.deploy();

    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = (await upgrades.deployProxy(Treasury, [await brushToken.getAddress()], {
      kind: "uups"
    })) as unknown as Treasury;
    await treasury.waitForDeployment();

    await treasury.initializeAddresses(territories, shop);
    // Mint some tokens to the treasury
    await brushToken.mint(treasury, ethers.parseEther("1000"));

    return {treasury, brushToken, owner, alice, bob, territories, shop};
  }

  describe("Initialization", function () {
    it("Should set the right owner", async function () {
      const {treasury, owner} = await loadFixture(deployTreasuryFixture);
      expect(await treasury.owner()).to.equal(owner.address);
    });

    it("Should initialize with empty fund allocation", async function () {
      const {treasury, alice} = await loadFixture(deployTreasuryFixture);
      await expect(treasury.totalClaimable(alice.address)).to.be.revertedWithCustomError(
        treasury,
        "EnumerableMapNonexistentKey"
      );
    });
  });

  describe("Fund Allocation", function () {
    it("Should set fund allocation percentages correctly", async function () {
      const {treasury, alice, bob, territories} = await loadFixture(deployTreasuryFixture);
      const accounts = [alice.address, bob.address, territories.address];
      const percentages = [30, 20, 50];
      await expect(treasury.setFundAllocationPercentages(accounts, percentages))
        .to.emit(treasury, "SetFundAllocationPercentages")
        .withArgs(accounts, percentages);

      expect(await treasury.totalClaimable(alice.address)).to.equal(ethers.parseEther("300"));
      expect(await treasury.totalClaimable(bob.address)).to.equal(ethers.parseEther("200"));
      expect(await treasury.totalClaimable(territories.address)).to.equal(ethers.parseEther("500"));
    });

    it("Should revert if percentages don't add up to 100", async function () {
      const {treasury, alice, bob} = await loadFixture(deployTreasuryFixture);
      await expect(
        treasury.setFundAllocationPercentages([alice.address, bob.address], [30, 50])
      ).to.be.revertedWithCustomError(treasury, "TotalPercentageNot100");
    });

    it("Should revert if arrays have different lengths", async function () {
      const {treasury, alice, bob} = await loadFixture(deployTreasuryFixture);
      await expect(
        treasury.setFundAllocationPercentages([alice.address, bob.address], [50])
      ).to.be.revertedWithCustomError(treasury, "LengthMismatch");
    });
  });

  describe("Distribution", function () {
    it("Should distribute to territories correctly", async function () {
      const {treasury, brushToken, territories} = await loadFixture(deployTreasuryFixture);
      await treasury.setFundAllocationPercentages([territories.address], [100]);

      await expect(() => treasury.connect(territories).distributeToTerritories()).to.changeTokenBalances(
        brushToken,
        [treasury, territories],
        [ethers.parseEther("-1000"), ethers.parseEther("1000")]
      );
    });

    it("Should revert if called by non-territories address", async function () {
      const {treasury, alice} = await loadFixture(deployTreasuryFixture);
      await expect(treasury.connect(alice).distributeToTerritories()).to.be.revertedWithCustomError(
        treasury,
        "OnlyTerritories"
      );
    });
  });

  describe("Spending", function () {
    it("Should allow spending by authorized spender", async function () {
      const {treasury, brushToken, shop, alice} = await loadFixture(deployTreasuryFixture);
      await expect(() => treasury.connect(shop).spend(alice.address, ethers.parseEther("100"))).to.changeTokenBalances(
        brushToken,
        [treasury, alice],
        [ethers.parseEther("-100"), ethers.parseEther("100")]
      );
    });

    it("Should revert if called by non-spender", async function () {
      const {treasury, alice, bob} = await loadFixture(deployTreasuryFixture);
      await expect(treasury.connect(alice).spend(bob.address, ethers.parseEther("100"))).to.be.revertedWithCustomError(
        treasury,
        "OnlySpenders"
      );
    });
  });
});
