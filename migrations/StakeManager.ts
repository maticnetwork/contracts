import { deployProxyImplementation } from '../lib'
import '@nomiclabs/hardhat-truffle5'
import { Artifacts } from 'hardhat/types'

export async function deploy(artifacts: Artifacts, network: string, from: string) {
  return deployProxyImplementation(artifacts, 'StakeManager', network, from)
}
