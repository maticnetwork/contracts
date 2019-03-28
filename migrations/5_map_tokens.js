const fs = require('fs')
//
// Main contracts
//
const RootChain = artifacts.require('./RootChain.sol')

module.exports = async function(deployer, network) {
  console.log(`${network} : network`)
  deployer.then(async() => {
    const rootChain = await RootChain.deployed()

    let contractAddresses = fs.readFileSync('./build/contractAddresses.json').toString()
    contractAddresses = JSON.parse(contractAddresses)

    await rootChain.mapToken(contractAddresses.RootToken, contractAddresses.ChildToken, false /* _isERC721 */)
  })
}
