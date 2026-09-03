import assert from "node:assert/strict"
import {describe, it} from "node:test"
import {Interface, getAddress} from "ethers"
import {
  CONTRACT_NAMES,
  EXTERNAL_NAMES,
  getContractAddress,
  getDeploymentIsBeta,
  getSelectedDeploymentId,
  loadDeploymentRegistry,
  validateDeploymentRegistry,
} from "./deploymentRegistry"

describe("DeploymentRegistry", function () {
  it("loads both Sonic deployments by explicit ID", function () {
    const live = loadDeploymentRegistry("sonic-live")
    const beta = loadDeploymentRegistry("sonic-beta")

    assert.equal(live.chainId, 146)
    assert.equal(live.profile, "live")
    assert.equal(getContractAddress(live, "shop"), "0x80b78e431b6e52027debe297cd8ba614820a2f1b")
    assert.equal(beta.chainId, 146)
    assert.equal(beta.profile, "beta")
    assert.equal(getContractAddress(beta, "shop"), "0xb3778f2c24d94e3c7cfe608388bd35bba9401caa")
    assert.equal(getDeploymentIsBeta({DEPLOYMENT_ID: "sonic-live"}), false)
    assert.equal(getDeploymentIsBeta({DEPLOYMENT_ID: "sonic-beta"}), true)
  })

  it("contains every compatibility contract and external address", function () {
    for (const deploymentId of ["sonic-live", "sonic-beta"]) {
      const deployment = loadDeploymentRegistry(deploymentId)
      assert.deepEqual(Object.keys(deployment.contracts).sort(), [...CONTRACT_NAMES].sort())
      assert.deepEqual(Object.keys(deployment.externals).sort(), [...EXTERNAL_NAMES].sort())
      assert.deepEqual(deployment.authority, {
        type: "safe",
        address: "0xC7073F6317813C3EDB09FA2d19A6cA259A9d4aD9",
      })
    }
  })

  it("records each deployed reinitializer version with its calldata", function () {
    const reinitializerInterface = new Interface([
      "function initializeV2(address)",
      "function initializeV3(address)",
      "function initializeV4()",
    ])
    const versions = {
      randomnessBeacon: 3,
      clans: 2,
      instantVRFActions: 3,
      pvpBattleground: 3,
      raids: 3,
      lockedBankVaults: 3,
      territories: 3,
      combatantsHelper: 4,
    } as const
    for (const deploymentId of ["sonic-live", "sonic-beta"]) {
      const deployment = loadDeploymentRegistry(deploymentId)
      for (const [name, version] of Object.entries(versions)) {
        const contract = deployment.contracts[name as keyof typeof versions]
        assert.equal(contract.reinitializer?.version, version)
        assert.notEqual(contract.reinitializer?.callData, "0x")
      }
      assert.equal(
        getAddress(
          reinitializerInterface.decodeFunctionData(
            "initializeV2",
            deployment.contracts.clans.reinitializer!.callData
          )[0]
        ),
        getAddress(deployment.contracts.combatantsHelper.address)
      )
      for (const name of [
        "randomnessBeacon",
        "instantVRFActions",
        "pvpBattleground",
        "raids",
        "lockedBankVaults",
        "territories",
      ] as const) {
        assert.equal(
          getAddress(
            reinitializerInterface.decodeFunctionData(
              "initializeV3",
              deployment.contracts[name].reinitializer!.callData
            )[0]
          ),
          getAddress(deployment.externals.vrf)
        )
      }
      reinitializerInterface.decodeFunctionData(
        "initializeV4",
        deployment.contracts.combatantsHelper.reinitializer!.callData
      )
    }
  })

  it("requires an explicit deployment ID", function () {
    assert.throws(() => getSelectedDeploymentId({}), /DEPLOYMENT_ID is required/)
    assert.equal(getSelectedDeploymentId({DEPLOYMENT_ID: "sonic-live"}), "sonic-live")
  })

  it("rejects unknown deployments and path traversal", function () {
    assert.throws(() => loadDeploymentRegistry("unknown"), /Unknown deployment "unknown"/)
    assert.throws(() => loadDeploymentRegistry("../sonic-live"), /Invalid deployment ID "..\/sonic-live"/)
  })

  it("rejects non-Safe authority and incomplete contract registries", function () {
    const live = loadDeploymentRegistry("sonic-live")
    const oldSchema = structuredClone(live) as unknown as Record<string, unknown>
    oldSchema.schemaVersion = 1
    assert.throws(() => validateDeploymentRegistry(oldSchema), /schemaVersion must be 2/)

    const nonSafe = structuredClone(live) as unknown as Record<string, unknown>
    ;(nonSafe.authority as Record<string, unknown>).type = "eoa"
    assert.throws(() => validateDeploymentRegistry(nonSafe), /authority.type must be "safe"/)

    const incomplete = structuredClone(live) as unknown as Record<string, unknown>
    delete (incomplete.contracts as Record<string, unknown>).shop
    assert.throws(() => validateDeploymentRegistry(incomplete), /contracts.shop must be an object/)
  })

  it("validates upgrade transition fields", function () {
    const live = loadDeploymentRegistry("sonic-live")
    const libraryTransition = structuredClone(live)
    libraryTransition.contracts.estforLibrary.nextAddress = "0x1111111111111111111111111111111111111111"
    assert.equal(
      validateDeploymentRegistry(libraryTransition).contracts.estforLibrary.nextAddress,
      "0x1111111111111111111111111111111111111111"
    )

    const proxyTransition = structuredClone(live)
    proxyTransition.contracts.shop.nextAddress = "0x1111111111111111111111111111111111111111"
    assert.throws(() => validateDeploymentRegistry(proxyTransition), /nextAddress is only supported for libraries/)

    const reinitializer = structuredClone(live)
    reinitializer.contracts.shop.reinitializer = {version: 1, callData: "0x1234"}
    assert.equal(validateDeploymentRegistry(reinitializer).contracts.shop.reinitializer?.version, 1)

    const invalidCalldata = structuredClone(live)
    invalidCalldata.contracts.shop.reinitializer = {version: 3, callData: "initialize()"}
    assert.throws(() => validateDeploymentRegistry(invalidCalldata), /callData must be non-empty hex calldata/)

    const zeroVersion = structuredClone(live)
    zeroVersion.contracts.shop.reinitializer = {version: 0, callData: "0x1234"}
    assert.throws(() => validateDeploymentRegistry(zeroVersion), /version must be greater than zero/)

    const beaconCalldata = structuredClone(live)
    beaconCalldata.contracts.bank.reinitializer = {version: 2, callData: "0x1234"}
    assert.throws(() => validateDeploymentRegistry(beaconCalldata), /only supported for UUPS contracts/)
  })
})
