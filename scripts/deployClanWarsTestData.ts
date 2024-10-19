import {ethers} from "hardhat";
import {
  BRUSH_ADDRESS,
  COMBATANTS_HELPER_ADDRESS,
  DECORATOR_ADDRESS,
  DECORATOR_PROVIDER_ADDRESS,
  LOCKED_BANK_VAULTS_ADDRESS,
  TERRITORIES_ADDRESS
} from "./contractAddresses";
import {
  CombatantsHelper,
  DecoratorProvider,
  LockedBankVaults,
  MockBrushToken,
  Territories,
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

  const decoratorProvider = (await ethers.getContractAt(
    "DecoratorProvider",
    DECORATOR_PROVIDER_ADDRESS
  )) as DecoratorProvider;

  const pid = 22;
  const playerId = 1;

  const pendingBrush = await decorator.pendingBrush(pid, await decoratorProvider.getAddress());
  console.log("Pending", pendingBrush);

  let tx = await brush
    .connect(owner)
    .transfer(await decoratorProvider.getAddress(), (pendingBrush + pendingBrush) / 2n);
  await tx.wait();
  console.log("Transferred brush");

  tx = await decoratorProvider.connect(owner).harvest(playerId);
  await tx.wait();
  console.log("Harvest");

  // Lock some brush in a vault
  tx = await lockedBankVaults.connect(owner).setAddresses(owner.address, await combatantsHelper.getAddress());
  await tx.wait();
  console.log("set territories");
  tx = await brush.connect(owner).approve(await lockedBankVaults.getAddress(), parseEther("100"));
  await tx.wait();
  console.log("Approve");
  tx = await lockedBankVaults.connect(owner).lockFunds(1, owner.address, 1, parseEther("100"));
  await tx.wait();
  console.log("LockFunds");
  tx = await lockedBankVaults
    .connect(owner)
    .setAddresses(await territories.getAddress(), await combatantsHelper.getAddress());
  await tx.wait();
  console.log("SetTerritories");

  // Claim the territory
  tx = await combatantsHelper.connect(owner).assignCombatants(1, true, [1], false, [], 1);
  await tx.wait();
  console.log("assign combatants for territories");
  let territoryAttackCost = await territories.getAttackCost();
  tx = await territories.connect(owner).attackTerritory(1, 1, 1, {value: territoryAttackCost}); // Unclaimed
  await tx.wait();
  console.log("attack territory");

  tx = await territories.connect(owner).harvest(1, 1);
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
