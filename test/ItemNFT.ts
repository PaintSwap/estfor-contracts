import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {setDailyAndWeeklyRewards} from "../scripts/utils";
import {ItemNFT, World} from "../typechain-types";

describe("ItemNFT", function () {
  async function deployContracts() {
    const [owner, alice, dev] = await ethers.getSigners();

    const MockBrushToken = await ethers.getContractFactory("MockBrushToken");
    const brush = await MockBrushToken.deploy();

    const MockOracleClient = await ethers.getContractFactory("MockOracleClient");
    const mockOracleClient = await MockOracleClient.deploy();

    // Add some dummy blocks so that world can access previous blocks for random numbers
    for (let i = 0; i < 5; ++i) {
      await owner.sendTransaction({
        to: owner.address,
        value: 1,
        maxFeePerGas: 1,
      });
    }

    // Create the world
    const WorldLibrary = await ethers.getContractFactory("WorldLibrary");
    const worldLibrary = await WorldLibrary.deploy();
    const subscriptionId = 2;
    const World = await ethers.getContractFactory("World", {libraries: {WorldLibrary: worldLibrary.address}});
    const world = (await upgrades.deployProxy(World, [mockOracleClient.address, subscriptionId], {
      kind: "uups",
      unsafeAllow: ["delegatecall", "external-library-linking"],
    })) as World;

    await setDailyAndWeeklyRewards(world);

    const Shop = await ethers.getContractFactory("Shop");
    const shop = await upgrades.deployProxy(Shop, [brush.address, dev.address], {
      kind: "uups",
    });

    const buyPath: [string, string] = [alice.address, brush.address];
    const MockRouter = await ethers.getContractFactory("MockRouter");
    const router = await MockRouter.deploy();
    const RoyaltyReceiver = await ethers.getContractFactory("RoyaltyReceiver");
    const royaltyReceiver = await upgrades.deployProxy(
      RoyaltyReceiver,
      [router.address, shop.address, dev.address, brush.address, buyPath],
      {
        kind: "uups",
      }
    );
    await royaltyReceiver.deployed();

    const admins = [owner.address, alice.address];
    const promotionalAdmins = [alice.address];
    const AdminAccess = await ethers.getContractFactory("AdminAccess");
    const adminAccess = await upgrades.deployProxy(AdminAccess, [admins, promotionalAdmins], {
      kind: "uups",
    });
    await adminAccess.deployed();

    const isBeta = true;
    const ItemNFTLibrary = await ethers.getContractFactory("ItemNFTLibrary");
    const itemNFTLibrary = await ItemNFTLibrary.deploy();
    const ItemNFT = await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: itemNFTLibrary.address}});
    const itemsUri = "ipfs://";
    const itemNFT = (await upgrades.deployProxy(
      ItemNFT,
      [world.address, shop.address, royaltyReceiver.address, adminAccess.address, itemsUri, isBeta],
      {
        kind: "uups",
        unsafeAllow: ["external-library-linking"],
      }
    )) as ItemNFT;

    return {
      itemNFT,
      brush,
      owner,
      world,
      alice,
      mockOracleClient,
      shop,
      royaltyReceiver,
      adminAccess,
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
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      },
    ]);

    // Change equipPosition should fail
    await expect(
      itemNFT.editItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_AXE,
          equipPosition: EstforTypes.EquipPosition.LEFT_HAND,
        },
      ])
    ).to.be.revertedWithCustomError(itemNFT, "EquipmentPositionShouldNotChange");

    // Unless going from right hand to both hands or both hands to right hand
    await expect(
      itemNFT.editItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_AXE,
          equipPosition: EstforTypes.EquipPosition.BOTH_HANDS,
        },
      ])
    ).to.not.be.reverted;
    await expect(
      itemNFT.editItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_AXE,
          equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
        },
      ])
    ).to.not.be.reverted;

    await expect(
      itemNFT.editItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_ARMOR,
          equipPosition: EstforTypes.EquipPosition.LEFT_HAND,
        },
      ])
    ).to.be.revertedWithCustomError(itemNFT, "ItemDoesNotExist");

    await itemNFT.editItems([
      {
        ...EstforTypes.defaultItemInput,
        minXP: 100,
        tokenId: EstforConstants.BRONZE_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      },
    ]);

    let item = await itemNFT.getItem(EstforConstants.BRONZE_AXE);
    expect(item.minXP).to.be.eq(100);

    await itemNFT.editItems([
      {
        ...EstforTypes.defaultItemInput,
        minXP: 200,
        tokenId: EstforConstants.BRONZE_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      },
    ]);

    item = await itemNFT.getItem(EstforConstants.BRONZE_AXE);
    expect(item.minXP).to.be.eq(200);
  });

  it("Transferable NFT", async function () {
    const {itemNFT, alice, owner} = await loadFixture(deployContracts);

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      },
    ]);

    await itemNFT.testMint(alice.address, EstforConstants.BRONZE_AXE, 1);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_AXE)).to.be.eq(1);
    await itemNFT.connect(alice).safeTransferFrom(alice.address, owner.address, EstforConstants.BRONZE_AXE, 1, "0x");
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_AXE)).to.be.eq(0);
  });

  it("Non-transferable NFT", async function () {
    const {itemNFT, alice, owner} = await loadFixture(deployContracts);

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_AXE,
        isTransferable: false, // Cannot be transferred
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      },
    ]);

    await itemNFT.testMint(alice.address, EstforConstants.BRONZE_AXE, 1);
    await expect(
      itemNFT.connect(alice).safeTransferFrom(alice.address, owner.address, EstforConstants.BRONZE_AXE, 1, "0x")
    ).to.be.revertedWithCustomError(itemNFT, "ItemNotTransferable");

    // Allow it to be burnt
    await expect(itemNFT.connect(alice).burn(EstforConstants.BRONZE_AXE, 1));
  });

  it("totalSupply", async function () {
    const {itemNFT, alice} = await loadFixture(deployContracts);

    await itemNFT.testMint(alice.address, EstforConstants.BRONZE_AXE, 3);
    expect(await itemNFT["totalSupply()"]()).to.be.eq(1);
    expect(await itemNFT["totalSupply(uint256)"](EstforConstants.BRONZE_AXE)).to.be.eq(3);
    await itemNFT.testMint(alice.address, EstforConstants.BRONZE_AXE, 1);
    expect(await itemNFT["totalSupply()"]()).to.be.eq(1);
    await itemNFT.testMint(alice.address, EstforConstants.BRONZE_ARMOR, 1);
    expect(await itemNFT["totalSupply()"]()).to.be.eq(2);
    await itemNFT.connect(alice).burn(alice.address, EstforConstants.BRONZE_AXE, 3);
    expect(await itemNFT["totalSupply()"]()).to.be.eq(2);
    await itemNFT.connect(alice).burn(alice.address, EstforConstants.BRONZE_AXE, 1);
    expect(await itemNFT["totalSupply()"]()).to.be.eq(1);
    await itemNFT.testMint(alice.address, EstforConstants.BRONZE_AXE, 1);
    expect(await itemNFT["totalSupply()"]()).to.be.eq(2);
    await itemNFT.connect(alice).burn(alice.address, EstforConstants.BRONZE_AXE, 1);
    expect(await itemNFT["totalSupply()"]()).to.be.eq(1);
    await itemNFT.connect(alice).burn(alice.address, EstforConstants.BRONZE_ARMOR, 1);
    expect(await itemNFT["totalSupply()"]()).to.be.eq(0);
    await itemNFT.testMint(alice.address, EstforConstants.BRONZE_ARMOR, 1);
    expect(await itemNFT["totalSupply()"]()).to.be.eq(1);
    expect(await itemNFT["totalSupply(uint256)"](EstforConstants.BRONZE_ARMOR)).to.be.eq(1);
  });

  it("airdrop", async function () {
    // Only owner can do it
    const {itemNFT, owner, alice} = await loadFixture(deployContracts);

    await itemNFT.airdrop([owner.address, alice.address], EstforConstants.BRONZE_AXE, [1, 2]);

    expect(await itemNFT.balanceOf(owner.address, EstforConstants.BRONZE_AXE)).to.eq(1);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_AXE)).to.eq(2);

    await itemNFT.airdrop([alice.address], EstforConstants.BRONZE_AXE, [3]);
    expect(await itemNFT.balanceOf(owner.address, EstforConstants.BRONZE_AXE)).to.eq(1); // Unchanged
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_AXE)).to.eq(5);

    await expect(
      itemNFT.connect(alice).airdrop([alice.address], EstforConstants.BRONZE_AXE, [3])
    ).to.be.revertedWithCustomError(itemNFT, "CallerIsNotOwner");
  });

  it("IsApprovedForAll override", async function () {
    const {itemNFT, owner, alice} = await loadFixture(deployContracts);

    await itemNFT.testMint(owner.address, EstforConstants.BRONZE_AXE, 3);
    await expect(
      itemNFT.connect(alice).safeTransferFrom(owner.address, alice.address, EstforConstants.BRONZE_AXE, 1, "0x")
    ).to.be.revertedWithCustomError(itemNFT, "ERC1155TransferFromNotApproved");

    await itemNFT.setBazaar(alice.address);
    await expect(
      itemNFT.connect(alice).safeTransferFrom(owner.address, alice.address, EstforConstants.BRONZE_AXE, 1, "0x")
    ).to.not.be.reverted;
  });

  it("name & symbol", async function () {
    const {itemNFT, world, shop, royaltyReceiver, adminAccess} = await loadFixture(deployContracts);
    expect(await itemNFT.name()).to.be.eq("Estfor Items (Beta)");
    expect(await itemNFT.symbol()).to.be.eq("EK_IB");

    const isBeta = false;
    const ItemNFTLibrary = await ethers.getContractFactory("ItemNFTLibrary");
    const itemNFTLibrary = await ItemNFTLibrary.deploy();
    const ItemNFT = await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: itemNFTLibrary.address}});
    const itemsUri = "ipfs://";
    const itemNFTNotBeta = await upgrades.deployProxy(
      ItemNFT,
      [world.address, shop.address, royaltyReceiver.address, adminAccess.address, itemsUri, isBeta],
      {
        kind: "uups",
        unsafeAllow: ["external-library-linking"],
      }
    );
    expect(await itemNFTNotBeta.name()).to.be.eq("Estfor Items");
    expect(await itemNFTNotBeta.symbol()).to.be.eq("EK_I");
  });
});
