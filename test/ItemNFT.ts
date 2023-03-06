import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {BRONZE_AXE, createPlayer, EquipPosition, inputItem} from "../scripts/utils";

describe("PlayerNFT", () => {
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

    // Create NFT contract which contains all items
    const ItemNFT = await ethers.getContractFactory("ItemNFT");
    const itemNFT = await upgrades.deployProxy(ItemNFT, [world.address, shop.address], {
      kind: "uups",
      unsafeAllow: ["delegatecall"],
    });

    await shop.setItemNFT(itemNFT.address);
    // Create NFT contract which contains all the players
    const PlayerNFT = await ethers.getContractFactory("PlayerNFT");
    const playerNFT = await upgrades.deployProxy(PlayerNFT, [brush.address, shop.address, 5000], {kind: "uups"});

    // This contains all the player data
    const PlayerLibrary = await ethers.getContractFactory("PlayerLibrary");
    const playerLibrary = await PlayerLibrary.deploy();

    const PlayersImplQueueActions = await ethers.getContractFactory("PlayersImplQueueActions");
    const playersImplQueueActions = await PlayersImplQueueActions.deploy();

    const PlayersImplProcessActions = await ethers.getContractFactory("PlayersImplProcessActions", {
      libraries: {PlayerLibrary: playerLibrary.address},
    });
    const playersImplProcessActions = await PlayersImplProcessActions.deploy();

    const PlayersImplRewards = await ethers.getContractFactory("PlayersImplRewards", {
      libraries: {PlayerLibrary: playerLibrary.address},
    });
    const playersImplRewards = await PlayersImplRewards.deploy();

    const Players = await ethers.getContractFactory("Players", {
      libraries: {PlayerLibrary: playerLibrary.address},
    });

    const players = await upgrades.deployProxy(
      Players,
      [
        itemNFT.address,
        playerNFT.address,
        world.address,
        playersImplQueueActions.address,
        playersImplProcessActions.address,
        playersImplRewards.address,
      ],
      {
        kind: "uups",
        unsafeAllow: ["delegatecall", "external-library-linking"],
      }
    );

    await itemNFT.setPlayers(players.address);
    await playerNFT.setPlayers(players.address);

    const avatarId = 1;
    const avatarInfo = {
      name: ethers.utils.formatBytes32String("Name goes here"),
      description: "Hi I'm a description",
      imageURI: "1234.png",
    };
    await playerNFT.setAvatar(avatarId, avatarInfo);

    // Create player
    const origName = "0xSamWitch";
    const makeActive = true;
    const playerId = await createPlayer(
      playerNFT,
      avatarId,
      alice,
      ethers.utils.formatBytes32String(origName),
      makeActive
    );
    await players.connect(alice).setActivePlayer(playerId);
    const maxTime = await players.MAX_TIME();
    const editNameCost = await playerNFT.editNameCost();

    return {
      playerId,
      players,
      playerNFT,
      itemNFT,
      brush,
      maxTime,
      owner,
      world,
      alice,
      origName,
      editNameCost,
      mockOracleClient,
      avatarInfo,
    };
  }

  it("supportsInterface", async () => {
    const {itemNFT} = await loadFixture(deployContracts);
    // TODO
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
      ...inputItem,
      tokenId: BRONZE_AXE,
      equipPosition: EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    expect(await itemNFT.balanceOf(alice.address, BRONZE_AXE)).to.be.eq(1);
    await itemNFT.connect(alice).safeTransferFrom(alice.address, owner.address, BRONZE_AXE, 1, "0x");
    expect(await itemNFT.balanceOf(alice.address, BRONZE_AXE)).to.be.eq(0);
  });

  it("Non-transferable NFT", async () => {
    const {itemNFT, alice, owner} = await loadFixture(deployContracts);

    await itemNFT.addItem({
      ...inputItem,
      tokenId: BRONZE_AXE,
      isTransferable: false, // Cannot be transferred
      equipPosition: EquipPosition.RIGHT_HAND,
      metadataURI: "someIPFSURI.json",
    });

    await expect(itemNFT.connect(alice).safeTransferFrom(alice.address, owner.address, BRONZE_AXE, 1, "0x")).to.be
      .reverted;
  });
});
