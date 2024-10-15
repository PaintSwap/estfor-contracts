import {ethers} from "hardhat";
import {CLANS_ADDRESS, LOCKED_BANK_VAULTS_ADDRESS} from "./contractAddresses";
import {LockedBankVaults} from "../typechain-types";
import {getChainId, isBeta} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Initialize clan MMRs using account: ${owner.address} on chain id ${await getChainId(owner)}`);

  const lockedBankVaults = (await ethers.getContractAt(
    "LockedBankVaults",
    LOCKED_BANK_VAULTS_ADDRESS,
  )) as LockedBankVaults;

  const clanIds = [
    1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33,
    34, 35, 36, 38, 40, 41, 42, 43, 44, 45, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 61, 62, 63, 64, 65, 66, 67,
    69, 71, 72, 73, 74, 75, 76, 77, 78, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 98, 99, 100,
    101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 123, 124, 126,
    127, 128, 129, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150,
    151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174,
    175, 177, 178, 180, 181, 182, 183, 184, 186, 187, 188, 189, 190, 191, 192, 194, 195, 197, 198, 199, 200, 201, 202,
    203, 204, 205, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 229, 230, 231, 232, 233,
    238, 239, 240, 242, 243, 244, 245, 246, 247, 249, 250, 252, 253, 254, 255, 257, 258, 259, 261, 262, 263, 264, 265,
    267, 268, 270, 277, 278, 280, 281, 282, 283, 284, 287, 290, 291, 292, 293, 295, 297, 298, 299, 301, 302, 303, 305,
    306, 307, 308, 309, 310, 311, 312, 313, 315, 316, 327, 328, 329, 330, 341, 342, 343, 344, 345, 346, 348, 349, 350,
    351, 352, 353, 355, 357, 359, 360, 361, 362, 363, 364, 366, 367, 368, 369, 370, 371, 372, 373, 374, 375, 376, 377,
    378, 380, 381, 382, 384, 385, 386, 387, 388, 389, 390, 391, 392, 393, 394, 395, 396, 397, 398, 399, 400, 401, 402,
    403, 404, 405,
  ];

  const mmrs = [
    507, 500, 921, 500, 500, 500, 562, 500, 500, 500, 502, 701, 541, 500, 500, 500, 500, 514, 500, 500, 500, 500, 500,
    500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500,
    500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 621, 500,
    500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500,
    500, 500, 500, 500, 500, 839, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500,
    500, 500, 500, 500, 500, 511, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500,
    500, 500, 500, 500, 500, 591, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 503, 500, 500, 500, 500,
    500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 672, 500, 500, 500, 500, 500, 500, 500,
    500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500,
    500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500,
    500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500,
    500, 500, 500, 500, 500, 500, 514, 514, 898, 510, 517, 500, 500, 500, 568, 500, 508, 500, 509, 507, 501, 503, 500,
    500, 500, 502, 501, 500, 500, 501, 501, 500, 500, 500, 500, 500, 501, 500, 500, 500, 500, 500, 746, 568, 500, 500,
    500, 500, 500, 500, 500, 664, 500, 500, 500, 500, 500, 660, 500, 500, 500, 500, 500, 500, 500, 500, 504, 500, 500,
  ];

  if (clanIds.length != mmrs.length) {
    console.log("Length mismatch");
    return;
  }

  let tx = await lockedBankVaults.setPreventAttacks(true);
  await tx.wait();
  console.log("Set Prevent Attacks");
  // Just to clear any that might have been added before
  let clear = true;
  tx = await lockedBankVaults.initializeMMR([], [], clear);
  await tx.wait();

  const clans = await ethers.getContractAt("Clans", CLANS_ADDRESS);
  tx = await clans.setInitialMMR(500);
  await tx.wait();
  console.log("Set initial MMR");

  clear = false;
  const chunkSize = 25;
  for (let i = 0; i < clanIds.length; i += chunkSize) {
    const chunk = clanIds.slice(i, i + chunkSize);
    const chunkMMR = mmrs.slice(i, i + chunkSize);
    tx = await lockedBankVaults.initializeMMR(chunk, chunkMMR, clear);
    await tx.wait();
    console.log("Initialized clan MMRs ", i);
  }

  const Ka = 32;
  const Kd = 32;
  tx = await lockedBankVaults.setKValues(Ka, Kd);
  await tx.wait();
  console.log("Set K values");

  const mmrAttackDistance = isBeta ? 3 : 3;
  tx = await lockedBankVaults.setMMRAttackDistance(mmrAttackDistance);
  await tx.wait();
  console.log("Set MMR attack distance");

  tx = await lockedBankVaults.setPreventAttacks(false);
  await tx.wait();
  console.log("Unset Prevent Attacks");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
