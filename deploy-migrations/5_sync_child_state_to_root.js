const ethUtils = require('ethereumjs-util')
const utils = require('./utils')

const Registry = artifacts.require('Registry')
const Governance = artifacts.require('Governance')
const StateSender = artifacts.require('StateSender')
const DepositManager = artifacts.require('DepositManager')

module.exports = async function(deployer, network, accounts) {
  deployer.then(async() => {
    const rootAddreses = utils.getContractAddresses('root')
    const childAddreses = utils.getContractAddresses('child')
    const registry = await Registry.at(rootAddreses.Registry)
    const governance = await Governance.at(rootAddreses.GovernanceProxy)
    const tasks = []

    tasks.push(governance.update(
      rootAddreses.Registry,
      registry.contract.methods.mapToken(
        rootAddreses.MaticWeth,
        childAddreses.MaticWeth,
        false /* isERC721 */
      ).encodeABI()
    ))
    await delay(5)

    tasks.push(governance.update(
      rootAddreses.Registry,
      registry.contract.methods.mapToken(
        rootAddreses.MaticToken,
        childAddreses.MaticToken,
        false /* isERC721 */
      ).encodeABI()
    ))
    await delay(5)

    tasks.push(governance.update(
      rootAddreses.Registry,
      registry.contract.methods.mapToken(
        rootAddreses.TestToken,
        childAddreses.TestToken,
        false /* isERC721 */
      ).encodeABI()
    ))
    await delay(5)

    tasks.push(governance.update(
      rootAddreses.Registry,
      registry.contract.methods.mapToken(
        rootAddreses.RootERC721,
        childAddreses.RootERC721,
        true /* isERC721 */
      ).encodeABI()
    ))
    await delay(5)

    tasks.push(governance.update(
      rootAddreses.Registry,
      registry.contract.methods.updateContractMap(
        ethUtils.keccak256('childChain'),
        childAddreses.ChildChain
      ).encodeABI()
    ))
    await Promise.all(tasks)

    await (await StateSender.at(rootAddreses.StateSender)).register(rootAddreses.DepositManagerProxy, childAddreses.ChildChain)
    let depositManager = await DepositManager.at(rootAddreses.DepositManagerProxy)
    await depositManager.updateChildChainAndStateSender()
  })
}

function delay(s) {
  return new Promise(resolve => setTimeout(resolve, s * 1000));
}
