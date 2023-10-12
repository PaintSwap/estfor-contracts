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

    const discord = "";
    const twitter = "";
    const telegram = "";
    await expect(
      playerNFT.connect(alice).editPlayer(playerId, name, discord, twitter, telegram, false)
    ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    await brush.mint(alice.address, editNameBrushPrice.mul(3));

    await expect(playerNFT.editPlayer(playerId, name, discord, twitter, telegram, false)).to.be.revertedWithCustomError(
      playerNFT,
      "NotOwnerOfPlayer"
    );
    expect(await playerNFT.lowercaseNames(origName.toLowerCase())).to.be.true;

    await playerNFT.connect(alice).editPlayer(playerId, name, discord, twitter, telegram, false);
    expect(await playerNFT.lowercaseNames(origName.toLowerCase())).to.be.false; // Should be deleted now
    expect(await playerNFT.names(playerId)).to.eq(name);

    const avatarId = 1;
    const makeActive = true;
    // Duplicate
    const newPlayerId = await createPlayer(playerNFT, avatarId, alice, "name", makeActive);
    await expect(
      playerNFT.connect(alice).editPlayer(newPlayerId, name, discord, twitter, telegram, false)
    ).to.be.revertedWithCustomError(playerNFT, "NameAlreadyExists");
  });

  it("Edit Socials (no charge if name does not change)", async function () {
    const {playerId, playerNFT, alice, brush, origName, editNameBrushPrice} = await loadFixture(deployContracts);
    const discord = "";
    const twitter = "1231231";
    const telegram = "";
    await expect(playerNFT.connect(alice).editPlayer(playerId, origName, discord, twitter, telegram, false))
      .to.emit(playerNFT, "EditPlayerV2")
      .withArgs(playerId, origName, 0, discord, twitter, telegram, false);

    // Name changed should be true if name changed
    await brush.connect(alice).approve(playerNFT.address, editNameBrushPrice);
    await brush.mint(alice.address, editNameBrushPrice);
    const newName = "New name";
    await expect(playerNFT.connect(alice).editPlayer(playerId, newName, discord, twitter, telegram, false))
      .to.emit(playerNFT, "EditPlayerV2")
      .withArgs(playerId, newName, editNameBrushPrice, discord, twitter, telegram, false);
  });

  it("Editing upgrade player should cost brush", async function () {
    const {playerId, playerNFT, players, alice, brush, editNameBrushPrice, upgradePlayerBrushPrice} = await loadFixture(
      deployContracts
    );
    const discord = "";
    const twitter = "1231231";
    const telegram = "";

    const brushAmount = editNameBrushPrice.add(upgradePlayerBrushPrice.mul(2));
    await brush.connect(alice).approve(playerNFT.address, brushAmount);
    await brush.mint(alice.address, brushAmount);

    const amountPaid = editNameBrushPrice.add(upgradePlayerBrushPrice);
    const newName = "new name";
    await expect(playerNFT.connect(alice).editPlayer(playerId, newName, discord, twitter, telegram, true))
      .to.emit(playerNFT, "EditPlayerV2")
      .withArgs(playerId, newName, amountPaid, discord, twitter, telegram, true);

    expect(await brush.balanceOf(alice.address)).to.eq(brushAmount.sub(amountPaid));

    // Check upgraded flag
    const player = await players.players(playerId);
    expect(player.packedData == "0x80");

    // Upgrading should fail the second time
    await expect(
      playerNFT.connect(alice).editPlayer(playerId, newName, discord, twitter, telegram, true)
    ).to.be.revertedWithCustomError(players, "AlreadyUpgraded");
  });

  it("Upgrading from mint should cost brush", async function () {
    const {playerId, playerNFT, players, alice, brush, upgradePlayerBrushPrice} = await loadFixture(deployContracts);
    const discord = "";
    const twitter = "1231231";
    const telegram = "";

    const brushAmount = upgradePlayerBrushPrice;
    await brush.connect(alice).approve(playerNFT.address, brushAmount);
    await brush.mint(alice.address, brushAmount);

    const upgrade = true;
    await expect(playerNFT.connect(alice).mintTODOPaint(1, "name", discord, twitter, telegram, upgrade, true))
      .to.emit(playerNFT, "NewPlayerV2")
      .withArgs(playerId.add(1), 1, "name", alice.address, discord, twitter, telegram, brushAmount, true);

    expect(await brush.balanceOf(alice.address)).to.eq(0);
    // Check upgraded flag
    const player = await players.players(playerId.add(1));
    expect(player.packedData == "0x80");
  });

  it("uri", async function () {
    const {playerId, playerNFT, avatarInfo, origName} = await loadFixture(deployContracts);
    const uri = await playerNFT.uri(playerId);

    expect(uri.startsWith("data:application/json;base64")).to.be.true;
    const metadata = JSON.parse(Buffer.from(uri.split(";base64,")[1], "base64").toString());
    expect(metadata).to.have.property("name");
    expect(metadata.name.startsWith(origName));
    expect(metadata.name.endsWith(` (15)`));
    expect(metadata.image).to.eq(`ipfs://${avatarInfo.imageURI}`);
    expect(metadata).to.have.property("attributes");
    expect(metadata.attributes).to.be.an("array");
    expect(metadata.attributes).to.have.length(19);
    expect(metadata.attributes[0]).to.have.property("trait_type");
    expect(metadata.attributes[0].trait_type).to.equal("Avatar");
    expect(metadata.attributes[0]).to.have.property("value");
    expect(metadata.attributes[0].value).to.equal("Name goes here");
    expect(metadata.attributes[1]).to.have.property("trait_type");
    expect(metadata.attributes[1].trait_type).to.equal("Clan");
    expect(metadata.attributes[1]).to.have.property("value");
    expect(metadata.attributes[1].value).to.equal("");
    expect(metadata.attributes[2]).to.have.property("trait_type");
    expect(metadata.attributes[2].trait_type).to.equal("Full version");
    expect(metadata.attributes[2]).to.have.property("value");
    expect(metadata.attributes[2].value).to.equal("false");
    expect(metadata.attributes[3]).to.have.property("trait_type");
    expect(metadata.attributes[3].trait_type).to.equal("Melee level");
    expect(metadata.attributes[3]).to.have.property("value");
    expect(metadata.attributes[3].value).to.equal(1);
    expect(metadata).to.have.property("external_url");
    expect(metadata.external_url).to.eq(`https://beta.estfor.com/game/journal/${playerId}`);
  });

  it("external_url when not in beta", async function () {
    const {
      adminAccess,
      brush,
      shop,
      dev,
      royaltyReceiver,
      itemNFT,
      world,
      alice,
      playersImplProcessActions,
      playersImplQueueActions,
      playersImplRewards,
      playersImplMisc,
      playersImplMisc1,
      Players,
      avatarInfo,
      avatarId,
      quests,
      clans,
      wishingWell,
      bankFactory,
    } = await loadFixture(deployContracts);

    // Confirm that external_url points to main estfor site
    const isBeta = false;
    const EstforLibrary = await ethers.getContractFactory("EstforLibrary");
    const estforLibrary = await EstforLibrary.deploy();
    const PlayerNFT = await ethers.getContractFactory("PlayerNFT", {
      libraries: {EstforLibrary: estforLibrary.address},
    });
    const editNameBrushPrice = ethers.utils.parseEther("1");
    const upgradePlayerBrushPrice = ethers.utils.parseEther("2");
    const imageBaseUri = "ipfs://";
    const playerNFTNotBeta = (await upgrades.deployProxy(
      PlayerNFT,
      [
        brush.address,
        shop.address,
        dev.address,
        royaltyReceiver.address,
        adminAccess.address,
        editNameBrushPrice,
        upgradePlayerBrushPrice,
        imageBaseUri,
        isBeta,
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
        playerNFTNotBeta.address,
        world.address,
        adminAccess.address,
        quests.address,
        clans.address,
        wishingWell.address,
        playersImplQueueActions.address,
        playersImplProcessActions.address,
        playersImplRewards.address,
        playersImplMisc.address,
        playersImplMisc1.address,
        isBeta,
      ],
      {
        kind: "uups",
        unsafeAllow: ["delegatecall", "external-library-linking"],
      }
    );

    await itemNFT.setPlayers(players.address);
    await itemNFT.setBankFactory(bankFactory.address);
    await itemNFT.setPromotions(players.address);
    await playerNFTNotBeta.setPlayers(players.address);
    await playerNFTNotBeta.setAvatars(avatarId, [avatarInfo]);

    const origName = "0xSamWitch";
    const makeActive = true;
    const playerId = await createPlayer(playerNFTNotBeta, avatarId, alice, origName, makeActive);

    const uriNotBeta = await playerNFTNotBeta.uri(playerId);
    const metadataNotBeta = JSON.parse(Buffer.from(uriNotBeta.split(";base64,")[1], "base64").toString());
    expect(metadataNotBeta.external_url).to.eq(`https://estfor.com/game/journal/${playerId}`);
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
    const {playerNFT, adminAccess, brush, shop, dev, royaltyReceiver} = await loadFixture(deployContracts);
    expect(await playerNFT.name()).to.be.eq("Estfor Players (Beta)");
    expect(await playerNFT.symbol()).to.be.eq("EK_PB");

    const isBeta = false;
    // Create NFT contract which contains all the players
    const EstforLibrary = await ethers.getContractFactory("EstforLibrary");
    const estforLibrary = await EstforLibrary.deploy();
    const PlayerNFT = await ethers.getContractFactory("PlayerNFT", {
      libraries: {EstforLibrary: estforLibrary.address},
    });
    const editNameBrushPrice = ethers.utils.parseEther("1");
    const upgradePlayerBrushPrice = ethers.utils.parseEther("2");

    const imageBaseUri = "ipfs://";
    const playerNFTNotBeta = (await upgrades.deployProxy(
      PlayerNFT,
      [
        brush.address,
        shop.address,
        dev.address,
        royaltyReceiver.address,
        adminAccess.address,
        editNameBrushPrice,
        upgradePlayerBrushPrice,
        imageBaseUri,
        isBeta,
      ],
      {
        kind: "uups",
        unsafeAllow: ["external-library-linking"],
      }
    )) as PlayerNFT;

    expect(await playerNFTNotBeta.name()).to.be.eq("Estfor Players");
    expect(await playerNFTNotBeta.symbol()).to.be.eq("EK_P");
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
      EstforConstants.BASIC_BOW,
    ]);
    expect(balances).to.eql(balances.map(() => ethers.BigNumber.from("1")));
  });

  it("totalSupply", async function () {
    const {playerNFT, owner, alice} = await loadFixture(deployContracts);

    expect(await playerNFT["totalSupply()"]()).to.be.eq(1);
    await createPlayer(playerNFT, 1, owner, "name1", true);
    expect(await playerNFT["totalSupply()"]()).to.be.eq(2);
    await playerNFT.connect(alice).burn(alice.address, 1);
    expect(await playerNFT["totalSupply()"]()).to.be.eq(1);
    await playerNFT.burn(owner.address, 2);
    expect(await playerNFT["totalSupply()"]()).to.be.eq(0);
  });
});
