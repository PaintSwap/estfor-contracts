import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {Skill} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {AvatarInfo, createPlayer} from "../scripts/utils";
import {PlayerNFT} from "../typechain-types";

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

    const MockRouter = await ethers.getContractFactory("MockRouter");
    const router = await MockRouter.deploy();
    const RoyaltyReceiver = await ethers.getContractFactory("RoyaltyReceiver");
    const royaltyReceiver = await RoyaltyReceiver.deploy(router.address, shop.address, brush.address, [
      alice.address,
      brush.address,
    ]);

    // Create NFT contract which contains all items
    const ItemNFT = await ethers.getContractFactory("ItemNFT");
    const itemNFT = await upgrades.deployProxy(ItemNFT, [world.address, shop.address, royaltyReceiver.address], {
      kind: "uups",
      unsafeAllow: ["delegatecall"],
    });

    await shop.setItemNFT(itemNFT.address);
    // Create NFT contract which contains all the players
    const PlayerNFT = await ethers.getContractFactory("PlayerNFT");
    const EDIT_NAME_BRUSH_PRICE = ethers.utils.parseEther("1");
    const imageBaseUri = "ipfs://";
    const playerNFT = (await upgrades.deployProxy(
      PlayerNFT,
      [brush.address, shop.address, royaltyReceiver.address, EDIT_NAME_BRUSH_PRICE, imageBaseUri],
      {
        kind: "uups",
      }
    )) as PlayerNFT;

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
    const avatarInfo: AvatarInfo = {
      name: ethers.utils.formatBytes32String("Name goes here"),
      description: "Hi I'm a description",
      imageURI: "1234.png",
      startSkills: [Skill.NONE, Skill.NONE],
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

    return {
      playerId,
      playerNFT,
      brush,
      alice,
      origName,
      EDIT_NAME_BRUSH_PRICE,
      mockOracleClient,
      avatarInfo,
    };
  }

  it("Empty name", async () => {
    const {playerNFT, alice} = await loadFixture(deployContracts);
    const nameTooLong = ethers.utils.formatBytes32String("");
    const avatarId = 1;
    await expect(createPlayer(playerNFT, avatarId, alice, nameTooLong, true)).to.be.revertedWithCustomError(
      playerNFT,
      "NameCannotBeEmpty"
    );
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
    await expect(createPlayer(playerNFT, avatarId, alice, name, true)).to.be.revertedWithCustomError(
      playerNFT,
      "NameAlreadyExists"
    );
  });

  it("Edit Name", async () => {
    const {playerId, playerNFT, alice, brush, origName, EDIT_NAME_BRUSH_PRICE} = await loadFixture(deployContracts);
    const name = ethers.utils.formatBytes32String("My name is edited");
    await brush.connect(alice).approve(playerNFT.address, EDIT_NAME_BRUSH_PRICE.mul(3));
    await expect(playerNFT.connect(alice).editName(playerId, name)).to.be.revertedWith(
      "ERC20: transfer amount exceeds balance"
    );
    await brush.mint(alice.address, EDIT_NAME_BRUSH_PRICE.mul(3));

    await expect(playerNFT.editName(playerId, name)).to.be.revertedWithCustomError(playerNFT, "NotOwner");
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
    await expect(playerNFT.connect(alice).editName(newPlayerId, name)).to.be.revertedWithCustomError(
      playerNFT,
      "NameAlreadyExists"
    );
  });

  it("uri", async () => {
    const {playerId, playerNFT, avatarInfo, origName} = await loadFixture(deployContracts);
    const uri = await playerNFT.uri(playerId);

    expect(uri.startsWith("data:application/json;base64")).to.be.true;
    const metadata = JSON.parse(Buffer.from(uri.split(";base64,")[1], "base64").toString());
    expect(metadata).to.have.property("name");
    expect(metadata.name).to.equal(origName);
    expect(metadata.image).to.eq(`ipfs://${avatarInfo.imageURI}`);
    expect(metadata).to.have.property("attributes");
    expect(metadata.attributes).to.be.an("array");
    expect(metadata.attributes).to.have.length(13);
    expect(metadata.attributes[0]).to.have.property("trait_type");
    expect(metadata.attributes[0].trait_type).to.equal("Avatar");
    expect(metadata.attributes[0]).to.have.property("value");
    expect(metadata.attributes[0].value).to.equal("Name goes here");
    expect(metadata.attributes[1]).to.have.property("trait_type");
    expect(metadata.attributes[1].trait_type).to.equal("Melee");
    expect(metadata.attributes[1]).to.have.property("value");
    expect(metadata.attributes[1].value).to.equal(1);
  });

  describe("supportsInterface", async () => {
    it("IERC165", async () => {
      const {playerNFT} = await loadFixture(deployContracts);
      expect(await playerNFT.supportsInterface("0x01ffc9a7")).to.equal(true);
    });

    it("IERC1155", async () => {
      const {playerNFT} = await loadFixture(deployContracts);
      expect(await playerNFT.supportsInterface("0xd9b67a26")).to.equal(true);
    });

    it("IERC1155Metadata", async () => {
      const {playerNFT} = await loadFixture(deployContracts);
      expect(await playerNFT.supportsInterface("0x0e89341c")).to.equal(true);
    });

    it("IERC2981 royalties", async () => {
      const {playerNFT} = await loadFixture(deployContracts);
      expect(await playerNFT.supportsInterface("0x2a55205a")).to.equal(true);
    });
  });
});
