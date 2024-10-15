import {ethers} from "hardhat";
import {BANK_FACTORY_ADDRESS, ITEM_NFT_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Bulk transfer using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const itemNFT = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);

  // From player
  let tx = await itemNFT.testMints(owner.address, [EstforConstants.TITANIUM_AXE, EstforConstants.IRON_AXE], [2, 2]);
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
  const clanBankAddress = ethers.getCreateAddress({
    from: BANK_FACTORY_ADDRESS,
    nonce: clanId,
  });

  // Send directly
  tx = await itemNFT.testMints(clanBankAddress, [EstforConstants.TITANIUM_AXE, EstforConstants.IRON_AXE], [2, 2]);
  await tx.wait();

  const bank = await ethers.getContractAt("Bank", clanBankAddress);
  const playerId = 1;
  tx = await bank.withdrawItemsBulk(nftInfos, playerId);
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
