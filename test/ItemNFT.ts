import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";

describe("ItemNFT", () => {
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

    const buyPath: [string, string] = [alice.address, brush.address];
    const MockRouter = await ethers.getContractFactory("MockRouter");
    const router = await MockRouter.deploy();
    const RoyaltyReceiver = await ethers.getContractFactory("RoyaltyReceiver");
    const royaltyReceiver = await RoyaltyReceiver.deploy(router.address, shop.address, brush.address, buyPath);

    const admins = [owner.address, alice.address];

    // Create NFT contract which contains all items
    const ItemNFT = await ethers.getContractFactory("ItemNFT");
    const itemNFT = await upgrades.deployProxy(
      ItemNFT,
      [world.address, shop.address, royaltyReceiver.address, admins],
      {
        kind: "uups",
        unsafeAllow: ["delegatecall"],
      }
    );

    return {
      itemNFT,
      brush,
      owner,
      world,
      alice,
      mockOracleClient,
    };
  }

  describe("supportsInterface", async () => {
    it("IERC165", async () => {
      const {itemNFT} = await loadFixture(deployContracts);
      expect(await itemNFT.supportsInterface("0x01ffc9a7")).to.equal(true);
    });

    it("IERC1155", async () => {
      const {itemNFT} = await loadFixture(deployContracts);
      expect(await itemNFT.supportsInterface("0xd9b67a26")).to.equal(true);
    });

    it("IERC1155Metadata", async () => {
      const {itemNFT} = await loadFixture(deployContracts);
      expect(await itemNFT.supportsInterface("0x0e89341c")).to.equal(true);
    });

    it("IERC2981 royalties", async () => {
      const {itemNFT} = await loadFixture(deployContracts);
      expect(await itemNFT.supportsInterface("0x2a55205a")).to.equal(true);
    });
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
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_AXE,
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.testMint(alice.address, EstforConstants.BRONZE_AXE, 1);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_AXE)).to.be.eq(1);
    await itemNFT.connect(alice).safeTransferFrom(alice.address, owner.address, EstforConstants.BRONZE_AXE, 1, "0x");
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_AXE)).to.be.eq(0);
  });

  it("Non-transferable NFT", async () => {
    const {itemNFT, alice, owner} = await loadFixture(deployContracts);

    await itemNFT.addItem({
      ...EstforTypes.defaultInputItem,
      tokenId: EstforConstants.BRONZE_AXE,
      isTransferable: false, // Cannot be transferred
      equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await itemNFT.testMint(alice.address, EstforConstants.BRONZE_AXE, 1);
    await expect(
      itemNFT.connect(alice).safeTransferFrom(alice.address, owner.address, EstforConstants.BRONZE_AXE, 1, "0x")
    ).to.be.reverted;

    // Allow it to be burnt
    await expect(itemNFT.connect(alice).burn(EstforConstants.BRONZE_AXE, 1));
  });
});
