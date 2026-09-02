import {ChildProcess, spawn} from "child_process"
import {createServer} from "net"
import {Interface, JsonRpcProvider, getAddress, toBeHex} from "ethers"
import {loadFoundryPreparedCreationCode} from "./deploymentArtifacts"
import type {DeploymentPlan} from "./deploymentInventory"
import type {DeploymentRegistry} from "./deploymentRegistry"
import {EIP1967_IMPLEMENTATION_SLOT, PLAYERS_IMPLEMENTATIONS, addressFromStorage} from "./deploymentSlots"
import {toRpcTransaction} from "./reconciliation"
import {verifyShopPostconditions} from "./shopReconciliation"
import {withCandidateLibraries} from "./upgradeReconciliation"
import {verifyDeploymentWiring} from "./deploymentWiring"

const readInterface = new Interface([
  "function implementation() view returns (address)",
  "function owner() view returns (address)",
])

export interface DeploymentSimulationResult {
  status: "passed" | "no-op"
  forkBlock: number
  candidateDeployments: Array<{contractName: string; address: string; transactionHash: string | null}>
  calls: Array<{operationId: string; estimatedGas: string; transactionHash: string}>
  postconditionsVerified: number
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") return reject(new Error("Could not allocate Anvil port"))
      server.close((error) => (error ? reject(error) : resolve(address.port)))
    })
  })
}

