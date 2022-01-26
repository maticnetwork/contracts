import { StakeManagerExtensionContract, RegistryContract, StakeManagerContract } from '../typechain'
import '@nomiclabs/hardhat-truffle5'
import { Artifacts } from 'hardhat/types'
import { cc, printGovernanceUpdateCommand, ReleaseRegistry } from 'lib'

export async function deploy(artifacts: Artifacts, network: string, from: string) {
  const stakeManagerExtension = artifacts.require('StakeManagerExtension') as StakeManagerExtensionContract
  const instance = await stakeManagerExtension.new({ from })
  const deployedAddress = instance.address

  cc.logLn()
  await cc.intendGroup(async() => {
    cc.logLn(`Deployed StakeManagerExtension at ${deployedAddress}`)

    // generate calldata for multisig
    const registry = new ReleaseRegistry(network)
    await registry.load()
    const stakeManagerContract = await (artifacts.require('StakeManager') as StakeManagerContract).at(registry.getAddress('StakeManagerProxy'))

    const nftContract = await stakeManagerContract.NFTContract()
    const logger = await stakeManagerContract.logger()
    const validatorShareFactory = await stakeManagerContract.validatorShareFactory()

    const calldata = stakeManagerContract.contract.methods.reinitialize(nftContract, logger, validatorShareFactory, deployedAddress).encodeABI()
    printGovernanceUpdateCommand(registry.getAddress('GovernanceProxy'), registry.getAddress('StakeManagerProxy'), calldata)
    cc.logLn()
  }, 'Deployment result:')

  return { address: deployedAddress }
}
