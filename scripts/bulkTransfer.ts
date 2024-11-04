import {ethers} from "hardhat";
import {
  BANK_ADDRESS,
  BANK_FACTORY_ADDRESS,
  BANK_REGISTRY_ADDRESS,
  BANK_RELAY_ADDRESS,
  CLANS_ADDRESS,
  ITEM_NFT_ADDRESS,
  LOCKED_BANK_VAULTS_ADDRESS,
  PLAYER_NFT_ADDRESS,
  PLAYERS_ADDRESS
} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {getChainId} from "./utils";
import {calculateClanBankAddress} from "../test/Clans/utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Bulk transfer using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const itemNFT = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);

  // From player
  let tx = await itemNFT.mintBatch(owner.address, [EstforConstants.TITANIUM_AXE, EstforConstants.IRON_AXE], [2, 2]);
  await tx.wait();

  const tokenIds = [EstforConstants.TITANIUM_AXE, EstforConstants.IRON_AXE];
  const tos = ["0xa801864d0D24686B15682261aa05D4e1e6e5BD94", "0xBa00694692267ed0B5154d48Fcb4D435D0B24d3F"];
  const amounts = [2, 1];

  // Turn this into expected transfer nft object
  const nftInfos = [];
  for (let i = 0; i < tokenIds.length; ++i) {
    const tokenId = tokenIds[i];
    const to = tos[i];
    const amount = amounts[i];

    let exists = false;
    for (let j = 0; j < nftInfos.length; ++j) {
      const nftInfo: any = nftInfos[j];
      if (to == nftInfo.to) {
        // Already exists
        exists = true;
        nftInfo.tokenIds.push(tokenId);
        nftInfo.amounts.push(amount);
        break;
      }
    }

    if (!exists) {
      nftInfos.push({tokenIds: [tokenId], amounts: [amount], to: to});
    }
  }

  await itemNFT.safeBulkTransfer(nftInfos);

  // From clan
  const clanId = 1;
  const clanBankAddress = await calculateClanBankAddress(
    clanId,
    BANK_FACTORY_ADDRESS,
    CLANS_ADDRESS,
    BANK_ADDRESS,
    BANK_REGISTRY_ADDRESS,
    BANK_RELAY_ADDRESS,
    PLAYER_NFT_ADDRESS,
    ITEM_NFT_ADDRESS,
    PLAYERS_ADDRESS,
    LOCKED_BANK_VAULTS_ADDRESS
  );

  // Send directly
  tx = await itemNFT.mintBatch(clanBankAddress, [EstforConstants.TITANIUM_AXE, EstforConstants.IRON_AXE], [2, 2]);
  await tx.wait();

  const bankRelay = await ethers.getContractAt("BankRelay", BANK_RELAY_ADDRESS);
  const playerId = 1;
  tx = await bankRelay.withdrawItemsBulk(nftInfos, playerId);
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
