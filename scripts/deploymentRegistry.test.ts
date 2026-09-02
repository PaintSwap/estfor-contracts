import assert from "node:assert/strict"
import {describe, it} from "node:test"
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
    const nonSafe = structuredClone(live) as unknown as Record<string, unknown>
    ;(nonSafe.authority as Record<string, unknown>).type = "eoa"
    assert.throws(() => validateDeploymentRegistry(nonSafe), /authority.type must be "safe"/)

    const incomplete = structuredClone(live) as unknown as Record<string, unknown>
    delete (incomplete.contracts as Record<string, unknown>).shop
    assert.throws(() => validateDeploymentRegistry(incomplete), /contracts.shop must be an object/)
  })
})
