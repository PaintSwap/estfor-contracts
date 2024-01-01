import {ethers, upgrades} from "hardhat";
import {
  DEV_ADDRESS,
  ITEM_NFT_ADDRESS,
  LOCKED_BANK_VAULT_ADDRESS,
  SHOP_ADDRESS,
  TERRITORIES_ADDRESS,
} from "./contractAddresses";
import {ItemNFT, LockedBankVaults, Territories} from "../typechain-types";
import {EstforConstants} from "@paintswap/estfor-definitions";

async function main() {
  //  const [owner, alice] = await ethers.getSigners();
  //  console.log(`Deploying clan wars test data: ${owner.address} on chain id ${await owner.getChainId()}`);
  const owner = await ethers.getImpersonatedSigner("0x316342122A9ae36de41B231260579b92F4C8Be7f");
  const alice = await ethers.getImpersonatedSigner("0xBa00694692267ed0B5154d48Fcb4D435D0B24d3F");

  const territories = (await ethers.getContractAt("Territories", TERRITORIES_ADDRESS)) as Territories;
  const lockedBankVaults = (await ethers.getContractAt(
    "LockedBankVaults",
    LOCKED_BANK_VAULT_ADDRESS
  )) as LockedBankVaults;

  const itemNFT = (await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS)).connect(owner) as ItemNFT;

  const clanId = 1;
  const playerId = 1;

  const aliceClanId = 26;
  const alicePlayerId = 2;
  const vaultAttackCost = await lockedBankVaults.attackCost();

  await itemNFT.testMints(
    alice.address,
    [EstforConstants.DEVILISH_FINGERS, EstforConstants.PROTECTION_SHIELD, EstforConstants.MIRROR_SHIELD],
    [2, 2, 2]
  );
  await itemNFT.testMints(
    owner.address,
    [EstforConstants.DEVILISH_FINGERS, EstforConstants.PROTECTION_SHIELD, EstforConstants.MIRROR_SHIELD],
    [2, 2, 2]
  );

  {
    // TODO: Remove this bit
    const tx = await lockedBankVaults.tempSetShop(SHOP_ADDRESS, DEV_ADDRESS);
    await tx.wait();
    console.log("set shop and dev");
  }

  let tx = await lockedBankVaults
    .connect(alice)
    .attackVaults(aliceClanId, clanId, 0, alicePlayerId, {value: vaultAttackCost});
  await tx.wait();
  console.log("attack vaults");

  tx = await lockedBankVaults.connect(alice).clearCooldowns(aliceClanId, []);
  await tx.wait();
  console.log("clear cooldowns");

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

  tx = await territories.connect(owner).blockAttacks(playerId, EstforConstants.MIRROR_SHIELD, playerId);
  await tx.wait();
  console.log("block attacks on territories");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
