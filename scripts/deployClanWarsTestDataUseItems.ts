import {ethers} from "hardhat";
import {
  COMBATANTS_HELPER_ADDRESS,
  ITEM_NFT_ADDRESS,
  LOCKED_BANK_VAULTS_ADDRESS,
  TERRITORIES_ADDRESS
} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {getChainId} from "./utils";

async function main() {
  const [owner, alice] = await ethers.getSigners();
  console.log(`Deploying clan wars test data: ${owner.address} on chain id ${await getChainId(owner)}`);

  const territories = await ethers.getContractAt("Territories", TERRITORIES_ADDRESS);
  const lockedBankVaults = await ethers.getContractAt("LockedBankVaults", LOCKED_BANK_VAULTS_ADDRESS);
  const combatantsHelper = await ethers.getContractAt("CombatantsHelper", COMBATANTS_HELPER_ADDRESS);
  const itemNFT = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);

  const clanId = 1;
  const playerId = 1;

  const aliceClanId = 26;
  const alicePlayerId = 2;
  const vaultAttackCost = await lockedBankVaults.getAttackCost();

  let tx = await itemNFT.mintBatch(
    alice,
    [EstforConstants.DEVILISH_FINGERS, EstforConstants.PROTECTION_SHIELD, EstforConstants.MIRROR_SHIELD],
    [2, 2, 2]
  );
  tx = await itemNFT.mintBatch(
    owner,
    [EstforConstants.DEVILISH_FINGERS, EstforConstants.PROTECTION_SHIELD, EstforConstants.MIRROR_SHIELD],
    [2, 2, 2]
  );
  console.log("Mints");

  tx = await lockedBankVaults.connect(alice).clearCooldowns(aliceClanId, [clanId]);
  await tx.wait();
  console.log("clear cooldowns");

  tx = await lockedBankVaults
    .connect(alice)
    .attackVaults(aliceClanId, clanId, 0, alicePlayerId, {value: vaultAttackCost});
  await tx.wait();
  console.log("attack vaults");

  tx = await lockedBankVaults.connect(alice).clearCooldowns(aliceClanId, []);
  await tx.wait();
  console.log("clear cooldowns");

  tx = await combatantsHelper.connect(alice).clearCooldowns([alicePlayerId]);
  await tx.wait();
  console.log("combatantsHelper clear cooldowns");

  tx = await lockedBankVaults
    .connect(alice)
    .attackVaults(aliceClanId, clanId, EstforConstants.DEVILISH_FINGERS, alicePlayerId, {value: vaultAttackCost});
  await tx.wait();
  console.log("reattack vaults with item");

  // Block with items
  tx = await lockedBankVaults
    .connect(alice)
    .blockAttacks(aliceClanId, EstforConstants.PROTECTION_SHIELD, alicePlayerId);
  await tx.wait();
  console.log("block attacks on locked vaults");

  tx = await territories.blockAttacks(playerId, EstforConstants.MIRROR_SHIELD, playerId);
  await tx.wait();
  console.log("block attacks on territories");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
