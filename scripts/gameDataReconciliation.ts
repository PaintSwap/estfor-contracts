import {Interface, JsonRpcProvider, ParamType, isError} from "ethers"
import {loadContractInterface} from "./deploymentArtifacts"
import type {ContractName, DeploymentRegistry} from "./deploymentRegistry"
import type {ReconciliationOperation, ReconciliationPlanOptions} from "./reconciliation"
import {gameDataAdapters} from "./gameDataAdapters"

// Values at this boundary are ABI-shaped objects, normalized before entering a saved plan.
export type GameDataValue = Record<string, any>
export interface GameDataRecord {
  key: string
  value: GameDataValue
}
export interface GameDataCall {
  fn: string
  args: unknown[]
  destructive?: boolean
}
export interface GameDataSnapshot {
  records: GameDataRecord[]
  completeness: "complete" | "legacy-attested" | "incomplete"
  notes?: string[]
}
export interface GameDataContext {
  abi: Interface
  call(fn: string, args?: unknown[]): Promise<any>
  value(fn: string, value: unknown): any
  scan(fn: string, end: number, prefix?: unknown[]): Promise<string[]>
  index(fn: string, count: bigint): Promise<string[]>
  at(target: string, abi: Interface): GameDataContext
}
export interface GameDataAdapter {
  domain: string
  contract: ContractName
  desired(ctx: GameDataContext): GameDataRecord[]
  read(ctx: GameDataContext): Promise<GameDataSnapshot>
  write(action: "add" | "update" | "remove", key: string, current?: GameDataRecord): GameDataCall[]
  notes?: string[]
}
export interface GameDataDomainPlan extends GameDataSnapshot {
  domain: string
  contract: ContractName
  target: string
  readStatus: "available" | "deferred-for-upgrade"
  policy: "exact" | "additive"
  desired: GameDataRecord[]
  changes: {add: string[]; update: string[]; remove: string[]; noOp: string[]}
  blockedReasons: string[]
  operations: ReconciliationOperation[]
  pendingKeys?: string[]
}
export interface GameDataPlan {
  domains: GameDataDomainPlan[]
  limits: {allowRemovals: boolean; maxChangedItems: number; maxRemovals: number}
  blockedReasons: string[]
  operations: ReconciliationOperation[]
}

export function gameDataJSON(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (typeof item === "bigint") return item.toString()
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return Object.fromEntries(
        Object.keys(item)
          .sort()
          .map((key) => [key, item[key]])
      )
    }
    return item
  })
}

// Use ABI component names and widths rather than comparing ethers Results with input objects.
// Missing fields are zero-filled only in desired projections of packed storage structs.
export function projectGameData(type: ParamType, value: any): any {
  if (type.isArray()) {
    const array = value ?? (type.arrayLength < 0 ? [] : Array(type.arrayLength).fill(undefined))
    return Array.from(array, (entry) => projectGameData(type.arrayChildren, entry))
  }
  if (type.isTuple()) {
    return Object.fromEntries(
      type.components.map((field, i) => [
        field.name || String(i),
        projectGameData(field, value?.[field.name] ?? value?.[i]),
      ])
    )
  }
  if (type.type === "bool") return value ?? false
  if (type.type === "string") return value ?? ""
  if (type.type.startsWith("bytes")) return value ?? `0x${"00".repeat(Number(type.type.slice(5)) || 0)}`
  if (type.type === "address") return String(value ?? `0x${"00".repeat(20)}`).toLowerCase()
  return BigInt(value ?? 0).toString()
}

