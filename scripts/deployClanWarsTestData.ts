import {ethers} from "hardhat";
import {
  BRUSH_ADDRESS,
  COMBATANTS_HELPER_ADDRESS,
  DECORATOR_ADDRESS,
  TERRITORY_TREASURY_ADDRESS,
  LOCKED_BANK_VAULTS_ADDRESS,
  TERRITORIES_ADDRESS,
  BANK_FACTORY_ADDRESS
} from "./contractAddresses";
import {
  CombatantsHelper,
  LockedBankVaults,
  MockBrushToken,
  Territories,
  TerritoryTreasury,
  TestPaintSwapDecorator
} from "../typechain-types";
import {getChainId} from "./utils";
import {parseEther} from "ethers";

async function main() {
  const [owner, alice] = await ethers.getSigners();
  console.log(`Deploying clan wars test data: ${owner.address} on chain id ${await getChainId(owner)}`);
  // const owner = await ethers.getImpersonatedSigner("0x316342122A9ae36de41B231260579b92F4C8Be7f");
  // const alice = await ethers.getImpersonatedSigner("0xBa00694692267ed0B5154d48Fcb4D435D0B24d3F");

  const brush = (await ethers.getContractAt("MockBrushToken", BRUSH_ADDRESS)) as MockBrushToken;

  const territories = (await ethers.getContractAt("Territories", TERRITORIES_ADDRESS)) as Territories;
  const lockedBankVaults = (await ethers.getContractAt(
    "LockedBankVaults",
    LOCKED_BANK_VAULTS_ADDRESS
  )) as LockedBankVaults;
  const decorator = (await ethers.getContractAt("TestPaintSwapDecorator", DECORATOR_ADDRESS)) as TestPaintSwapDecorator;
  const combatantsHelper = (await ethers.getContractAt(
    "CombatantsHelper",
    COMBATANTS_HELPER_ADDRESS
  )) as CombatantsHelper;

  const territoryTreasury = (await ethers.getContractAt(
    "TerritoryTreasury",
    TERRITORY_TREASURY_ADDRESS
  )) as TerritoryTreasury;

  const pid = 22;
  const playerId = 1;

  const pendingBrush = await decorator.pendingBrush(pid, territoryTreasury);
  console.log("Pending", pendingBrush);

  let tx = await brush.transfer(territoryTreasury, (pendingBrush + pendingBrush) / 2n);
  await tx.wait();
  console.log("Transferred brush");

  tx = await territoryTreasury.harvest(playerId);
  await tx.wait();
  console.log("Harvest");

  // Lock some brush in a vault
  tx = await lockedBankVaults.initializeAddresses(owner, combatantsHelper, BANK_FACTORY_ADDRESS);
  await tx.wait();
  console.log("set territories");
  tx = await brush.approve(lockedBankVaults, parseEther("100"));
  await tx.wait();
  console.log("Approve");
  tx = await lockedBankVaults.lockFunds(1, owner, 1, parseEther("100"));
  await tx.wait();
  console.log("LockFunds");
  tx = await lockedBankVaults.initializeAddresses(territories, combatantsHelper, BANK_FACTORY_ADDRESS);
  await tx.wait();
  console.log("SetTerritories");

  // Claim the territory
  tx = await combatantsHelper.assignCombatants(1, true, [1], false, [], 1);
  await tx.wait();
  console.log("assign combatants for territories");
  let territoryAttackCost = await territories.getAttackCost();
  tx = await territories.attackTerritory(1, 1, 1, {value: territoryAttackCost}); // Unclaimed
  await tx.wait();
  console.log("attack territory");

  tx = await territories.harvest(1, 1);
  await tx.wait();
  console.log("Harvest unclaimed emissions from the territory");

  const aliceClanId = 26;

  tx = await combatantsHelper.connect(alice).assignCombatants(aliceClanId, true, [532], true, [2], 2);
  await tx.wait();
  console.log("assign combatants for territories & locked bank vaults");

  tx = await lockedBankVaults.connect(alice).clearCooldowns(aliceClanId, [1]);
  await tx.wait();
  console.log("clear cooldowns");

  tx = await combatantsHelper.connect(alice).clearCooldowns([532, 2]);
  await tx.wait();
  console.log("combatantsHelper clear cooldowns");

  const vaultAttackCost = await lockedBankVaults.getAttackCost();
  tx = await lockedBankVaults.connect(alice).attackVaults(aliceClanId, 1, 0, 2, {value: vaultAttackCost});
  await tx.wait();
  console.log("attack vaults");

  territoryAttackCost = await territories.getAttackCost();
  tx = await territories.connect(alice).attackTerritory(aliceClanId, 1, 2, {value: territoryAttackCost});
  await tx.wait();
  console.log("attack territory");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
