import {readFileSync, readdirSync} from "fs";
import {join, resolve} from "path";
import {Contract, isAddress, Provider} from "ethers";

export const CONTRACT_NAMES = [
  "bridge",
  "worldActions",
  "randomnessBeacon",
  "dailyRewardsScheduler",
  "treasury",
  "shop",
  "royaltyReceiver",
  "adminAccess",
  "itemNFTLibrary",
  "itemNFT",
  "bazaar",
  "estforLibrary",
  "playerNFT",
  "quests",
  "clans",
  "wishingWell",
  "bank",
  "petNFTLibrary",
  "petNFT",
  "playersLibrary",
  "playersImplQueueActions",
  "playersImplProcessActions",
  "playersImplRewards",
  "playersImplMisc",
  "playersImplMisc1",
  "players",
  "promotionsLibrary",
  "promotions",
  "passiveActions",
  "instantActions",
  "instantVRFActions",
  "genericInstantVRFActionStrategy",
  "eggInstantVRFActionStrategy",
  "bankRelay",
  "pvpBattleground",
  "raids",
  "clanBattleLibrary",
  "lockedBankVaultsLibrary",
  "lockedBankVaults",
  "territories",
  "combatantsHelper",
  "territoryTreasury",
  "bankRegistry",
  "bankFactory",
  "activityPoints",
  "marketplace",
  "cosmetics",
  "globalEvent",
  "blackMarketTrader",
  "usageBasedSessionModule",
  "gameSubsidisationRegistry",
  "petNFTReroll",
  "orderbookV2",
] as const;

export const EXTERNAL_NAMES = ["brush", "wftm", "vrf", "router", "paintSwapMarketplaceWhitelist", "usdc"] as const;

export type ContractName = (typeof CONTRACT_NAMES)[number];
export type ExternalName = (typeof EXTERNAL_NAMES)[number];
export type DeploymentProfile = "live" | "beta";
export type ContractKind = "uups" | "beacon" | "library" | "implementation";

export interface DeploymentContract {
  kind: ContractKind;
  address: string;
}

export interface DeploymentRegistry {
  schemaVersion: 1;
  deploymentId: string;
  chainId: number;
  deploymentBlock: number;
  networkFingerprint: {genesisHash: string};
  profile: DeploymentProfile;
  authority: {type: "safe"; address: string};
  contracts: Record<ContractName, DeploymentContract>;
  externals: Record<ExternalName, string>;
  subsidySigners: string[];
}

export interface DeploymentValidationResult {
  deploymentId: string;
  chainId: number;
  safe: string;
  safeOwners: number;
  safeThreshold: number;
  checkedContracts: number;
  checkedExternals: number;
}