export function gameDataContext(
  provider: Pick<JsonRpcProvider, "call">,
  target: string,
  blockTag: number,
  abi: Interface
): GameDataContext {
  const ctx: GameDataContext = {
    abi,
    at: (address, iface) => gameDataContext(provider, address, blockTag, iface),
    async call(fn, args = []) {
      const result = await provider.call({to: target, data: abi.encodeFunctionData(fn, args), blockTag})
      const values = abi.decodeFunctionResult(fn, result)
      return values.length === 1 ? values[0] : values
    },
    value(fn, value) {
      const outputs = abi.getFunction(fn)!.outputs
      if (outputs.length !== 1) throw new Error(`Expected one output for ${fn}`)
      return projectGameData(outputs[0], value)
    },
    async scan(fn, end, prefix = []) {
      const ids: string[] = []
      for (let start = 0; start < end; start += 8192) {
        const pages = await Promise.all(
          Array.from({length: Math.min(8, Math.ceil((end - start) / 1024))}, (_, index) => {
            const pageStart = start + index * 1024
            return ctx.call(fn, [...prefix, pageStart, Math.min(end, pageStart + 1024)])
          })
        )
        for (const page of pages) ids.push(...page.map(String))
      }
      return ids
    },
    async index(fn, count) {
      const ids: string[] = []
      for (let start = 0n; start < count; start += 1024n) {
        const end = start + 1024n < count ? start + 1024n : count
        ids.push(...(await ctx.call(fn, [start, end])).map(String))
      }
      return ids
    },
  }
  return ctx
}

function recordsByKey(records: GameDataRecord[]): Map<string, GameDataRecord> {
  const map = new Map(records.map((record) => [record.key, record]))
  if (map.size !== records.length) throw new Error("Duplicate game-data record key")
  return map
}

export function diffGameData(
  adapter: GameDataAdapter,
  ctx: GameDataContext,
  target: string,
  caller: string,
  snapshot: GameDataSnapshot,
  upgradeDependencies: string[] = []
): GameDataDomainPlan {
  const desired = adapter.desired(ctx)
  const wanted = recordsByKey(desired)
  const current = recordsByKey(snapshot.records)
  const changes: GameDataDomainPlan["changes"] = {add: [], update: [], remove: [], noOp: []}
  const blockedReasons: string[] = []
  const operations: ReconciliationOperation[] = []
  for (const key of [...new Set([...wanted.keys(), ...current.keys()])].sort()) {
    const before = current.get(key)
    const after = wanted.get(key)
    const action = !after
      ? "remove"
      : !before
      ? "add"
      : gameDataJSON(before.value) === gameDataJSON(after.value)
      ? "noOp"
      : "update"
    changes[action].push(key)
    if (action === "noOp") continue
    // Incomplete discovery permits desired-key updates, but never automatic stale-key removal.
    if (action === "remove" && snapshot.completeness === "incomplete") {
      blockedReasons.push(`${adapter.domain}:${key}: removal requires complete discovery`)
      continue
    }
    try {
      const calls = adapter.write(action, key, before)
      if (!calls.length) throw new Error("No safe mutation exists")
      for (const [index, call] of calls.entries()) {
        const id = `game-data:${adapter.domain}:${key}:${action}:${index}`
        operations.push({
          id,
          domain: adapter.domain,
          resource: key,
          action,
          target,
          caller,
          value: "0",
          data: ctx.abi.encodeFunctionData(call.fn, call.args),
          destructive: action === "remove" || call.destructive === true,
          dependencies: [...upgradeDependencies, ...(index ? [operations[operations.length - 1].id] : [])],
          estimatedGas: null,
          postcondition: {type: "game-data-match", domain: adapter.domain, key},
        })
      }
    } catch (error) {
      blockedReasons.push(`${adapter.domain}:${key}: ${(error as Error).message}`)
    }
  }
  return {
    ...snapshot,
    domain: adapter.domain,
    contract: adapter.contract,
    target,
    readStatus: "available",
    policy: snapshot.completeness === "incomplete" ? "additive" : "exact",
    desired,
    changes,
    blockedReasons,
    operations,
    notes: [
      ...(adapter.notes ?? []),
      ...(snapshot.notes ?? []),
      ...(snapshot.completeness === "incomplete"
        ? ["Unknown historical keys are not covered; this is not exact alignment."]
        : []),
      ...(snapshot.completeness === "legacy-attested"
        ? ["Completeness relies on owner-attested external history, not an on-chain proof."]
        : []),
    ],
  }
}

