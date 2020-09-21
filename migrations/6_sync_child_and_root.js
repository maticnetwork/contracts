const ethUtils = require('ethereumjs-util')
const utils = require('./utils')

const Registry = artifacts.require('Registry')
const Governance = artifacts.require('Governance')
const StateSender = artifacts.require('StateSender')
const DepositManager = artifacts.require('DepositManager')

module.exports = async function(deployer) {
  deployer.then(async() => {
    const rootAddresses = utils.getContractAddresses('root')
    const childAddresses = utils.getContractAddresses('child')
    
    const governance = await Governance.at(rootAddresses.Governance)
    const registry = await Registry.at(rootAddresses.Registry)
    await governance.update(
      registry.address,
      registry.contract.methods.mapToken(
        rootAddresses.MaticWeth,
        childAddresses.MaticWeth,
        false
      ).encodeABI()
    )
    await governance.update(
      registry.address,
      registry.contract.methods.mapToken(
        rootAddresses.TestToken,
        childAddresses.TestToken,
        false
      ).encodeABI()
    )
    await governance.update(
      registry.address,
      registry.contract.methods.updateContractMap(ethUtils.keccak256('childChain'), childAddresses.ChildChain).encodeABI()
    )

    const stateSenderContract = await StateSender.at(rootAddresses.StateSender)
    await stateSenderContract.register(rootAddresses.DepositManager, childAddresses.ChildChain)

    let depositManager = await DepositManager.at(rootAddresses.DepositManager)
    await depositManager.updateChildChainAndStateSender()
  })
}
