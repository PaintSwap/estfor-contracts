import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {BRONZE_AXE, EquipPosition, inputItem} from "../scripts/utils";

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

  it("Transferable NFT", async () => {
    const {itemNFT, alice, owner} = await loadFixture(deployContracts);

    await itemNFT.addItem({
      ...inputItem,
      tokenId: BRONZE_AXE,
      equipPosition: EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.testOnlyMint(alice.address, BRONZE_AXE, 1);
    expect(await itemNFT.balanceOf(alice.address, BRONZE_AXE)).to.be.eq(1);
    await itemNFT.connect(alice).safeTransferFrom(alice.address, owner.address, BRONZE_AXE, 1, "0x");
    expect(await itemNFT.balanceOf(alice.address, BRONZE_AXE)).to.be.eq(0);
  });

  it("Non-transferable NFT", async () => {
    const {itemNFT, alice, owner} = await loadFixture(deployContracts);

    await itemNFT.addItem({
      ...inputItem,
      tokenId: BRONZE_AXE,
      isTransferable: false, // Cannot be transferred
      equipPosition: EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.testOnlyMint(alice.address, BRONZE_AXE, 1);
    await expect(itemNFT.connect(alice).safeTransferFrom(alice.address, owner.address, BRONZE_AXE, 1, "0x")).to.be
      .reverted;

    // Allow it to be burnt
    await expect(itemNFT.connect(alice).burn(BRONZE_AXE, 1));
  });
});