const DEPLOYMENTS_ROOT = resolve(__dirname, "../deployments");
const DEPLOYMENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const SAFE_ABI = ["function getOwners() view returns (address[])", "function getThreshold() view returns (uint256)"];
const OWNABLE_ABI = ["function owner() view returns (address)"];

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a non-empty string`);
  return value;
}

function requireInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(`${label} must be a non-negative integer`);
  return Number(value);
}

function requireAddress(value: unknown, label: string): string {
  const address = requireString(value, label);
  if (!isAddress(address)) throw new Error(`${label} must be an Ethereum address`);
  return address;
}

function findDeploymentFile(deploymentId: string, deploymentsRoot: string): string {
  if (!DEPLOYMENT_ID_PATTERN.test(deploymentId)) {
    throw new Error(`Invalid deployment ID "${deploymentId}"`);
  }

  const matches = readdirSync(deploymentsRoot, {withFileTypes: true})
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(deploymentsRoot, entry.name, `${deploymentId}.json`))
    .filter((path) => {
      try {
        readFileSync(path);
        return true;
      } catch {
        return false;
      }
    });

  if (matches.length === 0) throw new Error(`Unknown deployment "${deploymentId}"`);
  if (matches.length > 1) throw new Error(`Deployment ID "${deploymentId}" is not unique`);
  return matches[0];
}

export function validateDeploymentRegistry(value: unknown, expectedDeploymentId?: string): DeploymentRegistry {
  const registry = requireObject(value, "deployment registry");
  if (registry.schemaVersion !== 1) throw new Error("deployment registry schemaVersion must be 1");

  const deploymentId = requireString(registry.deploymentId, "deploymentId");
  if (!DEPLOYMENT_ID_PATTERN.test(deploymentId)) throw new Error(`Invalid deployment ID "${deploymentId}"`);
  if (expectedDeploymentId !== undefined && deploymentId !== expectedDeploymentId) {
    throw new Error(`Deployment file contains "${deploymentId}", expected "${expectedDeploymentId}"`);
  }

  const chainId = requireInteger(registry.chainId, "chainId");
  if (chainId === 0) throw new Error("chainId must be greater than zero");
  const deploymentBlock = requireInteger(registry.deploymentBlock, "deploymentBlock");

  const networkFingerprint = requireObject(registry.networkFingerprint, "networkFingerprint");
  const genesisHash = requireString(networkFingerprint.genesisHash, "networkFingerprint.genesisHash");
  if (!HASH_PATTERN.test(genesisHash)) throw new Error("networkFingerprint.genesisHash must be a block hash");

  if (registry.profile !== "live" && registry.profile !== "beta") {
    throw new Error('profile must be "live" or "beta"');
  }

  const authority = requireObject(registry.authority, "authority");
  if (authority.type !== "safe") throw new Error('authority.type must be "safe"');
  const authorityAddress = requireAddress(authority.address, "authority.address");

  const rawContracts = requireObject(registry.contracts, "contracts");
  const contracts = {} as Record<ContractName, DeploymentContract>;
  for (const name of CONTRACT_NAMES) {
    const rawContract = requireObject(rawContracts[name], `contracts.${name}`);
    if (!(["uups", "beacon", "library", "implementation"] as unknown[]).includes(rawContract.kind)) {
      throw new Error(`contracts.${name}.kind is invalid`);
    }
    contracts[name] = {
      kind: rawContract.kind as ContractKind,
      address: requireAddress(rawContract.address, `contracts.${name}.address`),
    };
  }
  const unknownContracts = Object.keys(rawContracts).filter(
    (name) => !(CONTRACT_NAMES as readonly string[]).includes(name)
  );
  if (unknownContracts.length !== 0) throw new Error(`Unknown contracts: ${unknownContracts.join(", ")}`);

  const rawExternals = requireObject(registry.externals, "externals");
  const externals = {} as Record<ExternalName, string>;
  for (const name of EXTERNAL_NAMES) {
    externals[name] = requireAddress(rawExternals[name], `externals.${name}`);
  }
  const unknownExternals = Object.keys(rawExternals).filter(
    (name) => !(EXTERNAL_NAMES as readonly string[]).includes(name)
  );
  if (unknownExternals.length !== 0) throw new Error(`Unknown externals: ${unknownExternals.join(", ")}`);

  if (!Array.isArray(registry.subsidySigners)) throw new Error("subsidySigners must be an array");
  const subsidySigners = registry.subsidySigners.map((address, index) =>
    requireAddress(address, `subsidySigners[${index}]`)
  );

  return {
    schemaVersion: 1,
    deploymentId,
    chainId,
    deploymentBlock,
    networkFingerprint: {genesisHash},
    profile: registry.profile,
    authority: {type: "safe", address: authorityAddress},
    contracts,
    externals,
    subsidySigners,
  };
}

export function loadDeploymentRegistry(deploymentId: string, deploymentsRoot = DEPLOYMENTS_ROOT): DeploymentRegistry {
  const file = findDeploymentFile(deploymentId, deploymentsRoot);
  return validateDeploymentRegistry(JSON.parse(readFileSync(file, "utf8")), deploymentId);
}

export function getSelectedDeploymentId(environment: NodeJS.ProcessEnv = process.env): string {
  const deploymentId = environment.DEPLOYMENT_ID;
  if (!deploymentId) throw new Error("DEPLOYMENT_ID is required (for example, sonic-live or sonic-beta)");
  return deploymentId;
}

export function loadSelectedDeployment(environment: NodeJS.ProcessEnv = process.env): DeploymentRegistry {
  return loadDeploymentRegistry(getSelectedDeploymentId(environment));
}

export function getDeploymentIsBeta(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment.DEPLOYMENT_ID
    ? loadDeploymentRegistry(environment.DEPLOYMENT_ID).profile === "beta"
    : environment.IS_BETA === "true";
}

export function getContractAddress(deployment: DeploymentRegistry, name: ContractName): string {
  return deployment.contracts[name].address;
}

export async function validateDeploymentOnChain(
  deployment: DeploymentRegistry,
  provider: Provider
): Promise<DeploymentValidationResult> {
  const network = await provider.getNetwork();
  if (network.chainId !== BigInt(deployment.chainId)) {
    throw new Error(`RPC chain ID ${network.chainId} does not match deployment chain ID ${deployment.chainId}`);
  }

  const genesisBlock = await provider.getBlock(0);
  if (!genesisBlock || genesisBlock.hash?.toLowerCase() !== deployment.networkFingerprint.genesisHash.toLowerCase()) {
    throw new Error("RPC genesis hash does not match deployment network fingerprint");
  }

  const latestBlock = await provider.getBlockNumber();
  if (deployment.deploymentBlock > latestBlock) {
    throw new Error(`deploymentBlock ${deployment.deploymentBlock} is ahead of latest block ${latestBlock}`);
  }

  const safeCode = await provider.getCode(deployment.authority.address);
  if (safeCode === "0x") throw new Error(`No Safe code at ${deployment.authority.address}`);
  const safe = new Contract(deployment.authority.address, SAFE_ABI, provider);
  const [safeOwners, safeThreshold] = (await Promise.all([safe.getOwners(), safe.getThreshold()])) as [
    string[],
    bigint
  ];
  if (safeThreshold < 2n || safeOwners.length < Number(safeThreshold)) {
    throw new Error(`Authority ${deployment.authority.address} is not a valid multisignature Safe`);
  }

  for (const [name, configuredContract] of Object.entries(deployment.contracts)) {
    const code = await provider.getCode(configuredContract.address);
    if (code === "0x") throw new Error(`No code at contracts.${name} (${configuredContract.address})`);
    if (configuredContract.kind === "uups" || configuredContract.kind === "beacon") {
      const ownable = new Contract(configuredContract.address, OWNABLE_ABI, provider);
      const owner = (await ownable.owner()) as string;
      if (owner.toLowerCase() !== deployment.authority.address.toLowerCase()) {
        throw new Error(`contracts.${name} owner ${owner} does not match Safe ${deployment.authority.address}`);
      }
    }
  }

  for (const [name, address] of Object.entries(deployment.externals)) {
    if ((await provider.getCode(address)) === "0x") throw new Error(`No code at externals.${name} (${address})`);
  }

  return {
    deploymentId: deployment.deploymentId,
    chainId: deployment.chainId,
    safe: deployment.authority.address,
    safeOwners: safeOwners.length,
    safeThreshold: Number(safeThreshold),
    checkedContracts: Object.keys(deployment.contracts).length,
    checkedExternals: Object.keys(deployment.externals).length,
  };
}
