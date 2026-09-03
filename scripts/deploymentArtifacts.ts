import {createHash} from "crypto"
import {spawnSync} from "child_process"
import {readFileSync, readdirSync, statSync} from "fs"
import {basename, join, relative, resolve} from "path"
import {getAddress, keccak256} from "ethers"
import {ContractName, DeploymentRegistry} from "./deploymentRegistry"

export type BytecodeClassification =
  | "exact-match"
  | "build-metadata-drift"
  | "library-drift"
  | "immutable-drift"
  | "executable-drift"
  | "unknown"

interface ByteRange {
  start: number
  length: number
}

interface FoundryArtifact {
  abi?: Array<{type?: string; inputs?: unknown[]}>
  bytecode?: {
    object?: string
    linkReferences?: Record<string, Record<string, ByteRange[]>>
  }
  deployedBytecode?: {
    object?: string
    linkReferences?: Record<string, Record<string, ByteRange[]>>
    immutableReferences?: Record<string, ByteRange[]>
  }
  metadata?: {
    compiler?: {version?: string}
    settings?: {
      compilationTarget?: Record<string, string>
      optimizer?: {enabled?: boolean; runs?: number}
      evmVersion?: string
      viaIR?: boolean
    }
  }
}

export interface ArtifactFingerprint {
  fullyQualifiedName: string
  artifactHash: string
  buildInfoHash: string | null
  compilerVersion: string
  optimizer: {enabled: boolean; runs: number}
  evmVersion: string
  viaIR: boolean
  runtimeHash: string
  runtimeSize: number
  linkReferences: Array<{library: string; start: number; length: number}>
  immutableReferences: ByteRange[]
  selfAddressReferences: ByteRange[]
  metadataStart: number | null
  runtime: string
}

export interface ImplementationCreationCode {
  fullyQualifiedName: string
  code: string
  codeHash: string
  codeSize: number
  libraryDependencies: ContractName[]
}

function desiredContractAddress(deployment: DeploymentRegistry, name: ContractName): string {
  const contract = deployment.contracts[name]
  return getAddress(contract.nextAddress ?? contract.address)
}

export interface BytecodeComparison {
  classification: BytecodeClassification
  artifactRuntimeHash: string
  linkedLibraries: Array<{library: string; expected: string; actual: string; matches: boolean}>
  immutables: Array<{start: number; length: number; actual: string; expected: string | null; matches: boolean | null}>
  selfAddresses: Array<{start: number; length: number; actual: string; expected: string; matches: boolean}>
  reason: string
}

const ARTIFACT_CONTRACT_NAMES: Record<ContractName, string> = {
  bridge: "Bridge",
  worldActions: "WorldActions",
  randomnessBeacon: "RandomnessBeacon",
  dailyRewardsScheduler: "DailyRewardsScheduler",
  treasury: "Treasury",
  shop: "Shop",
  royaltyReceiver: "RoyaltyReceiver",
  adminAccess: "AdminAccess",
  itemNFTLibrary: "ItemNFTLibrary",
  itemNFT: "ItemNFT",
  bazaar: "OrderBook",
  estforLibrary: "EstforLibrary",
  playerNFT: "PlayerNFT",
  quests: "Quests",
  clans: "Clans",
  wishingWell: "WishingWell",
  bank: "Bank",
  petNFTLibrary: "PetNFTLibrary",
  petNFT: "PetNFT",
  playersLibrary: "PlayersLibrary",
  playersImplQueueActions: "PlayersImplQueueActions",
  playersImplProcessActions: "PlayersImplProcessActions",
  playersImplRewards: "PlayersImplRewards",
  playersImplMisc: "PlayersImplMisc",
  playersImplMisc1: "PlayersImplMisc1",
  players: "Players",
  promotionsLibrary: "PromotionsLibrary",
  promotions: "Promotions",
  passiveActions: "PassiveActions",
  instantActions: "InstantActions",
  instantVRFActions: "InstantVRFActions",
  genericInstantVRFActionStrategy: "GenericInstantVRFActionStrategy",
  eggInstantVRFActionStrategy: "EggInstantVRFActionStrategy",
  bankRelay: "BankRelay",
  pvpBattleground: "PVPBattleground",
  raids: "Raids",
  clanBattleLibrary: "ClanBattleLibrary",
  lockedBankVaultsLibrary: "LockedBankVaultsLibrary",
  lockedBankVaults: "LockedBankVaults",
  territories: "Territories",
  combatantsHelper: "CombatantsHelper",
  territoryTreasury: "TerritoryTreasury",
  bankRegistry: "BankRegistry",
  bankFactory: "BankFactory",
  activityPoints: "ActivityPoints",
  marketplace: "Marketplace",
  cosmetics: "Cosmetics",
  globalEvent: "GlobalEvents",
  blackMarketTrader: "BlackMarketTrader",
  usageBasedSessionModule: "UsageBasedSessionModule",
  gameSubsidisationRegistry: "GameSubsidisationRegistry",
  petNFTReroll: "PetNFTReroll",
  orderbookV2: "OrderBook",
}

