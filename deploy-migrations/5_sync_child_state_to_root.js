const ethUtils = require('ethereumjs-util')
const utils = require('./utils')

const Registry = artifacts.require('Registry')
const StateSender = artifacts.require('StateSender')
const DepositManager = artifacts.require('DepositManager')

module.exports = async function(deployer, network, accounts) {
  deployer.then(async() => {
    const contractAddresses = utils.getContractAddresses()
    const registry = await Registry.at(contractAddresses.root.Registry)
    await registry.mapToken(
      contractAddresses.root.tokens.MaticWeth,
      contractAddresses.child.tokens.MaticWeth,
      false /* isERC721 */
    )
    await registry.mapToken(
      contractAddresses.root.tokens.TestToken,
      contractAddresses.child.tokens.TestToken,
      false /* isERC721 */
    )
    await registry.updateContractMap(
      ethUtils.keccak256('childChain'),
      contractAddresses.child.ChildChain
    )
    await (await StateSender.at(contractAddresses.root.StateSender)).register(contractAddresses.root.DepositManagerProxy, contractAddresses.child.ChildChain)
    let depositManager = await DepositManager.at(contractAddresses.root.DepositManagerProxy)
    await depositManager.updateChildChainAndStateSender()
  })
}
