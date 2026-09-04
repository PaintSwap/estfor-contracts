import "dotenv/config"
import {spawnSync} from "child_process"
import {existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync} from "fs"
import {basename, dirname, resolve} from "path"
import Safe from "@safe-global/protocol-kit"
import {JsonRpcProvider, Wallet, getAddress} from "ethers"
import {loadDeploymentRegistry, observeDeploymentRegistry, refreshDeploymentRegistry} from "./deploymentRegistry"
import {
  buildDeploymentPlan,
  buildRemainderPlan,
  hashPlan,
  renderFindings,
  renderPlanMarkdown,
} from "./deploymentInventory"
import {DEFAULT_SHOP_LIMITS} from "./shopReconciliation"
import {simulateDeploymentPlan} from "./deploymentSimulation"
import {
  DEFAULT_SAFE_BATCH_LIMITS,
  allSafeOperationsExecuted,
  assertSafeJournalMatchesBatch,
  assertSafeJournalSelfConsistent,
  assertSafeProposalSender,
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

const syncStartedAt = Date.now()
const repositoryRoot = resolve(__dirname, "..")
const reviewPlanFilePattern = /^(plan|remainder-plan(?:-[0-9a-f]{8})?)\.json$/

type ReviewPlanName = "plan" | "remainder-plan" | `remainder-plan-${string}`

function logProgress(message: string): void {
  const elapsedSeconds = ((Date.now() - syncStartedAt) / 1000).toFixed(1)
  console.log(`[deployment:sync +${elapsedSeconds}s] ${message}`)
}

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
    plan.upgrades.candidates.map(
      ({contractName, candidateAddress, deployer, creationCodeHash, constructorData, validation}) => ({
        contractName,
        candidateAddress,
        deployer,
        creationCodeHash,
        constructorData,
        validationHash: validation.status === "passed" ? validation.outputHash : null,
      })
    )
  )
}

async function simulate(
  plan: DeploymentPlan,
  rpcUrl: string,
  deployment: ReturnType<typeof loadDeploymentRegistry>
): Promise<void> {
  const reasons = [...plan.upgrades.blockedReasons, ...plan.shop.blockedReasons]
  if (reasons.length === 0) {
    logProgress(
      `Starting Anvil simulation (${plan.upgrades.candidates.length} candidates, ${plan.operations.length} operations)`
    )
    plan.simulation = await simulateDeploymentPlan(rpcUrl, deployment, plan, logProgress)
  } else {
    logProgress(`Skipping simulation because the plan has ${reasons.length} blocking reason(s)`)
    plan.simulation = {status: "blocked", reasons}
  }
  const {planHash: _oldPlanHash, ...withoutHash} = plan
  plan.planHash = hashPlan(withoutHash)
  logProgress(`Plan simulation finished with status ${plan.simulation.status}`)
}

function readDeploymentPlan(path: string, deploymentId: string, chainId: number): DeploymentPlan {
  const value = JSON.parse(readFileSync(path, "utf8")) as Partial<DeploymentPlan>
  if (value.schemaVersion !== 4 || !value.execution?.safeBatchLimits || !value.upgrades || !value.shop?.limits) {
    throw new Error(`Unsupported or invalid deployment plan schema: ${path}`)
  }
  const plan = value as DeploymentPlan
  const {planHash, ...withoutHash} = plan
  if (hashPlan(withoutHash) !== planHash) throw new Error(`Deployment plan has an invalid plan hash: ${path}`)
  if (plan.deploymentId !== deploymentId || plan.chainId !== chainId) {
    throw new Error(`Deployment plan identity does not match ${deploymentId}: ${path}`)
  }
  return plan
}

function reviewPlanName(fileName: string): ReviewPlanName | null {
  return (reviewPlanFilePattern.exec(fileName)?.[1] as ReviewPlanName | undefined) ?? null
}

function reviewedPlanName(path: string): ReviewPlanName {
  const name = reviewPlanName(basename(path))
  if (!name) throw new Error(`Unsupported reviewed plan filename: ${path}`)
  return name
}

function remainderPlanName(plan: DeploymentPlan): ReviewPlanName {
  return `remainder-plan-${plan.planHash.slice(2, 10)}`
}

