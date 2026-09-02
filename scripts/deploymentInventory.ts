import {createHash} from "crypto"
import {execFileSync} from "child_process"
import {readFileSync} from "fs"
import {resolve} from "path"
import {getAddress, Interface, JsonRpcProvider, keccak256, zeroPadValue} from "ethers"
import {
  ArtifactFingerprint,
  BytecodeComparison,
  compareRuntimeBytecode,
  loadArtifactFingerprint,
} from "./deploymentArtifacts"
import {
  CONTRACT_NAMES,
  ContractKind,
  ContractName,
  DeploymentRegistry,
  EXTERNAL_NAMES,
  getDeploymentRegistryPath,
} from "./deploymentRegistry"
import {buildShopPlan, deferShopPlanForUpgrade, hasShopStateGetter} from "./shopReconciliation"
import type {ShopPlan, ShopPlanOptions} from "./shopReconciliation"
import type {DeploymentSimulationResult} from "./deploymentSimulation"
import {EIP1967_IMPLEMENTATION_SLOT, UUPS_PROXIABLE_UUID, addressFromStorage} from "./deploymentSlots"
import {DEFAULT_SAFE_BATCH_LIMITS} from "./reconciliation"
import type {ReconciliationOperation} from "./reconciliation"
import {buildUpgradePlan} from "./upgradeReconciliation"
import type {UpgradePlan, UpgradePlanOptions} from "./upgradeReconciliation"
import {verifyDeploymentWiring} from "./deploymentWiring"

const readInterface = new Interface([
  "function owner() view returns (address)",
  "function implementation() view returns (address)",
  "function proxiableUUID() view returns (bytes32)",
  "function getOwners() view returns (address[])",
  "function getThreshold() view returns (uint256)",
])

export type FindingSeverity = "error" | "warning"

export interface Finding {
  severity: FindingSeverity
  code: string
  subject: string
  message: string
}

export interface CodeInventory {
  address: string
  codeSize: number
  codeHash: string
}

export interface ImplementationInventory extends CodeInventory {
  slot: string
  proxiableUUID: string | null
  artifact: Omit<ArtifactFingerprint, "runtime" | "metadataStart">
  comparison: BytecodeComparison
  legacyManifest: {implementationFound: boolean}
}

export interface ContractInventory extends CodeInventory {
  name: ContractName
  kind: ContractKind
  owner: string | null
  ownerMatchesAuthority: boolean | null
  implementation: ImplementationInventory | null
  legacyManifest: {proxyFound: boolean | null}
}

export interface DeploymentPlan {
  schemaVersion: 3
  mode: "read-only"
  deploymentId: string
  chainId: number
  networkFingerprint: {genesisHash: string}
  profile: string
  authority: {type: "safe"; address: string; codeHash: string; owners: string[]; threshold: number}
  observationBlock: {number: number; hash: string}
  inputs: {
    registryHash: string
    sourceDataHash: string
    gitRevision: string
    openZeppelinManifestHash: string
  }
  execution: {safeBatchLimits: {maxOperations: number; maxGas: string}}
  contracts: ContractInventory[]
  externals: Array<CodeInventory & {name: string}>
  domains: Array<{name: string; policy: "managed" | "observed" | "unmanaged"; reason: string}>
  upgrades: UpgradePlan
  shop: ShopPlan
  operations: ReconciliationOperation[]
  simulation: DeploymentSimulationResult | {status: "blocked"; reasons: string[]} | null
  findings: Finding[]
  summary: {
    contracts: number
    externals: number
    errors: number
    warnings: number
    implementationClassifications: Record<string, number>
    domainPolicies: Record<"managed" | "observed" | "unmanaged", number>
  }
  planHash: string
}

export interface DeploymentPlanOptions extends ShopPlanOptions, UpgradePlanOptions {
  maxSafeOperations?: number
  maxSafeGas?: bigint
}

interface LegacyManifest {
  proxies?: Array<{address?: string}>
  impls?: Record<string, {address?: string}>
}

