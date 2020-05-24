const ethUtils = require('ethereumjs-util')
const utils = require('./utils')

const Registry = artifacts.require('Registry')
const Governance = artifacts.require('Governance')
const StateSender = artifacts.require('StateSender')
const DepositManager = artifacts.require('DepositManager')

module.exports = async function(deployer, network, accounts) {
  deployer.then(async() => {
    const contractAddresses = utils.getContractAddresses()
    const registry = await Registry.at(contractAddresses.root.Registry)
    const governance = await Governance.at(contractAddresses.root.GovernanceProxy)
    const tasks = []

    tasks.push(governance.update(
      contractAddresses.root.Registry,
      registry.contract.methods.mapToken(
        contractAddresses.root.tokens.MaticWeth,
        contractAddresses.child.tokens.MaticWeth,
        false /* isERC721 */
      ).encodeABI()
    ))
    await delay(5)

    tasks.push(governance.update(
      contractAddresses.root.Registry,
      registry.contract.methods.mapToken(
        contractAddresses.root.tokens.MaticToken,
        contractAddresses.child.tokens.MaticToken,
        false /* isERC721 */
      ).encodeABI()
    ))
    await delay(5)

    tasks.push(governance.update(
      contractAddresses.root.Registry,
      registry.contract.methods.mapToken(
        contractAddresses.root.tokens.TestToken,
        contractAddresses.child.tokens.TestToken,
        false /* isERC721 */
      ).encodeABI()
    ))
    await delay(5)

    tasks.push(governance.update(
      contractAddresses.root.Registry,
      registry.contract.methods.mapToken(
        contractAddresses.root.tokens.RootERC721,
        contractAddresses.child.tokens.RootERC721,
        true /* isERC721 */
      ).encodeABI()
    ))
    await delay(5)

    tasks.push(governance.update(
      contractAddresses.root.Registry,
      registry.contract.methods.updateContractMap(
        ethUtils.keccak256('childChain'),
        contractAddresses.child.ChildChain
      ).encodeABI()
    ))
    await Promise.all(tasks)

    await (await StateSender.at(contractAddresses.root.StateSender)).register(contractAddresses.root.DepositManagerProxy, contractAddresses.child.ChildChain)
    let depositManager = await DepositManager.at(contractAddresses.root.DepositManagerProxy)
    await depositManager.updateChildChainAndStateSender()
  })
}

function delay(s) {
  return new Promise(resolve => setTimeout(resolve, s * 1000));
}
