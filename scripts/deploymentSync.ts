import "dotenv/config"
import {spawnSync} from "child_process"
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from "fs"
import {dirname, resolve} from "path"
import {JsonRpcProvider, Wallet, getAddress} from "ethers"
import {loadDeploymentRegistry} from "./deploymentRegistry"
import {buildDeploymentPlan, buildRemainderPlan, hashPlan, renderPlanMarkdown} from "./deploymentInventory"
import {DEFAULT_SHOP_LIMITS} from "./shopReconciliation"
import {simulateDeploymentPlan} from "./deploymentSimulation"
import {
  DEFAULT_SAFE_BATCH_LIMITS,
  buildSafeBatches,
  buildTransactionBuilderFile,
  createSafeApi,
  createSafeClients,
  isSafeTransactionNotFound,
  readSafeJournal,
  refreshSafeJournal,
  submitSafeBatch,
  writeSafeJournal,
} from "./safeReconciliation"
import type {DeploymentPlan, DeploymentPlanOptions} from "./deploymentInventory"
import {deployUpgradeCandidates} from "./upgradeReconciliation"
import {assertSafeOwner} from "./reconciliation"

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index === -1) return undefined
  const value = process.argv[index + 1]
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`)
  return value
}

function integerOption(name: string, defaultValue: number): number {
  const value = option(name)
  if (value === undefined) return defaultValue
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative integer`)
  return parsed
}

function bigintOption(name: string, defaultValue: bigint): bigint {
  const value = option(name)
  if (value === undefined) return defaultValue
  const parsed = BigInt(value)
  if (parsed < 0n) throw new Error(`${name} must be a non-negative integer`)
  return parsed
}

function operationPayloads(plan: DeploymentPlan): string {
  return JSON.stringify(
    plan.operations.map(({id, target, caller, value, data, dependencies}) => ({
      id,
      target,
      caller,
      value,
      data,
      dependencies,
    }))
  )
}

function authorityPayload(plan: DeploymentPlan): string {
  return JSON.stringify(plan.authority)
}

function candidatePayloads(plan: DeploymentPlan): string {
  return JSON.stringify(
    plan.upgrades.candidates.map(({contractName, candidateAddress, deployer, creationCodeHash, validation}) => ({
      contractName,
      candidateAddress,
      deployer,
      creationCodeHash,
      validationHash: validation.status === "passed" ? validation.outputHash : null,
    }))
  )
}

async function simulate(
  plan: DeploymentPlan,
  rpcUrl: string,
  deployment: ReturnType<typeof loadDeploymentRegistry>
): Promise<void> {
  const reasons = [...plan.upgrades.blockedReasons, ...plan.shop.blockedReasons]
  if (reasons.length === 0) {
    plan.simulation = await simulateDeploymentPlan(rpcUrl, deployment, plan)
  } else {
    plan.simulation = {status: "blocked", reasons}
  }
  const {planHash: _oldPlanHash, ...withoutHash} = plan
  plan.planHash = hashPlan(withoutHash)
}

