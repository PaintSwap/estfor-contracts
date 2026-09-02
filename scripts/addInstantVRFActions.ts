import {ethers} from "hardhat"
import {INSTANT_VRF_ACTIONS_ADDRESS} from "./contractAddresses"
import {EstforConstants} from "@paintswap/estfor-definitions"
import {allInstantVRFActions} from "./data/instantVRFActions"
import {getSafeUpgradeTransaction, initialiseSafe, sendTransactionSetToSafe} from "./utils"
import {OperationType, MetaTransactionData} from "@safe-global/types-kit"
import {InstantVRFActions__factory} from "../typechain-types"

async function main() {
  const [owner, , proposer] = await ethers.getSigners() // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork()
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network)
  console.log(
    `Add instant vrf actions using account: ${proposer.address} on chain id ${network.chainId}, useSafe: ${useSafe}`
  )

  const instantVRFActions = await ethers.getContractAt("InstantVRFActions", INSTANT_VRF_ACTIONS_ADDRESS)

  const actionsToUpdate = new Set([
    EstforConstants.INSTANT_VRF_ACTION_ANNIV3_EGG_TIER1,
    EstforConstants.INSTANT_VRF_ACTION_ANNIV3_EGG_TIER2,
    EstforConstants.INSTANT_VRF_ACTION_ANNIV3_EGG_TIER3,
    EstforConstants.INSTANT_VRF_ACTION_ANNIV3_EGG_TIER4,
    EstforConstants.INSTANT_VRF_ACTION_ANNIV3_EGG_TIER5,
    EstforConstants.INSTANT_VRF_ACTION_FORGING_ANNIV3_POUCH,
  ])

  const actions = allInstantVRFActions.filter((action) => actionsToUpdate.has(action.actionId))
  if (actions.length !== actionsToUpdate.size) {
    console.log("Cannot find actions")
  } else {
    if (useSafe) {
      const transactionSet: MetaTransactionData[] = []
      const iface = InstantVRFActions__factory.createInterface()

      transactionSet.push({
        to: ethers.getAddress(INSTANT_VRF_ACTIONS_ADDRESS),
        value: "0",
        data: iface.encodeFunctionData("addActions", [actions]),
        operation: OperationType.Call,
      })
      await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer)
    } else {
      await instantVRFActions.addActions(actions)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
