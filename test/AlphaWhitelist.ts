import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {MerkleTreeWhitelist} from "../scripts/MerkleTreeWhitelist";

describe("AlphaWhitelist", () => {
  it("Merkle proof minting", async () => {
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

    const Players = await ethers.getContractFactory("Players", {
      libraries: {PlayerLibrary: playerLibrary.address},
    });

    const players = await upgrades.deployProxy(Players, [itemNFT.address, playerNFT.address, world.address], {
      kind: "uups",
      unsafeAllow: ["delegatecall", "external-library-linking"],
    });

    await itemNFT.setPlayers(players.address);
    await playerNFT.setPlayers(players.address);

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
    const name = ethers.utils.formatBytes32String("name");

    const avatarId = 1;
    const avatarInfo = {
      name: ethers.utils.formatBytes32String("Name goes here"),
      description: "Hi I'm a description",
      imageURI: "1234.png",
    };
    await playerNFT.setAvatar(avatarId, avatarInfo);

    await playerNFT.mintWhitelist(1, name, true, proof);
    await expect(playerNFT.mintWhitelist(1, name, true, proof)).to.be.reverted; // Cannot mint twice
    await expect(playerNFT.connect(alice).mintWhitelist(1, name, true, proof)).to.be.reverted; // Not whitelisted
  });
});
