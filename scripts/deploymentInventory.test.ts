import assert from "node:assert/strict"
import {describe, it} from "node:test"
import {ArtifactFingerprint, compareRuntimeBytecode} from "./deploymentArtifacts"
import {CONTRACT_NAMES, loadDeploymentRegistry} from "./deploymentRegistry"
import type {DeploymentPlan} from "./deploymentInventory"
import {buildRemainderPlan, hashPlan} from "./deploymentInventory"

function artifact(runtime: string, overrides: Partial<ArtifactFingerprint> = {}): ArtifactFingerprint {
  return {
    fullyQualifiedName: "contracts/Test.sol:Test",
    artifactHash: "0xartifact",
    buildInfoHash: "0xbuild",
    compilerVersion: "0.8.28",
    optimizer: {enabled: true, runs: 9_999_999},
    evmVersion: "cancun",
    viaIR: false,
    runtimeHash: "0xruntime",
    runtimeSize: (runtime.length - 2) / 2,
    linkReferences: [],
    immutableReferences: [],
    metadataStart: null,
    runtime,
    ...overrides,
  }
}

describe("deployment inventory", function () {
  const deployment = loadDeploymentRegistry("sonic-live")
  const implementation = "0x1111111111111111111111111111111111111111"

  it("loads one current Foundry artifact for every tracked logical contract", function () {
    const {loadArtifactFingerprint} = require("./deploymentArtifacts") as typeof import("./deploymentArtifacts")
    for (const name of CONTRACT_NAMES) {
      const fingerprint = loadArtifactFingerprint(name)
      assert.match(fingerprint.fullyQualifiedName, /^contracts\/.+:[A-Za-z0-9]+$/)
      assert.ok(fingerprint.runtimeSize > 0, name)
      assert.notEqual(fingerprint.buildInfoHash, null, name)
    }
  })

  it("classifies exact, metadata, and executable differences separately", function () {
    const desired = artifact("0x0102a10001", {metadataStart: 2})
    assert.equal(
      compareRuntimeBytecode("0x0102a10001", implementation, desired, deployment).classification,
      "exact-match"
    )
    assert.equal(
      compareRuntimeBytecode("0x0102a20001", implementation, desired, deployment).classification,
      "build-metadata-drift"
    )
    assert.equal(
      compareRuntimeBytecode("0x0102a2000002", implementation, desired, deployment).classification,
      "build-metadata-drift"
    )
    assert.equal(
      compareRuntimeBytecode("0xff02a10001", implementation, desired, deployment).classification,
      "executable-drift"
    )
  })

  it("classifies linked library differences and unknown immutable values", function () {
    const library = deployment.contracts.estforLibrary.address.toLowerCase().slice(2)
    const linked = artifact(`0xaa${"00".repeat(20)}bb`, {
      linkReferences: [{library: "EstforLibrary", start: 1, length: 20}],
    })
    assert.equal(
      compareRuntimeBytecode(`0xaa${library}bb`, implementation, linked, deployment).classification,
      "exact-match"
    )
    assert.equal(
      compareRuntimeBytecode(`0xaa${"22".repeat(20)}bb`, implementation, linked, deployment).classification,
      "library-drift"
    )

    const immutable = artifact(`0xaa${"00".repeat(32)}bb`, {immutableReferences: [{start: 1, length: 32}]})
    const self = implementation.slice(2).padStart(64, "0")
    assert.equal(
      compareRuntimeBytecode(`0xaa${self}bb`, implementation, immutable, deployment).classification,
      "exact-match"
    )
    assert.equal(
      compareRuntimeBytecode(`0xaa${"22".repeat(32)}bb`, implementation, immutable, deployment).classification,
      "unknown"
    )
  })

  it("hashes object keys canonically", function () {
    const first = hashPlan({a: 1, b: {c: 2}} as never)
    const second = hashPlan({b: {c: 2}, a: 1} as never)
    assert.equal(first, second)
  })

  it("removes pending operations and candidates that only support them", function () {
    const operation = (id: string, contractName: "shop" | "players") => ({id, contractName})
    const candidate = (
      contractName: "shop" | "players" | "estforLibrary" | "playersLibrary",
      operationId: string | null,
      libraryDependencies: Array<"estforLibrary" | "playersLibrary"> = []
    ) => ({contractName, operationId, libraryDependencies})
    const plan = {
      operations: [operation("upgrade:shop", "shop"), operation("upgrade:players", "players"), {id: "shop:update"}],
      upgrades: {
        operations: [operation("upgrade:shop", "shop"), operation("upgrade:players", "players")],
        candidates: [
          candidate("shop", "upgrade:shop", ["estforLibrary"]),
          candidate("estforLibrary", null),
          candidate("players", "upgrade:players", ["playersLibrary"]),
          candidate("playersLibrary", null),
        ],
      },
      shop: {operations: [{id: "shop:update"}]},
      pendingOperationIds: [],
      pendingCandidates: [],
      simulation: {status: "passed"},
      planHash: "0xold",
    } as unknown as DeploymentPlan

    const remainder = buildRemainderPlan(plan, new Set(["upgrade:shop", "shop:update"]))

    assert.deepEqual(
      remainder.operations.map(({id}) => id),
      ["upgrade:players"]
    )
    assert.deepEqual(
      remainder.upgrades.candidates.map(({contractName}) => contractName),
      ["players", "playersLibrary"]
    )
    assert.deepEqual(remainder.shop.operations, [])
    assert.deepEqual(remainder.pendingOperationIds, ["shop:update", "upgrade:shop"])
    assert.deepEqual(
      remainder.pendingCandidates.map(({contractName}) => contractName),
      ["shop", "estforLibrary"]
    )
    assert.equal(remainder.simulation, null)

    const nextRemainder = buildRemainderPlan(remainder, new Set(["upgrade:players"]))
    assert.deepEqual(nextRemainder.operations, [])
    assert.deepEqual(nextRemainder.pendingOperationIds, ["shop:update", "upgrade:players", "upgrade:shop"])
    assert.deepEqual(
      nextRemainder.pendingCandidates.map(({contractName}) => contractName),
      ["shop", "estforLibrary", "players", "playersLibrary"]
    )
  })
})
