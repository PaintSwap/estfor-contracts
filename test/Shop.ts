import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {BRONZE_SHIELD} from "@paintswap/estfor-definitions/constants";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {AdminAccess, ItemNFT, RoyaltyReceiver, Shop, World} from "../typechain-types";
import {setDailyAndWeeklyRewards} from "../scripts/utils";

describe("Shop", function () {
  const SHOP_VOID_ADDRESS = "0x8bc76F10a3cD0bCd57101950cfA8fD88c06DFfdB"; // TODO Remove when in-game shop selling is removed.

  const deployContracts = async function () {
    // Contracts are deployed using the first signer/account by default
    const [owner, alice, bob, charlie, dev] = await ethers.getSigners();

    const brush = await ethers.deployContract("MockBrushToken");
    const mockVRF = await ethers.deployContract("MockVRF");

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
    const World = await ethers.getContractFactory("World", {libraries: {WorldLibrary: worldLibrary.address}});
    const world = (await upgrades.deployProxy(World, [mockVRF.address], {
      kind: "uups",
      unsafeAllow: ["delegatecall", "external-library-linking"],
    })) as World;

    await setDailyAndWeeklyRewards(world);

    const Shop = await ethers.getContractFactory("Shop");
    const shop = (await upgrades.deployProxy(Shop, [brush.address, dev.address], {
      kind: "uups",
    })) as Shop;

    const router = await ethers.deployContract("MockRouter");
    const RoyaltyReceiver = await ethers.getContractFactory("RoyaltyReceiver");
    const royaltyReceiver = (await upgrades.deployProxy(
      RoyaltyReceiver,
      [router.address, shop.address, dev.address, brush.address, alice.address],
      {
        kind: "uups",
      }
    )) as RoyaltyReceiver;
    await royaltyReceiver.deployed();

    const admins = [owner.address, alice.address];
    const AdminAccess = await ethers.getContractFactory("AdminAccess");
    const adminAccess = (await upgrades.deployProxy(AdminAccess, [admins, admins], {
      kind: "uups",
    })) as AdminAccess;
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

    await shop.setItemNFT(itemNFT.address);

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_SHIELD,
        equipPosition: EstforTypes.EquipPosition.LEFT_HAND,
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_SWORD,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.RAW_MINNUS,
        equipPosition: EstforTypes.EquipPosition.FOOD,
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.SAPPHIRE_AMULET,
        equipPosition: EstforTypes.EquipPosition.NECK,
      },
    ]);

    const sellingCutoffDuration = (await shop.SELLING_CUTOFF_DURATION()).toNumber();
    const minItemQuantityBeforeSellsAllowed = await shop.minItemQuantityBeforeSellsAllowed();

    return {
      itemNFT,
      shop,
      brush,
      owner,
      alice,
      bob,
      sellingCutoffDuration,
      minItemQuantityBeforeSellsAllowed,
    };
  };

  it("Set up shop", async function () {
    const {shop} = await loadFixture(deployContracts);
    await shop.addBuyableItem({tokenId: EstforConstants.BRONZE_SHIELD, price: 500});

    // Check that it's in the shop
    expect(await shop.shopItems(EstforConstants.BRONZE_SHIELD)).to.eq(500);

    // Update price
    await expect(
      shop.addBuyableItem({tokenId: EstforConstants.BRONZE_SHIELD, price: 400})
    ).to.be.revertedWithCustomError(shop, "ShopItemAlreadyExists");
    await shop.editItems([{tokenId: EstforConstants.BRONZE_SHIELD, price: 400}]);
    expect(await shop.shopItems(EstforConstants.BRONZE_SHIELD)).to.eq(400);

    await expect(
      shop.addBuyableItems([
        {tokenId: EstforConstants.BRONZE_SHIELD, price: 200},
        {tokenId: EstforConstants.RAW_MINNUS, price: 400},
        {tokenId: EstforConstants.BRONZE_SWORD, price: 10},
      ])
    ).to.be.revertedWithCustomError(shop, "ShopItemAlreadyExists");

    // Doesn't exist
    expect(await shop.shopItems(9999)).to.eq(0);
  });

  it("Set up shop batch ", async function () {
    const {shop} = await loadFixture(deployContracts);
    await shop.addBuyableItems([
      {tokenId: EstforConstants.BRONZE_SHIELD, price: 500},
      {tokenId: EstforConstants.RAW_MINNUS, price: 300},
    ]);

    // Check that it's in the shop
    expect(await shop.shopItems(EstforConstants.BRONZE_SHIELD)).to.eq(500);
    expect(await shop.shopItems(EstforConstants.RAW_MINNUS)).to.eq(300);

    await expect(
      shop.addBuyableItems([
        {tokenId: EstforConstants.BRONZE_SHIELD, price: 200},
        {tokenId: EstforConstants.RAW_MINNUS, price: 400},
      ])
    ).to.be.revertedWithCustomError(shop, "ShopItemAlreadyExists");

    // Replacing should work
    await expect(
      shop.editItems([
        {tokenId: EstforConstants.BRONZE_SHIELD, price: 200},
        {tokenId: EstforConstants.RAW_MINNUS, price: 400},
        {tokenId: EstforConstants.BRONZE_SWORD, price: 10},
      ])
    ).to.be.revertedWithCustomError(shop, "ShopItemDoesNotExist");
    await shop.addBuyableItems([{tokenId: EstforConstants.BRONZE_SWORD, price: 20}]);
    await shop.editItems([
      {tokenId: EstforConstants.BRONZE_SHIELD, price: 300},
      {tokenId: EstforConstants.RAW_MINNUS, price: 400},
      {tokenId: EstforConstants.BRONZE_SWORD, price: 10},
    ]);

    // Check that it's in the shop
    expect(await shop.shopItems(EstforConstants.BRONZE_SHIELD)).to.eq(300);
    expect(await shop.shopItems(EstforConstants.RAW_MINNUS)).to.eq(400);
    expect(await shop.shopItems(EstforConstants.BRONZE_SWORD)).to.eq(10);
  });

  it("Set up shop with items which don't exist", async function () {
    const {shop} = await loadFixture(deployContracts);
    await expect(
      shop.addBuyableItem({tokenId: EstforConstants.TITANIUM_ARMOR, price: 500})
    ).to.be.revertedWithCustomError(shop, "ItemDoesNotExist");
    await expect(
      shop.addBuyableItems([{tokenId: EstforConstants.TITANIUM_ARMOR, price: 500}])
    ).to.be.revertedWithCustomError(shop, "ItemDoesNotExist");
  });

  it("Set up shop with 0 prices is not allowed", async function () {
    const {shop} = await loadFixture(deployContracts);
    await expect(shop.addBuyableItem({tokenId: EstforConstants.BRONZE_SHIELD, price: 0})).to.be.revertedWithCustomError(
      shop,
      "PriceCannotBeZero"
    );
    await expect(
      shop.addBuyableItems([{tokenId: EstforConstants.BRONZE_SHIELD, price: 0}])
    ).to.be.revertedWithCustomError(shop, "PriceCannotBeZero");
  });

  it("Buy", async function () {
    const {itemNFT, shop, brush, alice} = await loadFixture(deployContracts);
    await shop.addBuyableItem({tokenId: EstforConstants.BRONZE_SHIELD, price: 500});

    const quantityBought = 2;
    // Hasn't approved brush yet
    await expect(shop.connect(alice).buy(alice.address, EstforConstants.BRONZE_SHIELD, quantityBought)).to.be.reverted;

    await brush.mint(alice.address, 1000);
    await brush.connect(alice).approve(shop.address, 1000);
    await expect(shop.connect(alice).buy(alice.address, EstforConstants.BRONZE_SHIELD, quantityBought))
      .to.emit(shop, "Buy")
      .withArgs(alice.address, alice.address, EstforConstants.BRONZE_SHIELD, quantityBought, 500);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_SHIELD)).to.eq(quantityBought);
  });

  it("Buy batch", async function () {
    const {itemNFT, shop, brush, alice} = await loadFixture(deployContracts);
    await shop.addBuyableItem({tokenId: EstforConstants.BRONZE_SHIELD, price: 500});
    await shop.addBuyableItem({tokenId: EstforConstants.SAPPHIRE_AMULET, price: 200});

    await brush.mint(alice.address, 900);
    await brush.connect(alice).approve(shop.address, 900);
    await expect(
      shop
        .connect(alice)
        .buyBatch(alice.address, [EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET], [1, 2])
    )
      .to.emit(shop, "BuyBatch")
      .withArgs(
        alice.address,
        alice.address,
        [EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET],
        [1, 2],
        [500, 200]
      );
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_SHIELD)).to.eq(1);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.SAPPHIRE_AMULET)).to.eq(2);
  });

  it("Gift", async function () {
    const {itemNFT, shop, brush, alice, bob} = await loadFixture(deployContracts);
    await shop.addBuyableItem({tokenId: EstforConstants.BRONZE_SHIELD, price: 500});

    const quantityBought = 2;
    // Hasn't approved brush yet
    await expect(shop.connect(alice).buy(bob.address, EstforConstants.BRONZE_SHIELD, quantityBought)).to.be.reverted;

    await brush.mint(alice.address, 1000);
    await brush.connect(alice).approve(shop.address, 1000);
    await expect(shop.connect(alice).buy(bob.address, EstforConstants.BRONZE_SHIELD, quantityBought))
      .to.emit(shop, "Buy")
      .withArgs(alice.address, bob.address, EstforConstants.BRONZE_SHIELD, quantityBought, 500);
    expect(await itemNFT.balanceOf(bob.address, EstforConstants.BRONZE_SHIELD)).to.eq(quantityBought);
  });

  it("Gift batch", async function () {
    const {itemNFT, shop, brush, alice, bob} = await loadFixture(deployContracts);
    await shop.addBuyableItem({tokenId: EstforConstants.BRONZE_SHIELD, price: 500});
    await shop.addBuyableItem({tokenId: EstforConstants.SAPPHIRE_AMULET, price: 200});

    await brush.mint(alice.address, 900);
    await brush.connect(alice).approve(shop.address, 900);
    await expect(
      shop
        .connect(alice)
        .buyBatch(bob.address, [EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET], [1, 2])
    )
      .to.emit(shop, "BuyBatch")
      .withArgs(
        alice.address,
        bob.address,
        [EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET],
        [1, 2],
        [500, 200]
      );
    expect(await itemNFT.balanceOf(bob.address, EstforConstants.BRONZE_SHIELD)).to.eq(1);
    expect(await itemNFT.balanceOf(bob.address, EstforConstants.SAPPHIRE_AMULET)).to.eq(2);
  });

  it("Sell", async function () {
    const {itemNFT, shop, brush, alice, sellingCutoffDuration, minItemQuantityBeforeSellsAllowed} = await loadFixture(
      deployContracts
    );

    await itemNFT.testMint(alice.address, EstforConstants.BRONZE_SHIELD, minItemQuantityBeforeSellsAllowed * 2);
    await itemNFT.testMint(alice.address, EstforConstants.SAPPHIRE_AMULET, minItemQuantityBeforeSellsAllowed);
    expect(await itemNFT["totalSupply()"]()).to.eq(2);

    expect(await shop.liquidatePrice(EstforConstants.BRONZE_SHIELD)).to.eq(0);

    // Give the contract some brush to assign to the items
    const totalBrush = minItemQuantityBeforeSellsAllowed * 20;
    await brush.mint(shop.address, totalBrush);

    const splitBrush = totalBrush / 2;
    const priceShield = splitBrush / (minItemQuantityBeforeSellsAllowed * 2);
    expect((await shop.liquidatePrice(EstforConstants.BRONZE_SHIELD)).toNumber()).to.eq(priceShield);

    const priceSapphireAmulet = splitBrush / minItemQuantityBeforeSellsAllowed;
    expect(await shop.liquidatePrices([EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET])).to.eql([
      ethers.BigNumber.from(priceShield),
      ethers.BigNumber.from(priceSapphireAmulet),
    ]);
    await ethers.provider.send("evm_increaseTime", [sellingCutoffDuration]);
    await expect(shop.connect(alice).sell(EstforConstants.BRONZE_SHIELD, 1, priceShield))
      .to.emit(shop, "Sell")
      .withArgs(alice.address, EstforConstants.BRONZE_SHIELD, 1, priceShield)
      .and.to.emit(itemNFT, "TransferSingle")
      .withArgs(shop.address, alice.address, SHOP_VOID_ADDRESS, EstforConstants.BRONZE_SHIELD, 1);

    // Item should get transferred to the dead address, and they should get the amount of brush expected. Balance remains the same
    expect(await itemNFT.itemBalances(EstforConstants.BRONZE_SHIELD)).to.eq(minItemQuantityBeforeSellsAllowed * 2);
    expect(await brush.balanceOf(alice.address)).to.eq(priceShield);
  });

  it("Sell Batch", async function () {
    const {itemNFT, shop, brush, alice, sellingCutoffDuration, minItemQuantityBeforeSellsAllowed} = await loadFixture(
      deployContracts
    );

    await itemNFT.testMints(
      alice.address,
      [EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET],
      [minItemQuantityBeforeSellsAllowed * 2, minItemQuantityBeforeSellsAllowed]
    );

    // Give the contract some brush to assign to the items
    const totalBrush = minItemQuantityBeforeSellsAllowed * 20;
    await brush.mint(shop.address, totalBrush);

    const splitBrush = totalBrush / 2;
    const priceShield = splitBrush / (minItemQuantityBeforeSellsAllowed * 2);
    const priceSapphireAmulet = splitBrush / minItemQuantityBeforeSellsAllowed;

    const expectedTotal = priceShield + 2 * priceSapphireAmulet;
    await ethers.provider.send("evm_increaseTime", [sellingCutoffDuration]);
    await expect(
      shop
        .connect(alice)
        .sellBatch([EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET], [1, 2], expectedTotal)
    )
      .to.emit(shop, "SellBatch")
      .withArgs(
        alice.address,
        [EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET],
        [1, 2],
        [priceShield, priceSapphireAmulet]
      )
      .and.to.emit(itemNFT, "TransferBatch")
      .withArgs(
        shop.address,
        alice.address,
        SHOP_VOID_ADDRESS,
        [EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET],
        [1, 2]
      );

    // Item balances should not change
    expect(await itemNFT.itemBalances(EstforConstants.BRONZE_SHIELD)).to.eq(minItemQuantityBeforeSellsAllowed * 2);
    expect(await itemNFT.itemBalances(EstforConstants.SAPPHIRE_AMULET)).to.eq(minItemQuantityBeforeSellsAllowed);
    expect(await brush.balanceOf(alice.address)).to.eq(expectedTotal);
  });

  it("Sell Slippage", async function () {
    const {itemNFT, shop, brush, alice, sellingCutoffDuration, minItemQuantityBeforeSellsAllowed} = await loadFixture(
      deployContracts
    );

    await itemNFT.testMints(
      alice.address,
      [EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET],
      [minItemQuantityBeforeSellsAllowed * 2, minItemQuantityBeforeSellsAllowed]
    );

    // Give the contract some brush to assign to the items
    const totalBrush = minItemQuantityBeforeSellsAllowed * 20;
    await brush.mint(shop.address, totalBrush);

    const splitBrush = totalBrush / 2;
    const priceShield = splitBrush / (minItemQuantityBeforeSellsAllowed * 2);
    const priceSapphireAmulet = splitBrush / minItemQuantityBeforeSellsAllowed;

    const expectedTotal = priceShield + 2 * priceSapphireAmulet;
    await ethers.provider.send("evm_increaseTime", [sellingCutoffDuration]);

    // Asking for too much
    await expect(
      shop
        .connect(alice)
        .sellBatch([EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET], [1, 2], expectedTotal + 1)
    ).to.be.reverted;

    // Lets have a 1% slippage
    const minExpected = ethers.BigNumber.from(expectedTotal).mul(9900).div(10000);
    expect(minExpected).to.eq(24);

    await shop
      .connect(alice)
      .sellBatch([EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET], [1, 2], minExpected);

    expect(await brush.balanceOf(alice.address)).to.greaterThan(minExpected);
  });

  it("Can't sell for more than you can buy in shop", async function () {
    const {itemNFT, shop, brush, alice, sellingCutoffDuration, minItemQuantityBeforeSellsAllowed} = await loadFixture(
      deployContracts
    );

    await itemNFT.testMint(alice.address, EstforConstants.BRONZE_SHIELD, minItemQuantityBeforeSellsAllowed * 2);
    expect(await itemNFT["totalSupply()"]()).to.eq(1);

    await shop.addBuyableItem({tokenId: EstforConstants.BRONZE_SHIELD, price: 1});

    // Give the contract some brush to assign to the items
    const totalBrush = ethers.utils.parseEther("1");
    await brush.mint(shop.address, totalBrush);
    expect(await shop.liquidatePrice(EstforConstants.BRONZE_SHIELD)).to.be.gt(1);
    await ethers.provider.send("evm_increaseTime", [sellingCutoffDuration]);

    await expect(shop.connect(alice).sell(EstforConstants.BRONZE_SHIELD, 1, 0)).to.be.revertedWithCustomError(
      shop,
      "LiquidatePriceIsHigherThanShop"
    );

    await expect(shop.connect(alice).sellBatch([EstforConstants.BRONZE_SHIELD], [1], 0)).to.be.revertedWithCustomError(
      shop,
      "LiquidatePriceIsHigherThanShop"
    );
  });

  it("Cannot sell within the cutoff time period", async function () {
    const {itemNFT, shop, brush, alice, minItemQuantityBeforeSellsAllowed} = await loadFixture(deployContracts);

    await itemNFT.testMint(alice.address, EstforConstants.BRONZE_SHIELD, minItemQuantityBeforeSellsAllowed * 2);

    // Give the contract some brush to assign to the items
    const totalBrush = ethers.utils.parseEther("1");
    await brush.mint(shop.address, totalBrush);
    await expect(shop.connect(alice).sellBatch([EstforConstants.BRONZE_SHIELD], [1], 0)).to.be.revertedWithCustomError(
      shop,
      "SellingTooQuicklyAfterItemIntroduction"
    );
  });

  it("Exceed selling allocation", async function () {
    const {itemNFT, shop, brush, alice, sellingCutoffDuration, minItemQuantityBeforeSellsAllowed} = await loadFixture(
      deployContracts
    );

    await itemNFT.testMint(alice.address, EstforConstants.BRONZE_SHIELD, 1000);
    await itemNFT.testMint(alice.address, EstforConstants.BARRAGE_SCROLL, 1000);
    await ethers.provider.send("evm_increaseTime", [sellingCutoffDuration]);

    // Give the contract some brush to assign to the items
    const totalBrush = ethers.utils.parseEther("1");
    await brush.mint(shop.address, totalBrush);

    let tokenAllocation = await shop.tokenInfos(EstforConstants.BRONZE_SHIELD); // Empty
    expect(tokenAllocation.allocationRemaining).to.eq(0);
    await expect(shop.connect(alice).sell(EstforConstants.BRONZE_SHIELD, 1, 0))
      .to.emit(shop, "NewAllocation")
      .withArgs(EstforConstants.BRONZE_SHIELD, totalBrush.div(2));
    tokenAllocation = await shop.tokenInfos(EstforConstants.BRONZE_SHIELD);
    expect(tokenAllocation.allocationRemaining).to.eq(
      ethers.utils.parseEther("0.5").sub(ethers.utils.parseEther("0.5").div(1000))
    );
    expect((await shop.tokenInfos(EstforConstants.BARRAGE_SCROLL)).allocationRemaining).to.eq(0); // shouldn't have changed

    const tokenPrice = await shop.liquidatePrice(EstforConstants.BRONZE_SHIELD);
    expect(tokenPrice).to.be.gt(0);

    // Sell all but 1, should be minimal allocation left
    await expect(shop.connect(alice).sell(EstforConstants.BRONZE_SHIELD, 997, 0)).to.not.emit(shop, "NewAllocation");
    tokenAllocation = await shop.tokenInfos(EstforConstants.BRONZE_SHIELD);
    let allocationRemaining = tokenPrice.mul(2);
    expect(tokenAllocation.allocationRemaining).to.eq(allocationRemaining);

    expect(await shop.liquidatePrice(EstforConstants.BRONZE_SHIELD)).to.be.eq(tokenPrice);
    await shop.connect(alice).sell(EstforConstants.BRONZE_SHIELD, 1, 0);
    tokenAllocation = await shop.tokenInfos(EstforConstants.BRONZE_SHIELD);
    expect(tokenAllocation.allocationRemaining).to.eq(allocationRemaining.sub(tokenPrice));

    // Mint some, should fail to sell any as allocation is used up
    await itemNFT.testMint(alice.address, EstforConstants.BRONZE_SHIELD, minItemQuantityBeforeSellsAllowed);
    await expect(shop.connect(alice).sell(EstforConstants.BRONZE_SHIELD, 3, 0))
      .to.be.revertedWithCustomError(shop, "NotEnoughAllocationRemaining")
      .withArgs(EstforConstants.BRONZE_SHIELD, tokenPrice.mul(3), allocationRemaining.sub(tokenPrice));
  });

  it("Allocation resets after 00:00 UTC", async function () {
    const {itemNFT, shop, brush, alice, sellingCutoffDuration} = await loadFixture(deployContracts);

    await itemNFT.testMint(alice.address, EstforConstants.BRONZE_SHIELD, 1000);
    await itemNFT.testMint(alice.address, EstforConstants.BARRAGE_SCROLL, 1000);
    await ethers.provider.send("evm_increaseTime", [sellingCutoffDuration]);

    // Give the contract some brush to assign to the items
    const totalBrush = ethers.utils.parseEther("1");
    await brush.mint(shop.address, totalBrush);

    let tokenAllocation = await shop.tokenInfos(EstforConstants.BRONZE_SHIELD); // Empty
    expect(tokenAllocation.allocationRemaining).to.eq(0);
    await shop.connect(alice).sell(EstforConstants.BRONZE_SHIELD, 1, 0);
    const {timestamp: NOW} = await ethers.provider.getBlock("latest");
    tokenAllocation = await shop.tokenInfos(EstforConstants.BRONZE_SHIELD); // Empty
    expect(tokenAllocation.allocationRemaining).to.eq(
      ethers.utils.parseEther("0.5").sub(ethers.utils.parseEther("0.5").div(1000))
    );
    expect(tokenAllocation.checkpointTimestamp).to.eq(Math.floor(NOW / 86400) * 86400);
    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await shop.connect(alice).sell(EstforConstants.BRONZE_SHIELD, 1, 0);
    const {timestamp: NOW1} = await ethers.provider.getBlock("latest");
    tokenAllocation = await shop.tokenInfos(EstforConstants.BRONZE_SHIELD); // Empty
    expect(tokenAllocation.checkpointTimestamp).to.eq(Math.floor(NOW1 / 86400) * 86400);
    expect(tokenAllocation.allocationRemaining).to.eq("499250250000000000");
  });

  it("Price should be constant through the day", async function () {
    const {itemNFT, shop, brush, alice, sellingCutoffDuration} = await loadFixture(deployContracts);

    await itemNFT.testMint(alice.address, EstforConstants.BRONZE_SHIELD, 2000);
    await itemNFT.testMint(alice.address, EstforConstants.BARRAGE_SCROLL, 2000);
    await ethers.provider.send("evm_increaseTime", [sellingCutoffDuration]);

    // Give the contract some brush to assign to the items
    const totalBrush = ethers.utils.parseEther("1");
    await brush.mint(shop.address, totalBrush);

    await shop.connect(alice).sell(EstforConstants.BRONZE_SHIELD, 1, 0);
    let liquidatePrice = await shop.liquidatePrice(EstforConstants.BRONZE_SHIELD);
    expect(liquidatePrice).to.be.eq(ethers.utils.parseEther("0.5").div(2000));
    // Is same price
    await shop.connect(alice).sell(EstforConstants.BRONZE_SHIELD, 500, 0);
    liquidatePrice = await shop.liquidatePrice(EstforConstants.BRONZE_SHIELD);
    expect(liquidatePrice).to.be.eq(ethers.utils.parseEther("0.5").div(2000));
    // Now changes in a new day
    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await ethers.provider.send("evm_mine", []);
    liquidatePrice = await shop.liquidatePrice(EstforConstants.BRONZE_SHIELD);
    await shop.connect(alice).sell(EstforConstants.BRONZE_SHIELD, 300, 0);
    const prevLiquidatePrice = liquidatePrice;
    liquidatePrice = await shop.liquidatePrice(EstforConstants.BRONZE_SHIELD);
    expect(liquidatePrice).to.be.eq(prevLiquidatePrice);
  });

  it("Remove shop item", async function () {
    const {shop} = await loadFixture(deployContracts);
    const price = 500;
    await shop.addBuyableItem({tokenId: EstforConstants.BRONZE_SHIELD, price});
    expect(await shop.shopItems(BRONZE_SHIELD)).eq(price);
    await shop.removeItem(BRONZE_SHIELD);
    expect(await shop.shopItems(BRONZE_SHIELD)).eq(0);
    await expect(shop.removeItem(BRONZE_SHIELD)).to.be.revertedWithCustomError(shop, "ShopItemDoesNotExist");
  });

  describe("Unsellable items", async function () {
    it("Cannot add an item which doesn't exist", async function () {
      const {itemNFT, shop} = await loadFixture(deployContracts);

      await expect(shop.addUnsellableItems([EstforConstants.ORICHALCUM_ARMOR])).to.be.revertedWithCustomError(
        shop,
        "ItemDoesNotExist"
      );
      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.ORICHALCUM_ARMOR,
          equipPosition: EstforTypes.EquipPosition.BODY,
        },
      ]);
      await expect(shop.addUnsellableItems([EstforConstants.ORICHALCUM_ARMOR])).to.not.be.reverted;
    });

    it("Cannot add an which is already unsellable", async function () {
      const {shop} = await loadFixture(deployContracts);
      await shop.addUnsellableItems([EstforConstants.BRONZE_SHIELD]);
      await expect(shop.addUnsellableItems([EstforConstants.BRONZE_SHIELD])).to.be.revertedWithCustomError(
        shop,
        "AlreadyUnsellable"
      );
    });

    it("Cannot remove an item which is already sellable", async function () {
      const {itemNFT, shop} = await loadFixture(deployContracts);
      await expect(shop.removeUnsellableItems([EstforConstants.BRONZE_SHIELD])).to.be.revertedWithCustomError(
        shop,
        "AlreadySellable"
      );
    });

    it("Cannot be sold", async function () {
      const {itemNFT, shop, brush, alice, sellingCutoffDuration, minItemQuantityBeforeSellsAllowed} = await loadFixture(
        deployContracts
      );

      await itemNFT.testMint(alice.address, EstforConstants.BRONZE_SHIELD, minItemQuantityBeforeSellsAllowed * 2);
      await itemNFT.testMint(alice.address, EstforConstants.SAPPHIRE_AMULET, minItemQuantityBeforeSellsAllowed);

      // Give the contract some brush to assign to the items
      const totalBrush = minItemQuantityBeforeSellsAllowed * 20;
      await brush.mint(shop.address, totalBrush);

      await ethers.provider.send("evm_increaseTime", [sellingCutoffDuration]);
      await shop.addUnsellableItems([EstforConstants.BRONZE_SHIELD]);
      await expect(shop.connect(alice).sell(EstforConstants.BRONZE_SHIELD, 1, totalBrush))
        .to.be.revertedWithCustomError(shop, "ItemNotSellable")
        .withArgs(EstforConstants.BRONZE_SHIELD);
    });

    it("Should not affect the liquidation price", async function () {
      const {itemNFT, shop, brush, alice, sellingCutoffDuration, minItemQuantityBeforeSellsAllowed} = await loadFixture(
        deployContracts
      );

      await itemNFT.testMint(alice.address, EstforConstants.BRONZE_SHIELD, minItemQuantityBeforeSellsAllowed * 2);
      await itemNFT.testMint(alice.address, EstforConstants.SAPPHIRE_AMULET, minItemQuantityBeforeSellsAllowed);

      // Give the contract some brush to assign to the items
      const totalBrush = minItemQuantityBeforeSellsAllowed * 20;
      await brush.mint(shop.address, totalBrush);

      const splitBrush = totalBrush / 2;
      const priceShield = splitBrush / (minItemQuantityBeforeSellsAllowed * 2);
      expect((await shop.liquidatePrice(EstforConstants.BRONZE_SHIELD)).toNumber()).to.eq(priceShield);

      const priceSapphireAmulet = splitBrush / minItemQuantityBeforeSellsAllowed;
      expect(await shop.liquidatePrices([EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET])).to.eql([
        ethers.BigNumber.from(priceShield),
        ethers.BigNumber.from(priceSapphireAmulet),
      ]);
      await ethers.provider.send("evm_increaseTime", [sellingCutoffDuration]);

      // Add amulet as unsellable so it can't be sold, bronze shield should now have all the allocation from the treasure
      await shop.addUnsellableItems([EstforConstants.SAPPHIRE_AMULET]);
      const priceShieldAfterUnsellable = totalBrush / (minItemQuantityBeforeSellsAllowed * 2);
      expect((await shop.liquidatePrice(EstforConstants.BRONZE_SHIELD)).toNumber()).to.eq(priceShieldAfterUnsellable);
      expect(await shop.liquidatePrices([EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET])).to.eql([
        ethers.BigNumber.from(priceShieldAfterUnsellable),
        ethers.BigNumber.from(0),
      ]);
    });

    it("Should not affect the total allocation for selling", async function () {
      const {itemNFT, shop, brush, alice, sellingCutoffDuration} = await loadFixture(deployContracts);

      await itemNFT.testMint(alice.address, EstforConstants.BRONZE_SHIELD, 1000);
      await itemNFT.testMint(alice.address, EstforConstants.SAPPHIRE_AMULET, 1000);
      await ethers.provider.send("evm_increaseTime", [sellingCutoffDuration]);

      // Give the contract some brush to assign to the items
      const totalBrush = ethers.utils.parseEther("1");
      await brush.mint(shop.address, totalBrush);
      await shop.addUnsellableItems([EstforConstants.SAPPHIRE_AMULET]);

      let tokenAllocation = await shop.tokenInfos(EstforConstants.BRONZE_SHIELD); // Empty
      expect(tokenAllocation.allocationRemaining).to.eq(0);
      await expect(shop.connect(alice).sell(EstforConstants.BRONZE_SHIELD, 1, 0))
        .to.emit(shop, "NewAllocation")
        .withArgs(EstforConstants.BRONZE_SHIELD, totalBrush);
      tokenAllocation = await shop.tokenInfos(EstforConstants.BRONZE_SHIELD);
      expect(tokenAllocation.allocationRemaining).to.eq(
        ethers.utils.parseEther("1").sub(ethers.utils.parseEther("1").div(1000))
      );
    });
  });
});
