import {ethers, upgrades} from "hardhat";
import {
  BANK_ADDRESS,
  BANK_FACTORY_ADDRESS,
  BANK_REGISTRY_ADDRESS,
  BANK_RELAY_ADDRESS,
  BAZAAR_ADDRESS,
  CLANS_ADDRESS,
  INSTANT_ACTIONS_ADDRESS,
  INSTANT_VRF_ACTIONS_ADDRESS,
  ITEM_NFT_ADDRESS,
  LOCKED_BANK_VAULTS_ADDRESS,
  PASSIVE_ACTIONS_ADDRESS,
  PLAYERS_ADDRESS,
  QUESTS_ADDRESS,
  RAIDS_ADDRESS,
  SHOP_ADDRESS,
  TERRITORIES_ADDRESS,
  WISHING_WELL_ADDRESS
} from "./contractAddresses";
import {getChainId, verifyContracts} from "./utils";
import {ACTIVITY_TICKET, SONIC_GEM_TICKET} from "@paintswap/estfor-definitions/constants";
import {ActivityPoints} from "../typechain-types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(
    `Deploying upgradeable activity points contract with the account: ${owner.address} on chain id ${await getChainId(
      owner
    )}`
  );

  const ActivityPoints = await ethers.getContractFactory("ActivityPoints");
  const activityPoints = (await upgrades.deployProxy(
    ActivityPoints,
    [ITEM_NFT_ADDRESS, ACTIVITY_TICKET, SONIC_GEM_TICKET],
    {
      kind: "uups"
    }
  )) as unknown as ActivityPoints;
  console.log("Deployed activity points", await activityPoints.getAddress());
  await activityPoints.waitForDeployment();

  await activityPoints.addCallers([
    BAZAAR_ADDRESS,
    PLAYERS_ADDRESS,
    SHOP_ADDRESS,
    QUESTS_ADDRESS,
    WISHING_WELL_ADDRESS,
    INSTANT_ACTIONS_ADDRESS,
    INSTANT_VRF_ACTIONS_ADDRESS,
    PASSIVE_ACTIONS_ADDRESS,
    CLANS_ADDRESS,
    LOCKED_BANK_VAULTS_ADDRESS,
    TERRITORIES_ADDRESS
  ]);

  // Set the force item depositors to allow minting to clan bank
  const BankRegistry = await ethers.getContractAt("BankRegistry", BANK_REGISTRY_ADDRESS);
  await BankRegistry.setForceItemDepositors([await activityPoints.getAddress(), RAIDS_ADDRESS], [true, true]);
  console.log("BankRegistry setForceItemDepositors: activity points, raids");

  // Set the activity points contract on all other contracts

  const orderBook = await ethers.getContractAt("OrderBook", BAZAAR_ADDRESS);
  await orderBook.setActivityPoints(activityPoints);
  console.log("OrderBook set activity points");

  const players = await ethers.getContractAt("Players", PLAYERS_ADDRESS);
  await players.setActivityPoints(activityPoints);
  console.log("Players set activity points");

  const shop = await ethers.getContractAt("Shop", SHOP_ADDRESS);
  await shop.setActivityPoints(activityPoints);
  console.log("Shop set activity points");

  const quests = await ethers.getContractAt("Quests", QUESTS_ADDRESS);
  await quests.setActivityPoints(activityPoints);
  console.log("Quests set activity points");

  const wishingWell = await ethers.getContractAt("WishingWell", WISHING_WELL_ADDRESS);
  await wishingWell.setActivityPoints(activityPoints);
  console.log("WishingWell set activity points");

  const instantActions = await ethers.getContractAt("InstantActions", INSTANT_ACTIONS_ADDRESS);
  await instantActions.setActivityPoints(activityPoints);
  console.log("InstantActions set activity points");

  const instantVRFActions = await ethers.getContractAt("InstantVRFActions", INSTANT_VRF_ACTIONS_ADDRESS);
  await instantVRFActions.setActivityPoints(activityPoints);
  console.log("InstantVRFActions set activity points");

  const clans = await ethers.getContractAt("Clans", CLANS_ADDRESS);
  await clans.setActivityPoints(activityPoints);
  console.log("Clans set activity points");

  const lockedBankVaults = await ethers.getContractAt("LockedBankVaults", LOCKED_BANK_VAULTS_ADDRESS);
  await lockedBankVaults.setActivityPoints(activityPoints);
  console.log("LockedBankVaults set activity points");

  const territories = await ethers.getContractAt("Territories", TERRITORIES_ADDRESS);
  await territories.setActivityPoints(activityPoints);
  console.log("Territories set activity points");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
