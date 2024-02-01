import {MEDIUM_NET, PROTECTION_SHIELD} from "@paintswap/estfor-definitions/constants";
import {ethers} from "hardhat";
import {SHOP_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add shop item using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const shop = await ethers.getContractAt("Shop", SHOP_ADDRESS);
  await shop.editItems([{price: ethers.utils.parseEther("5000"), tokenId: PROTECTION_SHIELD}]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
