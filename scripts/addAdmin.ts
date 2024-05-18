import {ethers} from "hardhat";
import {ADMIN_ACCESS_ADDRESS} from "./contractAddresses";
import {AdminAccess} from "../typechain-types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add admins using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const adminAccess = (await ethers.getContractAt("AdminAccess", ADMIN_ACCESS_ADDRESS)) as AdminAccess;

  await adminAccess.addAdmins([
    "0xb4dda75e5dee0a9e999152c3b72816fc1004d1dd",
    "0x1d877C5e1452A635b3Feaa47994b03C7c0976Ad3",
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
