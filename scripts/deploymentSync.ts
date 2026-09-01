import "dotenv/config";
import {spawnSync} from "child_process";
import {mkdirSync, writeFileSync} from "fs";
import {resolve} from "path";
import {JsonRpcProvider} from "ethers";
import {loadDeploymentRegistry} from "./deploymentRegistry";
import {buildDeploymentPlan, renderPlanMarkdown} from "./deploymentInventory";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

async function main() {
  if (process.argv.includes("--apply") || process.argv.includes("--resume")) {
    throw new Error("Phase 2 is read-only; --apply and --resume are not supported");
  }
  const deploymentId = option("--deployment");
  if (!deploymentId) throw new Error("--deployment is required (for example, sonic-live or sonic-beta)");
  const rpcUrl = process.env.RPC_URL ?? process.env.SONIC_RPC;
  if (!rpcUrl) throw new Error("RPC_URL or SONIC_RPC is required");
  const blockValue = option("--block");
  const block = blockValue === undefined ? undefined : Number(blockValue);
  if (block !== undefined && (!Number.isSafeInteger(block) || block < 0))
    throw new Error("--block must be a non-negative integer");

  const deployment = loadDeploymentRegistry(deploymentId);
  const build = spawnSync("forge", ["build"], {stdio: "inherit"});
  if (build.error) throw build.error;
  if (build.status !== 0) throw new Error(`forge build failed with status ${build.status}`);
  const provider = new JsonRpcProvider(rpcUrl, deployment.chainId, {staticNetwork: true});
  const plan = await buildDeploymentPlan(provider, deployment, block);
  const outputRoot = resolve(
    option("--output") ??
      `runs/${deploymentId}/${plan.observationBlock.number}-${plan.observationBlock.hash.slice(2, 10)}`
  );
  mkdirSync(outputRoot, {recursive: true});
  const jsonPath = resolve(outputRoot, "plan.json");
  const markdownPath = resolve(outputRoot, "plan.md");
  writeFileSync(jsonPath, `${JSON.stringify(plan, null, 2)}\n`);
  writeFileSync(markdownPath, renderPlanMarkdown(plan));

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${markdownPath}`);
  console.log(`Plan ${plan.planHash}: ${plan.summary.errors} errors, ${plan.summary.warnings} warnings, 0 operations`);
  if (plan.summary.errors !== 0) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