const LIBRARIES: Record<string, {registryName: ContractName; prelinkedAddress: string}> = {
  EstforLibrary: {registryName: "estforLibrary", prelinkedAddress: "0000000000000000000000000000000000001001"},
  ItemNFTLibrary: {registryName: "itemNFTLibrary", prelinkedAddress: "0000000000000000000000000000000000001002"},
  PetNFTLibrary: {registryName: "petNFTLibrary", prelinkedAddress: "0000000000000000000000000000000000001003"},
  PlayersLibrary: {registryName: "playersLibrary", prelinkedAddress: "0000000000000000000000000000000000001004"},
  PromotionsLibrary: {registryName: "promotionsLibrary", prelinkedAddress: "0000000000000000000000000000000000001005"},
  ClanBattleLibrary: {registryName: "clanBattleLibrary", prelinkedAddress: "0000000000000000000000000000000000001006"},
  LockedBankVaultsLibrary: {
    registryName: "lockedBankVaultsLibrary",
    prelinkedAddress: "0000000000000000000000000000000000001007",
  },
}

function linkReferences(
  object: string,
  explicit: Record<string, Record<string, ByteRange[]>> = {}
): Array<{library: string; start: number; length: number}> {
  const links = Object.entries(explicit).flatMap(([, libraries]) =>
    Object.entries(libraries).flatMap(([library, ranges]) => ranges.map((range) => ({library, ...range})))
  )
  const bytes = object.replace(/^0x/, "").toLowerCase()
  for (const [library, {prelinkedAddress}] of Object.entries(LIBRARIES)) {
    const address = prelinkedAddress
    let offset = bytes.indexOf(address)
    while (offset !== -1) {
      const start = offset / 2
      if (!links.some((link) => link.start === start && link.length === 20)) links.push({library, start, length: 20})
      offset = bytes.indexOf(address, offset + address.length)
    }
  }
  return links.sort((a, b) => a.start - b.start)
}

function artifactMatch(contractName: ContractName, outRoot: string) {
  const expectedName = ARTIFACT_CONTRACT_NAMES[contractName]
  const candidates = jsonFiles(outRoot).filter(
    (path) => basename(path) === `${expectedName}.json` && !path.includes("/build-info/")
  )
  const matches = candidates.flatMap((path) => {
    const raw = readFileSync(path)
    const artifact = JSON.parse(raw.toString()) as FoundryArtifact
    const target = artifact.metadata?.settings?.compilationTarget
    if (!target || target[Object.keys(target)[0]] !== expectedName || !artifact.deployedBytecode?.object) return []
    const source = Object.keys(target)[0]
    if (!source.startsWith("contracts/") || source.startsWith("contracts/old/")) return []
    return [{path, raw, artifact, source, expectedName}]
  })
  if (matches.length === 0)
    throw new Error(`Foundry artifact not found for ${contractName} (${expectedName}); run forge build`)
  if (matches.length > 1)
    throw new Error(
      `Multiple Foundry artifacts found for ${contractName}: ${matches
        .map(({path}) => relative(outRoot, path))
        .join(", ")}`
    )
  return matches[0]
}

const jsonFileCache = new Map<string, string[]>()
const buildInfoHashCache = new Map<string, Map<string, string>>()

function sha256(value: string | Buffer): string {
  return `0x${createHash("sha256").update(value).digest("hex")}`
}

