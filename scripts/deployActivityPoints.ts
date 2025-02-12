import {ethers, upgrades} from "hardhat";
import {
  BANK_REGISTRY_ADDRESS,
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
  const ACTIVITY_POINTS_ADDRESS = await activityPoints.getAddress();

  // Set the activity points contract on all other contracts
  const contracts = [
    INSTANT_ACTIONS_ADDRESS,
    INSTANT_VRF_ACTIONS_ADDRESS,
    PASSIVE_ACTIONS_ADDRESS,
    QUESTS_ADDRESS,
    SHOP_ADDRESS,
    WISHING_WELL_ADDRESS,
    BAZAAR_ADDRESS, // OrderBook
    CLANS_ADDRESS,
    LOCKED_BANK_VAULTS_ADDRESS,
    TERRITORIES_ADDRESS,
    PLAYERS_ADDRESS
  ];

  await activityPoints.addCallers(contracts);

  // Set the force item depositors to allow minting to clan bank
  const BankRegistry = await ethers.getContractAt("BankRegistry", BANK_REGISTRY_ADDRESS);
  await BankRegistry.setForceItemDepositors([ACTIVITY_POINTS_ADDRESS, RAIDS_ADDRESS], [true, true]);
  console.log("BankRegistry setForceItemDepositors: activity points, raids");

  for (const address of contracts) {
    const contract = await ethers.getContractAt("IActivityPointsCaller", address);
    const tx = await contract.setActivityPoints(ACTIVITY_POINTS_ADDRESS);
    await tx.wait();
    console.log(`Contract ${address} set activity points`);
  }
  console.log("-- All contracts set activity points --");

  // verify contracts with updates
  await verifyContracts(contracts);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
