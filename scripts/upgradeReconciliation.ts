import {createHash} from "crypto"
import {spawnSync} from "child_process"
import {existsSync, readFileSync, renameSync, writeFileSync} from "fs"
import {resolve} from "path"
import {Interface, JsonRpcProvider, Wallet, getAddress, getCreateAddress, keccak256} from "ethers"
import {
  BytecodeClassification,
  compareRuntimeBytecode,
  foundryLibraryArguments,
  loadFoundryPreparedCreationCode,
  loadArtifactFingerprint,
  loadImplementationCreationCode,
} from "./deploymentArtifacts"
import type {ContractKind, ContractName, DeploymentRegistry} from "./deploymentRegistry"
import type {ReconciliationOperation} from "./reconciliation"

const upgradeInterface = new Interface([
  "function upgradeToAndCall(address newImplementation,bytes data) payable",
  "function upgradeTo(address newImplementation)",
])

export interface UpgradeInventoryInput {
  name: ContractName
  kind: ContractKind
  address: string
  implementationAddress: string
  classification: BytecodeClassification
}

export interface UpgradeCandidate {
  contractName: ContractName
  kind: "uups" | "beacon" | "library"
  target: string
  currentImplementation: string
  candidateAddress: string
  deployer: string
  nonce: number
  status: "planned" | "reused"
  fullyQualifiedName: string
  creationCodeHash: string
  creationCodeSize: number
  libraryDependencies: ContractName[]
  validation: {status: "passed"; outputHash: string; output: string} | {status: "not-applicable"}
  operationId: string | null
}

export type UpgradeOperation = ReconciliationOperation<
  "uups-implementation" | "beacon-implementation",
  {
    type: "implementation-address"
    expected: string
  }
> & {domain: "deployment-infrastructure"; contractName: ContractName}

export interface UpgradePlan {
  candidates: UpgradeCandidate[]
  operations: UpgradeOperation[]
  blockedReasons: string[]
  validationFailures: Array<{contractName: ContractName; output: string}>
}

export interface UpgradePlanOptions {
  deployerAddress?: string
  deployerNonce?: number
  reusableCandidates?: Partial<Record<ContractName, string>>
  validate?: (fullyQualifiedName: string) => {status: "passed"; outputHash: string; output: string}
}

export interface CandidateDeploymentJournal {
  schemaVersion: 1
  deploymentId: string
  planHash: string
  contractName: ContractName
  deployer: string
  nonce: number
  candidateAddress: string
  creationCodeHash: string
  status: "prepared" | "submitted" | "confirmed"
  transactionHash: string | null
  receipt: {blockNumber: number; blockHash: string; status: number; gasUsed: string} | null
}

const validationCache = new Map<string, {status: "passed"; outputHash: string; output: string}>()

class UpgradeValidationError extends Error {
  constructor(readonly output: string) {
    super("OpenZeppelin upgrade validation failed; add and validate the required archived reference contract")
  }
}

function sha256(value: string | Buffer): string {
  return `0x${createHash("sha256").update(value).digest("hex")}`
}

function validateUpgrade(fullyQualifiedName: string): {status: "passed"; outputHash: string; output: string} {
  const cached = validationCache.get(fullyQualifiedName)
  if (cached) return cached
  const validation = spawnSync("bash", ["scripts/validate-foundry-upgrade.sh", fullyQualifiedName], {
    cwd: resolve(__dirname, ".."),
    encoding: "utf8",
  })
  const output = validation.stdout + validation.stderr
  if (validation.error || validation.status !== 0) {
    throw new UpgradeValidationError(output)
  }
  const result = {status: "passed" as const, outputHash: sha256(output), output}
  validationCache.set(fullyQualifiedName, result)
  return result
}

function requiresUpgrade(classification: BytecodeClassification): boolean {
  return (
    classification === "executable-drift" || classification === "library-drift" || classification === "immutable-drift"
  )
}

function isAlignedRuntime(classification: BytecodeClassification): boolean {
  return classification === "exact-match" || classification === "build-metadata-drift"
}

