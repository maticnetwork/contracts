const utils = require('./utils')

const SafeMath = artifacts.require(
  'openzeppelin-solidity/contracts/math/SafeMath.sol'
)
const ChildChain = artifacts.require('ChildChain')

module.exports = async function(deployer, network, accounts) {
  deployer.then(async() => {
    await deployer.deploy(SafeMath)
    await deployer.link(SafeMath, [ChildChain])
    await deployer.deploy(ChildChain)

    const childChain = await ChildChain.deployed()
    const contractAddresses = utils.getContractAddresses()

    let MaticWeth = await childChain.addToken(
      accounts[0],
      contractAddresses.root.tokens.MaticWeth,
      'Matic WETH',
      'MTX',
      18,
      false // _isERC721
    )

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
        MaticWeth: MaticWeth.logs.find(log => log.event === 'NewToken').args.token,
        TestToken: TestToken.logs.find(log => log.event === 'NewToken').args.token
      }
    }
    utils.writeContractAddresses(contractAddresses)
  })
}
