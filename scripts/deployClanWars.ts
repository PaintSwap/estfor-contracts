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
  ORACLE_FALLBACK_ADDRESS,
  PLAYERS_ADDRESS,
  PLAYER_NFT_ADDRESS,
  SHOP_ADDRESS,
} from "./contractAddresses";
import {allTerritories, allBattleSkills} from "./data/territories";
import {verifyContracts} from "./utils";
import {DecoratorProvider, ItemNFT} from "../typechain-types";
import "dotenv/config";
import {execSync} from "child_process";
import path from "path";
import {allItems} from "./data/items";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {allShopItems, allShopItemsBeta} from "./data/shopItems";
import {FeeData} from "@ethersproject/providers";

async function main() {
  const [owner] = await ethers.getSigners();
  // const owner = await ethers.getImpersonatedSigner("0x316342122A9ae36de41B231260579b92F4C8Be7f");
  console.log(`Deploying clan wars contracts: ${owner.address} on chain id ${await owner.getChainId()}`);

  const timeout = 600 * 1000; // 10 minutes
  const isBeta = process.env.IS_BETA == "true";

  const estforLibrary = await ethers.deployContract("EstforLibrary");
  await estforLibrary.deployed();
  console.log(`estforLibrary = "${estforLibrary.address.toLowerCase()}"`);

  // Clan
  const Clans = (
    await ethers.getContractFactory("Clans", {
      libraries: {EstforLibrary: estforLibrary.address},
    })
  ).connect(owner);
  const clans = await upgrades.upgradeProxy(CLANS_ADDRESS, Clans, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await clans.deployed();
  console.log(`clans = "${clans.address.toLowerCase()}"`);

  const itemNFTLibrary = await ethers.deployContract("ItemNFTLibrary");
  await itemNFTLibrary.deployed();
  console.log(`itemNFTLibrary = "${itemNFTLibrary.address.toLowerCase()}"`);
  const ItemNFT = (
    await ethers.getContractFactory("ItemNFT", {
      libraries: {ItemNFTLibrary: itemNFTLibrary.address},
    })
  ).connect(owner);
  const itemNFT = (await upgrades.upgradeProxy(ITEM_NFT_ADDRESS, ItemNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  })) as ItemNFT;
  await itemNFT.deployed();
  console.log(`itemNFT = "${itemNFT.address.toLowerCase()}"`);

  const airnodeRrpAddress = "0xa0AD79D995DdeeB18a14eAef56A549A04e3Aa1Bd";
  const airnode = "0x224e030f03Cd3440D88BD78C9BF5Ed36458A1A25";
  const xpub =
    "xpub6CyZcaXvbnbqGfqqZWvWNUbGvdd5PAJRrBeAhy9rz1bbnFmpVLg2wPj1h6TyndFrWLUG3kHWBYpwacgCTGWAHFTbUrXEg6LdLxoEBny2YDz";
  const endpointIdUint256 = "0xffd1bbe880e7b2c662f6c8511b15ff22d12a4a35d5c8c17202893a5f10e25284";
  const endpointIdUint256Array = "0x4554e958a68d68de6a4f6365ff868836780e84ac3cba75ce3f4c78a85faa8047";

  // Had issues deploying locked bank vault & territories without manually increasing gas limit.
  // TODO: If upgrading OZ can use txOverrides for gas limit
  const FEE_DATA = {
    maxFeePerGas: ethers.utils.parseUnits("35", "gwei"),
    maxPriorityFeePerGas: ethers.utils.parseUnits("35", "gwei"),
  } as FeeData;

  const provider = new ethers.providers.FallbackProvider([ethers.provider], 1);
  provider.getFeeData = async () => FEE_DATA;

  const signer = new ethers.Wallet(process.env.PRIVATE_KEY as string, provider);
  signer.estimateGas = async () => {
    return ethers.BigNumber.from(6_600_000);
  };

  const LockedBankVaults = (await ethers.getContractFactory("LockedBankVaults")).connect(signer);
  const lockedBankVaults = await upgrades.deployProxy(
    LockedBankVaults,
    [
      PLAYERS_ADDRESS,
      CLANS_ADDRESS,
      BRUSH_ADDRESS,
      BANK_FACTORY_ADDRESS,
      itemNFT.address,
      SHOP_ADDRESS,
      DEV_ADDRESS,
      ORACLE_FALLBACK_ADDRESS,
      allBattleSkills,
      airnodeRrpAddress,
      airnode,
      endpointIdUint256,
      endpointIdUint256Array,
      ADMIN_ACCESS_ADDRESS,
      isBeta,
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout,
    }
  );
  await lockedBankVaults.deployed();
  console.log(`lockedBankVaults = "${lockedBankVaults.address.toLowerCase()}"`);

  const Territories = (await ethers.getContractFactory("Territories")).connect(signer);
  const territories = await upgrades.deployProxy(
    Territories,
    [
      allTerritories,
      PLAYERS_ADDRESS,
      CLANS_ADDRESS,
      BRUSH_ADDRESS,
      lockedBankVaults.address,
      itemNFT.address,
      ORACLE_FALLBACK_ADDRESS,
      allBattleSkills,
      airnodeRrpAddress,
      airnode,
      endpointIdUint256,
      endpointIdUint256Array,
      ADMIN_ACCESS_ADDRESS,
      isBeta,
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout,
    }
  );
  await territories.deployed();
  console.log(`territories = "${territories.address.toLowerCase()}"`);

  const CombatantsHelper = await ethers.getContractFactory("CombatantsHelper", {
    libraries: {EstforLibrary: estforLibrary.address},
  });
  const combatantsHelper = await upgrades.deployProxy(
    CombatantsHelper,
    [PLAYERS_ADDRESS, clans.address, territories.address, lockedBankVaults.address, ADMIN_ACCESS_ADDRESS, isBeta],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout,
    }
  );
  await combatantsHelper.deployed();
  console.log(`combatantsHelper = "${combatantsHelper.address.toLowerCase()}"`);

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
      territories.address,
      BRUSH_ADDRESS,
      PLAYER_NFT_ADDRESS,
      DEV_ADDRESS,
      pid,
    ])) as DecoratorProvider;
    await decoratorProvider.deployed();
    console.log(`decoratorProvider = "${decoratorProvider.address.toLowerCase()}"`);

    // deposit
    const lp = await ethers.getContractAt("MockBrushToken", FAKE_BRUSH_WFTM_LP_ADDRESS);
    let tx = await lp.connect(owner).approve(decoratorProvider.address, ethers.constants.MaxUint256);
    console.log("Approve lp for decorator provider");
    await tx.wait();
    tx = await decoratorProvider.connect(owner).deposit();
    await tx.wait();
    console.log("Deposit lp to decorator provider");
  } else {
    decoratorProvider = (await ethers.getContractAt(
      "DecoratorProvider",
      DECORATOR_PROVIDER_ADDRESS
    )) as DecoratorProvider;
    const tx = await decoratorProvider.connect(owner).setTerritories(territories.address);
    await tx.wait();
    console.log("decoratorProvider.setTerritories");
  }

  // Bank
  const Bank = (await ethers.getContractFactory("Bank")).connect(owner);
  const bank = await upgrades.upgradeBeacon(BANK_ADDRESS, Bank);
  console.log(`Deployed bank beacon = "${bank.address.toLowerCase()}"`);
  await bank.deployed();

  const bankImplAddress = await upgrades.beacon.getImplementationAddress(BANK_ADDRESS);
  console.log(`bankImplAddress = "${bankImplAddress}"`);

  const BankRegistry = (await ethers.getContractFactory("BankRegistry")).connect(owner);
  const bankRegistry = await upgrades.upgradeProxy(BANK_REGISTRY_ADDRESS, BankRegistry, {
    kind: "uups",
    timeout,
  });
  await bankRegistry.deployed();
  console.log(`bankRegistry = "${bankRegistry.address.toLowerCase()}"`);

  let tx = await bankRegistry.connect(owner).setLockedBankVaults(lockedBankVaults.address);
  await tx.wait();
  console.log("bankRegistry.setLockedBankVaults");
  if (isBeta) {
    // Also update the old first week's beta clans
    tx = await bankRegistry.connect(owner).setBankImpl(bankImplAddress);
    await tx.wait();
    console.log("bankRegistry.setBankImpl");
  }

  tx = await clans.connect(owner).setTerritoriesAndLockedBankVaults(territories.address, lockedBankVaults.address);
  await tx.wait();
  console.log("clans.setTerritoriesAndLockedBankVaults");
  tx = await itemNFT.connect(owner).setTerritoriesAndLockedBankVaults(territories.address, lockedBankVaults.address);
  await tx.wait();
  console.log("itemNFT.setTerritoriesAndLockedBankVaults");
  tx = await lockedBankVaults.connect(owner).setTerritories(territories.address);
  await tx.wait();
  console.log("lockedBankVaults.setTerritories");

  // Add the new items (if not added yet)
  const items = allItems.filter(
    (item) =>
      item.tokenId === EstforConstants.PROTECTION_SHIELD ||
      item.tokenId === EstforConstants.DEVILISH_FINGERS ||
      item.tokenId === EstforConstants.MIRROR_SHIELD
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

  const sponsorWalletCallers = [lockedBankVaults, territories];
  for (const sponsorWalletCaller of sponsorWalletCallers) {
    const command = `${path.join(
      "node_modules",
      ".bin",
      "airnode-admin"
    )} derive-sponsor-wallet-address  --airnode-address ${airnode} --airnode-xpub ${xpub} --sponsor-address ${
      sponsorWalletCaller.address
    }`;

    try {
      const result = execSync(command, {encoding: "utf-8"});
      const arr = result.split(": ");
      // Extract the wallet address from the output
      const sponsorWallet = arr[1].slice(0, 42);

      tx = await sponsorWalletCaller.connect(owner).setCombatantsHelper(combatantsHelper.address);
      await tx.wait();
      console.log("setCombatantsHelper");
      tx = await sponsorWalletCaller.connect(owner).setSponsorWallet(sponsorWallet);
      await tx.wait();
      console.log(`setSponsorWallet = "${sponsorWallet.toLowerCase()}"`);
      tx = await owner.sendTransaction({to: sponsorWallet, value: ethers.utils.parseEther("100")});
      await tx.wait();
      console.log();
    } catch (error) {
      console.error(`Error: ${error}`);
    }
  }

  if ((await owner.getChainId()) == 250) {
    await verifyContracts([
      decoratorProvider.address,
      itemNFT.address,
      clans.address,
      bank.address,
      bankImplAddress,
      lockedBankVaults.address,
      territories.address,
      bankRegistry.address,
      bankImplAddress,
      combatantsHelper.address,
    ]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
