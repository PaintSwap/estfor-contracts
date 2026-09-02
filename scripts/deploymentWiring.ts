import {Interface, JsonRpcProvider, getAddress, id} from "ethers"
import type {ContractName, DeploymentRegistry} from "./deploymentRegistry"

const wiringInterface = new Interface([
  "function isForceItemDepositor(address) view returns (bool)",
  "function hasRole(bytes32,address) view returns (bool)",
  "function getStrategy(uint8) view returns (address)",
])

export interface WiringCheck {
  name: string
  target: ContractName
  method: "isForceItemDepositor" | "hasRole" | "getStrategy"
  arguments: readonly unknown[]
  expected: boolean | string
}

function desiredChecks(deployment: DeploymentRegistry): WiringCheck[] {
  const address = (name: ContractName) => getAddress(deployment.contracts[name].address)
  return [
    {
      name: "activity-points-force-depositor",
      target: "bankRegistry",
      method: "isForceItemDepositor",
      arguments: [address("activityPoints")],
      expected: true,
    },
    {
      name: "raids-force-depositor",
      target: "bankRegistry",
      method: "isForceItemDepositor",
      arguments: [address("raids")],
      expected: true,
    },
    {
      name: "players-activity-caller",
      target: "activityPoints",
      method: "hasRole",
      arguments: [id("ACTIVITY_POINT_CALLER"), address("players")],
      expected: true,
    },
    ...([1, 2, 3] as const).map((strategy) => ({
      name: `instant-vrf-strategy-${strategy}`,
      target: "instantVRFActions" as const,
      method: "getStrategy" as const,
      arguments: [strategy],
      expected: address(strategy === 3 ? "eggInstantVRFActionStrategy" : "genericInstantVRFActionStrategy"),
    })),
  ]
}

export async function verifyDeploymentWiring(
  provider: JsonRpcProvider,
  deployment: DeploymentRegistry,
  blockTag?: number
): Promise<string[]> {
  const failures: string[] = []
  for (const check of desiredChecks(deployment)) {
    try {
      const result = await provider.call({
        to: deployment.contracts[check.target].address,
        data: wiringInterface.encodeFunctionData(check.method, check.arguments),
        blockTag,
      })
      const actual = wiringInterface.decodeFunctionResult(check.method, result)[0]
      const normalized = typeof check.expected === "string" ? getAddress(actual) : Boolean(actual)
      if (normalized !== check.expected) failures.push(`${check.name}: expected ${check.expected}, found ${normalized}`)
    } catch (error) {
      failures.push(`${check.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return failures
}
