import * as fs from "fs/promises";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {
  createPlayer,
  exportPlayerNamesFilePath,
  generateUniqueBitPositions,
  playerNamesBitCount,
  playerNamesHashCount
} from "../scripts/utils";
import {PlayerNFT} from "../typechain-types";
import {playersFixture} from "./Players/PlayersFixture";
import {avatarIds, avatarInfos} from "../scripts/data/avatars";
import {Block, parseEther} from "ethers";
import {initializerSlot} from "./utils";
import {getPlayersHelper} from "./Players/utils";

describe("PlayerNFT", function () {
  async function deployContracts() {
    const baseFixture = await loadFixture(playersFixture);
    return {...baseFixture};
  }

  it("Check initialization params", async function () {
    const {brush, shop, dev, royaltyReceiver, estforLibrary, bridge} = await loadFixture(deployContracts);

    const playerNFT = await ethers.deployContract("PlayerNFT", {
      libraries: {EstforLibrary: await estforLibrary.getAddress()}
    });

    await ethers.provider.send("hardhat_setStorageAt", [
      await playerNFT.getAddress(),
      initializerSlot,
      ethers.ZeroHash
    ]);

    const startPlayerId = 1;
    const isBeta = false;
    const editNameBrushPrice = parseEther("1");
    const upgradePlayerBrushPrice = parseEther("2");
    const imageBaseUri = "ipfs://";

    await expect(
      playerNFT.initialize(
        await brush.getAddress(),
        await shop.getAddress(),
        dev.address,
        await royaltyReceiver.getAddress(),
        editNameBrushPrice,
        upgradePlayerBrushPrice,
        imageBaseUri,
        startPlayerId,
        isBeta,
        await bridge.getAddress()
      )
    )
      .to.emit(playerNFT, "EditNameCost")
      .withArgs(editNameBrushPrice)
      .and.to.emit(playerNFT, "UpgradePlayerCost")
      .withArgs(upgradePlayerBrushPrice);
  });

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

  it("Mint should not allow using a reserved hero name", async function () {
    const {playerNFT, alice} = await loadFixture(deployContracts);

    const reservedName = "Reserved Name";
    const secondReservedName = "Reserved Name 2";
    const unreservedName = "Unreserved Name";
    await playerNFT.addReservedHeroNames([reservedName]);

    const isProbablyReserved = await playerNFT.isHeroNameReserved(reservedName);
    expect(isProbablyReserved).to.be.true;

    const isNotReserved = await playerNFT.isHeroNameReserved(unreservedName);
    expect(isNotReserved).to.be.false;

    // should get custom error HeroNameIsReserved(name) if name is reserved
    await expect(createPlayer(playerNFT, 1, alice, reservedName, true)).to.be.revertedWithCustomError(
      playerNFT,
      "HeroNameIsReserved"
    );

    const isSecondNameReserved1 = await playerNFT.isHeroNameReserved(secondReservedName);
    expect(isSecondNameReserved1).to.be.false;

    // if we have exported a list of reserved names, we can use them to generate bit positions
    const fileExists = await fs
      .access(exportPlayerNamesFilePath)
      .then(() => true)
      .catch(() => false);
    const reservedNames = fileExists ? (await fs.readFile(exportPlayerNamesFilePath, "utf-8")).split("\n") : [];
    const firstReservedName = reservedNames.length > 0 ? reservedNames[0] : reservedName;

    // but for tests we are going to use a small list
    reservedNames.push(firstReservedName);
    reservedNames.push(secondReservedName);

    const gasPrices = [];
    `Using hash count: ${playerNamesHashCount} and bit count: ${playerNamesBitCount}`;
    const positions = await generateUniqueBitPositions(reservedNames, playerNamesHashCount, playerNamesBitCount);
    console.log(`Generated ${positions.length} bit positions`);
    const batchSize = Math.min(Math.max(Math.floor(positions.length / 150), 500), 5000);
    for (let i = 0; i < positions.length; i += batchSize) {
      const batch = positions.slice(i, i + batchSize);
      const gas = await playerNFT.setReservedNameBits.estimateGas(batch);
      gasPrices.push(gas);
      // console.log(`Gas estimate for batch ${i / batchSize + 1}/${Math.ceil(positions.length / batchSize)}: ${gas}`);
      const tx = await playerNFT.setReservedNameBits(batch);
      await tx.wait();
    }

    const averageGasPrice = gasPrices.reduce((a, b) => a + b, 0n) / BigInt(gasPrices.length);
    console.log(
      `Average gas price for ${gasPrices.length} txns: ${averageGasPrice}, ${
        averageGasPrice * BigInt(gasPrices.length)
      } total`
    );

    const FALSE_POSITIVE_CHECKS = 20000;
    let falsePositives = 0;
    for (let i = 0; i < FALSE_POSITIVE_CHECKS && i < reservedNames.length; i++) {
      const randomIndex = Math.floor(Math.random() * reservedNames.length);
      const name = reservedNames.splice(randomIndex, 1)[0];
      const isReserved = await playerNFT.isHeroNameReserved(name);
      // console.log(`Name: ${name}, Reserved: ${isReserved}`);
      expect(isReserved).to.be.true;

      const rndm = Math.floor(Math.random() * 100);
      const notReservedName = "xxx" + name + "xxx" + rndm;
      const shouldNotBeReserved = await playerNFT.isHeroNameReserved(notReservedName);
      // console.log(`Name: ${notReservedName}, Reserved: ${shouldNotBeReserved}`);
      if (shouldNotBeReserved) {
        falsePositives++;
      }
    }
    const falsePositiveRate = Math.round((falsePositives / FALSE_POSITIVE_CHECKS) * 100);
    console.log(`False positives: ${falsePositives}/${FALSE_POSITIVE_CHECKS} for ${falsePositiveRate}%`);
    expect(falsePositiveRate).to.be.lessThan(2);

    // this should work
    await createPlayer(playerNFT, 1, alice, unreservedName, true);
  });

  it("Mint a standard player", async function () {
    const {playerNFT, alice} = await loadFixture(deployContracts);

    const name = "A123";
    const avatarId = 1;
    const makeActive = true;
    await ethers.provider.send("evm_mine", []);
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    const playerId = await createPlayer(playerNFT, avatarId, alice, name, makeActive);

    // Check avatar ids are as expected
    expect((await playerNFT.getPlayerInfo(playerId)).avatarId).to.eq(1);
    expect((await playerNFT.getPlayerInfo(playerId)).originalAvatarId).to.eq(1);
    expect((await playerNFT.getPlayerInfo(playerId)).mintedTimestamp).to.eq(NOW + 1);
    expect((await playerNFT.getPlayerInfo(playerId)).upgradedTimestamp).to.eq(0);
  });

  it("Minting with an upgrade should cost brush", async function () {
    const {playerNFT, players, alice, brush, upgradePlayerBrushPrice} = await loadFixture(deployContracts);
    const brushAmount = upgradePlayerBrushPrice;
    await brush.connect(alice).approve(playerNFT, brushAmount);
    await brush.mint(alice, brushAmount);

    const discord = "";
    const twitter = "1231231";
    const telegram = "";
    const avatarId = 1;
    const makeActive = true;
    const newPlayerId = await createPlayer(
      playerNFT,
      avatarId,
      alice,
      "name",
      makeActive,
      discord,
      twitter,
      telegram,
      true
    );
    expect(await brush.balanceOf(alice)).to.eq(0);

    // Check upgraded flag
    const player = await (await getPlayersHelper(players)).getPlayer(newPlayerId);
    expect(player.packedData == "0x80");
  });

  it("Edit Name", async function () {
    const {playerId, playerNFT, alice, brush, origName, editNameBrushPrice} = await loadFixture(deployContracts);
    const name = "My name is edited";
    await brush.connect(alice).approve(playerNFT, editNameBrushPrice * 3n);

    const discord = "";
    const twitter = "";
    const telegram = "";
    await expect(
      playerNFT.connect(alice).editPlayer(playerId, name, discord, twitter, telegram, false)
    ).to.be.revertedWithCustomError(brush, "ERC20InsufficientBalance");
    await brush.mint(alice, editNameBrushPrice * 3n);

    await expect(playerNFT.editPlayer(playerId, name, discord, twitter, telegram, false)).to.be.revertedWithCustomError(
      playerNFT,
      "NotOwnerOfPlayer"
    );
    expect(await playerNFT.hasLowercaseName(origName.toLowerCase())).to.be.true;

    await playerNFT.connect(alice).editPlayer(playerId, name, discord, twitter, telegram, false);
    expect(await playerNFT.hasLowercaseName(origName.toLowerCase())).to.be.false; // Should be deleted now
    expect(await playerNFT.getName(playerId)).to.eq(name);

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
      .to.emit(playerNFT, "EditPlayer")
      .withArgs(playerId, alice, origName, 0, discord, twitter, telegram, false);

    // Name changed should be true if name changed
    await brush.connect(alice).approve(playerNFT, editNameBrushPrice);
    await brush.mint(alice, editNameBrushPrice);
    const newName = "New name";
    await expect(playerNFT.connect(alice).editPlayer(playerId, newName, discord, twitter, telegram, false))
      .to.emit(playerNFT, "EditPlayer")
      .withArgs(playerId, alice, newName, editNameBrushPrice, discord, twitter, telegram, false);
  });

  it("Editing upgrade player should cost brush", async function () {
    const {playerId, playerNFT, players, alice, brush, dev, treasury, editNameBrushPrice, upgradePlayerBrushPrice} =
      await loadFixture(deployContracts);
    const discord = "";
    const twitter = "1231231";
    const telegram = "";

    const brushAmount = editNameBrushPrice + upgradePlayerBrushPrice * 2n;
    await brush.connect(alice).approve(playerNFT, brushAmount);
    await brush.mint(alice, brushAmount);

    const prevMintedTimestamp = (await playerNFT.getPlayerInfo(playerId)).mintedTimestamp;
    expect(prevMintedTimestamp).to.not.eq(0);

    const newName = "new name";
    await expect(playerNFT.connect(alice).editPlayer(playerId, newName, discord, twitter, telegram, true))
      .to.emit(playerNFT, "EditPlayer")
      .withArgs(playerId, alice, newName, editNameBrushPrice, discord, twitter, telegram, true)
      .and.to.emit(playerNFT, "UpgradePlayerAvatar")
      .withArgs(playerId, 10001, upgradePlayerBrushPrice);
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;

    expect(await brush.balanceOf(alice)).to.eq(brushAmount - (editNameBrushPrice + upgradePlayerBrushPrice));

    // 25% goes to the dev address, 25% burned & 50% goes to the treasury for player upgrades & editing name.
    expect(await brush.balanceOf(dev)).to.eq(upgradePlayerBrushPrice / 4n + editNameBrushPrice / 4n);
    expect(await brush.balanceOf(treasury)).to.eq(upgradePlayerBrushPrice / 2n + editNameBrushPrice / 2n);

    // Check upgraded flag
    const player = await (await getPlayersHelper(players)).getPlayer(playerId);
    expect(player.packedData == "0x80");

    // Upgrading should fail the second time
    await expect(
      playerNFT.connect(alice).editPlayer(playerId, newName, discord, twitter, telegram, true)
    ).to.be.revertedWithCustomError(players, "AlreadyUpgraded");

    // Check avatar ids are as expected
    expect((await playerNFT.getPlayerInfo(playerId)).avatarId).to.eq(10001);
    expect((await playerNFT.getPlayerInfo(playerId)).originalAvatarId).to.eq(1);
    expect((await playerNFT.getPlayerInfo(playerId)).mintedTimestamp).to.eq(prevMintedTimestamp);
    expect((await playerNFT.getPlayerInfo(playerId)).upgradedTimestamp).to.eq(NOW);
  });

  it("Upgrading from mint should cost brush", async function () {
    const {
      playerId: prevPlayerId,
      playerNFT,
      players,
      alice,
      dev,
      treasury,
      brush,
      upgradePlayerBrushPrice
    } = await loadFixture(deployContracts);
    const discord = "";
    const twitter = "1231231";
    const telegram = "";

    const brushAmount = upgradePlayerBrushPrice;
    await brush.connect(alice).approve(playerNFT, brushAmount);
    await brush.mint(alice, brushAmount);

    const upgrade = true;
    const playerId = prevPlayerId + 1n;
    await expect(playerNFT.connect(alice).mint(1, "name", discord, twitter, telegram, upgrade, true))
      .to.emit(playerNFT, "NewPlayer")
      .withArgs(playerId, 1, "name", alice, discord, twitter, telegram, true)
      .and.to.emit(playerNFT, "UpgradePlayerAvatar")
      .withArgs(playerId, 10001, upgradePlayerBrushPrice);
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;

    expect(await brush.balanceOf(alice)).to.eq(0);

    // 25% goes to the dev address, 25% burned & 50% goes to the treasury for player upgrades & editing name.
    expect(await brush.balanceOf(dev)).to.eq(upgradePlayerBrushPrice / 4n);
    expect(await brush.balanceOf(treasury)).to.eq(upgradePlayerBrushPrice / 2n);

    // Check upgraded flag
    const player = await (await getPlayersHelper(players)).getPlayer(playerId);
    expect(player.packedData == "0x80");

    // Check avatar ids are as expected
    expect((await playerNFT.getPlayerInfo(playerId)).avatarId).to.eq(10001);
    expect((await playerNFT.getPlayerInfo(playerId)).originalAvatarId).to.eq(1);
    expect((await playerNFT.getPlayerInfo(playerId)).mintedTimestamp).to.eq(NOW);
    expect((await playerNFT.getPlayerInfo(playerId)).upgradedTimestamp).to.eq(NOW);
  });

  it("uri", async function () {
    const {playerId, playerNFT, avatarInfo, origName} = await loadFixture(deployContracts);
    const uri = await playerNFT.uri(playerId);

    expect(uri.startsWith("data:application/json;base64")).to.be.true;
    const metadata = JSON.parse(Buffer.from(uri.split(";base64,")[1], "base64").toString());
    expect(metadata).to.have.property("name");
    expect(metadata.name.startsWith(origName)).to.be.true;
    expect(metadata.name.endsWith(` (21)`)).to.be.true;
    expect(metadata.image).to.eq(`ipfs://${avatarInfo.imageURI}`);
    expect(metadata).to.have.property("attributes");
    expect(metadata.attributes).to.be.an("array");
    expect(metadata.attributes).to.have.length(21);
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
    expect(metadata.attributes[18].trait_type).to.equal("Forging level");
    expect(metadata.attributes[18]).to.have.property("value");
    expect(metadata.attributes[18].value).to.equal(1);
    expect(metadata.attributes[19].trait_type).to.equal("Farming level");
    expect(metadata.attributes[19]).to.have.property("value");
    expect(metadata.attributes[19].value).to.equal(1);
    expect(metadata.attributes[20].trait_type).to.equal("Total level");
    expect(metadata.attributes[20]).to.have.property("value");
    expect(metadata.attributes[20].value).to.equal(21);
    expect(metadata).to.have.property("external_url");
    expect(metadata.external_url).to.eq(`https://beta.estfor.com/journal/${playerId}`);
  });

  it("Mint non-existent avatar", async function () {
    const {playerNFT, alice} = await loadFixture(deployContracts);

    const incorrectAvatarId = 500;
    await expect(createPlayer(playerNFT, incorrectAvatarId, alice, "New name", true)).to.be.revertedWithCustomError(
      playerNFT,
      "BaseAvatarNotExists"
    );
  });

  it("Cannot mint non-base avatar", async function () {
    const {playerNFT, alice} = await loadFixture(deployContracts);
    await expect(playerNFT.setAvatars(avatarIds, avatarInfos)).to.emit(playerNFT, "SetAvatars");

    // Cannot use it on an evolved avatar, only the base
    await expect(createPlayer(playerNFT, 10001, alice, "New name", true)).to.be.revertedWithCustomError(
      playerNFT,
      "BaseAvatarNotExists"
    );
  });

  it("external_url when not in beta", async function () {
    const {
      adminAccess,
      brush,
      shop,
      dev,
      royaltyReceiver,
      itemNFT,
      worldActions,
      randomnessBeacon,
      dailyRewardsScheduler,
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
      petNFT,
      estforLibrary,
      bridge,
      activityPoints
    } = await loadFixture(deployContracts);

    // Confirm that external_url points to main estfor site
    const startPlayerId = 1;
    const isBeta = false;
    const PlayerNFT = await ethers.getContractFactory("PlayerNFT", {
      libraries: {EstforLibrary: await estforLibrary.getAddress()}
    });
    const editNameBrushPrice = parseEther("1");
    const upgradePlayerBrushPrice = parseEther("2");
    const imageBaseUri = "ipfs://";
    const playerNFTNotBeta = (await upgrades.deployProxy(
      PlayerNFT,
      [
        await brush.getAddress(),
        await shop.getAddress(),
        dev.address,
        await royaltyReceiver.getAddress(),
        editNameBrushPrice,
        upgradePlayerBrushPrice,
        imageBaseUri,
        startPlayerId,
        isBeta,
        await bridge.getAddress()
      ],
      {
        kind: "uups",
        unsafeAllow: ["external-library-linking"]
      }
    )) as unknown as PlayerNFT;

    const players = await upgrades.deployProxy(
      Players,
      [
        await itemNFT.getAddress(),
        await playerNFTNotBeta.getAddress(),
        await petNFT.getAddress(),
        await worldActions.getAddress(),
        await randomnessBeacon.getAddress(),
        await dailyRewardsScheduler.getAddress(),
        await adminAccess.getAddress(),
        await quests.getAddress(),
        await clans.getAddress(),
        await wishingWell.getAddress(),
        await playersImplQueueActions.getAddress(),
        await playersImplProcessActions.getAddress(),
        await playersImplRewards.getAddress(),
        await playersImplMisc.getAddress(),
        await playersImplMisc1.getAddress(),
        await bridge.getAddress(),
        await activityPoints.getAddress(),
        isBeta
      ],
      {
        kind: "uups",
        unsafeAllow: ["delegatecall"]
      }
    );

    await players.setActivityPoints(await activityPoints.getAddress());
    await activityPoints.addCallers([await players.getAddress()]);

    await itemNFT.initializeAddresses(bankFactory, players);
    await itemNFT.setApproved([shop, players, activityPoints], true);

    await playerNFTNotBeta.setPlayers(await players.getAddress());
    await playerNFTNotBeta.setAvatars([avatarId], [avatarInfo]);

    const origName = "0xSamWitch";
    const makeActive = true;
    const playerId = await createPlayer(playerNFTNotBeta, avatarId, alice, origName, makeActive);

    const uriNotBeta = await playerNFTNotBeta.uri(playerId);
    const metadataNotBeta = JSON.parse(Buffer.from(uriNotBeta.split(";base64,")[1], "base64").toString());
    expect(metadataNotBeta.external_url).to.eq(`https://estfor.com/journal/${playerId}`);
  });

  describe("supportsInterface", async function () {
    it("IERC165", async function () {
      const {playerNFT} = await loadFixture(deployContracts);
      expect(await playerNFT.supportsInterface("0x01ffc9a7")).to.be.true;
    });

    it("IERC1155", async function () {
      const {playerNFT} = await loadFixture(deployContracts);
      expect(await playerNFT.supportsInterface("0xd9b67a26")).to.be.true;
    });

    it("IERC1155Metadata", async function () {
      const {playerNFT} = await loadFixture(deployContracts);
      expect(await playerNFT.supportsInterface("0x0e89341c")).to.be.true;
    });

    it("IERC2981 royalties", async function () {
      const {playerNFT} = await loadFixture(deployContracts);
      expect(await playerNFT.supportsInterface("0x2a55205a")).to.be.true;
    });
  });

  it("name & symbol", async function () {
    const {playerNFT, brush, shop, dev, royaltyReceiver, estforLibrary, bridge} = await loadFixture(deployContracts);
    expect(await playerNFT.name()).to.be.eq("Estfor Players (Beta)");
    expect(await playerNFT.symbol()).to.be.eq("EK_PB");

    const startPlayerId = 1;
    const isBeta = false;
    // Create NFT contract which contains all the players
    const PlayerNFT = await ethers.getContractFactory("PlayerNFT", {
      libraries: {EstforLibrary: await estforLibrary.getAddress()}
    });
    const editNameBrushPrice = parseEther("1");
    const upgradePlayerBrushPrice = parseEther("2");

    const imageBaseUri = "ipfs://";
    const playerNFTNotBeta = (await upgrades.deployProxy(
      PlayerNFT,
      [
        await brush.getAddress(),
        await shop.getAddress(),
        dev.address,
        await royaltyReceiver.getAddress(),
        editNameBrushPrice,
        upgradePlayerBrushPrice,
        imageBaseUri,
        startPlayerId,
        isBeta,
        await bridge.getAddress()
      ],
      {
        kind: "uups",
        unsafeAllow: ["external-library-linking"]
      }
    )) as unknown as PlayerNFT;

    expect(await playerNFTNotBeta.name()).to.be.eq("Estfor Players");
    expect(await playerNFTNotBeta.symbol()).to.be.eq("EK_P");
  });

  it("Check starting items", async function () {
    const {itemNFT, alice} = await loadFixture(deployContracts);

    const balances = await itemNFT.balanceOfs(alice, [
      EstforConstants.BRONZE_SWORD,
      EstforConstants.BRONZE_AXE,
      EstforConstants.MAGIC_FIRE_STARTER,
      EstforConstants.NET_STICK,
      EstforConstants.BRONZE_PICKAXE,
      EstforConstants.TOTEM_STAFF,
      EstforConstants.BASIC_BOW
    ]);
    expect(balances).to.eql(balances.map(() => 1n));
  });

  it("totalSupply", async function () {
    const {playerNFT, owner, alice} = await loadFixture(deployContracts);

    expect(await playerNFT["totalSupply()"]()).to.be.eq(1);
    await createPlayer(playerNFT, 1, owner, "name1", true);
    expect(await playerNFT["totalSupply()"]()).to.be.eq(2);
    expect(await playerNFT["totalSupply(uint256)"](1)).to.be.eq(1);
    expect(await playerNFT["totalSupply(uint256)"](2)).to.be.eq(1);
    await playerNFT.connect(alice).burn(alice, 1);
    expect(await playerNFT["totalSupply()"]()).to.be.eq(1);
    await playerNFT.burn(owner, 2);
    expect(await playerNFT["totalSupply()"]()).to.be.eq(0);
  });
});
