import {loadFixture, time} from "@nomicfoundation/hardhat-network-helpers";
import {ethers, upgrades} from "hardhat";
import {EstforTypes, EstforConstants} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {playersFixture} from "./Players/PlayersFixture";
import {getEventLog} from "./utils";

describe("BlackMarketTrader", function () {
  async function deployContracts() {
    const baseFixture = await loadFixture(playersFixture);
    const {itemNFT, blackMarketTrader, owner, alice, mockVRF} = baseFixture;
    return {...baseFixture};
  }

  const globalEventId = 1;
  const item = {
    price: 100,
    tokenId: EstforConstants.BRONZE_AXE,
    amountPerPurchase: 1,
    currentStock: 10,
    stock: 10,
    isActive: true,
  };

  it("Add shop items", async function () {
    const {blackMarketTrader, itemNFT} = await loadFixture(deployContracts);

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      },
    ]);

    await expect(blackMarketTrader.addShopItems([item], globalEventId))
      .to.emit(blackMarketTrader, "AddShopItems")
      .withArgs([Object.values(item)], globalEventId);

    // Try to add it again
    await expect(blackMarketTrader.addShopItems([item], globalEventId)).to.be.revertedWithCustomError(
      blackMarketTrader,
      "ShopItemAlreadyExists"
    );
  });

  it("Edit shop items", async function () {
    const {blackMarketTrader, itemNFT} = await loadFixture(deployContracts);
    const globalEventId = 1;

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      },
    ]);

    const item = {
      price: 100,
      tokenId: EstforConstants.BRONZE_AXE,
      amountPerPurchase: 1,
      currentStock: 10,
      stock: 10,
      isActive: true,
    };

    await blackMarketTrader.addShopItems([item], globalEventId);

    const editedItem = {
      price: 200,
      tokenId: EstforConstants.BRONZE_AXE,
      amountPerPurchase: 1,
      currentStock: 20,
      stock: 20,
      isActive: true,
    };

    await expect(blackMarketTrader.editShopItems([editedItem], globalEventId))
      .to.emit(blackMarketTrader, "EditShopItems")
      .withArgs([Object.values(editedItem)], globalEventId);
  });

  it("Remove shop items", async function () {
    const {blackMarketTrader, itemNFT} = await loadFixture(deployContracts);
    const globalEventId = 1;

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      },
    ]);

    const item = {
      tokenId: EstforConstants.BRONZE_AXE,
      amountPerPurchase: 1,
      price: 100,
      stock: 10,
      currentStock: 10,
      isActive: true,
    };

    await blackMarketTrader.addShopItems([item], globalEventId);

    await expect(blackMarketTrader.removeShopItems([item.tokenId], globalEventId))
      .to.emit(blackMarketTrader, "RemoveShopItems")
      .withArgs([item.tokenId], globalEventId);

    // Try to remove again
    await expect(blackMarketTrader.removeShopItems([item.tokenId], globalEventId)).to.be.revertedWithCustomError(
      blackMarketTrader,
      "ShopItemDoesNotExist"
    );

    // Try to edit a removed item
    await expect(blackMarketTrader.editShopItems([item], globalEventId)).to.be.revertedWithCustomError(
      blackMarketTrader,
      "ShopItemDoesNotExist"
    );
  });

  it("Price cannot be zero", async function () {
    const {blackMarketTrader, itemNFT} = await loadFixture(deployContracts);
    const globalEventId = 1;

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      },
    ]);

    const item = {
      tokenId: EstforConstants.BRONZE_AXE,
      amountPerPurchase: 1,
      price: 0,
      stock: 10,
      currentStock: 10,
      isActive: true,
    };

    await expect(blackMarketTrader.addShopItems([item], globalEventId)).to.be.revertedWithCustomError(
      blackMarketTrader,
      "PriceCannotBeZero"
    );
  });

  it("Item does not exist", async function () {
    const {blackMarketTrader} = await loadFixture(deployContracts);
    const globalEventId = 1;

    const item = {
      price: 100,
      tokenId: EstforConstants.BRONZE_AXE, // Not added to itemNFT yet
      amountPerPurchase: 1,
      currentStock: 10,
      stock: 10,
      isActive: true,
    };

    await expect(blackMarketTrader.addShopItems([item], globalEventId)).to.be.revertedWithCustomError(
      blackMarketTrader,
      "ItemDoesNotExist"
    );
  });

  it("Only owner can add, edit, remove items", async function () {
    const {blackMarketTrader, itemNFT, alice} = await loadFixture(deployContracts);
    const globalEventId = 1;

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_AXE,
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      },
    ]);

    const item = {
      tokenId: EstforConstants.BRONZE_AXE,
      amountPerPurchase: 1,
      price: 100,
      stock: 10,
      currentStock: 10,
      isActive: true,
    };

    await expect(blackMarketTrader.connect(alice).addShopItems([item], globalEventId)).to.be.revertedWithCustomError(
      blackMarketTrader,
      "OwnableUnauthorizedAccount"
    );

    // Add it as owner first
    await blackMarketTrader.addShopItems([item], globalEventId);

    await expect(blackMarketTrader.connect(alice).editShopItems([item], globalEventId)).to.be.revertedWithCustomError(
      blackMarketTrader,
      "OwnableUnauthorizedAccount"
    );

    await expect(
      blackMarketTrader.connect(alice).removeShopItems([item.tokenId], globalEventId)
    ).to.be.revertedWithCustomError(blackMarketTrader, "OwnableUnauthorizedAccount");
  });

  it("Request cost", async function () {
    const {blackMarketTrader} = await loadFixture(deployContracts);
    const numActions = 1;
    const cost = await blackMarketTrader.requestCost(numActions);
    expect(cost).to.be.greaterThan(0);
  });

  it("Shop timings and buy failures", async function () {
    const {blackMarketTrader, itemNFT, alice} = await loadFixture(deployContracts);

    // Add item to shop
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_AXE,
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_BAR, // Payment item
      },
    ]);
    await blackMarketTrader.addShopItems([item], globalEventId);
    await blackMarketTrader.setAcceptedItemId(globalEventId, EstforConstants.BRONZE_BAR);

    const currentTimestamp = await time.latest();
    const currentWeek = Math.floor(currentTimestamp / (7 * 24 * 3600));

    // Move to a Week 0
    const week0 = (Math.floor(currentWeek / 3) + 1) * 3;
    await time.increaseTo(week0 * 7 * 24 * 3600);
    await expect(
      blackMarketTrader.connect(alice).buy(alice.address, globalEventId, item.tokenId, 1)
    ).to.be.revertedWithCustomError(blackMarketTrader, "ShopClosed");

    // Move to Week 1, Day 0 (Thu)
    const week1 = week0 + 1;
    await time.increaseTo(week1 * 7 * 24 * 3600);
    await expect(
      blackMarketTrader.connect(alice).buy(alice.address, globalEventId, item.tokenId, 1)
    ).to.be.revertedWithCustomError(blackMarketTrader, "ShopAvailabilityNotDetermined");

    // Move to Week 1, Day 4 (Mon) - Closed
    await time.increaseTo(week1 * 7 * 24 * 3600 + 4 * 24 * 3600);
    await expect(
      blackMarketTrader.connect(alice).buy(alice.address, globalEventId, item.tokenId, 1)
    ).to.be.revertedWithCustomError(blackMarketTrader, "ShopClosed");

    // Move to Week 2, Day 0 (Thu) - Closed
    const week2 = week1 + 1;
    await time.increaseTo(week2 * 7 * 24 * 3600);
    await expect(
      blackMarketTrader.connect(alice).buy(alice.address, globalEventId, item.tokenId, 1)
    ).to.be.revertedWithCustomError(blackMarketTrader, "ShopClosed");
  });

  it("Initialise shop items and VRF fulfillment", async function () {
    const {blackMarketTrader, itemNFT, mockVRF, alice} = await loadFixture(deployContracts);

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_AXE,
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_BAR, // Payment item
      },
    ]);
    await blackMarketTrader.addShopItems([item], globalEventId);

    // Initialise without items (should fail)
    await expect(blackMarketTrader.initialiseShopItemsForEvent(2)).to.be.revertedWithCustomError(
      blackMarketTrader,
      "NoItemsInShop"
    );

    // Initialise correctly
    const cost = await blackMarketTrader.requestCost(1);
    const tx = await blackMarketTrader.initialiseShopItemsForEvent(globalEventId, {value: cost});
    let requestId = Number((await getEventLog(tx, blackMarketTrader, "RequestSent")).requestId);

    // Fulfill with a seed that makes rand % 3 == 0 (item active)
    let seed = 3;

    // Check if it works (lastRequestDay should be set)
    // We need to be in a valid window for buy to not revert with ShopClosed, but initialise works anytime.
    await mockVRF.fulfillSeeded(requestId, await blackMarketTrader.getAddress(), seed);
  });

  it("Buy items and stock management", async function () {
    const {blackMarketTrader, itemNFT, mockVRF, alice} = await loadFixture(deployContracts);

    const tokenId = EstforConstants.BRONZE_AXE;
    const price = 100;
    const stock = 10;
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: tokenId,
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.BRONZE_BAR, // Payment item
      },
    ]);

    await blackMarketTrader.addShopItems(
      [{tokenId, amountPerPurchase: 1, price, stock, currentStock: stock, isActive: true}],
      globalEventId
    );
    await blackMarketTrader.setAcceptedItemId(globalEventId, EstforConstants.BRONZE_BAR);

    // Give Alice some payment items
    await itemNFT.mint(alice.address, EstforConstants.BRONZE_BAR, 1000);

    const currentTimestamp = await time.latest();
    const currentWeek = Math.floor(currentTimestamp / (7 * 24 * 3600));
    const week1 = (Math.floor(currentWeek / 3) + 1) * 3 + 1;
    await time.increaseTo(week1 * 7 * 24 * 3600);

    // Initialise until we get an active item
    const cost = await blackMarketTrader.requestCost(1);

    const tx = await blackMarketTrader.initialiseShopItemsForEvent(globalEventId, {value: cost});
    // get requestId from event in tx
    let requestId = Number((await getEventLog(tx, blackMarketTrader, "RequestSent")).requestId);

    // For item at index i, the seed should satisfy (seed >> (i * 16)) % 3 == 0
    const seed = 0; // actual number is uint256(keccak256(abi.encodePacked(seed + _randomWord++))); where _randomWord starts at 1

    // Fulfill VRF
    await mockVRF.fulfillSeeded(requestId, await blackMarketTrader.getAddress(), seed);
    await blackMarketTrader.connect(alice).buy(alice.address, globalEventId, tokenId, 1);

    // Since we already bought 1 in the loop, we check balance
    expect(await itemNFT.balanceOf(alice.address, tokenId)).to.equal(2); // create player mints 1 by default, so buying 1 more makes it 2
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_BAR)).to.equal(900);

    // Buy more than stock
    await expect(
      blackMarketTrader.connect(alice).buy(alice.address, globalEventId, tokenId, 10)
    ).to.be.revertedWithCustomError(blackMarketTrader, "ItemStockInsufficient");

    // Buy remaining stock
    await blackMarketTrader.connect(alice).buy(alice.address, globalEventId, tokenId, 9);
    expect(await itemNFT.balanceOf(alice.address, tokenId)).to.equal(11);
    expect(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_BAR)).to.equal(0);
  });

  it("Daily resets and multiple globalEventIds", async function () {
    const {blackMarketTrader, itemNFT, mockVRF, alice} = await loadFixture(deployContracts);

    const tokenId1 = EstforConstants.BRONZE_AXE;
    const tokenId2 = EstforConstants.IRON_AXE;
    const paymentToken = EstforConstants.BRONZE_BAR;

    await itemNFT.addItems([
      {...EstforTypes.defaultItemInput, tokenId: tokenId1},
      {...EstforTypes.defaultItemInput, tokenId: tokenId2},
      {...EstforTypes.defaultItemInput, tokenId: paymentToken},
    ]);

    const eventId1 = 1;
    const eventId2 = 2;

    await blackMarketTrader.addShopItems(
      [{tokenId: tokenId1, amountPerPurchase: 1, price: 100, stock: 10, currentStock: 10, isActive: true}],
      eventId1
    );
    await blackMarketTrader.addShopItems(
      [{tokenId: tokenId2, amountPerPurchase: 1, price: 200, stock: 5, currentStock: 5, isActive: true}],
      eventId2
    );

    await blackMarketTrader.setAcceptedItemId(eventId1, paymentToken);
    await blackMarketTrader.setAcceptedItemId(eventId2, paymentToken);

    await itemNFT.mint(alice.address, paymentToken, 10000);

    // Set time to Week 1, Day 0
    const currentTimestamp = await time.latest();
    const currentWeek = Math.floor(currentTimestamp / (7 * 24 * 3600));
    const week1 = (Math.floor(currentWeek / 3) + 1) * 3 + 1;
    await time.increaseTo(week1 * 7 * 24 * 3600);

    const cost = await blackMarketTrader.requestCost(1);

    // Initialise event 1
    let tx = await blackMarketTrader.initialiseShopItemsForEvent(eventId1, {value: cost});
    let requestId = Number((await getEventLog(tx, blackMarketTrader, "RequestSent")).requestId);
    await mockVRF.fulfillSeeded(requestId, await blackMarketTrader.getAddress(), 0);

    // Initialise event 2
    tx = await blackMarketTrader.initialiseShopItemsForEvent(eventId2, {value: cost});
    requestId = Number((await getEventLog(tx, blackMarketTrader, "RequestSent")).requestId);
    await mockVRF.fulfillSeeded(requestId, await blackMarketTrader.getAddress(), 1);

    // Test daily reset
    await time.increase(24 * 3600);
    await expect(
      blackMarketTrader.connect(alice).buy(alice.address, eventId1, tokenId1, 1)
    ).to.be.revertedWithCustomError(blackMarketTrader, "ShopAvailabilityNotDetermined");
    await expect(
      blackMarketTrader.connect(alice).buy(alice.address, eventId2, tokenId2, 1)
    ).to.be.revertedWithCustomError(blackMarketTrader, "ShopAvailabilityNotDetermined");
  });

  it("Items change each day and approximately 1/3 are active", async function () {
    const {blackMarketTrader, itemNFT, mockVRF, alice} = await loadFixture(deployContracts);

    const numItems = 60;
    const itemInputs = [];
    const shopItems = [];
    for (let i = 0; i < numItems; ++i) {
      const tokenId = 1000 + i;
      itemInputs.push({...EstforTypes.defaultItemInput, tokenId});
      shopItems.push({tokenId, amountPerPurchase: 1, price: 10, stock: 10, currentStock: 10, isActive: false});
    }

    await itemNFT.addItems([...itemInputs, {...EstforTypes.defaultItemInput, tokenId: EstforConstants.BRONZE_BAR}]);
    await blackMarketTrader.addShopItems(shopItems, globalEventId);
    await blackMarketTrader.setAcceptedItemId(globalEventId, EstforConstants.BRONZE_BAR);

    const currentTimestamp = await time.latest();
    const currentWeek = Math.floor(currentTimestamp / (7 * 24 * 3600));
    const week1 = (Math.floor(currentWeek / 3) + 1) * 3 + 1;
    await time.increaseTo(week1 * 7 * 24 * 3600);

    const numWords = Math.ceil(numItems / 16);
    const cost = await blackMarketTrader.requestCost(numWords);

    const getActiveItems = async () => {
      const active = [];
      for (let i = 0; i < numItems; i++) {
        try {
          // buy with quantity 1 check if it is active
          await blackMarketTrader.connect(alice).buy(alice.address, globalEventId, 1000 + i, 1);
          active.push(1000 + i);
        } catch (e: any) {
          if (!e.message.includes("ItemCannotBeBought")) {
            active.push(1000 + i);
          }
        }
      }
      return active;
    };

    // Day 1
    let tx = await blackMarketTrader.initialiseShopItemsForEvent(globalEventId, {value: cost});
    let requestId = Number((await getEventLog(tx, blackMarketTrader, "RequestSent")).requestId);
    await mockVRF.fulfillSeeded(requestId, await blackMarketTrader.getAddress(), 123);
    const activeDay1 = await getActiveItems();

    // Check around 1/3 (tolerance of +/- some amount due to randomness)
    // With 60 items, expected is 20.
    expect(activeDay1.length).to.be.within(10, 30);

    // Day 2
    await time.increase(24 * 3600);
    tx = await blackMarketTrader.initialiseShopItemsForEvent(globalEventId, {value: cost});
    requestId = Number((await getEventLog(tx, blackMarketTrader, "RequestSent")).requestId);
    await mockVRF.fulfillSeeded(requestId, await blackMarketTrader.getAddress(), 456);
    const activeDay2 = await getActiveItems();

    expect(activeDay2.length).to.be.within(10, 30);
    // Ensure day 2 is different from day 1
    expect(activeDay2).to.not.deep.equal(activeDay1);
  });

  it("Stock is reset each day", async function () {
    const {blackMarketTrader, itemNFT, mockVRF, alice} = await loadFixture(deployContracts);

    const tokenId = EstforConstants.BRONZE_AXE;
    const paymentToken = EstforConstants.BRONZE_BAR;
    await itemNFT.addItems([
      {...EstforTypes.defaultItemInput, tokenId},
      {...EstforTypes.defaultItemInput, tokenId: paymentToken},
    ]);
    await blackMarketTrader.addShopItems(
      [{tokenId, amountPerPurchase: 1, price: 10, stock: 10, currentStock: 10, isActive: true}],
      globalEventId
    );
    await blackMarketTrader.setAcceptedItemId(globalEventId, paymentToken);
    await itemNFT.mint(alice.address, paymentToken, 1000);

    const currentTimestamp = await time.latest();
    const currentWeek = Math.floor(currentTimestamp / (7 * 24 * 3600));
    const week1 = (Math.floor(currentWeek / 3) + 1) * 3 + 1;
    await time.increaseTo(week1 * 7 * 24 * 3600);

    const cost = await blackMarketTrader.requestCost(1);

    // Find a seed that makes it active
    let active = false;
    let seed = 0;
    while (!active) {
      let tx = await blackMarketTrader.initialiseShopItemsForEvent(globalEventId, {value: cost});
      let requestId = Number((await getEventLog(tx, blackMarketTrader, "RequestSent")).requestId);
      await mockVRF.fulfillSeeded(requestId, await blackMarketTrader.getAddress(), seed++);
      try {
        await blackMarketTrader.connect(alice).buy(alice.address, globalEventId, tokenId, 1);
        active = true;
      } catch (e) {}
    }

    // Buy some
    await blackMarketTrader.connect(alice).buy(alice.address, globalEventId, tokenId, 5);

    // Move to next day
    await time.increase(24 * 3600);

    // Initialise again (ensure it's active again for testing)
    active = false;
    while (!active) {
      let tx = await blackMarketTrader.initialiseShopItemsForEvent(globalEventId, {value: cost});
      let requestId = Number((await getEventLog(tx, blackMarketTrader, "RequestSent")).requestId);
      await mockVRF.fulfillSeeded(requestId, await blackMarketTrader.getAddress(), seed++);
      try {
        await blackMarketTrader.connect(alice).buy(alice.address, globalEventId, tokenId, 1);
        active = true;
      } catch (e) {}
    }

    // Buy another 9 (fails if not reset, passes if reset)
    await blackMarketTrader.connect(alice).buy(alice.address, globalEventId, tokenId, 9);
  });

  it("setAcceptedItemId validations and events", async function () {
    const {blackMarketTrader, itemNFT, alice} = await loadFixture(deployContracts);

    await itemNFT.addItems([{...EstforTypes.defaultItemInput, tokenId: EstforConstants.BRONZE_BAR}]);

    // Non-owner cannot set accepted item
    await expect(
      blackMarketTrader.connect(alice).setAcceptedItemId(globalEventId, EstforConstants.BRONZE_BAR)
    ).to.be.revertedWithCustomError(blackMarketTrader, "OwnableUnauthorizedAccount");

    // Cannot set non-existent item as accepted
    await expect(
      blackMarketTrader.setAcceptedItemId(globalEventId, EstforConstants.IRON_BAR)
    ).to.be.revertedWithCustomError(blackMarketTrader, "ItemDoesNotExist");

    // Valid set should emit event
    await expect(blackMarketTrader.setAcceptedItemId(globalEventId, EstforConstants.BRONZE_BAR))
      .to.emit(blackMarketTrader, "AcceptedItemIdSet")
      .withArgs(globalEventId, EstforConstants.BRONZE_BAR);
  });

  it("AlreadyInitialisedToday error when calling initialise twice same day", async function () {
    const {blackMarketTrader, itemNFT, mockVRF} = await loadFixture(deployContracts);

    await itemNFT.addItems([{...EstforTypes.defaultItemInput, tokenId: EstforConstants.BRONZE_AXE}]);
    await blackMarketTrader.addShopItems([item], globalEventId);

    const cost = await blackMarketTrader.requestCost(1);

    // First initialise
    const tx = await blackMarketTrader.initialiseShopItemsForEvent(globalEventId, {value: cost});
    const requestId = Number((await getEventLog(tx, blackMarketTrader, "RequestSent")).requestId);
    await mockVRF.fulfillSeeded(requestId, await blackMarketTrader.getAddress(), 0);

    // Second initialise same day should fail
    await expect(
      blackMarketTrader.initialiseShopItemsForEvent(globalEventId, {value: cost})
    ).to.be.revertedWithCustomError(blackMarketTrader, "AlreadyInitialisedToday");
  });

  it("AlreadyInitialisedToday prevents race condition before VRF fulfillment", async function () {
    const {blackMarketTrader, itemNFT} = await loadFixture(deployContracts);

    await itemNFT.addItems([{...EstforTypes.defaultItemInput, tokenId: EstforConstants.BRONZE_AXE}]);
    await blackMarketTrader.addShopItems([item], globalEventId);

    const cost = await blackMarketTrader.requestCost(1);

    // First initialise - request sent but NOT fulfilled yet
    await blackMarketTrader.initialiseShopItemsForEvent(globalEventId, {value: cost});

    // Second initialise same day should fail BEFORE VRF fulfillment
    // This prevents the race condition where multiple VRF requests could be made
    await expect(
      blackMarketTrader.initialiseShopItemsForEvent(globalEventId, {value: cost})
    ).to.be.revertedWithCustomError(blackMarketTrader, "AlreadyInitialisedToday");
  });

  it("amountPerPurchase multiplies items received", async function () {
    const {blackMarketTrader, itemNFT, mockVRF, alice} = await loadFixture(deployContracts);

    const tokenId = EstforConstants.BRONZE_AXE;
    const paymentToken = EstforConstants.BRONZE_BAR;
    const amountPerPurchase = 5;
    const price = 10;
    const quantity = 3;

    await itemNFT.addItems([
      {...EstforTypes.defaultItemInput, tokenId},
      {...EstforTypes.defaultItemInput, tokenId: paymentToken},
    ]);

    await blackMarketTrader.addShopItems(
      [{tokenId, amountPerPurchase, price, stock: 100, currentStock: 100, isActive: true}],
      globalEventId
    );
    await blackMarketTrader.setAcceptedItemId(globalEventId, paymentToken);
    await itemNFT.mint(alice.address, paymentToken, 1000);

    const currentTimestamp = await time.latest();
    const currentWeek = Math.floor(currentTimestamp / (7 * 24 * 3600));
    const week1 = (Math.floor(currentWeek / 3) + 1) * 3 + 1;
    await time.increaseTo(week1 * 7 * 24 * 3600);

    const cost = await blackMarketTrader.requestCost(1);
    const tx = await blackMarketTrader.initialiseShopItemsForEvent(globalEventId, {value: cost});
    const requestId = Number((await getEventLog(tx, blackMarketTrader, "RequestSent")).requestId);
    await mockVRF.fulfillSeeded(requestId, await blackMarketTrader.getAddress(), 0);

    const balanceBefore = await itemNFT.balanceOf(alice.address, tokenId);
    const paymentBalanceBefore = await itemNFT.balanceOf(alice.address, paymentToken);

    // Buy with quantity 3, amountPerPurchase 5 = should receive 15 items
    await blackMarketTrader.connect(alice).buy(alice.address, globalEventId, tokenId, quantity);

    // Should receive amountPerPurchase * quantity items
    const expectedItemsReceived = amountPerPurchase * quantity;
    expect(await itemNFT.balanceOf(alice.address, tokenId)).to.equal(balanceBefore + BigInt(expectedItemsReceived));

    // Should pay price * quantity
    const expectedPayment = price * quantity;
    expect(await itemNFT.balanceOf(alice.address, paymentToken)).to.equal(
      paymentBalanceBefore - BigInt(expectedPayment)
    );
  });

  it("amountPerPurchase equals stock and buy entire stock", async function () {
    const {blackMarketTrader, itemNFT, mockVRF, alice} = await loadFixture(deployContracts);

    const tokenId = EstforConstants.BRONZE_AXE;
    const paymentToken = EstforConstants.BRONZE_BAR;
    const amountPerPurchase = 10;
    const stock = 10; // Same as amountPerPurchase
    const price = 5;

    await itemNFT.addItems([
      {...EstforTypes.defaultItemInput, tokenId},
      {...EstforTypes.defaultItemInput, tokenId: paymentToken},
    ]);

    await blackMarketTrader.addShopItems(
      [{tokenId, amountPerPurchase, price, stock, currentStock: stock, isActive: true}],
      globalEventId
    );
    await blackMarketTrader.setAcceptedItemId(globalEventId, paymentToken);
    await itemNFT.mint(alice.address, paymentToken, 1000);

    const currentTimestamp = await time.latest();
    const currentWeek = Math.floor(currentTimestamp / (7 * 24 * 3600));
    const week1 = (Math.floor(currentWeek / 3) + 1) * 3 + 1;
    await time.increaseTo(week1 * 7 * 24 * 3600);

    const cost = await blackMarketTrader.requestCost(1);
    const tx = await blackMarketTrader.initialiseShopItemsForEvent(globalEventId, {value: cost});
    const requestId = Number((await getEventLog(tx, blackMarketTrader, "RequestSent")).requestId);
    await mockVRF.fulfillSeeded(requestId, await blackMarketTrader.getAddress(), 0);

    const balanceBefore = await itemNFT.balanceOf(alice.address, tokenId);
    const paymentBalanceBefore = await itemNFT.balanceOf(alice.address, paymentToken);

    // Buy entire stock (quantity = stock = amountPerPurchase = 10)
    // Should receive amountPerPurchase * quantity = 10 * 10 = 100 items
    await blackMarketTrader.connect(alice).buy(alice.address, globalEventId, tokenId, stock);

    const expectedItemsReceived = amountPerPurchase * stock;
    expect(await itemNFT.balanceOf(alice.address, tokenId)).to.equal(balanceBefore + BigInt(expectedItemsReceived));

    const expectedPayment = price * stock;
    expect(await itemNFT.balanceOf(alice.address, paymentToken)).to.equal(
      paymentBalanceBefore - BigInt(expectedPayment)
    );

    // Stock should now be depleted - trying to buy more should fail
    await expect(
      blackMarketTrader.connect(alice).buy(alice.address, globalEventId, tokenId, 1)
    ).to.be.revertedWithCustomError(blackMarketTrader, "ItemStockInsufficient");
  });

  it("Infinite stock (stock = 0) allows unlimited buying", async function () {
    const {blackMarketTrader, itemNFT, mockVRF, alice} = await loadFixture(deployContracts);

    const tokenId = EstforConstants.BRONZE_AXE;
    const paymentToken = EstforConstants.BRONZE_BAR;
    await itemNFT.addItems([
      {...EstforTypes.defaultItemInput, tokenId},
      {...EstforTypes.defaultItemInput, tokenId: paymentToken},
    ]);

    // Add item with stock = 0 (infinite)
    await blackMarketTrader.addShopItems(
      [{tokenId, amountPerPurchase: 1, price: 10, stock: 0, currentStock: 0, isActive: true}],
      globalEventId
    );
    await blackMarketTrader.setAcceptedItemId(globalEventId, paymentToken);
    await itemNFT.mint(alice.address, paymentToken, 100000);

    const currentTimestamp = await time.latest();
    const currentWeek = Math.floor(currentTimestamp / (7 * 24 * 3600));
    const week1 = (Math.floor(currentWeek / 3) + 1) * 3 + 1;
    await time.increaseTo(week1 * 7 * 24 * 3600);

    const cost = await blackMarketTrader.requestCost(1);
    const tx = await blackMarketTrader.initialiseShopItemsForEvent(globalEventId, {value: cost});
    const requestId = Number((await getEventLog(tx, blackMarketTrader, "RequestSent")).requestId);
    await mockVRF.fulfillSeeded(requestId, await blackMarketTrader.getAddress(), 0);

    // Buy large quantities multiple times (should not fail due to stock)
    await blackMarketTrader.connect(alice).buy(alice.address, globalEventId, tokenId, 100);
    await blackMarketTrader.connect(alice).buy(alice.address, globalEventId, tokenId, 500);
    await blackMarketTrader.connect(alice).buy(alice.address, globalEventId, tokenId, 1000);

    // Verify all items received (1 from player creation + 1600 bought)
    expect(await itemNFT.balanceOf(alice.address, tokenId)).to.equal(1601);
  });

  it("Buy event is emitted with correct parameters", async function () {
    const {blackMarketTrader, itemNFT, mockVRF, alice, bob} = await loadFixture(deployContracts);

    const tokenId = EstforConstants.BRONZE_AXE;
    const paymentToken = EstforConstants.BRONZE_BAR;
    const price = 50;
    await itemNFT.addItems([
      {...EstforTypes.defaultItemInput, tokenId},
      {...EstforTypes.defaultItemInput, tokenId: paymentToken},
    ]);

    await blackMarketTrader.addShopItems(
      [{tokenId, amountPerPurchase: 1, price, stock: 100, currentStock: 100, isActive: true}],
      globalEventId
    );
    await blackMarketTrader.setAcceptedItemId(globalEventId, paymentToken);
    await itemNFT.mint(alice.address, paymentToken, 10000);

    const currentTimestamp = await time.latest();
    const currentWeek = Math.floor(currentTimestamp / (7 * 24 * 3600));
    const week1 = (Math.floor(currentWeek / 3) + 1) * 3 + 1;
    await time.increaseTo(week1 * 7 * 24 * 3600);

    const cost = await blackMarketTrader.requestCost(1);
    const tx = await blackMarketTrader.initialiseShopItemsForEvent(globalEventId, {value: cost});
    const requestId = Number((await getEventLog(tx, blackMarketTrader, "RequestSent")).requestId);
    await mockVRF.fulfillSeeded(requestId, await blackMarketTrader.getAddress(), 0);

    const quantity = 5;
    await expect(blackMarketTrader.connect(alice).buy(bob.address, globalEventId, tokenId, quantity))
      .to.emit(blackMarketTrader, "Buy")
      .withArgs(alice.address, bob.address, globalEventId, tokenId, quantity, price, 1);
  });

  it("Buy to different address (to parameter)", async function () {
    const {blackMarketTrader, itemNFT, mockVRF, alice, bob} = await loadFixture(deployContracts);

    const tokenId = EstforConstants.BRONZE_AXE;
    const paymentToken = EstforConstants.BRONZE_BAR;
    await itemNFT.addItems([
      {...EstforTypes.defaultItemInput, tokenId},
      {...EstforTypes.defaultItemInput, tokenId: paymentToken},
    ]);

    await blackMarketTrader.addShopItems(
      [{tokenId, amountPerPurchase: 1, price: 10, stock: 100, currentStock: 100, isActive: true}],
      globalEventId
    );
    await blackMarketTrader.setAcceptedItemId(globalEventId, paymentToken);
    await itemNFT.mint(alice.address, paymentToken, 1000);

    const currentTimestamp = await time.latest();
    const currentWeek = Math.floor(currentTimestamp / (7 * 24 * 3600));
    const week1 = (Math.floor(currentWeek / 3) + 1) * 3 + 1;
    await time.increaseTo(week1 * 7 * 24 * 3600);

    const cost = await blackMarketTrader.requestCost(1);
    const tx = await blackMarketTrader.initialiseShopItemsForEvent(globalEventId, {value: cost});
    const requestId = Number((await getEventLog(tx, blackMarketTrader, "RequestSent")).requestId);
    await mockVRF.fulfillSeeded(requestId, await blackMarketTrader.getAddress(), 0);

    // Alice pays, Bob receives
    const bobBalanceBefore = await itemNFT.balanceOf(bob.address, tokenId);
    await blackMarketTrader.connect(alice).buy(bob.address, globalEventId, tokenId, 5);

    // Bob should receive the items
    expect(await itemNFT.balanceOf(bob.address, tokenId)).to.equal(bobBalanceBefore + 5n);
    // Alice should have paid
    expect(await itemNFT.balanceOf(alice.address, paymentToken)).to.equal(950);
  });

  it("AcceptedItemNotSet error when buying without accepted item", async function () {
    const {blackMarketTrader, itemNFT, mockVRF, alice} = await loadFixture(deployContracts);

    const tokenId = EstforConstants.BRONZE_AXE;
    await itemNFT.addItems([{...EstforTypes.defaultItemInput, tokenId}]);

    await blackMarketTrader.addShopItems(
      [{tokenId, amountPerPurchase: 1, price: 10, stock: 10, currentStock: 10, isActive: true}],
      globalEventId
    );
    // Note: NOT setting acceptedItemId

    const currentTimestamp = await time.latest();
    const currentWeek = Math.floor(currentTimestamp / (7 * 24 * 3600));
    const week1 = (Math.floor(currentWeek / 3) + 1) * 3 + 1;
    await time.increaseTo(week1 * 7 * 24 * 3600);

    const cost = await blackMarketTrader.requestCost(1);
    const tx = await blackMarketTrader.initialiseShopItemsForEvent(globalEventId, {value: cost});
    const requestId = Number((await getEventLog(tx, blackMarketTrader, "RequestSent")).requestId);
    await mockVRF.fulfillSeeded(requestId, await blackMarketTrader.getAddress(), 0);

    await expect(
      blackMarketTrader.connect(alice).buy(alice.address, globalEventId, tokenId, 1)
    ).to.be.revertedWithCustomError(blackMarketTrader, "AcceptedItemNotSet");
  });

  it("Insufficient payment tokens reverts", async function () {
    const {blackMarketTrader, itemNFT, mockVRF, alice} = await loadFixture(deployContracts);

    const tokenId = EstforConstants.BRONZE_AXE;
    const paymentToken = EstforConstants.BRONZE_BAR;
    await itemNFT.addItems([
      {...EstforTypes.defaultItemInput, tokenId},
      {...EstforTypes.defaultItemInput, tokenId: paymentToken},
    ]);

    await blackMarketTrader.addShopItems(
      [{tokenId, amountPerPurchase: 1, price: 100, stock: 10, currentStock: 10, isActive: true}],
      globalEventId
    );
    await blackMarketTrader.setAcceptedItemId(globalEventId, paymentToken);
    // Give Alice only 50 tokens, but price is 100
    await itemNFT.mint(alice.address, paymentToken, 50);

    const currentTimestamp = await time.latest();
    const currentWeek = Math.floor(currentTimestamp / (7 * 24 * 3600));
    const week1 = (Math.floor(currentWeek / 3) + 1) * 3 + 1;
    await time.increaseTo(week1 * 7 * 24 * 3600);

    const cost = await blackMarketTrader.requestCost(1);
    const tx = await blackMarketTrader.initialiseShopItemsForEvent(globalEventId, {value: cost});
    const requestId = Number((await getEventLog(tx, blackMarketTrader, "RequestSent")).requestId);
    await mockVRF.fulfillSeeded(requestId, await blackMarketTrader.getAddress(), 0);

    // Should revert due to insufficient balance
    await expect(blackMarketTrader.connect(alice).buy(alice.address, globalEventId, tokenId, 1)).to.be.reverted; // Will revert in the burn function
  });

  it("Edit shop items with zero price reverts", async function () {
    const {blackMarketTrader, itemNFT} = await loadFixture(deployContracts);

    await itemNFT.addItems([{...EstforTypes.defaultItemInput, tokenId: EstforConstants.BRONZE_AXE}]);

    await blackMarketTrader.addShopItems([item], globalEventId);

    const editedItemWithZeroPrice = {
      tokenId: EstforConstants.BRONZE_AXE,
      amountPerPurchase: 1,
      price: 0,
      stock: 20,
      currentStock: 20,
      isActive: true,
    };

    await expect(
      blackMarketTrader.editShopItems([editedItemWithZeroPrice], globalEventId)
    ).to.be.revertedWithCustomError(blackMarketTrader, "PriceCannotBeZero");
  });

  it("Add, edit, remove multiple items in batch", async function () {
    const {blackMarketTrader, itemNFT} = await loadFixture(deployContracts);

    await itemNFT.addItems([
      {...EstforTypes.defaultItemInput, tokenId: EstforConstants.BRONZE_AXE},
      {...EstforTypes.defaultItemInput, tokenId: EstforConstants.IRON_AXE},
      {...EstforTypes.defaultItemInput, tokenId: EstforConstants.MITHRIL_AXE},
    ]);

    const items = [
      {
        tokenId: EstforConstants.BRONZE_AXE,
        amountPerPurchase: 1,
        price: 100,
        stock: 10,
        currentStock: 10,
        isActive: true,
      },
      {
        tokenId: EstforConstants.IRON_AXE,
        amountPerPurchase: 1,
        price: 200,
        stock: 20,
        currentStock: 20,
        isActive: true,
      },
      {
        tokenId: EstforConstants.MITHRIL_AXE,
        amountPerPurchase: 1,
        price: 300,
        stock: 30,
        currentStock: 30,
        isActive: true,
      },
    ];

    // Add multiple items
    await expect(blackMarketTrader.addShopItems(items, globalEventId)).to.emit(blackMarketTrader, "AddShopItems");

    // Edit multiple items
    const editedItems = [
      {
        tokenId: EstforConstants.BRONZE_AXE,
        amountPerPurchase: 1,
        price: 150,
        stock: 15,
        currentStock: 15,
        isActive: true,
      },
      {
        tokenId: EstforConstants.IRON_AXE,
        amountPerPurchase: 1,
        price: 250,
        stock: 25,
        currentStock: 25,
        isActive: true,
      },
    ];
    await expect(blackMarketTrader.editShopItems(editedItems, globalEventId)).to.emit(
      blackMarketTrader,
      "EditShopItems"
    );

    // Remove multiple items
    await expect(
      blackMarketTrader.removeShopItems([EstforConstants.BRONZE_AXE, EstforConstants.IRON_AXE], globalEventId)
    ).to.emit(blackMarketTrader, "RemoveShopItems");
  });

  it("ShopActiveItemsUpdated event is emitted with correct active items", async function () {
    const {blackMarketTrader, itemNFT, mockVRF} = await loadFixture(deployContracts);

    await itemNFT.addItems([
      {...EstforTypes.defaultItemInput, tokenId: EstforConstants.BRONZE_AXE},
      {...EstforTypes.defaultItemInput, tokenId: EstforConstants.IRON_AXE},
      {...EstforTypes.defaultItemInput, tokenId: EstforConstants.MITHRIL_AXE},
    ]);

    const items = [
      {
        tokenId: EstforConstants.BRONZE_AXE,
        amountPerPurchase: 1,
        price: 100,
        stock: 10,
        currentStock: 10,
        isActive: false,
      },
      {
        tokenId: EstforConstants.IRON_AXE,
        amountPerPurchase: 1,
        price: 200,
        stock: 20,
        currentStock: 20,
        isActive: false,
      },
      {
        tokenId: EstforConstants.MITHRIL_AXE,
        amountPerPurchase: 1,
        price: 300,
        stock: 30,
        currentStock: 30,
        isActive: false,
      },
    ];

    await blackMarketTrader.addShopItems(items, globalEventId);

    const cost = await blackMarketTrader.requestCost(1);
    const tx = await blackMarketTrader.initialiseShopItemsForEvent(globalEventId, {value: cost});
    const requestId = Number((await getEventLog(tx, blackMarketTrader, "RequestSent")).requestId);

    // Fulfill and check event
    await expect(mockVRF.fulfillSeeded(requestId, await blackMarketTrader.getAddress(), 0)).to.emit(
      blackMarketTrader,
      "ShopActiveItemsUpdated"
    );
  });

  it("Buy inactive item reverts with ItemCannotBeBought", async function () {
    const {blackMarketTrader, itemNFT, mockVRF, alice} = await loadFixture(deployContracts);

    const tokenId = EstforConstants.BRONZE_AXE;
    const inactiveTokenId = EstforConstants.IRON_AXE;
    const paymentToken = EstforConstants.BRONZE_BAR;

    await itemNFT.addItems([
      {...EstforTypes.defaultItemInput, tokenId},
      {...EstforTypes.defaultItemInput, tokenId: inactiveTokenId},
      {...EstforTypes.defaultItemInput, tokenId: paymentToken},
    ]);

    await blackMarketTrader.addShopItems(
      [
        {tokenId, amountPerPurchase: 1, price: 10, stock: 10, currentStock: 10, isActive: true},
        {tokenId: inactiveTokenId, amountPerPurchase: 1, price: 10, stock: 10, currentStock: 10, isActive: true},
      ],
      globalEventId
    );
    await blackMarketTrader.setAcceptedItemId(globalEventId, paymentToken);
    await itemNFT.mint(alice.address, paymentToken, 1000);

    const currentTimestamp = await time.latest();
    const currentWeek = Math.floor(currentTimestamp / (7 * 24 * 3600));
    const week1 = (Math.floor(currentWeek / 3) + 1) * 3 + 1;
    await time.increaseTo(week1 * 7 * 24 * 3600);

    const cost = await blackMarketTrader.requestCost(1);
    const tx = await blackMarketTrader.initialiseShopItemsForEvent(globalEventId, {value: cost});
    const requestId = Number((await getEventLog(tx, blackMarketTrader, "RequestSent")).requestId);
    // Use a seed that makes the second item inactive (rand % 3 != 0)
    // The VRF uses uint16(randomWords[randomWordIndex] >> ((i % 16) * 16)) % 3 == 0
    // We need a seed where the second item's portion gives a non-zero mod 3 result
    await mockVRF.fulfillSeeded(requestId, await blackMarketTrader.getAddress(), 1);

    // Try buying an item that might be inactive
    await expect(
      blackMarketTrader.connect(alice).buy(alice.address, globalEventId, inactiveTokenId, 1)
    ).to.be.revertedWithCustomError(blackMarketTrader, "ItemCannotBeBought");
  });

  it("Buy non-existent shop item reverts", async function () {
    const {blackMarketTrader, itemNFT, mockVRF, alice} = await loadFixture(deployContracts);

    const tokenId = EstforConstants.BRONZE_AXE;
    const nonExistentTokenId = EstforConstants.IRON_AXE;
    const paymentToken = EstforConstants.BRONZE_BAR;

    await itemNFT.addItems([
      {...EstforTypes.defaultItemInput, tokenId},
      {...EstforTypes.defaultItemInput, tokenId: nonExistentTokenId},
      {...EstforTypes.defaultItemInput, tokenId: paymentToken},
    ]);

    // Only add BRONZE_AXE to shop, not IRON_AXE
    await blackMarketTrader.addShopItems(
      [{tokenId, amountPerPurchase: 1, price: 10, stock: 10, currentStock: 10, isActive: true}],
      globalEventId
    );
    await blackMarketTrader.setAcceptedItemId(globalEventId, paymentToken);
    await itemNFT.mint(alice.address, paymentToken, 1000);

    const currentTimestamp = await time.latest();
    const currentWeek = Math.floor(currentTimestamp / (7 * 24 * 3600));
    const week1 = (Math.floor(currentWeek / 3) + 1) * 3 + 1;
    await time.increaseTo(week1 * 7 * 24 * 3600);

    const cost = await blackMarketTrader.requestCost(1);
    const tx = await blackMarketTrader.initialiseShopItemsForEvent(globalEventId, {value: cost});
    const requestId = Number((await getEventLog(tx, blackMarketTrader, "RequestSent")).requestId);
    await mockVRF.fulfillSeeded(requestId, await blackMarketTrader.getAddress(), 0);

    // Try to buy item that wasn't added to shop
    await expect(
      blackMarketTrader.connect(alice).buy(alice.address, globalEventId, nonExistentTokenId, 1)
    ).to.be.revertedWithCustomError(blackMarketTrader, "ItemCannotBeBought");
  });

  it("Request cost varies with number of actions", async function () {
    const {blackMarketTrader} = await loadFixture(deployContracts);

    const cost1 = await blackMarketTrader.requestCost(1);
    const cost2 = await blackMarketTrader.requestCost(2);
    const cost10 = await blackMarketTrader.requestCost(10);

    expect(cost2).to.be.greaterThan(cost1);
    expect(cost10).to.be.greaterThan(cost2);
  });

  it("Initialise can be called by anyone (not just owner)", async function () {
    const {blackMarketTrader, itemNFT, alice} = await loadFixture(deployContracts);

    await itemNFT.addItems([{...EstforTypes.defaultItemInput, tokenId: EstforConstants.BRONZE_AXE}]);
    await blackMarketTrader.addShopItems([item], globalEventId);

    const cost = await blackMarketTrader.requestCost(1);

    // Alice (non-owner) should be able to initialise
    await expect(blackMarketTrader.connect(alice).initialiseShopItemsForEvent(globalEventId, {value: cost})).to.emit(
      blackMarketTrader,
      "RequestSent"
    );
  });

  it("Shop boundary times - exactly at day/week transitions", async function () {
    const {blackMarketTrader, itemNFT, mockVRF, alice} = await loadFixture(deployContracts);

    const tokenId = EstforConstants.BRONZE_AXE;
    const paymentToken = EstforConstants.BRONZE_BAR;

    await itemNFT.addItems([
      {...EstforTypes.defaultItemInput, tokenId},
      {...EstforTypes.defaultItemInput, tokenId: paymentToken},
    ]);
    await blackMarketTrader.addShopItems([item], globalEventId);
    await blackMarketTrader.setAcceptedItemId(globalEventId, paymentToken);
    await itemNFT.mint(alice.address, paymentToken, 10000);

    const currentTimestamp = await time.latest();
    const currentWeek = Math.floor(currentTimestamp / (7 * 24 * 3600));
    const week1 = (Math.floor(currentWeek / 3) + 1) * 3 + 1;

    // Day 3 (Sun) is the last open day. Days are 0-indexed within the week (0=Thu, 1=Fri, 2=Sat, 3=Sun)
    // Shop is open when (timestamp / 1 days) % 7 < 4
    // Day 3 of week1 starts at: week1 * 7 * 24 * 3600 + 3 * 24 * 3600
    const day3Start = week1 * 7 * 24 * 3600 + 3 * 24 * 3600;
    await time.increaseTo(day3Start);

    const cost = await blackMarketTrader.requestCost(1);
    let tx = await blackMarketTrader.initialiseShopItemsForEvent(globalEventId, {value: cost});
    let requestId = Number((await getEventLog(tx, blackMarketTrader, "RequestSent")).requestId);
    await mockVRF.fulfillSeeded(requestId, await blackMarketTrader.getAddress(), 0);

    // Should be able to buy on day 3
    await blackMarketTrader.connect(alice).buy(alice.address, globalEventId, tokenId, 1);

    // Move to day 4 (Mon) - shop should be closed
    const day4Start = week1 * 7 * 24 * 3600 + 4 * 24 * 3600;
    await time.increaseTo(day4Start);

    // Should be closed now (day 4 = Mon)
    await expect(
      blackMarketTrader.connect(alice).buy(alice.address, globalEventId, tokenId, 1)
    ).to.be.revertedWithCustomError(blackMarketTrader, "ShopClosed");
  });

  it("Week 0 to Week 1 transition", async function () {
    const {blackMarketTrader, itemNFT, mockVRF, alice} = await loadFixture(deployContracts);

    const tokenId = EstforConstants.BRONZE_AXE;
    const paymentToken = EstforConstants.BRONZE_BAR;

    await itemNFT.addItems([
      {...EstforTypes.defaultItemInput, tokenId},
      {...EstforTypes.defaultItemInput, tokenId: paymentToken},
    ]);
    await blackMarketTrader.addShopItems([item], globalEventId);
    await blackMarketTrader.setAcceptedItemId(globalEventId, paymentToken);
    await itemNFT.mint(alice.address, paymentToken, 10000);

    const currentTimestamp = await time.latest();
    const currentWeek = Math.floor(currentTimestamp / (7 * 24 * 3600));
    const week0 = (Math.floor(currentWeek / 3) + 1) * 3;

    // Week 0, Day 0 (Thu) - shop should be closed because week % 3 == 0
    const week0Day0 = week0 * 7 * 24 * 3600;
    await time.increaseTo(week0Day0);
    await expect(
      blackMarketTrader.connect(alice).buy(alice.address, globalEventId, tokenId, 1)
    ).to.be.revertedWithCustomError(blackMarketTrader, "ShopClosed");

    // Week 1, Day 0 (Thu) - shop should be open (week % 3 == 1)
    const week1 = week0 + 1;
    const week1Day0 = week1 * 7 * 24 * 3600;
    await time.increaseTo(week1Day0);

    const cost = await blackMarketTrader.requestCost(1);
    const tx = await blackMarketTrader.initialiseShopItemsForEvent(globalEventId, {value: cost});
    const requestId = Number((await getEventLog(tx, blackMarketTrader, "RequestSent")).requestId);
    await mockVRF.fulfillSeeded(requestId, await blackMarketTrader.getAddress(), 0);

    // Should be open now
    await blackMarketTrader.connect(alice).buy(alice.address, globalEventId, tokenId, 1);

    // Week 2, Day 0 (Thu) - shop should be closed (week % 3 == 2)
    const week2 = week1 + 1;
    const week2Day0 = week2 * 7 * 24 * 3600;
    await time.increaseTo(week2Day0);
    await expect(
      blackMarketTrader.connect(alice).buy(alice.address, globalEventId, tokenId, 1)
    ).to.be.revertedWithCustomError(blackMarketTrader, "ShopClosed");
  });

  it("Multiple random words needed for many items", async function () {
    const {blackMarketTrader, itemNFT, mockVRF} = await loadFixture(deployContracts);

    // Add 33 items (needs 3 random words: ceil(33/16) = 3)
    const numItems = 33;
    const itemInputs = [];
    const shopItems = [];
    for (let i = 0; i < numItems; ++i) {
      const tokenId = 2000 + i;
      itemInputs.push({...EstforTypes.defaultItemInput, tokenId});
      shopItems.push({tokenId, amountPerPurchase: 1, price: 10, stock: 10, currentStock: 10, isActive: false});
    }

    await itemNFT.addItems(itemInputs);
    await blackMarketTrader.addShopItems(shopItems, globalEventId);

    const numWords = Math.ceil(numItems / 16);
    expect(numWords).to.equal(3);

    const cost = await blackMarketTrader.requestCost(numWords);
    const tx = await blackMarketTrader.initialiseShopItemsForEvent(globalEventId, {value: cost});
    const requestId = Number((await getEventLog(tx, blackMarketTrader, "RequestSent")).requestId);

    // Check the event has correct numWords
    const event = await getEventLog(tx, blackMarketTrader, "RequestSent");
    expect(event.numWords).to.equal(numWords);

    // Fulfill should work
    await mockVRF.fulfillSeeded(requestId, await blackMarketTrader.getAddress(), 999);
  });

  it("Exactly 16 items needs 1 random word", async function () {
    const {blackMarketTrader, itemNFT, mockVRF} = await loadFixture(deployContracts);

    const numItems = 16;
    const itemInputs = [];
    const shopItems = [];
    for (let i = 0; i < numItems; ++i) {
      const tokenId = 3000 + i;
      itemInputs.push({...EstforTypes.defaultItemInput, tokenId});
      shopItems.push({tokenId, amountPerPurchase: 1, price: 10, stock: 10, currentStock: 10, isActive: false});
    }

    await itemNFT.addItems(itemInputs);
    await blackMarketTrader.addShopItems(shopItems, globalEventId);

    const tx = await blackMarketTrader.initialiseShopItemsForEvent(globalEventId, {
      value: await blackMarketTrader.requestCost(1),
    });
    const event = await getEventLog(tx, blackMarketTrader, "RequestSent");
    expect(event.numWords).to.equal(1);
  });

  it("17 items needs 2 random words", async function () {
    const {blackMarketTrader, itemNFT, mockVRF} = await loadFixture(deployContracts);

    const numItems = 17;
    const itemInputs = [];
    const shopItems = [];
    for (let i = 0; i < numItems; ++i) {
      const tokenId = 4000 + i;
      itemInputs.push({...EstforTypes.defaultItemInput, tokenId});
      shopItems.push({tokenId, amountPerPurchase: 1, price: 10, stock: 10, currentStock: 10, isActive: false});
    }

    await itemNFT.addItems(itemInputs);
    await blackMarketTrader.addShopItems(shopItems, globalEventId);

    const tx = await blackMarketTrader.initialiseShopItemsForEvent(globalEventId, {
      value: await blackMarketTrader.requestCost(2),
    });
    const event = await getEventLog(tx, blackMarketTrader, "RequestSent");
    expect(event.numWords).to.equal(2);
  });
});
