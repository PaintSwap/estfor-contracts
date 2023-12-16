import {ethers, upgrades} from "hardhat";
import {
  ADMIN_ACCESS_ADDRESS,
  BANK_ADDRESS,
  BANK_FACTORY_ADDRESS,
  BANK_REGISTRY_ADDRESS,
  BRUSH_ADDRESS,
  CLANS_ADDRESS,
  DECORATOR_PROVIDER_ADDRESS,
  ESTFOR_LIBRARY_ADDRESS,
  FAKE_BRUSH_WFTM_LP_ADDRESS,
  PLAYERS_ADDRESS,
  PLAYERS_LIBRARY_ADDRESS,
  PLAYER_NFT_ADDRESS,
} from "./contractAddresses";
import {allTerritories, allTerritorySkills} from "./data/territories";
import {verifyContracts} from "./utils";
import {DecoratorProvider} from "../typechain-types";
import "dotenv/config";
import {execSync} from "child_process";
import path from "path";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploying clan wars contracts: ${owner.address} on chain id ${await owner.getChainId()}`);

  const timeout = 600 * 1000; // 10 minutes
  const isBeta = process.env.IS_BETA == "true";

  // Clan
  const Clans = await ethers.getContractFactory("Clans", {
    libraries: {EstforLibrary: ESTFOR_LIBRARY_ADDRESS},
  });
  const clans = await upgrades.upgradeProxy(CLANS_ADDRESS, Clans, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await clans.deployed();
  console.log(`clans = "${clans.address.toLowerCase()}"`);

  const clanBattleLibrary = await ethers.deployContract("ClanBattleLibrary", {
    libraries: {PlayersLibrary: PLAYERS_LIBRARY_ADDRESS},
  });
  await clanBattleLibrary.deployed();
  console.log(`clanBattleLibrary = "${clanBattleLibrary.address.toLowerCase()}"`);

  const airnodeRrpAddress = "0xa0AD79D995DdeeB18a14eAef56A549A04e3Aa1Bd";
  const airnode = "0x224e030f03Cd3440D88BD78C9BF5Ed36458A1A25";
  const xpub =
    "xpub6CyZcaXvbnbqGfqqZWvWNUbGvdd5PAJRrBeAhy9rz1bbnFmpVLg2wPj1h6TyndFrWLUG3kHWBYpwacgCTGWAHFTbUrXEg6LdLxoEBny2YDz";
  const endpointIdUint256 = "0xffd1bbe880e7b2c662f6c8511b15ff22d12a4a35d5c8c17202893a5f10e25284";
  const endpointIdUint256Array = "0x4554e958a68d68de6a4f6365ff868836780e84ac3cba75ce3f4c78a85faa8047";

  // Had issues deploying locked bank vault & territories without manually increasing gas limit.
  // TODO: If upgrading OZ can use txOverrides for gas limit
  const FEE_DATA = {
    maxFeePerGas: ethers.utils.parseUnits("200", "gwei"),
    maxPriorityFeePerGas: ethers.utils.parseUnits("200", "gwei"),
  };

  const provider = new ethers.providers.FallbackProvider([ethers.provider], 1);
  provider.getFeeData = async () => FEE_DATA;

  const signer = new ethers.Wallet(process.env.PRIVATE_KEY as string, provider);
  signer.estimateGas = async (transaction) => {
    return ethers.BigNumber.from(5_000_000);
  };

  const LockedBankVault = (
    await ethers.getContractFactory("LockedBankVault", {
      libraries: {ClanBattleLibrary: clanBattleLibrary.address},
    })
  ).connect(signer);
  const lockedBankVault = await upgrades.deployProxy(
    LockedBankVault,
    [
      PLAYERS_ADDRESS,
      CLANS_ADDRESS,
      BRUSH_ADDRESS,
      BANK_FACTORY_ADDRESS,
      allTerritorySkills,
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
  await lockedBankVault.deployed();
  console.log(`lockedBankVault = "${lockedBankVault.address.toLowerCase()}"`);

  const Territories = (
    await ethers.getContractFactory("Territories", {
      libraries: {ClanBattleLibrary: clanBattleLibrary.address},
    })
  ).connect(signer);
  const territories = await upgrades.deployProxy(
    Territories,
    [
      allTerritories,
      PLAYERS_ADDRESS,
      CLANS_ADDRESS,
      BRUSH_ADDRESS,
      lockedBankVault.address,
      allTerritorySkills,
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
    libraries: {EstforLibrary: ESTFOR_LIBRARY_ADDRESS},
  });
  const combatantsHelper = await upgrades.deployProxy(
    CombatantsHelper,
    [PLAYERS_ADDRESS, clans.address, territories.address, lockedBankVault.address],
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
  let devAddress = "0x045eF160107eD663D10c5a31c7D2EC5527eea1D0";

  const newDecoratorProvider = false;
  let decoratorProvider: DecoratorProvider;
  if (newDecoratorProvider) {
    const DecoratorProvider = await ethers.getContractFactory("DecoratorProvider");
    decoratorProvider = (await upgrades.deployProxy(DecoratorProvider, [
      paintSwapDecorator,
      paintSwapArtGallery,
      territories.address,
      BRUSH_ADDRESS,
      PLAYER_NFT_ADDRESS,
      devAddress,
      pid,
    ])) as DecoratorProvider;
    await decoratorProvider.deployed();
    console.log(`decoratorProvider = "${decoratorProvider.address.toLowerCase()}"`);

    // deposit
    const lp = await ethers.getContractAt("MockBrushToken", FAKE_BRUSH_WFTM_LP_ADDRESS);
    let tx = await lp.approve(decoratorProvider.address, ethers.constants.MaxUint256);
    console.log("Approve lp for decorator provider");
    await tx.wait();
    tx = await decoratorProvider.deposit();
    await tx.wait();
    console.log("Deposit lp to decorator provider");
  } else {
    decoratorProvider = (await ethers.getContractAt(
      "DecoratorProvider",
      DECORATOR_PROVIDER_ADDRESS
    )) as DecoratorProvider;
    const tx = await decoratorProvider.setTerritories(territories.address);
    await tx.wait();
    console.log("decoratorProvider.setTerritories");
  }

  // Bank
  const Bank = await ethers.getContractFactory("Bank");
  const bank = await upgrades.upgradeBeacon(BANK_ADDRESS, Bank);
  console.log("Deployed bank beacon", bank.address);
  await bank.deployed();

  const bankImplAddress = await upgrades.beacon.getImplementationAddress(BANK_ADDRESS);
  console.log(`bankImplAddress = "${bankImplAddress}"`);

  const BankRegistry = await ethers.getContractFactory("BankRegistry");
  const bankRegistry = await upgrades.upgradeProxy(BANK_REGISTRY_ADDRESS, BankRegistry, {
    kind: "uups",
    timeout,
  });
  await bankRegistry.deployed();
  console.log(`bankRegistry = "${bankRegistry.address.toLowerCase()}"`);

  let tx = await bankRegistry.setLockedBankVault(lockedBankVault.address);
  await tx.wait();
  console.log("bankRegistry.setLockedBankVault");
  if (isBeta) {
    // Also update the old first week's beta clans
    tx = await bankRegistry.setBankImpl(bankImplAddress);
    await tx.wait();
    console.log("bankRegistry.setBankImpl");
  }

  tx = await clans.setTerritoriesAndLockedBankVault(territories.address, lockedBankVault.address);
  await tx.wait();
  console.log("clans.setTerritoriesAndLockedBankVault");
  tx = await lockedBankVault.setTerritories(territories.address);

  const sponsorWalletCallers = [territories, lockedBankVault];
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

      tx = await sponsorWalletCaller.setCombatantsHelper(combatantsHelper.address);
      await tx.wait();
      console.log("setCombatantsHelper");
      tx = await sponsorWalletCaller.setSponsorWallet(sponsorWallet);
      await tx.wait();
      console.log(`setSponsorWallet = "${sponsorWallet}"`);
    } catch (error) {
      console.error(`Error: ${error}`);
    }
  }

  await verifyContracts([
    decoratorProvider.address,
    clans.address,
    bank.address,
    bankImplAddress,
    lockedBankVault.address,
    territories.address,
    clanBattleLibrary.address,
    bankRegistry.address,
    bankImplAddress,
    combatantsHelper.address,
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
