import {ethers} from "hardhat";
import {ADMIN_ACCESS_ADDRESS} from "./contractAddresses";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Add admins using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const adminAccess = await ethers.getContractAt("AdminAccess", ADMIN_ACCESS_ADDRESS);

  await adminAccess.addAdmins(["0x6dC225F7f21ACB842761b8df52AE46208705c942"]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
