import assert from "node:assert/strict"
import {describe, it} from "node:test"
import {AbiCoder, Interface, JsonRpcProvider, getAddress, getCreateAddress, toBeHex, zeroPadValue} from "ethers"
import {loadImplementationCreationCode} from "./deploymentArtifacts"
import {loadDeploymentRegistry} from "./deploymentRegistry"
import {buildUpgradePlan} from "./upgradeReconciliation"

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
  const buildReinitializerPlan = (initializedVersion: number) => {
    const withReinitializer = structuredClone(deployment)
    withReinitializer.contracts.shop.reinitializer = {version: 3, callData: "0x12345678"}
    const reinitializerProvider = {
      ...provider,
      getStorage: async () => zeroPadValue(toBeHex(initializedVersion), 32),
    } as unknown as JsonRpcProvider
    return buildUpgradePlan(reinitializerProvider, withReinitializer, 1, [shop], {
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

  it("plans changed libraries before implementations that link them", async function () {
    const desiredLibrary = getAddress(getCreateAddress({from: deployer, nonce: 7}))
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
      ],
      {deployerAddress: deployer, validate: validation}
    )

    assert.deepEqual(plan.blockedReasons, [])
    assert.deepEqual(
      plan.candidates.map(({contractName, nonce}) => [contractName, nonce]),
      [
        ["playersLibrary", 7],
        ["playersImplRewards", 8],
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

  it("blocks an upgrade when the proxy reinitializer version is ahead of the registry", async function () {
    const plan = await buildReinitializerPlan(4)
    assert.equal(plan.candidates.length, 0)
    assert.equal(plan.operations.length, 0)
    assert.match(plan.blockedReasons[0], /initialized version 4 exceeds tracked reinitializer version 3/)
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
})
