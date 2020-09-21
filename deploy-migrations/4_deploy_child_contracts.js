const utils = require('./utils')

const SafeMath = artifacts.require(
  'openzeppelin-solidity/contracts/math/SafeMath.sol'
)
const ChildChain = artifacts.require('ChildChain')
const MRC20 = artifacts.require('MRC20')

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
      'ETH on Matic',
      'ETH',
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

    let RootERC721 = await childChain.addToken(
      accounts[0],
      rootAddresses.RootERC721,
      'Test ERC721',
      'TST721',
      0,
      true // _isERC721
    )

    const maticToken = await MRC20.at('0x0000000000000000000000000000000000001010')
    const maticOwner = await maticToken.owner()
    if (maticOwner === '0x0000000000000000000000000000000000000000') {
      // matic contract at 0x1010 can only be initialized once, after the bor image starts to run
      await maticToken.initialize(ChildChain.address, rootAddresses.MaticToken)
    }
    await childChain.mapToken(rootAddresses.MaticToken, '0x0000000000000000000000000000000000001010', false)

    const childContractAddresses = {
      ChildChain: ChildChain.address,
      MaticWeth: MaticWeth.logs.find(log => log.event === 'NewToken').args.token,
      MaticToken: '0x0000000000000000000000000000000000001010',
      TestToken: TestToken.logs.find(log => log.event === 'NewToken').args.token,
      RootERC721: RootERC721.logs.find(log => log.event === 'NewToken').args.token
    }
    utils.writeContractAddresses(childContractAddresses, 'child')
  })
}
