import {Interface, JsonRpcProvider, getAddress} from "ethers"
import type {DeploymentRegistry} from "./deploymentRegistry"
import {getShopData} from "./data/shop"
import type {ShopData} from "./data/shop"
import type {ReconciliationOperation, ReconciliationPlan, ReconciliationPlanOptions} from "./reconciliation"

export const SHOP_RECONCILIATION_ABI = [
  "function getShopItemStates(uint256 startTokenId,uint256 endTokenId) view returns ((uint16 tokenId,uint256 price,bool unsellable)[])",
  "function addBuyableItems((uint16 tokenId,uint128 price)[] buyableItems)",
  "function editItems((uint16 tokenId,uint128 price)[] itemsToEdit)",
  "function removeItems(uint16[] tokenIds)",
  "function addUnsellableItems(uint16[] itemTokenIds)",
  "function removeUnsellableItems(uint16[] itemTokenIds)",
] as const
const shopInterface = new Interface(SHOP_RECONCILIATION_ABI)
const shopStateGetterSelector = shopInterface.getFunction("getShopItemStates")!.selector.slice(2).toLowerCase()

export function hasShopStateGetter(runtimeCode: string): boolean {
  return runtimeCode.toLowerCase().includes(shopStateGetterSelector)
}

export interface ShopRecord {
  tokenId: number
  price: string
  unsellable: boolean
}

export type ShopResource = "buyable-items" | "unsellable-items"
export interface ShopPostcondition {
  type: "shop-records-match"
  tokenIds: number[]
}
export type ShopOperation = ReconciliationOperation<ShopResource, ShopPostcondition> & {
  domain: "shop"
  value: "0"
  tokenIds: number[]
}

export interface ShopChanges {
  buyableItems: {
    add: ShopRecord[]
    update: ShopRecord[]
    remove: ShopRecord[]
    noOp: ShopRecord[]
  }
  unsellableItems: {add: number[]; remove: number[]; noOp: number[]}
}

export interface ShopLimits {
  allowRemovals: boolean
  maxChangedItems: number
  maxRemovals: number
  maxAggregatePriceChange: string
  changedItems: number
  removals: number
  aggregatePriceChange: string
}

export interface ShopPlan
  extends ReconciliationPlan<ShopRecord[], ShopRecord[], ShopChanges, ShopLimits, ShopOperation> {
  target: string
  readStatus: "available" | "deferred-for-upgrade"
}

export interface ShopPlanOptions extends ReconciliationPlanOptions {
  maxAggregatePriceChange?: bigint
  onProgress?: (message: string) => void
}

export const DEFAULT_SHOP_LIMITS = {
  maxChangedItems: 100,
  maxRemovals: 10,
  maxAggregatePriceChange: 10_000n * 10n ** 18n,
}

function sorted(values: Iterable<number>): number[] {
  return [...values].sort((a, b) => a - b)
}

function desiredRecords(data: ShopData): ShopRecord[] {
  const prices = new Map(data.buyableItems.map(({tokenId, price}) => [tokenId, price]))
  const unsellable = new Set(data.unsellableItemIds)
  return sorted(new Set([...prices.keys(), ...unsellable])).map((tokenId) => ({
    tokenId,
    price: (prices.get(tokenId) ?? 0n).toString(),
    unsellable: unsellable.has(tokenId),
  }))
}

async function readRecords(
  provider: JsonRpcProvider,
  address: string,
  blockTag: number,
  onProgress?: (message: string) => void
): Promise<ShopRecord[]> {
  const records: ShopRecord[] = []
  const pageSize = 1024
  for (let startTokenId = 0; startTokenId < 65_536; startTokenId += pageSize) {
    if (startTokenId % (pageSize * 8) === 0) {
      onProgress?.(`Reading shop token IDs ${startTokenId}-${startTokenId + pageSize * 8 - 1}`)
    }
    const result = await provider.call({
      to: address,
      data: shopInterface.encodeFunctionData("getShopItemStates", [startTokenId, startTokenId + pageSize]),
      blockTag,
    })
    const states = shopInterface.decodeFunctionResult("getShopItemStates", result)[0]
    for (const state of states) {
      records.push({tokenId: Number(state.tokenId), price: state.price.toString(), unsellable: state.unsellable})
    }
  }
  return records
}

export async function readCurrentShop(
  provider: JsonRpcProvider,
  deployment: DeploymentRegistry,
  blockTag: number,
  onProgress?: (message: string) => void
): Promise<ShopRecord[]> {
  const address = getAddress(deployment.contracts.shop.address)
  return readRecords(provider, address, blockTag, onProgress)
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
  }
}

