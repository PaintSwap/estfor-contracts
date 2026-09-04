import SafeApiKit from "@safe-global/api-kit"
import Safe from "@safe-global/protocol-kit"
import {
  MetaTransactionData,
  OperationType,
  SafeMultisigTransactionResponse,
  SafeTransactionData,
} from "@safe-global/types-kit"
import {JsonRpcProvider, Wallet, getAddress} from "ethers"
import {readFileSync, renameSync, writeFileSync} from "fs"
import {isDeepStrictEqual} from "util"
import {DEFAULT_SAFE_BATCH_LIMITS} from "./reconciliation"
import type {ReconciliationOperation} from "./reconciliation"

export {DEFAULT_SAFE_BATCH_LIMITS} from "./reconciliation"

export interface SafeBatchLimits {
  maxOperations: number
  maxGas: bigint
}

export interface SafeBatch {
  index: number
  operationIds: string[]
  estimatedGas: string
  transactions: MetaTransactionData[]
}

export interface SafeTransactionBuilderFile {
  version: "1.0"
  chainId: string
  createdAt: number
  meta: {
    name: string
    description: string
    txBuilderVersion: string
    createdFromSafeAddress: string
    createdFromOwnerAddress: string
  }
  transactions: Array<{
    to: string
    value: string
    data: string
    contractMethod: null
    contractInputsValues: null
  }>
}

export interface SafeProposalJournal {
  schemaVersion: 2
  deploymentId: string
  planHash: string
  safeAddress: string
  batchIndex: number
  operationIds: string[]
  nonce: number
  safeTxHash: string
  status: "prepared" | "pending" | "executed" | "failed"
  transactionHash: string | null
  transactions: MetaTransactionData[]
  safeTransactionData: SafeTransactionData
  executionReceipt: {
    blockNumber: number
    blockHash: string
    status: number
    gasUsed: string
  } | null
}

interface SafeApi {
  getSafeDelegates(parameters: {safeAddress: string; delegateAddress: string}): Promise<{
    results: readonly {
      safe: string
      delegate: string
      delegator: string
      expiryDate: string | null
    }[]
  }>
  getNextNonce(safeAddress: string): Promise<string>
  getTransaction(safeTxHash: string): Promise<SafeMultisigTransactionResponse>
  proposeTransaction(parameters: {
    safeAddress: string
    safeTransactionData: Parameters<Safe["getTransactionHash"]>[0]["data"]
    safeTxHash: string
    senderAddress: string
    senderSignature: string
    origin?: string
  }): Promise<void>
}

export interface SafeProtocol {
  createTransaction(parameters: Parameters<Safe["createTransaction"]>[0]): ReturnType<Safe["createTransaction"]>
  getTransactionHash(transaction: Parameters<Safe["getTransactionHash"]>[0]): Promise<string>
  signHash(hash: string): ReturnType<Safe["signHash"]>
}

export interface SafeClients {
  api: SafeApi
  protocol: SafeProtocol
  proposerAddress: string
}

function operationTransaction(operation: ReconciliationOperation): MetaTransactionData {
  return {
    to: getAddress(operation.target),
    value: operation.value,
    data: operation.data,
    operation: OperationType.Call,
  }
}

function dependencyGroups(operations: ReconciliationOperation[]): ReconciliationOperation[][] {
  const byId = new Map(operations.map((operation) => [operation.id, operation]))
  if (byId.size !== operations.length) throw new Error("Reconciliation operation IDs must be unique")
  const parent = new Map(operations.map(({id}) => [id, id]))
  const root = (id: string): string => {
    const current = parent.get(id)
    if (!current) throw new Error(`Operation dependency ${id} is not in the plan`)
    if (current === id) return id
    const resolved = root(current)
    parent.set(id, resolved)
    return resolved
  }
  for (const operation of operations) {
    for (const dependency of operation.dependencies) {
      const operationRoot = root(operation.id)
      const dependencyRoot = root(dependency)
      if (operationRoot !== dependencyRoot) parent.set(operationRoot, dependencyRoot)
    }
  }
  const groups = new Map<string, ReconciliationOperation[]>()
  for (const operation of operations) {
    const key = root(operation.id)
    groups.set(key, [...(groups.get(key) ?? []), operation])
  }
  return [...groups.values()]
}

function operationGas(operation: ReconciliationOperation): bigint {
  if (operation.estimatedGas === null) throw new Error(`Operation ${operation.id} has not been simulated`)
  return BigInt(operation.estimatedGas)
}