function safeBuilderPrefix(name: ReviewPlanName): string {
  return name === "plan" ? "safe-transaction-builder" : `${name}-safe-transaction-builder`
}

function safeBatchesForPlan(plan: DeploymentPlan): ReturnType<typeof buildSafeBatches> {
  if (plan.operations.length === 0 || plan.simulation?.status === "blocked") return []
  return buildSafeBatches(plan.operations, plan.authority.address, {
    maxOperations: plan.execution.safeBatchLimits.maxOperations,
    maxGas: BigInt(plan.execution.safeBatchLimits.maxGas),
  })
}

function writeImmutableFile(path: string, content: string): void {
  if (existsSync(path)) {
    if (readFileSync(path, "utf8") !== content) throw new Error(`Refusing to overwrite reviewed artifact: ${path}`)
    return
  }
  const temporaryPath = `${path}.tmp`
  writeFileSync(temporaryPath, content)
  renameSync(temporaryPath, path)
}

function derivedReviewFiles(
  outputRoot: string,
  name: ReviewPlanName,
  plan: DeploymentPlan,
  batches: ReturnType<typeof buildSafeBatches>
): Array<{path: string; content: string}> {
  const builderPrefix = safeBuilderPrefix(name)
  return [
    {path: resolve(outputRoot, `${name}.md`), content: renderPlanMarkdown(plan)},
    ...batches.map((batch) => ({
      path: resolve(outputRoot, `${builderPrefix}-${batch.index + 1}.json`),
      content: `${JSON.stringify(
        buildTransactionBuilderFile(plan.deploymentId, plan.planHash, plan.chainId, plan.authority.address, batch),
        null,
        2
      )}\n`,
    })),
  ]
}

function writePlanFiles(
  outputRoot: string,
  name: ReviewPlanName,
  plan: DeploymentPlan,
  batches: ReturnType<typeof buildSafeBatches>
) {
  mkdirSync(outputRoot, {recursive: true})
  const jsonPath = resolve(outputRoot, `${name}.json`)
  writeImmutableFile(jsonPath, `${JSON.stringify(plan, null, 2)}\n`)
  const reviewFiles = derivedReviewFiles(outputRoot, name, plan, batches)
  for (const file of reviewFiles) writeImmutableFile(file.path, file.content)
  return {jsonPath, markdownPath: reviewFiles[0].path}
}

function assertDerivedReviewFiles(
  outputRoot: string,
  name: ReviewPlanName,
  plan: DeploymentPlan,
  batches: ReturnType<typeof buildSafeBatches>
): void {
  const reviewFiles = derivedReviewFiles(outputRoot, name, plan, batches)
  for (const file of reviewFiles) {
    if (!existsSync(file.path) || readFileSync(file.path, "utf8") !== file.content) {
      throw new Error(`Reviewed artifact does not match plan: ${file.path}`)
    }
  }
  const builderPrefix = safeBuilderPrefix(name)
  const expectedBuilders = new Set(reviewFiles.slice(1).map(({path}) => basename(path)))
  const extraBuilder = readdirSync(outputRoot).find(
    (fileName) =>
      fileName.startsWith(`${builderPrefix}-`) &&
      /^\d+\.json$/.test(fileName.slice(builderPrefix.length + 1)) &&
      !expectedBuilders.has(fileName)
  )
  if (extraBuilder) throw new Error(`Unexpected reviewed artifact for plan: ${resolve(outputRoot, extraBuilder)}`)
}

