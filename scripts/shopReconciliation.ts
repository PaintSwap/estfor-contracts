import {Interface, JsonRpcProvider, Log, getAddress} from "ethers";
import type {DeploymentRegistry} from "./deploymentRegistry";
import {getShopData} from "./data/shop";
import type {ShopData} from "./data/shop";

export const SHOP_RECONCILIATION_ABI = [
  "event AddShopItems((uint16 tokenId,uint128 price)[] shopItems)",
  "event EditShopItems((uint16 tokenId,uint128 price)[] shopItems)",
  "event RemoveShopItems(uint16[] tokenIds)",
  "event AddUnsellableItems(uint16[] tokenIds)",
  "event RemoveUnsellableItems(uint16[] tokenIds)",
  "function shopItems(uint16 tokenId) view returns (uint256)",
  "function tokenInfos(uint16 tokenId) view returns (uint80 allocationRemaining,uint80 price,uint40 checkpointTimestamp,bool unsellable)",
  "function addBuyableItems((uint16 tokenId,uint128 price)[] buyableItems)",
  "function editItems((uint16 tokenId,uint128 price)[] itemsToEdit)",
  "function removeItems(uint16[] tokenIds)",
  "function addUnsellableItems(uint16[] itemTokenIds)",
  "function removeUnsellableItems(uint16[] itemTokenIds)",
] as const;
const shopInterface = new Interface(SHOP_RECONCILIATION_ABI);

export interface ShopRecord {
  tokenId: number;
  price: string;
  unsellable: boolean;
}

export interface ShopOperation {
  id: string;
  domain: "shop";
  action: "add" | "update" | "remove";
  resource: "buyable-items" | "unsellable-items";
  target: string;
  caller: string;
  value: "0";
  data: string;
  tokenIds: number[];
  destructive: boolean;
  dependencies: string[];
  estimatedGas: string | null;
  postcondition: {type: "shop-records-match"; tokenIds: number[]};
}

export interface ShopPlan {
  policy: "exact";
  target: string;
  membershipSource: "events" | "scan" | "events+scan-audit";
  desired: ShopRecord[];
  current: ShopRecord[];
  buyableItems: {
    add: ShopRecord[];
    update: ShopRecord[];
    remove: ShopRecord[];
    noOp: ShopRecord[];
  };
  unsellableItems: {add: number[]; remove: number[]; noOp: number[]};
  limits: {
    allowRemovals: boolean;
    maxChangedItems: number;
    maxRemovals: number;
    maxAggregatePriceChange: string;
    changedItems: number;
    removals: number;
    aggregatePriceChange: string;
  };
  blockedReasons: string[];
  operations: ShopOperation[];
}

export interface ShopPlanOptions {
  allowRemovals?: boolean;
  maxChangedItems?: number;
  maxRemovals?: number;
  maxAggregatePriceChange?: bigint;
  auditMembership?: boolean;
}

export const DEFAULT_SHOP_LIMITS = {
  maxChangedItems: 100,
  maxRemovals: 10,
  maxAggregatePriceChange: 10_000n * 10n ** 18n,
};

function sorted(values: Iterable<number>): number[] {
  return [...values].sort((a, b) => a - b);
}

function desiredRecords(data: ShopData): ShopRecord[] {
  const prices = new Map(data.buyableItems.map(({tokenId, price}) => [tokenId, price]));
  const unsellable = new Set(data.unsellableItemIds);
  return sorted(new Set([...prices.keys(), ...unsellable])).map((tokenId) => ({
    tokenId,
    price: (prices.get(tokenId) ?? 0n).toString(),
    unsellable: unsellable.has(tokenId),
  }));
}

async function eventMembership(
  provider: JsonRpcProvider,
  address: string,
  fromBlock: number,
  toBlock: number
): Promise<Set<number>> {
  const buyableMembers = new Set<number>();
  const unsellableMembers = new Set<number>();
  const topicSet = [
    shopInterface.getEvent("AddShopItems")!.topicHash,
    shopInterface.getEvent("EditShopItems")!.topicHash,
    shopInterface.getEvent("RemoveShopItems")!.topicHash,
    shopInterface.getEvent("AddUnsellableItems")!.topicHash,
    shopInterface.getEvent("RemoveUnsellableItems")!.topicHash,
  ];
  const range = 50_000;
  for (let start = fromBlock; start <= toBlock; start += range) {
    const logs = await provider.getLogs({
      address,
      fromBlock: start,
      toBlock: Math.min(toBlock, start + range - 1),
      topics: [topicSet],
    });
    for (const log of logs) {
      const parsed = shopInterface.parseLog(log as Log);
      if (!parsed) continue;
      if (parsed.name === "AddShopItems" || parsed.name === "EditShopItems") {
        for (const item of parsed.args[0]) buyableMembers.add(Number(item.tokenId));
      } else {
        for (const tokenId of parsed.args[0]) {
          if (parsed.name === "RemoveShopItems") buyableMembers.delete(Number(tokenId));
          else if (parsed.name === "AddUnsellableItems") unsellableMembers.add(Number(tokenId));
          else unsellableMembers.delete(Number(tokenId));
        }
      }
    }
  }
  return new Set([...buyableMembers, ...unsellableMembers]);
}