async function waitForAnvil(provider: JsonRpcProvider, child: ChildProcess): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Anvil exited before simulation started (status ${child.exitCode})`)
    try {
      await provider.getBlockNumber()
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }
  throw new Error("Timed out waiting for the pinned Anvil fork")
}

async function implementationAddress(
  provider: JsonRpcProvider,
  target: string,
  kind: "uups" | "beacon"
): Promise<string> {
  if (kind === "uups") {
    return addressFromStorage(await provider.getStorage(target, EIP1967_IMPLEMENTATION_SLOT))
  }
  const result = await provider.call({to: target, data: readInterface.encodeFunctionData("implementation")})
  return getAddress(readInterface.decodeFunctionResult("implementation", result)[0])
}

export async function simulateDeploymentPlan(
  rpcUrl: string,
  deployment: DeploymentRegistry,
  plan: DeploymentPlan
): Promise<DeploymentSimulationResult> {
  if (plan.operations.length === 0 && plan.upgrades.candidates.length === 0) {
    return {
      status: "no-op",
      forkBlock: plan.observationBlock.number,
      candidateDeployments: [],
      calls: [],
      postconditionsVerified: 0,
    }
  }
  const port = await freePort()
  const child = spawn(
    "anvil",
    [
      "--fork-url",
      rpcUrl,
      "--fork-block-number",
      String(plan.observationBlock.number),
      "--chain-id",
      String(plan.chainId),
      "--port",
      String(port),
      "--silent",
    ],
    {stdio: ["ignore", "ignore", "pipe"]}
  )
  let stderr = ""
  child.stderr?.on("data", (data) => (stderr += String(data)))
  const provider = new JsonRpcProvider(`http://127.0.0.1:${port}`, plan.chainId, {staticNetwork: true})
  try {
    await waitForAnvil(provider, child)
    const pinnedBlock = await provider.getBlock(plan.observationBlock.number)
    if (!pinnedBlock?.hash || pinnedBlock.hash.toLowerCase() !== plan.observationBlock.hash.toLowerCase()) {
      throw new Error(`Anvil fork block hash does not match reviewed observation block ${plan.observationBlock.hash}`)
    }

    const desiredDeployment = withCandidateLibraries(deployment, plan.upgrades.candidates)
    const candidateDeployments: DeploymentSimulationResult["candidateDeployments"] = []
    for (const candidate of plan.upgrades.candidates) {
      const existingCode = await provider.getCode(candidate.candidateAddress)
      if (existingCode !== "0x") {
        candidateDeployments.push({
          contractName: candidate.contractName,
          address: candidate.candidateAddress,
          transactionHash: null,
        })
        continue
      }
      await provider.send("anvil_impersonateAccount", [candidate.deployer])
      await provider.send("anvil_setBalance", [candidate.deployer, toBeHex(10n ** 20n)])
      const creation = loadFoundryPreparedCreationCode(
        candidate.contractName,
        desiredDeployment,
        candidate.constructorData ?? "0x"
      )
      if (creation.codeHash !== candidate.creationCodeHash)
        throw new Error(`Creation code changed for ${candidate.contractName}`)
      const transactionHash = (await provider.send("eth_sendTransaction", [
        {from: candidate.deployer, data: creation.code, nonce: toBeHex(candidate.nonce)},
      ])) as string
      const receipt = await provider.waitForTransaction(transactionHash)
      if (!receipt || receipt.status !== 1 || getAddress(receipt.contractAddress!) !== candidate.candidateAddress) {
        throw new Error(`Candidate simulation failed for ${candidate.contractName}`)
      }
      candidateDeployments.push({
        contractName: candidate.contractName,
        address: candidate.candidateAddress,
        transactionHash,
      })
    }

    const calls: DeploymentSimulationResult["calls"] = []
    for (const operation of plan.operations) {
      await provider.send("anvil_impersonateAccount", [operation.caller])
      await provider.send("anvil_setBalance", [operation.caller, toBeHex(10n ** 20n)])
      const transaction = toRpcTransaction(operation)
      await provider.call(transaction)
      operation.estimatedGas = (await provider.estimateGas(transaction)).toString()
      const transactionHash = (await provider.send("eth_sendTransaction", [transaction])) as string
      const receipt = await provider.waitForTransaction(transactionHash)
      if (!receipt || receipt.status !== 1) throw new Error(`Simulation transaction failed for ${operation.id}`)
      calls.push({operationId: operation.id, estimatedGas: operation.estimatedGas, transactionHash})
    }

    for (const candidate of plan.upgrades.candidates) {
      if (candidate.kind === "library" || candidate.kind === "implementation") continue
      const actual = await implementationAddress(provider, candidate.target, candidate.kind)
      if (actual !== candidate.candidateAddress)
        throw new Error(`Upgrade postcondition failed for ${candidate.contractName}`)
    }
    let postconditionsVerified = plan.upgrades.candidates.length
    for (const operation of plan.upgrades.operations) {
      if (operation.postcondition.type !== "players-implementations") continue
      const actual = await Promise.all(
        PLAYERS_IMPLEMENTATIONS.map(async ({slot}) =>
          addressFromStorage(await provider.getStorage(operation.target, slot))
        )
      )
      if (JSON.stringify(actual) !== JSON.stringify(operation.postcondition.expected)) {
        throw new Error(
          `Players implementation postcondition failed: expected ${operation.postcondition.expected}, found ${actual}`
        )
      }
      postconditionsVerified++
    }
    for (const contract of plan.contracts.filter(({ownerMatchesAuthority}) => ownerMatchesAuthority !== null)) {
      const result = await provider.call({to: contract.address, data: readInterface.encodeFunctionData("owner")})
      const owner = getAddress(readInterface.decodeFunctionResult("owner", result)[0])
      if (owner !== plan.authority.address) throw new Error(`Ownership postcondition failed for ${contract.name}`)
      postconditionsVerified++
    }
    const wiringFailures = await verifyDeploymentWiring(provider, deployment)
    if (wiringFailures.length !== 0) throw new Error(`Wiring postcondition failed: ${wiringFailures.join("; ")}`)
    postconditionsVerified += 6
    await verifyShopPostconditions(provider, plan.shop)
    postconditionsVerified += plan.shop.desired.length
    return {
      status: "passed",
      forkBlock: plan.observationBlock.number,
      candidateDeployments,
      calls,
      postconditionsVerified,
    }
  } catch (error) {
    if (child.exitCode !== null && stderr.trim()) throw new Error(`Anvil simulation failed: ${stderr.trim()}`)
    throw error
  } finally {
    provider.destroy()
    child.kill("SIGTERM")
  }
}
