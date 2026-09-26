import assert from "node:assert/strict"
import {after, before, describe, it} from "node:test"
import {spawn, ChildProcess} from "node:child_process"
import {createServer} from "node:net"
import {Interface, JsonRpcProvider, ParamType, toBeHex} from "ethers"
import {gameDataAdapters} from "./gameDataAdapters"
import {loadContractInterface, loadArtifactFingerprint} from "./deploymentArtifacts"
import {CONTRACT_NAMES, loadDeploymentRegistry, ContractName} from "./deploymentRegistry"
import {diffGameData, gameDataContext, gameDataJSON, projectGameData, GameDataAdapter} from "./gameDataReconciliation"
import {allBattleSkills} from "./data/territories"
import {allItems} from "./data/items"
import {waitForAnvilTransaction} from "./deploymentSimulation"
import {toRpcTransaction} from "./reconciliation"
import {buildSafeBatches} from "./safeReconciliation"

describe("game-data plan safety", () => {
  const abi = new Interface(["function put(uint256 id,uint256 value)", "function drop(uint256 id)"])
  const ctx = gameDataContext({call: async () => "0x"}, "0x0000000000000000000000000000000000000001", 123, abi)
  const adapter: GameDataAdapter = {
    domain: "test",
    contract: "shop",
    desired: () => [
      {key: "2", value: {amount: "7"}},
      {key: "4", value: {amount: "11"}},
    ],
    read: async () => ({records: [], completeness: "complete"}),
    write: (action, id) => [
      {fn: action === "remove" ? "drop" : "put", args: action === "remove" ? [id] : [id, id === "2" ? 7 : 11]},
    ],
  }
  it("distinguishes add/update/remove, keeps upgrade dependencies and preserves large integer keys", () => {
    const stale = (2n ** 255n + 13n).toString()
    const plan = diffGameData(
      adapter,
      ctx,
      "target",
      "caller",
      {
        completeness: "complete",
        records: [
          {key: "2", value: {amount: "8"}},
          {key: stale, value: {amount: "5"}},
        ],
      },
      ["upgrade:shop"]
    )
    assert.deepEqual(plan.changes, {add: ["4"], update: ["2"], remove: [stale], noOp: []})
    assert.equal(abi.decodeFunctionData("drop", plan.operations.find((op) => op.destructive)!.data)[0], BigInt(stale))
    assert.ok(plan.operations.every((op) => op.dependencies.includes("upgrade:shop")))
    assert.equal(plan.blockedReasons.length, 0)
  })
  it("blocks stale-key removal while discovery is incomplete; never invents attestation calls", () => {
    const plan = diffGameData(adapter, ctx, "target", "caller", {
      completeness: "incomplete",
      records: [{key: "9", value: {amount: "2"}}],
    })
    assert.equal(plan.policy, "additive")
    assert.match(plan.blockedReasons.join(";"), /removal requires complete discovery/)
    assert.equal(plan.operations.filter((op) => op.destructive).length, 0)
    assert.equal(plan.operations.length, 2)
  })
  it("discloses legacy attestations and reaches an empty second plan", () => {
    const plan = diffGameData(adapter, ctx, "target", "caller", {
      completeness: "legacy-attested",
      records: adapter.desired(ctx),
    })
    assert.equal(plan.operations.length, 0)
    assert.equal(plan.blockedReasons.length, 0)
    assert.match(plan.notes!.join(";"), /not an on-chain proof/)
  })
  it("does not turn independent records into one unsplittable Safe batch", () => {
    const caller = "0x1111111111111111111111111111111111111111"
    const plan = diffGameData(adapter, ctx, caller, caller, {completeness: "complete", records: []})
    plan.operations.forEach((op) => {
      op.estimatedGas = "100000"
    })
    assert.equal(buildSafeBatches(plan.operations, caller, {maxOperations: 1, maxGas: 200000n}).length, 2)
  })
  it("normalizes named, signed, fixed-array and packed fields without comparing unpersisted input fields", () => {
    const type = ParamType.from("tuple(int16 attack,bytes1 packed,uint16[2] rewards)")
    assert.deepEqual(projectGameData(type, {attack: -17, packed: "0xc0", rewards: [9, 21], name: "not persisted"}), {
      attack: "-17",
      packed: "0xc0",
      rewards: ["9", "21"],
    })
  })
  it("uses registry addresses and the explicit beta subsidy multiplier", () => {
    for (const profile of ["beta", "live"] as const) {
      const deployment = loadDeploymentRegistry(`sonic-${profile}`)
      deployment.contracts.playerNFT.address = "0x0000000000000000000000000000000000009876"
      const adapters = gameDataAdapters(deployment)
      const selectors = adapters.find((adapter) => adapter.domain === "session-subsidy-selectors")!.desired(ctx)
      const mint = loadContractInterface("playerNFT").getFunction("mint")!.selector
      assert.deepEqual(
        selectors.find((record) => record.key === `${deployment.contracts.playerNFT.address}:${mint}`)?.value,
        {group: "1"}
      )
      const limits = adapters.find((adapter) => adapter.domain === "session-subsidy-limits")!.desired(ctx)
      assert.equal(limits.find((record) => record.key === "15")!.value.limit, profile === "beta" ? "500" : "50")
    }
  })
  it("blocks reactivation when a removed OrderBook key retains a different tick", async () => {
    const adapter = gameDataAdapters(loadDeploymentRegistry("sonic-beta")).find(
      (a) => a.domain === "orderbook-token-constraints:bazaar"
    )!
    const abi = loadContractInterface("bazaar")
    const ctx = gameDataContext({call: async () => "0x"}, "target", 1, abi)
    const selected = adapter.desired(ctx)[0]
    const retainedTick = BigInt(selected.value.tick) + 1n
    ctx.call = async (fn, args = []) => {
      if (fn === "getTokenIdDiscoveryState") return [0n, true]
      if (fn === "getImmutableTick") return String(args[0]) === selected.key ? retainedTick : 0n
      if (fn === "getTokenIdInfo") return {tick: 0n, minQuantity: 0n}
      throw new Error(`Unexpected call ${fn}`)
    }
    const snapshot = await adapter.read(ctx)
    const plan = diffGameData({...adapter, desired: () => [selected]}, ctx, "target", "caller", snapshot)
    assert.equal(plan.operations.length, 0)
    assert.match(plan.blockedReasons.join(";"), /tick is immutable/)
  })
  it("pins every page and reads both sides of the 1024-key boundary", async () => {
    const pageABI = new Interface(["function ids(uint256 start,uint256 end) view returns (uint256[])"])
    const ranges: bigint[][] = []
    const pinned = gameDataContext(
      {
        call: async (tx) => {
          assert.equal(tx.blockTag, 987)
          const [start, end] = pageABI.decodeFunctionData("ids", tx.data!.toString())
          ranges.push([start, end])
          return pageABI.encodeFunctionResult("ids", [[end - 1n]])
        },
      },
      "0x0000000000000000000000000000000000000001",
      987,
      pageABI
    )
    assert.deepEqual(await pinned.scan("ids", 1025), ["1023", "1024"])
    assert.deepEqual(ranges, [
      [0n, 1024n],
      [1024n, 1025n],
    ])
  })
})

