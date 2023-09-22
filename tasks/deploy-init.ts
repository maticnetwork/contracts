import { task } from 'hardhat/config'
import { TASKS } from './task-names'
import ethUtils from 'ethereumjs-util'

task(TASKS.DEPLOY_INIT, 'initialize root and child chains')
  .addParam('maticRoot', 'Matic token address on the root network')
  .addParam('maticChild', 'Matic token address on the child network')
  .addParam('registry', 'Reistry address on the root network')
  .addParam('governance', 'GovernanceProxy address on the root network')
  .addParam('childChain', 'ChildChain address on the child network')
  .addParam('depositManager', 'DepositManagerProxy address on the root network')
  .addParam('stateSender', 'StateSender address on the root network')
  .setAction(async function({ registry, governance, maticRoot, maticChild, stateSender, depositManager, childChain }, { artifacts, network, web3 }) {
    const Registry = artifacts.require('Registry')
    const Governance = artifacts.require('Governance')
    const DepositManager = artifacts.require('DepositManager')
    const StateSender = artifacts.require('StateSender')

    console.log(`Initializing contracts on ${network.name}...`)

    const registryInstance = await Registry.at(registry)
    const governanceInstance = await Governance.at(governance)

    await governanceInstance.update(
      registry,
      registryInstance.contract.methods.mapToken(maticRoot, maticChild, false).encodeABI()
    )

    await governanceInstance.update(
      registry,
      registryInstance.contract.methods.updateContractMap(
        ethUtils.keccak256('childChain'),
        childChain
      ).encodeABI()
    )

    const stateSenderContract = await StateSender.at(stateSender)
    await stateSenderContract.register(depositManager, childChain)

    const depositManagerInstance = await DepositManager.at(depositManager)
    await depositManagerInstance.updateChildChainAndStateSender()
  })
