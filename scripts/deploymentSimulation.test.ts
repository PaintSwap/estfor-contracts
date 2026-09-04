import assert from "node:assert/strict"
import {describe, it} from "node:test"
import type {TransactionReceipt} from "ethers"
import {waitForAnvilTransaction} from "./deploymentSimulation"

describe("deployment simulation", function () {
  it("observes a receipt that was mined without a later block event", async function () {
    const transactionHash = `0x${"cd".repeat(32)}`
    const receipt = {status: 1} as TransactionReceipt
    let receiptChecks = 0
    const provider = {
      async getTransactionReceipt() {
        receiptChecks++
        return receiptChecks === 1 ? null : receipt
      },
    }

    assert.equal(await waitForAnvilTransaction(provider, transactionHash, 200), receipt)
    assert.equal(receiptChecks, 2)
  })

  it("adds transaction context to timeouts without masking other provider errors", async function () {
    const transactionHash = `0x${"ab".repeat(32)}`
    const timeoutProvider = {
      async getTransactionReceipt() {
        return null
      },
    }
    await assert.rejects(
      waitForAnvilTransaction(timeoutProvider, transactionHash, 5),
      new RegExp(`Timed out waiting for simulated transaction ${transactionHash}`)
    )

    const rpcError = new Error("RPC unavailable")
    await assert.rejects(
      waitForAnvilTransaction({getTransactionReceipt: async () => Promise.reject(rpcError)}, transactionHash, 5),
      (error) => error === rpcError
    )
  })
})
