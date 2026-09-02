import assert from "node:assert/strict"
import {mkdtempSync, readFileSync, rmSync} from "fs"
import {tmpdir} from "os"
import {join} from "path"
import {describe, it} from "node:test"
import {OperationType} from "@safe-global/types-kit"
import {
  buildSafeBatches,
  buildTransactionBuilderFile,
  isSafeTransactionNotFound,
  readSafeJournal,
  refreshSafeJournal,
  submitSafeBatch,
} from "./safeReconciliation"
import type {ReconciliationOperation} from "./reconciliation"

const SAFE = "0x1111111111111111111111111111111111111111"
const TARGET = "0x2222222222222222222222222222222222222222"

function operation(id: string, gas: string, dependencies: string[] = []): ReconciliationOperation {
  return {
    id,
    domain: "test",
    action: "update",
    resource: "fixture",
    target: TARGET,
    caller: SAFE,
    value: "0",
    data: `0x${id.charCodeAt(0).toString(16).padStart(2, "0")}`,
    destructive: false,
    dependencies,
    estimatedGas: gas,
    postcondition: null,
  }
}

describe("Safe reconciliation", function () {
  it("keeps dependency groups atomic while splitting independent work by limits", function () {
    const batches = buildSafeBatches([operation("a", "40"), operation("b", "40", ["a"]), operation("c", "40")], SAFE, {
      maxOperations: 3,
      maxGas: 100n,
    })
    assert.deepEqual(
      batches.map(({operationIds}) => operationIds),
      [["a", "b"], ["c"]]
    )
    assert.throws(
      () =>
        buildSafeBatches([operation("a", "60"), operation("b", "60", ["a"])], SAFE, {maxOperations: 3, maxGas: 100n}),
      /Atomic operation group/
    )
  })

  it("isolates destructive dependency groups as risk boundaries", function () {
    const destructive = {...operation("b", "1"), destructive: true}
    const batches = buildSafeBatches([operation("a", "1"), destructive, operation("c", "1")], SAFE)
    assert.deepEqual(
      batches.map(({operationIds}) => operationIds),
      [["a"], ["b"], ["c"]]
    )
  })

  it("rejects authority calls whose caller is not the tracked Safe", function () {
    const invalid = {...operation("a", "1"), caller: TARGET}
    assert.throws(() => buildSafeBatches([invalid], SAFE), /caller is not the tracked Safe/)
  })

  it("distinguishes a confirmed missing proposal from an unknown service failure", function () {
    assert.equal(isSafeTransactionNotFound(new Error("Not found.")), true)
    assert.equal(isSafeTransactionNotFound(new Error("request failed with status 404")), true)
    assert.equal(isSafeTransactionNotFound(new Error("service unavailable")), false)
  })

  it("exports the exact simulated calls in Safe Transaction Builder format", function () {
    const batch = buildSafeBatches([operation("a", "1")], SAFE)[0]
    const builder = buildTransactionBuilderFile("sonic-live", "0xabcdef", 146, SAFE, batch)
    assert.equal(builder.chainId, "146")
    assert.equal(builder.meta.createdFromSafeAddress, SAFE)
    assert.deepEqual(builder.transactions[0], {
      to: TARGET,
      value: "0",
      data: "0x61",
      contractMethod: null,
      contractInputsValues: null,
    })
    assert.deepEqual(batch.transactions[0], {to: TARGET, value: "0", data: "0x61", operation: OperationType.Call})
  })

  it("journals the payload before submission and records the Safe hash and nonce", async function () {
    const directory = mkdtempSync(join(tmpdir(), "safe-reconciliation-"))
    const journalPath = join(directory, "journal.json")
    const batch = buildSafeBatches([operation("a", "1")], SAFE)[0]
    let journalWasPrepared = false
    const clients = {
      proposerAddress: SAFE,
      protocol: {
        async createTransaction({
          transactions: _transactions,
          options,
        }: {
          transactions: unknown[]
          options: {nonce: number}
        }) {
          return {
            data: {
              to: TARGET,
              value: "0",
              data: "0x1234",
              operation: OperationType.DelegateCall,
              safeTxGas: "0",
              baseGas: "0",
              gasPrice: "0",
              gasToken: "0x0000000000000000000000000000000000000000",
              refundReceiver: "0x0000000000000000000000000000000000000000",
              nonce: options.nonce,
            },
          }
        },
        async getTransactionHash() {
          return `0x${"ab".repeat(32)}`
        },
        async signHash() {
          return {data: "0xsigned"}
        },
      },
      api: {
        async getNextNonce() {
          return "7"
        },
        async getTransaction() {
          throw new Error("unused")
        },
        async proposeTransaction({safeTransactionData}: {safeTransactionData: {nonce: number}}) {
          const prepared = JSON.parse(readFileSync(journalPath, "utf8"))
          journalWasPrepared = prepared.status === "prepared"
          assert.deepEqual(safeTransactionData, prepared.safeTransactionData)
        },
      },
    }
    try {
      const journal = await submitSafeBatch(clients as never, "sonic-live", "0xplan", SAFE, batch, 7, journalPath)
      assert.equal(journalWasPrepared, true)
      assert.equal(journal.status, "pending")
      assert.equal(journal.nonce, 7)
      assert.equal(readSafeJournal(journalPath).safeTxHash, `0x${"ab".repeat(32)}`)
      const executed = await refreshSafeJournal(
        {
          async getTransaction() {
            return {
              ...journal.safeTransactionData,
              safe: SAFE,
              safeTxHash: journal.safeTxHash,
              nonce: "7",
              isExecuted: true,
              isSuccessful: true,
              transactionHash: `0x${"cd".repeat(32)}`,
            } as never
          },
        } as never,
        journal,
        {
          async getTransactionReceipt() {
            return {blockNumber: 10, blockHash: `0x${"ef".repeat(32)}`, status: 1, gasUsed: 123n}
          },
        } as never
      )
      assert.equal(executed.status, "executed")
      assert.equal(executed.executionReceipt?.gasUsed, "123")
      await assert.rejects(
        refreshSafeJournal(
          {
            async getTransaction() {
              return {safeTxHash: journal.safeTxHash, safe: TARGET, nonce: "7"} as never
            },
          } as never,
          journal
        ),
        /does not match journal/
      )
    } finally {
      rmSync(directory, {recursive: true})
    }
  })
})
