const utils = require('./utils')

const SafeMath = artifacts.require(
  'openzeppelin-solidity/contracts/math/SafeMath.sol'
)
const ChildChain = artifacts.require('ChildChain')
const MRC20 = artifacts.require('MRC20')

module.exports = async function(deployer, network, accounts) {
  if (deployer.network !== 'bor') {
    return
  }

  deployer.then(async() => {
    await deployer.deploy(SafeMath)
    await deployer.link(SafeMath, [ChildChain])
    await deployer.deploy(ChildChain)

    const childChain = await ChildChain.deployed()
    const contractAddresses = utils.getContractAddresses()

    let MaticWeth = await childChain.addToken(
      accounts[0],
      contractAddresses.root.tokens.MaticWeth,
      'ETH on Matic',
      'ETH',
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

    let RootERC721 = await childChain.addToken(
      accounts[0],
      contractAddresses.root.tokens.RootERC721,
      'Test ERC721',
      'TST721',
      0,
      true // _isERC721
    )

    const maticToken = await MRC20.at('0x0000000000000000000000000000000000001010')
    const maticOwner = await maticToken.owner()
    if (maticOwner === '0x0000000000000000000000000000000000000000') {
      // matic contract at 0x1010 can only be initialized once, after the bor image starts to run
      await maticToken.initialize(ChildChain.address, contractAddresses.root.tokens.MaticToken)
    }
    await childChain.mapToken(contractAddresses.root.tokens.MaticToken, '0x0000000000000000000000000000000000001010', false)

    contractAddresses.child = {
      ChildChain: ChildChain.address,
      tokens: {
        MaticWeth: MaticWeth.logs.find(log => log.event === 'NewToken').args.token,
        MaticToken: '0x0000000000000000000000000000000000001010',
        TestToken: TestToken.logs.find(log => log.event === 'NewToken').args.token,
        RootERC721: RootERC721.logs.find(log => log.event === 'NewToken').args.token
      }
    }
    utils.writeContractAddresses(contractAddresses)
  })
}
