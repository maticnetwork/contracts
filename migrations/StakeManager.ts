import { ReleaseRegistry, cc, printProxyUpdateCommand } from '../lib'

import { StakeManagerContract, RegistryContract } from '../typechain'

import '@nomiclabs/hardhat-truffle5'
import { Artifacts } from 'hardhat/types'

export async function deploy(artifacts: Artifacts, network: string, from: string) {
  const stakeManager = artifacts.require('StakeManager') as StakeManagerContract
  const instance = await stakeManager.new({ from })
  const deployedAddress = instance.address

  cc.logLn()
  await cc.intendGroup(async() => {
    cc.logLn(`Deployed StakeManager at ${deployedAddress}`)

    // generate calldata for multisig
    const registry = new ReleaseRegistry(network)
    await registry.load()
    printProxyUpdateCommand(registry.getAddress('StakeManagerProxy'), registry.getAddress('StakeManager'))
    cc.logLn()
  }, 'Deployment result:')
}