async function main() {
  const apply = process.argv.includes("--apply")
  const resumeRunId = option("--resume")
  if (apply && resumeRunId) throw new Error("Use either --apply or --resume, not both")
  const deploymentId = option("--deployment")
  if (!deploymentId) throw new Error("--deployment is required (for example, sonic-live or sonic-beta)")
  const reviewedPlanPath = apply
    ? option("--plan")
    : resumeRunId
    ? resolve(`runs/${deploymentId}/${resumeRunId}/plan.json`)
    : undefined
  if (apply && !reviewedPlanPath) throw new Error("--apply requires --plan <reviewed-plan.json>")
  if (!apply && process.argv.includes("--plan")) throw new Error("--plan is only valid with --apply")
  const rpcUrl = process.env.RPC_URL ?? process.env.SONIC_RPC
  if (!rpcUrl) throw new Error("RPC_URL or SONIC_RPC is required")
  const blockValue = option("--block")
  const block = blockValue === undefined ? undefined : Number(blockValue)
  if (block !== undefined && (!Number.isSafeInteger(block) || block < 0))
    throw new Error("--block must be a non-negative integer")
  if (block !== undefined && reviewedPlanPath) throw new Error("--block cannot be combined with --apply or --resume")

  const deployment = loadDeploymentRegistry(deploymentId)
  const reviewedPlanValue = reviewedPlanPath
    ? (JSON.parse(readFileSync(reviewedPlanPath, "utf8")) as Partial<DeploymentPlan>)
    : undefined
  if (
    reviewedPlanValue &&
    (reviewedPlanValue.schemaVersion !== 3 ||
      !reviewedPlanValue.execution?.safeBatchLimits ||
      !reviewedPlanValue.upgrades ||
      !reviewedPlanValue.shop?.limits)
  )
    throw new Error(`Unsupported or invalid deployment plan schema: ${reviewedPlanPath}`)
  const reviewedPlan = reviewedPlanValue as DeploymentPlan | undefined
  if (reviewedPlan) {
    const {planHash, ...withoutHash} = reviewedPlan
    if (hashPlan(withoutHash) !== planHash)
      throw new Error(`Reviewed plan file has an invalid plan hash: ${reviewedPlanPath}`)
    if (reviewedPlan.deploymentId !== deploymentId || reviewedPlan.chainId !== deployment.chainId)
      throw new Error("Reviewed plan deployment identity does not match --deployment")
  }
  const proposerPrivateKey = process.env.PROPOSER_PRIVATE_KEY
  const proposerAddress = proposerPrivateKey ? getAddress(new Wallet(proposerPrivateKey).address) : undefined
  const reviewedDeployer = reviewedPlan?.upgrades.candidates[0]?.deployer
  if (reviewedDeployer && !proposerAddress) {
    throw new Error("PROPOSER_PRIVATE_KEY is required to deploy reviewed upgrade candidates")
  }
  if (reviewedDeployer && proposerAddress !== reviewedDeployer) {
    throw new Error("PROPOSER_PRIVATE_KEY does not match the reviewed candidate deployer")
  }
  const planOptions: DeploymentPlanOptions = {
    deployerAddress: proposerAddress,
    ...(reviewedPlan
      ? {
          allowRemovals: reviewedPlan.shop.limits.allowRemovals,
          maxChangedItems: reviewedPlan.shop.limits.maxChangedItems,
          maxRemovals: reviewedPlan.shop.limits.maxRemovals,
          maxAggregatePriceChange: BigInt(reviewedPlan.shop.limits.maxAggregatePriceChange),
          maxSafeOperations: reviewedPlan.execution.safeBatchLimits.maxOperations,
          maxSafeGas: BigInt(reviewedPlan.execution.safeBatchLimits.maxGas),
          ...(reviewedPlan.pendingOperationIds?.length
            ? {
                reusableCandidates: Object.fromEntries(
                  [...reviewedPlan.upgrades.candidates, ...(reviewedPlan.pendingCandidates ?? [])].map(
                    ({contractName, candidateAddress}) => [contractName, candidateAddress]
                  )
                ),
              }
            : {}),
        }
      : {
          allowRemovals: process.argv.includes("--allow-removals"),
          maxChangedItems: integerOption("--max-shop-changes", DEFAULT_SHOP_LIMITS.maxChangedItems),
          maxRemovals: integerOption("--max-shop-removals", DEFAULT_SHOP_LIMITS.maxRemovals),
          maxAggregatePriceChange: bigintOption("--max-shop-value-change", DEFAULT_SHOP_LIMITS.maxAggregatePriceChange),
          maxSafeOperations: integerOption("--max-safe-operations", DEFAULT_SAFE_BATCH_LIMITS.maxOperations),
          maxSafeGas: bigintOption("--max-safe-gas", DEFAULT_SAFE_BATCH_LIMITS.maxGas),
        }),
  }
  const build = spawnSync("forge", ["build"], {stdio: "inherit"})
  if (build.error) throw build.error
  if (build.status !== 0) throw new Error(`forge build failed with status ${build.status}`)
  const provider = new JsonRpcProvider(rpcUrl, deployment.chainId, {staticNetwork: true})
  const builtPlan = await buildDeploymentPlan(
    provider,
    deployment,
    reviewedPlan?.observationBlock.number ?? block,
    planOptions
  )
  const plan = reviewedPlan?.pendingOperationIds?.length
    ? buildRemainderPlan(builtPlan, new Set(reviewedPlan.pendingOperationIds))
    : builtPlan
  await simulate(plan, rpcUrl, deployment)
  const simulation = plan.simulation
  if (!simulation) throw new Error("Plan simulation did not produce a result")
  if (reviewedPlan && plan.planHash !== reviewedPlan.planHash)
    throw new Error(`Reviewed plan ${reviewedPlan.planHash} does not match current repository inputs ${plan.planHash}`)
  const outputRoot = resolve(
    reviewedPlanPath
      ? dirname(reviewedPlanPath)
      : option("--output") ??
          `runs/${deploymentId}/${plan.observationBlock.number}-${plan.observationBlock.hash.slice(2, 10)}`
  )
  mkdirSync(outputRoot, {recursive: true})
  const jsonPath = resolve(outputRoot, "plan.json")
  const markdownPath = resolve(outputRoot, "plan.md")
  writeFileSync(jsonPath, `${JSON.stringify(plan, null, 2)}\n`)
  writeFileSync(markdownPath, renderPlanMarkdown(plan))

  const safeLimits = {
    maxOperations: plan.execution.safeBatchLimits.maxOperations,
    maxGas: BigInt(plan.execution.safeBatchLimits.maxGas),
  }
  const batches =
    plan.operations.length === 0 || simulation.status === "blocked"
      ? []
      : buildSafeBatches(plan.operations, deployment.authority.address, safeLimits)
  for (const batch of batches) {
    writeFileSync(
      resolve(outputRoot, `safe-transaction-builder-${batch.index + 1}.json`),
      `${JSON.stringify(
        buildTransactionBuilderFile(
          deploymentId,
          plan.planHash,
          deployment.chainId,
          deployment.authority.address,
          batch
        ),
        null,
        2
      )}\n`
    )
  }

  console.log(`Wrote ${jsonPath}`)
  console.log(`Wrote ${markdownPath}`)
  console.log(
    `Plan ${plan.planHash}: ${plan.summary.errors} errors, ${plan.summary.warnings} warnings, ${plan.operations.length} operations, simulation ${simulation.status}`
  )

  if (!apply && !resumeRunId) {
    if (plan.summary.errors !== 0) process.exitCode = 2
    return
  }

  if (plan.summary.errors !== 0) throw new Error("Cannot submit a plan with alignment errors")
  if (simulation.status !== "passed" && simulation.status !== "no-op")
    throw new Error("Cannot submit a plan that did not pass simulation")
  if ((batches.length !== 0 || plan.pendingOperationIds.length !== 0) && !process.env.SAFE_API_KEY) {
    throw new Error("SAFE_API_KEY is required for Safe proposal apply and resume")
  }

  if (resumeRunId) {
    if (batches.length === 0 && plan.pendingOperationIds.length === 0) {
      if (plan.upgrades.candidates.length === 0 && plan.pendingCandidates.length === 0)
        console.log("Deployment is aligned; no Safe proposal remains")
      else console.log("Candidate code exists without an authority operation; deployment remains pending")
      if (plan.upgrades.candidates.length !== 0 || plan.pendingCandidates.length !== 0) process.exitCode = 2
      return
    }
    const api = createSafeApi(deployment.chainId, process.env.SAFE_API_KEY!)
    const relevantOperationIds = new Set([...plan.pendingOperationIds, ...plan.operations.map(({id}) => id)])
    const journals = readdirSync(outputRoot)
      .filter((name) => /^safe-proposal-.*\.json$/.test(name))
      .map((name) => ({path: resolve(outputRoot, name), journal: readSafeJournal(resolve(outputRoot, name))}))
      .filter(({journal}) => journal.operationIds.some((id) => relevantOperationIds.has(id)))
    const unjournaledOperationIds: string[] = []
    for (const entry of journals) {
      const {journal} = entry
      try {
        await refreshSafeJournal(api, journal, provider)
      } catch (error) {
        if (journal.status !== "prepared" || !isSafeTransactionNotFound(error)) throw error
        unjournaledOperationIds.push(...journal.operationIds)
        console.log(`Safe batch ${journal.batchIndex + 1}: prepared but absent from the Safe service`)
      }
      writeSafeJournal(entry.path, journal)
      console.log(`Safe batch ${journal.batchIndex + 1}: ${journal.status} (${journal.safeTxHash})`)
    }
    for (const batch of batches) {
      if (!journals.some(({journal}) => JSON.stringify(journal.operationIds) === JSON.stringify(batch.operationIds))) {
        unjournaledOperationIds.push(...batch.operationIds)
        console.log(`Safe batch ${batch.index + 1}: unproposed (no journal)`)
      }
    }
    const pendingOperationIds = new Set(
      journals.filter(({journal}) => journal.status === "pending").flatMap(({journal}) => journal.operationIds)
    )
    const reusableCandidates = Object.fromEntries(
      [...plan.upgrades.candidates, ...plan.pendingCandidates].map(({contractName, candidateAddress}) => [
        contractName,
        candidateAddress,
      ])
    )
    const currentStatePlan = await buildDeploymentPlan(provider, deployment, undefined, {
      ...planOptions,
      reusableCandidates,
    })
    const remainderPlan = buildRemainderPlan(currentStatePlan, pendingOperationIds)
    await simulate(remainderPlan, rpcUrl, deployment)
    writeFileSync(resolve(outputRoot, "remainder-plan.json"), `${JSON.stringify(remainderPlan, null, 2)}\n`)
    writeFileSync(resolve(outputRoot, "remainder-plan.md"), renderPlanMarkdown(remainderPlan))
    const remainingOperationIds = remainderPlan.operations.map(({id}) => id)
    const unproposedOperationIds = new Set([...unjournaledOperationIds, ...remainingOperationIds])
    console.log(
      `Resume result: ${pendingOperationIds.size} pending operations, ${unproposedOperationIds.size} unproposed remaining operations`
    )
    const executedOperationIds = new Set(
      journals.filter(({journal}) => journal.status === "executed").flatMap(({journal}) => journal.operationIds)
    )
    const allReviewedOperationsExecuted = [...relevantOperationIds].every((id) => executedOperationIds.has(id))
    if (allReviewedOperationsExecuted) {
      writeFileSync(resolve(outputRoot, "final-plan.json"), `${JSON.stringify(remainderPlan, null, 2)}\n`)
      if (
        remainderPlan.summary.errors !== 0 ||
        remainderPlan.operations.length !== 0 ||
        remainderPlan.upgrades.candidates.length !== 0
      )
        throw new Error("Safe proposals executed, but final deployment verification is not aligned")
      console.log("Final verification passed; the managed deployment plan is empty")
    }
    return
  }

  if (
    batches.length === 0 &&
    plan.upgrades.candidates.length === 0 &&
    plan.pendingCandidates.length === 0 &&
    plan.pendingOperationIds.length === 0
  ) {
    console.log("Deployment is already aligned; no Safe proposal was submitted")
    return
  }

  if (batches.length === 0 && plan.upgrades.candidates.length === 0) {
    console.log(`Deployment remains pending with ${plan.pendingOperationIds.length} Safe operations`)
    process.exitCode = 2
    return
  }
  if (batches.length !== 0 && !proposerPrivateKey) {
    throw new Error("PROPOSER_PRIVATE_KEY is required for Safe proposal apply")
  }

  const latestBlock = await provider.getBlockNumber()
  const maxPlanAgeBlocks = integerOption("--max-plan-age-blocks", 3_600)
  if (latestBlock - plan.observationBlock.number > maxPlanAgeBlocks)
    throw new Error(
      `Reviewed plan is ${latestBlock - plan.observationBlock.number} blocks old; maximum is ${maxPlanAgeBlocks}`
    )

  const reusableCandidates = Object.fromEntries(
    (
      await Promise.all(
        plan.upgrades.candidates.map(async ({contractName, candidateAddress}) =>
          (await provider.getCode(candidateAddress)) === "0x" ? null : ([contractName, candidateAddress] as const)
        )
      )
    ).filter(
      (candidate): candidate is readonly [(typeof plan.upgrades.candidates)[number]["contractName"], string] =>
        candidate !== null
    )
  )
  const builtCurrentPlan = await buildDeploymentPlan(provider, deployment, undefined, {
    ...planOptions,
    reusableCandidates,
  })
  const currentPlan = reviewedPlan?.pendingOperationIds?.length
    ? buildRemainderPlan(builtCurrentPlan, new Set(reviewedPlan.pendingOperationIds))
    : builtCurrentPlan
  await simulate(currentPlan, rpcUrl, deployment)
  if (
    currentPlan.summary.errors !== 0 ||
    authorityPayload(currentPlan) !== authorityPayload(plan) ||
    candidatePayloads(currentPlan) !== candidatePayloads(plan) ||
    operationPayloads(currentPlan) !== operationPayloads(plan)
  )
    throw new Error("Managed chain state changed after the reviewed plan; generate and review a new plan")

  assertSafeOwner(proposerAddress, currentPlan.authority.owners)

  if (plan.upgrades.candidates.length !== 0) {
    const deployer = new Wallet(proposerPrivateKey!, provider)
    await deployUpgradeCandidates(
      provider,
      rpcUrl,
      deployer,
      deployment,
      plan.planHash,
      plan.upgrades.candidates,
      outputRoot
    )
  }

  if (batches.length === 0) {
    console.log("Candidate code deployed without an authority operation; deployment remains pending")
    process.exitCode = 2
    return
  }

  const clients = await createSafeClients(
    deployment.chainId,
    rpcUrl,
    deployment.authority.address,
    process.env.SAFE_API_KEY!,
    proposerPrivateKey!
  )
  if (!currentPlan.authority.owners.includes(clients.proposerAddress))
    throw new Error(`Proposal sender ${clients.proposerAddress} is not an owner of the tracked Safe`)
  let nextNonce = Number(await clients.api.getNextNonce(deployment.authority.address))
  for (const batch of batches) {
    const journalPath = resolve(outputRoot, `safe-proposal-${plan.planHash.slice(2, 10)}-${batch.index + 1}.json`)
    let nonce = nextNonce
    if (existsSync(journalPath)) {
      const existing = readSafeJournal(journalPath)
      if (
        existing.planHash !== plan.planHash ||
        existing.safeAddress !== plan.authority.address ||
        JSON.stringify(existing.transactions) !== JSON.stringify(batch.transactions)
      )
        throw new Error(`Existing proposal journal does not match batch ${batch.index + 1}`)
      nonce = existing.nonce
      nextNonce = Math.max(nextNonce, nonce + 1)
      const expectedSafeTransaction = await clients.protocol.createTransaction({
        transactions: batch.transactions,
        options: {nonce},
      })
      const expectedSafeTxHash = await clients.protocol.getTransactionHash(expectedSafeTransaction)
      if (
        expectedSafeTxHash !== existing.safeTxHash ||
        JSON.stringify(expectedSafeTransaction.data) !== JSON.stringify(existing.safeTransactionData)
      )
        throw new Error(`Existing proposal journal hash does not match batch ${batch.index + 1}`)
      try {
        const refreshed = await refreshSafeJournal(clients.api, existing, provider)
        writeSafeJournal(journalPath, refreshed)
        console.log(`Safe batch ${batch.index + 1}: ${refreshed.status} (${refreshed.safeTxHash})`)
        if (refreshed.status === "failed")
          throw new Error(`Safe batch ${batch.index + 1} failed; generate and review a current-state plan`)
        continue
      } catch (error) {
        if (existing.status !== "prepared" || !isSafeTransactionNotFound(error)) throw error
        console.log(`Prepared Safe batch ${batch.index + 1} was not found; retrying its recorded proposal`)
      }
    } else {
      nextNonce++
    }
    const journal = await submitSafeBatch(
      clients,
      deploymentId,
      plan.planHash,
      deployment.authority.address,
      batch,
      nonce,
      journalPath
    )
    console.log(`Submitted Safe batch ${batch.index + 1} at nonce ${journal.nonce}: ${journal.safeTxHash}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
