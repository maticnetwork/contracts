const ethUtils = require('ethereumjs-util')
const utils = require('./utils')

const Registry = artifacts.require('Registry')
const Governance = artifacts.require('Governance')
const StateSender = artifacts.require('StateSender')
const DepositManager = artifacts.require('DepositManager')

module.exports = async function(deployer) {
  deployer.then(async() => {
    const contractAddresses = utils.getContractAddresses()
    const governance = await Governance.at(contractAddresses.root.Governance)
    const registry = await Registry.at(contractAddresses.root.Registry)
    await governance.update(
      registry.address,
      registry.contract.methods.mapToken(
        contractAddresses.root.tokens.MaticWeth,
        contractAddresses.child.tokens.MaticWeth,
        false
      ).encodeABI()
    )
    await governance.update(
      registry.address,
      registry.contract.methods.mapToken(
        contractAddresses.root.tokens.TestToken,
        contractAddresses.child.tokens.TestToken,
        false
      ).encodeABI()
    )
    await governance.update(
      registry.address,
      registry.contract.methods.updateContractMap(ethUtils.keccak256('childChain'), contractAddresses.child.ChildChain).encodeABI()
    )

    const stateSenderContract = await StateSender.at(contractAddresses.root.StateSender)
    await stateSenderContract.register(contractAddresses.root.DepositManagerProxy, contractAddresses.child.ChildChain)
    let depositManager = await DepositManager.at(contractAddresses.root.DepositManagerProxy)
    await depositManager.updateChildChainAndStateSender()
  })
}
