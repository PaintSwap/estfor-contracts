import {loadFixture} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {ethers, upgrades} from "hardhat";
import {expect} from "chai";
import {IOrderBook, OrderBook} from "../typechain-types";
import {OrderSide} from "@paintswap/estfor-definitions/types";

describe("OrderBook", function () {
  async function deployContractsFixture() {
    const [owner, alice, bob, charlie, dev, erin, frank, royaltyRecipient] = await ethers.getSigners();

    const coins = await ethers.deployContract("MockBrushToken");
    const erc1155 = await ethers.deployContract("TestERC1155", [royaltyRecipient.address]);

    const maxOrdersPerPrice = 100;
    const OrderBook = await ethers.getContractFactory("OrderBook");
    const orderBook = (await upgrades.deployProxy(
      OrderBook,
      [await erc1155.getAddress(), await coins.getAddress(), dev.address, 30, 30, maxOrdersPerPrice],
      {
        kind: "uups"
      }
    )) as unknown as OrderBook;

    const initialCoins = 100000000000;
    await coins.mint(owner, initialCoins);
    await coins.approve(orderBook, initialCoins);

    await coins.connect(alice).mint(alice, initialCoins);
    await coins.connect(alice).approve(orderBook, initialCoins);

    const initialQuantity = 100;
    const tokenId = 11;
    await erc1155.mintSpecificId(owner, tokenId, initialQuantity * 2);
    await erc1155.setApprovalForAll(orderBook, true);

    await erc1155.safeTransferFrom(owner, alice, tokenId, initialQuantity, "0x");
    await erc1155.connect(alice).setApprovalForAll(orderBook, true);

    const tick = 1;
    const minQuantity = 1;
    await orderBook.setTokenIdInfos([tokenId], [{tick, minQuantity}]);

    return {
      orderBook,
      erc1155,
      coins,
      owner,
      alice,
      bob,
      charlie,
      dev,
      erin,
      frank,
      royaltyRecipient,
      initialCoins,
      tokenId,
      initialQuantity,
      maxOrdersPerPrice,
      tick,
      minQuantity
    };
  }

  it("Initialize function constraints", async function () {
    const {dev, coins, erc1155} = await loadFixture(deployContractsFixture);

    const maxOrdersPerPrice = 100;
    const OrderBook = await ethers.getContractFactory("OrderBook");
    let devFee = 0;
    let burntFee = 30;
    await expect(
      upgrades.deployProxy(
        OrderBook,
        [await erc1155.getAddress(), await coins.getAddress(), dev.address, devFee, burntFee, maxOrdersPerPrice],
        {
          kind: "uups"
        }
      )
    ).to.be.revertedWithCustomError(OrderBook, "DevFeeNotSet");

    // Set the dev fee but don't set the dev address
    devFee = 30;
    await expect(
      upgrades.deployProxy(
        OrderBook,
        [await erc1155.getAddress(), await coins.getAddress(), ethers.ZeroAddress, devFee, burntFee, maxOrdersPerPrice],
        {
          kind: "uups"
        }
      )
    ).to.be.revertedWithCustomError(OrderBook, "ZeroAddress");

    devFee = 10000;
    await expect(
      upgrades.deployProxy(
        OrderBook,
        [await erc1155.getAddress(), await coins.getAddress(), dev.address, devFee, burntFee, maxOrdersPerPrice],
        {
          kind: "uups"
        }
      )
    ).to.be.revertedWithCustomError(OrderBook, "DevFeeTooHigh");

    devFee = 30;
    const erc721 = await ethers.deployContract("TestERC721");
    await expect(
      upgrades.deployProxy(
        OrderBook,
        [await erc721.getAddress(), await coins.getAddress(), dev.address, devFee, burntFee, maxOrdersPerPrice],
        {
          kind: "uups"
        }
      )
    ).to.be.revertedWithCustomError(OrderBook, "NotERC1155");

    // No dev fee set
    devFee = 0;
    await upgrades.deployProxy(
      OrderBook,
      [await erc1155.getAddress(), await coins.getAddress(), ethers.ZeroAddress, devFee, burntFee, maxOrdersPerPrice],
      {
        kind: "uups"
      }
    );

    const orderBook = await OrderBook.deploy();
    await expect(
      orderBook.initialize(
        erc1155.getAddress(),
        await coins.getAddress(),
        dev.address,
        devFee,
        burntFee,
        maxOrdersPerPrice
      )
    ).to.be.reverted;
  });

  it("Get token id info", async function () {
    const {orderBook, tokenId} = await loadFixture(deployContractsFixture);

    const info = await orderBook.getTokenIdInfo(tokenId);
    expect(info.tick).to.equal(1);
    expect(info.minQuantity).to.equal(1);
  });

  it("Get order id info", async function () {
    const {orderBook, tokenId, owner} = await loadFixture(deployContractsFixture);

    const price = 100;
    const quantity = 10;
    const limitOrders = [
      {
        side: OrderSide.BUY,
        tokenId,
        price,
        quantity
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price: price + 1,
        quantity
      }
    ];
    let orderId = 1;
    await orderBook.limitOrders(limitOrders);
    let order = await orderBook.getClaimableTokenInfo(orderId);
    expect(order.maker).to.equal(await owner.getAddress());
    expect(order.amount).to.equal(0);
  });

  it("Add to order book", async function () {
    const {orderBook, tokenId, owner} = await loadFixture(deployContractsFixture);

    const price = 100;
    const quantity = 10;

    const limitOrders = [
      {
        side: OrderSide.BUY,
        tokenId,
        price,
        quantity
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price: price + 1,
        quantity
      }
    ];
    let orderId = 1;
    await expect(orderBook.limitOrders(limitOrders))
      .to.emit(orderBook, "AddedToBook")
      .withArgs(
        owner.address,
        limitOrders[0].side,
        orderId,
        limitOrders[0].tokenId,
        limitOrders[0].price,
        limitOrders[0].quantity
      )
      .and.to.emit(orderBook, "AddedToBook")
      .withArgs(
        owner.address,
        limitOrders[1].side,
        orderId + 1,
        limitOrders[1].tokenId,
        limitOrders[1].price,
        limitOrders[1].quantity
      );

    expect(await orderBook.getHighestBid(tokenId)).to.equal(price);
    expect(await orderBook.getLowestAsk(tokenId)).to.equal(price + 1);
  });

  describe("Market orders", function () {
    it("Check total cost, buying", async function () {
      const {orderBook, alice, tokenId} = await loadFixture(deployContractsFixture);

      // Set up order book
      const price = 100;
      const quantity = 100;
      await orderBook.limitOrders([
        {
          side: OrderSide.SELL,
          tokenId,
          price,
          quantity
        }
      ]);
      // Take from it
      await expect(
        orderBook.connect(alice).marketOrder({
          side: OrderSide.BUY,
          tokenId,
          totalCost: price * 10 - 1, // total cost is too low
          quantity: 10
        })
      ).to.be.revertedWithCustomError(orderBook, "TotalCostConditionNotMet");

      await expect(
        orderBook.connect(alice).marketOrder({
          side: OrderSide.BUY,
          tokenId,
          totalCost: price * 10, // total cost is exact
          quantity: 10
        })
      ).to.not.be.reverted;

      await expect(
        orderBook.connect(alice).marketOrder({
          side: OrderSide.BUY,
          tokenId,
          totalCost: price * 11, // total cost is higher
          quantity: 10
        })
      ).to.not.be.reverted;
    });

    it("Check total cost, selling", async function () {
      const {orderBook, alice, tokenId} = await loadFixture(deployContractsFixture);

      // Set up order book
      const price = 100;
      const quantity = 100;
      await orderBook.limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        }
      ]);
      await expect(
        orderBook.connect(alice).marketOrder({
          side: OrderSide.SELL,
          tokenId,
          totalCost: price * 10 + 1, // total cost is too high
          quantity: 10
        })
      ).to.be.revertedWithCustomError(orderBook, "TotalCostConditionNotMet");

      await expect(
        orderBook.connect(alice).marketOrder({
          side: OrderSide.SELL,
          tokenId,
          totalCost: price * 10, // total cost is exact
          quantity: 10
        })
      ).to.not.be.reverted;

      await expect(
        orderBook.connect(alice).marketOrder({
          side: OrderSide.SELL,
          tokenId,
          totalCost: 0, // total cost is too high
          quantity: 10
        })
      ).to.not.be.reverted;
    });

    it("Take from sell order book", async function () {
      const {orderBook, erc1155, initialQuantity, alice, tokenId} = await loadFixture(deployContractsFixture);

      // Set up order books
      const price = 100;
      const quantity = 10;
      await orderBook.limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        },
        {
          side: OrderSide.SELL,
          tokenId,
          price: price + 1,
          quantity
        }
      ]);

      // Buy
      const numToBuy = 3;
      const orderId = 2;
      await expect(
        orderBook.connect(alice).marketOrder({
          side: OrderSide.BUY,
          tokenId,
          totalCost: (price + 1) * numToBuy,
          quantity: numToBuy
        })
      )
        .to.emit(orderBook, "OrdersMatched")
        .withArgs(alice.address, [orderId], [numToBuy]);
      expect(await erc1155.balanceOf(alice, tokenId)).to.equal(initialQuantity + numToBuy);

      await orderBook.connect(alice).marketOrder({
        side: OrderSide.BUY,
        tokenId,
        totalCost: (price + 1) * (quantity - numToBuy),
        quantity: quantity - numToBuy
      }); // Buy the rest
      expect(await erc1155.balanceOf(alice, tokenId)).to.equal(initialQuantity + quantity);

      // There's nothing left on the sell side, this adds to the buy order side
      await expect(
        orderBook.connect(alice).marketOrder({
          side: OrderSide.BUY,
          tokenId,
          totalCost: price + 2,
          quantity: 1
        })
      ).to.be.revertedWithCustomError(orderBook, "FailedToTakeFromBook");
    });

    it("Take from buy order book, 1 exact order among a segment", async function () {
      const {orderBook, alice, tokenId} = await loadFixture(deployContractsFixture);

      // Set up order books
      const price = 100;
      const quantity = 10;
      await orderBook.limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        },
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        },
        {
          side: OrderSide.SELL,
          tokenId,
          price: price + 1,
          quantity
        }
      ]);

      // Sell
      const orderId = 1;
      await expect(
        orderBook.connect(alice).marketOrder({
          side: OrderSide.SELL,
          tokenId,
          totalCost: price * quantity,
          quantity
        })
      )
        .to.emit(orderBook, "OrdersMatched")
        .withArgs(alice.address, [orderId], [quantity]);
    });

    it("Take from buy order book", async function () {
      const {orderBook, erc1155, initialQuantity, alice, tokenId} = await loadFixture(deployContractsFixture);

      // Set up order books
      const price = 100;
      const quantity = 10;
      await orderBook.limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        },
        {
          side: OrderSide.SELL,
          tokenId,
          price: price + 1,
          quantity
        }
      ]);

      // Sell
      const numToSell = 3;
      const orderId = 1;
      await expect(
        orderBook.connect(alice).marketOrder({
          side: OrderSide.SELL,
          tokenId,
          totalCost: price * numToSell,
          quantity: numToSell
        })
      )
        .to.emit(orderBook, "OrdersMatched")
        .withArgs(alice.address, [orderId], [numToSell]);

      expect(await erc1155.balanceOf(alice, tokenId)).to.equal(initialQuantity - numToSell);

      await orderBook.connect(alice).marketOrder({
        side: OrderSide.SELL,
        tokenId,
        totalCost: price * (quantity - numToSell),
        quantity: quantity - numToSell
      }); // Buy the rest
      expect(await erc1155.balanceOf(alice, tokenId)).to.equal(initialQuantity - quantity);

      // There's nothing left on the sell side
      await expect(
        orderBook.connect(alice).marketOrder({
          side: OrderSide.SELL,
          tokenId,
          totalCost: price,
          quantity: 1
        })
      ).to.be.revertedWithCustomError(orderBook, "FailedToTakeFromBook");
    });

    it("Take from buy order book, max orders hit should revert", async function () {
      this.timeout(0);

      const {orderBook, tokenId, maxOrdersPerPrice} = await loadFixture(deployContractsFixture);

      // Set up order books
      const price = 100;
      const quantity = 1;
      let limitOrder = {
        side: OrderSide.BUY,
        tokenId,
        price,
        quantity
      };

      let limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill(limitOrder);
      await orderBook.limitOrders(limitOrders);
      limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill({
        ...limitOrder,
        price: limitOrder.price + 1
      });
      await orderBook.limitOrders(limitOrders);
      limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill({
        ...limitOrder,
        price: limitOrder.price + 2
      });
      await orderBook.limitOrders(limitOrders);
      limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill({
        ...limitOrder,
        price: limitOrder.price + 3
      });
      await orderBook.limitOrders(limitOrders);
      limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill({
        ...limitOrder,
        price: limitOrder.price + 4
      });
      await orderBook.limitOrders(limitOrders);
      limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill({
        ...limitOrder,
        price: limitOrder.price + 5
      });
      await orderBook.limitOrders(limitOrders);

      const marketOrder = {
        side: OrderSide.SELL,
        tokenId,
        totalCost: price * maxOrdersPerPrice * 5,
        quantity: maxOrdersPerPrice * 5
      };
      await expect(orderBook.marketOrder(marketOrder)).to.be.revertedWithCustomError(orderBook, "TooManyOrdersHit");
    });
  });

  describe("Limit orders", function () {
    it("Take from sell order book", async function () {
      const {orderBook, erc1155, initialQuantity, alice, tokenId} = await loadFixture(deployContractsFixture);

      // Set up order books
      const price = 100;
      const quantity = 10;
      await orderBook.limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        },
        {
          side: OrderSide.SELL,
          tokenId,
          price: price + 1,
          quantity
        }
      ]);

      // Buy
      const numToBuy = 3;
      const orderId = 2;
      await expect(
        orderBook.connect(alice).limitOrders([
          {
            side: OrderSide.BUY,
            tokenId,
            price: price + 1,
            quantity: numToBuy
          }
        ])
      )
        .to.emit(orderBook, "OrdersMatched")
        .withArgs(alice.address, [orderId], [numToBuy]);
      expect(await erc1155.balanceOf(alice, tokenId)).to.equal(initialQuantity + numToBuy);

      await orderBook.connect(alice).limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price: price + 2,
          quantity: quantity - numToBuy
        }
      ]); // Buy the rest
      expect(await erc1155.balanceOf(alice, tokenId)).to.equal(initialQuantity + quantity);

      // There's nothing left on the sell side, this adds to the buy order side
      await orderBook.connect(alice).limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price: price + 2,
          quantity: 1
        }
      ]);
      expect(await orderBook.getHighestBid(tokenId)).to.equal(price + 2);
    });

    it("Take from buy order book, 1 exact order among a segment", async function () {
      const {orderBook, alice, tokenId} = await loadFixture(deployContractsFixture);

      // Set up order books
      const price = 100;
      const quantity = 10;
      await orderBook.limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        },
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        },
        {
          side: OrderSide.SELL,
          tokenId,
          price: price + 1,
          quantity
        }
      ]);

      // Sell
      const orderId = 1;
      await expect(
        orderBook.connect(alice).limitOrders([
          {
            side: OrderSide.SELL,
            tokenId,
            price: price,
            quantity
          }
        ])
      )
        .to.emit(orderBook, "OrdersMatched")
        .withArgs(alice.address, [orderId], [quantity]);
    });

    it("Take from buy order book", async function () {
      const {orderBook, erc1155, initialQuantity, alice, tokenId} = await loadFixture(deployContractsFixture);

      // Set up order books
      const price = 100;
      const quantity = 10;
      await orderBook.limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        },
        {
          side: OrderSide.SELL,
          tokenId,
          price: price + 1,
          quantity
        }
      ]);

      // Sell
      const numToSell = 3;
      const orderId = 1;
      await expect(
        orderBook.connect(alice).limitOrders([
          {
            side: OrderSide.SELL,
            tokenId,
            price: price,
            quantity: numToSell
          }
        ])
      )
        .to.emit(orderBook, "OrdersMatched")
        .withArgs(alice.address, [orderId], [numToSell]);

      expect(await erc1155.balanceOf(alice, tokenId)).to.equal(initialQuantity - numToSell);

      await orderBook.connect(alice).limitOrders([
        {
          side: OrderSide.SELL,
          tokenId,
          price: price - 1,
          quantity: quantity - numToSell
        }
      ]); // Buy the rest
      expect(await erc1155.balanceOf(alice, tokenId)).to.equal(initialQuantity - quantity);

      // There's nothing left on the sell side, this adds to the buy order side
      await orderBook.connect(alice).limitOrders([
        {
          side: OrderSide.SELL,
          tokenId,
          price: price - 1,
          quantity: 1
        }
      ]);
      expect(await orderBook.getLowestAsk(tokenId)).to.equal(price - 1);
    });

    it("Take from buy order book, max orders hit should revert", async function () {
      this.timeout(0);

      const {orderBook, tokenId, maxOrdersPerPrice} = await loadFixture(deployContractsFixture);

      // Set up order books
      const price = 100;
      const quantity = 1;
      let limitOrder = {
        side: OrderSide.BUY,
        tokenId,
        price,
        quantity
      };

      let limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill(limitOrder);
      await orderBook.limitOrders(limitOrders);
      limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill({
        ...limitOrder,
        price: limitOrder.price + 1
      });
      await orderBook.limitOrders(limitOrders);
      limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill({
        ...limitOrder,
        price: limitOrder.price + 2
      });
      await orderBook.limitOrders(limitOrders);
      limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill({
        ...limitOrder,
        price: limitOrder.price + 3
      });
      await orderBook.limitOrders(limitOrders);
      limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill({
        ...limitOrder,
        price: limitOrder.price + 4
      });
      await orderBook.limitOrders(limitOrders);
      limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill({
        ...limitOrder,
        price: limitOrder.price + 5
      });
      await orderBook.limitOrders(limitOrders);

      limitOrder = {
        side: OrderSide.SELL,
        tokenId,
        price,
        quantity: maxOrdersPerPrice * 5
      };
      await expect(orderBook.limitOrders([limitOrder])).to.be.revertedWithCustomError(orderBook, "TooManyOrdersHit");
    });
  });

  it("Failed orders", async function () {
    const {orderBook, tokenId, tick, owner} = await loadFixture(deployContractsFixture);

    // Set up order books
    const price = 100;
    const quantity = 10;

    await orderBook.limitOrders([
      {
        side: OrderSide.BUY,
        tokenId,
        price,
        quantity
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price: price + tick,
        quantity
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price: price + 2 * tick,
        quantity
      }
    ]);

    // Cancel buy
    const orderId = 1;
    await orderBook.cancelOrders([orderId], [{side: OrderSide.BUY, tokenId, price}]);

    // Add a couple buy orders
    await orderBook.limitOrders([
      {
        side: OrderSide.BUY,
        tokenId,
        price: price - tick,
        quantity
      },
      {
        side: OrderSide.BUY,
        tokenId,
        price: price - 3 * tick,
        quantity
      }
    ]);

    // Remove a whole sell order and eat into the next
    await expect(
      orderBook.limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price: price + 2 * tick,
          quantity: quantity + quantity / 2
        }
      ])
    ).to.not.emit(orderBook, "FailedToAddToBook");

    const orders = await orderBook.allOrdersAtPrice(OrderSide.SELL, tokenId, price + 2 * tick);
    expect(orders.length).to.eq(1);
    expect(orders[0].quantity).eq(quantity / 2);

    await orderBook.limitOrders([
      {
        side: OrderSide.SELL,
        tokenId,
        price: price - tick,
        quantity: quantity - 3
      }
    ]);
    await orderBook.setTokenIdInfos([tokenId], [{tick: 1, minQuantity: 20}]);
    await expect(
      orderBook.limitOrders([
        {
          side: OrderSide.SELL,
          tokenId,
          price: price - tick,
          quantity: quantity
        }
      ])
    )
      .to.emit(orderBook, "FailedToAddToBook")
      .withArgs(owner.address, OrderSide.SELL, tokenId, price - tick, 7);
  });

  describe("Make market orders", function () {
    it("Invalid market orders", async function () {
      const {orderBook, tokenId} = await loadFixture(deployContractsFixture);

      // Set up order books
      const totalCost = 0;
      const quantity = 10;
      await expect(
        orderBook.marketOrder({
          side: OrderSide.BUY,
          tokenId,
          totalCost,
          quantity: 0
        })
      ).to.be.revertedWithCustomError(orderBook, "NoQuantity");

      await expect(
        orderBook.marketOrder({
          side: OrderSide.BUY,
          tokenId: tokenId + 1,
          totalCost,
          quantity
        })
      )
        .to.be.revertedWithCustomError(orderBook, "TokenDoesntExist")
        .withArgs(tokenId + 1);
    });
  });

  describe("Make limit order", function () {
    it("Invalid limit orders", async function () {
      const {orderBook, tokenId} = await loadFixture(deployContractsFixture);

      // Set up order books
      const price = 100;
      const quantity = 10;
      await expect(
        orderBook.limitOrders([
          {
            side: OrderSide.BUY,
            tokenId,
            price,
            quantity: 0
          }
        ])
      ).to.be.revertedWithCustomError(orderBook, "NoQuantity");

      await expect(
        orderBook.limitOrders([
          {
            side: OrderSide.BUY,
            tokenId,
            price: 0,
            quantity
          }
        ])
      ).to.be.revertedWithCustomError(orderBook, "PriceZero");

      await expect(
        orderBook.limitOrders([
          {
            side: OrderSide.BUY,
            tokenId: tokenId + 1,
            price,
            quantity
          }
        ])
      )
        .to.be.revertedWithCustomError(orderBook, "TokenDoesntExist")
        .withArgs(tokenId + 1);
    });
  });

  describe("Cancelling orders", function () {
    it("Cancel a single order", async function () {
      const {orderBook, owner, tokenId, erc1155, coins, initialCoins, initialQuantity} = await loadFixture(
        deployContractsFixture
      );

      // Set up order books
      const price = 100;
      const quantity = 10;
      await orderBook.limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        },
        {
          side: OrderSide.SELL,
          tokenId,
          price: price + 1,
          quantity
        }
      ]);

      // Try cancel non-existent order
      await expect(orderBook.cancelOrders([3], [{side: OrderSide.BUY, tokenId, price}])).to.be.revertedWithCustomError(
        orderBook,
        "OrderNotFound"
      );

      // Cancel buy
      const orderId = 1;
      await orderBook.cancelOrders([orderId], [{side: OrderSide.BUY, tokenId, price}]);

      // No longer exists
      await expect(
        orderBook.cancelOrders([orderId], [{side: OrderSide.BUY, tokenId, price}])
      ).to.be.revertedWithCustomError(orderBook, "OrderNotFoundInTree");

      // Cancel the sell
      await expect(orderBook.cancelOrders([orderId + 1], [{side: OrderSide.SELL, tokenId, price: price + 1}]))
        .to.emit(orderBook, "OrdersCancelled")
        .withArgs(owner.address, [orderId + 1]);

      // No longer exists
      await expect(
        orderBook.cancelOrders([orderId + 1], [{side: OrderSide.SELL, tokenId, price: price + 1}])
      ).to.be.revertedWithCustomError(orderBook, "OrderNotFoundInTree");

      expect(await orderBook.nodeExists(OrderSide.BUY, tokenId, price)).to.be.false;

      // Check you get the coins back
      expect(await coins.balanceOf(owner)).to.eq(initialCoins);
      expect(await coins.balanceOf(orderBook)).to.eq(0);
      expect(await erc1155.balanceOf(owner, tokenId)).to.eq(initialQuantity);

      expect(await orderBook.getHighestBid(tokenId)).to.equal(0);
      expect(await orderBook.getLowestAsk(tokenId)).to.equal(0);
    });

    it("Cancel an order at the beginning, middle and end of the same segment", async function () {
      const {orderBook, owner, tokenId, coins, initialCoins} = await loadFixture(deployContractsFixture);

      // Set up order books
      const price = 100;
      const quantity = 10;

      const limitOrder = {
        side: OrderSide.BUY,
        tokenId,
        price,
        quantity
      };

      const limitOrders = new Array<IOrderBook.LimitOrderStruct>(4).fill(limitOrder);
      await orderBook.limitOrders(limitOrders);

      // Cancel a buy in the middle
      const orderId = 2;
      await orderBook.cancelOrders([orderId], [{side: OrderSide.BUY, tokenId, price}]);
      // Cancel a buy at the start
      await orderBook.cancelOrders([orderId - 1], [{side: OrderSide.BUY, tokenId, price}]);

      // Cancel a buy at the end
      await orderBook.cancelOrders([orderId + 2], [{side: OrderSide.BUY, tokenId, price}]);

      // The only one left should be orderId 3
      const orders = await orderBook.allOrdersAtPrice(OrderSide.BUY, tokenId, price);
      expect(orders.length).to.eq(1);
      expect(orders[0].id).to.eq(orderId + 1);
      // Check you get the coins back
      expect(await coins.balanceOf(owner)).to.eq(initialCoins - price * quantity);
      expect(await coins.balanceOf(orderBook)).to.eq(price * quantity);

      expect(await orderBook.getHighestBid(tokenId)).to.equal(price);
      expect(await orderBook.getLowestAsk(tokenId)).to.equal(0);
    });

    it("Inner segment offsets completing orders", async function () {
      const {orderBook, tokenId} = await loadFixture(deployContractsFixture);

      // Set up order books
      const price = 100;
      const quantity = 10;

      const limitOrders = new Array<IOrderBook.LimitOrderStruct>(2).fill({
        side: OrderSide.BUY,
        tokenId,
        price,
        quantity
      });
      await orderBook.limitOrders(limitOrders);

      // Consume 1 order, check there is only 1 remaining
      await orderBook.limitOrders([{side: OrderSide.SELL, tokenId, price, quantity}]);

      const orderId = 1;
      let orders = await orderBook.allOrdersAtPrice(OrderSide.BUY, tokenId, price);
      expect(orders.length).to.eq(1);
      expect(orders[0].id).to.eq(orderId + 1);
    });

    it("Cancel an order at the beginning, middle and end of the same segment which has a tombstoneOffset", async function () {
      const {orderBook, owner, tokenId, coins, initialCoins} = await loadFixture(deployContractsFixture);

      // Set up order books
      const price = 100;
      const quantity = 10;

      const limitOrders = new Array<IOrderBook.LimitOrderStruct>(8).fill({
        side: OrderSide.BUY,
        tokenId,
        price,
        quantity
      });
      await orderBook.limitOrders(limitOrders);

      // Consume whole order to add a tombstone offset
      const sellLimitOrders = new Array<IOrderBook.LimitOrderStruct>(4).fill({
        side: OrderSide.SELL,
        tokenId,
        price,
        quantity
      });
      await orderBook.limitOrders(sellLimitOrders);

      expect((await orderBook.allOrdersAtPrice(OrderSide.BUY, tokenId, price)).length).to.eq(4);

      // Cancel a buy in the middle
      const orderId = 6;
      await orderBook.cancelOrders([orderId], [{side: OrderSide.BUY, tokenId, price}]);

      // Cancel a buy at the start
      await orderBook.cancelOrders([orderId - 1], [{side: OrderSide.BUY, tokenId, price}]);

      // Cancel a buy at the end
      await orderBook.cancelOrders([orderId + 2], [{side: OrderSide.BUY, tokenId, price}]);

      const node = await orderBook.getNode(OrderSide.BUY, tokenId, price);
      expect(node.tombstoneOffset).to.eq(1);

      // The only one left should be orderId 3
      let orders = await orderBook.allOrdersAtPrice(OrderSide.BUY, tokenId, price);
      expect(orders.length).to.eq(1);
      expect(orders[0].id).to.eq(orderId + 1);

      // Check you get the coins back
      expect(await coins.balanceOf(owner)).to.eq(
        initialCoins - price * quantity - calcFees(price * quantity * 4, true)
      );
      expect(await coins.balanceOf(orderBook)).to.eq(price * quantity);

      expect(await orderBook.getHighestBid(tokenId)).to.equal(price);
      expect(await orderBook.getLowestAsk(tokenId)).to.equal(0);

      // Now kill this one
      await orderBook.cancelOrders([orderId + 1], [{side: OrderSide.BUY, tokenId, price}]);
      orders = await orderBook.allOrdersAtPrice(OrderSide.BUY, tokenId, price);
      expect(orders.length).to.eq(0);
    });

    it("Cancel an order at the very end of the same segment which has a tombstoneOffset", async function () {
      const {orderBook, tokenId} = await loadFixture(deployContractsFixture);

      // Set up order books
      const price = 100;
      const quantity = 10;

      const limitOrders = new Array<IOrderBook.LimitOrderStruct>(8).fill({
        side: OrderSide.BUY,
        tokenId,
        price,
        quantity
      });
      await orderBook.limitOrders(limitOrders);

      // Consume whole order to add a tombstone offset
      const sellLimitOrders = new Array<IOrderBook.LimitOrderStruct>(4).fill({
        side: OrderSide.SELL,
        tokenId,
        price,
        quantity
      });
      await orderBook.limitOrders(sellLimitOrders);

      expect((await orderBook.allOrdersAtPrice(OrderSide.BUY, tokenId, price)).length).to.eq(4);

      // Cancel a buy at the end of the segment
      const orderId = 8;
      await orderBook.cancelOrders([orderId], [{side: OrderSide.BUY, tokenId, price}]);

      const node = await orderBook.getNode(OrderSide.BUY, tokenId, price);
      expect(node.tombstoneOffset).to.eq(1);

      // Should be 3 orders remaining
      let orders = await orderBook.allOrdersAtPrice(OrderSide.BUY, tokenId, price);
      expect(orders.length).to.eq(3);
      expect(orders[0].id).to.eq(orderId - 3);
      expect(orders[1].id).to.eq(orderId - 2);
      expect(orders[2].id).to.eq(orderId - 1);

      expect(await orderBook.getHighestBid(tokenId)).to.equal(price);
      expect(await orderBook.getLowestAsk(tokenId)).to.equal(0);
    });

    it("Cancel an order which deletes a segment at the beginning, middle and end", async function () {
      const {orderBook, owner, tokenId, coins, initialCoins} = await loadFixture(deployContractsFixture);

      // Set up order books
      const price = 100;
      const quantity = 10;

      const limitOrder = {
        side: OrderSide.BUY,
        tokenId,
        price,
        quantity
      };

      // 4 segments
      const limitOrders = new Array<IOrderBook.LimitOrderStruct>(16).fill(limitOrder);
      await orderBook.limitOrders(limitOrders);

      // order ids for the limit orders: [1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]

      // Cancel a buy in the middle
      let orderIds = [9, 10, 11, 12];
      let orderInfos = orderIds.map(() => ({side: OrderSide.BUY, tokenId, price}));
      await orderBook.cancelOrders(orderIds, orderInfos);
      // Cancel a buy at the start
      orderIds = [1, 2, 3, 4];
      orderInfos = orderIds.map(() => ({side: OrderSide.BUY, tokenId, price}));
      await orderBook.cancelOrders(orderIds, orderInfos);

      // Cancel a buy at the end
      orderIds = [13, 14, 15, 16];
      orderInfos = orderIds.map(() => ({side: OrderSide.BUY, tokenId, price}));
      await orderBook.cancelOrders(orderIds, orderInfos);

      // The only one left should be orderIds
      orderIds = [5, 6, 7, 8];
      const orders = await orderBook.allOrdersAtPrice(OrderSide.BUY, tokenId, price);
      expect(orders.length).to.eq(4);
      expect(orders.map((order) => order.id)).to.deep.eq(orderIds);
      expect(orders[0].id).to.eq(orderIds[0]);

      // Check you get the coins back
      expect(await coins.balanceOf(owner)).to.eq(initialCoins - price * quantity * 4);
      expect(await coins.balanceOf(orderBook)).to.eq(price * quantity * 4);

      expect(await orderBook.getHighestBid(tokenId)).to.equal(price);
      expect(await orderBook.getLowestAsk(tokenId)).to.equal(0);
    });

    it("Bulk cancel orders", async function () {
      const {orderBook, owner, tokenId, erc1155, coins, initialCoins, initialQuantity} = await loadFixture(
        deployContractsFixture
      );

      // Set up order books
      const price = 100;
      const quantity = 10;
      await orderBook.limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        },
        {
          side: OrderSide.SELL,
          tokenId,
          price: price + 1,
          quantity
        }
      ]);

      // Cancel buy
      const orderId = 1;
      await orderBook.cancelOrders(
        [orderId, orderId + 1],
        [
          {side: OrderSide.BUY, tokenId, price},
          {side: OrderSide.SELL, tokenId, price: price + 1}
        ]
      );

      // Check both no longer exist
      await expect(
        orderBook.cancelOrders([orderId], [{side: OrderSide.BUY, tokenId, price}])
      ).to.be.revertedWithCustomError(orderBook, "OrderNotFoundInTree");
      await expect(
        orderBook.cancelOrders([orderId + 1], [{side: OrderSide.SELL, tokenId, price: price + 1}])
      ).to.be.revertedWithCustomError(orderBook, "OrderNotFoundInTree");

      expect(await coins.balanceOf(owner)).to.eq(initialCoins);
      expect(await erc1155.balanceOf(owner, tokenId)).to.eq(initialQuantity);

      expect(await orderBook.getHighestBid(tokenId)).to.equal(0);
      expect(await orderBook.getLowestAsk(tokenId)).to.equal(0);
    });

    it("Cancelling a non-existent order should revert", async function () {
      const {orderBook, tokenId} = await loadFixture(deployContractsFixture);

      const price = 100;
      const quantity = 10;
      await orderBook.limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        }
      ]);

      const orderId = 2;
      await expect(orderBook.cancelOrders([orderId], [{side: OrderSide.BUY, tokenId, price}]))
        .to.be.revertedWithCustomError(orderBook, "OrderNotFound")
        .withArgs(orderId, price);
    });

    it("Cancelling an order with the wrong maker should revert", async function () {
      const {orderBook, tokenId, alice} = await loadFixture(deployContractsFixture);

      const price = 100;
      const quantity = 10;
      await orderBook.limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        }
      ]);

      const orderId = 1;
      await expect(
        orderBook.connect(alice).cancelOrders([orderId], [{side: OrderSide.BUY, tokenId, price}])
      ).to.be.revertedWithCustomError(orderBook, "NotMaker");
    });

    it("Cancelling an order twice should revert", async function () {
      const {orderBook, tokenId} = await loadFixture(deployContractsFixture);

      const price = 100;
      const quantity = 10;
      await orderBook.limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        },
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        }
      ]);

      const orderId = 2;
      await orderBook.cancelOrders([orderId], [{side: OrderSide.BUY, tokenId, price}]);
      await expect(
        orderBook.cancelOrders([orderId], [{side: OrderSide.BUY, tokenId, price}])
      ).to.be.revertedWithCustomError(orderBook, "OrderNotFound");
    });

    it("Cancelling an order that has been consumed should revert", async function () {
      const {orderBook, tokenId} = await loadFixture(deployContractsFixture);

      const price = 100;
      const quantity = 10;
      await orderBook.limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        },
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        }
      ]);

      await orderBook.limitOrders([
        {
          side: OrderSide.SELL,
          tokenId,
          price,
          quantity
        }
      ]);

      const orderId = 1;
      await expect(
        orderBook.cancelOrders([orderId], [{side: OrderSide.BUY, tokenId, price}])
      ).to.be.revertedWithCustomError(orderBook, "OrderNotFound");
    });

    it("Cancelling an order after some orders at the start of the segment are consumed should remove price level", async function () {
      const {orderBook, tokenId} = await loadFixture(deployContractsFixture);

      // Set up order books
      const price = 100;
      const quantity = 10;
      await orderBook.limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        },
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        }
      ]);

      await orderBook.limitOrders([
        {
          side: OrderSide.SELL,
          tokenId,
          price,
          quantity
        }
      ]);

      const orderId = 2;
      await orderBook.cancelOrders([orderId], [{side: OrderSide.BUY, tokenId, price}]);

      expect(await orderBook.nodeExists(OrderSide.BUY, tokenId, price)).to.eq(false);
    });

    it("Cancelling an order after some orders at the start of the segment, where it's the final one should remove price level", async function () {
      const {orderBook, tokenId} = await loadFixture(deployContractsFixture);

      // Set up order books
      const price = 100;
      const quantity = 10;
      await orderBook.limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        },
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        },
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        },
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        }
      ]);

      await orderBook.limitOrders([
        {
          side: OrderSide.SELL,
          tokenId,
          price,
          quantity: quantity * 3
        }
      ]);

      const orderId = 4;
      await orderBook.cancelOrders([orderId], [{side: OrderSide.BUY, tokenId, price}]);

      expect(await orderBook.nodeExists(OrderSide.BUY, tokenId, price)).to.eq(false);
    });

    it("Cancelling an order after some orders at the start of the segment, where it's the final one but there are other segments after it should not remove price level", async function () {
      const {orderBook, tokenId} = await loadFixture(deployContractsFixture);

      // Set up order books
      const price = 100;
      const quantity = 10;
      await orderBook.limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        },
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        },
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        },
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        },
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        }
      ]);

      await orderBook.limitOrders([
        {
          side: OrderSide.SELL,
          tokenId,
          price,
          quantity: quantity * 3
        }
      ]);

      const orderId = 4;
      await orderBook.cancelOrders([orderId], [{side: OrderSide.BUY, tokenId, price}]);
      expect(await orderBook.nodeExists(OrderSide.BUY, tokenId, price)).to.eq(true);

      await orderBook.cancelOrders([orderId + 1], [{side: OrderSide.BUY, tokenId, price}]);
      expect(await orderBook.nodeExists(OrderSide.BUY, tokenId, price)).to.eq(false);
    });

    it("Trying to cancel an order which has been removed inside of the last segment should revert", async function () {
      const {orderBook, tokenId} = await loadFixture(deployContractsFixture);

      // Set up order books
      const price = 100;
      const quantity = 10;
      await orderBook.limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        },
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        }
      ]);

      await orderBook.limitOrders([
        {
          side: OrderSide.SELL,
          tokenId,
          price,
          quantity
        }
      ]);

      const orderId = 1;
      await expect(
        orderBook.cancelOrders([orderId], [{side: OrderSide.BUY, tokenId, price}])
      ).to.be.revertedWithCustomError(orderBook, "OrderNotFound");
    });

    it("Cancelling an order, argument length should not mismatch", async function () {
      const {orderBook} = await loadFixture(deployContractsFixture);
      const orderId = 1;
      await expect(orderBook.cancelOrders([orderId], [])).to.be.revertedWithCustomError(orderBook, "LengthMismatch");
    });

    it("Remove an item, check the order can still be cancelled just not fulfilled", async function () {
      const {orderBook, tokenId, coins, owner} = await loadFixture(deployContractsFixture);

      const price = 100;
      const quantity = 10;
      await orderBook.limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        },
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        }
      ]);
      // Selling should work
      await orderBook.limitOrders([
        {
          side: OrderSide.SELL,
          tokenId,
          price,
          quantity: 1
        }
      ]);

      // Remove the tokenId
      await orderBook.setTokenIdInfos([tokenId], [{tick: 0, minQuantity: 20}]);
      // Cancel should work
      const orderId = 1;
      const preBalance = await coins.balanceOf(owner);
      await orderBook.cancelOrders([orderId], [{side: OrderSide.BUY, tokenId, price}]);

      // Selling should no longer work
      await expect(
        orderBook.limitOrders([
          {
            side: OrderSide.SELL,
            tokenId,
            price,
            quantity: 1
          }
        ])
      )
        .to.be.revertedWithCustomError(orderBook, "TokenDoesntExist")
        .withArgs(tokenId);
      expect(await coins.balanceOf(owner)).to.eq(preBalance + BigInt(price * (quantity - 1)));
    });

    // Fixes: https://ftmscan.com/tx/0x69dd308e7a096ebd035bd3a3f18c2a9b116faee78ea4e0ccda06c3cfede0950b
    it("Check cancelling when the overall order amount exceed a uint72 (checks for overflow)", async function () {
      const {orderBook, owner, tokenId, erc1155, coins, initialCoins, initialQuantity} = await loadFixture(
        deployContractsFixture
      );

      const quantity = 10n;
      const extraCoin = ethers.parseEther("1700") * quantity;
      await coins.mint(owner.address, extraCoin);
      await coins.approve(orderBook, extraCoin);

      // Set up order books
      const price = ethers.parseEther("1700");
      await orderBook.limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        }
      ]);

      // Cancel buy, should not revert and return the coins
      const orderId = 1;
      await orderBook.cancelOrders([orderId], [{side: OrderSide.BUY, tokenId, price}]);

      expect(await coins.balanceOf(owner)).to.eq(BigInt(initialCoins) + extraCoin);
      expect(await coins.balanceOf(orderBook)).to.eq(0);
      expect(await erc1155.balanceOf(owner, tokenId)).to.eq(initialQuantity);
    });

    it("Cancelling when the overall (price * quantity) order amount exceeds a uint72 (checks for overflow)", async function () {
      const {orderBook, owner, tokenId, erc1155, coins, initialCoins, initialQuantity} = await loadFixture(
        deployContractsFixture
      );
      const quantity = 10n;
      const extraBrush = ethers.parseEther("1700") * quantity;
      await coins.mint(owner.address, extraBrush);
      await coins.approve(orderBook, extraBrush);
      // Set up order books
      const price = ethers.parseEther("1700");
      await orderBook.limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        }
      ]);
      // Cancel buy, should not revert and return the brush
      const orderId = 1;
      await orderBook.cancelOrders([orderId], [{side: OrderSide.BUY, tokenId, price}]);
      expect(await coins.balanceOf(owner)).to.eq(BigInt(initialCoins) + extraBrush);
      expect(await coins.balanceOf(orderBook)).to.eq(0);
      expect(await erc1155.balanceOf(owner, tokenId)).to.eq(initialQuantity);
    });
  });

  it("Consume a segment and whole price level with a tombstone offset, and check it works as expected when re-added to the tree", async function () {
    const {orderBook, tokenId} = await loadFixture(deployContractsFixture);

    // Set up order books
    const price = 100;
    const quantity = 10;

    const limitOrder = {
      side: OrderSide.BUY,
      tokenId,
      price,
      quantity
    };

    // 2 segment
    const limitOrders = new Array<IOrderBook.LimitOrderStruct>(4).fill(limitOrder);
    await orderBook.limitOrders(limitOrders);
    const nextOrderIdSlot = 2;
    let packedSlot = await ethers.provider.getStorage(orderBook, nextOrderIdSlot);
    let nextOrderId = parseInt(packedSlot.slice(2, 12), 16);
    expect(nextOrderId).to.eq(5);

    // Consume 1 segment
    await orderBook.limitOrders([
      {
        side: OrderSide.SELL,
        tokenId,
        price: price,
        quantity: quantity * 4
      }
    ]);
    packedSlot = await ethers.provider.getStorage(orderBook, nextOrderIdSlot);
    nextOrderId = parseInt(packedSlot.slice(2, 12), 16);
    expect(nextOrderId).to.eq(5);
    expect(await orderBook.nodeExists(OrderSide.BUY, tokenId, price)).to.be.false;

    // Re-add it, should start in the next segment
    await orderBook.limitOrders([limitOrder]);
    const node = await orderBook.getNode(OrderSide.BUY, tokenId, price);
    expect(node.tombstoneOffset).to.eq(1);

    let orders = await orderBook.allOrdersAtPrice(OrderSide.BUY, tokenId, price);
    const orderId = 5;
    expect(orders.length).to.eq(1);
    expect(orders[0].id).to.eq(orderId);

    // Consume it

    // order ids for the limit orders: [1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]
  });

  it("Partial segment consumption, sell side", async function () {
    const {orderBook, alice, tokenId} = await loadFixture(deployContractsFixture);

    // Set up order book
    const price = 100;
    const quantity = 10;
    await orderBook.limitOrders([
      {
        side: OrderSide.SELL,
        tokenId,
        price,
        quantity
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price,
        quantity
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price,
        quantity
      }
    ]);

    // Buy
    const numToBuy = 14; // Finish one and eat into the next
    await orderBook.connect(alice).limitOrders([
      {
        side: OrderSide.BUY,
        tokenId,
        price,
        quantity: numToBuy
      }
    ]);

    let orders = await orderBook.allOrdersAtPrice(OrderSide.SELL, tokenId, price);
    const orderId = 1;
    expect(orders.length).to.eq(2);
    expect(orders[0].id).to.eq(orderId + 1);
    expect(orders[1].id).to.eq(orderId + 2);

    const node = await orderBook.getNode(OrderSide.SELL, tokenId, price);
    expect(node.tombstoneOffset).to.eq(0);

    const remainderQuantity = quantity * 3 - numToBuy;
    // Try to buy too many
    await orderBook.connect(alice).limitOrders([
      {
        side: OrderSide.BUY,
        tokenId,
        price,
        quantity: remainderQuantity + 1
      }
    ]);

    orders = await orderBook.allOrdersAtPrice(OrderSide.SELL, tokenId, price);
    expect(orders.length).to.eq(0);
  });

  it("Full segment consumption, sell side", async function () {
    const {orderBook, owner, alice, erc1155, coins, tokenId, initialQuantity, initialCoins} = await loadFixture(
      deployContractsFixture
    );

    // Set up order book
    const price = 100;
    const quantity = 10;
    await orderBook.limitOrders([
      {
        side: OrderSide.SELL,
        tokenId,
        price,
        quantity
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price,
        quantity
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price,
        quantity
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price,
        quantity
      }
    ]);

    // Buy
    const numToBuy = 40; // Finish one and eat into the next
    await orderBook.connect(alice).limitOrders([
      {
        side: OrderSide.BUY,
        tokenId,
        price,
        quantity: numToBuy
      }
    ]);

    let orders = await orderBook.allOrdersAtPrice(OrderSide.SELL, tokenId, price);
    expect(orders.length).to.eq(0);
    expect(await orderBook.nodeExists(OrderSide.SELL, tokenId, price)).to.be.false;

    // Check erc1155/coins balances
    expect(await erc1155.balanceOf(orderBook, tokenId)).to.eq(0);
    expect(await erc1155.balanceOf(owner, tokenId)).to.eq(initialQuantity - quantity * 4);
    expect(await erc1155.balanceOf(alice, tokenId)).to.eq(initialQuantity + quantity * 4);

    const orderId = 1;
    await orderBook.claimTokens([orderId, orderId + 1, orderId + 2, orderId + 3]);
    expect(await coins.balanceOf(owner)).to.eq(
      initialCoins + price * quantity * 4 - calcFees(price * quantity * 4, true)
    );
    expect(await coins.balanceOf(alice)).to.eq(initialCoins - price * quantity * 4);
  });

  it("Full segment & partial segment consumption, sell side", async function () {
    const {orderBook, owner, alice, erc1155, coins, tokenId, initialQuantity, initialCoins} = await loadFixture(
      deployContractsFixture
    );

    // Set up order book
    const price = 100;
    const quantity = 10;
    await orderBook.limitOrders([
      {
        side: OrderSide.SELL,
        tokenId,
        price,
        quantity
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price,
        quantity
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price,
        quantity
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price,
        quantity
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price,
        quantity
      }
    ]);

    // Buy
    const numToBuy = 44; // Finish one and eat into the next
    await orderBook.connect(alice).limitOrders([
      {
        side: OrderSide.BUY,
        tokenId,
        price,
        quantity: numToBuy
      }
    ]);

    let orders = await orderBook.allOrdersAtPrice(OrderSide.SELL, tokenId, price);
    expect(orders.length).to.eq(1);

    const node = await orderBook.getNode(OrderSide.SELL, tokenId, price);
    expect(node.tombstoneOffset).to.eq(1);

    // Check erc1155/coins balances
    expect(await erc1155.balanceOf(orderBook, tokenId)).to.eq(quantity * 5 - numToBuy);
    expect(await erc1155.balanceOf(owner, tokenId)).to.eq(initialQuantity - quantity * 5);
    expect(await erc1155.balanceOf(alice, tokenId)).to.eq(initialQuantity + numToBuy);

    const orderId = 1;
    await orderBook.claimTokens([orderId, orderId + 1, orderId + 2, orderId + 3, orderId + 4]);
    expect(await coins.balanceOf(owner)).to.eq(initialCoins + price * numToBuy - calcFees(price * numToBuy, true));
    expect(await coins.balanceOf(alice)).to.eq(initialCoins - price * numToBuy);
  });

  it("Partial segment consumption, buy side", async function () {
    const {orderBook, alice, tokenId} = await loadFixture(deployContractsFixture);

    // Set up order book
    const price = 100;
    const quantity = 10;
    await orderBook.limitOrders([
      {
        side: OrderSide.BUY,
        tokenId,
        price,
        quantity
      },
      {
        side: OrderSide.BUY,
        tokenId,
        price,
        quantity
      },
      {
        side: OrderSide.BUY,
        tokenId,
        price,
        quantity
      }
    ]);

    // Sell
    const numToSell = 14; // Finish one and eat into the next
    await orderBook.connect(alice).limitOrders([
      {
        side: OrderSide.SELL,
        tokenId,
        price,
        quantity: numToSell
      }
    ]);

    let orders = await orderBook.allOrdersAtPrice(OrderSide.BUY, tokenId, price);
    const orderId = 1;
    expect(orders.length).to.eq(2);
    expect(orders[0].id).to.eq(orderId + 1);
    expect(orders[1].id).to.eq(orderId + 2);

    const node = await orderBook.getNode(OrderSide.BUY, tokenId, price);
    expect(node.tombstoneOffset).to.eq(0);

    const remainderQuantity = quantity * 3 - numToSell;
    // Try to sell too many
    await orderBook.connect(alice).limitOrders([
      {
        side: OrderSide.SELL,
        tokenId,
        price,
        quantity: remainderQuantity + 1
      }
    ]);

    orders = await orderBook.allOrdersAtPrice(OrderSide.BUY, tokenId, price);
    expect(orders.length).to.eq(0);
  });

  it("Partial order consumption", async function () {});

  it("Max number of orders for a price should increment it by the tick, sell orders", async function () {
    const {orderBook, alice, tokenId, maxOrdersPerPrice, tick} = await loadFixture(deployContractsFixture);

    // Set up order book
    const price = 100;
    const quantity = 1;

    const limitOrder: IOrderBook.LimitOrderStruct = {
      side: OrderSide.SELL,
      tokenId,
      price,
      quantity
    };

    const limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill(limitOrder);
    await orderBook.limitOrders(limitOrders);

    // Try to add one more and it will be added to the next tick price
    await orderBook.connect(alice).limitOrders([limitOrder]);

    let orders = await orderBook.allOrdersAtPrice(OrderSide.SELL, tokenId, price);
    expect(orders.length).to.eq(maxOrdersPerPrice);

    orders = await orderBook.allOrdersAtPrice(OrderSide.SELL, tokenId, price + tick);
    expect(orders.length).to.eq(1);
  });

  it("Max number of orders for a price should increment it by the tick, sell orders, check just exceeding the extreme reverts", async function () {
    const {orderBook, alice, tokenId, maxOrdersPerPrice} = await loadFixture(deployContractsFixture);

    // Set up order book
    const price = 4722366482869645213695n; // Max price for uint72
    const quantity = 1;

    const limitOrder: IOrderBook.LimitOrderStruct = {
      side: OrderSide.SELL,
      tokenId: tokenId,
      price,
      quantity
    };

    const limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill(limitOrder);
    await orderBook.limitOrders(limitOrders);

    // Try to add one more and it will be reverted
    await expect(orderBook.connect(alice).limitOrders([limitOrder]))
      .to.be.revertedWithCustomError(orderBook, "SafeCastOverflowedUintDowncast")
      .withArgs(72, 4722366482869645213696n);
  });

  // Similiar to other test, but makes it exceed more
  it("Max number of orders for a price should increment it by the tick, sell orders, check extreme reverts", async function () {
    const {orderBook, owner, alice, tokenId, erc1155, maxOrdersPerPrice} = await loadFixture(deployContractsFixture);

    const tick = ethers.parseEther("1");
    const minQuantity = 1;
    await orderBook.setTokenIdInfos([tokenId + 1], [{tick, minQuantity}]);

    // Set up order book
    const price = ethers.parseEther("4722"); // At the extreme end of uint72
    const quantity = 1;
    await erc1155.mintSpecificId(owner, tokenId + 1, 100000);
    await erc1155.connect(alice).mintSpecificId(owner, tokenId + 1, 1);

    const limitOrder: IOrderBook.LimitOrderStruct = {
      side: OrderSide.SELL,
      tokenId: tokenId + 1,
      price,
      quantity
    };

    const limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill(limitOrder);
    await orderBook.limitOrders(limitOrders);

    // Try to add one more and it will be reverted
    await expect(orderBook.connect(alice).limitOrders([limitOrder]))
      .to.be.revertedWithCustomError(orderBook, "SafeCastOverflowedUintDowncast")
      .withArgs(72, price + tick);
  });

  it("Max number of orders for a price should increment it by the tick, buy orders", async function () {
    const {orderBook, alice, tokenId, maxOrdersPerPrice, tick} = await loadFixture(deployContractsFixture);

    // Set up order book
    const price = 100;
    const quantity = 1;

    const limitOrder: IOrderBook.LimitOrderStruct = {
      side: OrderSide.BUY,
      tokenId,
      price,
      quantity
    };

    const limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill(limitOrder);
    await orderBook.limitOrders(limitOrders);

    // Try to add one more and it will be added to the next tick price
    await orderBook.connect(alice).limitOrders([limitOrder]);

    let orders = await orderBook.allOrdersAtPrice(OrderSide.BUY, tokenId, price);
    expect(orders.length).to.eq(maxOrdersPerPrice);

    orders = await orderBook.allOrdersAtPrice(OrderSide.BUY, tokenId, price - tick);
    expect(orders.length).to.eq(1);
  });

  it("Max number of orders for a price should increment it by the tick, buy orders, check extreme reverts", async function () {
    const {orderBook, owner, alice, tokenId, maxOrdersPerPrice, tick} = await loadFixture(deployContractsFixture);

    // Set up order book
    const price = tick; // Minimum price
    const quantity = 1;

    const limitOrder: IOrderBook.LimitOrderStruct = {
      side: OrderSide.BUY,
      tokenId,
      price,
      quantity
    };

    const limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill(limitOrder);
    await orderBook.limitOrders(limitOrders);

    // Try to add one more and it will be reverted
    await expect(orderBook.connect(alice).limitOrders([limitOrder])).to.be.revertedWithCustomError(
      orderBook,
      "KeyCannotBeZero"
    );
  });

  it("Max number of orders for a price should increment it by the tick, where the price level exists already and has spare segments", async function () {
    const {orderBook, owner, alice, tokenId, maxOrdersPerPrice, tick} = await loadFixture(deployContractsFixture);

    // Set up order book
    const price = 100;
    const quantity = 1;

    const limitOrder: IOrderBook.LimitOrderStruct = {
      side: OrderSide.BUY,
      tokenId,
      price,
      quantity
    };

    const limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill(limitOrder);
    await orderBook.limitOrders(limitOrders);

    await orderBook.connect(alice).limitOrders([
      {
        side: OrderSide.BUY,
        tokenId,
        price: price - tick,
        quantity
      }
    ]);

    // Try to add one more and it will be added to the next tick price
    await orderBook.connect(alice).limitOrders([limitOrder]);

    let orders = await orderBook.allOrdersAtPrice(OrderSide.BUY, tokenId, price);
    expect(orders.length).to.eq(maxOrdersPerPrice);

    orders = await orderBook.allOrdersAtPrice(OrderSide.BUY, tokenId, price - tick);
    expect(orders.length).to.eq(2);
  });

  it("Multiple ticks iterated when there are the max number of orders and no spare orders in the last segment", async function () {
    const {orderBook, owner, alice, tokenId, maxOrdersPerPrice, erc1155, tick} = await loadFixture(
      deployContractsFixture
    );

    // Set up order book
    const price = 100;
    const quantity = 1;
    await erc1155.mintSpecificId(owner, tokenId, 10000);

    const limitOrder: IOrderBook.LimitOrderStruct = {
      side: OrderSide.SELL,
      tokenId,
      price,
      quantity
    };

    let limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill(limitOrder);
    await orderBook.limitOrders(limitOrders);

    const limitOrderNextTick: IOrderBook.LimitOrderStruct = {
      side: OrderSide.SELL,
      tokenId,
      price: price + tick,
      quantity
    };

    let limitOrdersNextTick = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill(limitOrderNextTick);
    await orderBook.limitOrders(limitOrdersNextTick);

    // Try to add one more and it will be added to the tick * 2 price
    await orderBook.connect(alice).limitOrders([limitOrder]);

    let orders = await orderBook.allOrdersAtPrice(OrderSide.SELL, tokenId, price + 2 * tick);
    expect(orders.length).to.eq(1);
  });

  it("Multiple ticks iterated, space at the end of the segment for it", async function () {
    const {orderBook, owner, alice, tokenId, maxOrdersPerPrice, erc1155, tick} = await loadFixture(
      deployContractsFixture
    );

    // Set up order book
    const price = 100;
    const quantity = 1;
    await erc1155.mintSpecificId(owner, tokenId, 10000);

    const limitOrder: IOrderBook.LimitOrderStruct = {
      side: OrderSide.SELL,
      tokenId,
      price,
      quantity
    };

    let limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill(limitOrder);
    await orderBook.limitOrders(limitOrders);

    const limitOrderNextTick: IOrderBook.LimitOrderStruct = {
      side: OrderSide.SELL,
      tokenId,
      price: price + tick,
      quantity
    };

    let limitOrdersNextTick = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill(limitOrderNextTick);
    await orderBook.limitOrders(limitOrdersNextTick);

    await orderBook.cancelOrders([maxOrdersPerPrice * 2 - 2], [{side: OrderSide.SELL, tokenId, price: price + tick}]);

    // Try to add one more and it will be added to the tick * 2 price
    await orderBook.connect(alice).limitOrders([limitOrder]);

    let orders = await orderBook.allOrdersAtPrice(OrderSide.SELL, tokenId, price + tick);
    expect(orders.length).to.eq(100);

    orders = await orderBook.allOrdersAtPrice(OrderSide.SELL, tokenId, price + 2 * tick);
    expect(orders.length).to.eq(0);
  });

  it("Price must be modulus of tick quantity must be > min quantity, sell", async function () {
    const {
      orderBook,
      erc1155,
      owner,
      tokenId: originalTokenId,
      initialQuantity
    } = await loadFixture(deployContractsFixture);

    const tokenId = originalTokenId + 1;
    await orderBook.setTokenIdInfos([tokenId], [{tick: 10, minQuantity: 20}]);

    await erc1155.mintSpecificId(owner, tokenId, initialQuantity * 2);
    await erc1155.setApprovalForAll(orderBook, true);

    let price = 101;
    let quantity = 20;
    await expect(
      orderBook.limitOrders([
        {
          side: OrderSide.SELL,
          tokenId,
          price,
          quantity
        }
      ])
    )
      .to.be.revertedWithCustomError(orderBook, "PriceNotMultipleOfTick")
      .withArgs(10);

    // Doesn't take any because quantity is lower than the minimum
    price = 100;
    quantity = 19;
    await orderBook.limitOrders([
      {
        side: OrderSide.SELL,
        tokenId,
        price,
        quantity
      }
    ]);
    expect(await erc1155.balanceOf(orderBook, tokenId)).to.eq(0);

    quantity = 20;
    await expect(
      orderBook.limitOrders([
        {
          side: OrderSide.SELL,
          tokenId,
          price,
          quantity
        }
      ])
    ).to.not.be.reverted;
    expect(await erc1155.balanceOf(orderBook, tokenId)).to.eq(20);
  });

  it("Price must be modulus of tick quantity must be > min quantity, buy", async function () {
    const {
      orderBook,
      coins,
      owner,
      tokenId: originalTokenId,
      erc1155,
      initialQuantity
    } = await loadFixture(deployContractsFixture);

    const tokenId = originalTokenId + 1;
    await orderBook.setTokenIdInfos([tokenId], [{tick: 10, minQuantity: 20}]);

    await erc1155.mintSpecificId(owner, tokenId, initialQuantity * 2);
    await erc1155.setApprovalForAll(orderBook, true);

    let price = 101;
    let quantity = 20;
    await expect(
      orderBook.limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        }
      ])
    )
      .to.be.revertedWithCustomError(orderBook, "PriceNotMultipleOfTick")
      .withArgs(10);

    // Doesn't take any because quantity is lower than the minimum
    price = 100;
    quantity = 19;
    await orderBook.limitOrders([
      {
        side: OrderSide.BUY,
        tokenId,
        price,
        quantity
      }
    ]);
    expect(await coins.balanceOf(orderBook)).to.eq(0);

    quantity = 20;
    await expect(
      orderBook.limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        }
      ])
    ).to.not.be.reverted;
    expect(await coins.balanceOf(orderBook)).to.eq(quantity * price);
  });

  it("Change minQuantity, check other orders can still be added/taken", async function () {
    const {orderBook, tokenId, tick, minQuantity} = await loadFixture(deployContractsFixture);

    let price = 101;
    await orderBook.limitOrders([
      {
        side: OrderSide.BUY,
        tokenId,
        price,
        quantity: minQuantity
      }
    ]);

    await orderBook.setTokenIdInfos([tokenId], [{tick, minQuantity: minQuantity + 1}]);

    await expect(
      orderBook.limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity: minQuantity
        }
      ])
    ).to.emit(orderBook, "FailedToAddToBook");

    await orderBook.limitOrders([
      {
        side: OrderSide.BUY,
        tokenId,
        price,
        quantity: minQuantity + 1
      }
    ]);

    await orderBook.limitOrders([
      {
        side: OrderSide.SELL,
        tokenId,
        price,
        quantity: 1
      }
    ]);
  });

  it("Set tokenId infos can only be called by the owner", async function () {
    const {orderBook, tick, tokenId, alice} = await loadFixture(deployContractsFixture);

    await expect(
      orderBook.connect(alice).setTokenIdInfos([tokenId], [{tick, minQuantity: 20}])
    ).to.be.revertedWithCustomError(orderBook, "OwnableUnauthorizedAccount");

    await expect(orderBook.setTokenIdInfos([tokenId], [{tick, minQuantity: 20}])).to.emit(orderBook, "SetTokenIdInfos");
  });

  it("Set tokenId infos argument length mismatch", async function () {
    const {orderBook, tokenId} = await loadFixture(deployContractsFixture);

    await expect(orderBook.setTokenIdInfos([tokenId], [])).to.be.revertedWithCustomError(orderBook, "LengthMismatch");
  });

  it("Tick change constraints", async function () {
    const {orderBook, tokenId, tick, minQuantity} = await loadFixture(deployContractsFixture);
    // Cannot be changed if set to a new one
    await expect(orderBook.setTokenIdInfos([tokenId], [{tick: tick + 1, minQuantity}])).to.be.revertedWithCustomError(
      orderBook,
      "TickCannotBeChanged"
    );
    // Can be set to 0 to remove it from the book.
    await expect(orderBook.setTokenIdInfos([tokenId], [{tick: 0, minQuantity}])).to.not.be.reverted;

    // And then can be changed from 0 (although not recommended unless it's back to the original one!)
    await expect(orderBook.setTokenIdInfos([tokenId], [{tick: tick, minQuantity}])).to.not.be.reverted;
  });

  it("Set max orders per price can only be called by the owner", async function () {
    const {orderBook, alice} = await loadFixture(deployContractsFixture);
    await expect(orderBook.connect(alice).setMaxOrdersPerPrice(100)).to.be.revertedWithCustomError(
      orderBook,
      "OwnableUnauthorizedAccount"
    );
    await expect(orderBook.setMaxOrdersPerPrice(100)).to.emit(orderBook, "SetMaxOrdersPerPriceLevel").withArgs(100);
  });

  it("Set max orders per price must be a multiple of NUM_ORDERS_PER_SEGMENT", async function () {
    const {orderBook} = await loadFixture(deployContractsFixture);
    await expect(orderBook.setMaxOrdersPerPrice(101)).to.be.revertedWithCustomError(
      orderBook,
      "MaxOrdersNotMultipleOfOrdersInSegment"
    );
  });

  it("Test gas costs", async function () {
    const {orderBook, erc1155, owner, alice, tokenId, maxOrdersPerPrice} = await loadFixture(deployContractsFixture);

    // Create a bunch of orders at 5 different prices each with the maximum number of orders, so 500 in total
    const price = 100;
    const quantity = 1;

    const prices = [price, price + 1, price + 2, price + 3, price + 4];
    for (const price of prices) {
      const limitOrder: IOrderBook.LimitOrderStruct = {
        side: OrderSide.BUY,
        tokenId,
        price,
        quantity
      };

      const limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill(limitOrder);
      await orderBook.connect(alice).limitOrders(limitOrders);
    }

    // Cancelling an order at the start will be very expensive
    const orderId = 1;
    await orderBook.connect(alice).cancelOrders([orderId], [{side: OrderSide.BUY, tokenId, price}]);

    await erc1155.mintSpecificId(owner, tokenId, 10000);
    await orderBook.limitOrders([
      {
        side: OrderSide.SELL,
        tokenId,
        price,
        quantity: quantity * maxOrdersPerPrice * prices.length
      }
    ]);
  });

  it("Update royalty fee for a non-erc2981 nft", async function () {
    const {coins} = await loadFixture(deployContractsFixture);

    const erc1155NoRoyalty = await ethers.deployContract("TestERC1155NoRoyalty");

    const maxOrdersPerPrice = 100;
    const OrderBook = await ethers.getContractFactory("OrderBook");
    const orderBook = await upgrades.deployProxy(
      OrderBook,
      [await erc1155NoRoyalty.getAddress(), await coins.getAddress(), ethers.ZeroAddress, 0, 0, maxOrdersPerPrice],
      {
        kind: "uups"
      }
    );

    await expect(orderBook.updateRoyaltyFee()).to.not.be.reverted;
  });

  describe("Market orders", function () {
    it("Check all fees (buying into order book)", async function () {
      const {orderBook, erc1155, coins, owner, alice, dev, royaltyRecipient, tokenId, initialCoins} = await loadFixture(
        deployContractsFixture
      );

      await erc1155.setRoyaltyFee(1000); // 10%
      await orderBook.updateRoyaltyFee();

      // Set up order book
      const price = 100;
      const quantity = 100;
      await orderBook.limitOrders([
        {
          side: OrderSide.SELL,
          tokenId,
          price,
          quantity
        }
      ]);
      // Take from it
      const cost = price * 10;
      await orderBook.connect(alice).marketOrder({
        side: OrderSide.BUY,
        tokenId,
        totalCost: cost,
        quantity: 10
      });

      // Check fees
      expect(await coins.balanceOf(alice)).to.eq(initialCoins - price * 10);
      const royalty = cost / 10;
      const burnt = (cost * 3) / 1000; // 0.3%
      const devAmount = (cost * 3) / 1000; // 0.3%
      const fees = royalty + burnt + devAmount;
      expect(await coins.balanceOf(orderBook)).to.eq(cost - fees);
      expect(await coins.balanceOf(dev)).to.eq(devAmount);
      expect(await coins.balanceOf(owner)).to.eq(initialCoins);
      expect(await coins.balanceOf(royaltyRecipient)).to.eq(royalty);
      expect(await coins.amountBurnt()).to.eq(burnt);
    });

    it("Check all fees (selling into order book)", async function () {
      const {orderBook, erc1155, coins, owner, alice, dev, royaltyRecipient, tokenId, initialCoins} = await loadFixture(
        deployContractsFixture
      );

      await erc1155.setRoyaltyFee(1000); // 10%
      await orderBook.updateRoyaltyFee();

      // Set up order book
      const price = 100;
      const quantity = 100;
      await orderBook.limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        }
      ]);
      const buyingCost = price * quantity;
      const cost = price * 10;
      await orderBook.connect(alice).marketOrder({
        side: OrderSide.SELL,
        tokenId,
        totalCost: 0,
        quantity: 10
      });

      // Check fees
      const royalty = cost / 10;
      const burnt = (cost * 3) / 1000; // 0.3%
      const devAmount = (cost * 3) / 1000; // 0.3%
      const fees = royalty + burnt + devAmount;

      expect(await coins.balanceOf(alice)).to.eq(initialCoins + cost - fees);
      expect(await coins.balanceOf(orderBook)).to.eq(buyingCost - cost);
      expect(await coins.balanceOf(dev)).to.eq(devAmount);
      expect(await coins.balanceOf(owner)).to.eq(initialCoins - buyingCost);
      expect(await coins.balanceOf(royaltyRecipient)).to.eq(royalty);
      expect(await coins.amountBurnt()).to.eq(burnt);
    });
  });

  describe("Limit orders", function () {
    it("Check all fees (buying into order book)", async function () {
      const {orderBook, erc1155, coins, owner, alice, dev, royaltyRecipient, tokenId, initialCoins} = await loadFixture(
        deployContractsFixture
      );

      await erc1155.setRoyaltyFee(1000); // 10%
      await orderBook.updateRoyaltyFee();

      // Set up order book
      const price = 1000000;
      const quantity = 100;
      await orderBook.limitOrders([
        {
          side: OrderSide.SELL,
          tokenId,
          price,
          quantity: quantity / 2
        },
        {
          side: OrderSide.SELL,
          tokenId,
          price,
          quantity: quantity / 2
        }
      ]);
      const cost = price * 10;
      await orderBook.connect(alice).limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity: 5
        },
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity: 5
        }
      ]);

      // Check fees
      expect(await coins.balanceOf(alice)).to.eq(initialCoins - price * 10);
      const royalty = cost / 10;
      const burnt = (cost * 3) / 1000; // 0.3%
      const devAmount = (cost * 3) / 1000; // 0.3%
      const fees = royalty + burnt + devAmount;
      expect(await coins.balanceOf(orderBook)).to.eq(cost - fees);
      expect(await coins.balanceOf(dev)).to.eq(devAmount);
      expect(await coins.balanceOf(owner)).to.eq(initialCoins);
      expect(await coins.balanceOf(royaltyRecipient)).to.eq(royalty);
      expect(await coins.amountBurnt()).to.eq(burnt);
    });

    it("Check all fees (selling into order book)", async function () {
      const {orderBook, erc1155, coins, owner, alice, dev, royaltyRecipient, tokenId, initialCoins} = await loadFixture(
        deployContractsFixture
      );

      await erc1155.setRoyaltyFee(1000); // 10%
      await orderBook.updateRoyaltyFee();

      // Set up order book
      const price = 100000;
      const quantity = 100;
      await orderBook.limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity: quantity / 2
        },
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity: quantity / 2
        }
      ]);
      const buyingCost = price * quantity;
      const quantitySelling = 10;
      const cost = price * quantitySelling;
      await orderBook.connect(alice).limitOrders([
        {
          side: OrderSide.SELL,
          tokenId,
          price,
          quantity: quantitySelling / 2
        },
        {
          side: OrderSide.SELL,
          tokenId,
          price,
          quantity: quantitySelling / 2
        }
      ]);

      // Check fees
      const royalty = cost / 10;
      const burnt = (cost * 3) / 1000; // 0.3%
      const devAmount = (cost * 3) / 1000; // 0.3%
      const fees = royalty + burnt + devAmount;

      expect(await coins.balanceOf(alice)).to.eq(initialCoins + cost - fees);
      expect(await coins.balanceOf(orderBook)).to.eq(buyingCost - cost);
      expect(await coins.balanceOf(dev)).to.eq(devAmount);
      expect(await coins.balanceOf(owner)).to.eq(initialCoins - buyingCost);
      expect(await coins.balanceOf(royaltyRecipient)).to.eq(royalty);
      expect(await coins.amountBurnt()).to.eq(burnt);
    });
  });

  it("Set fees can only be called by the owner", async function () {
    const {orderBook, alice} = await loadFixture(deployContractsFixture);
    await expect(orderBook.connect(alice).setFees(ethers.ZeroAddress, 0, 0)).to.be.revertedWithCustomError(
      orderBook,
      "OwnableUnauthorizedAccount"
    );
    await expect(orderBook.setFees(ethers.ZeroAddress, 0, 0))
      .to.emit(orderBook, "SetFees")
      .withArgs(ethers.ZeroAddress, 0, 0);
  });

  describe("Claiming", function () {
    describe("Claiming tokens", function () {
      it("Claim tokens", async function () {
        const {orderBook, erc1155, coins, owner, alice, tokenId, initialCoins} = await loadFixture(
          deployContractsFixture
        );

        await erc1155.setRoyaltyFee(1000); // 10%
        await orderBook.updateRoyaltyFee();

        // Set up order book
        const price = 100;
        const quantity = 100;
        await orderBook.limitOrders([
          {
            side: OrderSide.SELL,
            tokenId,
            price,
            quantity
          }
        ]);
        const cost = price * 10;
        await orderBook.connect(alice).limitOrders([
          {
            side: OrderSide.BUY,
            tokenId,
            price,
            quantity: 10
          }
        ]);

        // Check fees
        const fees = calcFees(cost, false);

        const orderId = 1;
        expect(await orderBook.tokensClaimable([orderId])).to.eq(cost - fees);
        expect(await orderBook.tokensClaimable([orderId + 1])).to.eq(0);
        expect((await orderBook.nftsClaimable([orderId]))[0]).to.eq(0);
        expect((await orderBook.nftsClaimable([orderId + 1]))[0]).to.eq(0);

        expect(await coins.balanceOf(owner)).to.eq(initialCoins);
        await expect(orderBook.claimTokens([orderId]))
          .to.emit(orderBook, "ClaimedTokens")
          .withArgs(owner.address, [orderId], cost - fees);
        expect(await coins.balanceOf(owner)).to.eq(initialCoins + cost - fees);
        expect(await orderBook.tokensClaimable([orderId])).to.eq(0);

        // Try to claim twice
        await expect(orderBook.claimTokens([orderId])).to.be.revertedWithCustomError(orderBook, "NothingToClaim");
        // Do another order and check it can be claimed
        await orderBook.connect(alice).limitOrders([
          {
            side: OrderSide.BUY,
            tokenId,
            price,
            quantity: 20
          }
        ]);
        expect(await orderBook.tokensClaimable([orderId])).to.eq(cost * 2 - fees * 2);
        await expect(orderBook.claimTokens([orderId]))
          .to.emit(orderBook, "ClaimedTokens")
          .withArgs(owner.address, [orderId], cost * 2 - fees * 2);
      });

      it("Claim tokens from multiple orders", async function () {
        const {orderBook, erc1155, coins, owner, alice, tokenId, initialCoins} = await loadFixture(
          deployContractsFixture
        );

        await erc1155.setRoyaltyFee(1000); // 10%
        await orderBook.updateRoyaltyFee();

        // Set up order book
        const price = 100;
        const quantity = 10;
        await orderBook.limitOrders([
          {
            side: OrderSide.SELL,
            tokenId,
            price,
            quantity
          },
          {
            side: OrderSide.SELL,
            tokenId,
            price,
            quantity
          },
          {
            side: OrderSide.SELL,
            tokenId,
            price,
            quantity
          },
          {
            side: OrderSide.SELL,
            tokenId,
            price,
            quantity
          },
          {
            side: OrderSide.SELL,
            tokenId,
            price,
            quantity
          },
          {
            side: OrderSide.SELL,
            tokenId,
            price,
            quantity
          }
        ]);
        const numBought = quantity * 4 + 1; // 4 orders and 1 from the 5th
        const cost = price * numBought;
        await orderBook.connect(alice).limitOrders([
          {
            side: OrderSide.BUY,
            tokenId,
            price,
            quantity: numBought
          }
        ]);

        // Check fees
        const fees = calcFees(cost, false);
        const singleCost = price * quantity;
        const singleOrderFees = calcFees(singleCost, false);

        const orderId = 1;
        expect(await orderBook.tokensClaimable([orderId])).to.eq(singleCost - singleOrderFees); // Just 1 order

        expect(await orderBook.tokensClaimable([orderId, orderId + 1, orderId + 2, orderId + 3, orderId + 4])).to.eq(
          cost - fees
        );
        expect(await orderBook.tokensClaimable([orderId + 5])).to.eq(0);

        expect(await coins.balanceOf(owner)).to.eq(initialCoins);
        await expect(orderBook.claimTokens([orderId]))
          .to.emit(orderBook, "ClaimedTokens")
          .withArgs(owner.address, [orderId], singleCost - singleOrderFees);

        await expect(orderBook.claimTokens([orderId + 1, orderId + 2, orderId + 3, orderId + 4]))
          .to.emit(orderBook, "ClaimedTokens")
          .withArgs(
            owner.address,
            [orderId + 1, orderId + 2, orderId + 3, orderId + 4],
            cost - singleCost - (fees - singleOrderFees)
          );

        expect(await coins.balanceOf(owner)).to.eq(initialCoins + cost - fees);
        expect(await orderBook.tokensClaimable([orderId + 4])).to.eq(0);

        // Try to claim twice
        await expect(orderBook.claimTokens([orderId + 4])).to.be.revertedWithCustomError(orderBook, "NothingToClaim");
      });

      it("Claim tokens, defensive constraints", async function () {
        const {orderBook, erc1155, alice, tokenId} = await loadFixture(deployContractsFixture);

        await erc1155.setRoyaltyFee(1000); // 10%
        await orderBook.updateRoyaltyFee();

        // Set up order book
        const price = 100;
        const quantity = 100;
        await orderBook.limitOrders([
          {
            side: OrderSide.SELL,
            tokenId,
            price,
            quantity
          }
        ]);

        const orderId = 1;
        await expect(orderBook.claimTokens([orderId])).to.be.revertedWithCustomError(orderBook, "NothingToClaim");

        await orderBook.limitOrders([
          {
            side: OrderSide.BUY,
            tokenId,
            price,
            quantity
          }
        ]);

        await expect(orderBook.connect(alice).claimTokens([orderId])).to.be.revertedWithCustomError(
          orderBook,
          "NotMaker"
        );
      });

      it("Claim tokens, no fees", async function () {
        const {orderBook, tokenId} = await loadFixture(deployContractsFixture);

        await orderBook.setFees(ethers.ZeroAddress, 0, 0);

        // Set up order book
        const price = 100;
        const quantity = 100;
        await orderBook.limitOrders([
          {
            side: OrderSide.SELL,
            tokenId,
            price,
            quantity
          }
        ]);

        await orderBook.limitOrders([
          {
            side: OrderSide.BUY,
            tokenId,
            price,
            quantity
          }
        ]);

        const orderId = 1;
        await expect(orderBook.claimTokens([orderId])).to.be.not.reverted;
      });

      it("Claim tokens, fees increased after should not have an effect", async function () {
        const {orderBook, tokenId, owner, dev} = await loadFixture(deployContractsFixture);

        // Set up order book
        const price = 100;
        const quantity = 100;
        await orderBook.limitOrders([
          {
            side: OrderSide.SELL,
            tokenId,
            price,
            quantity
          }
        ]);

        await orderBook.limitOrders([
          {
            side: OrderSide.BUY,
            tokenId,
            price,
            quantity
          }
        ]);

        await orderBook.setFees(dev.address, 1000, 246); // 10% dev fee and 2.46% burn
        const cost = price * quantity;
        const fees = calcFees(cost, true);

        const orderId = 1;
        await expect(orderBook.claimTokens([orderId]))
          .to.emit(orderBook, "ClaimedTokens")
          .withArgs(owner.address, [orderId], price * quantity - fees);
      });

      it("Claim tokens, max limit should revert", async function () {
        const {orderBook, owner, tokenId, maxOrdersPerPrice, erc1155} = await loadFixture(deployContractsFixture);

        await orderBook.setFees(ethers.ZeroAddress, 0, 0);
        await erc1155.mintSpecificId(owner, tokenId, 300);

        // Set up order book
        const price = 100;
        const quantity = 1;
        let limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill({
          side: OrderSide.SELL,
          tokenId,
          price,
          quantity
        });
        await orderBook.limitOrders(limitOrders);

        limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill({
          side: OrderSide.SELL,
          tokenId,
          price: price + 1,
          quantity
        });
        await orderBook.limitOrders(limitOrders);

        limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill({
          side: OrderSide.SELL,
          tokenId,
          price: price + 2,
          quantity
        });
        await orderBook.limitOrders(limitOrders);
        await orderBook.limitOrders([
          {
            side: OrderSide.BUY,
            tokenId,
            price: price + 2,
            quantity: 201
          }
        ]);

        const orders = Array.from({length: 201}, (_, i) => i + 1);
        await expect(orderBook.claimTokens(orders)).to.be.revertedWithCustomError(orderBook, "ClaimingTooManyOrders");

        orders.pop();
        await expect(orderBook.claimTokens(orders)).to.not.be.reverted;
      });

      it("Claiming no tokens, empty order id array argument", async function () {
        const {orderBook} = await loadFixture(deployContractsFixture);
        await expect(orderBook.claimTokens([])).to.be.revertedWithCustomError(orderBook, "NothingToClaim");
      });
    });

    describe("Claiming NFTs", function () {
      it("Claim NFTs", async function () {
        const {orderBook, owner, alice, tokenId} = await loadFixture(deployContractsFixture);

        // Set up order book
        const price = 100;
        const quantity = 100;
        await orderBook.limitOrders([
          {
            side: OrderSide.BUY,
            tokenId,
            price,
            quantity
          }
        ]);
        await orderBook.connect(alice).limitOrders([
          {
            side: OrderSide.SELL,
            tokenId,
            price,
            quantity: 10
          }
        ]);

        const orderId = 1;
        expect(await orderBook.tokensClaimable([orderId])).to.eq(0);
        expect(await orderBook.tokensClaimable([orderId + 1])).to.eq(0);
        expect((await orderBook.nftsClaimable([orderId]))[0]).to.eq(10);
        expect((await orderBook.nftsClaimable([orderId + 1]))[0]).to.eq(0);

        // claim as the maker
        await expect(orderBook.claimNFTs([orderId]))
          .to.emit(orderBook, "ClaimedNFTs")
          .withArgs(owner.address, [orderId], [tokenId], [10]);
        expect((await orderBook.nftsClaimable([orderId]))[0]).to.eq(0);

        // Try to claim twice
        await expect(orderBook.claimNFTs([orderId])).to.be.revertedWithCustomError(orderBook, "NothingToClaim");
      });

      it("Claim NFTs from multiple order", async function () {
        const {orderBook, owner, alice, tokenId} = await loadFixture(deployContractsFixture);

        // Set up order book
        const price = 100;
        const quantity = 10;
        await orderBook.limitOrders([
          {
            side: OrderSide.BUY,
            tokenId,
            price,
            quantity
          },
          {
            side: OrderSide.BUY,
            tokenId,
            price,
            quantity
          },
          {
            side: OrderSide.BUY,
            tokenId,
            price,
            quantity
          },
          {
            side: OrderSide.BUY,
            tokenId,
            price,
            quantity
          },
          {
            side: OrderSide.BUY,
            tokenId,
            price,
            quantity
          }
        ]);
        const nftsSold = quantity * 4 + 2;
        await orderBook.connect(alice).limitOrders([
          {
            side: OrderSide.SELL,
            tokenId,
            price,
            quantity: nftsSold
          }
        ]);

        const orderId = 1;
        expect(await orderBook.nftsClaimable([orderId, orderId + 1, orderId + 2, orderId + 3, orderId + 4])).to.deep.eq(
          [quantity, quantity, quantity, quantity, 2]
        );

        await expect(orderBook.claimNFTs([orderId, orderId + 1, orderId + 2, orderId + 3, orderId + 4]))
          .to.emit(orderBook, "ClaimedNFTs")
          .withArgs(
            owner.address,
            [orderId, orderId + 1, orderId + 2, orderId + 3, orderId + 4],
            [tokenId, tokenId, tokenId, tokenId, tokenId],
            [quantity, quantity, quantity, quantity, 2]
          );

        // Try to claim twice
        await expect(orderBook.claimNFTs([orderId])).to.be.revertedWithCustomError(orderBook, "NothingToClaim");

        await expect(orderBook.claimNFTs([orderId + 3])).to.be.revertedWithCustomError(orderBook, "NothingToClaim");

        // Claim some more of the final order
        await orderBook.connect(alice).limitOrders([
          {
            side: OrderSide.SELL,
            tokenId,
            price,
            quantity: 3
          }
        ]);
        expect(await orderBook.nftsClaimable([orderId + 4])).to.deep.eq([3]);
        await expect(orderBook.claimNFTs([orderId + 4]))
          .to.emit(orderBook, "ClaimedNFTs")
          .withArgs(owner.address, [orderId + 4], [tokenId], [3]);
        expect(await orderBook.nftsClaimable([orderId + 4])).to.deep.eq([0]);
      });

      it("Claim NFTs, max limit should revert", async function () {
        const {orderBook, owner, tokenId, maxOrdersPerPrice, erc1155} = await loadFixture(deployContractsFixture);

        await orderBook.setFees(ethers.ZeroAddress, 0, 0);
        await erc1155.mintSpecificId(owner, tokenId, 300);

        // Set up order book
        const price = 100;
        const quantity = 1;
        let limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill({
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        });
        await orderBook.limitOrders(limitOrders);

        limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill({
          side: OrderSide.BUY,
          tokenId,
          price: price - 1,
          quantity
        });
        await orderBook.limitOrders(limitOrders);

        limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill({
          side: OrderSide.BUY,
          tokenId,
          price: price - 2,
          quantity
        });
        await orderBook.limitOrders(limitOrders);

        await orderBook.limitOrders([
          {
            side: OrderSide.SELL,
            tokenId,
            price: price - 2,
            quantity: 201
          }
        ]);

        const orders = Array.from({length: 201}, (_, i) => i + 1);
        await expect(orderBook.claimNFTs(orders)).to.be.revertedWithCustomError(orderBook, "ClaimingTooManyOrders");

        orders.pop();
        await expect(orderBook.claimNFTs(orders)).to.not.be.reverted;
      });

      it("Claim NFTs, defensive constraints", async function () {
        const {orderBook, alice, tokenId} = await loadFixture(deployContractsFixture);

        // Set up order book
        const price = 100;
        const quantity = 100;
        await orderBook.limitOrders([
          {
            side: OrderSide.BUY,
            tokenId,
            price,
            quantity
          }
        ]);

        const orderId = 1;
        await expect(orderBook.claimNFTs([orderId])).to.be.revertedWithCustomError(orderBook, "NothingToClaim");

        await orderBook.connect(alice).limitOrders([
          {
            side: OrderSide.SELL,
            tokenId,
            price,
            quantity: 10
          }
        ]);

        await expect(orderBook.connect(alice).claimNFTs([orderId])).to.be.revertedWithCustomError(
          orderBook,
          "NotMaker"
        );
      });

      it("Claiming no nfts, empty order id array argument", async function () {
        const {orderBook} = await loadFixture(deployContractsFixture);
        await expect(orderBook.claimNFTs([])).to.be.revertedWithCustomError(orderBook, "NothingToClaim");
      });
    });

    describe("Claiming all", function () {
      it("Claim both tokens and NFTs at once", async function () {
        const {orderBook, erc1155, coins, owner, tokenId, initialCoins, initialQuantity} = await loadFixture(
          deployContractsFixture
        );

        await orderBook.setFees(ethers.ZeroAddress, 0, 0);

        // Set up order book
        const price = 100;
        const quantity = 100;
        await orderBook.limitOrders([
          {
            side: OrderSide.SELL,
            tokenId,
            price,
            quantity
          }
        ]);
        await orderBook.limitOrders([
          {
            side: OrderSide.BUY,
            tokenId,
            price,
            quantity: quantity + 1
          }
        ]);
        await orderBook.limitOrders([
          {
            side: OrderSide.SELL,
            tokenId,
            price,
            quantity: 20
          }
        ]);

        const orderId = 1;
        await orderBook.claimAll([orderId], [orderId + 1]);

        expect(await erc1155.balanceOf(owner, tokenId)).to.eq(initialQuantity - 19);
        expect(await coins.balanceOf(owner)).to.eq(initialCoins);
      });

      it("Check that 1 side only is allowed to be claimed", async function () {
        const {orderBook, erc1155, coins, owner, tokenId, initialCoins, initialQuantity} = await loadFixture(
          deployContractsFixture
        );

        await orderBook.setFees(ethers.ZeroAddress, 0, 0);

        // Set up order book
        const price = 100;
        const quantity = 100;
        await orderBook.limitOrders([
          {
            side: OrderSide.SELL,
            tokenId,
            price,
            quantity
          }
        ]);
        await orderBook.limitOrders([
          {
            side: OrderSide.BUY,
            tokenId,
            price,
            quantity: quantity + 1
          }
        ]);
        await orderBook.limitOrders([
          {
            side: OrderSide.SELL,
            tokenId,
            price,
            quantity: 20
          }
        ]);

        const orderId = 1;
        await orderBook.claimAll([orderId], []);
        await orderBook.claimAll([], [orderId + 1]);

        expect(await erc1155.balanceOf(owner, tokenId)).to.eq(initialQuantity - 19);
        expect(await coins.balanceOf(owner)).to.eq(initialCoins);
      });

      it("Check that if all arrays are empty the call reverts", async function () {
        const {orderBook} = await loadFixture(deployContractsFixture);
        await expect(orderBook.claimAll([], [])).to.be.revertedWithCustomError(orderBook, "NothingToClaim");
      });

      it("Claiming too many orders together split between tokens and nfts", async function () {
        const {orderBook, owner, tokenId, maxOrdersPerPrice, erc1155} = await loadFixture(deployContractsFixture);

        await orderBook.setFees(ethers.ZeroAddress, 0, 0);
        await erc1155.mintSpecificId(owner, tokenId, 300);

        // Set up order book
        const price = 100;
        const quantity = 1;
        let limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill({
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        });
        await orderBook.limitOrders(limitOrders);

        limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill({
          side: OrderSide.BUY,
          tokenId,
          price: price - 1,
          quantity
        });
        await orderBook.limitOrders(limitOrders);

        await orderBook.limitOrders([
          {
            side: OrderSide.SELL,
            tokenId,
            price: price - 1,
            quantity: maxOrdersPerPrice + 1
          }
        ]);

        // Add to the book
        limitOrders = new Array<IOrderBook.LimitOrderStruct>(maxOrdersPerPrice).fill({
          side: OrderSide.SELL,
          tokenId,
          price: price + 1,
          quantity
        });
        await orderBook.limitOrders(limitOrders);

        await orderBook.limitOrders([
          {
            side: OrderSide.BUY,
            tokenId,
            price: price + 1,
            quantity: maxOrdersPerPrice
          }
        ]);

        const nftOrders = Array.from({length: maxOrdersPerPrice + 1}, (_, i) => i + 1);
        const tokenOrders = Array.from({length: maxOrdersPerPrice}, (_, i) => i + maxOrdersPerPrice * 2 + 1);
        await expect(orderBook.claimAll(tokenOrders, nftOrders)).to.be.revertedWithCustomError(
          orderBook,
          "ClaimingTooManyOrders"
        );
        nftOrders.pop();
        await expect(orderBook.claimAll(tokenOrders, nftOrders)).to.not.be.reverted;
      });
    });
  });

  describe("Edit orders", function () {
    it("Cancels and makes a new order", async function () {
      const {orderBook, tokenId, tick, owner} = await loadFixture(deployContractsFixture);

      // Set up order book
      const price = 100;
      const quantity = 100;
      await orderBook.limitOrders([
        {
          side: OrderSide.BUY,
          tokenId,
          price,
          quantity
        }
      ]);

      const newOrder = {side: OrderSide.BUY, tokenId, price: price + 1 * tick, quantity: quantity + 2};
      await orderBook.cancelAndMakeLimitOrders([1], [{side: OrderSide.BUY, tokenId, price}], [newOrder]);

      const nextOrderIdSlot = 2;
      let packedSlot = await ethers.provider.getStorage(orderBook, nextOrderIdSlot);
      let nextOrderId = parseInt(packedSlot.slice(2, 12), 16);
      expect(nextOrderId).to.eq(3);

      expect((await orderBook.allOrdersAtPrice(OrderSide.BUY, tokenId, price)).length).to.eq(0);
      expect((await orderBook.allOrdersAtPrice(OrderSide.BUY, tokenId, price + 1 * tick)).length).to.eq(1);
      const orderId = 2;
      expect((await orderBook.allOrdersAtPrice(OrderSide.BUY, tokenId, price + 1 * tick))[0]).to.deep.eq([
        owner.address,
        quantity + 2,
        orderId
      ]);
    });
  });

  it("Max coins price", async function () {
    const {orderBook, tokenId} = await loadFixture(deployContractsFixture);

    const quantity = 100;
    await expect(
      orderBook.limitOrders([
        {
          side: OrderSide.SELL,
          tokenId,
          price: ethers.parseEther("4800"),
          quantity
        }
      ])
    ).to.be.revertedWithPanic;

    await expect(
      orderBook.limitOrders([
        {
          side: OrderSide.SELL,
          tokenId,
          price: ethers.parseEther("4700"),
          quantity
        }
      ])
    ).to.not.be.reverted;
  });

  it("Try to upgrade the contract with & without using the owner", async function () {
    const {orderBook, owner, alice} = await loadFixture(deployContractsFixture);

    let OrderBook = (await ethers.getContractFactory("OrderBook")).connect(alice);
    await expect(
      upgrades.upgradeProxy(orderBook, OrderBook, {
        kind: "uups"
      })
    ).to.be.revertedWithCustomError(orderBook, "OwnableUnauthorizedAccount");

    OrderBook = OrderBook.connect(owner);
    await expect(
      upgrades.upgradeProxy(orderBook, OrderBook, {
        kind: "uups"
      })
    ).to.not.be.reverted;
  });

  it("System test (many orders)", async function () {
    const {orderBook, owner, tokenId, coins, erc1155, tick, initialCoins} = await loadFixture(deployContractsFixture);

    await coins.mint(owner, initialCoins * 30);
    await coins.approve(orderBook, initialCoins * 30);

    const price = 100;
    const quantity = 10;

    await erc1155.mintSpecificId(owner, tokenId, quantity * 40);

    // Set up buy order book
    await orderBook.limitOrders([
      {
        side: OrderSide.SELL,
        tokenId,
        price: price + 2 * tick,
        quantity
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price: price + 2 * tick,
        quantity: quantity + 1
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price: price + 4 * tick,
        quantity: quantity + 2
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price: price + 8 * tick,
        quantity: quantity
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price: price + 8 * tick,
        quantity: quantity
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price: price + 8 * tick,
        quantity: quantity + 1
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price: price + 2 * tick,
        quantity: quantity + 2
      },
      {
        // order id 8
        side: OrderSide.SELL,
        tokenId,
        price: price + 2 * tick,
        quantity: quantity + 3
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price: price + 5 * tick,
        quantity: quantity + 2
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price: price + 4 * tick,
        quantity: quantity - 1
      },
      {
        // 11
        side: OrderSide.SELL,
        tokenId,
        price: price + 4 * tick,
        quantity: quantity
      },
      {
        // 12
        side: OrderSide.SELL,
        tokenId,
        price: price + 4 * tick,
        quantity: quantity
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price: price + 4 * tick,
        quantity: quantity + 4
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price: price + 8 * tick,
        quantity: quantity - 1
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price: price + 8 * tick,
        quantity: quantity + 4
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price: price + 8 * tick,
        quantity: quantity + 4
      },

      {
        side: OrderSide.BUY,
        tokenId,
        price: price,
        quantity: quantity
      },
      {
        side: OrderSide.BUY,
        tokenId,
        price: price - 2,
        quantity: quantity + 2
      },
      {
        side: OrderSide.BUY,
        tokenId,
        price: price,
        quantity: quantity + 1
      },
      {
        // 20
        side: OrderSide.BUY,
        tokenId,
        price: price - 1,
        quantity: quantity + 4
      },

      {
        side: OrderSide.SELL,
        tokenId,
        price: price + 4 * tick,
        quantity: quantity + 4
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price: price + 4 * tick,
        quantity: quantity + 4
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price: price + 4 * tick,
        quantity: quantity
      },

      {
        side: OrderSide.BUY,
        tokenId,
        price: price,
        quantity: quantity + 2
      },
      {
        // 25
        side: OrderSide.BUY,
        tokenId,
        price: price,
        quantity: quantity + 3
      },

      {
        side: OrderSide.SELL,
        tokenId,
        price: price + 8 * tick,
        quantity: quantity + 4
      },
      {
        side: OrderSide.SELL,
        tokenId,
        price: price + 8 * tick,
        quantity: quantity
      },

      {
        side: OrderSide.BUY,
        tokenId,
        price: price,
        quantity: quantity + 4
      },
      {
        // 29
        side: OrderSide.SELL,
        tokenId,
        price: price + 8 * tick,
        quantity: quantity
      },
      {
        // 30
        side: OrderSide.SELL,
        tokenId,
        price: price + 2 * tick,
        quantity: quantity + 4
      }
    ]);

    // Use this to output all orders
    /* outputAllOrders(await orderBook.allOrdersAtPrice(OrderSide.SELL, tokenId, price + 8 * tick));
    outputAllOrders(await orderBook.allOrdersAtPrice(OrderSide.SELL, tokenId, price + 5 * tick));
    outputAllOrders(await orderBook.allOrdersAtPrice(OrderSide.SELL, tokenId, price + 4 * tick));
    outputAllOrders(await orderBook.allOrdersAtPrice(OrderSide.SELL, tokenId, price + 2 * tick));

    outputAllOrders(await orderBook.allOrdersAtPrice(OrderSide.BUY, tokenId, price));
    outputAllOrders(await orderBook.allOrdersAtPrice(OrderSide.BUY, tokenId, price - tick));
    outputAllOrders(await orderBook.allOrdersAtPrice(OrderSide.BUY, tokenId, price - 2 * tick));
    */

    // Price - [orders (orderId)]
    // Sell
    // 108 - [quantity (4), quantity (5), quantity + 1 (6), quantity - 1 (14)], [quantity + 4 (15), quantity + 4 (16), quantity + 4 (26), quantity (27)], [quantity (29)]
    // 105 - [quantity + 2 (9)]
    // 104 - [quantity + 2 (3), quantity - 1 (10), quantity (11), quantity (12)], [quantity + 4 (13), quantity + 4 (21), quantity + 4 (22), quantity (23)]
    // 102 - [quantity (1), quantity + 1 (2), quantity + 2 (7), quantity + 3 (8)], [quantity + 4 (30)]

    // Buy
    // Price - orders
    // 100 - [quantity (17), quantity + 1 (19), quantity + 2 (24), quantity + 3 (25)], [quantity + 4 (28)]
    // 99 - [quantity + 4 (20)]
    // 98 - [quantity + 2 (18)]

    await orderBook.cancelOrders([5], [{side: OrderSide.SELL, tokenId, price: price + 8 * tick}]);
    expect((await orderBook.allOrdersAtPrice(OrderSide.SELL, tokenId, price + 8 * tick)).length).to.eq(8);

    // Price - [orders (orderId)]
    // Sell
    // 108 - [quantity (4), quantity + 1 (6), quantity - 1 (14), quantity + 4 (15)], [quantity + 4 (16), quantity + 4 (26), quantity (27), quantity (29)], []
    // 105 - [quantity + 2 (9)]
    // 104 - [quantity + 2 (3), quantity - 1 (10), quantity (11), quantity (12)], [quantity + 4 (13), quantity + 4 (21), quantity + 4 (22), quantity (23)]
    // 102 - [quantity (1), quantity + 1 (2), quantity + 2 (7), quantity + 3 (8)], [quantity + 4 (11)]

    // Buy
    // Price - orders
    // 100 - [quantity (17), quantity + 1 (19), quantity + 2 (24), quantity + 3 (25)], [quantity + 4 (28)]
    // 99 - [quantity + 4 (20)]
    // 98 - [quantity + 2 (18)]
    await orderBook.limitOrders([
      {
        side: OrderSide.BUY,
        tokenId,
        price: price + 3 * tick,
        quantity: quantity + quantity + 1 + quantity + 2 + quantity + 3 + quantity + 4 + quantity
      }
    ]);
    const nextOrderIdSlot = 2;
    const packedSlot = await ethers.provider.getStorage(orderBook, nextOrderIdSlot);
    const nextOrderId = parseInt(packedSlot.slice(2, 12), 16);
    expect(nextOrderId).to.eq(32);

    // (Remove whole 102 price level, add 103 price level)
    // Sell
    // Price - [orders (orderId)]
    // 108 - [quantity (4), quantity + 1 (6), quantity - 1 (14), quantity + 4 (15)], [quantity + 4 (16), quantity + 4 (26), quantity (27), quantity (29)], []
    // 105 - [quantity + 2 (9)]
    // 104 - [quantity + 2 (3), quantity - 1 (10), quantity (11), quantity (12)], [quantity + 4 (13), quantity + 4 (21), quantity + 4 (22), quantity (23)]

    // Buy
    // Price - orders
    // 103 - [quantity (31)]
    // 100 - [quantity (17), quantity + 1 (19), quantity + 2 (24), quantity + 3 (25)], [quantity + 4 (28)]
    // 99 - [quantity + 4 (20)]
    // 98 - [quantity + 2 (18)]

    await orderBook.limitOrders([
      {
        side: OrderSide.SELL,
        tokenId,
        price: price,
        quantity: quantity + quantity + 1 + 2
      }
    ]);

    // (Consume 103 level, 2 orders at 100 and eat into another)
    // Sell
    // Price - [orders (orderId)]
    // 108 - [quantity (4), quantity + 1 (6), quantity - 1 (14), quantity + 4 (15)], [quantity + 4 (16), quantity + 4 (26), quantity (27), quantity (29)], []
    // 105 - [quantity + 2 (9)]
    // 104 - [quantity + 2 (3), quantity - 1 (10), quantity (11), quantity (12)], [quantity + 4 (13), quantity + 4 (21), quantity + 4 (22), quantity (23)]

    // Buy
    // Price - orders
    // 100 - [0, 0, quantity (24), quantity + 3 (25)], [quantity + 4 (28)]
    // 99 - [quantity + 4 (20)]
    // 98 - [quantity + 2 (18)]

    // (Consume 103 order 2 orders and eat into another)
    await orderBook.limitOrders([
      {
        side: OrderSide.SELL,
        tokenId,
        price: price,
        quantity: quantity + quantity + quantity + 3
      }
    ]);

    let node = await orderBook.getNode(OrderSide.BUY, tokenId, price);
    expect(node.tombstoneOffset).to.eq(1);

    // Sell
    // Price - [orders (orderId)]
    // 108 - [quantity (4), quantity + 1 (6), quantity - 1 (14), quantity + 4 (15)], [quantity + 4 (16), quantity + 4 (26), quantity (27), quantity (29)], []
    // 105 - [quantity + 2 (9)]
    // 104 - [quantity + 2 (3), quantity - 1 (10), quantity (11), quantity (12)], [quantity + 4 (13), quantity + 4 (21), quantity + 4 (22), quantity (23)]

    // Buy
    // Price - orders
    // 100 - [0, 0, 0, 0], [quantity + 4 (28)]
    // 99 - [quantity + 4 (20)]
    // 98 - [quantity + 2 (18)]

    // Add a buy above the one with a tomstone offset on a price level which was removed (103)
    await orderBook.limitOrders([
      {
        side: OrderSide.BUY,
        tokenId,
        price: price + 3 * tick,
        quantity: quantity - 6
      }
    ]);

    // Sell
    // Price - [orders (orderId)]
    // 108 - [quantity (4), quantity + 1 (6), quantity - 1 (14), quantity + 4 (15)], [quantity + 4 (16), quantity + 4 (26), quantity (27), quantity (29)], []
    // 105 - [quantity + 2 (9)]
    // 104 - [quantity + 2 (3), quantity - 1 (10), quantity (11), quantity (12)], [quantity + 4 (13), quantity + 4 (21), quantity + 4 (22), quantity (23)]

    // Buy
    // Price - orders
    // 103 - [quantity - 6 (32)]
    // 100 - [0, 0, 0, 0], [quantity + 4 (28)]
    // 99 - [quantity + 4 (20)]
    // 98 - [quantity + 2 (18)]

    // Take out 103, 100, and a bit of 99
    await orderBook.limitOrders([
      {
        side: OrderSide.SELL,
        tokenId,
        price: price - 1,
        quantity: quantity + 4 + quantity - 6 + 3
      }
    ]);

    // Sell
    // Price - [orders (orderId)]
    // 108 - [quantity (4), quantity + 1 (6), quantity - 1 (14), quantity + 4 (15)], [quantity + 4 (16), quantity + 4 (26), quantity (27), quantity (29)], []
    // 105 - [quantity + 2 (9)]
    // 104 - [quantity + 2 (3), quantity - 1 (10), quantity (11), quantity (12)], [quantity + 4 (13), quantity + 4 (21), quantity + 4 (22), quantity (23)]

    // Buy
    // Price - orders
    // 99 - [quantity + 1 (20)]
    // 98 - [quantity + 2 (18)]

    // Add a buy with a previous tomstone offset on a price level which was removed (100)
    await orderBook.limitOrders([
      {
        side: OrderSide.BUY,
        tokenId,
        price: price,
        quantity: quantity
      }
    ]);

    expect(await orderBook.getHighestBid(tokenId)).to.eq(price);
    node = await orderBook.getNode(OrderSide.BUY, tokenId, price);
    expect(node.tombstoneOffset).to.eq(1);
    expect((await orderBook.allOrdersAtPrice(OrderSide.BUY, tokenId, price)).length).to.eq(1);
    expect((await orderBook.allOrdersAtPrice(OrderSide.BUY, tokenId, price))[0]).to.deep.eq([
      owner.address,
      quantity,
      33n
    ]);

    // Sell
    // Price - [orders (orderId)]
    // 108 - [quantity (4), quantity + 1 (6), quantity - 1 (14), quantity + 4 (15)], [quantity + 4 (16), quantity + 4 (26), quantity (27), quantity (29)], []
    // 105 - [quantity + 2 (9)]
    // 104 - [quantity + 2 (3), quantity - 1 (10), quantity (11), quantity (12)], [quantity + 4 (13), quantity + 4 (21), quantity + 4 (22), quantity (23)]

    // Buy
    // Price - orders
    // 100 - [0, 0, 0, 0], [quantity (33)]
    // 99 - [quantity + 1 (20)]
    // 98 - [quantity + 2 (18)]

    // Consume all of 104, 105, and one segment of 108, 1 order and eat into another of another segment
    await orderBook.limitOrders([
      {
        side: OrderSide.BUY,
        tokenId,
        price: price + 8 * tick,
        quantity:
          quantity +
          2 +
          quantity -
          1 +
          quantity +
          quantity +
          quantity +
          4 +
          quantity +
          4 +
          quantity +
          4 +
          quantity +
          quantity +
          2 +
          quantity +
          quantity +
          1 +
          quantity -
          1 +
          quantity +
          4 +
          quantity +
          4 +
          quantity
      }
    ]);

    expect((await orderBook.allOrdersAtPrice(OrderSide.SELL, tokenId, price + 8 * tick)).length).to.eq(3);
    expect((await orderBook.allOrdersAtPrice(OrderSide.SELL, tokenId, price + 5 * tick)).length).to.eq(0);
    expect((await orderBook.allOrdersAtPrice(OrderSide.SELL, tokenId, price + 4 * tick)).length).to.eq(0);

    // Sell
    // Price - [orders (orderId)]
    // 108 - [0, 0, 0, 0], [0, 4 (26), quantity (27), quantity (29)], []

    // Buy
    // Price - orders
    // 100 - [0, 0, 0, 0], [quantity (33)]
    // 99 - [quantity + 1 (20)]
    // 98 - [quantity + 2 (18)]

    await orderBook.limitOrders([
      {
        side: OrderSide.SELL,
        tokenId,
        price: price + 4 * tick,
        quantity: quantity
      }
    ]);

    node = await orderBook.getNode(OrderSide.SELL, tokenId, price + 4 * tick);
    expect(node.tombstoneOffset).to.eq(2);
    expect((await orderBook.allOrdersAtPrice(OrderSide.SELL, tokenId, price + 4 * tick)).length).to.eq(1);

    // Sell
    // Price - [orders (orderId)]
    // 108 - [0, 0, 0, 0], [0, 4 (26), quantity (27), quantity (29)], []
    // 104 - [0, 0, 0, 0], [0, 0, 0, 0], [quantity (34)]

    // Buy
    // Price - orders
    // 100 - [0, 0, 0, 0], [quantity (33)]
    // 99 - [quantity + 1 (20)]
    // 98 - [quantity + 2 (18)]

    // Cancel the order should remove this order from the tree
    await orderBook.cancelOrders([34], [{side: OrderSide.SELL, tokenId, price: price + 4 * tick}]);

    await expect(orderBook.getNode(OrderSide.SELL, tokenId, price + 4 * tick)).to.be.reverted;

    // Sell
    // Price - [orders (orderId)]
    // 108 - [0, 0, 0, 0], [0, 4 (26), quantity (27), quantity (29)], []

    // Buy
    // Price - orders
    // 100 - [0, 0, 0, 0], [quantity (33)]
    // 99 - [quantity + 1 (20)]
    // 98 - [quantity + 2 (18)]

    // Re add the order to check tombstone offset again
    await orderBook.limitOrders([
      {
        side: OrderSide.SELL,
        tokenId,
        price: price + 4 * tick,
        quantity: quantity + 1
      }
    ]);

    node = await orderBook.getNode(OrderSide.SELL, tokenId, price + 4 * tick);
    expect(node.tombstoneOffset).to.eq(2);
    expect((await orderBook.allOrdersAtPrice(OrderSide.SELL, tokenId, price + 4 * tick)).length).to.eq(1);
    expect((await orderBook.allOrdersAtPrice(OrderSide.SELL, tokenId, price + 4 * tick))[0]).to.deep.eq([
      owner.address,
      quantity + 1,
      35n
    ]);

    // Sell
    // Price - [orders (orderId)]
    // 108 - [0, 0, 0, 0], [0, 4 (26), quantity (27), quantity (29)], []
    // 104 - [0, 0, 0, 0], [0, 0, 0, 0], [quantity + 1 (35)]

    // Buy
    // Price - orders
    // 100 - [0, 0, 0, 0], [quantity (33)]
    // 99 - [quantity + 1 (20)]
    // 98 - [quantity + 2 (18)]
  });

  // Assuming royalty fee is 10%, burnt fee is 0.3% and dev fee is 0.3%
  const calcFees = (cost: number, ignoreRoyalty: boolean) => {
    let royalty = ignoreRoyalty ? 0 : cost / 10;
    const burnt = (cost * 3) / 1000; // 0.3%
    const devAmount = (cost * 3) / 1000; // 0.3%
    return Math.floor(royalty + burnt + devAmount);
  };

  const outputAllOrders = (orders: IOrderBook.OrderStruct[]) => {
    for (const order of orders) {
      console.log(`${order.id} | ${order.quantity}`);
    }
  };
});
