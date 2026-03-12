import {ethers, upgrades} from "hardhat";
import {initialiseSafe, sendTransactionSetToSafe, getSafeUpgradeTransaction, verifyContracts} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";
import {
  UsageBasedSessionModule,
  GameSubsidisationRegistry,
  UsageBasedSessionModule__factory,
  GameSubsidisationRegistry__factory,
} from "../typechain-types";
import {
  BLACK_MARKET_TRADER_ADDRESS,
  CLAN_BATTLE_LIBRARY_ADDRESS,
  ESTFOR_LIBRARY_ADDRESS,
  INSTANT_VRF_ACTIONS_ADDRESS,
  LOCKED_BANK_VAULTS_ADDRESS,
  LOCKED_BANK_VAULTS_LIBRARY_ADDRESS,
  PLAYERS_LIBRARY_ADDRESS,
  PVP_BATTLEGROUND_ADDRESS,
  RAIDS_ADDRESS,
  SUBSIDY_SIGNERS,
  TERRITORIES_ADDRESS,
} from "./contractAddresses";
import {groups} from "./data/groupSubsidyLimits";
import {parseEther} from "ethers";

async function main() {
  const [owner, , proposer] = await ethers.getSigners(); // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(
    `Deploy account abstraction contracts using account: ${proposer.address} on chain id ${network.chainId}, useSafe: ${useSafe}`
  );

  const timeout = 60 * 1000; // 1 minute

  const usageBasedSessionModuleIface = UsageBasedSessionModule__factory.createInterface();
  const gameRegistryIface = GameSubsidisationRegistry__factory.createInterface();

  if (useSafe) {
    const GameSubsidisationRegistry = await ethers.getContractFactory("GameSubsidisationRegistry", proposer);
    const gameSubsidisationRegistry = (await upgrades.deployProxy(GameSubsidisationRegistry, [
      process.env.SAFE_ADDRESS,
    ])) as unknown as GameSubsidisationRegistry;
    await gameSubsidisationRegistry.waitForDeployment();
    console.log(`gameSubsidisationRegistry = "${(await gameSubsidisationRegistry.getAddress()).toLowerCase()}"`);

    const UsageBasedSessionModule = await ethers.getContractFactory("UsageBasedSessionModule", proposer);
    const usageBasedSessionModule = (await upgrades.deployProxy(UsageBasedSessionModule, [
      process.env.SAFE_ADDRESS,
      await gameSubsidisationRegistry.getAddress(),
    ])) as unknown as UsageBasedSessionModule;
    await usageBasedSessionModule.waitForDeployment();
    console.log(`usageBasedSessionModule = "${(await usageBasedSessionModule.getAddress()).toLowerCase()}"`);

    // can verify this immediately
    if (network.chainId == 146n) {
      await verifyContracts([await usageBasedSessionModule.getAddress()]);
      await verifyContracts([await gameSubsidisationRegistry.getAddress()]);
    }

    const BlackMarketTrader = await ethers.getContractFactory("BlackMarketTrader", proposer);
    const blackMarketTrader = (await upgrades.prepareUpgrade(BLACK_MARKET_TRADER_ADDRESS, BlackMarketTrader, {
      kind: "uups",
    })) as string;
    console.log(`blackMarketTrader = "${blackMarketTrader.toLowerCase()}"`);

    const InstantVRFActions = await ethers.getContractFactory("InstantVRFActions", proposer);
    const instantVRFActions = (await upgrades.prepareUpgrade(INSTANT_VRF_ACTIONS_ADDRESS, InstantVRFActions, {
      kind: "uups",
      timeout,
    })) as string;
    console.log(`instantVRFActions = "${instantVRFActions}"`);

    const PVPBattleground = await ethers.getContractFactory("PVPBattleground", proposer);
    const pvpBattleground = (await upgrades.prepareUpgrade(PVP_BATTLEGROUND_ADDRESS, PVPBattleground, {
      kind: "uups",
      timeout,
    })) as string;
    console.log(`pvpBattleground = "${pvpBattleground}"`);

    const estforLibrary = await ethers.getContractAt("EstforLibrary", ESTFOR_LIBRARY_ADDRESS);
    const clanBattleLibrary = await ethers.getContractAt("ClanBattleLibrary", CLAN_BATTLE_LIBRARY_ADDRESS);
    const lockedBankVaultsLibrary = await ethers.getContractAt(
      "LockedBankVaultsLibrary",
      LOCKED_BANK_VAULTS_LIBRARY_ADDRESS
    );
    const playersLibrary = await ethers.getContractAt("PlayersLibrary", PLAYERS_LIBRARY_ADDRESS);

    const LockedBankVaults = await ethers.getContractFactory("LockedBankVaults", {
      libraries: {
        EstforLibrary: await estforLibrary.getAddress(),
        LockedBankVaultsLibrary: await lockedBankVaultsLibrary.getAddress(),
        ClanBattleLibrary: await clanBattleLibrary.getAddress(),
      },
      signer: proposer,
    });
    const lockedBankVaults = (await upgrades.prepareUpgrade(LOCKED_BANK_VAULTS_ADDRESS, LockedBankVaults, {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout,
    })) as string;
    console.log(`lockedBankVaults = ${lockedBankVaults}`);

    const Territories = await ethers.getContractFactory("Territories", proposer);
    const territories = (await upgrades.prepareUpgrade(TERRITORIES_ADDRESS, Territories, {
      kind: "uups",
      timeout,
      unsafeSkipStorageCheck: true,
    })) as string;
    console.log(`territories = ${territories}`);

    const Raids = await ethers.getContractFactory("Raids", {
      libraries: {PlayersLibrary: await playersLibrary.getAddress()},
      signer: proposer,
    });
    const raids = (await upgrades.prepareUpgrade(RAIDS_ADDRESS, Raids, {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout,
    })) as string;
    console.log(`raids = ${raids}`);

    const transactionSet: MetaTransactionData[] = [];
    // Set addresses and approvals
    transactionSet.push(getSafeUpgradeTransaction(TERRITORIES_ADDRESS, territories));
    transactionSet.push(getSafeUpgradeTransaction(RAIDS_ADDRESS, raids));
    transactionSet.push(getSafeUpgradeTransaction(INSTANT_VRF_ACTIONS_ADDRESS, instantVRFActions));
    transactionSet.push(getSafeUpgradeTransaction(BLACK_MARKET_TRADER_ADDRESS, blackMarketTrader));
    transactionSet.push(getSafeUpgradeTransaction(LOCKED_BANK_VAULTS_ADDRESS, lockedBankVaults));
    transactionSet.push(getSafeUpgradeTransaction(PVP_BATTLEGROUND_ADDRESS, pvpBattleground));
    transactionSet.push({
      to: await usageBasedSessionModule.getAddress(),
      value: "0",
      data: usageBasedSessionModuleIface.encodeFunctionData("setWhitelistedSigner", [
        SUBSIDY_SIGNERS.map((s) => ethers.getAddress(s)),
        true,
      ]),
      operation: OperationType.Call,
    });

    const contractAddresses = groups.flatMap((g) => g.selectors.map((s) => ethers.getAddress(s.contract)));
    const selectors = groups.flatMap((g) => g.selectors.map((s) => s.selector));
    const groupIds = groups.flatMap((g) => g.selectors.map((s) => s.groupId));

    const limitGroupIds = groups.map((g) => g.groupId);
    const limits = groups.map((g) => g.limit);

    transactionSet.push({
      to: await gameSubsidisationRegistry.getAddress(),
      value: "0",
      data: gameRegistryIface.encodeFunctionData("setFunctionGroups", [contractAddresses, selectors, groupIds]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: await gameSubsidisationRegistry.getAddress(),
      value: "0",
      data: gameRegistryIface.encodeFunctionData("setGroupLimits", [limitGroupIds, limits]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: await gameSubsidisationRegistry.getAddress(),
      value: "0",
      data: gameRegistryIface.encodeFunctionData("registerFeeM"),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: await usageBasedSessionModule.getAddress(),
      value: "0",
      data: usageBasedSessionModuleIface.encodeFunctionData("registerFeeM"),
      operation: OperationType.Call,
    });
    let i = 0;
    for (const signer of SUBSIDY_SIGNERS) {
      let value = parseEther("10");
      if (i === 0) {
        value = parseEther("100");
      }
      transactionSet.push({
        to: signer,
        value: value.toString(),
        data: "0x",
        operation: OperationType.Call,
      });
      i++;
    }
    await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