describe("game-data adapters against compiled contracts", () => {
  let child: ChildProcess
  let provider: JsonRpcProvider
  const deployment = loadDeploymentRegistry("sonic-beta")
  let owner: string
  const mock = "0x0000000000000000000000000000000000009999"
  const initialized = new Set<ContractName>()
  const interfaces = new Map<ContractName, Interface>()
  const knownAddresses = new Map<string, string>()

  async function send(name: ContractName, fn: string, args: unknown[]) {
    const abi = interfaces.get(name) ?? loadContractInterface(name)
    const transaction = {
      from: owner,
      to: deployment.contracts[name].address,
      data: abi.encodeFunctionData(fn, args),
      gas: "0x1c9c380",
    }
    await provider.send("eth_call", [transaction, "latest"])
    const hash = await provider.send("eth_sendTransaction", [transaction])
    const receipt = await waitForAnvilTransaction(provider, hash)
    assert.equal(receipt.status, 1, `${name}.${fn} reverted`)
  }

  function initial(type: ParamType): unknown {
    if (type.name === "owner") return owner
    if (type.name === "comparableSkills") return allBattleSkills
    if (type.name === "maxOrdersPerPrice") return 100
    if (type.name === "devFee") return 1
    if (type.name === "maxActionAmount") return 64
    if (type.name === "maxClanCombatants" || type.name === "maxLockedVaults") return 20
    if (type.name.startsWith("start")) return 1
    if (type.isArray())
      return type.arrayLength < 0 ? [] : Array.from({length: type.arrayLength}, () => initial(type.arrayChildren))
    if (type.isTuple()) return Object.fromEntries(type.components.map((field) => [field.name, initial(field)]))
    if (type.type === "address") return knownAddresses.get(type.name) ?? mock
    if (type.type === "bool") return true
    if (type.type === "string") return ""
    if (type.type.startsWith("bytes")) return "0x"
    return 0
  }

  async function initialize(name: ContractName) {
    if (initialized.has(name)) return
    initialized.add(name)
    const abi = loadContractInterface(name)
    interfaces.set(name, abi)
    const init = abi.getFunction("initialize")
    if (init) await send(name, "initialize", init.inputs.map(initial))
  }

  before(
    async () => {
      const port = await new Promise<number>((resolve, reject) => {
        const server = createServer()
        server.listen(0, "127.0.0.1", () => {
          const address = server.address()
          if (!address || typeof address === "string") return reject(new Error("No test port"))
          server.close(() => resolve(address.port))
        })
      })
      child = spawn(
        "anvil",
        ["--port", String(port), "--disable-code-size-limit", "--gas-limit", "100000000", "--silent"],
        {stdio: "ignore"}
      )
      provider = new JsonRpcProvider(`http://127.0.0.1:${port}`, undefined, {cacheTimeout: -1, batchStallTime: 0})
      for (let i = 0; ; i++) {
        try {
          owner = (await provider.send("eth_accounts", []))[0]
          break
        } catch (error) {
          if (i === 99) throw error
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
      }
      deployment.authority.address = owner
      await provider.send("anvil_setCode", [mock, "0x6001600052600060205260406000f3"])
      // Real compiled runtime with disposable zero storage. Upgrade paths are covered by Forge tests.
      for (const [i, name] of CONTRACT_NAMES.entries()) {
        const artifact = loadArtifactFingerprint(name)
        const address = toBeHex(0x2000 + i, 20)
        deployment.contracts[name].address = address
        knownAddresses.set(name, address)
        await provider.send("anvil_setCode", [address, artifact.runtime])
      }
      for (const [i, name] of [
        "estforLibrary",
        "itemNFTLibrary",
        "petNFTLibrary",
        "playersLibrary",
        "promotionsLibrary",
        "clanBattleLibrary",
        "lockedBankVaultsLibrary",
      ].entries()) {
        await provider.send("anvil_setCode", [
          toBeHex(0x1001 + i, 20),
          loadArtifactFingerprint(name as ContractName).runtime,
        ])
      }
      knownAddresses.set("implMisc", deployment.contracts.playersImplMisc.address)
      knownAddresses.set("implMisc1", deployment.contracts.playersImplMisc1.address)
      // Owner configuration only needs existence/equip-position checks from these dependencies.
      knownAddresses.set("nft", mock)
      knownAddresses.set("playerNFT", mock)
    },
    {timeout: 120000}
  )

  after(() => {
    provider?.destroy()
    child?.kill("SIGTERM")
  })

  it("projects real writes and verifies an empty second plan for each seeded domain", {timeout: 180000}, async () => {
    for (const adapter of gameDataAdapters(deployment)) {
      await initialize(adapter.contract)
      if (adapter.contract === "instantVRFActions") {
        await initialize("genericInstantVRFActionStrategy")
        await initialize("eggInstantVRFActionStrategy")
        await send("instantVRFActions", "addStrategies", [
          [1, 2, 3],
          [
            deployment.contracts.genericInstantVRFActionStrategy.address,
            deployment.contracts.genericInstantVRFActionStrategy.address,
            deployment.contracts.eggInstantVRFActionStrategy.address,
          ],
        ])
      }
      let ctx = gameDataContext(
        provider,
        deployment.contracts[adapter.contract].address,
        Number(await provider.send("eth_blockNumber", [])),
        loadContractInterface(adapter.contract)
      )
      const desired = adapter.desired(ctx)
      // Exercise different IDs and tuple shapes with real writes. Full key-range coverage is a separate read test.
      const selected =
        desired.length < 4
          ? desired
          : [desired[0], desired[Math.floor(desired.length / 2)], desired[desired.length - 1]]
      const narrowed: GameDataAdapter = {...adapter, desired: () => selected}
      if (adapter.contract === "itemNFT") {
        for (let i = 0; i < allItems.length; i += 50) await send("itemNFT", "addItems", [allItems.slice(i, i + 50)])
      } else {
        for (const record of selected)
          for (const operation of adapter.write("add", record.key))
            await send(adapter.contract, operation.fn, operation.args)
      }
      ctx = gameDataContext(
        provider,
        deployment.contracts[adapter.contract].address,
        Number(await provider.send("eth_blockNumber", [])),
        loadContractInterface(adapter.contract)
      )
      const actualScan = ctx.scan
      ctx.scan = async (fn, _end, prefix = []) => {
        const numericKeys = selected.map(({key}) => Number(key.split(":").slice(-1)[0])).filter(Number.isFinite)
        const starts = [...new Set(numericKeys.map((key) => Math.floor(key / 1024) * 1024))]
        if (!starts.length) return actualScan(fn, 65536, prefix)
        const ids: string[] = []
        for (const start of starts) ids.push(...(await ctx.call(fn, [...prefix, start, start + 1024])).map(String))
        return ids
      }
      const snapshot = await narrowed.read(ctx)
      snapshot.records = snapshot.records.filter((record) => selected.some((wanted) => wanted.key === record.key))
      const plan = diffGameData(narrowed, ctx, deployment.contracts[adapter.contract].address, owner, snapshot)
      assert.equal(plan.blockedReasons.length, 0, `${adapter.domain}: ${plan.blockedReasons.join("; ")}`)
      assert.deepEqual(plan.changes.add, [], `${adapter.domain}: missing stored records`)
      assert.deepEqual(
        plan.changes.update,
        [],
        `${adapter.domain}: ${gameDataJSON({desired: plan.desired, actual: snapshot.records})}`
      )
      assert.equal(plan.operations.length, 0, adapter.domain)

      if (
        [
          "xp-threshold-rewards",
          "avatars",
          "daily-rewards",
          "clan-tiers",
          "orderbook-token-constraints:bazaar",
        ].includes(adapter.domain)
      ) {
        for (const operation of adapter.write("remove", selected[0].key, selected[0]))
          await send(adapter.contract, operation.fn, operation.args)
        // Keep the same reader behavior, but move its pinned block after the deletion/deactivation.
        const fresh = gameDataContext(
          provider,
          deployment.contracts[adapter.contract].address,
          Number(await provider.send("eth_blockNumber", [])),
          ctx.abi
        )
        const drift = await narrowed.read(fresh)
        const repair = diffGameData(narrowed, fresh, deployment.contracts[adapter.contract].address, owner, drift)
        assert.equal(repair.blockedReasons.length, 0, adapter.domain)
        assert.ok(repair.operations.length > 0, `${adapter.domain}: no repair generated`)
        for (const operation of repair.operations) {
          const hash = await provider.send("eth_sendTransaction", [{...toRpcTransaction(operation), gas: "0x1c9c380"}])
          assert.equal((await waitForAnvilTransaction(provider, hash)).status, 1, operation.id)
        }
        const repaired = await narrowed.read(
          gameDataContext(
            provider,
            deployment.contracts[adapter.contract].address,
            Number(await provider.send("eth_blockNumber", [])),
            ctx.abi
          )
        )
        assert.equal(
          diffGameData(narrowed, fresh, deployment.contracts[adapter.contract].address, owner, repaired).operations
            .length,
          0,
          adapter.domain
        )
      }
    }
  })
})
