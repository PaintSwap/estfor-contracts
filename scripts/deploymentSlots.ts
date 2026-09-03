import {getAddress} from "ethers"
import type {ContractName} from "./deploymentRegistry"

export const EIP1967_IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
export const EIP1967_BEACON_SLOT = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50"
export const INITIALIZABLE_STORAGE_SLOT = "0xf0c57e16840df040f15088dc2f81fe391c3923bec73e23a9662efc9c229c6a00"
export const UUPS_PROXIABLE_UUID = EIP1967_IMPLEMENTATION_SLOT
export const PLAYERS_IMPLEMENTATIONS = [
  {name: "playersImplQueueActions", slot: 6n},
  {name: "playersImplProcessActions", slot: 7n},
  {name: "playersImplRewards", slot: 8n},
  {name: "playersImplMisc", slot: 9n},
  {name: "playersImplMisc1", slot: 10n},
] as const satisfies readonly {name: ContractName; slot: bigint}[]

export function addressFromStorage(value: string): string {
  return getAddress(`0x${value.slice(-40)}`)
}
