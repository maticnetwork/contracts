const fs = require('fs')
const utils = require('./utils')

const Registry = artifacts.require('Registry')

module.exports = async function(deployer, network, accounts) {
  deployer.then(async() => {
    const registry = await Registry.deployed()

    const contractAddresses = utils.getContractAddresses()
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
  })
}