export function diffShop(
  deployment: DeploymentRegistry,
  current: ShopRecord[],
  options: ShopPlanOptions = {}
): ShopPlan {
  const desired = desiredRecords(getShopData(deployment.profile))
  const desiredById = new Map(desired.map((record) => [record.tokenId, record]))
  const currentById = new Map(current.map((record) => [record.tokenId, record]))
  const add: ShopRecord[] = []
  const update: ShopRecord[] = []
  const remove: ShopRecord[] = []
  const noOp: ShopRecord[] = []
  const unsellableAdd: number[] = []
  const unsellableRemove: number[] = []
  const unsellableNoOp: number[] = []

  for (const desiredRecord of desired) {
    if (desiredRecord.price === "0") continue
    const currentRecord = currentById.get(desiredRecord.tokenId)
    if (!currentRecord || currentRecord.price === "0") add.push(desiredRecord)
    else if (currentRecord.price !== desiredRecord.price) update.push(desiredRecord)
    else noOp.push(desiredRecord)
  }
  for (const currentRecord of current) {
    if (currentRecord.price !== "0" && (desiredById.get(currentRecord.tokenId)?.price ?? "0") === "0")
      remove.push(currentRecord)
  }
  for (const tokenId of sorted(new Set([...desiredById.keys(), ...currentById.keys()]))) {
    const wanted = desiredById.get(tokenId)?.unsellable ?? false
    const actual = currentById.get(tokenId)?.unsellable ?? false
    if (wanted && !actual) unsellableAdd.push(tokenId)
    else if (!wanted && actual) unsellableRemove.push(tokenId)
    else if (wanted) unsellableNoOp.push(tokenId)
  }

  const allowRemovals = options.allowRemovals ?? false
  const maxChangedItems = options.maxChangedItems ?? DEFAULT_SHOP_LIMITS.maxChangedItems
  const maxRemovals = options.maxRemovals ?? DEFAULT_SHOP_LIMITS.maxRemovals
  const maxAggregatePriceChange = options.maxAggregatePriceChange ?? DEFAULT_SHOP_LIMITS.maxAggregatePriceChange
  const changedIds = new Set([
    ...add.map(({tokenId}) => tokenId),
    ...update.map(({tokenId}) => tokenId),
    ...remove.map(({tokenId}) => tokenId),
    ...unsellableAdd,
    ...unsellableRemove,
  ])
  const removals = remove.length + unsellableRemove.length
  const aggregatePriceChange = [...add, ...update, ...remove].reduce((total, record) => {
    const currentPrice = BigInt(currentById.get(record.tokenId)?.price ?? 0)
    const desiredPrice = BigInt(desiredById.get(record.tokenId)?.price ?? 0)
    return total + (currentPrice > desiredPrice ? currentPrice - desiredPrice : desiredPrice - currentPrice)
  }, 0n)
  const blockedReasons: string[] = []
  if (removals !== 0 && !allowRemovals) blockedReasons.push("Shop removals require --allow-removals")
  if (changedIds.size > maxChangedItems)
    blockedReasons.push(`Shop changed item count ${changedIds.size} exceeds cap ${maxChangedItems}`)
  if (removals > maxRemovals) blockedReasons.push(`Shop removal count ${removals} exceeds cap ${maxRemovals}`)
  if (aggregatePriceChange > maxAggregatePriceChange)
    blockedReasons.push(`Shop aggregate price change ${aggregatePriceChange} exceeds cap ${maxAggregatePriceChange}`)

  const target = getAddress(deployment.contracts.shop.address)
  const caller = getAddress(deployment.authority.address)
  const operations: ShopOperation[] = []
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
    )
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
    )
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
    )
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
    )
  if (unsellableAdd.length)
    operations.push(
      operation(target, caller, "add", "unsellable-items", "addUnsellableItems", [unsellableAdd], unsellableAdd)
    )

  return {
    policy: "exact",
    target,
    readStatus: "available",
    desired,
    current: [...current].sort((a, b) => a.tokenId - b.tokenId),
    changes: {
      buyableItems: {add, update, remove, noOp},
      unsellableItems: {add: unsellableAdd, remove: unsellableRemove, noOp: unsellableNoOp},
    },
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
  }
}

export function deferShopPlanForUpgrade(deployment: DeploymentRegistry, options: ShopPlanOptions = {}): ShopPlan {
  const desired = desiredRecords(getShopData(deployment.profile))
  return {
    policy: "exact",
    target: getAddress(deployment.contracts.shop.address),
    readStatus: "deferred-for-upgrade",
    desired,
    current: [],
    changes: {
      buyableItems: {add: [], update: [], remove: [], noOp: []},
      unsellableItems: {add: [], remove: [], noOp: []},
    },
    limits: {
      allowRemovals: options.allowRemovals ?? false,
      maxChangedItems: options.maxChangedItems ?? DEFAULT_SHOP_LIMITS.maxChangedItems,
      maxRemovals: options.maxRemovals ?? DEFAULT_SHOP_LIMITS.maxRemovals,
      maxAggregatePriceChange: (
        options.maxAggregatePriceChange ?? DEFAULT_SHOP_LIMITS.maxAggregatePriceChange
      ).toString(),
      changedItems: 0,
      removals: 0,
      aggregatePriceChange: "0",
    },
    blockedReasons: [],
    operations: [],
  }
}

export async function buildShopPlan(
  provider: JsonRpcProvider,
  deployment: DeploymentRegistry,
  blockTag: number,
  options: ShopPlanOptions = {}
): Promise<ShopPlan> {
  options.onProgress?.("Reading current shop state (64 RPC pages)")
  const records = await readCurrentShop(provider, deployment, blockTag, options.onProgress)
  return diffShop(deployment, records, options)
}

export async function verifyShopPostconditions(
  provider: JsonRpcProvider,
  plan: ShopPlan,
  onProgress?: (message: string) => void
): Promise<void> {
  if (plan.readStatus === "deferred-for-upgrade") return
  const blockTag = Number(await provider.send("eth_blockNumber", []))
  const actual = await readRecords(provider, plan.target, blockTag, onProgress)
  const expected = plan.desired.filter(({price, unsellable}) => price !== "0" || unsellable)
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Shop simulation postconditions failed")
}
