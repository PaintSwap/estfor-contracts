import {ethers} from "hardhat"
import {GAME_SUBSIDISATION_REGISTRY_ADDRESS, GLOBAL_EVENT_ADDRESS} from "./contractAddresses"
import {EstforConstants} from "@paintswap/estfor-definitions"
import {getSafeUpgradeTransaction, initialiseSafe, isBeta, sendTransactionSetToSafe} from "./utils"
import {OperationType, MetaTransactionData} from "@safe-global/types-kit"
import {GameSubsidisationRegistry__factory} from "../typechain-types"
import {groups} from "./data/groupSubsidyLimits"

async function main() {
  const [owner, , proposer] = await ethers.getSigners() // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork()
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network)
  console.log(
    `Set game subsidy limits using account: ${proposer.address} on chain id ${network.chainId}, useSafe: ${useSafe}`
  )

  if (useSafe) {
    const transactionSet: MetaTransactionData[] = []
    const iface = GameSubsidisationRegistry__factory.createInterface()

    const contractAddresses = groups.flatMap((g) => g.selectors.map((s) => s.contract))
    const selectors = groups.flatMap((g) => g.selectors.map((s) => s.selector))
    const groupIds = groups.flatMap((g) => g.selectors.map((s) => s.groupId))

    const limitGroupIds = groups.map((g) => g.groupId)
    const limits = groups.map((g) => g.limit * (isBeta ? 10 : 1)) // In beta we set higher limits to allow more testing, will be reduced to intended limits for mainnet launch

    transactionSet.push({
      to: GAME_SUBSIDISATION_REGISTRY_ADDRESS,
      value: "0",
      data: iface.encodeFunctionData("setFunctionGroups", [contractAddresses, selectors, groupIds]),
      operation: OperationType.Call,
    })
    transactionSet.push({
      to: GAME_SUBSIDISATION_REGISTRY_ADDRESS,
      value: "0",
      data: iface.encodeFunctionData("setGroupLimits", [limitGroupIds, limits]),
      operation: OperationType.Call,
    })
    await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
