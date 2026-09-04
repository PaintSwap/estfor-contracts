import assert from "node:assert/strict"
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from "fs"
import {tmpdir} from "os"
import {join} from "path"
import {describe, it} from "node:test"
import {AbiCoder, Interface, JsonRpcProvider, Wallet, getAddress, getCreateAddress} from "ethers"
import {loadArtifactFingerprint, loadImplementationCreationCode, prepareCandidateArtifacts} from "./deploymentArtifacts"
import {loadDeploymentRegistry} from "./deploymentRegistry"
import {buildUpgradePlan, deployUpgradeCandidates, readCandidateJournal} from "./upgradeReconciliation"

describe("implementation upgrade reconciliation", function () {
  const deployment = loadDeploymentRegistry("sonic-live")
  const deployer = "0x1111111111111111111111111111111111111111"
  const shop = {
    name: "shop" as const,
    kind: "uups" as const,
    address: deployment.contracts.shop.address,
    implementationAddress: "0x2222222222222222222222222222222222222222",
    classification: "executable-drift" as const,
  }
  const provider = {
    getTransactionCount: async () => 7,
    getCode: async () => "0x",
  } as unknown as JsonRpcProvider
  const validation = () => ({status: "passed" as const, outputHash: "0xvalidation", output: "validated"})
  const buildReinitializerPlan = (onchainVersion: number) => {
    const withReinitializer = structuredClone(deployment)
    withReinitializer.contracts.shop.reinitializer = {onchainVersion, targetVersion: 3, callData: "0x12345678"}
    return buildUpgradePlan(provider, withReinitializer, 1, [shop], {
      deployerAddress: deployer,
      validate: validation,
    })
  }

  it("builds deterministic candidate creation and Safe upgrade operations", async function () {
    const plan = await buildUpgradePlan(provider, deployment, 1, [shop], {
      deployerAddress: deployer,
      validate: validation,
    })
    assert.deepEqual(plan.blockedReasons, [])
    assert.equal(plan.candidates.length, 1)
    assert.equal(plan.candidates[0].candidateAddress, getAddress(getCreateAddress({from: deployer, nonce: 7})))
    assert.equal(plan.candidates[0].nonce, 7)
    assert.equal(plan.operations.length, 1)
    assert.equal(plan.operations[0].caller, getAddress(deployment.authority.address))
    assert.equal(plan.operations[0].target, getAddress(deployment.contracts.shop.address))
    assert.match(plan.operations[0].data, /^0x4f1ef286/)
    assert.equal(plan.operations[0].postcondition.expected, plan.candidates[0].candidateAddress)
  })

  it("fails closed without a proposer key-derived address and for unknown bytecode", async function () {
    const noDeployer = await buildUpgradePlan(provider, deployment, 1, [shop], {validate: validation})
    assert.match(noDeployer.blockedReasons[0], /PROPOSER_PRIVATE_KEY/)
    assert.equal(noDeployer.operations.length, 0)

    const unknown = await buildUpgradePlan(provider, deployment, 1, [{...shop, classification: "unknown"}], {
      deployerAddress: deployer,
      validate: validation,
    })
    assert.match(unknown.blockedReasons[0], /comparison is unknown/)
    assert.equal(unknown.operations.length, 0)
  })

  it("links creation code from the same registry used by runtime comparison", function () {
    const creation = loadImplementationCreationCode("playersImplRewards", deployment)
    assert.ok(creation.codeSize > 0)
    assert.ok(creation.libraryDependencies.includes("playersLibrary"))
    assert.ok(creation.code.toLowerCase().includes(deployment.contracts.playersLibrary.address.slice(2).toLowerCase()))
    assert.ok(!creation.code.includes("__$"))
  })

  it("allocates contiguous nonces across libraries, Players implementations, and proxy upgrades", async function () {
    const plan = await buildUpgradePlan(
      provider,
      deployment,
      1,
      [
        {
          name: "playersLibrary",
          kind: "library",
          address: deployment.contracts.playersLibrary.address,
          implementationAddress: deployment.contracts.playersLibrary.address,
          classification: "executable-drift",
        },
        {
          name: "playersImplRewards",
          kind: "uups",
          address: deployment.contracts.players.address,
          implementationAddress: deployment.contracts.playersImplRewards.address,
          classification: "library-drift",
        },
        shop,
      ],
      {deployerAddress: deployer, validate: validation}
    )

    assert.deepEqual(plan.blockedReasons, [])
    assert.deepEqual(
      plan.candidates.map(({contractName, nonce}) => [contractName, nonce]),
      [
        ["playersLibrary", 7],
        ["playersImplRewards", 8],
        ["shop", 9],
      ]
    )
    assert.equal(plan.candidates[0].validation.status, "not-applicable")
    assert.ok(
      plan.candidates[1].creationCodeHash !== loadImplementationCreationCode("playersImplRewards", deployment).codeHash
    )
    assert.equal(plan.operations[0].postcondition.expected, plan.candidates[1].candidateAddress)
  })

  it("automatically assigns distinct candidate addresses to changed libraries", async function () {
    const plan = await buildUpgradePlan(
      provider,
      deployment,
      1,
      [
        {
          name: "estforLibrary",
          kind: "library",
          address: deployment.contracts.estforLibrary.address,
          implementationAddress: deployment.contracts.estforLibrary.address,
          classification: "executable-drift",
        },
        {
          name: "playersLibrary",
          kind: "library",
          address: deployment.contracts.playersLibrary.address,
          implementationAddress: deployment.contracts.playersLibrary.address,
          classification: "executable-drift",
        },
      ],
      {deployerAddress: deployer, validate: validation}
    )

    assert.deepEqual(plan.blockedReasons, [])
    assert.deepEqual(
      plan.candidates.map(({contractName, candidateAddress, nonce}) => [contractName, candidateAddress, nonce]),
      [
        ["estforLibrary", getAddress(getCreateAddress({from: deployer, nonce: 7})), 7],
        ["playersLibrary", getAddress(getCreateAddress({from: deployer, nonce: 8})), 8],
      ]
    )
  })

  it("deploys changed Players delegates and reconciles all five addresses atomically", async function () {
    const delegateNames = [
      "playersImplQueueActions",
      "playersImplProcessActions",
      "playersImplRewards",
      "playersImplMisc",
      "playersImplMisc1",
    ] as const
    const inputs = delegateNames.map((name) => ({
      name,
      kind: "implementation" as const,
      address: deployment.contracts[name].address,
      implementationAddress: deployment.contracts[name].address,
      classification: name === "playersImplMisc1" ? ("executable-drift" as const) : ("exact-match" as const),
    }))

    const plan = await buildUpgradePlan(provider, deployment, 1, inputs, {deployerAddress: deployer})

    const candidateAddress = getAddress(getCreateAddress({from: deployer, nonce: 7}))
    assert.deepEqual(plan.blockedReasons, [])
    assert.equal(plan.candidates.length, 1)
    assert.equal(plan.candidates[0].kind, "implementation")
    assert.equal(plan.candidates[0].candidateAddress, candidateAddress)
    assert.equal(plan.operations.length, 1)
    assert.equal(plan.operations[0].target, getAddress(deployment.contracts.players.address))
    const call = new Interface(["function setImpls(address,address,address,address,address)"]).decodeFunctionData(
      "setImpls",
      plan.operations[0].data
    )
    assert.deepEqual(
      [...call],
      [...delegateNames.slice(0, 4).map((name) => getAddress(deployment.contracts[name].address)), candidateAddress]
    )
  })

  it("includes declared reinitializer calldata when the proxy has not run that version", async function () {
    const plan = await buildReinitializerPlan(2)
    const call = new Interface(["function upgradeToAndCall(address,bytes)"]).decodeFunctionData(
      "upgradeToAndCall",
      plan.operations[0].data
    )
    assert.equal(call[1], "0x12345678")
  })

  it("does not repeat declared reinitializer calldata when the proxy is already at that version", async function () {
    const plan = await buildReinitializerPlan(3)
    const call = new Interface(["function upgradeToAndCall(address,bytes)"]).decodeFunctionData(
      "upgradeToAndCall",
      plan.operations[0].data
    )
    assert.equal(call[1], "0x")
  })

  it("does not block or repeat calldata when the on-chain version is ahead of the target", async function () {
    const plan = await buildReinitializerPlan(4)
    const call = new Interface(["function upgradeToAndCall(address,bytes)"]).decodeFunctionData(
      "upgradeToAndCall",
      plan.operations[0].data
    )
    assert.deepEqual(plan.blockedReasons, [])
    assert.equal(call[1], "0x")
  })

  it("derives implementation constructor data from readable chain state", async function () {
    const endpoint = "0x2222222222222222222222222222222222222222"
    const endpointInterface = new Interface(["function endpoint() view returns (address)"])
    const bridgeProvider = {
      getTransactionCount: async () => 7,
      getCode: async () => "0x",
      call: async () => endpointInterface.encodeFunctionResult("endpoint", [endpoint]),
    } as unknown as JsonRpcProvider
    const bridge = {
      name: "bridge" as const,
      kind: "uups" as const,
      address: deployment.contracts.bridge.address,
      implementationAddress: "0x3333333333333333333333333333333333333333",
      classification: "executable-drift" as const,
    }

    const plan = await buildUpgradePlan(bridgeProvider, deployment, 1, [bridge], {
      deployerAddress: deployer,
      validate: validation,
    })

    assert.deepEqual(plan.blockedReasons, [])
    assert.equal(
      getAddress(AbiCoder.defaultAbiCoder().decode(["address"], plan.candidates[0].constructorData)[0]),
      getAddress(endpoint)
    )
  })

  it("recovers and verifies an interrupted candidate deployment before confirming it", async function () {
    const directory = mkdtempSync(join(tmpdir(), "candidate-recovery-"))
    const wallet = new Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
    const nonce = 7
    const libraryDrift = {
      name: "itemNFTLibrary" as const,
      kind: "library" as const,
      address: deployment.contracts.itemNFTLibrary.address,
      implementationAddress: deployment.contracts.itemNFTLibrary.address,
      classification: "executable-drift" as const,
    }
    const originalPlan = await buildUpgradePlan(
      {getTransactionCount: async () => nonce, getCode: async () => "0x"} as unknown as JsonRpcProvider,
      deployment,
      99,
      [libraryDrift],
      {deployerAddress: wallet.address}
    )
    assert.deepEqual(originalPlan.blockedReasons, [])
    const candidate = originalPlan.candidates[0]
    const candidateAddress = candidate.candidateAddress
    const candidateDeployment = structuredClone(deployment)
    candidateDeployment.contracts.itemNFTLibrary.nextAddress = candidateAddress
    const artifacts = prepareCandidateArtifacts(["itemNFTLibrary"], candidateDeployment)
    const creation = artifacts.loadCreationCode("itemNFTLibrary")
    assert.equal(creation.codeHash, candidate.creationCodeHash)
    const transactionHash = `0x${"ab".repeat(32)}`
    const transaction = {hash: transactionHash, from: wallet.address, nonce, data: creation.code}
    const receipt = {
      blockNumber: 100,
      blockHash: `0x${"cd".repeat(32)}`,
      status: 1,
      gasUsed: 123n,
      contractAddress: candidateAddress,
    }
    let returnedTransaction: typeof transaction | null = transaction
    let returnedReceipt: typeof receipt | null = receipt
    let historicalNonceReads = 0
    const journalPath = join(directory, "candidate-itemNFTLibrary.json")
    const interruptedJournal = {
      schemaVersion: 2,
      deploymentId: deployment.deploymentId,
      planHash: "0xplan",
      contractName: candidate.contractName,
      deployer: wallet.address,
      nonce,
      candidateAddress,
      creationCodeHash: creation.codeHash,
      status: "prepared",
      broadcastStartBlock: 99,
      transactionHash: null,
      receipt: null,
    }
    const candidateArtifact = loadArtifactFingerprint("itemNFTLibrary")
    let candidateRuntime = candidateArtifact.runtime
    for (const {start, length} of candidateArtifact.selfAddressReferences) {
      assert.equal(length, 20)
      const offset = 2 + start * 2
      candidateRuntime = `${candidateRuntime.slice(0, offset)}${candidateAddress.slice(2)}${candidateRuntime.slice(
        offset + length * 2
      )}`
    }
    const recoveryProvider = {
      async getCode() {
        return candidateRuntime
      },
      async getBlockNumber() {
        return 10_000
      },
      async getTransactionCount(_address: string, blockTag: number | string) {
        if (typeof blockTag !== "number") throw new Error(`Unexpected nonce block tag ${blockTag}`)
        historicalNonceReads++
        return blockTag >= 100 ? nonce + 1 : nonce
      },
      async getBlock(blockNumber: number) {
        return {prefetchedTransactions: blockNumber === 100 ? [transaction] : []}
      },
      async getTransaction() {
        return returnedTransaction
      },
      async getTransactionReceipt() {
        return returnedReceipt
      },
    } as unknown as JsonRpcProvider

    try {
      const remainderPlan = await buildUpgradePlan(recoveryProvider, deployment, 100, [libraryDrift], {
        deployerAddress: wallet.address,
        reusableCandidates: {
          itemNFTLibrary: {candidateAddress: candidate.candidateAddress, nonce: candidate.nonce},
        },
      })
      assert.deepEqual(remainderPlan.blockedReasons, [])
      assert.equal(remainderPlan.candidates[0].status, "reused")
      assert.equal(remainderPlan.candidates[0].nonce, nonce)

      writeFileSync(journalPath, JSON.stringify(interruptedJournal))
      await deployUpgradeCandidates(
        recoveryProvider,
        "unused",
        wallet,
        deployment,
        "0xremainder",
        remainderPlan.candidates,
        directory
      )
      const recovered = readCandidateJournal(journalPath)
      assert.equal(recovered.status, "confirmed")
      assert.equal(recovered.transactionHash, transactionHash)
      assert.equal(recovered.receipt?.blockNumber, 100)
      assert.ok(historicalNonceReads < 20)

      returnedTransaction = {...transaction, data: "0x00"}
      await assert.rejects(
        deployUpgradeCandidates(recoveryProvider, "unused", wallet, deployment, "0xplan", [candidate], directory),
        /does not match the reviewed creation intent/
      )
      returnedTransaction = transaction
      returnedReceipt = null
      await assert.rejects(
        deployUpgradeCandidates(recoveryProvider, "unused", wallet, deployment, "0xplan", [candidate], directory),
        /receipt is unavailable/
      )
      returnedReceipt = receipt

      returnedReceipt = {...receipt, status: 0}
      await assert.rejects(
        deployUpgradeCandidates(recoveryProvider, "unused", wallet, deployment, "0xplan", [candidate], directory),
        /deployment failed/
      )
      returnedReceipt = receipt

      writeFileSync(
        journalPath,
        JSON.stringify({...interruptedJournal, schemaVersion: 1, status: "confirmed", broadcastStartBlock: undefined})
      )
      await assert.rejects(
        deployUpgradeCandidates(recoveryProvider, "unused", wallet, deployment, "0xplan", [candidate], directory),
        /deployment transaction cannot be recovered/
      )
      assert.equal(JSON.parse(readFileSync(journalPath, "utf8")).transactionHash, null)
    } finally {
      rmSync(directory, {recursive: true})
    }
  })
})
