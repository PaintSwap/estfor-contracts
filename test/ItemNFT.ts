import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";

describe("PlayerNFT", () => {
  async function deployContracts() {
    const [owner, alice] = await ethers.getSigners();

    const MockBrushToken = await ethers.getContractFactory("MockBrushToken");
    const brush = await MockBrushToken.deploy();

    const MockOracleClient = await ethers.getContractFactory("MockOracleClient");
    const mockOracleClient = await MockOracleClient.deploy();

    // Create the world
    const subscriptionId = 2;
    const World = await ethers.getContractFactory("World");
    const world = await upgrades.deployProxy(World, [mockOracleClient.address, subscriptionId], {
      kind: "uups",
    });

    const Shop = await ethers.getContractFactory("Shop");
    const shop = await upgrades.deployProxy(Shop, [brush.address], {
      kind: "uups",
      unsafeAllow: ["delegatecall"],
    });

    // Create NFT contract which contains all items
    const ItemNFT = await ethers.getContractFactory("ItemNFT");
    const itemNFT = await upgrades.deployProxy(ItemNFT, [world.address, shop.address], {
      kind: "uups",
      unsafeAllow: ["delegatecall"],
    });

    return {
      itemNFT,
      brush,
      owner,
      world,
      alice,
      mockOracleClient,
    };
  }

  it("supportsInterface", async () => {
    const {itemNFT} = await loadFixture(deployContracts);
    // TODO
  });

  it("getItem", async () => {
    const {itemNFT} = await loadFixture(deployContracts);
    // TODO
  });

  it("balanceOfs", async () => {
    const {itemNFT} = await loadFixture(deployContracts);
    // TODO
  });

  it("editItem", async () => {
    const {itemNFT} = await loadFixture(deployContracts);
    // TODO
  });
});
