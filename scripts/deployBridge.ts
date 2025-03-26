import {ethers, upgrades} from "hardhat";
import {
  BRIDGE_ADDRESS,
  CLANS_ADDRESS,
  ESTFOR_LIBRARY_ADDRESS,
  INSTANT_ACTIONS_ADDRESS,
  INSTANT_VRF_ACTIONS_ADDRESS,
  ITEM_NFT_ADDRESS,
  ITEM_NFT_LIBRARY_ADDRESS,
  LOCKED_BANK_VAULTS_ADDRESS,
  LOCKED_BANK_VAULTS_LIBRARY_ADDRESS,
  PASSIVE_ACTIONS_ADDRESS,
  PET_NFT_ADDRESS,
  PET_NFT_LIBRARY_ADDRESS,
  PLAYER_NFT_ADDRESS,
  PLAYERS_ADDRESS,
  QUESTS_ADDRESS,
  SHOP_ADDRESS,
  TERRITORIES_ADDRESS,
  WORLD_LIBRARY_ADDRESS,
} from "./contractAddresses";
import {Clans, PetNFT, PlayerNFT} from "../typechain-types";

async function main() {
  const [owner] = await ethers.getSigners();

  console.log(`Deploying bridge with the account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const dstEid = "30332"; // Sonic
  const lzEndpoint = "0x1a44076050125825900e736c501f859c50fE728c"; // Fantom
  const Bridge = (await ethers.getContractFactory("Bridge")).connect(owner);
  const bridge = await upgrades.deployProxy(
    Bridge,
    [
      dstEid,
      PET_NFT_ADDRESS,
      ITEM_NFT_ADDRESS,
      PLAYER_NFT_ADDRESS,
      PLAYERS_ADDRESS,
      CLANS_ADDRESS,
      QUESTS_ADDRESS,
      PASSIVE_ACTIONS_ADDRESS,
    ],
    {
      kind: "uups",
      timeout: 10000,
      constructorArgs: [lzEndpoint],
      unsafeAllow: ["delegatecall", "constructor", "state-variable-immutable"],
    }
  );
  await bridge.deployed();
  console.log(`bridge = "${bridge.address.toLowerCase()}"`);

  // Upgrade appropriate contracts
  const timeout = 60 * 1000;

  const lockedBankVaultsLibrary = await ethers.deployContract("LockedBankVaultsLibrary");
  await lockedBankVaultsLibrary.deployed();
  console.log(`lockedBankVaultsLibrary = ${lockedBankVaultsLibrary.address}`);
  const LockedBankVaults = (
    await ethers.getContractFactory("LockedBankVaults", {
      libraries: {EstforLibrary: ESTFOR_LIBRARY_ADDRESS, LockedBankVaultsLibrary: LOCKED_BANK_VAULTS_LIBRARY_ADDRESS},
    })
  ).connect(owner);
  const lockedBankVaults = await upgrades.upgradeProxy(LOCKED_BANK_VAULTS_ADDRESS, LockedBankVaults, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await lockedBankVaults.deployed();
  console.log(`lockedBankVaults = "${lockedBankVaults.address.toLowerCase()}"`);

  const Territories = (await ethers.getContractFactory("Territories")).connect(owner);
  const territories = await upgrades.upgradeProxy(TERRITORIES_ADDRESS, Territories, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await territories.deployed();
  console.log(`territories = "${territories.address.toLowerCase()}"`);

  // Quests
  const Quests = (await ethers.getContractFactory("Quests")).connect(owner);
  const quests = await upgrades.upgradeProxy(QUESTS_ADDRESS, Quests, {
    kind: "uups",
    timeout,
  });
  await quests.deployed();
  console.log(`quests = "${quests.address.toLowerCase()}"`);

  // Clan
  const Clans = (
    await ethers.getContractFactory("Clans", {
      libraries: {EstforLibrary: ESTFOR_LIBRARY_ADDRESS},
    })
  ).connect(owner);
  const clans = (await upgrades.upgradeProxy(CLANS_ADDRESS, Clans, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  })) as Clans;
  await clans.deployed();
  console.log(`clans = "${clans.address.toLowerCase()}"`);

  const ItemNFT = (
    await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: ITEM_NFT_LIBRARY_ADDRESS}})
  ).connect(owner);
  const itemNFT = await upgrades.upgradeProxy(ITEM_NFT_ADDRESS, ItemNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await itemNFT.deployed();
  console.log(`itemNFT = "${itemNFT.address.toLowerCase()}"`);

  const PassiveActions = (
    await ethers.getContractFactory("PassiveActions", {libraries: {WorldLibrary: WORLD_LIBRARY_ADDRESS}})
  ).connect(owner);
  const passiveActions = await upgrades.upgradeProxy(PASSIVE_ACTIONS_ADDRESS, PassiveActions, {
    kind: "uups",
    unsafeAllow: ["delegatecall", "external-library-linking"],
    timeout: 1000000,
  });
  await passiveActions.deployed();
  console.log(`passiveActions = "${passiveActions.address.toLowerCase()}"`);

  let tx = await passiveActions.setBridge(bridge.address);
  await tx.wait();
  console.log("Bridge set on passiveActions");

  const PlayerNFT = (
    await ethers.getContractFactory("PlayerNFT", {
      libraries: {EstforLibrary: ESTFOR_LIBRARY_ADDRESS},
    })
  ).connect(owner);
  const playerNFT = (await upgrades.upgradeProxy(PLAYER_NFT_ADDRESS, PlayerNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  })) as PlayerNFT;
  await playerNFT.deployed();
  console.log(`playerNFT = "${playerNFT.address.toLowerCase()}"`);

  const Shop = (await ethers.getContractFactory("Shop")).connect(owner);
  const shop = await upgrades.upgradeProxy(SHOP_ADDRESS, Shop, {
    kind: "uups",
    timeout,
  });
  await shop.deployed();
  console.log(`shop = "${shop.address.toLowerCase()}"`);

  const Players = (await ethers.getContractFactory("Players")).connect(owner);
  const players = await upgrades.upgradeProxy(PLAYERS_ADDRESS, Players, {
    kind: "uups",
    unsafeAllow: ["delegatecall", "external-library-linking"],
    timeout,
  });
  await players.deployed();
  console.log(`players = "${players.address.toLowerCase()}"`);

  // Instant actions
  const InstantActions = (await ethers.getContractFactory("InstantActions")).connect(owner);
  const instantActions = await upgrades.upgradeProxy(INSTANT_ACTIONS_ADDRESS, InstantActions, {
    kind: "uups",
    timeout,
  });
  await instantActions.deployed();
  console.log(`instantActions = "${instantActions.address.toLowerCase()}"`);

  // Instant VRF actions
  const InstantVRFActions = (await ethers.getContractFactory("InstantVRFActions")).connect(owner);
  const instantVRFActions = await upgrades.upgradeProxy(INSTANT_VRF_ACTIONS_ADDRESS, InstantVRFActions, {
    kind: "uups",
    timeout,
  });
  await instantVRFActions.deployed();
  console.log(`instantVRFActions = "${instantVRFActions.address.toLowerCase()}"`);

  // Pets
  const PetNFT = (
    await ethers.getContractFactory("PetNFT", {
      libraries: {EstforLibrary: ESTFOR_LIBRARY_ADDRESS, PetNFTLibrary: PET_NFT_LIBRARY_ADDRESS},
    })
  ).connect(owner);
  const petNFT = (await upgrades.upgradeProxy(PET_NFT_ADDRESS, PetNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  })) as PetNFT;
  console.log(`petNFT = "${petNFT.address.toLowerCase()}"`);

  // Set names to highest amount possible to reduce conflicts
  tx = await clans.setEditNameCost(ethers.utils.parseEther("4700"));
  await tx.wait();
  console.log("Set clans cost");

  tx = await petNFT.setEditNameCost(ethers.utils.parseEther("4700"));
  await tx.wait();
  console.log("Set pet cost");

  tx = await playerNFT.setEditNameCost(ethers.utils.parseEther("4700"));
  await tx.wait();
  console.log("Set player cost");

  tx = await clans.setBridge(bridge.address);
  await tx.wait();
  console.log("Bridge set on clans, also prevents creating clan");

  tx = await playerNFT.setBridge(bridge.address);
  await tx.wait();
  console.log("Bridge set on playerNFT, to prevent creating players");

  const disableGame = true;
  tx = await instantActions.setPreventActions(disableGame);
  await tx.wait();
  console.log("Instant Actions prevented");

  tx = await instantVRFActions.setPreventActions(disableGame);
  await tx.wait();
  console.log("VRF Actions prevented");

  tx = await players.pauseGame(disableGame);
  await tx.wait();
  console.log("Game paused");

  tx = await lockedBankVaults.setPreventAttacks(disableGame);
  await tx.wait();
  console.log("Attacks prevented locked vaults");

  tx = await territories.setPreventAttacks(disableGame);
  await tx.wait();
  console.log("Attacks prevented territories");

  tx = await shop.setSellingPrevented(disableGame);
  await tx.wait();
  console.log("Selling prevented");

  if (disableGame) {
    // Withdraw BRUSH from the treasure (can be done manually)
    tx = await shop.withdrawTreasury();
    await tx.wait();
    console.log("Treasury withdrawn");
  }

  // Do this after preventing actions
  const contractsToSetBridge = [itemNFT, quests, lockedBankVaults, players, petNFT];
  const bridgeAddress = disableGame ? bridge.address : ethers.constants.AddressZero;
  for (const contract of contractsToSetBridge) {
    tx = await contract.setBridge(bridgeAddress);
    await tx.wait();
    console.log(`Bridge set on ${contract.address}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
