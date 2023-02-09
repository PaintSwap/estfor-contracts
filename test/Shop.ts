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
    const world = await World.deploy(mockOracleClient.address, subscriptionId);

    // Create NFT contract which contains all items & players
    const Users = await ethers.getContractFactory("Users");
    const users = await Users.deploy();

    // Create NFT contract which contains all items & players
    const ItemNFT = await ethers.getContractFactory("TestItemNFT");
    const itemNFT = await ItemNFT.deploy(brush.address, world.address, users.address);

    return {
      itemNFT,
      brush,
      owner,
      alice,
    };
  };

  it("Set up shop", async () => {
    const {itemNFT} = await loadFixture(deployContracts);
    await itemNFT.addShopItem({tokenId: BRONZE_SHIELD, price: 500});

    // Check that it's in the shop
    expect(await itemNFT.shopItems(BRONZE_SHIELD)).to.eq(500);

    // Update price
    await itemNFT.addShopItem({tokenId: BRONZE_SHIELD, price: 400});
    expect(await itemNFT.shopItems(BRONZE_SHIELD)).to.eq(400);

    // Doesn't exist
    expect(await itemNFT.shopItems(9999)).to.eq(0);
  });

  it("Set up shop batch ", async () => {
    const {itemNFT} = await loadFixture(deployContracts);
    await itemNFT.addShopItems([
      {tokenId: BRONZE_SHIELD, price: 500},
      {tokenId: RAW_HUPPY, price: 300},
    ]);

    // Check that it's in the shop
    expect(await itemNFT.shopItems(BRONZE_SHIELD)).to.eq(500);
    expect(await itemNFT.shopItems(RAW_HUPPY)).to.eq(300);

    // Replacing should work
    await itemNFT.addShopItems([
      {tokenId: BRONZE_SHIELD, price: 200},
      {tokenId: RAW_HUPPY, price: 400},
      {tokenId: BRONZE_SWORD, price: 10},
    ]);

    // Check that it's in the shop
    expect(await itemNFT.shopItems(BRONZE_SHIELD)).to.eq(200);
    expect(await itemNFT.shopItems(RAW_HUPPY)).to.eq(400);
    expect(await itemNFT.shopItems(BRONZE_SWORD)).to.eq(10);
  });

  it("Buy", async () => {
    const {itemNFT, brush, alice} = await loadFixture(deployContracts);
    await itemNFT.addShopItem({tokenId: BRONZE_SHIELD, price: 500});

    const quantityBought = 2;
    // Hasn't approved brush yet
    await expect(itemNFT.connect(alice).buy(BRONZE_SHIELD, quantityBought)).to.be.reverted;

    await brush.mint(alice.address, 1000);
    await brush.connect(alice).approve(itemNFT.address, 1000);
    await itemNFT.connect(alice).buy(BRONZE_SHIELD, quantityBought);
    expect(await itemNFT.balanceOf(alice.address, BRONZE_SHIELD)).to.eq(quantityBought);
  });

  it("Buy batch", async () => {
    const {itemNFT, brush, alice} = await loadFixture(deployContracts);
    await itemNFT.addShopItem({tokenId: BRONZE_SHIELD, price: 500});
    await itemNFT.addShopItem({tokenId: SAPPHIRE_AMULET, price: 200});

    await brush.mint(alice.address, 900);
    await brush.connect(alice).approve(itemNFT.address, 900);
    await itemNFT.connect(alice).buyBatch([BRONZE_SHIELD, SAPPHIRE_AMULET], [1, 2]);
    expect(await itemNFT.balanceOf(alice.address, BRONZE_SHIELD)).to.eq(1);
    expect(await itemNFT.balanceOf(alice.address, SAPPHIRE_AMULET)).to.eq(2);
  });

  it("Sell", async () => {
    const {itemNFT, brush, alice} = await loadFixture(deployContracts);

    await itemNFT.testMint(alice.address, BRONZE_SHIELD, 200);
    await itemNFT.testMint(alice.address, SAPPHIRE_AMULET, 100);
    expect(await itemNFT.numItems()).to.eq(2);

    expect(await itemNFT.getPriceForItem(BRONZE_SHIELD)).to.eq(0);

    // Give the contract some brush to assign to the items
    const totalBrush = 1200;
    await brush.mint(itemNFT.address, totalBrush);

    const splitBrush = 600;
    const priceShield = splitBrush / 200;
    expect((await itemNFT.getPriceForItem(BRONZE_SHIELD)).toNumber()).to.eq(priceShield);

    const priceBronzeNecklace = splitBrush / 100;
    expect(await itemNFT.getPriceForItems([BRONZE_SHIELD, SAPPHIRE_AMULET])).to.eql([
      ethers.BigNumber.from(priceShield),
      ethers.BigNumber.from(priceBronzeNecklace),
    ]);

    await itemNFT.connect(alice).sell(BRONZE_SHIELD, 1, priceShield);

    // Item should get burnt, and they should get the amount of brush expected.
    expect(await itemNFT.itemBalances(BRONZE_SHIELD)).to.eq(200 - 1);
    expect(await brush.balanceOf(alice.address)).to.eq(priceShield);
  });

  it("SellBatch", async () => {
    const {itemNFT, brush, alice} = await loadFixture(deployContracts);

    await itemNFT.testMint(alice.address, BRONZE_SHIELD, 200);
    await itemNFT.testMint(alice.address, SAPPHIRE_AMULET, 100);

    // Give the contract some brush to assign to the items
    const totalBrush = 1200;
    await brush.mint(itemNFT.address, totalBrush);

    const splitBrush = 600;
    const priceShield = splitBrush / 200;
    const priceBronzeNecklace = splitBrush / 100;

    const expectedTotal = priceShield + 2 * priceBronzeNecklace;
    await itemNFT.connect(alice).sellBatch([BRONZE_SHIELD, SAPPHIRE_AMULET], [1, 2], expectedTotal);

    expect(await itemNFT.itemBalances(BRONZE_SHIELD)).to.eq(200 - 1);
    expect(await itemNFT.itemBalances(SAPPHIRE_AMULET)).to.eq(100 - 2);
    expect(await brush.balanceOf(alice.address)).to.eq(expectedTotal);
  });

  it("Sell Slippage", async () => {
    const {itemNFT, brush, alice} = await loadFixture(deployContracts);

    await itemNFT.testMint(alice.address, BRONZE_SHIELD, 200);
    await itemNFT.testMint(alice.address, SAPPHIRE_AMULET, 100);

    // Give the contract some brush to assign to the items
    const totalBrush = 1200;
    await brush.mint(itemNFT.address, totalBrush);

    const splitBrush = 600;
    const priceShield = splitBrush / 200;
    const priceBronzeNecklace = splitBrush / 100;

    const expectedTotal = priceShield + 2 * priceBronzeNecklace;

    // Asking for too much
    await expect(itemNFT.connect(alice).sellBatch([BRONZE_SHIELD, SAPPHIRE_AMULET], [1, 2], expectedTotal + 1)).to.be
      .reverted;

    // Lets have a 1% slippage
    const minExpected = ethers.BigNumber.from(expectedTotal).mul(9900).div(10000);
    expect(minExpected).to.eq(3 + 12 - 1);

    await itemNFT.connect(alice).sellBatch([BRONZE_SHIELD, SAPPHIRE_AMULET], [1, 2], minExpected);

    expect(await brush.balanceOf(alice.address)).to.greaterThan(minExpected);
  });
});
