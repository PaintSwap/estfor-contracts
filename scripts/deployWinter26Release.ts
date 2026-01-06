import {ethers, upgrades} from "hardhat";
import {
  BRUSH_ADDRESS,
  PET_NFT_ADDRESS,
  PLAYER_NFT_ADDRESS,
  PLAYERS_ADDRESS,
  PET_NFT_LIBRARY_ADDRESS,
  ESTFOR_LIBRARY_ADDRESS,
  SHOP_ADDRESS,
  USDC_ADDRESS,
  ITEM_NFT_ADDRESS,
} from "./contractAddresses";
import {initialiseSafe, sendTransactionSetToSafe, getSafeUpgradeTransaction, verifyContracts} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";
import {Marketplace, Cosmetics} from "../typechain-types";
import {cosmeticInfos} from "./data/cosmetics";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {Skill} from "@paintswap/estfor-definitions/types";

async function main() {
  const [owner, , proposer] = await ethers.getSigners(); // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(
    `Deploy marketplace using account: ${proposer.address} on chain id ${network.chainId}, useSafe: ${useSafe}`
  );

  const timeout = 300 * 1000; // 5 minutes

  if (useSafe) {
    /* Marketplace Release */
    // const Marketplace = await ethers.getContractFactory("Marketplace", proposer);
    // const marketplace = (await upgrades.deployProxy(Marketplace, [
    //   BRUSH_ADDRESS,
    //   process.env.SAFE_ADDRESS,
    // ])) as unknown as Marketplace;
    // await marketplace.waitForDeployment();
    // console.log(`marketplace = "${(await marketplace.getAddress()).toLowerCase()}"`);

    // // can verify this immediately
    // if (network.chainId == 146n) {
    //   await verifyContracts([await marketplace.getAddress()]);
    // }

    const petNFTLibrary = await ethers.getContractAt("PetNFTLibrary", PET_NFT_LIBRARY_ADDRESS);
    const estforLibrary = await ethers.getContractAt("EstforLibrary", ESTFOR_LIBRARY_ADDRESS);

    // const PetNFT = await ethers.getContractFactory("PetNFT", {
    //   libraries: {EstforLibrary: await estforLibrary.getAddress(), PetNFTLibrary: await petNFTLibrary.getAddress()},
    //   signer: proposer,
    // });
    // const petNFT = (await upgrades.prepareUpgrade(PET_NFT_ADDRESS, PetNFT, {
    //   kind: "uups",
    //   unsafeAllow: ["external-library-linking"],
    //   timeout,
    // })) as string;
    // console.log(`petNFT = "${petNFT.toLowerCase()}"`);
    /* Marketplace Release */

    /* Cosmetic Release */
    const PlayerNFT = await ethers.getContractFactory("PlayerNFT", {
      libraries: {EstforLibrary: await estforLibrary.getAddress()},
      signer: proposer,
    });
    const playerNFT = (await upgrades.prepareUpgrade(PLAYER_NFT_ADDRESS, PlayerNFT, {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout,
    })) as string;
    console.log(`playerNFT = "${playerNFT.toLowerCase()}"`);

    const Players = await ethers.getContractFactory("Players", proposer);
    const players = (await upgrades.prepareUpgrade(PLAYERS_ADDRESS, Players, {
      kind: "uups",
      unsafeAllow: ["delegatecall"],
      timeout,
    })) as string;
    console.log(`players = "${players.toLowerCase()}"`);

    const Cosmetics = await ethers.getContractFactory("Cosmetics", proposer);
    const cosmetics = (await upgrades.deployProxy(Cosmetics, [
      process.env.SAFE_ADDRESS,
      ITEM_NFT_ADDRESS,
      PLAYER_NFT_ADDRESS,
    ])) as unknown as Cosmetics;
    await cosmetics.waitForDeployment();
    console.log(`cosmetics = "${(await cosmetics.getAddress()).toLowerCase()}"`);

    // Shop
    const Shop = await ethers.getContractFactory("Shop", proposer);
    const shop = (await upgrades.prepareUpgrade(SHOP_ADDRESS, Shop, {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout,
    })) as string;
    console.log(`Shop new implementation = "${shop}"`);

    // can verify this immediately
    if (network.chainId == 146n) {
      await verifyContracts([await cosmetics.getAddress()]);
    }
    /* Cosmetic Release */

    const transactionSet: MetaTransactionData[] = [];
    const iface = new ethers.Interface([
      "function setMarketplaceAddress(address marketplaceAddress)",
      "function setApprovalForAll(address operator, bool approved)",
      "function setCosmeticsAddress(address cosmeticsAddress)",
      "function setApproved(address[] operators, bool approved)",
      "function setAvatars(uint256[] avatarsIds, (string,string,string,uint8[2] )[] avatarInfos)",
      "function setCosmetics(uint16[] cosmeticIds, (uint8,uint16,uint24)[] cosmeticInfos)",
      "function setSupporterPacks(uint24[] packIds, (uint80,uint16[],uint16[],uint16,uint32,uint96)[] packs)",
      "function setSupporterPackToken(address supporterPackTokenAddress)",
      "function approve(address spender, uint256 amount)",
    ]);

    transactionSet.push(getSafeUpgradeTransaction(PLAYER_NFT_ADDRESS, playerNFT));
    // transactionSet.push(getSafeUpgradeTransaction(PET_NFT_ADDRESS, petNFT));
    transactionSet.push(getSafeUpgradeTransaction(PLAYERS_ADDRESS, players));
    transactionSet.push(getSafeUpgradeTransaction(SHOP_ADDRESS, shop));

    // Set addresses and approvals
    transactionSet.push({
      to: ethers.getAddress(ITEM_NFT_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setApproved", [[await cosmetics.getAddress()], true]),
      operation: OperationType.Call,
    });
    // transactionSet.push({
    //   to: ethers.getAddress(PLAYER_NFT_ADDRESS),
    //   value: "0",
    //   data: iface.encodeFunctionData("setMarketplaceAddress", [await marketplace.getAddress()]),
    //   operation: OperationType.Call,
    // });
    transactionSet.push({
      to: ethers.getAddress(PLAYER_NFT_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setCosmeticsAddress", [await cosmetics.getAddress()]),
      operation: OperationType.Call,
    });
    // transactionSet.push({
    //   to: ethers.getAddress(PLAYER_NFT_ADDRESS),
    //   value: "0",
    //   data: iface.encodeFunctionData("setApprovalForAll", [await marketplace.getAddress(), true]),
    //   operation: OperationType.Call,
    // });
    // transactionSet.push({
    //   to: ethers.getAddress(PET_NFT_ADDRESS),
    //   value: "0",
    //   data: iface.encodeFunctionData("setMarketplaceAddress", [await marketplace.getAddress()]),
    //   operation: OperationType.Call,
    // });
    // transactionSet.push({
    //   to: ethers.getAddress(PET_NFT_ADDRESS),
    //   value: "0",
    //   data: iface.encodeFunctionData("setApprovalForAll", [await marketplace.getAddress(), true]),
    //   operation: OperationType.Call,
    // });

    transactionSet.push({
      to: ethers.getAddress(SHOP_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setSupporterPackToken", [USDC_ADDRESS]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(BRUSH_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("approve", [SHOP_ADDRESS, ethers.MaxUint256]),
      operation: OperationType.Call,
    });

    // Change for live release
    transactionSet.push({
      to: ethers.getAddress(PLAYER_NFT_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setAvatars", [
        [9, 10009],
        [
          ["COSMETIC_001", "", "9.jpg", [Skill.ALCHEMY, Skill.FORGING]],
          ["COSMETIC_001_EVOLVED", "", "10009.jpg", [Skill.ALCHEMY, Skill.FORGING]],
        ],
      ]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(await cosmetics.getAddress()),
      value: "0",
      data: iface.encodeFunctionData("setCosmetics", [
        cosmeticInfos.map((c) => c.itemTokenId),
        cosmeticInfos.map((c) => [c.cosmeticPosition, c.itemTokenId, c.avatarId]),
      ]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(SHOP_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setSupporterPacks", [
        [1],
        [
          [
            1,
            [
              EstforConstants.BRONZE_ARMOR,
              EstforConstants.BRONZE_BOOTS,
              EstforConstants.BRONZE_HELMET,
              EstforConstants.BRONZE_GAUNTLETS,
            ],
            [1, 1, 1, 1],
            100,
            Math.floor(Date.now() / 1000),
            1,
          ],
        ],
      ]),
      operation: OperationType.Call,
    });
    await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
