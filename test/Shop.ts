import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {ACTIVITY_TICKET, BRONZE_SHIELD, SONIC_GEM_TICKET} from "@paintswap/estfor-definitions/constants";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {
  AdminAccess,
  DailyRewardsScheduler,
  ItemNFT,
  RandomnessBeacon,
  RoyaltyReceiver,
  Shop,
  Treasury
} from "../typechain-types";
import {setDailyAndWeeklyRewards} from "../scripts/utils";
import {Block, parseEther, ZeroAddress} from "ethers";
import {timeTravel, timeTravel24Hours} from "./utils";

describe("Shop", function () {
  const deployContracts = async function () {
    // Contracts are deployed using the first signer/account by default
    const [owner, alice, bob /*charlie */, , dev] = await ethers.getSigners();

    const brush = await ethers.deployContract("MockBrushToken");
    const mockVRF = await ethers.deployContract("MockVRF");

    // Add some dummy blocks so that world can access previous blocks for random numbers
    for (let i = 0; i < 5; ++i) {
      await owner.sendTransaction({
        to: owner.address,
        value: 1,
        maxFeePerGas: 1
      });
    }

    // Create the world
    const RandomnessBeacon = await ethers.getContractFactory("RandomnessBeacon");
    const randomnessBeacon = (await upgrades.deployProxy(RandomnessBeacon, [await mockVRF.getAddress()], {
      kind: "uups"
    })) as unknown as RandomnessBeacon;

    const mockOracleCB = await ethers.deployContract("MockOracleCB");
    await randomnessBeacon.initializeAddresses(mockOracleCB, mockOracleCB);
    await randomnessBeacon.initializeRandomWords();

    const DailyRewardsScheduler = await ethers.getContractFactory("DailyRewardsScheduler");
    const dailyRewardsScheduler = (await upgrades.deployProxy(
      DailyRewardsScheduler,
      [await randomnessBeacon.getAddress()],
      {
        kind: "uups"
      }
    )) as unknown as DailyRewardsScheduler;

    await setDailyAndWeeklyRewards(dailyRewardsScheduler);

    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = (await upgrades.deployProxy(Treasury, [await brush.getAddress()], {
      kind: "uups"
    })) as unknown as Treasury;

    const minItemQuantityBeforeSellsAllowed = 500n;
    const sellingCutoffDuration = 48 * 3600; // 48 hours
    const Shop = await ethers.getContractFactory("Shop");
    const shop = (await upgrades.deployProxy(
      Shop,
      [
        await brush.getAddress(),
        await treasury.getAddress(),
        dev.address,
        minItemQuantityBeforeSellsAllowed,
        sellingCutoffDuration
      ],
      {
        kind: "uups"
      }
    )) as unknown as Shop;

    const router = await ethers.deployContract("MockRouter");
    const RoyaltyReceiver = await ethers.getContractFactory("RoyaltyReceiver");
    const royaltyReceiver = (await upgrades.deployProxy(
      RoyaltyReceiver,
      [await router.getAddress(), await shop.getAddress(), dev.address, await brush.getAddress(), alice.address],
      {
        kind: "uups"
      }
    )) as unknown as RoyaltyReceiver;

    const admins = [owner.address, alice.address];
    const AdminAccess = await ethers.getContractFactory("AdminAccess");
    const adminAccess = (await upgrades.deployProxy(AdminAccess, [admins, admins], {
      kind: "uups"
    })) as unknown as AdminAccess;

    const isBeta = true;
    const ItemNFTLibrary = await ethers.getContractFactory("ItemNFTLibrary");
    const itemNFTLibrary = await ItemNFTLibrary.deploy();
    const ItemNFT = await ethers.getContractFactory("ItemNFT", {
      libraries: {ItemNFTLibrary: await itemNFTLibrary.getAddress()}
    });
    const itemsUri = "ipfs://";
    const itemNFT = (await upgrades.deployProxy(
      ItemNFT,
      [await royaltyReceiver.getAddress(), itemsUri, await adminAccess.getAddress(), isBeta],
      {
        kind: "uups",
        unsafeAllow: ["external-library-linking"]
      }
    )) as unknown as ItemNFT;

    const ActivityPoints = await ethers.getContractFactory("ActivityPoints");
    const activityPoints = await upgrades.deployProxy(
      ActivityPoints,
      [await itemNFT.getAddress(), ACTIVITY_TICKET, SONIC_GEM_TICKET],
      {
        kind: "uups"
      }
    );
    // add shop as an AP minter
    await shop.setActivityPoints(activityPoints);
    await activityPoints.addCallers([await shop.getAddress()]);
    await shop.setItemNFT(itemNFT);
    // allow the activity points contract to mint AP itemNFTs
    await itemNFT.setApproved([shop, activityPoints], true);

    const bankFactory = alice;
    const mockPlayers = await ethers.deployContract("MockPlayers");
    await itemNFT.initializeAddresses(bankFactory, mockPlayers);

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_SHIELD,
        equipPosition: EstforTypes.EquipPosition.LEFT_HAND
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_SWORD,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.RAW_MINNUS,
        equipPosition: EstforTypes.EquipPosition.FOOD
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.SAPPHIRE_AMULET,
        equipPosition: EstforTypes.EquipPosition.NECK
      }
    ]);

    await treasury.setSpenders([shop], true);
    const treasuryAccounts = [await shop.getAddress()];
    const treasuryPercentages = [100];
    await treasury.setFundAllocationPercentages(treasuryAccounts, treasuryPercentages);

    await expect(shop.setBrushDistributionPercentages(25, 50, 25))
      .to.emit(shop, "SetBrushDistributionPercentages")
      .withArgs(25, 50, 25);

    return {
      itemNFT,
      shop,
      treasury,
      brush,
      owner,
      alice,
      bob,
      sellingCutoffDuration,
      minItemQuantityBeforeSellsAllowed
    };
  };

  it("Set up shop", async function () {
    const {shop} = await loadFixture(deployContracts);
    await shop.addBuyableItems([{tokenId: EstforConstants.BRONZE_SHIELD, price: 500}]);

    // Check that it's in the shop
    expect(await shop.shopItems(EstforConstants.BRONZE_SHIELD)).to.eq(500);

    // Update price
    await expect(
      shop.addBuyableItems([{tokenId: EstforConstants.BRONZE_SHIELD, price: 400}])
    ).to.be.revertedWithCustomError(shop, "ShopItemAlreadyExists");
    await shop.editItems([{tokenId: EstforConstants.BRONZE_SHIELD, price: 400}]);
    expect(await shop.shopItems(EstforConstants.BRONZE_SHIELD)).to.eq(400);

    await expect(
      shop.addBuyableItems([
        {tokenId: EstforConstants.BRONZE_SHIELD, price: 200},
        {tokenId: EstforConstants.RAW_MINNUS, price: 400},
        {tokenId: EstforConstants.BRONZE_SWORD, price: 10}
      ])
    ).to.be.revertedWithCustomError(shop, "ShopItemAlreadyExists");

    // Doesn't exist
    expect(await shop.shopItems(9999)).to.eq(0);
  });

  it("Set up shop batch ", async function () {
    const {shop} = await loadFixture(deployContracts);
    await shop.addBuyableItems([
      {tokenId: EstforConstants.BRONZE_SHIELD, price: 500},
      {tokenId: EstforConstants.RAW_MINNUS, price: 300}
    ]);

    // Check that it's in the shop
    expect(await shop.shopItems(EstforConstants.BRONZE_SHIELD)).to.eq(500);
    expect(await shop.shopItems(EstforConstants.RAW_MINNUS)).to.eq(300);

    await expect(
      shop.addBuyableItems([
        {tokenId: EstforConstants.BRONZE_SHIELD, price: 200},
        {tokenId: EstforConstants.RAW_MINNUS, price: 400}
      ])
    ).to.be.revertedWithCustomError(shop, "ShopItemAlreadyExists");

    // Replacing should work
    await expect(
      shop.editItems([
        {tokenId: EstforConstants.BRONZE_SHIELD, price: 200},
        {tokenId: EstforConstants.RAW_MINNUS, price: 400},
        {tokenId: EstforConstants.BRONZE_SWORD, price: 10}
      ])
    ).to.be.revertedWithCustomError(shop, "ShopItemDoesNotExist");
    await shop.addBuyableItems([{tokenId: EstforConstants.BRONZE_SWORD, price: 20}]);
    await shop.editItems([
      {tokenId: EstforConstants.BRONZE_SHIELD, price: 300},
      {tokenId: EstforConstants.RAW_MINNUS, price: 400},
      {tokenId: EstforConstants.BRONZE_SWORD, price: 10}
    ]);

    // Check that it's in the shop
    expect(await shop.shopItems(EstforConstants.BRONZE_SHIELD)).to.eq(300);
    expect(await shop.shopItems(EstforConstants.RAW_MINNUS)).to.eq(400);
    expect(await shop.shopItems(EstforConstants.BRONZE_SWORD)).to.eq(10);
  });

  it("Set up shop with items which don't exist", async function () {
    const {shop} = await loadFixture(deployContracts);
    await expect(
      shop.addBuyableItems([{tokenId: EstforConstants.TITANIUM_ARMOR, price: 500}])
    ).to.be.revertedWithCustomError(shop, "ItemDoesNotExist");
    await expect(
      shop.addBuyableItems([{tokenId: EstforConstants.TITANIUM_ARMOR, price: 500}])
    ).to.be.revertedWithCustomError(shop, "ItemDoesNotExist");
  });

  it("Set up shop with 0 prices is not allowed", async function () {
    const {shop} = await loadFixture(deployContracts);
    await expect(
      shop.addBuyableItems([{tokenId: EstforConstants.BRONZE_SHIELD, price: 0}])
    ).to.be.revertedWithCustomError(shop, "PriceCannotBeZero");
    await expect(
      shop.addBuyableItems([{tokenId: EstforConstants.BRONZE_SHIELD, price: 0}])
    ).to.be.revertedWithCustomError(shop, "PriceCannotBeZero");
  });

  it("Buy", async function () {
    const {itemNFT, shop, brush, alice} = await loadFixture(deployContracts);
    await shop.addBuyableItems([{tokenId: EstforConstants.BRONZE_SHIELD, price: 500}]);

    const quantityBought = 2;
    // Hasn't approved brush yet
    await expect(shop.connect(alice).buy(alice, EstforConstants.BRONZE_SHIELD, quantityBought)).to.be.reverted;

    await brush.mint(alice, 1000);
    await brush.connect(alice).approve(shop, 1000);
    await expect(shop.connect(alice).buy(alice, EstforConstants.BRONZE_SHIELD, quantityBought))
      .to.emit(shop, "Buy")
      .withArgs(alice, alice, EstforConstants.BRONZE_SHIELD, quantityBought, 500);
    expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_SHIELD)).to.eq(quantityBought);
  });

  it("Buy batch", async function () {
    const {itemNFT, shop, brush, alice} = await loadFixture(deployContracts);
    await shop.addBuyableItems([{tokenId: EstforConstants.BRONZE_SHIELD, price: 500}]);
    await shop.addBuyableItems([{tokenId: EstforConstants.SAPPHIRE_AMULET, price: 200}]);

    await brush.mint(alice, 900);
    await brush.connect(alice).approve(shop, 900);
    await expect(
      shop.connect(alice).buyBatch(alice, [EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET], [1, 2])
    )
      .to.emit(shop, "BuyBatch")
      .withArgs(alice, alice, [EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET], [1, 2], [500, 200]);
    expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_SHIELD)).to.eq(1);
    expect(await itemNFT.balanceOf(alice, EstforConstants.SAPPHIRE_AMULET)).to.eq(2);
  });

  it("Gift", async function () {
    const {itemNFT, shop, brush, alice, bob} = await loadFixture(deployContracts);
    await shop.addBuyableItems([{tokenId: EstforConstants.BRONZE_SHIELD, price: 500}]);

    const quantityBought = 2;
    // Hasn't approved brush yet
    await expect(shop.connect(alice).buy(bob.address, EstforConstants.BRONZE_SHIELD, quantityBought)).to.be.reverted;

    await brush.mint(alice, 1000);
    await brush.connect(alice).approve(shop, 1000);
    await expect(shop.connect(alice).buy(bob.address, EstforConstants.BRONZE_SHIELD, quantityBought))
      .to.emit(shop, "Buy")
      .withArgs(alice, bob.address, EstforConstants.BRONZE_SHIELD, quantityBought, 500);
    expect(await itemNFT.balanceOf(bob.address, EstforConstants.BRONZE_SHIELD)).to.eq(quantityBought);
  });

  it("Gift batch", async function () {
    const {itemNFT, shop, brush, alice, bob} = await loadFixture(deployContracts);
    await shop.addBuyableItems([{tokenId: EstforConstants.BRONZE_SHIELD, price: 500}]);
    await shop.addBuyableItems([{tokenId: EstforConstants.SAPPHIRE_AMULET, price: 200}]);

    await brush.mint(alice, 900);
    await brush.connect(alice).approve(shop, 900);
    await expect(
      shop
        .connect(alice)
        .buyBatch(bob.address, [EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET], [1, 2])
    )
      .to.emit(shop, "BuyBatch")
      .withArgs(
        alice,
        bob.address,
        [EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET],
        [1, 2],
        [500, 200]
      );
    expect(await itemNFT.balanceOf(bob.address, EstforConstants.BRONZE_SHIELD)).to.eq(1);
    expect(await itemNFT.balanceOf(bob.address, EstforConstants.SAPPHIRE_AMULET)).to.eq(2);
  });

  it("Sell", async function () {
    const {itemNFT, shop, treasury, brush, alice, sellingCutoffDuration, minItemQuantityBeforeSellsAllowed} =
      await loadFixture(deployContracts);

    await itemNFT.mint(alice, EstforConstants.BRONZE_SHIELD, minItemQuantityBeforeSellsAllowed * 2n);
    await itemNFT.mint(alice, EstforConstants.SAPPHIRE_AMULET, minItemQuantityBeforeSellsAllowed);
    expect(await itemNFT["totalSupply()"]()).to.eq(2);

    expect(await shop.liquidatePrice(EstforConstants.BRONZE_SHIELD)).to.eq(0);

    // Give the contract some brush to assign to the items
    const totalBrush = minItemQuantityBeforeSellsAllowed * 20n;
    await brush.mint(treasury, totalBrush);

    const splitBrush = totalBrush / 2n;
    const priceShield = splitBrush / (minItemQuantityBeforeSellsAllowed * 2n);
    expect(await shop.liquidatePrice(EstforConstants.BRONZE_SHIELD)).to.eq(priceShield);

    const priceSapphireAmulet = splitBrush / minItemQuantityBeforeSellsAllowed;
    expect(await shop.liquidatePrices([EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET])).to.eql([
      BigInt(priceShield),
      BigInt(priceSapphireAmulet)
    ]);
    await ethers.provider.send("evm_increaseTime", [sellingCutoffDuration]);
    await ethers.provider.send("evm_mine", []);
    await expect(shop.connect(alice).sell(EstforConstants.BRONZE_SHIELD, 1, priceShield))
      .to.emit(shop, "Sell")
      .withArgs(alice, EstforConstants.BRONZE_SHIELD, 1, priceShield)
      .and.to.emit(itemNFT, "TransferSingle")
      .withArgs(await shop.getAddress(), alice, ZeroAddress, EstforConstants.BRONZE_SHIELD, 1);

    // Item should get burnt, and they should get the amount of brush expected.
    expect(await itemNFT["totalSupply(uint256)"](EstforConstants.BRONZE_SHIELD)).to.eq(
      minItemQuantityBeforeSellsAllowed * 2n - 1n
    );
    expect(await brush.balanceOf(alice)).to.eq(priceShield);
  });

  it("Sell Batch", async function () {
    const {itemNFT, shop, treasury, brush, alice, sellingCutoffDuration, minItemQuantityBeforeSellsAllowed} =
      await loadFixture(deployContracts);

    await itemNFT.mintBatch(
      alice,
      [EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET],
      [minItemQuantityBeforeSellsAllowed * 2n, minItemQuantityBeforeSellsAllowed]
    );

    // Give the contract some brush to assign to the items
    const totalBrush = minItemQuantityBeforeSellsAllowed * 20n;
    await brush.mint(treasury, totalBrush);

    const splitBrush = totalBrush / 2n;
    const priceShield = splitBrush / (minItemQuantityBeforeSellsAllowed * 2n);
    const priceSapphireAmulet = splitBrush / minItemQuantityBeforeSellsAllowed;

    const expectedTotal = priceShield + 2n * priceSapphireAmulet;
    await ethers.provider.send("evm_increaseTime", [sellingCutoffDuration]);
    await ethers.provider.send("evm_mine", []);
    await expect(
      shop
        .connect(alice)
        .sellBatch([EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET], [1, 2], expectedTotal)
    )
      .to.emit(shop, "SellBatch")
      .withArgs(
        alice,
        [EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET],
        [1, 2],
        [priceShield, priceSapphireAmulet]
      )
      .and.to.emit(itemNFT, "TransferBatch")
      .withArgs(
        await shop.getAddress(),
        alice,

        ZeroAddress,
        [EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET],
        [1, 2]
      );

    expect(await itemNFT["totalSupply(uint256)"](EstforConstants.BRONZE_SHIELD)).to.eq(
      minItemQuantityBeforeSellsAllowed * 2n - 1n
    );
    expect(await itemNFT["totalSupply(uint256)"](EstforConstants.SAPPHIRE_AMULET)).to.eq(
      minItemQuantityBeforeSellsAllowed - 2n
    );
    expect(await brush.balanceOf(alice)).to.eq(expectedTotal);
  });

  it("Sell Slippage", async function () {
    const {itemNFT, shop, treasury, brush, alice, sellingCutoffDuration, minItemQuantityBeforeSellsAllowed} =
      await loadFixture(deployContracts);

    await itemNFT.mintBatch(
      alice,
      [EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET],
      [minItemQuantityBeforeSellsAllowed * 2n, minItemQuantityBeforeSellsAllowed]
    );

    // Give the contract some brush to assign to the items
    const totalBrush = minItemQuantityBeforeSellsAllowed * 20n;
    await brush.mint(treasury, totalBrush);

    const splitBrush = totalBrush / 2n;
    const priceShield = splitBrush / (minItemQuantityBeforeSellsAllowed * 2n);
    const priceSapphireAmulet = splitBrush / minItemQuantityBeforeSellsAllowed;

    const expectedTotal = priceShield + 2n * priceSapphireAmulet;
    await ethers.provider.send("evm_increaseTime", [sellingCutoffDuration]);
    await ethers.provider.send("evm_mine", []);

    // Asking for too much
    await expect(
      shop
        .connect(alice)
        .sellBatch([EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET], [1, 2], expectedTotal + 1n)
    ).to.be.reverted;

    // Lets have a 1% slippage
    const minExpected = (BigInt(expectedTotal) * 9900n) / 10000n;
    expect(minExpected).to.eq(24n);

    await shop
      .connect(alice)
      .sellBatch([EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET], [1, 2], minExpected);

    expect(await brush.balanceOf(alice)).to.greaterThan(minExpected);
  });

  it("Can't sell for more than you can buy in shop", async function () {
    const {itemNFT, shop, treasury, brush, alice, sellingCutoffDuration, minItemQuantityBeforeSellsAllowed} =
      await loadFixture(deployContracts);

    await itemNFT.mint(alice, EstforConstants.BRONZE_SHIELD, minItemQuantityBeforeSellsAllowed * 2n);
    expect(await itemNFT["totalSupply()"]()).to.eq(1);

    await shop.addBuyableItems([{tokenId: EstforConstants.BRONZE_SHIELD, price: 1}]);

    // Give the contract some brush to assign to the items
    const totalBrush = parseEther("1");
    await brush.mint(treasury, totalBrush);
    expect(await shop.liquidatePrice(EstforConstants.BRONZE_SHIELD)).to.be.gt(1);
    await ethers.provider.send("evm_increaseTime", [sellingCutoffDuration]);
    await ethers.provider.send("evm_mine", []);

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
    const {itemNFT, shop, treasury, brush, alice, minItemQuantityBeforeSellsAllowed} = await loadFixture(
      deployContracts
    );

    await itemNFT.mint(alice, EstforConstants.BRONZE_SHIELD, minItemQuantityBeforeSellsAllowed * 2n);

    // Give the contract some brush to assign to the items
    const totalBrush = parseEther("1");
    await brush.mint(treasury, totalBrush);
    await expect(shop.connect(alice).sellBatch([EstforConstants.BRONZE_SHIELD], [1], 0)).to.be.revertedWithCustomError(
      shop,
      "SellingTooQuicklyAfterItemIntroduction"
    );
  });

  it("Exceed selling allocation", async function () {
    const {itemNFT, shop, treasury, brush, alice, sellingCutoffDuration, minItemQuantityBeforeSellsAllowed} =
      await loadFixture(deployContracts);

    await itemNFT.mint(alice, EstforConstants.BRONZE_SHIELD, 1000);
    await itemNFT.mint(alice, EstforConstants.BARRAGE_SCROLL, 1000);
    await timeTravel(sellingCutoffDuration);

    // Give the contract some brush to assign to the items
    const totalBrush = parseEther("1");
    await brush.mint(treasury, totalBrush);

    let tokenAllocation = await shop.tokenInfos(EstforConstants.BRONZE_SHIELD); // Empty
    expect(tokenAllocation.allocationRemaining).to.eq(0);
    await expect(shop.connect(alice).sell(EstforConstants.BRONZE_SHIELD, 1, 0))
      .to.emit(shop, "NewAllocation")
      .withArgs(EstforConstants.BRONZE_SHIELD, totalBrush / 2n);
    tokenAllocation = await shop.tokenInfos(EstforConstants.BRONZE_SHIELD);
    expect(tokenAllocation.allocationRemaining).to.eq(parseEther("0.5") - parseEther("0.5") / 1000n);
    expect((await shop.tokenInfos(EstforConstants.BARRAGE_SCROLL)).allocationRemaining).to.eq(0); // shouldn't have changed

    const tokenPrice = await shop.liquidatePrice(EstforConstants.BRONZE_SHIELD);
    expect(tokenPrice).to.be.gt(0n);

    // Sell all but 1, should be minimal allocation left
    await expect(shop.connect(alice).sell(EstforConstants.BRONZE_SHIELD, 997, 0)).to.not.emit(shop, "NewAllocation");
    tokenAllocation = await shop.tokenInfos(EstforConstants.BRONZE_SHIELD);
    let allocationRemaining = tokenPrice * 2n;
    expect(tokenAllocation.allocationRemaining).to.eq(allocationRemaining);

    // Not enough to have a price
    expect(await shop.liquidatePrice(EstforConstants.BRONZE_SHIELD)).to.be.eq(0n);
    await shop.connect(alice).sell(EstforConstants.BRONZE_SHIELD, 1, 0);
    tokenAllocation = await shop.tokenInfos(EstforConstants.BRONZE_SHIELD);
    expect(tokenAllocation.allocationRemaining).to.eq(allocationRemaining); // Remains unchanged

    // Mint some, should fail to sell any as allocation is used up
    await itemNFT.mint(alice, EstforConstants.BRONZE_SHIELD, minItemQuantityBeforeSellsAllowed);
    await expect(shop.connect(alice).sell(EstforConstants.BRONZE_SHIELD, 3, 0))
      .to.be.revertedWithCustomError(shop, "NotEnoughAllocationRemaining")
      .withArgs(EstforConstants.BRONZE_SHIELD, tokenPrice * 3n, allocationRemaining);
  });

  it("Allocation resets after 00:00 UTC", async function () {
    const {itemNFT, shop, treasury, brush, alice, sellingCutoffDuration} = await loadFixture(deployContracts);

    await itemNFT.mint(alice, EstforConstants.BRONZE_SHIELD, 1000);
    await itemNFT.mint(alice, EstforConstants.BARRAGE_SCROLL, 1000);
    await timeTravel(sellingCutoffDuration);

    // Give the contract some brush to assign to the items
    const totalBrush = parseEther("1");
    await brush.mint(treasury, totalBrush);

    let tokenAllocation = await shop.tokenInfos(EstforConstants.BRONZE_SHIELD); // Empty
    expect(tokenAllocation.allocationRemaining).to.eq(0);
    await shop.connect(alice).sell(EstforConstants.BRONZE_SHIELD, 1, 0);
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    tokenAllocation = await shop.tokenInfos(EstforConstants.BRONZE_SHIELD); // Empty
    expect(tokenAllocation.allocationRemaining).to.eq(parseEther("0.5") - parseEther("0.5") / 1000n);
    expect(tokenAllocation.checkpointTimestamp).to.eq(Math.floor(NOW / 86400) * 86400);
    await timeTravel24Hours();
    await shop.connect(alice).sell(EstforConstants.BRONZE_SHIELD, 1, 0);
    const {timestamp: NOW1} = (await ethers.provider.getBlock("latest")) as Block;
    tokenAllocation = await shop.tokenInfos(EstforConstants.BRONZE_SHIELD); // Empty
    expect(tokenAllocation.checkpointTimestamp).to.eq(Math.floor(NOW1 / 86400) * 86400);
    expect(tokenAllocation.allocationRemaining).to.eq("499249749749749750");
  });

  it("Price should be constant through the day", async function () {
    const {itemNFT, shop, treasury, brush, alice, sellingCutoffDuration} = await loadFixture(deployContracts);

    await itemNFT.mint(alice, EstforConstants.BRONZE_SHIELD, 2000);
    await itemNFT.mint(alice, EstforConstants.BARRAGE_SCROLL, 2000);
    await timeTravel(sellingCutoffDuration);

    // Give the contract some brush to assign to the items
    const totalBrush = parseEther("1");
    await brush.mint(treasury, totalBrush);

    await shop.connect(alice).sell(EstforConstants.BRONZE_SHIELD, 1, 0);
    let liquidatePrice = await shop.liquidatePrice(EstforConstants.BRONZE_SHIELD);
    expect(liquidatePrice).to.be.eq(parseEther("0.5") / 2000n);
    // Is same price
    await shop.connect(alice).sell(EstforConstants.BRONZE_SHIELD, 500, 0);
    liquidatePrice = await shop.liquidatePrice(EstforConstants.BRONZE_SHIELD);
    expect(liquidatePrice).to.be.eq(parseEther("0.5") / 2000n);
    // Now changes in a new day
    await timeTravel24Hours();
    liquidatePrice = await shop.liquidatePrice(EstforConstants.BRONZE_SHIELD);
    const newPrice = "291777851901267";
    expect(liquidatePrice).to.be.eq(newPrice);
    await shop.connect(alice).sell(EstforConstants.BRONZE_SHIELD, 300, 0);
    liquidatePrice = await shop.liquidatePrice(EstforConstants.BRONZE_SHIELD);
    expect(liquidatePrice).to.be.eq(newPrice);
  });

  it("Remove shop item", async function () {
    const {shop} = await loadFixture(deployContracts);
    const price = 500;
    await shop.addBuyableItems([{tokenId: EstforConstants.BRONZE_SHIELD, price}]);
    expect(await shop.shopItems(BRONZE_SHIELD)).eq(price);
    await shop.removeItems([BRONZE_SHIELD]);
    expect(await shop.shopItems(BRONZE_SHIELD)).eq(0);
    await expect(shop.removeItems([BRONZE_SHIELD])).to.be.revertedWithCustomError(shop, "ShopItemDoesNotExist");
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
          equipPosition: EstforTypes.EquipPosition.BODY
        }
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
      const {shop} = await loadFixture(deployContracts);
      await expect(shop.removeUnsellableItems([EstforConstants.BRONZE_SHIELD])).to.be.revertedWithCustomError(
        shop,
        "AlreadySellable"
      );
    });

    it("Cannot be sold", async function () {
      const {itemNFT, shop, treasury, brush, alice, sellingCutoffDuration, minItemQuantityBeforeSellsAllowed} =
        await loadFixture(deployContracts);

      await itemNFT.mint(alice, EstforConstants.BRONZE_SHIELD, minItemQuantityBeforeSellsAllowed * 2n);
      await itemNFT.mint(alice, EstforConstants.SAPPHIRE_AMULET, minItemQuantityBeforeSellsAllowed);

      // Give the contract some brush to assign to the items
      const totalBrush = minItemQuantityBeforeSellsAllowed * 20n;
      await brush.mint(treasury, totalBrush);

      await ethers.provider.send("evm_increaseTime", [sellingCutoffDuration]);
      await ethers.provider.send("evm_mine", []);
      await shop.addUnsellableItems([EstforConstants.BRONZE_SHIELD]);
      await expect(shop.connect(alice).sell(EstforConstants.BRONZE_SHIELD, 1, totalBrush))
        .to.be.revertedWithCustomError(shop, "ItemNotSellable")
        .withArgs(EstforConstants.BRONZE_SHIELD);
    });

    it("Should not affect the liquidation price", async function () {
      const {itemNFT, shop, treasury, brush, alice, sellingCutoffDuration, minItemQuantityBeforeSellsAllowed} =
        await loadFixture(deployContracts);

      await itemNFT.mint(alice, EstforConstants.BRONZE_SHIELD, minItemQuantityBeforeSellsAllowed * 2n);
      await itemNFT.mint(alice, EstforConstants.SAPPHIRE_AMULET, minItemQuantityBeforeSellsAllowed);

      // Give the contract some brush to assign to the items
      const totalBrush = minItemQuantityBeforeSellsAllowed * 20n;
      await brush.mint(treasury, totalBrush);

      const splitBrush = totalBrush / 2n;
      const priceShield = splitBrush / (minItemQuantityBeforeSellsAllowed * 2n);
      expect(await shop.liquidatePrice(EstforConstants.BRONZE_SHIELD)).to.eq(priceShield);

      const priceSapphireAmulet = splitBrush / minItemQuantityBeforeSellsAllowed;
      expect(await shop.liquidatePrices([EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET])).to.eql([
        BigInt(priceShield),
        BigInt(priceSapphireAmulet)
      ]);
      await ethers.provider.send("evm_increaseTime", [sellingCutoffDuration]);
      await ethers.provider.send("evm_mine", []);

      // Add amulet as unsellable so it can't be sold, bronze shield should now have all the allocation from the treasure
      await shop.addUnsellableItems([EstforConstants.SAPPHIRE_AMULET]);
      const priceShieldAfterUnsellable = totalBrush / (minItemQuantityBeforeSellsAllowed * 2n);
      expect(await shop.liquidatePrice(EstforConstants.BRONZE_SHIELD)).to.eq(priceShieldAfterUnsellable);
      expect(await shop.liquidatePrices([EstforConstants.BRONZE_SHIELD, EstforConstants.SAPPHIRE_AMULET])).to.eql([
        BigInt(priceShieldAfterUnsellable),
        BigInt(0)
      ]);
    });

    it("Should not affect the total allocation for selling", async function () {
      const {itemNFT, shop, treasury, brush, alice, sellingCutoffDuration} = await loadFixture(deployContracts);

      await itemNFT.mint(alice, EstforConstants.BRONZE_SHIELD, 1000);
      await itemNFT.mint(alice, EstforConstants.SAPPHIRE_AMULET, 1000);
      await ethers.provider.send("evm_increaseTime", [sellingCutoffDuration]);
      await ethers.provider.send("evm_mine", []);

      // Give the contract some brush to assign to the items
      const totalBrush = parseEther("1");
      await brush.mint(treasury, totalBrush);
      await shop.addUnsellableItems([EstforConstants.SAPPHIRE_AMULET]);

      let tokenAllocation = await shop.tokenInfos(EstforConstants.BRONZE_SHIELD); // Empty
      expect(tokenAllocation.allocationRemaining).to.eq(0);
      await expect(shop.connect(alice).sell(EstforConstants.BRONZE_SHIELD, 1, 0))
        .to.emit(shop, "NewAllocation")
        .withArgs(EstforConstants.BRONZE_SHIELD, totalBrush);
      tokenAllocation = await shop.tokenInfos(EstforConstants.BRONZE_SHIELD);
      expect(tokenAllocation.allocationRemaining).to.eq(parseEther("1") - parseEther("1") / 1000n);
    });

    it("Unsellable greater than total supply should not revert", async function () {
      const {itemNFT, shop, treasury, brush, alice, sellingCutoffDuration, minItemQuantityBeforeSellsAllowed} =
        await loadFixture(deployContracts);

      // 3 unsellable items
      await shop.addUnsellableItems([
        EstforConstants.BRONZE_SWORD,
        EstforConstants.RAW_MINNUS,
        EstforConstants.SAPPHIRE_AMULET
      ]);

      // 2 exist in the world
      await itemNFT.mint(alice, EstforConstants.BRONZE_SHIELD, minItemQuantityBeforeSellsAllowed);
      await itemNFT.mint(alice, EstforConstants.BRONZE_SWORD, minItemQuantityBeforeSellsAllowed);
      await timeTravel(sellingCutoffDuration);

      // Give the contract some brush to assign to the items
      const totalBrush = parseEther("1");
      await brush.mint(treasury, totalBrush);

      expect(await itemNFT["totalSupply()"]()).to.eq(2);

      const numItems = 2n;
      const splitBrush = totalBrush / numItems;
      const priceShield = splitBrush / minItemQuantityBeforeSellsAllowed;
      // confirm liquidate price(s) works
      expect(await shop.liquidatePrice(EstforConstants.BRONZE_SHIELD)).to.eq(priceShield);
      expect(await shop.liquidatePrices([EstforConstants.BRONZE_SHIELD])).to.deep.eq([priceShield]);

      // Sell
      await expect(shop.connect(alice).sell(EstforConstants.BRONZE_SHIELD, 1, priceShield))
        .to.emit(shop, "Sell")
        .withArgs(alice.address, EstforConstants.BRONZE_SHIELD, 1, priceShield)
        .to.emit(shop, "NewAllocation")
        .withArgs(EstforConstants.BRONZE_SHIELD, totalBrush / numItems);
    });
  });
});
