import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {setDailyAndWeeklyRewards} from "../scripts/utils";
import {AdminAccess, ItemNFT, RoyaltyReceiver, Treasury, World} from "../typechain-types";

describe("ItemNFT", function () {
  async function deployContracts() {
    const [owner, alice, dev] = await ethers.getSigners();

    const brush = await ethers.deployContract("MockBrushToken");
    const mockVRF = await ethers.deployContract("MockVRF");

    // Add some dummy blocks so that world can access previous blocks for random numbers
    for (let i = 0; i < 5; ++i) {
      await owner.sendTransaction({
        to: owner.getAddress(),
        value: 1,
        maxFeePerGas: 1
      });
    }

    // Create the world
    const worldLibrary = await ethers.deployContract("WorldLibrary");
    const World = await ethers.getContractFactory("World", {
      libraries: {WorldLibrary: await worldLibrary.getAddress()}
    });
    const world = (await upgrades.deployProxy(World, [await mockVRF.getAddress()], {
      kind: "uups",
      unsafeAllow: ["delegatecall", "external-library-linking"]
    })) as unknown as World;

    await setDailyAndWeeklyRewards(world);

    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = (await upgrades.deployProxy(Treasury, [await brush.getAddress()], {
      kind: "uups"
    })) as unknown as Treasury;

    const minItemQuantityBeforeSellsAllowed = 500n;
    const sellingCutoffDuration = 48 * 3600; // 48 hours
    const Shop = await ethers.getContractFactory("Shop");
    const shop = await upgrades.deployProxy(
      Shop,
      [
        await brush.getAddress(),
        await treasury.getAddress(),
        await dev.getAddress(),
        minItemQuantityBeforeSellsAllowed,
        sellingCutoffDuration
      ],
      {
        kind: "uups"
      }
    );

    const router = await ethers.deployContract("MockRouter");
    const RoyaltyReceiver = await ethers.getContractFactory("RoyaltyReceiver");
    const royaltyReceiver = (await upgrades.deployProxy(
      RoyaltyReceiver,
      [
        await router.getAddress(),
        await shop.getAddress(),
        await dev.getAddress(),
        await brush.getAddress(),
        await alice.getAddress()
      ],
      {
        kind: "uups"
      }
    )) as unknown as RoyaltyReceiver;

    const admins = [await owner.getAddress(), await alice.getAddress()];
    const promotionalAdmins = [await alice.getAddress()];
    const AdminAccess = await ethers.getContractFactory("AdminAccess");
    const adminAccess = (await upgrades.deployProxy(AdminAccess, [admins, promotionalAdmins], {
      kind: "uups"
    })) as unknown as AdminAccess;

    const isBeta = true;
    const itemNFTLibrary = await ethers.deployContract("ItemNFTLibrary");
    const ItemNFT = await ethers.getContractFactory("ItemNFT", {
      libraries: {ItemNFTLibrary: await itemNFTLibrary.getAddress()}
    });
    const itemsUri = "ipfs://";
    const itemNFT = (await upgrades.deployProxy(
      ItemNFT,
      [
        await world.getAddress(),
        await shop.getAddress(),
        await royaltyReceiver.getAddress(),
        await adminAccess.getAddress(),
        itemsUri,
        isBeta
      ],
      {
        kind: "uups",
        unsafeAllow: ["external-library-linking"]
      }
    )) as unknown as ItemNFT;

    return {
      itemNFT,
      brush,
      owner,
      alice,
      dev,
      world,
      mockVRF,
      shop,
      royaltyReceiver,
      adminAccess,
      itemNFTLibrary
    };
  }

  describe("supportsInterface", async function () {
    it("IERC165", async function () {
      const {itemNFT} = await loadFixture(deployContracts);
      expect(await itemNFT.supportsInterface("0x01ffc9a7")).to.be.true;
    });

    it("IERC1155", async function () {
      const {itemNFT} = await loadFixture(deployContracts);
      expect(await itemNFT.supportsInterface("0xd9b67a26")).to.be.true;
    });

    it("IERC1155Metadata", async function () {
      const {itemNFT} = await loadFixture(deployContracts);
      expect(await itemNFT.supportsInterface("0x0e89341c")).to.be.true;
    });

    it("IERC2981 royalties", async function () {
      const {itemNFT} = await loadFixture(deployContracts);
      expect(await itemNFT.supportsInterface("0x2a55205a")).to.be.true;
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
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
      }
    ]);

    // Change equipPosition should fail
    await expect(
      itemNFT.editItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_AXE,
          equipPosition: EstforTypes.EquipPosition.LEFT_HAND
        }
      ])
    ).to.be.revertedWithCustomError(itemNFT, "EquipmentPositionShouldNotChange");

    // Unless going from right hand to both hands or both hands to right hand
    await expect(
      itemNFT.editItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_AXE,
          equipPosition: EstforTypes.EquipPosition.BOTH_HANDS
        }
      ])
    ).to.not.be.reverted;
    await expect(
      itemNFT.editItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_AXE,
          equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
        }
      ])
    ).to.not.be.reverted;

    await expect(
      itemNFT.editItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BRONZE_ARMOR,
          equipPosition: EstforTypes.EquipPosition.LEFT_HAND
        }
      ])
    ).to.be.revertedWithCustomError(itemNFT, "ItemDoesNotExist");

    await itemNFT.editItems([
      {
        ...EstforTypes.defaultItemInput,
        minXP: 100,
        tokenId: EstforConstants.BRONZE_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
      }
    ]);

    let item = await itemNFT.getItem(EstforConstants.BRONZE_AXE);
    expect(item.minXP).to.be.eq(100);

    await itemNFT.editItems([
      {
        ...EstforTypes.defaultItemInput,
        minXP: 200,
        tokenId: EstforConstants.BRONZE_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
      }
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
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
      }
    ]);

    await itemNFT.testMint(alice.getAddress(), EstforConstants.BRONZE_AXE, 1);
    expect(await itemNFT.balanceOf(alice.getAddress(), EstforConstants.BRONZE_AXE)).to.be.eq(1);
    await itemNFT
      .connect(alice)
      .safeTransferFrom(alice.getAddress(), owner.getAddress(), EstforConstants.BRONZE_AXE, 1, "0x");
    expect(await itemNFT.balanceOf(alice.getAddress(), EstforConstants.BRONZE_AXE)).to.be.eq(0);
  });

  it("Non-transferable NFT", async function () {
    const {itemNFT, alice, owner} = await loadFixture(deployContracts);

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_AXE,
        isTransferable: false, // Cannot be transferred
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
      }
    ]);

    await itemNFT.testMint(alice.getAddress(), EstforConstants.BRONZE_AXE, 1);
    await expect(
      itemNFT
        .connect(alice)
        .safeTransferFrom(alice.getAddress(), owner.getAddress(), EstforConstants.BRONZE_AXE, 1, "0x")
    ).to.be.revertedWithCustomError(itemNFT, "ItemNotTransferable");

    // Allow it to be burnt
    await expect(itemNFT.connect(alice).burn(alice.getAddress(), EstforConstants.BRONZE_AXE, 1)).to.not.be.reverted;
  });

  it("totalSupply", async function () {
    const {itemNFT, alice} = await loadFixture(deployContracts);

    await itemNFT.testMint(alice.getAddress(), EstforConstants.BRONZE_AXE, 3);
    expect(await itemNFT["totalSupply()"]()).to.be.eq(1);
    expect(await itemNFT["totalSupply(uint256)"](EstforConstants.BRONZE_AXE)).to.be.eq(3);
    await itemNFT.testMint(alice.getAddress(), EstforConstants.BRONZE_AXE, 1);
    expect(await itemNFT["totalSupply()"]()).to.be.eq(1);
    await itemNFT.testMint(alice.getAddress(), EstforConstants.BRONZE_ARMOR, 1);
    expect(await itemNFT["totalSupply()"]()).to.be.eq(2);
    await itemNFT.connect(alice).burn(alice.getAddress(), EstforConstants.BRONZE_AXE, 3);
    expect(await itemNFT["totalSupply()"]()).to.be.eq(2);
    await itemNFT.connect(alice).burn(alice.getAddress(), EstforConstants.BRONZE_AXE, 1);
    expect(await itemNFT["totalSupply()"]()).to.be.eq(1);
    await itemNFT.testMint(alice.getAddress(), EstforConstants.BRONZE_AXE, 1);
    expect(await itemNFT["totalSupply()"]()).to.be.eq(2);
    await itemNFT.connect(alice).burn(alice.getAddress(), EstforConstants.BRONZE_AXE, 1);
    expect(await itemNFT["totalSupply()"]()).to.be.eq(1);
    await itemNFT.connect(alice).burn(alice.getAddress(), EstforConstants.BRONZE_ARMOR, 1);
    expect(await itemNFT["totalSupply()"]()).to.be.eq(0);
    await itemNFT.testMint(alice.getAddress(), EstforConstants.BRONZE_ARMOR, 1);
    expect(await itemNFT["totalSupply()"]()).to.be.eq(1);
    expect(await itemNFT["totalSupply(uint256)"](EstforConstants.BRONZE_ARMOR)).to.be.eq(1);
  });

  it("airdrop", async function () {
    // Only owner can do it
    const {itemNFT, owner, alice} = await loadFixture(deployContracts);

    await itemNFT.airdrop([owner.getAddress(), alice.getAddress()], EstforConstants.BRONZE_AXE, [1, 2]);

    expect(await itemNFT.balanceOf(owner.getAddress(), EstforConstants.BRONZE_AXE)).to.eq(1);
    expect(await itemNFT.balanceOf(alice.getAddress(), EstforConstants.BRONZE_AXE)).to.eq(2);

    await itemNFT.airdrop([alice.getAddress()], EstforConstants.BRONZE_AXE, [3]);
    expect(await itemNFT.balanceOf(owner.getAddress(), EstforConstants.BRONZE_AXE)).to.eq(1); // Unchanged
    expect(await itemNFT.balanceOf(alice.getAddress(), EstforConstants.BRONZE_AXE)).to.eq(5);

    await expect(
      itemNFT.connect(alice).airdrop([alice.getAddress()], EstforConstants.BRONZE_AXE, [3])
    ).to.be.revertedWithCustomError(itemNFT, "CallerIsNotOwner");
  });

  it("IsApprovedForAll override", async function () {
    const {itemNFT, owner, alice} = await loadFixture(deployContracts);

    await itemNFT.testMint(owner.getAddress(), EstforConstants.BRONZE_AXE, 3);
    await expect(
      itemNFT
        .connect(alice)
        .safeTransferFrom(owner.getAddress(), alice.getAddress(), EstforConstants.BRONZE_AXE, 1, "0x")
    ).to.be.revertedWithCustomError(itemNFT, "ERC1155TransferFromNotApproved");

    await itemNFT.setBazaar(alice.getAddress());
    await expect(
      itemNFT
        .connect(alice)
        .safeTransferFrom(owner.getAddress(), alice.getAddress(), EstforConstants.BRONZE_AXE, 1, "0x")
    ).to.not.be.reverted;
  });

  it("name & symbol", async function () {
    const {itemNFT, world, shop, royaltyReceiver, adminAccess, itemNFTLibrary} = await loadFixture(deployContracts);
    expect(await itemNFT.name()).to.be.eq("Estfor Items (Beta)");
    expect(await itemNFT.symbol()).to.be.eq("EK_IB");

    const isBeta = false;
    const ItemNFT = await ethers.getContractFactory("ItemNFT", {
      libraries: {ItemNFTLibrary: await itemNFTLibrary.getAddress()}
    });
    const itemsUri = "ipfs://";
    const itemNFTNotBeta = await upgrades.deployProxy(
      ItemNFT,
      [
        await world.getAddress(),
        await shop.getAddress(),
        await royaltyReceiver.getAddress(),
        await adminAccess.getAddress(),
        itemsUri,
        isBeta
      ],
      {
        kind: "uups",
        unsafeAllow: ["external-library-linking"]
      }
    );
    expect(await itemNFTNotBeta.name()).to.be.eq("Estfor Items");
    expect(await itemNFTNotBeta.symbol()).to.be.eq("EK_I");
  });

  it("Transfer of items to many different users at once", async function () {
    const {itemNFT, owner, alice, dev} = await loadFixture(deployContracts);

    const ownerAddress = await owner.getAddress();
    await itemNFT.testMint(ownerAddress, EstforConstants.TITANIUM_AXE, 2); // to alice
    await itemNFT.testMint(ownerAddress, EstforConstants.IRON_AXE, 3); // to dev
    await itemNFT.testMint(ownerAddress, EstforConstants.MITHRIL_AXE, 1); // Don't transfer this

    await itemNFT.testMint(ownerAddress, EstforConstants.ADAMANTINE_AXE, 4); // to dev
    await itemNFT.testMint(ownerAddress, EstforConstants.RUNITE_AXE, 3); // to alice (only send 1)
    await itemNFT.testMint(ownerAddress, EstforConstants.ORICHALCUM_AXE, 2); // to alice

    const tokenIds = [
      EstforConstants.TITANIUM_AXE,
      EstforConstants.IRON_AXE,
      EstforConstants.ADAMANTINE_AXE,
      EstforConstants.RUNITE_AXE,
      EstforConstants.ORICHALCUM_AXE
    ];
    const [devAddress, aliceAddress] = await Promise.all([dev.getAddress(), alice.getAddress()]);
    const tos = [aliceAddress, devAddress, devAddress, aliceAddress, aliceAddress];
    const amounts = [2, 3, 4, 1, 2];

    // Turn this into expected transfer nft object
    const nftInfos = [];
    for (let i = 0; i < tokenIds.length; ++i) {
      const tokenId = tokenIds[i];
      const to = tos[i];
      const amount = amounts[i];

      let exists = false;
      for (let j = 0; j < nftInfos.length; ++j) {
        const nftInfo: any = nftInfos[j];
        if (to == nftInfo.to) {
          // Already exists
          exists = true;
          nftInfo.tokenIds.push(tokenId);
          nftInfo.amounts.push(amount);
          break;
        }
      }

      if (!exists) {
        nftInfos.push({tokenIds: [tokenId], amounts: [amount], to: to});
      }
    }

    await itemNFT.safeBulkTransfer(nftInfos);

    // Check balances of the NFTs are as expected
    expect(
      await itemNFT.balanceOfs(alice.getAddress(), [
        EstforConstants.TITANIUM_AXE,
        EstforConstants.RUNITE_AXE,
        EstforConstants.ORICHALCUM_AXE
      ])
    ).to.deep.eq([2, 1, 2]);

    expect(
      await itemNFT.balanceOfs(dev.getAddress(), [EstforConstants.IRON_AXE, EstforConstants.ADAMANTINE_AXE])
    ).to.deep.eq([3, 4]);

    expect(await itemNFT.balanceOf(owner.getAddress(), EstforConstants.MITHRIL_AXE)).to.eq(1);
  });
});
