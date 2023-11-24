const utils = require('./utils')

const SafeMath = artifacts.require(
  'openzeppelin-solidity/contracts/math/SafeMath.sol'
)
const ChildChain = artifacts.require('ChildChain')

const ChildERC20Proxified = artifacts.require('ChildERC20Proxified')
const ChildERC721Proxified = artifacts.require('ChildERC721Proxified')
const ChildTokenProxy = artifacts.require('ChildTokenProxy')

const MRC20 = artifacts.require('MRC20')

module.exports = async function(deployer, _, _) {
  if (deployer.network !== 'bor') {
    return
  }

  deployer.then(async() => {
    await deployer.deploy(SafeMath)
    await deployer.link(SafeMath, [ChildChain])
    await deployer.deploy(ChildChain)

    const childChain = await ChildChain.deployed()
    const contractAddresses = utils.getContractAddresses()

    // Deploy MaticWeth (ERC20) child contract and its proxy.
    // Initialize the contract, update the child chain and map the token with its root contract.
    const childMaticWethProxified = await ChildERC20Proxified.new()
    console.log('childMaticWethProxified deployed')
    const childMaticWethProxy = await ChildTokenProxy.new(childMaticWethProxified.address)
    console.log('childMaticWethProxy deployed')
    const childMaticWeth = await ChildERC20Proxified.at(childMaticWethProxy.address)

    await childMaticWeth.initialize(contractAddresses.root.tokens.MaticWeth, 'Eth on Matic', 'ETH', 18)
    console.log('childMaticWeth initialized')
    await childMaticWeth.changeChildChain(childChain.address)
    console.log('childMaticWeth child chain updated')
    await childChain.mapToken(contractAddresses.root.tokens.MaticWeth, childMaticWeth.address, false)
    console.log('root and child maticWeth mapped')

    // Same thing for TestToken (ERC20).
    const childTestTokenProxified = await ChildERC20Proxified.new()
    console.log('childTestTokenProxified deployed')
    const childTestTokenProxy = await ChildTokenProxy.new(childTestTokenProxified.address)
    console.log('childTestTokenProxy deployed')
    const childTestToken = await ChildERC20Proxified.at(childTestTokenProxy.address)

    await childTestToken.initialize(contractAddresses.root.tokens.TestToken, 'Test Token', 'TST', 18)
    console.log('childTestToken initialized')
    await childTestToken.changeChildChain(childChain.address)
    console.log('childTestToken child chain updated')
    await childChain.mapToken(contractAddresses.root.tokens.TestToken, childTestToken.address, false)
    console.log('root and child testToken mapped')

    // Same thing for TestERC721.
    const childTestERC721Proxified = await ChildERC721Proxified.new()
    console.log('childTestERC721Proxified deployed')
    const childTestERC721Proxy = await ChildTokenProxy.new(childTestERC721Proxified.address)
    console.log('childTestERC721Proxy deployed')
    const childTestERC721 = await ChildERC721Proxified.at(childTestERC721Proxy.address)

    await childTestERC721.initialize(contractAddresses.root.tokens.RootERC721, 'Test ERC721', 'TST721')
    console.log('childTestERC721 initialized')
    await childTestERC721.changeChildChain(childChain.address)
    console.log('childTestERC721 child chain updated')
    await childChain.mapToken(contractAddresses.root.tokens.RootERC721, childTestERC721.address, true) // ERC721
    console.log('root and child testERC721 mapped')

    // Initialize and map MaticToken.
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
        MaticWeth: childMaticWeth.address,
        MaticToken: '0x0000000000000000000000000000000000001010',
        TestToken: childTestToken.address,
        RootERC721: childTestERC721.address
      }
    }
    utils.writeContractAddresses(contractAddresses)
  })
}
