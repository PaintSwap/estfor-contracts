import assert from "node:assert/strict"
import {describe, it} from "node:test"
import {waitForAnvilTransaction} from "./deploymentSimulation"

describe("deployment simulation", function () {
  it("adds transaction context to timeouts without masking other provider errors", async function () {
    const transactionHash = `0x${"ab".repeat(32)}`
    let receivedTimeout: number | undefined
    const timeoutProvider = {
      async waitForTransaction(_hash: string, _confirmations: number, timeout: number) {
        receivedTimeout = timeout
        throw Object.assign(new Error("timeout"), {code: "TIMEOUT", shortMessage: "timeout"})
      },
    }
    await assert.rejects(
      waitForAnvilTransaction(timeoutProvider, transactionHash, 5),
      new RegExp(`Timed out waiting for simulated transaction ${transactionHash}`)
    )
    assert.equal(receivedTimeout, 5)

    await assert.rejects(
      waitForAnvilTransaction({waitForTransaction: async () => null}, transactionHash, 5),
      new RegExp(`Timed out waiting for simulated transaction ${transactionHash}`)
    )

    const rpcError = new Error("RPC unavailable")
    await assert.rejects(
      waitForAnvilTransaction({waitForTransaction: async () => Promise.reject(rpcError)}, transactionHash, 5),
      (error) => error === rpcError
    )
  })
})
