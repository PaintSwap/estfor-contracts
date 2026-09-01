import {JsonRpcProvider} from "ethers";
import {getSelectedDeploymentId, loadDeploymentRegistry, validateDeploymentOnChain} from "./deploymentRegistry";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

async function main() {
  const deploymentId = option("--deployment") ?? getSelectedDeploymentId();
  const rpcUrl = process.env.RPC_URL ?? process.env.SONIC_RPC;
  if (!rpcUrl) throw new Error("RPC_URL or SONIC_RPC is required");

  const deployment = loadDeploymentRegistry(deploymentId);
  const result = await validateDeploymentOnChain(deployment, new JsonRpcProvider(rpcUrl));
  console.log(
    `Validated ${result.deploymentId} on chain ${result.chainId}: ${result.checkedContracts} contracts, ` +
      `${result.checkedExternals} externals, Safe ${result.safe} (${result.safeThreshold}/${result.safeOwners})`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
