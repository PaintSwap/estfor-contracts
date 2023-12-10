import {ethers, upgrades} from "hardhat";
import {
  ADMIN_ACCESS_ADDRESS,
  BANK_ADDRESS,
  BANK_FACTORY_ADDRESS,
  BANK_REGISTRY_ADDRESS,
  BRUSH_ADDRESS,
  CLANS_ADDRESS,
  ESTFOR_LIBRARY_ADDRESS,
  FAKE_BRUSH_WFTM_LP_ADDRESS,
  PLAYERS_ADDRESS,
  PLAYERS_LIBRARY_ADDRESS,
} from "./contractAddresses";
import {allTerritories, allTerritorySkills} from "./data/terrorities";
import {verifyContracts} from "./utils";
import {BankRegistry, DecoratorProvider} from "../typechain-types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploying clan wars contracts: ${owner.address} on chain id ${await owner.getChainId()}`);

  const timeout = 600 * 1000; // 10 minutes
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

  const oracleAddress = "0xd5d517abe5cf79b7e95ec98db0f0277788aff634";
  const battlesSubscriptionId = 97;
  const LockedBankVault = await ethers.getContractFactory("LockedBankVault", {
    libraries: {ClanBattleLibrary: clanBattleLibrary.address},
  });
  const lockedBankVault = await upgrades.deployProxy(
    LockedBankVault,
    [
      PLAYERS_ADDRESS,
      CLANS_ADDRESS,
      BRUSH_ADDRESS,
      BANK_FACTORY_ADDRESS,
      allTerritorySkills,
      oracleAddress,
      battlesSubscriptionId,
    ],
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout,
    }
  );
  await lockedBankVault.deployed();
  console.log(`lockedBankVault = "${lockedBankVault.address.toLowerCase()}"`);

  const isBeta = process.env.IS_BETA == "true";
  const Territories = await ethers.getContractFactory("Territories", {
    libraries: {ClanBattleLibrary: clanBattleLibrary.address},
  });
  const territories = await upgrades.deployProxy(
    Territories,
    [
      allTerritories,
      PLAYERS_ADDRESS,
      CLANS_ADDRESS,
      BRUSH_ADDRESS,
      lockedBankVault.address,
      allTerritorySkills,
      oracleAddress,
      battlesSubscriptionId,
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

  const paintSwapArtGallery = "0x9076C96e01F6F13e1eC4832354dF970d245e124F";
  const paintSwapDecorator = "0xCb80F529724B9620145230A0C866AC2FACBE4e3D";

  const pid = 22;
  let devAddress = "0x045eF160107eD663D10c5a31c7D2EC5527eea1D0";

  const DecoratorProvider = await ethers.getContractFactory("DecoratorProvider");
  const decoratorProvider = (await upgrades.deployProxy(DecoratorProvider, [
    paintSwapDecorator,
    paintSwapArtGallery,
    territories.address,
    BRUSH_ADDRESS,
    devAddress,
    pid,
  ])) as DecoratorProvider;
  await decoratorProvider.deployed();
  console.log(`decoratorProvider = "${decoratorProvider.address.toLowerCase()}"`);

  // Bank
  const Bank = await ethers.getContractFactory("Bank");
  const bank = await upgrades.upgradeBeacon(BANK_ADDRESS, Bank);
  console.log("Deployed bank beacon", bank.address);
  await bank.deployed();

  const bankImplAddress = await upgrades.beacon.getImplementationAddress(BANK_ADDRESS);
  console.log("bankImplAddress", bankImplAddress);

  if (isBeta) {
    // Also update the old first week's beta clans
    const bankRegistry = (await ethers.getContractAt("BankRegistry", BANK_REGISTRY_ADDRESS)) as BankRegistry;
    await bankRegistry.setBankImpl(bankImplAddress);
  }

  let tx = await clans.setTerritoriesAndLockedBankVault(territories.address, lockedBankVault.address);
  await tx.wait();
  console.log("clans.setTerritoriesAndLockedBankVault");
  tx = await lockedBankVault.setTerritories(territories.address);
  await tx.wait();
  console.log("lockedBankVault.setTerritories");

  // deposit
  const lp = await ethers.getContractAt("MockBrushToken", FAKE_BRUSH_WFTM_LP_ADDRESS);
  tx = await lp.approve(decoratorProvider.address, ethers.constants.MaxUint256);
  console.log("Approve lp for decorator provider");
  await tx.wait();
  tx = await decoratorProvider.deposit();
  await tx.wait();
  console.log("Deposit lp to decorator provider");

  await verifyContracts([
    clans.address,
    bank.address,
    bankImplAddress,
    decoratorProvider.address,
    lockedBankVault.address,
    territories.address,
    clanBattleLibrary.address,
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
