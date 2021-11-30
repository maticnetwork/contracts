import { deployProxyImplementation } from '../lib'
import { Artifacts } from 'hardhat/types'

export async function deploy(artifacts: Artifacts, network: string, from: string) {
  await deployProxyImplementation(artifacts, 'WithdrawManager', network, from)
}