async function readRecords(
  provider: JsonRpcProvider,
  address: string,
  tokenIds: number[],
  blockTag: number
): Promise<ShopRecord[]> {
  const records: ShopRecord[] = [];
  const concurrency = 200;
  for (let offset = 0; offset < tokenIds.length; offset += concurrency) {
    const ids = tokenIds.slice(offset, offset + concurrency);
    const values = await Promise.all(
      ids.map(async (tokenId) => {
        const [priceResult, tokenInfoResult] = await Promise.all([
          provider.call({to: address, data: shopInterface.encodeFunctionData("shopItems", [tokenId]), blockTag}),
          provider.call({to: address, data: shopInterface.encodeFunctionData("tokenInfos", [tokenId]), blockTag}),
        ]);
        return {
          tokenId,
          price: (shopInterface.decodeFunctionResult("shopItems", priceResult)[0] as bigint).toString(),
          unsellable: Boolean(shopInterface.decodeFunctionResult("tokenInfos", tokenInfoResult)[3]),
        };
      })
    );
    records.push(...values.filter(({price, unsellable}) => price !== "0" || unsellable));
  }
  return records;
}

export async function readCurrentShop(
  provider: JsonRpcProvider,
  deployment: DeploymentRegistry,
  blockTag: number,
  auditMembership = false
): Promise<{records: ShopRecord[]; membershipSource: ShopPlan["membershipSource"]}> {
  const address = getAddress(deployment.contracts.shop.address);
  let eventIds: Set<number>;
  try {
    eventIds = await eventMembership(provider, address, deployment.deploymentBlock, blockTag);
  } catch {
    const records = await readRecords(
      provider,
      address,
      Array.from({length: 65_536}, (_, tokenId) => tokenId),
      blockTag
    );
    return {records, membershipSource: "scan"};
  }
  const records = await readRecords(provider, address, sorted(eventIds), blockTag);
  if (!auditMembership) return {records, membershipSource: "events"};

  const scanned = await readRecords(
    provider,
    address,
    Array.from({length: 65_536}, (_, tokenId) => tokenId),
    blockTag
  );
  const eventKeys = records.map(({tokenId}) => tokenId).join(",");
  const scanKeys = scanned.map(({tokenId}) => tokenId).join(",");
  if (eventKeys !== scanKeys) throw new Error("Shop event membership does not match bounded uint16 audit scan");
  return {records: scanned, membershipSource: "events+scan-audit"};
}

function operation(
  target: string,
  caller: string,
  action: ShopOperation["action"],
  resource: ShopOperation["resource"],
  functionName: string,
  args: unknown[],
  tokenIds: number[]
): ShopOperation {
  return {
    id: `shop:${resource}:${action}`,
    domain: "shop",
    action,
    resource,
    target,
    caller,
    value: "0",
    data: shopInterface.encodeFunctionData(functionName, args),
    tokenIds,
    destructive: action === "remove",
    dependencies: [],
    estimatedGas: null,
    postcondition: {type: "shop-records-match", tokenIds},
  };
}

