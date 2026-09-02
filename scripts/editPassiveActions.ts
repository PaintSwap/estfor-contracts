import {ethers} from "hardhat"
import {PASSIVE_ACTIONS_ADDRESS} from "./contractAddresses"
import {allPassiveActions} from "./data/passiveActions"
import {EstforConstants} from "@paintswap/estfor-definitions"
import {getSafeUpgradeTransaction, initialiseSafe, sendTransactionSetToSafe} from "./utils"
import {OperationType, MetaTransactionData} from "@safe-global/types-kit"
import {PassiveActions__factory} from "../typechain-types"

async function main() {
  const [owner, , proposer] = await ethers.getSigners() // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork()
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network)
  console.log(
    `Edit passive actions using account: ${proposer.address} on chain id ${network.chainId}, useSafe: ${useSafe}`
  )

  const passiveActions = await ethers.getContractAt("PassiveActions", PASSIVE_ACTIONS_ADDRESS)

  const actionsToReduce = [
    EstforConstants.PASSIVE_ACTION_ANNIV3_EGG_TIER2,
    EstforConstants.PASSIVE_ACTION_ANNIV3_EGG_TIER3,
    EstforConstants.PASSIVE_ACTION_ANNIV3_EGG_TIER4,
    EstforConstants.PASSIVE_ACTION_ANNIV3_EGG_TIER5,
  ]

  const values = [0, 0, 0, 0]
  const map = new Map()
  actionsToReduce.forEach((key, index) => {
    map.set(key, values[index])
  })

  const actions = allPassiveActions.filter((action) => map.has(action.actionId))

  const useValueArray = false // isBeta;

  const actionsToEdit = useValueArray
    ? actions.map((passiveAction) => {
        const actionId = passiveAction.actionId

        let durationDays = map.has(actionId) ? map.get(actionId) : passiveAction.info.durationDays
        return {
          ...passiveAction,
          info: {
            ...passiveAction.info,
            durationDays,
          },
        }
      })
    : actions

  if (actionsToEdit.length !== actionsToReduce.length) {
    console.log("Cannot find actions")
  } else {
    if (useSafe) {
      const transactionSet: MetaTransactionData[] = []
      const iface = PassiveActions__factory.createInterface()

      transactionSet.push({
        to: ethers.getAddress(PASSIVE_ACTIONS_ADDRESS),
        value: "0",
        data: iface.encodeFunctionData("editActions", [actions]),
        operation: OperationType.Call,
      })
      await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer)
    } else {
      await passiveActions.editActions(actionsToEdit)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
