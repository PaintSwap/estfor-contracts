import {spawnSync} from "child_process"
import {getDeploymentRegistryPath, getSelectedDeploymentId, loadDeploymentRegistry} from "./deploymentRegistry"

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index === -1) return undefined
  const value = process.argv[index + 1]
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`)
  return value
}

async function main() {
  const deploymentId = option("--deployment") ?? getSelectedDeploymentId()
  const rpcUrl = process.env.RPC_URL ?? process.env.SONIC_RPC
  if (!rpcUrl) throw new Error("RPC_URL or SONIC_RPC is required")

  loadDeploymentRegistry(deploymentId)
  const result = spawnSync(
    "forge",
    [
      "script",
      "scripts/ValidateDeploymentRegistry.s.sol:ValidateDeploymentRegistry",
      "--rpc-url",
      rpcUrl,
      "--sig",
      "run()",
    ],
    {
      env: {...process.env, DEPLOYMENT_INPUT: getDeploymentRegistryPath(deploymentId)},
      stdio: "inherit",
    }
  )
  if (result.error) throw result.error
  if (result.status !== 0) process.exitCode = result.status ?? 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