export function buildSafeBatches(
  operations: ReconciliationOperation[],
  safeAddress: string,
  limits: SafeBatchLimits = DEFAULT_SAFE_BATCH_LIMITS
): SafeBatch[] {
  const safe = getAddress(safeAddress)
  if (!Number.isSafeInteger(limits.maxOperations) || limits.maxOperations < 1)
    throw new Error("Safe maximum operations must be a positive integer")
  if (limits.maxGas < 1n) throw new Error("Safe maximum gas must be positive")
  for (const operation of operations) {
    if (getAddress(operation.caller) !== safe)
      throw new Error(`Operation ${operation.id} caller is not the tracked Safe ${safe}`)
  }

  const batches: ReconciliationOperation[][] = []
  for (const group of dependencyGroups(operations)) {
    const groupGas = group.reduce((total, operation) => total + operationGas(operation), 0n)
    if (group.length > limits.maxOperations || groupGas > limits.maxGas)
      throw new Error(`Atomic operation group ${group.map(({id}) => id).join(", ")} exceeds Safe batch limits`)
    const current = batches.at(-1)
    const currentGas = current?.reduce((total, operation) => total + operationGas(operation), 0n) ?? 0n
    const crossesRiskBoundary =
      group.some(({destructive}) => destructive) || current?.some(({destructive}) => destructive) === true
    if (
      !current ||
      crossesRiskBoundary ||
      current.length + group.length > limits.maxOperations ||
      currentGas + groupGas > limits.maxGas
    ) {
      batches.push([...group])
    } else {
      current.push(...group)
    }
  }
  return batches.map((operationsInBatch, index) => ({
    index,
    operationIds: operationsInBatch.map(({id}) => id),
    estimatedGas: operationsInBatch.reduce((total, operation) => total + operationGas(operation), 0n).toString(),
    transactions: operationsInBatch.map(operationTransaction),
  }))
}

export function buildTransactionBuilderFile(
  deploymentId: string,
  planHash: string,
  chainId: number,
  safeAddress: string,
  batch: SafeBatch
): SafeTransactionBuilderFile {
  const safe = getAddress(safeAddress)
  return {
    version: "1.0",
    chainId: String(chainId),
    createdAt: 0,
    meta: {
      name: `${deploymentId} reconciliation ${planHash.slice(0, 10)} batch ${batch.index + 1}`,
      description: `Operations: ${batch.operationIds.join(", ")}`,
      txBuilderVersion: "1.18.0",
      createdFromSafeAddress: safe,
      createdFromOwnerAddress: "",
    },
    transactions: batch.transactions.map(({to, value, data}) => ({
      to,
      value,
      data,
      contractMethod: null,
      contractInputsValues: null,
    })),
  }
}

export function readSafeJournal(path: string): SafeProposalJournal {
  const journal = JSON.parse(readFileSync(path, "utf8")) as Partial<SafeProposalJournal>
  if (journal.schemaVersion !== 2 || !journal.safeTransactionData || !Array.isArray(journal.transactions))
    throw new Error(`Unsupported or invalid Safe proposal journal: ${path}`)
  return journal as SafeProposalJournal
}

export function writeSafeJournal(path: string, journal: SafeProposalJournal): void {
  const temporaryPath = `${path}.tmp`
  writeFileSync(temporaryPath, `${JSON.stringify(journal, null, 2)}\n`, {mode: 0o600})
  renameSync(temporaryPath, path)
}

export async function assertSafeJournalMatchesBatch(
  protocol: SafeProtocol,
  journal: SafeProposalJournal,
  expected: {deploymentId: string; planHash: string; safeAddress: string; batch: SafeBatch}
): Promise<void> {
  const {deploymentId, planHash, safeAddress, batch} = expected
  if (
    journal.deploymentId !== deploymentId ||
    journal.planHash !== planHash ||
    getAddress(journal.safeAddress) !== getAddress(safeAddress) ||
    journal.batchIndex !== batch.index ||
    !isDeepStrictEqual(journal.operationIds, batch.operationIds) ||
    !isDeepStrictEqual(journal.transactions, batch.transactions)
  ) {
    throw new Error(`Safe proposal journal does not match reviewed batch ${batch.index + 1}`)
  }
  await assertSafeJournalSelfConsistent(protocol, journal)
}

export async function assertSafeJournalSelfConsistent(
  protocol: SafeProtocol,
  journal: SafeProposalJournal
): Promise<void> {
  const safeTransaction = await protocol.createTransaction({
    transactions: journal.transactions,
    options: {nonce: journal.nonce},
  })
  const safeTxHash = await protocol.getTransactionHash(safeTransaction)
  if (safeTxHash !== journal.safeTxHash || !isDeepStrictEqual(safeTransaction.data, journal.safeTransactionData)) {
    throw new Error(`Safe proposal journal hash does not match its recorded transactions`)
  }
}

export async function createSafeClients(
  chainId: number,
  rpcUrl: string,
  safeAddress: string,
  apiKey: string,
  proposerPrivateKey: string
): Promise<SafeClients> {
  const proposer = new Wallet(proposerPrivateKey)
  const api = new SafeApiKit({chainId: BigInt(chainId), apiKey})
  const protocol = await Safe.init({provider: rpcUrl, signer: proposerPrivateKey, safeAddress})
  return {api, protocol, proposerAddress: proposer.address}
}

export function createSafeApi(chainId: number, apiKey: string): SafeApiKit {
  return new SafeApiKit({chainId: BigInt(chainId), apiKey})
}

