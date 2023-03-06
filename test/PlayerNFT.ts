import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {createPlayer} from "../scripts/utils";

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

  it("Empty name", async () => {
    const {playerNFT, alice} = await loadFixture(deployContracts);
    const nameTooLong = ethers.utils.formatBytes32String("");
    const avatarId = 1;
    await expect(createPlayer(playerNFT, avatarId, alice, nameTooLong)).to.be.reverted;
  });

  it("Name too long", async () => {
    const {playerNFT, alice} = await loadFixture(deployContracts);
    const nameTooLong = ethers.utils.formatBytes32String("F12345678901234567890");
    const avatarId = 1;
    const makeActive = true;
    const newPlayerId = await createPlayer(playerNFT, avatarId, alice, nameTooLong, makeActive);

    expect(await playerNFT.names(newPlayerId)).to.eq(ethers.utils.formatBytes32String("F1234567890123456789"));
    expect(await playerNFT.lowercaseNames(ethers.utils.formatBytes32String("f1234567890123456789"))).to.be.true;
  });

  it("Duplicate names not allowed", async () => {
    const {playerNFT, alice} = await loadFixture(deployContracts);

    const name = ethers.utils.formatBytes32String("123");
    const avatarId = 1;
    const makeActive = true;
    await createPlayer(playerNFT, avatarId, alice, name, makeActive);
    await expect(createPlayer(playerNFT, avatarId, alice, name)).to.be.reverted;
  });

  it("Edit Name", async () => {
    const {playerId, playerNFT, alice, brush, origName, editNameCost} = await loadFixture(deployContracts);
    const name = ethers.utils.formatBytes32String("My name is edited");
    await expect(playerNFT.connect(alice).editName(playerId, name)).to.be.reverted; // Haven't got the brush

    await brush.mint(alice.address, editNameCost.mul(2));
    await brush.connect(alice).approve(playerNFT.address, editNameCost.mul(2));

    await expect(playerNFT.editName(playerId, name)).to.be.reverted; // Not the owner
    expect(await playerNFT.connect(alice).lowercaseNames(ethers.utils.formatBytes32String(origName.toLowerCase()))).to
      .be.true;

    await playerNFT.connect(alice).editName(playerId, name);
    expect(await playerNFT.connect(alice).lowercaseNames(ethers.utils.formatBytes32String(origName.toLowerCase()))).to
      .be.false; // Should be deleted now
    expect(await playerNFT.connect(alice).names(playerId)).to.eq(name);

    const avatarId = 1;
    const makeActive = true;
    // Duplicate
    const newPlayerId = await createPlayer(
      playerNFT,
      avatarId,
      alice,
      ethers.utils.formatBytes32String("name"),
      makeActive
    );
    await expect(playerNFT.connect(alice).editName(newPlayerId, name)).to.be.reverted;
  });

  it("uri", async () => {
    const {playerId, playerNFT, avatarInfo, origName} = await loadFixture(deployContracts);
    const uri = await playerNFT.uri(playerId);
    expect(uri.startsWith("data:application/json;base64,")).to.be.true;

    const decodedBase64 = ethers.utils.base64.decode(uri.split(",")[1]);
    const metadata = JSON.parse(new TextDecoder().decode(decodedBase64));
    expect(metadata.name).to.eq(origName);
    expect(metadata.description).to.eq(avatarInfo.description);
    expect(metadata.image).to.eq(`ipfs://${avatarInfo.imageURI}`);
    expect(metadata.attributes.length).to.be.greaterThan(0);
    const avatar = metadata.attributes.find((e) => e.trait_type === "Avatar");
    expect(avatar.value).to.eq(ethers.utils.parseBytes32String(avatarInfo.name));
  });

  it("supportsInterface", async () => {
    const {playerNFT, playerId} = await loadFixture(deployContracts);
    // TODO
  });
});
