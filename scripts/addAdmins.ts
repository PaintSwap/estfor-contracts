import {ethers} from "hardhat";
import {ADMIN_ACCESS_ADDRESS} from "./contractAddresses";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add admins using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const adminAccess = await ethers.getContractAt("AdminAccess", ADMIN_ACCESS_ADDRESS);

  await adminAccess.addAdmins([
    "0xb4dda75e5dee0a9e999152c3b72816fc1004d1dd",
    "0xF83219Cd7D96ab2D80f16D36e5d9D00e287531eC",
    "0xa801864d0D24686B15682261aa05D4e1e6e5BD94"
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
