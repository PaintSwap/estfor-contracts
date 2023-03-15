import {Skill} from "@paintswap/estfor-definitions/types";
import {ethers, upgrades} from "hardhat";
import {AvatarInfo, createPlayer} from "../../scripts/utils";
import {PlayerNFT} from "../../typechain-types";

export const playersFixture = async () => {
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
  const maxTime = await players.MAX_TIME();

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
    EDIT_NAME_BRUSH_PRICE,
    mockOracleClient,
    avatarInfo,
  };
};
