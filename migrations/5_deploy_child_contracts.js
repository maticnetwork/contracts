const utils = require('./utils')

const SafeMath = artifacts.require(
  'openzeppelin-solidity/contracts/math/SafeMath.sol'
)
const ChildChain = artifacts.require('ChildChain')
const MRC20 = artifacts.require('MRC20')
const ChildERC20 = artifacts.require('ChildERC20')
const ChildERC721 = artifacts.require('ChildERC721')

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

    const maticWethTx = await childChain.addToken(
      accounts[0],
      contractAddresses.root.tokens.MaticWeth,
      'ETH on Matic',
      'ETH',
      18,
      false // _isERC721
    )
    const maticWethAddress = maticWethTx.logs.find(log => log.event === 'NewToken').args.token
    const maticWethContract = await ChildERC20.at(maticWethAddress)
    await maticWethContract.changeChildChain(childChain.address, {from: accounts[0]})

    const testERC20Tx = await childChain.addToken(
      accounts[0],
      contractAddresses.root.tokens.TestToken,
      'Test Token',
      'TST',
      18,
      false // _isERC721
    )
    const testERC20Address = testERC20Tx.logs.find(log => log.event === 'NewToken').args.token
    const testERC20Contract = await ChildERC20.at(testERC20Address)
    await testERC20Contract.changeChildChain(childChain.address, {from: accounts[0]})

    const testERC721Tx = await childChain.addToken(
      accounts[0],
      contractAddresses.root.tokens.RootERC721,
      'Test ERC721',
      'TST721',
      0,
      true // _isERC721
    )
    const testERC721Address = testERC721Tx.logs.find(log => log.event === 'NewToken').args.token
    const testERC721Contract = await ChildERC721.at(maticWethAddress)
    await testERC721Contract.changeChildChain(childChain.address, {from: accounts[0]})

    const maticToken = await MRC20.at('0x0000000000000000000000000000000000001010')
    const maticOwner = await maticToken.owner()
    if (maticOwner === '0x0000000000000000000000000000000000000000') {
      // matic contract at 0x1010 can only be initialized once, after the bor image starts to run
      await maticToken.initialize(ChildChain.address, contractAddresses.root.tokens.MaticToken)
    }
    await childChain.mapToken(contractAddresses.root.tokens.MaticToken, '0x0000000000000000000000000000000000001010', false)

    contractAddresses.child = {
      ChildChain: childChain.address,
      tokens: {
        MaticWeth: maticWethAddress,
        MaticToken: '0x0000000000000000000000000000000000001010',
        TestToken: testERC20Address,
        RootERC721: testERC721Address
      }
    }
    utils.writeContractAddresses(contractAddresses)
  })
}
