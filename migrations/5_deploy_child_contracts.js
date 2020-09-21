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
    const rootAddresses = utils.getContractAddresses('root')

    let MaticWeth = await childChain.addToken(
      accounts[0],
      rootAddresses.MaticWeth,
      'Matic WETH',
      'MTX',
      18,
      false // _isERC721
    )

    let TestToken = await childChain.addToken(
      accounts[0],
      rootAddresses.TestToken,
      'Test Token',
      'TST',
      18,
      false // _isERC721
    )

    const childAddresses = {
      ChildChain: ChildChain.address,
      MaticWeth: MaticWeth.logs.find(log => log.event === 'NewToken').args.token,
      TestToken: TestToken.logs.find(log => log.event === 'NewToken').args.token
    }
    utils.writeContractAddresses(childAddresses, 'child')
  })
}
