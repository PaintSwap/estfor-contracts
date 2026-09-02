import {getAddress} from "ethers"

export const EIP1967_IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
export const EIP1967_BEACON_SLOT = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50"
export const UUPS_PROXIABLE_UUID = EIP1967_IMPLEMENTATION_SLOT

export function addressFromStorage(value: string): string {
  return getAddress(`0x${value.slice(-40)}`)
}
