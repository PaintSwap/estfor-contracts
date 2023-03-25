import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";

describe("ItemNFT", function () {
  async function deployContracts() {
    const [owner, alice] = await ethers.getSigners();

    const MockBrushToken = await ethers.getContractFactory("MockBrushToken");
    const brush = await MockBrushToken.deploy();

    const MockOracleClient = await ethers.getContractFactory("MockOracleClient");
    const mockOracleClient = await MockOracleClient.deploy();

    // Add some dummy blocks so that world can access previous blocks for random numbers
    for (let i = 0; i < 5; ++i) {
      await owner.sendTransaction({
        to: owner.address,
        value: 1,
      });
    }

    // Create the world
    const subscriptionId = 2;
    const World = await ethers.getContractFactory("World");
    const world = await upgrades.deployProxy(World, [mockOracleClient.address, subscriptionId], {
      kind: "uups",
    });

    const Shop = await ethers.getContractFactory("Shop");
    const shop = await upgrades.deployProxy(Shop, [brush.address], {
      kind: "uups",
    });

    const buyPath: [string, string] = [alice.address, brush.address];
    const MockRouter = await ethers.getContractFactory("MockRouter");
    const router = await MockRouter.deploy();
    const RoyaltyReceiver = await ethers.getContractFactory("RoyaltyReceiver");
    const royaltyReceiver = await upgrades.deployProxy(
      RoyaltyReceiver,
      [router.address, shop.address, brush.address, buyPath],
      {
        kind: "uups",
      }
    );
    await royaltyReceiver.deployed();

    const admins = [owner.address, alice.address];
    const AdminAccess = await ethers.getContractFactory("AdminAccess");
    const adminAccess = await upgrades.deployProxy(AdminAccess, [admins], {
      kind: "uups",
    });
    await adminAccess.deployed();

    // Create NFT contract which contains all items
    const ItemNFT = await ethers.getContractFactory("ItemNFT");
    const itemsUri = "ipfs://";
    const itemNFT = await upgrades.deployProxy(
      ItemNFT,
      [world.address, shop.address, royaltyReceiver.address, adminAccess.address, itemsUri],
      {
        kind: "uups",
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

  describe("supportsInterface", async function () {
    it("IERC165", async function () {
      const {itemNFT} = await loadFixture(deployContracts);
      expect(await itemNFT.supportsInterface("0x01ffc9a7")).to.equal(true);
    });

    it("IERC1155", async function () {
      const {itemNFT} = await loadFixture(deployContracts);
      expect(await itemNFT.supportsInterface("0xd9b67a26")).to.equal(true);
    });

    it("IERC1155Metadata", async function () {
      const {itemNFT} = await loadFixture(deployContracts);
      expect(await itemNFT.supportsInterface("0x0e89341c")).to.equal(true);
    });

    it("IERC2981 royalties", async function () {
      const {itemNFT} = await loadFixture(deployContracts);
      expect(await itemNFT.supportsInterface("0x2a55205a")).to.equal(true);
    });
  });

  it("getItem", async function () {
    const {itemNFT} = await loadFixture(deployContracts);
    // TODO
  });

  it("balanceOfs", async function () {
    const {itemNFT} = await loadFixture(deployContracts);
    // TODO
  });

  it("editItem", async function () {
    const {itemNFT} = await loadFixture(deployContracts);
    // TODO
  });

  it("Transferable NFT", async function () {
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

  it("Non-transferable NFT", async function () {
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
