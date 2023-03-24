import {EstforTypes} from "@paintswap/estfor-definitions";
import {BRONZE_SHIELD} from "@paintswap/estfor-definitions/constants";
import {defaultInputItem, EquipPosition} from "@paintswap/estfor-definitions/types";
import {ethers} from "hardhat";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploying player implementation contracts with the account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const ItemNFT = await ethers.getContractFactory("ItemNFT");
  const itemNFT = ItemNFT.attach("0x23d689db5ac193afccd387dd6008970302ca0494");

  const item: EstforTypes.InputItem = {
    ...defaultInputItem,
    tokenId: BRONZE_SHIELD,
    combatStats: {
      melee: 0,
      magic: 0,
      range: 0,
      meleeDefence: 1,
      magicDefence: 0,
      rangeDefence: 1,
      health: 0,
    },
    equipPosition: EquipPosition.LEFT_HAND,
    metadataURI: "someIPFSURI.json",
  };

  await itemNFT.addItem(item);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
