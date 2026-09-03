import assert from "node:assert/strict"
import {ChildProcess, spawn} from "child_process"
import {readFileSync} from "fs"
import {createServer} from "net"
import {after, before, describe, it} from "node:test"
import {Contract, ContractFactory, Interface, JsonRpcProvider, toBeHex} from "ethers"
import {getShopData} from "./data/shop"
import type {DeploymentRegistry} from "./deploymentRegistry"
import {loadDeploymentRegistry} from "./deploymentRegistry"
import {toRpcTransaction} from "./reconciliation"
import type {ShopRecord} from "./shopReconciliation"
import {
  SHOP_RECONCILIATION_ABI,
  buildShopPlan,
  deferShopPlanForUpgrade,
  diffShop,
  hasShopStateGetter,
  verifyShopPostconditions,
} from "./shopReconciliation"

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") return reject(new Error("Could not allocate Anvil port"))
      server.close((error) => (error ? reject(error) : resolve(address.port)))
    })
  })
}

async function waitForRpc(provider: JsonRpcProvider): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await provider.getBlockNumber()
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }
  throw new Error("Anvil did not start")
}

async function currentBlock(provider: JsonRpcProvider): Promise<number> {
  return Number(await provider.send("eth_blockNumber", []))
}

describe("Shop reconciliation", function () {
  let child: ChildProcess
  let provider: JsonRpcProvider
  let rpcUrl: string
  let fixture: Contract
  let deployment: DeploymentRegistry

  before(async function () {
    const port = await freePort()
    rpcUrl = `http://127.0.0.1:${port}`
    child = spawn("anvil", ["--port", String(port), "--silent"])
    provider = new JsonRpcProvider(rpcUrl, 31337, {staticNetwork: true})
    await waitForRpc(provider)
    const signer = await provider.getSigner(0)
    const artifact = JSON.parse(
      readFileSync("out/ShopReconciliationFixture.sol/ShopReconciliationFixture.json", "utf8")
    ) as {abi: object[]; bytecode: {object: string}}
    fixture = (await new ContractFactory(artifact.abi, artifact.bytecode.object, signer).deploy(
      await signer.getAddress()
    )) as unknown as Contract
    await fixture.waitForDeployment()
    const receipt = await fixture.deploymentTransaction()!.wait()
    const base = loadDeploymentRegistry("sonic-live")
    deployment = {
      ...base,
      chainId: 31337,
      deploymentBlock: receipt!.blockNumber,
      authority: {...base.authority, address: await signer.getAddress()},
      contracts: {...base.contracts, shop: {...base.contracts.shop, address: await fixture.getAddress()}},
    }
  })

  after(function () {
    provider.destroy()
    child.kill("SIGTERM")
  })

  it("keeps the reconciliation ABI aligned with the Shop artifact", function () {
    const artifact = JSON.parse(readFileSync("out/Shop.sol/Shop.json", "utf8")) as {abi: object[]}
    const actual = new Interface(artifact.abi)
    const expected = new Interface(SHOP_RECONCILIATION_ABI)
    for (const name of [
      "getShopItemStates",
      "addBuyableItems",
      "editItems",
      "removeItems",
      "addUnsellableItems",
      "removeUnsellableItems",
    ]) {
      assert.equal(actual.getFunction(name)!.selector, expected.getFunction(name)!.selector, name)
    }
  })

  it("detects getter support from deployed implementation code", function () {
    assert.equal(hasShopStateGetter("0x6000f53eceb26000"), true)
    assert.equal(hasShopStateGetter("0x6000123456786000"), false)
  })

  it("does not read postconditions while Shop reconciliation is deferred for its getter upgrade", async function () {
    let rpcCalls = 0
    const unexpectedProvider = {
      async send() {
        rpcCalls++
        throw new Error("deferred Shop verification made an RPC request")
      },
      async call() {
        rpcCalls++
        throw new Error("deferred Shop verification made an RPC request")
      },
    } as unknown as JsonRpcProvider

    await verifyShopPostconditions(unexpectedProvider, deferShopPlanForUpgrade(deployment))
    assert.equal(rpcCalls, 0)
  })

  it("classifies missing, changed, stale, and unchanged records exactly", function () {
    const desired = getShopData("live")
    const prices = new Map(desired.buyableItems.map(({tokenId, price}) => [tokenId, price]))
    const unsellable = new Set(desired.unsellableItemIds)
    const desiredRecords: ShopRecord[] = [...new Set([...prices.keys(), ...unsellable])]
      .sort((a, b) => a - b)
      .map((tokenId) => ({
        tokenId,
        price: (prices.get(tokenId) ?? 0n).toString(),
        unsellable: unsellable.has(tokenId),
      }))
    const staleId = Array.from({length: 65_536}, (_, id) => id).find(
      (id) => !desired.buyableItems.some(({tokenId}) => tokenId === id) && !desired.unsellableItemIds.includes(id)
    )!
    const missingId = desired.buyableItems[0].tokenId
    const changedId = desired.buyableItems[1].tokenId
    const current = desiredRecords
      .filter(({tokenId}) => tokenId !== missingId)
      .map((record) =>
        record.tokenId === changedId ? {...record, price: (BigInt(record.price) + 1n).toString()} : record
      )
    current.push({tokenId: staleId, price: "1", unsellable: false})

    const plan = diffShop(deployment, current, {
      allowRemovals: true,
      maxRemovals: 10,
      maxAggregatePriceChange: 100_000n * 10n ** 18n,
    })
    assert.deepEqual(
      plan.changes.buyableItems.add.map(({tokenId}) => tokenId),
      [desired.buyableItems[0].tokenId]
    )
    assert.deepEqual(
      plan.changes.buyableItems.update.map(({tokenId}) => tokenId),
      [desired.buyableItems[1].tokenId]
    )
    assert.deepEqual(
      plan.changes.buyableItems.remove.map(({tokenId}) => tokenId),
      [staleId]
    )
    assert.equal(plan.changes.buyableItems.noOp.length, desired.buyableItems.length - 2)
    assert.deepEqual(plan.changes.unsellableItems, {
      add: [],
      remove: [],
      noOp: [...desired.unsellableItemIds].sort((a, b) => a - b),
    })
    const empty = diffShop(deployment, desiredRecords)
    assert.equal(empty.operations.length, 0)
    assert.equal(empty.blockedReasons.length, 0)
  })

  it("simulates on a pinned fork and reaches an empty second plan", async function () {
    const block = await currentBlock(provider)
    const plan = await buildShopPlan(provider, deployment, block)
    const forkPort = await freePort()
    const forkChild = spawn("anvil", [
      "--fork-url",
      rpcUrl,
      "--fork-block-number",
      String(block),
      "--chain-id",
      "31337",
      "--port",
      String(forkPort),
      "--silent",
    ])
    const forkProvider = new JsonRpcProvider(`http://127.0.0.1:${forkPort}`, 31337, {staticNetwork: true})
    try {
      await waitForRpc(forkProvider)
      await forkProvider.send("anvil_impersonateAccount", [plan.operations[0].caller])
      await forkProvider.send("anvil_setBalance", [plan.operations[0].caller, toBeHex(10n ** 20n)])
      for (const operation of plan.operations) {
        const transaction = toRpcTransaction(operation)
        await forkProvider.call(transaction)
        const transactionHash = await forkProvider.send("eth_sendTransaction", [transaction])
        await forkProvider.waitForTransaction(transactionHash)
      }
      await verifyShopPostconditions(forkProvider, plan)
    } finally {
      forkProvider.destroy()
      forkChild.kill("SIGTERM")
    }

    const first = plan.operations[0]
    const firstTransactionHash = await provider.send("eth_sendTransaction", [toRpcTransaction(first)])
    await provider.waitForTransaction(firstTransactionHash)
    const remainder = await buildShopPlan(provider, deployment, await currentBlock(provider))
    assert.ok(remainder.operations.length < plan.operations.length)
    assert.ok(!remainder.operations.some(({id}) => id === first.id))
    for (const operation of remainder.operations) {
      const transactionHash = await provider.send("eth_sendTransaction", [toRpcTransaction(operation)])
      await provider.waitForTransaction(transactionHash)
    }
    const empty = await buildShopPlan(provider, deployment, await currentBlock(provider))
    assert.equal(empty.operations.length, 0)
    assert.equal(empty.blockedReasons.length, 0)
  })

  it("blocks excessive removal volume", function () {
    const desiredIds = new Set(getShopData("live").buyableItems.map(({tokenId}) => tokenId))
    const stale = Array.from({length: 65_536}, (_, tokenId) => tokenId)
      .filter((tokenId) => !desiredIds.has(tokenId))
      .slice(0, 11)
      .map((tokenId) => ({tokenId, price: "1", unsellable: false}))
    const plan = diffShop(deployment, stale, {allowRemovals: true, maxRemovals: 10})
    assert.ok(plan.blockedReasons.includes("Shop removal count 11 exceeds cap 10"))
  })
})
