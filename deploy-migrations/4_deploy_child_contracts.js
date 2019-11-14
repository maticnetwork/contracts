const utils = require('./utils')

const SafeMath = artifacts.require(
  'openzeppelin-solidity/contracts/math/SafeMath.sol'
)
const ChildChain = artifacts.require('ChildChain')
const ChildERC721Mintable = artifacts.require('ChildERC721Mintable')

module.exports = async function(deployer, network, accounts) {
  deployer.then(async() => {
    await deployer.deploy(SafeMath)
    await deployer.link(SafeMath, [ChildChain])
    await deployer.deploy(ChildChain)

    const childChain = await ChildChain.deployed()
    const contractAddresses = utils.getContractAddresses()

    await deployer.deploy(ChildERC721Mintable, contractAddresses.root.tokens.ChainBreakersPets)

    let TestToken = await childChain.addToken(
      accounts[0],
      contractAddresses.root.tokens.TestToken,
      'Test Token',
      'TST',
      18,
      false // _isERC721
    )

    contractAddresses.child = {
      ChildChain: ChildChain.address,
      tokens: {
        TestToken: TestToken.logs.find(log => log.event === 'NewToken').args.token,
        ChainBreakersPets: ChildERC721Mintable.address
      }
    }
    utils.writeContractAddresses(contractAddresses)
  })
}