const DOMAINS: DeploymentPlan["domains"] = [
  {
    name: "deployment-infrastructure",
    policy: "managed",
    reason: "Validated UUPS and beacon implementations are reconciled through deployer candidates and Safe upgrades",
  },
  {name: "items", policy: "unmanaged", reason: "Complete current key discovery is not implemented"},
  {
    name: "quests",
    policy: "unmanaged",
    reason: "Minimum requirements and complete current key discovery are unavailable",
  },
  {
    name: "world-actions",
    policy: "unmanaged",
    reason: "Complete current key discovery and action deletion are unavailable",
  },
  {name: "shop", policy: "managed", reason: "Buyable prices and unsellable flags are reconciled exactly"},
  {name: "clan-tiers", policy: "unmanaged", reason: "Removal and complete current key discovery are unavailable"},
  {name: "instant-actions", policy: "unmanaged", reason: "Complete current key discovery is not implemented"},
  {name: "instant-vrf-actions", policy: "unmanaged", reason: "Complete current key discovery is not implemented"},
  {name: "passive-actions", policy: "unmanaged", reason: "Rewards are not fully readable and removal is unavailable"},
  {name: "cosmetics", policy: "unmanaged", reason: "Configuration getters and enumeration are unavailable"},
  {name: "avatars", policy: "unmanaged", reason: "Configuration getters, removal, and enumeration are unavailable"},
  {
    name: "rewards-and-other-game-data",
    policy: "unmanaged",
    reason: "Domain-specific complete read and deletion semantics are not implemented",
  },
]

