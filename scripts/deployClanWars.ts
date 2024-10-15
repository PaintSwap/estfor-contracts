import {ethers, upgrades} from "hardhat";
import {
  ADMIN_ACCESS_ADDRESS,
  BANK_ADDRESS,
  BANK_FACTORY_ADDRESS,
  BANK_REGISTRY_ADDRESS,
  BRUSH_ADDRESS,
  CLANS_ADDRESS,
  DECORATOR_PROVIDER_ADDRESS,
  DEV_ADDRESS,
  FAKE_BRUSH_WFTM_LP_ADDRESS,
  ITEM_NFT_ADDRESS,
  ORACLE_ADDRESS,
  PLAYERS_ADDRESS,
  PLAYER_NFT_ADDRESS,
  SAMWITCH_VRF_ADDRESS,
  SHOP_ADDRESS,
} from "./contractAddresses";
import {allTerritories, allBattleSkills} from "./data/territories";
import {getChainId, verifyContracts} from "./utils";
import {BankRegistry, Clans, DecoratorProvider, ItemNFT, LockedBankVaults, Territories} from "../typechain-types";
import "dotenv/config";
import {allItems} from "./data/items";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {allShopItems, allShopItemsBeta} from "./data/shopItems";
import {FeeData} from "ethers";

async function main() {
  const [owner] = await ethers.getSigners();
  // const owner = await ethers.getImpersonatedSigner("0x316342122A9ae36de41B231260579b92F4C8Be7f");
  console.log(`Deploying clan wars contracts: ${owner.address} on chain id ${await getChainId(owner)}`);

  const timeout = 600 * 1000; // 10 minutes

  const estforLibrary = await ethers.deployContract("EstforLibrary");

  console.log(`estforLibrary = "${(await estforLibrary.getAddress()).toLowerCase()}"`);

  // Clan
  const Clans = (
    await ethers.getContractFactory("Clans", {
      libraries: {EstforLibrary: await estforLibrary.getAddress()},
    })
  ).connect(owner);
  const clans = (await upgrades.upgradeProxy(CLANS_ADDRESS, Clans, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  })) as unknown as Clans;

  console.log(`clans = "${(await clans.getAddress()).toLowerCase()}"`);

  const itemNFTLibrary = await ethers.deployContract("ItemNFTLibrary");
  await itemNFTLibrary.waitForDeployment();
  console.log(`itemNFTLibrary = "${(await itemNFTLibrary.getAddress()).toLowerCase()}"`);
  const ItemNFT = (
    await ethers.getContractFactory("ItemNFT", {
      libraries: {ItemNFTLibrary: await itemNFTLibrary.getAddress()},
    })
  ).connect(owner);
  const itemNFT = (await upgrades.upgradeProxy(ITEM_NFT_ADDRESS, ItemNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  })) as unknown as ItemNFT;

  console.log(`itemNFT = "${(await itemNFT.getAddress()).toLowerCase()}"`);

  // Had issues deploying locked bank vault & territories without manually increasing gas limit.
  // TODO: If upgrading OZ can use txOverrides for gas limit
  const FEE_DATA = {
    maxFeePerGas: ethers.parseUnits("35", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits("35", "gwei"),
  } as unknown as FeeData;

  const provider = new ethers.FallbackProvider([ethers.getDefaultProvider()], 1);
  provider.getFeeData = async () => FEE_DATA;

  const signer = new ethers.Wallet(process.env.PRIVATE_KEY as string, provider);
  signer.estimateGas = async () => {
    return 6_600_000n;
  };

  const isBeta = process.env.IS_BETA == "true";

  const mmrAttackDistance = isBeta ? 1 : 4;
  const lockedFundsPeriod = (isBeta ? 1 : 7) * 86400; // 7 days
  const LockedBankVaults = (
    await ethers.getContractFactory("LockedBankVaults", {libraries: {EstforLibrary: await estforLibrary.getAddress()}})
  ).connect(signer);
  const lockedBankVaults = (await upgrades.deployProxy(
    LockedBankVaults,
    [
      PLAYERS_ADDRESS,
      CLANS_ADDRESS,
      BRUSH_ADDRESS,
      BANK_FACTORY_ADDRESS,
      await itemNFT.getAddress(),
      SHOP_ADDRESS,
      DEV_ADDRESS,
      ORACLE_ADDRESS,
      SAMWITCH_VRF_ADDRESS,
      allBattleSkills,
      mmrAttackDistance,
      lockedFundsPeriod,
      ADMIN_ACCESS_ADDRESS,
      isBeta,
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout,
    },
  )) as unknown as LockedBankVaults;

  console.log(`lockedBankVaults = "${(await lockedBankVaults.getAddress()).toLowerCase()}"`);

  const Territories = (await ethers.getContractFactory("Territories")).connect(signer);
  const territories = (await upgrades.deployProxy(
    Territories,
    [
      allTerritories,
      PLAYERS_ADDRESS,
      CLANS_ADDRESS,
      BRUSH_ADDRESS,
      await lockedBankVaults.getAddress(),
      await itemNFT.getAddress(),
      ORACLE_ADDRESS,
      SAMWITCH_VRF_ADDRESS,
      allBattleSkills,
      ADMIN_ACCESS_ADDRESS,
      isBeta,
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout,
    },
  )) as unknown as Territories;

  console.log(`territories = "${(await territories.getAddress()).toLowerCase()}"`);

  const CombatantsHelper = await ethers.getContractFactory("CombatantsHelper", {
    libraries: {EstforLibrary: await estforLibrary.getAddress()},
  });
  const combatantsHelper = await upgrades.deployProxy(
    CombatantsHelper,
    [
      PLAYERS_ADDRESS,
      await clans.getAddress(),
      await territories.getAddress(),
      await lockedBankVaults.getAddress(),
      ADMIN_ACCESS_ADDRESS,
      isBeta,
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout,
    },
  );
  await combatantsHelper.waitForDeployment();
  console.log(`combatantsHelper = "${(await combatantsHelper.getAddress()).toLowerCase()}"`);

  const paintSwapArtGallery = "0x9076C96e01F6F13e1eC4832354dF970d245e124F";
  const paintSwapDecorator = "0xCb80F529724B9620145230A0C866AC2FACBE4e3D";

  const pid = 22;

  const newDecoratorProvider = true;
  let decoratorProvider: DecoratorProvider;
  if (newDecoratorProvider) {
    const DecoratorProvider = (await ethers.getContractFactory("DecoratorProvider")).connect(owner);
    decoratorProvider = (await upgrades.deployProxy(DecoratorProvider, [
      paintSwapDecorator,
      paintSwapArtGallery,
      await territories.getAddress(),
      BRUSH_ADDRESS,
      PLAYER_NFT_ADDRESS,
      DEV_ADDRESS,
      pid,
    ])) as unknown as DecoratorProvider;

    console.log(`decoratorProvider = "${(await decoratorProvider.getAddress()).toLowerCase()}"`);

    // deposit
    const lp = await ethers.getContractAt("MockBrushToken", FAKE_BRUSH_WFTM_LP_ADDRESS);
    let tx = await lp.connect(owner).approve(await decoratorProvider.getAddress(), ethers.MaxInt256);
    console.log("Approve lp for decorator provider");
    await tx.wait();
    tx = await decoratorProvider.connect(owner).deposit();
    await tx.wait();
    console.log("Deposit lp to decorator provider");
  } else {
    decoratorProvider = (await ethers.getContractAt(
      "DecoratorProvider",
      DECORATOR_PROVIDER_ADDRESS,
    )) as DecoratorProvider;
    const tx = await decoratorProvider.connect(owner).setTerritories(await territories.getAddress());
    await tx.wait();
    console.log("decoratorProvider.setTerritories");
  }

  // Bank
  const Bank = (await ethers.getContractFactory("Bank")).connect(owner);
  const bank = await upgrades.upgradeBeacon(BANK_ADDRESS, Bank);
  console.log(`Deployed bank beacon = "${(await bank.getAddress()).toLowerCase()}"`);
  await bank.waitForDeployment();

  const bankImplAddress = await upgrades.beacon.getImplementationAddress(BANK_ADDRESS);
  console.log(`bankImplAddress = "${bankImplAddress}"`);

  const BankRegistry = (await ethers.getContractFactory("BankRegistry")).connect(owner);
  const bankRegistry = (await upgrades.upgradeProxy(BANK_REGISTRY_ADDRESS, BankRegistry, {
    kind: "uups",
    timeout,
  })) as unknown as BankRegistry;

  console.log(`bankRegistry = "${(await bankRegistry.getAddress()).toLowerCase()}"`);

  let tx = await bankRegistry.connect(owner).setLockedBankVaults(await lockedBankVaults.getAddress());
  await tx.wait();
  console.log("bankRegistry.setLockedBankVaults");
  if (isBeta) {
    // Also update the old first week's beta clans
    tx = await bankRegistry.connect(owner).setBankImpl(bankImplAddress);
    await tx.wait();
    console.log("bankRegistry.setBankImpl");
  }

  tx = await clans
    .connect(owner)
    .setTerritoriesAndLockedBankVaults(await territories.getAddress(), await lockedBankVaults.getAddress());
  await tx.wait();
  console.log("clans.setTerritoriesAndLockedBankVaults");
  tx = await itemNFT
    .connect(owner)
    .setTerritoriesAndLockedBankVaults(await territories.getAddress(), await lockedBankVaults.getAddress());
  await tx.wait();
  console.log("itemNFT.setTerritoriesAndLockedBankVaults");

  // Add the new items (if not added yet)
  const items = allItems.filter(
    (item) =>
      item.tokenId === EstforConstants.PROTECTION_SHIELD ||
      item.tokenId === EstforConstants.DEVILISH_FINGERS ||
      item.tokenId === EstforConstants.MIRROR_SHIELD,
  );

  if (items.length !== 3) {
    console.log("Cannot find all items");
  } else {
    const itemExists = await itemNFT.exists(items[0].tokenId);
    if (!itemExists) {
      console.log("Before adding items");
      const tx = await itemNFT.connect(owner).addItems(items);
      await tx.wait();
      console.log("itemNFT.addItems");

      const _allShopItems = isBeta ? allShopItemsBeta : allShopItems;
      const _shopItems = new Set([
        EstforConstants.MIRROR_SHIELD,
        EstforConstants.PROTECTION_SHIELD,
        EstforConstants.DEVILISH_FINGERS,
      ]);
      const shopItems = _allShopItems.filter((shopItem) => _shopItems.has(shopItem.tokenId));

      if (shopItems.length !== 3) {
        console.log("Cannot find shop items");
      } else {
        const shop = await ethers.getContractAt("Shop", SHOP_ADDRESS);
        const tx = await shop.connect(owner).addBuyableItems(shopItems);
        await tx.wait();
      }
    } else {
      console.log("Items already added");
    }
  }

  const clanWars = [lockedBankVaults];
  for (const clanWar of clanWars) {
    try {
      tx = await clanWar
        .connect(owner)
        .setAddresses(await territories.getAddress(), await combatantsHelper.getAddress());
      await tx.wait();
    } catch (error) {
      console.error(`Error: ${error}`);
    }
  }

  if ((await getChainId(owner)) == 250n) {
    await verifyContracts([
      await decoratorProvider.getAddress(),
      await itemNFT.getAddress(),
      await clans.getAddress(),
      await bank.getAddress(),
      bankImplAddress,
      await lockedBankVaults.getAddress(),
      await territories.getAddress(),
      await bankRegistry.getAddress(),
      bankImplAddress,
      await combatantsHelper.getAddress(),
    ]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
