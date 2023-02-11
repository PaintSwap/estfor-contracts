import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {SAPPHIRE_AMULET, BRONZE_SHIELD, BRONZE_SWORD, RAW_HUPPY} from "../scripts/utils";

describe("Shop", function () {
  const deployContracts = async () => {
    // Contracts are deployed using the first signer/account by default
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

    const Users = await ethers.getContractFactory("Users");
    const users = await upgrades.deployProxy(Users, [], {
      kind: "uups",
    });

    const Shop = await ethers.getContractFactory("Shop");
    const shop = await upgrades.deployProxy(Shop, [brush.address], {
      kind: "uups",
      unsafeAllow: ["delegatecall"],
    });

    // Create NFT contract which contains all items
    const ItemNFT = await ethers.getContractFactory("ItemNFT");
    const itemNFT = await upgrades.deployProxy(ItemNFT, [world.address, users.address, shop.address], {
      kind: "uups",
      unsafeAllow: ["delegatecall"],
    });

    await shop.setItemNFT(itemNFT.address);

    return {
      itemNFT,
      shop,
      brush,
      owner,
      alice,
    };
  };

  it("Set up shop", async () => {
    const {shop} = await loadFixture(deployContracts);
    await shop.addShopItem({tokenId: BRONZE_SHIELD, price: 500});

    // Check that it's in the shop
    expect(await shop.shopItems(BRONZE_SHIELD)).to.eq(500);

    // Update price
    await shop.addShopItem({tokenId: BRONZE_SHIELD, price: 400});
    expect(await shop.shopItems(BRONZE_SHIELD)).to.eq(400);

    // Doesn't exist
    expect(await shop.shopItems(9999)).to.eq(0);
  });

  it("Set up shop batch ", async () => {
    const {shop} = await loadFixture(deployContracts);
    await shop.addShopItems([
      {tokenId: BRONZE_SHIELD, price: 500},
      {tokenId: RAW_HUPPY, price: 300},
    ]);

    // Check that it's in the shop
    expect(await shop.shopItems(BRONZE_SHIELD)).to.eq(500);
    expect(await shop.shopItems(RAW_HUPPY)).to.eq(300);

    // Replacing should work
    await shop.addShopItems([
      {tokenId: BRONZE_SHIELD, price: 200},
      {tokenId: RAW_HUPPY, price: 400},
      {tokenId: BRONZE_SWORD, price: 10},
    ]);

    // Check that it's in the shop
    expect(await shop.shopItems(BRONZE_SHIELD)).to.eq(200);
    expect(await shop.shopItems(RAW_HUPPY)).to.eq(400);
    expect(await shop.shopItems(BRONZE_SWORD)).to.eq(10);
  });

  it("Buy", async () => {
    const {itemNFT, shop, brush, alice} = await loadFixture(deployContracts);
    await shop.addShopItem({tokenId: BRONZE_SHIELD, price: 500});

    const quantityBought = 2;
    // Hasn't approved brush yet
    await expect(shop.connect(alice).buy(BRONZE_SHIELD, quantityBought)).to.be.reverted;

    await brush.mint(alice.address, 1000);
    await brush.connect(alice).approve(shop.address, 1000);
    await shop.connect(alice).buy(BRONZE_SHIELD, quantityBought);
    expect(await itemNFT.balanceOf(alice.address, BRONZE_SHIELD)).to.eq(quantityBought);
  });

  it("Buy batch", async () => {
    const {itemNFT, shop, brush, alice} = await loadFixture(deployContracts);
    await shop.addShopItem({tokenId: BRONZE_SHIELD, price: 500});
    await shop.addShopItem({tokenId: SAPPHIRE_AMULET, price: 200});

    await brush.mint(alice.address, 900);
    await brush.connect(alice).approve(shop.address, 900);
    await shop.connect(alice).buyBatch([BRONZE_SHIELD, SAPPHIRE_AMULET], [1, 2]);
    expect(await itemNFT.balanceOf(alice.address, BRONZE_SHIELD)).to.eq(1);
    expect(await itemNFT.balanceOf(alice.address, SAPPHIRE_AMULET)).to.eq(2);
  });

  it("Sell", async () => {
    const {itemNFT, shop, brush, alice} = await loadFixture(deployContracts);

    await itemNFT.testMint(alice.address, BRONZE_SHIELD, 200);
    await itemNFT.testMint(alice.address, SAPPHIRE_AMULET, 100);
    expect(await itemNFT.uniqueItems()).to.eq(2);

    expect(await shop.getPriceForItem(BRONZE_SHIELD)).to.eq(0);

    // Give the contract some brush to assign to the items
    const totalBrush = 1200;
    await brush.mint(shop.address, totalBrush);

    const splitBrush = 600;
    const priceShield = splitBrush / 200;
    expect((await shop.getPriceForItem(BRONZE_SHIELD)).toNumber()).to.eq(priceShield);

    const priceBronzeNecklace = splitBrush / 100;
    expect(await shop.getPriceForItems([BRONZE_SHIELD, SAPPHIRE_AMULET])).to.eql([
      ethers.BigNumber.from(priceShield),
      ethers.BigNumber.from(priceBronzeNecklace),
    ]);

    await shop.connect(alice).sell(BRONZE_SHIELD, 1, priceShield);

    // Item should get burnt, and they should get the amount of brush expected.
    expect(await itemNFT.itemBalances(BRONZE_SHIELD)).to.eq(200 - 1);
    expect(await brush.balanceOf(alice.address)).to.eq(priceShield);
  });

  it("SellBatch", async () => {
    const {itemNFT, shop, brush, alice} = await loadFixture(deployContracts);

    await itemNFT.testMint(alice.address, BRONZE_SHIELD, 200);
    await itemNFT.testMint(alice.address, SAPPHIRE_AMULET, 100);

    // Give the contract some brush to assign to the items
    const totalBrush = 1200;
    await brush.mint(shop.address, totalBrush);

    const splitBrush = 600;
    const priceShield = splitBrush / 200;
    const priceBronzeNecklace = splitBrush / 100;

    const expectedTotal = priceShield + 2 * priceBronzeNecklace;
    await shop.connect(alice).sellBatch([BRONZE_SHIELD, SAPPHIRE_AMULET], [1, 2], expectedTotal);

    expect(await itemNFT.itemBalances(BRONZE_SHIELD)).to.eq(200 - 1);
    expect(await itemNFT.itemBalances(SAPPHIRE_AMULET)).to.eq(100 - 2);
    expect(await brush.balanceOf(alice.address)).to.eq(expectedTotal);
  });

  it("Sell Slippage", async () => {
    const {itemNFT, shop, brush, alice} = await loadFixture(deployContracts);

    await itemNFT.testMint(alice.address, BRONZE_SHIELD, 200);
    await itemNFT.testMint(alice.address, SAPPHIRE_AMULET, 100);

    // Give the contract some brush to assign to the items
    const totalBrush = 1200;
    await brush.mint(shop.address, totalBrush);

    const splitBrush = 600;
    const priceShield = splitBrush / 200;
    const priceBronzeNecklace = splitBrush / 100;

    const expectedTotal = priceShield + 2 * priceBronzeNecklace;

    // Asking for too much
    await expect(shop.connect(alice).sellBatch([BRONZE_SHIELD, SAPPHIRE_AMULET], [1, 2], expectedTotal + 1)).to.be
      .reverted;

    // Lets have a 1% slippage
    const minExpected = ethers.BigNumber.from(expectedTotal).mul(9900).div(10000);
    expect(minExpected).to.eq(3 + 12 - 1);

    await shop.connect(alice).sellBatch([BRONZE_SHIELD, SAPPHIRE_AMULET], [1, 2], minExpected);

    expect(await brush.balanceOf(alice.address)).to.greaterThan(minExpected);
  });
});
