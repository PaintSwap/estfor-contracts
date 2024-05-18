import {ethers} from "hardhat";
import {ADMIN_ACCESS_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add promotional admins using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const adminAccess = await ethers.getContractAt("AdminAccess", ADMIN_ACCESS_ADDRESS);
  await adminAccess.addPromotionalAdmins(["0xe9fb52d7611e502d93af381ac493981b42d91974"]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