export function diffShop(
  deployment: DeploymentRegistry,
  current: ShopRecord[],
  membershipSource: ShopPlan["membershipSource"],
  options: ShopPlanOptions = {}
): ShopPlan {
  const desired = desiredRecords(getShopData(deployment.profile));
  const desiredById = new Map(desired.map((record) => [record.tokenId, record]));
  const currentById = new Map(current.map((record) => [record.tokenId, record]));
  const add: ShopRecord[] = [];
  const update: ShopRecord[] = [];
  const remove: ShopRecord[] = [];
  const noOp: ShopRecord[] = [];
  const unsellableAdd: number[] = [];
  const unsellableRemove: number[] = [];
  const unsellableNoOp: number[] = [];

  for (const desiredRecord of desired) {
    if (desiredRecord.price === "0") continue;
    const currentRecord = currentById.get(desiredRecord.tokenId);
    if (!currentRecord || currentRecord.price === "0") add.push(desiredRecord);
    else if (currentRecord.price !== desiredRecord.price) update.push(desiredRecord);
    else noOp.push(desiredRecord);
  }
  for (const currentRecord of current) {
    if (currentRecord.price !== "0" && (desiredById.get(currentRecord.tokenId)?.price ?? "0") === "0")
      remove.push(currentRecord);
  }
  for (const tokenId of sorted(new Set([...desiredById.keys(), ...currentById.keys()]))) {
    const wanted = desiredById.get(tokenId)?.unsellable ?? false;
    const actual = currentById.get(tokenId)?.unsellable ?? false;
    if (wanted && !actual) unsellableAdd.push(tokenId);
    else if (!wanted && actual) unsellableRemove.push(tokenId);
    else if (wanted) unsellableNoOp.push(tokenId);
  }

  const allowRemovals = options.allowRemovals ?? false;
  const maxChangedItems = options.maxChangedItems ?? DEFAULT_SHOP_LIMITS.maxChangedItems;
  const maxRemovals = options.maxRemovals ?? DEFAULT_SHOP_LIMITS.maxRemovals;
  const maxAggregatePriceChange = options.maxAggregatePriceChange ?? DEFAULT_SHOP_LIMITS.maxAggregatePriceChange;
  const changedIds = new Set([
    ...add.map(({tokenId}) => tokenId),
    ...update.map(({tokenId}) => tokenId),
    ...remove.map(({tokenId}) => tokenId),
    ...unsellableAdd,
    ...unsellableRemove,
  ]);
  const removals = remove.length + unsellableRemove.length;
  const aggregatePriceChange = [...add, ...update, ...remove].reduce((total, record) => {
    const currentPrice = BigInt(currentById.get(record.tokenId)?.price ?? 0);
    const desiredPrice = BigInt(desiredById.get(record.tokenId)?.price ?? 0);
    return total + (currentPrice > desiredPrice ? currentPrice - desiredPrice : desiredPrice - currentPrice);
  }, 0n);
  const blockedReasons: string[] = [];
  if (removals !== 0 && !allowRemovals) blockedReasons.push("Shop removals require --allow-removals");
  if (changedIds.size > maxChangedItems)
    blockedReasons.push(`Shop changed item count ${changedIds.size} exceeds cap ${maxChangedItems}`);
  if (removals > maxRemovals) blockedReasons.push(`Shop removal count ${removals} exceeds cap ${maxRemovals}`);
  if (aggregatePriceChange > maxAggregatePriceChange)
    blockedReasons.push(`Shop aggregate price change ${aggregatePriceChange} exceeds cap ${maxAggregatePriceChange}`);

  const target = getAddress(deployment.contracts.shop.address);
  const caller = getAddress(deployment.authority.address);
  const operations: ShopOperation[] = [];
  if (remove.length)
    operations.push(
      operation(
        target,
        caller,
        "remove",
        "buyable-items",
        "removeItems",
        [remove.map(({tokenId}) => tokenId)],
        remove.map(({tokenId}) => tokenId)
      )
    );
  if (add.length)
    operations.push(
      operation(
        target,
        caller,
        "add",
        "buyable-items",
        "addBuyableItems",
        [add.map(({tokenId, price}) => ({tokenId, price}))],
        add.map(({tokenId}) => tokenId)
      )
    );
  if (update.length)
    operations.push(
      operation(
        target,
        caller,
        "update",
        "buyable-items",
        "editItems",
        [update.map(({tokenId, price}) => ({tokenId, price}))],
        update.map(({tokenId}) => tokenId)
      )
    );
  if (unsellableRemove.length)
    operations.push(
      operation(
        target,
        caller,
        "remove",
        "unsellable-items",
        "removeUnsellableItems",
        [unsellableRemove],
        unsellableRemove
      )
    );
  if (unsellableAdd.length)
    operations.push(
      operation(target, caller, "add", "unsellable-items", "addUnsellableItems", [unsellableAdd], unsellableAdd)
    );

  return {
    policy: "exact",
    target,
    membershipSource,
    desired,
    current: [...current].sort((a, b) => a.tokenId - b.tokenId),
    buyableItems: {add, update, remove, noOp},
    unsellableItems: {add: unsellableAdd, remove: unsellableRemove, noOp: unsellableNoOp},
    limits: {
      allowRemovals,
      maxChangedItems,
      maxRemovals,
      maxAggregatePriceChange: maxAggregatePriceChange.toString(),
      changedItems: changedIds.size,
      removals,
      aggregatePriceChange: aggregatePriceChange.toString(),
    },
    blockedReasons,
    operations,
  };
}

export async function buildShopPlan(
  provider: JsonRpcProvider,
  deployment: DeploymentRegistry,
  blockTag: number,
  options: ShopPlanOptions = {}
): Promise<ShopPlan> {
  const {records, membershipSource} = await readCurrentShop(provider, deployment, blockTag, options.auditMembership);
  return diffShop(deployment, records, membershipSource, options);
}

export async function verifyShopPostconditions(provider: JsonRpcProvider, plan: ShopPlan): Promise<void> {
  const managedIds = sorted(
    new Set([...plan.desired.map(({tokenId}) => tokenId), ...plan.current.map(({tokenId}) => tokenId)])
  );
  const blockTag = Number(await provider.send("eth_blockNumber", []));
  const actual = await readRecords(provider, plan.target, managedIds, blockTag);
  const expected = plan.desired.filter(({price, unsellable}) => price !== "0" || unsellable);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Shop simulation postconditions failed");
}
