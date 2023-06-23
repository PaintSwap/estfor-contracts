import {ethers} from "hardhat";
import {ADMIN_ACCESS_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add promotional admins using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const AdminAccess = await ethers.getContractFactory("AdminAccess");
  const adminAccess = AdminAccess.attach(ADMIN_ACCESS_ADDRESS);

  await adminAccess.addPromotionalAdmins(["0xe9fb52d7611e502d93af381ac493981b42d91974"]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
