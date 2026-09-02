import assert from "node:assert/strict"
import {describe, it} from "node:test"
import {Interface, JsonRpcProvider, getAddress, getCreateAddress} from "ethers"
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
    const withLibraryUpgrade = structuredClone(deployment)
    withLibraryUpgrade.contracts.playersLibrary.nextAddress = desiredLibrary
    const plan = await buildUpgradePlan(
      provider,
      withLibraryUpgrade,
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
      loadImplementationCreationCode("playersImplRewards", withLibraryUpgrade).code.includes(
        desiredLibrary.slice(2).toLowerCase()
      )
    )
    assert.equal(plan.operations[0].postcondition.expected, plan.candidates[1].candidateAddress)
  })

  it("includes declared reinitializer calldata in the reviewed Safe operation", async function () {
    const withReinitializer = structuredClone(deployment)
    withReinitializer.contracts.shop.upgradeCallData = "0x12345678"
    const plan = await buildUpgradePlan(provider, withReinitializer, 1, [shop], {
      deployerAddress: deployer,
      validate: validation,
    })
    const call = new Interface(["function upgradeToAndCall(address,bytes)"]).decodeFunctionData(
      "upgradeToAndCall",
      plan.operations[0].data
    )
    assert.equal(call[1], "0x12345678")
  })
})