function readRunPlans(outputRoot: string, deploymentId: string, chainId: number): Map<string, DeploymentPlan> {
  const plans = new Map<string, DeploymentPlan>()
  for (const fileName of readdirSync(outputRoot).filter((entry) => reviewPlanName(entry) !== null)) {
    const plan = readDeploymentPlan(resolve(outputRoot, fileName), deploymentId, chainId)
    plans.set(plan.planHash, plan)
  }
  return plans
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
    ? resolve(repositoryRoot, "runs", deploymentId, resumeRunId, "plan.json")
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

  let deployment = loadDeploymentRegistry(deploymentId)
  const reviewedPlan = reviewedPlanPath
    ? readDeploymentPlan(reviewedPlanPath, deploymentId, deployment.chainId)
    : undefined
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
    onProgress: logProgress,
    deployerAddress: proposerAddress,
    ...(reviewedPlan
      ? {
          allowRemovals: reviewedPlan.shop.limits.allowRemovals,
          maxChangedItems: reviewedPlan.shop.limits.maxChangedItems,
          maxRemovals: reviewedPlan.shop.limits.maxRemovals,
          maxAggregatePriceChange: BigInt(reviewedPlan.shop.limits.maxAggregatePriceChange),
          maxSafeOperations: reviewedPlan.execution.safeBatchLimits.maxOperations,
          maxSafeGas: BigInt(reviewedPlan.execution.safeBatchLimits.maxGas),
          reusableCandidates: Object.fromEntries(
            [...reviewedPlan.upgrades.candidates, ...(reviewedPlan.pendingCandidates ?? [])]
              .filter(({status}) => status === "reused")
              .map(({contractName, candidateAddress, nonce}) => [contractName, {candidateAddress, nonce}])
          ),
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
  logProgress(
    `Starting deployment sync for ${deploymentId} (${apply ? "apply" : resumeRunId ? "resume" : "plan"} mode)`
  )
  const provider = new JsonRpcProvider(rpcUrl, deployment.chainId, {staticNetwork: true})
  const refreshRegistry = (): number => {
    logProgress("Refreshing tracked reinitializer versions from chain state")
    const refreshed = refreshDeploymentRegistry(rpcUrl, deploymentId)
    deployment = refreshed.deployment
    if (refreshed.updatedContracts.length === 0) {
      logProgress(`Deployment registry is current at block ${refreshed.observationBlock.number}`)
    } else {
      logProgress(
        `Updated deployment registry at block ${refreshed.observationBlock.number}: ${refreshed.updatedContracts.join(
          ", "
        )}`
      )
    }
    return refreshed.observationBlock.number
  }
  const refreshedBlock = refreshRegistry()
  let planDeployment = deployment
  let planBlock = refreshedBlock
  const requestedPlanBlock = reviewedPlan?.observationBlock.number ?? block
  if (requestedPlanBlock !== undefined) {
    logProgress(`Reading registry state at requested block ${requestedPlanBlock}`)
    const requestedState = observeDeploymentRegistry(rpcUrl, deploymentId, requestedPlanBlock)
    planDeployment = requestedState.deployment
    planBlock = requestedState.observationBlock.number
  }
  logProgress("Building contracts with Forge")
  const build = spawnSync("forge", ["build", "--quiet", "contracts"], {
    cwd: repositoryRoot,
    stdio: "inherit",
  })
  if (build.error) throw build.error
  if (build.status !== 0) throw new Error(`forge build failed with status ${build.status}`)
  logProgress("Forge build completed")
  logProgress("Building deployment plan from repository artifacts and on-chain state")
  const builtPlan = await buildDeploymentPlan(provider, planDeployment, planBlock, planOptions)
  const plan = reviewedPlan?.pendingOperationIds?.length
    ? buildRemainderPlan(builtPlan, new Set(reviewedPlan.pendingOperationIds))
    : builtPlan
  await simulate(plan, rpcUrl, planDeployment)
  const simulation = plan.simulation
  if (!simulation) throw new Error("Plan simulation did not produce a result")
  if (reviewedPlan && plan.planHash !== reviewedPlan.planHash)
    throw new Error(`Reviewed plan ${reviewedPlan.planHash} does not match current repository inputs ${plan.planHash}`)
  const requestedOutput = option("--output")
  const outputRoot = reviewedPlanPath
    ? resolve(dirname(reviewedPlanPath))
    : requestedOutput
    ? resolve(requestedOutput)
    : resolve(
        repositoryRoot,
        "runs",
        deploymentId,
        `${plan.observationBlock.number}-${plan.observationBlock.hash.slice(2, 10)}`
      )
  const batches = safeBatchesForPlan(plan)
  if (!reviewedPlan) {
    logProgress(`Writing review artifacts to ${outputRoot}`)
    const {jsonPath, markdownPath} = writePlanFiles(outputRoot, "plan", plan, batches)
    console.log(`Wrote ${jsonPath}`)
    console.log(`Wrote ${markdownPath}`)
  } else {
    assertDerivedReviewFiles(outputRoot, reviewedPlanName(reviewedPlanPath!), plan, batches)
  }

  console.log(
    `Plan ${plan.planHash}: ${plan.summary.errors} errors, ${plan.summary.warnings} warnings, ${plan.operations.length} operations, simulation ${simulation.status}`
  )
  console.log(renderFindings(plan.findings))

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
    const journals = readdirSync(outputRoot)
      .filter((name) => /^safe-proposal-.*\.json$/.test(name))
      .map((name) => ({path: resolve(outputRoot, name), journal: readSafeJournal(resolve(outputRoot, name))}))
    const relevantOperationIds = new Set([
      ...plan.pendingOperationIds,
      ...plan.operations.map(({id}) => id),
      ...journals.flatMap(({journal}) => journal.operationIds),
    ])
    const runPlans = readRunPlans(outputRoot, deploymentId, deployment.chainId)
    const protocol = await Safe.init({provider: rpcUrl, safeAddress: getAddress(deployment.authority.address)})
    logProgress(`Refreshing ${journals.length} Safe proposal journal(s)`)
    const unjournaledOperationIds: string[] = []
    for (const entry of journals) {
      const {journal} = entry
      const journalPlan = runPlans.get(journal.planHash)
      if (journalPlan) {
        const expectedBatch = safeBatchesForPlan(journalPlan).find(({index}) => index === journal.batchIndex)
        if (!expectedBatch) throw new Error(`Reviewed Safe batch not found for proposal journal ${entry.path}`)
        await assertSafeJournalMatchesBatch(protocol, journal, {
          deploymentId,
          planHash: journalPlan.planHash,
          safeAddress: deployment.authority.address,
          batch: expectedBatch,
        })
      } else {
        const legacyName = /^safe-proposal-(?:([0-9a-f]{8})-)?(\d+)\.json$/.exec(basename(entry.path))
        if (
          !legacyName ||
          (legacyName[1] !== undefined && legacyName[1] !== journal.planHash.slice(2, 10)) ||
          Number(legacyName[2]) !== journal.batchIndex + 1 ||
          journal.deploymentId !== deploymentId ||
          getAddress(journal.safeAddress) !== getAddress(deployment.authority.address)
        ) {
          throw new Error(`Reviewed plan not found for Safe proposal journal ${entry.path}`)
        }
        await assertSafeJournalSelfConsistent(protocol, journal)
        console.log(`Safe batch ${journal.batchIndex + 1}: using legacy self-contained journal evidence`)
      }
      logProgress(`Refreshing Safe batch ${journal.batchIndex + 1}`)
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
    const journaledOperationIds = new Set(journals.flatMap(({journal}) => journal.operationIds))
    for (const batch of batches) {
      const missingOperationIds = batch.operationIds.filter((id) => !journaledOperationIds.has(id))
      if (missingOperationIds.length !== 0) {
        unjournaledOperationIds.push(...missingOperationIds)
        console.log(`Safe batch ${batch.index + 1}: unproposed (no journal)`)
      }
    }
    const pendingOperationIds = new Set(
      journals.filter(({journal}) => journal.status === "pending").flatMap(({journal}) => journal.operationIds)
    )
    const reusableCandidates = Object.fromEntries(
      [...plan.upgrades.candidates, ...plan.pendingCandidates].map(({contractName, candidateAddress, nonce}) => [
        contractName,
        {candidateAddress, nonce},
      ])
    )
    logProgress("Rebuilding the plan from current chain state")
    const currentBlock = refreshRegistry()
    const currentStatePlan = await buildDeploymentPlan(provider, deployment, currentBlock, {
      ...planOptions,
      reusableCandidates,
    })
    const remainderPlan = buildRemainderPlan(currentStatePlan, pendingOperationIds)
    await simulate(remainderPlan, rpcUrl, deployment)
    const remainderName = remainderPlanName(remainderPlan)
    const remainderBatches = safeBatchesForPlan(remainderPlan)
    const remainderPaths = writePlanFiles(outputRoot, remainderName, remainderPlan, remainderBatches)
    console.log(`Wrote ${remainderPaths.jsonPath}`)
    console.log(`Wrote ${remainderPaths.markdownPath}`)
    const remainingOperationIds = remainderPlan.operations.map(({id}) => id)
    const unproposedOperationIds = new Set([...unjournaledOperationIds, ...remainingOperationIds])
    console.log(
      `Resume result: ${pendingOperationIds.size} pending operations, ${unproposedOperationIds.size} unproposed remaining operations`
    )
    const allReviewedOperationsExecuted = allSafeOperationsExecuted(
      journals.map(({journal}) => journal),
      relevantOperationIds
    )
    if (allReviewedOperationsExecuted) {
      if (
        remainderPlan.pendingOperationIds.length !== 0 ||
        remainderPlan.summary.errors !== 0 ||
        remainderPlan.operations.length !== 0 ||
        remainderPlan.upgrades.candidates.length !== 0 ||
        remainderPlan.pendingCandidates.length !== 0
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

  logProgress("Checking reviewed plan age and existing candidate code")
  const latestBlock = await provider.getBlockNumber()
  const maxPlanAgeBlocks = integerOption("--max-plan-age-blocks", 3_600)
  if (latestBlock - plan.observationBlock.number > maxPlanAgeBlocks)
    throw new Error(
      `Reviewed plan is ${latestBlock - plan.observationBlock.number} blocks old; maximum is ${maxPlanAgeBlocks}`
    )

  const reusableCandidates = Object.fromEntries(
    (
      await Promise.all(
        plan.upgrades.candidates.map(async ({contractName, candidateAddress, nonce}) =>
          (await provider.getCode(candidateAddress)) === "0x"
            ? null
            : ([contractName, {candidateAddress, nonce}] as const)
        )
      )
    ).filter(
      (
        candidate
      ): candidate is readonly [
        (typeof plan.upgrades.candidates)[number]["contractName"],
        {candidateAddress: string; nonce: number}
      ] => candidate !== null
    )
  )
  logProgress("Rebuilding the plan to check for chain-state changes since review")
  const currentBlock = refreshRegistry()
  const builtCurrentPlan = await buildDeploymentPlan(provider, deployment, currentBlock, {
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

  if (batches.length !== 0) {
    logProgress("Checking Safe proposal sender permissions")
    const api = createSafeApi(deployment.chainId, process.env.SAFE_API_KEY!)
    await assertSafeProposalSender(api, deployment.authority.address, proposerAddress, currentPlan.authority.owners)
  }

  if (plan.upgrades.candidates.length !== 0) {
    logProgress(`Deploying ${plan.upgrades.candidates.length} upgrade candidate(s)`)
    const deployer = new Wallet(proposerPrivateKey!, provider)
    await deployUpgradeCandidates(
      provider,
      rpcUrl,
      deployer,
      deployment,
      plan.planHash,
      plan.upgrades.candidates,
      outputRoot,
      logProgress
    )
  }

  if (batches.length === 0) {
    console.log("Candidate code deployed without an authority operation; deployment remains pending")
    process.exitCode = 2
    return
  }

  logProgress("Initializing Safe protocol and API clients")
  const clients = await createSafeClients(
    deployment.chainId,
    rpcUrl,
    deployment.authority.address,
    process.env.SAFE_API_KEY!,
    proposerPrivateKey!
  )
  logProgress(`Safe clients initialized; preparing ${batches.length} batch(es)`)
  let nextNonce = Number(await clients.api.getNextNonce(deployment.authority.address))
  for (const batch of batches) {
    logProgress(`Preparing Safe batch ${batch.index + 1}/${batches.length}`)
    const journalPath = resolve(outputRoot, `safe-proposal-${plan.planHash.slice(2, 10)}-${batch.index + 1}.json`)
    let nonce = nextNonce
    if (existsSync(journalPath)) {
      const existing = readSafeJournal(journalPath)
      nonce = existing.nonce
      nextNonce = Math.max(nextNonce, nonce + 1)
      await assertSafeJournalMatchesBatch(clients.protocol, existing, {
        deploymentId,
        planHash: plan.planHash,
        safeAddress: plan.authority.address,
        batch,
      })
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
    logProgress(`Submitting Safe batch ${batch.index + 1}/${batches.length} at nonce ${nonce}`)
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
  logProgress("Deployment sync completed")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