function jsonFiles(root: string): string[] {
  const cached = jsonFileCache.get(root)
  if (cached) return cached
  const files: string[] = []
  for (const entry of readdirSync(root)) {
    const path = join(root, entry)
    if (statSync(path).isDirectory()) files.push(...jsonFiles(path))
    else if (entry.endsWith(".json")) files.push(path)
  }
  files.sort()
  jsonFileCache.set(root, files)
  return files
}

function metadataStart(runtime: string): number | null {
  const bytes = runtime.slice(2)
  if (bytes.length < 4) return null
  const metadataLength = Number.parseInt(bytes.slice(-4), 16)
  const start = bytes.length / 2 - metadataLength - 2
  return Number.isInteger(start) && start >= 0 ? start : null
}

function selfAddressReferences(runtime: string, contractName: string): ByteRange[] {
  if (!LIBRARIES[contractName]) return []
  const bytes = runtime.slice(2).toLowerCase()
  const legacyLibraryGuard = `73${"00".repeat(20)}3014`
  return bytes.startsWith(legacyLibraryGuard) ? [{start: 1, length: 20}] : []
}

function findBuildInfoHash(outRoot: string, fullyQualifiedName: string): string | null {
  const buildInfoRoot = join(outRoot, "build-info")
  const cached = buildInfoHashCache.get(buildInfoRoot)
  if (cached) return cached.get(fullyQualifiedName) ?? null
  const hashes = new Map<string, string>()
  try {
    for (const path of jsonFiles(buildInfoRoot)) {
      const raw = readFileSync(path)
      const buildInfo = JSON.parse(raw.toString()) as {
        output?: {contracts?: Record<string, Record<string, unknown>>}
      }
      const hash = sha256(raw)
      for (const [source, contracts] of Object.entries(buildInfo.output?.contracts ?? {})) {
        for (const name of Object.keys(contracts)) hashes.set(`${source}:${name}`, hash)
      }
    }
  } catch {
    return null
  }
  buildInfoHashCache.set(buildInfoRoot, hashes)
  return hashes.get(fullyQualifiedName) ?? null
}

export function loadArtifactFingerprint(
  contractName: ContractName,
  outRoot = resolve(__dirname, "../out")
): ArtifactFingerprint {
  const {raw, artifact, source, expectedName} = artifactMatch(contractName, outRoot)
  const runtime = `0x${artifact.deployedBytecode!.object!.replace(/^0x/, "")}`
  const links = linkReferences(runtime, artifact.deployedBytecode!.linkReferences)
  const immutables = Object.values(artifact.deployedBytecode!.immutableReferences ?? {}).flat()
  const settings = artifact.metadata?.settings
  const fullyQualifiedName = `${source}:${expectedName}`
  return {
    fullyQualifiedName,
    artifactHash: sha256(raw),
    buildInfoHash: findBuildInfoHash(outRoot, fullyQualifiedName),
    compilerVersion: artifact.metadata?.compiler?.version ?? "unknown",
    optimizer: {enabled: settings?.optimizer?.enabled ?? false, runs: settings?.optimizer?.runs ?? 0},
    evmVersion: settings?.evmVersion ?? "unknown",
    viaIR: settings?.viaIR ?? false,
    runtimeHash: keccak256(runtime),
    runtimeSize: (runtime.length - 2) / 2,
    linkReferences: links,
    immutableReferences: immutables.sort((a, b) => a.start - b.start),
    selfAddressReferences: selfAddressReferences(runtime, expectedName),
    metadataStart: metadataStart(runtime),
    runtime,
  }
}