function sha256(value: string | Buffer): string {
  return `0x${createHash("sha256").update(value).digest("hex")}`
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

export function hashPlan(plan: Omit<DeploymentPlan, "planHash">): string {
  return sha256(canonical(plan))
}

function codeInventory(address: string, code: string): CodeInventory {
  return {address: getAddress(address), codeSize: (code.length - 2) / 2, codeHash: keccak256(code)}
}

async function callAddress(
  provider: JsonRpcProvider,
  address: string,
  signature: string,
  blockTag: number
): Promise<string> {
  const data = readInterface.encodeFunctionData(signature)
  const result = await provider.call({to: address, data, blockTag})
  return getAddress(readInterface.decodeFunctionResult(signature, result)[0])
}

async function callBytes32(
  provider: JsonRpcProvider,
  address: string,
  signature: string,
  blockTag: number
): Promise<string> {
  const data = readInterface.encodeFunctionData(signature)
  const result = await provider.call({to: address, data, blockTag})
  return readInterface.decodeFunctionResult(signature, result)[0]
}

async function inventoryImplementation(
  provider: JsonRpcProvider,
  deployment: DeploymentRegistry,
  name: ContractName,
  address: string,
  slot: string,
  blockTag: number,
  manifestImplementations: Set<string>,
  findings: Finding[]
): Promise<ImplementationInventory> {
  const code = await provider.getCode(address, blockTag)
  if (code === "0x")
    findings.push({
      severity: "error",
      code: "IMPLEMENTATION_NO_CODE",
      subject: name,
      message: `No code at implementation ${address}`,
    })
  let proxiableUUID: string | null = null
  if (deployment.contracts[name].kind === "uups") {
    try {
      proxiableUUID = await callBytes32(provider, address, "proxiableUUID", blockTag)
      if (proxiableUUID.toLowerCase() !== UUPS_PROXIABLE_UUID) {
        findings.push({
          severity: "error",
          code: "INVALID_PROXIABLE_UUID",
          subject: name,
          message: `Implementation returned ${proxiableUUID}`,
        })
      }
    } catch {
      findings.push({
        severity: "error",
        code: "PROXIABLE_UUID_READ_FAILED",
        subject: name,
        message: "Could not read proxiableUUID() from the implementation",
      })
    }
  }
  const artifact = loadArtifactFingerprint(name)
  const comparison = compareRuntimeBytecode(code, address, artifact, deployment)
  const implementationFound = manifestImplementations.has(address.toLowerCase())
  if (!implementationFound)
    findings.push({
      severity: "warning",
      code: "IMPLEMENTATION_NOT_IN_LEGACY_MANIFEST",
      subject: name,
      message: `${address} is not in .openzeppelin/sonic.json`,
    })
  const {runtime: _runtime, metadataStart: _metadataStart, ...reportedArtifact} = artifact
  return {
    ...codeInventory(address, code),
    slot,
    proxiableUUID,
    artifact: reportedArtifact,
    comparison,
    legacyManifest: {implementationFound},
  }
}

async function inventoryContract(
  provider: JsonRpcProvider,
  deployment: DeploymentRegistry,
  name: ContractName,
  blockTag: number,
  manifestProxies: Set<string>,
  manifestImplementations: Set<string>,
  findings: Finding[]
): Promise<ContractInventory> {
  const tracked = deployment.contracts[name]
  const address = getAddress(tracked.address)
  const code = await provider.getCode(address, blockTag)
  if (code === "0x")
    findings.push({severity: "error", code: "CONTRACT_NO_CODE", subject: name, message: `No code at ${address}`})

  let owner: string | null = null
  let ownerMatchesAuthority: boolean | null = null
  let implementation: ImplementationInventory | null = null
  let proxyFound: boolean | null = null
  if (tracked.kind === "uups" || tracked.kind === "beacon") {
    try {
      owner = await callAddress(provider, address, "owner", blockTag)
      ownerMatchesAuthority = owner === getAddress(deployment.authority.address)
      if (!ownerMatchesAuthority)
        findings.push({
          severity: "error",
          code: "OWNER_MISMATCH",
          subject: name,
          message: `Owner ${owner} is not tracked Safe ${getAddress(deployment.authority.address)}`,
        })
    } catch {
      findings.push({
        severity: "error",
        code: "OWNER_READ_FAILED",
        subject: name,
        message: `Could not read owner() at ${address}`,
      })
    }
  }
  if (tracked.kind === "uups") {
    const stored = await provider.getStorage(address, EIP1967_IMPLEMENTATION_SLOT, blockTag)
    const implementationAddress = addressFromStorage(stored)
    if (implementationAddress === getAddress(zeroPadValue("0x00", 20))) {
      findings.push({
        severity: "error",
        code: "EMPTY_IMPLEMENTATION_SLOT",
        subject: name,
        message: "EIP-1967 implementation slot is empty",
      })
    }
    implementation = await inventoryImplementation(
      provider,
      deployment,
      name,
      implementationAddress,
      EIP1967_IMPLEMENTATION_SLOT,
      blockTag,
      manifestImplementations,
      findings
    )
    proxyFound = manifestProxies.has(address.toLowerCase())
    if (!proxyFound)
      findings.push({
        severity: "warning",
        code: "PROXY_NOT_IN_LEGACY_MANIFEST",
        subject: name,
        message: `${address} is not in .openzeppelin/sonic.json`,
      })
  } else if (tracked.kind === "beacon") {
    const implementationAddress = await callAddress(provider, address, "implementation", blockTag)
    implementation = await inventoryImplementation(
      provider,
      deployment,
      name,
      implementationAddress,
      "beacon.implementation()",
      blockTag,
      manifestImplementations,
      findings
    )
  } else {
    const artifact = loadArtifactFingerprint(name)
    const comparison = compareRuntimeBytecode(code, address, artifact, deployment)
    const {runtime: _runtime, metadataStart: _metadataStart, ...reportedArtifact} = artifact
    implementation = {
      ...codeInventory(address, code),
      slot: "tracked-address",
      proxiableUUID: null,
      artifact: reportedArtifact,
      comparison,
      legacyManifest: {implementationFound: manifestImplementations.has(address.toLowerCase())},
    }
    if (tracked.kind === "implementation" && !implementation.legacyManifest.implementationFound) {
      findings.push({
        severity: "warning",
        code: "IMPLEMENTATION_NOT_IN_LEGACY_MANIFEST",
        subject: name,
        message: `${address} is not in .openzeppelin/sonic.json`,
      })
    }
  }
  return {
    ...codeInventory(address, code),
    name,
    kind: tracked.kind,
    owner,
    ownerMatchesAuthority,
    implementation,
    legacyManifest: {proxyFound},
  }
}

export async function buildDeploymentPlan(
  provider: JsonRpcProvider,
  deployment: DeploymentRegistry,
  requestedBlock?: number,
  options: DeploymentPlanOptions = {}
): Promise<DeploymentPlan> {
  const network = await provider.getNetwork()
  if (network.chainId !== BigInt(deployment.chainId))
    throw new Error(`RPC chain ID ${network.chainId} does not match deployment chain ID ${deployment.chainId}`)
  const genesis = await provider.getBlock(0)
  if (!genesis?.hash || genesis.hash.toLowerCase() !== deployment.networkFingerprint.genesisHash.toLowerCase()) {
    throw new Error("RPC network fingerprint does not match deployment registry")
  }
  const block = await provider.getBlock(requestedBlock ?? "latest")
  if (!block?.hash) throw new Error("Could not resolve observation block")
  if (block.number < deployment.deploymentBlock)
    throw new Error(`Observation block ${block.number} predates deployment block ${deployment.deploymentBlock}`)

  const manifestPath = resolve(__dirname, "../.openzeppelin/sonic.json")
  const manifestRaw = readFileSync(manifestPath)
  const manifest = JSON.parse(manifestRaw.toString()) as LegacyManifest
  const manifestProxies = new Set(
    (manifest.proxies ?? []).flatMap(({address}) => (address ? [address.toLowerCase()] : []))
  )
  const manifestImplementations = new Set(
    Object.values(manifest.impls ?? {}).flatMap(({address}) => (address ? [address.toLowerCase()] : []))
  )
  const findings: Finding[] = []

  const safeAddress = getAddress(deployment.authority.address)
  const safeCode = await provider.getCode(safeAddress, block.number)
  if (safeCode === "0x") throw new Error(`Tracked Safe has no code at observation block ${block.number}`)
  const ownersResult = await provider.call({
    to: safeAddress,
    data: readInterface.encodeFunctionData("getOwners"),
    blockTag: block.number,
  })
  const owners = (readInterface.decodeFunctionResult("getOwners", ownersResult)[0] as string[]).map(getAddress).sort()
  const thresholdResult = await provider.call({
    to: safeAddress,
    data: readInterface.encodeFunctionData("getThreshold"),
    blockTag: block.number,
  })
  const threshold = Number(readInterface.decodeFunctionResult("getThreshold", thresholdResult)[0])
  if (threshold < 2 || owners.length < threshold) throw new Error("Tracked authority is not a multisignature Safe")

  const contracts: ContractInventory[] = []
  for (const name of CONTRACT_NAMES) {
    contracts.push(
      await inventoryContract(
        provider,
        deployment,
        name,
        block.number,
        manifestProxies,
        manifestImplementations,
        findings
      )
    )
  }
  const externals = []
  for (const name of EXTERNAL_NAMES) {
    const address = getAddress(deployment.externals[name])
    const code = await provider.getCode(address, block.number)
    if (code === "0x")
      findings.push({severity: "error", code: "EXTERNAL_NO_CODE", subject: name, message: `No code at ${address}`})
    externals.push({name, ...codeInventory(address, code)})
  }
  const upgrades = await buildUpgradePlan(
    provider,
    deployment,
    block.number,
    contracts.flatMap((contract) =>
      contract.implementation
        ? [
            {
              name: contract.name,
              kind: contract.kind,
              address: contract.address,
              implementationAddress: contract.implementation.address,
              classification: contract.implementation.comparison.classification,
            },
          ]
        : []
    ),
    options
  )
  for (const failure of await verifyDeploymentWiring(provider, deployment, block.number)) {
    findings.push({severity: "error", code: "WIRING_MISMATCH", subject: "infrastructure", message: failure})
  }
  for (const reason of upgrades.blockedReasons) {
    findings.push({
      severity: "error",
      code: "IMPLEMENTATION_UPGRADE_BLOCKED",
      subject: "infrastructure",
      message: reason,
    })
  }
  const shopUpgrade = upgrades.operations.find(({contractName}) => contractName === "shop")
  const shopInventory = contracts.find(({name}) => name === "shop")
  const shopImplementationCode = shopInventory?.implementation
    ? await provider.getCode(shopInventory.implementation.address, block.number)
    : "0x"
  const shop =
    shopUpgrade && !hasShopStateGetter(shopImplementationCode)
      ? deferShopPlanForUpgrade(deployment, options)
      : await buildShopPlan(provider, deployment, block.number, options)
  if (shopUpgrade) {
    for (const operation of shop.operations) operation.dependencies.push(shopUpgrade.id)
  }
  for (const reason of shop.blockedReasons) {
    findings.push({severity: "error", code: "SHOP_CHANGE_BLOCKED", subject: "shop", message: reason})
  }

  const classifications: Record<string, number> = {}
  for (const contract of contracts) {
    if (!contract.implementation) continue
    const classification = contract.implementation.comparison.classification
    classifications[classification] = (classifications[classification] ?? 0) + 1
  }
  const withoutHash: Omit<DeploymentPlan, "planHash"> = {
    schemaVersion: 3,
    mode: "read-only",
    deploymentId: deployment.deploymentId,
    chainId: deployment.chainId,
    networkFingerprint: deployment.networkFingerprint,
    profile: deployment.profile,
    authority: {type: "safe", address: safeAddress, codeHash: keccak256(safeCode), owners, threshold},
    observationBlock: {number: block.number, hash: block.hash},
    inputs: {
      registryHash: sha256(readFileSync(getDeploymentRegistryPath(deployment.deploymentId))),
      sourceDataHash: sha256(canonical(shop.desired)),
      gitRevision: execFileSync("git", ["rev-parse", "HEAD"], {encoding: "utf8"}).trim(),
      openZeppelinManifestHash: sha256(manifestRaw),
    },
    execution: {
      safeBatchLimits: {
        maxOperations: options.maxSafeOperations ?? DEFAULT_SAFE_BATCH_LIMITS.maxOperations,
        maxGas: (options.maxSafeGas ?? DEFAULT_SAFE_BATCH_LIMITS.maxGas).toString(),
      },
    },
    contracts,
    externals,
    domains: DOMAINS,
    upgrades,
    shop,
    operations: [...upgrades.operations, ...shop.operations],
    simulation: null,
    findings,
    summary: {
      contracts: contracts.length,
      externals: externals.length,
      errors: findings.filter(({severity}) => severity === "error").length,
      warnings: findings.filter(({severity}) => severity === "warning").length,
      implementationClassifications: Object.fromEntries(
        Object.entries(classifications).sort(([a], [b]) => a.localeCompare(b))
      ),
      domainPolicies: {
        managed: DOMAINS.filter(({policy}) => policy === "managed").length,
        observed: DOMAINS.filter(({policy}) => policy === "observed").length,
        unmanaged: DOMAINS.filter(({policy}) => policy === "unmanaged").length,
      },
    },
  }
  return {...withoutHash, planHash: hashPlan(withoutHash)}
}

export function renderPlanMarkdown(plan: DeploymentPlan): string {
  const lines = [
    `# Deployment inventory: ${plan.deploymentId}`,
    "",
    `- Chain: ${plan.chainId}`,
    `- Observation block: ${plan.observationBlock.number} (${plan.observationBlock.hash})`,
    `- Plan hash: \`${plan.planHash}\``,
    `- Findings: ${plan.summary.errors} errors, ${plan.summary.warnings} warnings`,
    `- Operations: ${plan.operations.length} (read-only; simulated only)`,
    `- Simulation: ${plan.simulation?.status ?? "not run"}`,
    "",
    "## Implementation classifications",
    "",
    "| Classification | Count |",
    "| --- | ---: |",
    ...Object.entries(plan.summary.implementationClassifications).map(
      ([classification, count]) => `| ${classification} | ${count} |`
    ),
    "",
    "## Findings",
    "",
    ...(plan.findings.length === 0
      ? ["No findings."]
      : plan.findings.map(
          (finding) =>
            `- **${finding.severity.toUpperCase()} ${finding.code}** (${finding.subject}): ${finding.message}`
        )),
    "",
    "## Shop reconciliation",
    "",
    `- Current state: ${
      plan.shop.readStatus === "available"
        ? "paginated `getShopItemStates` reads at the observation block"
        : "deferred until the introspection upgrade executes"
    }`,
    `- Buyable items: ${plan.shop.changes.buyableItems.add.length} add, ${plan.shop.changes.buyableItems.update.length} update, ${plan.shop.changes.buyableItems.remove.length} remove, ${plan.shop.changes.buyableItems.noOp.length} no-op`,
    `- Unsellable flags: ${plan.shop.changes.unsellableItems.add.length} add, ${plan.shop.changes.unsellableItems.remove.length} remove, ${plan.shop.changes.unsellableItems.noOp.length} no-op`,
    `- Change limits: ${plan.shop.limits.changedItems}/${plan.shop.limits.maxChangedItems} items, ${plan.shop.limits.removals}/${plan.shop.limits.maxRemovals} removals, ${plan.shop.limits.aggregatePriceChange}/${plan.shop.limits.maxAggregatePriceChange} aggregate price change`,
    "",
    "### Removals",
    "",
    ...(plan.shop.changes.buyableItems.remove.length === 0 && plan.shop.changes.unsellableItems.remove.length === 0
      ? ["No removals."]
      : [
          ...plan.shop.changes.buyableItems.remove.map(({tokenId, price}) => `- Buyable item ${tokenId} at ${price}`),
          ...plan.shop.changes.unsellableItems.remove.map((tokenId) => `- Unsellable flag ${tokenId}`),
        ]),
    "",
    "## Implementation upgrades",
    "",
    ...(plan.upgrades.candidates.length === 0
      ? ["No validated implementation candidates."]
      : plan.upgrades.candidates.map(
          (candidate) =>
            `- **${candidate.contractName}**: ${candidate.currentImplementation} → ${candidate.candidateAddress} (${candidate.status}, nonce ${candidate.nonce})`
        )),
    "",
    "## Contracts",
    "",
    "| Name | Kind | Address | Owner aligned | Implementation | Classification |",
    "| --- | --- | --- | --- | --- | --- |",
    ...plan.contracts.map(
      (contract) =>
        `| ${contract.name} | ${contract.kind} | \`${contract.address}\` | ${
          contract.ownerMatchesAuthority === null ? "n/a" : contract.ownerMatchesAuthority ? "yes" : "no"
        } | ${contract.implementation ? `\`${contract.implementation.address}\`` : "n/a"} | ${
          contract.implementation?.comparison.classification ?? "n/a"
        } |`
    ),
    "",
    "## Externals",
    "",
    "| Name | Address | Code bytes | Code hash |",
    "| --- | --- | ---: | --- |",
    ...plan.externals.map(
      (external) => `| ${external.name} | \`${external.address}\` | ${external.codeSize} | \`${external.codeHash}\` |`
    ),
    "",
    "## Domain policies",
    "",
    "| Domain | Policy | Reason |",
    "| --- | --- | --- |",
    ...plan.domains.map(({name, policy, reason}) => `| ${name} | ${policy} | ${reason} |`),
    "",
  ]
  return `${lines.join("\n")}\n`
}
