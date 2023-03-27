import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {whitelistedAdmins, whitelistedSnapshot} from "@paintswap/estfor-definitions/constants";
import {Skill} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {MerkleTreeWhitelist} from "../scripts/MerkleTreeWhitelist";
import {AvatarInfo} from "../scripts/utils";

describe("AlphaWhitelist", function () {
  async function deployContracts() {
    const [owner, alice] = await ethers.getSigners();

    const MockBrushToken = await ethers.getContractFactory("MockBrushToken");
    const brush = await MockBrushToken.deploy();

    const MockOracleClient = await ethers.getContractFactory("MockOracleClient");
    const mockOracleClient = await MockOracleClient.deploy();

    // Add some dummy blocks so that world can access previous blocks for random numbers
    for (let i = 0; i < 5; ++i) {
      await owner.sendTransaction({
        to: owner.address,
        value: 1,
      });
    }

    // Create the world
    const subscriptionId = 2;
    const World = await ethers.getContractFactory("World");
    const world = await upgrades.deployProxy(World, [mockOracleClient.address, subscriptionId], {
      kind: "uups",
    });

    const Shop = await ethers.getContractFactory("Shop");
    const shop = await upgrades.deployProxy(Shop, [brush.address], {
      kind: "uups",
    });

    const buyPath: [string, string] = [alice.address, brush.address];
    const MockRouter = await ethers.getContractFactory("MockRouter");
    const router = await MockRouter.deploy();
    const RoyaltyReceiver = await ethers.getContractFactory("RoyaltyReceiver");
    const royaltyReceiver = await upgrades.deployProxy(
      RoyaltyReceiver,
      [router.address, shop.address, brush.address, buyPath],
      {
        kind: "uups",
      }
    );
    await royaltyReceiver.deployed();

    const admins = [owner.address];
    const AdminAccess = await ethers.getContractFactory("AdminAccess");
    const adminAccess = await upgrades.deployProxy(AdminAccess, [admins], {
      kind: "uups",
    });
    await adminAccess.deployed();

    const isAlpha = true;
    // Create NFT contract which contains all items
    const ItemNFT = await ethers.getContractFactory("ItemNFT");
    const itemsUri = "ipfs://";
    const itemNFT = await upgrades.deployProxy(
      ItemNFT,
      [world.address, shop.address, royaltyReceiver.address, adminAccess.address, itemsUri, isAlpha],
      {
        kind: "uups",
      }
    );

    await shop.setItemNFT(itemNFT.address);
    // Create NFT contract which contains all the players
    const PlayerNFT = await ethers.getContractFactory("PlayerNFT");
    const editNameBrushPrice = ethers.utils.parseEther("1");
    const imageBaseUri = "ipfs://";
    const playerNFT = await upgrades.deployProxy(
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
      {kind: "uups"}
    );

    // This contains all the player data
    const PlayersLibrary = await ethers.getContractFactory("PlayersLibrary");
    const playerLibrary = await PlayersLibrary.deploy();

    const PlayersImplQueueActions = await ethers.getContractFactory("PlayersImplQueueActions");
    const playersImplQueueActions = await PlayersImplQueueActions.deploy();

    const PlayersImplProcessActions = await ethers.getContractFactory("PlayersImplProcessActions", {
      libraries: {PlayersLibrary: playerLibrary.address},
    });
    const playersImplProcessActions = await PlayersImplProcessActions.deploy();

    const PlayersImplRewards = await ethers.getContractFactory("PlayersImplRewards", {
      libraries: {PlayersLibrary: playerLibrary.address},
    });
    const playersImplRewards = await PlayersImplRewards.deploy();

    const Players = await ethers.getContractFactory("Players", {
      libraries: {PlayersLibrary: playerLibrary.address},
    });

    const players = await upgrades.deployProxy(
      Players,
      [
        itemNFT.address,
        playerNFT.address,
        world.address,
        adminAccess.address,
        playersImplQueueActions.address,
        playersImplProcessActions.address,
        playersImplRewards.address,
        isAlpha,
      ],
      {
        kind: "uups",
        unsafeAllow: ["delegatecall", "external-library-linking"],
      }
    );

    await itemNFT.setPlayers(players.address);
    await playerNFT.setPlayers(players.address);

    return {owner, playerNFT, alice};
  }

  it("Merkle proof minting", async function () {
    const {owner, playerNFT, alice} = await loadFixture(deployContracts);

    const whitelistAddresses = [
      "0xa801864d0D24686B15682261aa05D4e1e6e5BD94",
      "0xBa00694692267ed0B5154d48Fcb4D435D0B24d3F",
      owner.address,
    ];

    const treeWhitelist = new MerkleTreeWhitelist(whitelistAddresses);
    const root = treeWhitelist.getRoot();
    await playerNFT.setMerkleRoot(root);
    const proof = treeWhitelist.getProof(owner.address);
    expect(await playerNFT.checkInWhitelist(proof)).to.be.true;
    expect(await playerNFT.connect(alice).checkInWhitelist(proof)).to.be.false;

    const avatarId = 1;
    const avatarInfo: AvatarInfo = {
      name: ethers.utils.formatBytes32String("Name goes here"),
      description: "Hi I'm a description",
      imageURI: "1234.png",
      startSkills: [Skill.NONE, Skill.NONE],
    };
    await playerNFT.setAvatar(avatarId, avatarInfo);

    const maxMints = await playerNFT.MAX_ALPHA_WHITELIST();
    for (let i = 0; i < maxMints.toNumber(); ++i) {
      const name = ethers.utils.formatBytes32String(`name${i}`);
      await playerNFT.mintWhitelist(1, name, true, proof);
    }

    const newName = ethers.utils.formatBytes32String("Cheesy poofs");
    await expect(playerNFT.mintWhitelist(1, newName, true, proof)).to.be.revertedWithCustomError(
      playerNFT,
      "MintedMoreThanAllowed"
    );
    await expect(playerNFT.connect(alice).mintWhitelist(1, newName, true, proof)).to.be.revertedWithCustomError(
      playerNFT,
      "NotInWhitelist"
    );
  });

  it("Read from library", async function () {
    expect(whitelistedSnapshot.find((el) => el == "0x003c06a6168e9d2474e2c7f588d819b75f8025e5")).to.not.be.undefined;
    expect(whitelistedAdmins.find((el) => el == "0x316342122a9ae36de41b231260579b92f4c8be7f")).to.not.be.undefined;
  });
});