export function loadImplementationCreationCode(
  contractName: ContractName,
  deployment: DeploymentRegistry,
  outRoot = resolve(__dirname, "../out"),
  constructorData = "0x"
): ImplementationCreationCode {
  const {artifact, source, expectedName} = artifactMatch(contractName, outRoot)
  const constructor = artifact.abi?.find(({type}) => type === "constructor")
  const constructorInputs = constructor?.inputs?.length ?? 0
  if (constructorInputs !== 0 && constructorData === "0x") {
    throw new Error(`${contractName} implementation constructor arguments are not declared for reconciliation`)
  }
  if (constructorInputs === 0 && constructorData !== "0x") {
    throw new Error(`${contractName} does not accept implementation constructor arguments`)
  }
  let code = `0x${artifact.bytecode?.object?.replace(/^0x/, "") ?? ""}`.toLowerCase()
  if (code === "0x") throw new Error(`Foundry creation bytecode not found for ${contractName}`)
  const dependencies = new Set<ContractName>()
  for (const range of linkReferences(code, artifact.bytecode?.linkReferences)) {
    const registryName = LIBRARIES[range.library]?.registryName
    if (!registryName) throw new Error(`Linked library ${range.library} is not declared in the deployment registry`)
    dependencies.add(registryName)
    const address = desiredContractAddress(deployment, registryName).slice(2).toLowerCase()
    if (range.length !== 20) throw new Error(`Unexpected link length for ${range.library}`)
    const offset = 2 + range.start * 2
    code = `${code.slice(0, offset)}${address}${code.slice(offset + range.length * 2)}`
  }
  if (code.includes("__$")) throw new Error(`Unresolved library link in ${contractName} creation bytecode`)
  code += constructorData.slice(2).toLowerCase()
  return {
    fullyQualifiedName: `${source}:${expectedName}`,
    code,
    codeHash: keccak256(code),
    codeSize: (code.length - 2) / 2,
    libraryDependencies: [...dependencies].sort(),
  }
}

export function foundryLibraryArguments(deployment: DeploymentRegistry): string[] {
  return (Object.keys(deployment.contracts) as ContractName[])
    .filter((name) => deployment.contracts[name].kind === "library")
    .map((name) => `${loadArtifactFingerprint(name).fullyQualifiedName}:${desiredContractAddress(deployment, name)}`)
}

const preparedArtifacts = new Map<string, string>()

export function loadFoundryPreparedCreationCode(
  contractName: ContractName,
  deployment: DeploymentRegistry,
  constructorData = "0x",
  onProgress?: (message: string) => void
): ImplementationCreationCode {
  const libraries = foundryLibraryArguments(deployment)
  const key = sha256(JSON.stringify(libraries)).slice(2, 18)
  let outRoot = preparedArtifacts.get(key)
  if (!outRoot) {
    const buildRoot = resolve(".deployments", "reconciliation-artifacts", key)
    outRoot = resolve(buildRoot, "out")
    onProgress?.(`Building linked Foundry artifacts (${key})`)
    const result = spawnSync(
      "forge",
      [
        "build",
        "--out",
        outRoot,
        "--cache-path",
        resolve(buildRoot, "cache"),
        ...libraries.flatMap((library) => ["--libraries", library]),
      ],
      {cwd: resolve(__dirname, ".."), encoding: "utf8", maxBuffer: 50 * 1024 * 1024}
    )
    if (result.error || result.status !== 0) throw new Error("Foundry linked-artifact build failed")
    onProgress?.(`Linked Foundry artifact build completed (${key})`)
    preparedArtifacts.set(key, outRoot)
  }
  const canonical = loadImplementationCreationCode(
    contractName,
    deployment,
    resolve(__dirname, "../out"),
    constructorData
  )
  const prepared = loadImplementationCreationCode(contractName, deployment, outRoot, constructorData)
  return {...prepared, libraryDependencies: canonical.libraryDependencies}
}

function sliceBytes(value: string, start: number, length: number): string {
  return `0x${value.slice(2 + start * 2, 2 + (start + length) * 2)}`
}

function paddedAddress(address: string, length: number): string | null {
  if (length !== 32) return null
  return `0x${getAddress(address).slice(2).toLowerCase().padStart(64, "0")}`
}

