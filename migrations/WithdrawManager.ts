import { deployProxyImplementation } from '../lib'
import { Artifacts } from 'hardhat/types'

export async function deploy(artifacts: Artifacts, network: string, from: string) {
  return deployProxyImplementation(artifacts, 'WithdrawManager', network, from)
}
