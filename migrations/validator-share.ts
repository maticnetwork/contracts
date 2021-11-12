import { ReleaseRegistry, cc } from '../lib'
import chalk from 'chalk'
import { ValidatorShareContract, RegistryContract } from '../typechain'

import '@nomiclabs/hardhat-truffle5'
import { Artifacts } from 'hardhat/types'

export async function deploy(artifacts: Artifacts, network: string, from: string) {
  const validatorShare = artifacts.require('ValidatorShare') as ValidatorShareContract
  const instance = await validatorShare.new({ from })
  const deployedAddress = instance.address

  cc.logLn()
  await cc.intendGroup(async() => {
    cc.logLn(`Deployed ValidatorShare at ${chalk.underline(deployedAddress)}`)

    // generate calldata for multisig
    const registry = new ReleaseRegistry(network)
    await registry.load()
    const registryContract = await (artifacts.require('Registry') as RegistryContract).at(registry.getAddress('Registry'))
    const calldata = registryContract.contract.methods.updateContractMap('0xf32233bced9bbd82f0754425f51b5ffaf897dacec3c8ac3384a66e38ea701ec8', deployedAddress).encodeABI()

    cc.log(`Calldata for Registry.updateContractMap(keccak256('ValidatorShare'), '${deployedAddress}')`)

    await cc.intendGroup(async() => cc.log(chalk.underline(calldata)))

    cc.logLn()
  }, 'Deployment result:')
}