export async function buildUpgradePlan(
  provider: JsonRpcProvider,
  deployment: DeploymentRegistry,
  blockTag: number,
  contracts: UpgradeInventoryInput[],
  options: UpgradePlanOptions = {}
): Promise<UpgradePlan> {
  const blockedReasons: string[] = []
  const validationFailures: UpgradePlan["validationFailures"] = []
  const candidates: UpgradeCandidate[] = []
  const operations: UpgradeOperation[] = []
  const byName = new Map(contracts.map((contract) => [contract.name, contract]))
  const drift = contracts.filter(({classification}) => requiresUpgrade(classification))
  const unknown = contracts.filter(({classification}) => classification === "unknown")
  for (const contract of unknown) {
    blockedReasons.push(`${contract.name}: bytecode comparison is unknown`)
  }
  for (const contract of drift.filter(({kind}) => kind === "implementation")) {
    blockedReasons.push(`${contract.name}: ${contract.kind} drift has no authority-controlled upgrade target`)
  }

  const upgradeable = drift.filter(
    (contract): contract is UpgradeInventoryInput & {kind: "uups" | "beacon"} =>
      contract.kind === "uups" || contract.kind === "beacon"
  )
  const libraries = drift.filter(
    (contract): contract is UpgradeInventoryInput & {kind: "library"} => contract.kind === "library"
  )
  if (upgradeable.length === 0 && libraries.length === 0) {
    return {candidates, operations, blockedReasons, validationFailures}
  }
  if (!options.deployerAddress) {
    blockedReasons.push("Code deployments require the address derived from PROPOSER_PRIVATE_KEY")
    return {candidates, operations, blockedReasons, validationFailures}
  }
  const deployer = getAddress(options.deployerAddress)
  const baseNonce = options.deployerNonce ?? (await provider.getTransactionCount(deployer, blockTag))
  if (!Number.isSafeInteger(baseNonce) || baseNonce < 0) throw new Error("Invalid deployer nonce")

  const libraryByName = new Map(libraries.map((library) => [library.name, library]))
  const libraryCreations = new Map<ContractName, ReturnType<typeof loadImplementationCreationCode>>()
  for (const library of libraries) {
    try {
      libraryCreations.set(library.name, loadFoundryPreparedCreationCode(library.name, deployment))
    } catch (error) {
      blockedReasons.push(`${library.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  const orderedLibraries: typeof libraries = []
  const visiting = new Set<ContractName>()
  const visited = new Set<ContractName>()
  const visitLibrary = (library: (typeof libraries)[number]): void => {
    if (visited.has(library.name)) return
    if (visiting.has(library.name)) throw new Error(`Library dependency cycle includes ${library.name}`)
    visiting.add(library.name)
    for (const dependency of libraryCreations.get(library.name)?.libraryDependencies ?? []) {
      const changedDependency = libraryByName.get(dependency)
      if (changedDependency) visitLibrary(changedDependency)
    }
    visiting.delete(library.name)
    visited.add(library.name)
    orderedLibraries.push(library)
  }
  try {
    for (const library of libraries) visitLibrary(library)
  } catch (error) {
    orderedLibraries.length = 0
    blockedReasons.push(error instanceof Error ? error.message : String(error))
  }

  for (const contract of orderedLibraries) {
    try {
      const desiredAddress = deployment.contracts[contract.name].nextAddress
      if (!desiredAddress) {
        const suggested = getCreateAddress({
          from: deployer,
          nonce: baseNonce + candidates.filter(({status}) => status === "planned").length,
        })
        throw new Error(`declare nextAddress ${suggested} before replacing this library`)
      }
      const creation = libraryCreations.get(contract.name)
      if (!creation) continue
      const nonce = baseNonce + candidates.filter(({status}) => status === "planned").length
      const predictedAddress = getAddress(getCreateAddress({from: deployer, nonce}))
      const candidateAddress = getAddress(desiredAddress)
      const code = await provider.getCode(candidateAddress, blockTag)
      let status: UpgradeCandidate["status"] = "reused"
      if (code === "0x") {
        if (candidateAddress !== predictedAddress) {
          throw new Error(`nextAddress must be ${predictedAddress} for deployer nonce ${nonce}`)
        }
        status = "planned"
      } else {
        const comparison = compareRuntimeBytecode(
          code,
          candidateAddress,
          loadArtifactFingerprint(contract.name),
          deployment
        )
        if (!isAlignedRuntime(comparison.classification)) {
          throw new Error(`nextAddress ${candidateAddress} does not contain the desired library`)
        }
      }
      candidates.push({
        contractName: contract.name,
        kind: "library",
        target: getAddress(contract.address),
        currentImplementation: getAddress(contract.address),
        candidateAddress,
        deployer,
        nonce,
        status,
        fullyQualifiedName: creation.fullyQualifiedName,
        creationCodeHash: creation.codeHash,
        creationCodeSize: creation.codeSize,
        libraryDependencies: creation.libraryDependencies,
        validation: {status: "not-applicable"},
        operationId: null,
      })
    } catch (error) {
      blockedReasons.push(`${contract.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  for (const contract of upgradeable) {
    try {
      const creation = loadFoundryPreparedCreationCode(contract.name, deployment)
      for (const libraryName of creation.libraryDependencies) {
        const library = byName.get(libraryName)
        const candidate = candidates.find(({contractName, kind}) => contractName === libraryName && kind === "library")
        if (!candidate && (!library || !isAlignedRuntime(library.classification))) {
          throw new Error(`desired library ${libraryName} is not aligned`)
        }
      }
      const validation = (options.validate ?? validateUpgrade)(creation.fullyQualifiedName)
      const reusable = options.reusableCandidates?.[contract.name]
      const nonce = baseNonce + candidates.filter(({status}) => status === "planned").length
      const candidateAddress = getAddress(reusable ?? getCreateAddress({from: deployer, nonce}))
      let status: UpgradeCandidate["status"] = "planned"
      if (reusable) {
        const code = await provider.getCode(candidateAddress, blockTag)
        if (code === "0x") throw new Error(`reusable candidate ${candidateAddress} has no code`)
        const comparison = compareRuntimeBytecode(
          code,
          candidateAddress,
          loadArtifactFingerprint(contract.name),
          deployment
        )
        if (!isAlignedRuntime(comparison.classification)) {
          throw new Error(`reusable candidate ${candidateAddress} does not match the desired artifact`)
        }
        status = "reused"
      }
      const operationId = `deployment-infrastructure:${contract.name}:upgrade`
      const candidate: UpgradeCandidate = {
        contractName: contract.name,
        kind: contract.kind,
        target: getAddress(contract.address),
        currentImplementation: getAddress(contract.implementationAddress),
        candidateAddress,
        deployer,
        nonce,
        status,
        fullyQualifiedName: creation.fullyQualifiedName,
        creationCodeHash: creation.codeHash,
        creationCodeSize: creation.codeSize,
        libraryDependencies: creation.libraryDependencies,
        validation,
        operationId,
      }
      candidates.push(candidate)
      operations.push({
        id: operationId,
        domain: "deployment-infrastructure",
        action: "update",
        resource: contract.kind === "uups" ? "uups-implementation" : "beacon-implementation",
        contractName: contract.name,
        target: candidate.target,
        caller: getAddress(deployment.authority.address),
        value: "0",
        data:
          contract.kind === "uups"
            ? upgradeInterface.encodeFunctionData("upgradeToAndCall", [
                candidateAddress,
                deployment.contracts[contract.name].upgradeCallData,
              ])
            : upgradeInterface.encodeFunctionData("upgradeTo", [candidateAddress]),
        destructive: false,
        dependencies: [],
        estimatedGas: null,
        postcondition: {type: "implementation-address", expected: candidateAddress},
      })
    } catch (error) {
      if (error instanceof UpgradeValidationError) {
        validationFailures.push({contractName: contract.name, output: error.output})
      }
      blockedReasons.push(`${contract.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return {candidates, operations, blockedReasons, validationFailures}
}

function writeCandidateJournal(path: string, journal: CandidateDeploymentJournal): void {
  const temporaryPath = `${path}.tmp`
  writeFileSync(temporaryPath, `${JSON.stringify(journal, null, 2)}\n`, {mode: 0o600})
  renameSync(temporaryPath, path)
}

export function readCandidateJournal(path: string): CandidateDeploymentJournal {
  const journal = JSON.parse(readFileSync(path, "utf8")) as CandidateDeploymentJournal
  if (journal.schemaVersion !== 1 || !journal.candidateAddress || !journal.creationCodeHash) {
    throw new Error(`Unsupported or invalid candidate deployment journal: ${path}`)
  }
  return journal
}

export async function deployUpgradeCandidates(
  provider: JsonRpcProvider,
  rpcUrl: string,
  wallet: Wallet,
  deployment: DeploymentRegistry,
  planHash: string,
  candidates: UpgradeCandidate[],
  outputRoot: string
): Promise<void> {
  const deployer = getAddress(await wallet.getAddress())
  for (const candidate of candidates) {
    if (candidate.deployer !== deployer) throw new Error(`Candidate ${candidate.contractName} uses another deployer`)
    const creation = loadFoundryPreparedCreationCode(candidate.contractName, deployment)
    if (creation.codeHash !== candidate.creationCodeHash) {
      throw new Error(`Creation code changed for ${candidate.contractName}`)
    }
    const journalPath = resolve(outputRoot, `candidate-${candidate.contractName}.json`)
    let journal: CandidateDeploymentJournal
    if (existsSync(journalPath)) {
      journal = readCandidateJournal(journalPath)
      if (
        journal.planHash !== planHash ||
        journal.candidateAddress !== candidate.candidateAddress ||
        journal.creationCodeHash !== candidate.creationCodeHash
      ) {
        throw new Error(`Candidate journal does not match ${candidate.contractName}`)
      }
      if (journal.transactionHash) {
        const receipt = await provider.getTransactionReceipt(journal.transactionHash)
        if (receipt) {
          if (receipt.status !== 1 || getAddress(receipt.contractAddress!) !== candidate.candidateAddress) {
            throw new Error(`Candidate deployment failed for ${candidate.contractName}`)
          }
          journal.status = "confirmed"
          journal.receipt = {
            blockNumber: receipt.blockNumber,
            blockHash: receipt.blockHash,
            status: receipt.status,
            gasUsed: receipt.gasUsed.toString(),
          }
          writeCandidateJournal(journalPath, journal)
        }
      }
    } else {
      journal = {
        schemaVersion: 1,
        deploymentId: deployment.deploymentId,
        planHash,
        contractName: candidate.contractName,
        deployer,
        nonce: candidate.nonce,
        candidateAddress: candidate.candidateAddress,
        creationCodeHash: candidate.creationCodeHash,
        status: "prepared",
        transactionHash: null,
        receipt: null,
      }
      writeCandidateJournal(journalPath, journal)
    }

    let code = await provider.getCode(candidate.candidateAddress)
    if (code !== "0x" && journal.status !== "confirmed") {
      journal.status = "confirmed"
      writeCandidateJournal(journalPath, journal)
    }
    if (code === "0x") {
      const latestNonce = await provider.getTransactionCount(deployer, "latest")
      const pendingNonce = await provider.getTransactionCount(deployer, "pending")
      if (latestNonce !== candidate.nonce || pendingNonce !== candidate.nonce) {
        throw new Error(
          `Deployer nonces are latest=${latestNonce}, pending=${pendingNonce}, expected=${candidate.nonce}; candidate outcome is unknown and was not retried`
        )
      }
      const startBlock = await provider.getBlockNumber()
      const preparationRoot = resolve(
        ".deployments",
        "upgrade-preparation",
        planHash.slice(2, 18),
        candidate.contractName
      )
      const foundryMethod = candidate.kind === "library" ? "deployLibrary" : "prepareUpgrade"
      const result = spawnSync(
        "forge",
        [
          "script",
          "scripts/ReconciliationCodeDeployment.s.sol:ReconciliationCodeDeployment",
          "--sig",
          `${foundryMethod}(string,address)`,
          candidate.fullyQualifiedName,
          candidate.candidateAddress,
          "--rpc-url",
          rpcUrl,
          "--broadcast",
          "--slow",
          "--non-interactive",
          "--out",
          resolve(preparationRoot, "out"),
          "--cache-path",
          resolve(preparationRoot, "cache"),
          ...foundryLibraryArguments(deployment).flatMap((library) => ["--libraries", library]),
        ],
        {
          cwd: resolve(__dirname, ".."),
          env: {...process.env, FOUNDRY_BROADCAST: resolve(outputRoot, "foundry-broadcast")},
          encoding: "utf8",
          maxBuffer: 50 * 1024 * 1024,
        }
      )
      writeFileSync(
        resolve(outputRoot, `candidate-${candidate.contractName}-foundry.log`),
        result.stdout + result.stderr,
        {mode: 0o600}
      )
      code = await provider.getCode(candidate.candidateAddress)
      if (result.error || result.status !== 0 || code === "0x") {
        throw new Error(`Foundry ${foundryMethod} failed for ${candidate.contractName}`)
      }
      const latestBlock = await provider.getBlockNumber()
      for (let blockNumber = startBlock + 1; blockNumber <= latestBlock; blockNumber++) {
        const block = await provider.getBlock(blockNumber, true)
        for (const transaction of block?.prefetchedTransactions ?? []) {
          const receipt = await provider.getTransactionReceipt(transaction.hash)
          if (
            receipt?.status === 1 &&
            receipt.contractAddress &&
            getAddress(receipt.contractAddress) === candidate.candidateAddress
          ) {
            if (keccak256(transaction.data) !== candidate.creationCodeHash) {
              throw new Error(`Foundry deployed unreviewed creation code for ${candidate.contractName}`)
            }
            journal.transactionHash = transaction.hash
            journal.receipt = {
              blockNumber: receipt.blockNumber,
              blockHash: receipt.blockHash,
              status: receipt.status,
              gasUsed: receipt.gasUsed.toString(),
            }
          }
        }
      }
      if (!journal.receipt) throw new Error(`Could not record Foundry deployment receipt for ${candidate.contractName}`)
      journal.status = "confirmed"
      writeCandidateJournal(journalPath, journal)
      code = await provider.getCode(candidate.candidateAddress)
    }
    const comparison = compareRuntimeBytecode(
      code,
      candidate.candidateAddress,
      loadArtifactFingerprint(candidate.contractName),
      deployment
    )
    if (!isAlignedRuntime(comparison.classification)) {
      throw new Error(`Deployed candidate does not match ${candidate.contractName}: ${comparison.reason}`)
    }
  }
}