export async function buildGameDataPlan(
  provider: JsonRpcProvider,
  deployment: DeploymentRegistry,
  blockTag: number,
  upgrades: Array<{id: string; contractName: ContractName}>,
  options: ReconciliationPlanOptions & {onProgress?: (message: string) => void} = {}
): Promise<GameDataPlan> {
  const domains: GameDataDomainPlan[] = []
  for (const adapter of gameDataAdapters(deployment)) {
    options.onProgress?.(`Reading game data: ${adapter.domain}`)
    const target = deployment.contracts[adapter.contract].address
    const ctx = gameDataContext(provider, target, blockTag, loadContractInterface(adapter.contract))
    const dependencies = upgrades.filter((op) => op.contractName === adapter.contract).map((op) => op.id)
    try {
      const snapshot = await adapter.read(ctx)
      domains.push(diffGameData(adapter, ctx, target, deployment.authority.address, snapshot, dependencies))
    } catch (error) {
      if (!dependencies.length || !isError(error, "CALL_EXCEPTION")) throw error
      domains.push({
        domain: adapter.domain,
        contract: adapter.contract,
        target,
        readStatus: "deferred-for-upgrade",
        completeness: "incomplete",
        policy: "additive",
        records: [],
        desired: adapter.desired(ctx),
        changes: {add: [], update: [], remove: [], noOp: []},
        blockedReasons: [],
        operations: [],
        notes: ["Read reverted before the planned upgrade. Apply the upgrade, then replan; no alignment is claimed."],
      })
    }
  }
  const limits = {
    allowRemovals: options.allowRemovals ?? false,
    maxChangedItems: options.maxChangedItems ?? 100,
    maxRemovals: options.maxRemovals ?? 10,
  }
  const changed = domains.reduce(
    (n, d) => n + d.changes.add.length + d.changes.update.length + d.changes.remove.length,
    0
  )
  const removals = domains.reduce(
    (n, d) =>
      n + d.changes.remove.length + d.operations.filter((op) => op.destructive && op.action !== "remove").length,
    0
  )
  const blockedReasons = domains.flatMap((domain) => domain.blockedReasons)
  if (removals && !limits.allowRemovals) blockedReasons.push("Game-data removals require --allow-removals")
  if (changed > limits.maxChangedItems)
    blockedReasons.push(`Game-data changes ${changed} exceed cap ${limits.maxChangedItems}`)
  if (removals > limits.maxRemovals)
    blockedReasons.push(`Game-data removals ${removals} exceed cap ${limits.maxRemovals}`)
  return JSON.parse(gameDataJSON({domains, limits, blockedReasons, operations: domains.flatMap((d) => d.operations)}))
}

export async function verifyGameDataPostconditions(
  provider: JsonRpcProvider,
  deployment: DeploymentRegistry,
  plan: GameDataPlan
): Promise<number> {
  const blockTag = Number(await provider.send("eth_blockNumber", []))
  let verified = 0
  for (const adapter of gameDataAdapters(deployment)) {
    const expected = plan.domains.find((d) => d.domain === adapter.domain)
    if (!expected || expected.readStatus === "deferred-for-upgrade") continue
    const ctx = gameDataContext(provider, expected.target, blockTag, loadContractInterface(adapter.contract))
    const snapshot = await adapter.read(ctx)
    const actual = recordsByKey(snapshot.records)
    const pending = new Set(expected.pendingKeys ?? [])
    for (const key of pending) actual.delete(key)
    for (const record of expected.desired) {
      if (pending.has(record.key)) continue
      if (gameDataJSON(actual.get(record.key)?.value) !== gameDataJSON(record.value)) {
        throw new Error(`Game-data postcondition failed: ${adapter.domain}:${record.key}`)
      }
      actual.delete(record.key)
      verified++
    }
    if (expected.policy === "exact" && (actual.size || snapshot.completeness === "incomplete")) {
      throw new Error(`Game-data exact postcondition failed: ${adapter.domain}`)
    }
  }
  return verified
}
