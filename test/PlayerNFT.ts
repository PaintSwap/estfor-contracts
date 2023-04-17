import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {createPlayer} from "../scripts/utils";
import {PlayerNFT} from "../typechain-types";
import {playersFixture} from "./Players/PlayersFixture";

describe("PlayerNFT", function () {
  async function deployContracts() {
    const baseFixture = await loadFixture(playersFixture);
    return {...baseFixture};
  }

  it("Empty name", async function () {
    const {playerNFT, alice} = await loadFixture(deployContracts);
    const emptyName = "";
    const avatarId = 1;
    await expect(createPlayer(playerNFT, avatarId, alice, emptyName, true)).to.be.revertedWithCustomError(
      playerNFT,
      "NameTooShort"
    );
  });

  it("Name too long", async function () {
    const {playerNFT, alice} = await loadFixture(deployContracts);
    const nameTooLong = "F12345678901234567890";
    const avatarId = 1;
    const makeActive = true;
    await expect(createPlayer(playerNFT, avatarId, alice, nameTooLong, makeActive)).to.be.revertedWithCustomError(
      playerNFT,
      "NameTooLong"
    );
  });

  it("Duplicate names not allowed", async function () {
    const {playerNFT, alice} = await loadFixture(deployContracts);

    const name = "A123";
    const avatarId = 1;
    const makeActive = true;
    await createPlayer(playerNFT, avatarId, alice, name, makeActive);
    await expect(createPlayer(playerNFT, avatarId, alice, name, true)).to.be.revertedWithCustomError(
      playerNFT,
      "NameAlreadyExists"
    );
    // Add a space at the end check it's also detected as being the same
    await expect(createPlayer(playerNFT, avatarId, alice, name + " ", true)).to.be.revertedWithCustomError(
      playerNFT,
      "NameAlreadyExists"
    );
    await expect(createPlayer(playerNFT, avatarId, alice, name.toLowerCase(), true)).to.be.revertedWithCustomError(
      playerNFT,
      "NameAlreadyExists"
    );
  });

  it("Edit Name", async function () {
    const {playerId, playerNFT, alice, brush, origName, editNameBrushPrice} = await loadFixture(deployContracts);
    const name = "My name is edited";
    await brush.connect(alice).approve(playerNFT.address, editNameBrushPrice.mul(3));
    await expect(playerNFT.connect(alice).editName(playerId, name)).to.be.revertedWith(
      "ERC20: transfer amount exceeds balance"
    );
    await brush.mint(alice.address, editNameBrushPrice.mul(3));

    await expect(playerNFT.editName(playerId, name)).to.be.revertedWithCustomError(playerNFT, "NotOwnerOfPlayer");
    expect(await playerNFT.lowercaseNames(origName.toLowerCase())).to.be.true;

    await playerNFT.connect(alice).editName(playerId, name);
    expect(await playerNFT.lowercaseNames(origName.toLowerCase())).to.be.false; // Should be deleted now
    expect(await playerNFT.names(playerId)).to.eq(name);

    const avatarId = 1;
    const makeActive = true;
    // Duplicate
    const newPlayerId = await createPlayer(playerNFT, avatarId, alice, "name", makeActive);
    await expect(playerNFT.connect(alice).editName(newPlayerId, name)).to.be.revertedWithCustomError(
      playerNFT,
      "NameAlreadyExists"
    );
  });

  it("uri", async function () {
    const {playerId, playerNFT, avatarInfo, origName} = await loadFixture(deployContracts);
    const uri = await playerNFT.uri(playerId);

    expect(uri.startsWith("data:application/json;base64")).to.be.true;
    const metadata = JSON.parse(Buffer.from(uri.split(";base64,")[1], "base64").toString());
    expect(metadata).to.have.property("name");
    expect(metadata.name.startsWith(origName));
    expect(metadata.name.endsWith(` (12)`));
    expect(metadata.image).to.eq(`ipfs://${avatarInfo.imageURI}`);
    expect(metadata).to.have.property("attributes");
    expect(metadata.attributes).to.be.an("array");
    expect(metadata.attributes).to.have.length(15);
    expect(metadata.attributes[0]).to.have.property("trait_type");
    expect(metadata.attributes[0].trait_type).to.equal("Avatar");
    expect(metadata.attributes[0]).to.have.property("value");
    expect(metadata.attributes[0].value).to.equal("Name goes here");
    expect(metadata.attributes[1]).to.have.property("trait_type");
    expect(metadata.attributes[1].trait_type).to.equal("Clan");
    expect(metadata.attributes[1]).to.have.property("value");
    expect(metadata.attributes[1].value).to.equal("");
    expect(metadata.attributes[2]).to.have.property("trait_type");
    expect(metadata.attributes[2].trait_type).to.equal("Melee level");
    expect(metadata.attributes[2]).to.have.property("value");
    expect(metadata.attributes[2].value).to.equal(1);
    expect(metadata).to.have.property("external_url");
    expect(metadata.external_url).to.eq(`https://alpha.estfor.com/game/journal/${playerId}`);
  });

  it("external_url when not in alpha", async function () {
    const {
      adminAccess,
      brush,
      shop,
      royaltyReceiver,
      itemNFT,
      world,
      alice,
      playersImplProcessActions,
      playersImplQueueActions,
      playersImplRewards,
      playersImplMisc,
      Players,
      avatarInfo,
      avatarId,
      quests,
      clans,
    } = await loadFixture(deployContracts);

    // Confirm that external_url points to main estfor site
    const isAlpha = false;
    const EstforLibrary = await ethers.getContractFactory("EstforLibrary");
    const estforLibrary = await EstforLibrary.deploy();
    const PlayerNFT = await ethers.getContractFactory("PlayerNFT", {
      libraries: {EstforLibrary: estforLibrary.address},
    });
    const editNameBrushPrice = ethers.utils.parseEther("1");
    const imageBaseUri = "ipfs://";
    const playerNFTNotAlpha = (await upgrades.deployProxy(
      PlayerNFT,
      [
        brush.address,
        shop.address,
        royaltyReceiver.address,
        adminAccess.address,
        editNameBrushPrice,
        imageBaseUri,
        isAlpha,
      ],
      {
        kind: "uups",
        unsafeAllow: ["external-library-linking"],
      }
    )) as PlayerNFT;

    const players = await upgrades.deployProxy(
      Players,
      [
        itemNFT.address,
        playerNFTNotAlpha.address,
        world.address,
        adminAccess.address,
        quests.address,
        clans.address,
        playersImplQueueActions.address,
        playersImplProcessActions.address,
        playersImplRewards.address,
        playersImplMisc.address,
        isAlpha,
      ],
      {
        kind: "uups",
        unsafeAllow: ["delegatecall", "external-library-linking"],
      }
    );

    await itemNFT.setPlayers(players.address);
    await playerNFTNotAlpha.setPlayers(players.address);
    await playerNFTNotAlpha.setAvatars(avatarId, [avatarInfo]);

    const origName = "0xSamWitch";
    const makeActive = true;
    const playerId = await createPlayer(playerNFTNotAlpha, avatarId, alice, origName, makeActive);

    const uriNotAlpha = await playerNFTNotAlpha.uri(playerId);
    const metadataNotAlpha = JSON.parse(Buffer.from(uriNotAlpha.split(";base64,")[1], "base64").toString());
    expect(metadataNotAlpha.external_url).to.eq(`https://estfor.com/game/journal/${playerId}`);
  });

  describe("supportsInterface", async function () {
    it("IERC165", async function () {
      const {playerNFT} = await loadFixture(deployContracts);
      expect(await playerNFT.supportsInterface("0x01ffc9a7")).to.equal(true);
    });

    it("IERC1155", async function () {
      const {playerNFT} = await loadFixture(deployContracts);
      expect(await playerNFT.supportsInterface("0xd9b67a26")).to.equal(true);
    });

    it("IERC1155Metadata", async function () {
      const {playerNFT} = await loadFixture(deployContracts);
      expect(await playerNFT.supportsInterface("0x0e89341c")).to.equal(true);
    });

    it("IERC2981 royalties", async function () {
      const {playerNFT} = await loadFixture(deployContracts);
      expect(await playerNFT.supportsInterface("0x2a55205a")).to.equal(true);
    });
  });

  it("name & symbol", async function () {
    const {playerNFT, adminAccess, brush, shop, royaltyReceiver} = await loadFixture(deployContracts);
    expect(await playerNFT.name()).to.be.eq("Estfor Players (Alpha)");
    expect(await playerNFT.symbol()).to.be.eq("EK_PA");

    const isAlpha = false;
    // Create NFT contract which contains all the players
    const EstforLibrary = await ethers.getContractFactory("EstforLibrary");
    const estforLibrary = await EstforLibrary.deploy();
    const PlayerNFT = await ethers.getContractFactory("PlayerNFT", {
      libraries: {EstforLibrary: estforLibrary.address},
    });
    const editNameBrushPrice = ethers.utils.parseEther("1");
    const imageBaseUri = "ipfs://";
    const playerNFTNotAlpha = (await upgrades.deployProxy(
      PlayerNFT,
      [
        brush.address,
        shop.address,
        royaltyReceiver.address,
        adminAccess.address,
        editNameBrushPrice,
        imageBaseUri,
        isAlpha,
      ],
      {
        kind: "uups",
        unsafeAllow: ["external-library-linking"],
      }
    )) as PlayerNFT;

    expect(await playerNFTNotAlpha.name()).to.be.eq("Estfor Players");
    expect(await playerNFTNotAlpha.symbol()).to.be.eq("EK_P");
  });

  it("Check starting items", async function () {
    const {itemNFT, alice} = await loadFixture(deployContracts);

    const balances = await itemNFT.balanceOfs(alice.address, [
      EstforConstants.BRONZE_SWORD,
      EstforConstants.BRONZE_AXE,
      EstforConstants.MAGIC_FIRE_STARTER,
      EstforConstants.NET_STICK,
      EstforConstants.BRONZE_PICKAXE,
      EstforConstants.TOTEM_STAFF,
    ]);
    expect(balances).to.eql(balances.map(() => ethers.BigNumber.from("1")));
  });
});
