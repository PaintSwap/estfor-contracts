import assert from "node:assert/strict"
import {ChildProcess, spawn} from "child_process"
import {readFileSync} from "fs"
import {createServer} from "net"
import {after, before, describe, it} from "node:test"
import {Contract, ContractFactory, Interface, JsonRpcProvider} from "ethers"
import {getShopData} from "./data/shop"
import {DeploymentRegistry, loadDeploymentRegistry} from "./deploymentRegistry"
import {SHOP_RECONCILIATION_ABI, buildShopPlan, diffShop} from "./shopReconciliation"
import {simulateShopPlan} from "./shopSimulation"

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") return reject(new Error("port"))
      server.close((error) => (error ? reject(error) : resolve(address.port)))
    })
  })
}

async function waitForRpc(provider: JsonRpcProvider): Promise<void> {
  for (let i = 0; i < 100; i++) {
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

  it("classifies missing, changed, stale, and unchanged records exactly", async function () {
    const desired = getShopData("live")
    const staleId = Array.from({length: 65_536}, (_, id) => id).find(
      (id) => !desired.buyableItems.some(({tokenId}) => tokenId === id) && !desired.unsellableItemIds.includes(id)
    )!
    const initial = desired.buyableItems.slice(1).map((item, index) => ({
      tokenId: item.tokenId,
      price: index === 0 ? item.price + 1n : item.price,
    }))
    initial.push({tokenId: staleId, price: 1n})
    await (await fixture.addBuyableItems(initial)).wait()
    await (await fixture.addUnsellableItems(desired.unsellableItemIds)).wait()

    const block = await currentBlock(provider)
    const plan = await buildShopPlan(provider, deployment, block, {
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

    const blockHash = (await provider.getBlock(block))!.hash
    const simulation = await simulateShopPlan(provider, rpcUrl, 31337, block, blockHash!, plan)
    assert.equal(simulation.status, "passed")
    assert.equal(simulation.postconditionsVerified, plan.desired.length)

    const first = plan.operations[0]
    const hash = await provider.send("eth_sendTransaction", [{from: first.caller, to: first.target, data: first.data}])
    await provider.waitForTransaction(hash)
    const remainder = await buildShopPlan(provider, deployment, await currentBlock(provider), {
      allowRemovals: true,
      maxAggregatePriceChange: 100_000n * 10n ** 18n,
    })
    assert.ok(remainder.operations.length < plan.operations.length)
    assert.ok(!remainder.operations.some(({id}) => id === first.id))

    for (const operation of remainder.operations) {
      const txHash = await provider.send("eth_sendTransaction", [
        {from: operation.caller, to: operation.target, data: operation.data},
      ])
      await provider.waitForTransaction(txHash)
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
