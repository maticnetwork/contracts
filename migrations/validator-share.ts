import { ReleaseRegistry, cc, printGovernanceUpdateCommand } from '../lib'

import { ValidatorShareContract, RegistryContract } from '../typechain'

import '@nomiclabs/hardhat-truffle5'
import { Artifacts } from 'hardhat/types'

export async function deploy(artifacts: Artifacts, network: string, from: string) {
  // const validatorShare = artifacts.require('ValidatorShare') as ValidatorShareContract
  // const instance = await validatorShare.new({ from })
  // const deployedAddress = instance.address
  const deployedAddress = '0x33a02E6cC863D393d6Bf231B697b82F6e499cA71'

  cc.logLn()
  await cc.intendGroup(async() => {
    cc.logLn(`Deployed ValidatorShare at ${deployedAddress}`)

    // generate calldata for multisig
    const registry = new ReleaseRegistry(network)
    await registry.load()
    const registryContract = await (artifacts.require('Registry') as RegistryContract).at(registry.getAddress('Registry'))
    const calldata = registryContract.contract.methods.updateContractMap('0xf32233bced9bbd82f0754425f51b5ffaf897dacec3c8ac3384a66e38ea701ec8', deployedAddress).encodeABI()
    printGovernanceUpdateCommand(registry.getAddress('GovernanceProxy'), registry.getAddress('Registry'), calldata)
    cc.logLn()
  }, 'Deployment result:')
}
