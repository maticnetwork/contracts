import chalk from 'chalk'
import { ReleaseRegistry, cc, GovernanceRepositoryLink } from './index'

import { StakeManagerContract } from '../typechain'

import '@nomiclabs/hardhat-truffle5'
import { Artifacts } from 'hardhat/types'

export async function printGovernanceUpdateCommand(target: string, contract: string, data: string) {
  cc.log(`Use this command in our ${GovernanceRepositoryLink} repository to generate multisig transaction data:`)

    const encodedCall = `npx hardhat encode-update-governance-data --target ${target} --contract ${contract} --data ${data}`

    await cc.intendGroup(async() => cc.log(chalk.bgBlack(chalk.yellowBright(encodedCall))))
}

export async function printProxyUpdateCommand(proxy: string, implementation: string) {
  cc.log(`Use this command in our ${GovernanceRepositoryLink} repository to generate transaction data:`)

    const encodedCall = `npx hardhat encode-update-proxy-data --proxy ${proxy} --implementation ${implementation}`

    await cc.intendGroup(async() => cc.log(chalk.bgBlack(chalk.yellowBright(encodedCall))))
}

export async function deployProxyImplementation(artifacts: Artifacts, contractName: string, network: string, from: string) {
  const stakeManager = artifacts.require(contractName) as StakeManagerContract
  const instance = await stakeManager.new({ from })
  const deployedAddress = instance.address

  const registry = new ReleaseRegistry(network)
  await registry.load()

  cc.logLn()
  await cc.intendGroup(async() => {
    cc.logLn(`Deployed ${contractName} at ${deployedAddress}`)

    // generate calldata for multisig
    printProxyUpdateCommand(registry.getAddress(`${contractName}Proxy`), registry.getAddress(contractName))
    cc.logLn()
  }, 'Deployment result:')
}