export async function assertSafeProposalSender(
  api: Pick<SafeApi, "getSafeDelegates">,
  safeAddress: string,
  proposerAddress: string | undefined,
  owners: readonly string[]
): Promise<void> {
  if (!proposerAddress) throw new Error("Proposal sender is unavailable")
  const safe = getAddress(safeAddress)
  const proposer = getAddress(proposerAddress)
  const normalizedOwners = new Set(owners.map((owner) => getAddress(owner)))
  if (normalizedOwners.has(proposer)) return
  const delegates = await api.getSafeDelegates({safeAddress: safe, delegateAddress: proposer})
  if (
    !delegates.results.some(
      (delegate) =>
        getAddress(delegate.safe) === safe &&
        getAddress(delegate.delegate) === proposer &&
        normalizedOwners.has(getAddress(delegate.delegator)) &&
        (delegate.expiryDate === null || Date.parse(delegate.expiryDate) > Date.now())
    )
  )
    throw new Error(`Proposal sender ${proposer} is neither an owner nor a proposer of the tracked Safe ${safe}`)
}

export async function submitSafeBatch(
  clients: SafeClients,
  deploymentId: string,
  planHash: string,
  safeAddress: string,
  batch: SafeBatch,
  nonce: number,
  journalPath: string
): Promise<SafeProposalJournal> {
  const safe = getAddress(safeAddress)
  const safeTransaction = await clients.protocol.createTransaction({transactions: batch.transactions, options: {nonce}})
  const safeTxHash = await clients.protocol.getTransactionHash(safeTransaction)
  const journal: SafeProposalJournal = {
    schemaVersion: 2,
    deploymentId,
    planHash,
    safeAddress: safe,
    batchIndex: batch.index,
    operationIds: batch.operationIds,
    nonce,
    safeTxHash,
    status: "prepared",
    transactionHash: null,
    transactions: batch.transactions,
    safeTransactionData: safeTransaction.data,
    executionReceipt: null,
  }
  writeSafeJournal(journalPath, journal)
  const signature = await clients.protocol.signHash(safeTxHash)
  await clients.api.proposeTransaction({
    safeAddress: safe,
    safeTransactionData: safeTransaction.data,
    safeTxHash,
    senderAddress: clients.proposerAddress,
    senderSignature: signature.data,
    origin: `Estfor deployment reconciliation ${deploymentId} ${planHash} batch ${batch.index + 1}`,
  })
  journal.status = "pending"
  writeSafeJournal(journalPath, journal)
  return journal
}

export async function refreshSafeJournal(
  api: SafeApi,
  journal: SafeProposalJournal,
  provider?: JsonRpcProvider
): Promise<SafeProposalJournal> {
  const transaction = await api.getTransaction(journal.safeTxHash)
  if (
    transaction.safeTxHash !== journal.safeTxHash ||
    getAddress(transaction.safe) !== getAddress(journal.safeAddress) ||
    Number(transaction.nonce) !== journal.nonce ||
    getAddress(transaction.to) !== getAddress(journal.safeTransactionData.to) ||
    transaction.value !== journal.safeTransactionData.value ||
    (transaction.data ?? "0x") !== journal.safeTransactionData.data ||
    transaction.operation !== journal.safeTransactionData.operation ||
    transaction.safeTxGas !== journal.safeTransactionData.safeTxGas ||
    transaction.baseGas !== journal.safeTransactionData.baseGas ||
    transaction.gasPrice !== journal.safeTransactionData.gasPrice ||
    getAddress(transaction.gasToken) !== getAddress(journal.safeTransactionData.gasToken) ||
    getAddress(transaction.refundReceiver ?? "0x0000000000000000000000000000000000000000") !==
      getAddress(journal.safeTransactionData.refundReceiver)
  )
    throw new Error(`Safe service transaction does not match journal ${journal.safeTxHash}`)
  journal.status = !transaction.isExecuted ? "pending" : transaction.isSuccessful ? "executed" : "failed"
  journal.transactionHash = transaction.transactionHash
  if (transaction.isExecuted) {
    if (!provider || !transaction.transactionHash)
      throw new Error(`Executed Safe transaction ${journal.safeTxHash} cannot be verified without an RPC receipt`)
    const receipt = await provider.getTransactionReceipt(transaction.transactionHash)
    if (!receipt) throw new Error(`Execution receipt not found for ${transaction.transactionHash}`)
    if (transaction.isSuccessful && receipt.status !== 1) {
      throw new Error(`Successful Safe transaction ${journal.safeTxHash} has a reverted RPC receipt`)
    }
    journal.executionReceipt = {
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      status: receipt.status ?? 0,
      gasUsed: receipt.gasUsed.toString(),
    }
  }
  return journal
}

export function isSafeTransactionNotFound(error: unknown): boolean {
  return error instanceof Error && /(?:not found|\b404\b)/i.test(error.message)
}

export function allSafeOperationsExecuted(
  journals: readonly Pick<SafeProposalJournal, "operationIds" | "status">[],
  operationIds: ReadonlySet<string>
): boolean {
  const pending = new Set(journals.filter(({status}) => status === "pending").flatMap(({operationIds: ids}) => ids))
  if ([...operationIds].some((id) => pending.has(id))) return false
  const executed = new Set(journals.filter(({status}) => status === "executed").flatMap(({operationIds: ids}) => ids))
  return [...operationIds].every((id) => executed.has(id))
}
