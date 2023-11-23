const utils = require('./utils')

const SafeMath = artifacts.require(
  'openzeppelin-solidity/contracts/math/SafeMath.sol'
)
const ChildChain = artifacts.require('ChildChain')
const MRC20 = artifacts.require('MRC20')

const ChildERC20Proxified = artifacts.require('ChildERC20Proxified')
const ChildERC721Proxified = artifacts.require('ChildERC721Proxified')
const ChildTokenProxy = artifacts.require('ChildTokenProxy')

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

    // Deploy MaticWeth (ERC20) child contract and its proxy.
    // Initialize the contract, update the child chain and map the token with its root contract.
    const childMaticWethProxified = await deployer.deploy(ChildERC20Proxified)
    const childMaticWethProxy = await deployer.deploy(ChildTokenProxy, childMaticWethProxified.address)
    const childMaticWeth = await ChildERC20Proxified.at(childMaticWethProxy.address)
    await childMaticWeth.initialize(contractAddresses.root.tokens.MaticWeth, 'Eth on Matic', 'ETH', 18)
    await childMaticWeth.changeChildChain(childChain.address)
    await childChain.mapToken(contractAddresses.root.tokens.MaticWeth, childMaticWeth.address, false)


    // Same thing for TestToken (ERC20).
    const childTestTokenProxified = await deployer.deploy(ChildERC20Proxified)
    const childTestTokenProxy = await deployer.deploy(ChildTokenProxy, childTestTokenProxified.address)
    const childTestToken = await ChildERC20Proxified.at(childTestTokenProxy.address)
    await childTestToken.initialize(contractAddresses.root.tokens.TestToken, 'Test Token', 'TST', 18)
    await childTestToken.changeChildChain(childChain.address)
    await childChain.mapToken(contractAddresses.root.tokens.TestToken, childTestToken.address, false)

    // Same thing for TestERC721.
    const childTestERC721Proxified = await deployer.deploy(ChildERC721Proxified)
    const childTestERC721Proxy = await deployer.deploy(ChildTokenProxy, childTestERC721Proxified.address)
    const childTestERC721 = await ChildERC721Proxified.at(childTestERC721Proxy.address)
    await childTestERC721.initialize(contractAddresses.root.tokens.TestToken, 'Test ERC721', 'TST721', 0)
    await childTestERC721.changeChildChain(childChain.address)
    await childChain.mapToken(contractAddresses.root.tokens.RootERC721, childTestERC721.address, true) // ERC721

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