export function compareRuntimeBytecode(
  actualRuntime: string,
  implementationAddress: string,
  artifact: ArtifactFingerprint,
  deployment: DeploymentRegistry
): BytecodeComparison {
  const actual = actualRuntime.toLowerCase()
  const desired = artifact.runtime.toLowerCase()
  const linkedLibraries = artifact.linkReferences.map((range) => {
    const registryName = LIBRARIES[range.library]?.registryName
    const expected = registryName ? desiredContractAddress(deployment, registryName) : "unknown"
    const actualBytes = sliceBytes(actual, range.start, range.length)
    const actualValue = range.length === 20 && actualBytes.length === 42 ? getAddress(actualBytes) : "unknown"
    return {
      library: range.library,
      expected,
      actual: actualValue,
      matches: expected !== "unknown" && actualValue !== "unknown" && actualValue === getAddress(expected),
    }
  })
  const immutables = artifact.immutableReferences.map((range) => {
    const actualValue = sliceBytes(actual, range.start, range.length)
    const self = paddedAddress(implementationAddress, range.length)
    const isSelf = self !== null && actualValue === self
    return {
      start: range.start,
      length: range.length,
      actual: actualValue,
      expected: isSelf ? self : null,
      matches: isSelf ? true : null,
    }
  })
  const expectedSelfAddress = getAddress(implementationAddress)
  const selfAddresses = artifact.selfAddressReferences.map((range) => {
    const actualBytes = sliceBytes(actual, range.start, range.length)
    const actualValue = range.length === 20 && actualBytes.length === 42 ? getAddress(actualBytes) : "unknown"
    return {
      start: range.start,
      length: range.length,
      actual: actualValue,
      expected: expectedSelfAddress,
      matches: actualValue !== "unknown" && actualValue === expectedSelfAddress,
    }
  })
  const artifactRuntimeHash = artifact.runtimeHash
  const desiredExecutableEnd = artifact.metadataStart ?? (desired.length - 2) / 2
  const actualMetadataStart = metadataStart(actual)
  if (artifact.metadataStart !== null && actualMetadataStart === null) {
    return {
      classification: "unknown",
      artifactRuntimeHash,
      linkedLibraries,
      immutables,
      selfAddresses,
      reason: "On-chain runtime has no valid Solidity metadata trailer",
    }
  }
  const actualExecutableEnd = actualMetadataStart ?? (actual.length - 2) / 2

  const ignored = new Set<number>()
  for (const range of [
    ...artifact.linkReferences,
    ...artifact.immutableReferences,
    ...artifact.selfAddressReferences,
  ]) {
    for (let index = range.start; index < range.start + range.length; index++) ignored.add(index)
  }
  let executableDiffers = false
  if (actualExecutableEnd !== desiredExecutableEnd) executableDiffers = true
  for (let index = 0; index < Math.min(actualExecutableEnd, desiredExecutableEnd); index++) {
    if (ignored.has(index)) continue
    if (sliceBytes(actual, index, 1) === sliceBytes(desired, index, 1)) continue
    executableDiffers = true
  }
  if (executableDiffers) {
    return {
      classification: "executable-drift",
      artifactRuntimeHash,
      linkedLibraries,
      immutables,
      selfAddresses,
      reason: "Executable bytes differ",
    }
  }
  if (selfAddresses.some(({matches}) => !matches)) {
    return {
      classification: "immutable-drift",
      artifactRuntimeHash,
      linkedLibraries,
      immutables,
      selfAddresses,
      reason: "Compiler-generated self-address differs",
    }
  }
  if (linkedLibraries.some(({expected}) => expected === "unknown")) {
    return {
      classification: "unknown",
      artifactRuntimeHash,
      linkedLibraries,
      immutables,
      selfAddresses,
      reason: "A linked library is not declared in the deployment registry",
    }
  }
  if (linkedLibraries.some(({matches}) => !matches)) {
    return {
      classification: "library-drift",
      artifactRuntimeHash,
      linkedLibraries,
      immutables,
      selfAddresses,
      reason: "Linked library addresses differ",
    }
  }
  if (immutables.some(({matches}) => matches === null)) {
    return {
      classification: "unknown",
      artifactRuntimeHash,
      linkedLibraries,
      immutables,
      selfAddresses,
      reason: "An immutable is not the implementation self-address and has no declared desired value",
    }
  }
  if (
    artifact.metadataStart !== null &&
    actual.slice(2 + actualExecutableEnd * 2) !== desired.slice(2 + desiredExecutableEnd * 2)
  ) {
    return {
      classification: "build-metadata-drift",
      artifactRuntimeHash,
      linkedLibraries,
      immutables,
      selfAddresses,
      reason: "Only Solidity metadata differs",
    }
  }
  return {
    classification: "exact-match",
    artifactRuntimeHash,
    linkedLibraries,
    immutables,
    selfAddresses,
    reason: "Runtime matches after applying declared links, self-addresses, and UUPS self immutables",
  }
}
