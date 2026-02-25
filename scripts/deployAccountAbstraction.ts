import {ethers, upgrades} from "hardhat";
import {initialiseSafe, sendTransactionSetToSafe, getSafeUpgradeTransaction, verifyContracts} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";
import {
  UsageBasedSessionModule,
  GameSubsidisationRegistry,
  UsageBasedSessionModule__factory,
  GameSubsidisationRegistry__factory,
} from "../typechain-types";
import {SUBSIDY_SIGNERS} from "./contractAddresses";
import {groups} from "./data/groupSubsidyLimits";

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

    const transactionSet: MetaTransactionData[] = [];
    // Set addresses and approvals
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
    await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
