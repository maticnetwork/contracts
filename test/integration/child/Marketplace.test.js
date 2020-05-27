import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../../helpers/deployer.js'
import logDecoder from '../../helpers/log-decoder.js'
import { getSig } from '../../helpers/marketplaceUtils'
import { generateFirstWallets, mnemonics } from '../../helpers/wallets.js'
const utils = require('../../helpers/utils')

chai
  .use(chaiAsPromised)
  .should()

contract('Marketplace @skip-on-coverage', async function(accounts) {
  let childContracts, marketplace
  const amount1 = web3.utils.toBN('10')
  const amount2 = web3.utils.toBN('5')
  const tokenId = web3.utils.toBN('789')
  const stakes = {
    1: web3.utils.toWei('101'),
    2: web3.utils.toWei('100'),
    3: web3.utils.toWei('100'),
    4: web3.utils.toWei('100')
  }
  const wallets = generateFirstWallets(mnemonics, Object.keys(stakes).length)
  const privateKey1 = wallets[0].getPrivateKeyString()
  const address1 = wallets[0].getAddressString()
  const privateKey2 = wallets[1].getPrivateKeyString()
  const address2 = wallets[1].getAddressString()

  before(async function() {
    marketplace = await deployer.deployMarketplace()
  })

  beforeEach(async function() {
    childContracts = await deployer.initializeChildChain(accounts[0], { updateRegistry: false })
  })

  it('executeOrder - ERC20/20', async function() {
    const erc20 = await deployer.deployChildErc20(accounts[0], { mapToken: false })
    const token1 = erc20.childToken
    const otherErc20 = await deployer.deployChildErc20(accounts[0], { mapToken: false })
    const token2 = otherErc20.childToken

    // await utils.deposit(null, childContracts.childChain, erc20.rootERC20, address1, amount1, { writeToFile: 'marketplace/erc20_20_Deposit_1.js' })
    // await utils.deposit(null, childContracts.childChain, otherErc20.rootERC20, address2, amount2, { writeToFile: 'marketplace/erc20_20_Deposit_2.js' })
    await utils.deposit(null, childContracts.childChain, erc20.rootERC20, address1, amount1)
    await utils.deposit(null, childContracts.childChain, otherErc20.rootERC20, address2, amount2)
    assert.equal((await token1.balanceOf(address1)).toNumber(), amount1)
    assert.equal((await token2.balanceOf(address2)).toNumber(), amount2)

    const orderId = '0x468fc9c005382579139846222b7b0aebc9182ba073b2455938a86d9753bfb078'
    // get expiration in future in 10 blocks
    const expiration = (await utils.web3Child.eth.getBlockNumber()) + 10

    const obj1 = getSig({
      privateKey: privateKey1,
      spender: marketplace.address,
      orderId: orderId,
      expiration: expiration,

      token1: token1.address,
      amount1: amount1,
      token2: token2.address,
      amount2: amount2
    })

    const obj2 = getSig({
      privateKey: privateKey2,
      spender: marketplace.address,
      orderId: orderId,
      expiration: expiration,

      token2: token1.address,
      amount2: amount1,
      token1: token2.address,
      amount1: amount2
    })
    const { receipt } = await marketplace.executeOrder(
      encode(token1.address, obj1.sig, amount1),
      encode(token2.address, obj2.sig, amount2),
      orderId,
      expiration,
      address2
    )
    // await utils.writeToFile('marketplace/executeOrder-E20-E20.js', receipt)
    const parsedLogs = logDecoder.decodeLogs(receipt.rawLogs)
    // console.log(parsedLogs)
    assert.equal(parsedLogs[0].event, 'Transfer')
    assert.equal(parsedLogs[1].event, 'LogTransfer')
    assert.equal(parsedLogs[2].event, 'Transfer')
    assert.equal(parsedLogs[3].event, 'LogTransfer')

    assert.equal((await token1.balanceOf(address1)).toNumber(), 0)
    assert.equal((await token2.balanceOf(address1)).toNumber(), amount2)
    assert.equal((await token1.balanceOf(address2)).toNumber(), amount1)
    assert.equal((await token2.balanceOf(address2)).toNumber(), 0)
  })

  it('executeOrder - ERC20/721', async function() {
    const erc20 = await deployer.deployChildErc20(accounts[0], { mapToken: false })
    const token1 = erc20.childToken
    const erc721 = await deployer.deployChildErc721(accounts[0], { mapToken: false })
    const token2 = erc721.childErc721

    // await utils.deposit(null, childContracts.childChain, erc20.rootERC20, address1, amount1, { writeToFile: 'marketplace/erc20_721_Deposit_1.js' })
    // await utils.deposit(null, childContracts.childChain, erc721.rootERC721, address2, tokenId, { writeToFile: 'marketplace/erc20_721_Deposit_2.js' })
    await utils.deposit(null, childContracts.childChain, erc20.rootERC20, address1, amount1)
    await utils.deposit(null, childContracts.childChain, erc721.rootERC721, address2, tokenId)
    assert.equal((await token1.balanceOf(address1)).toNumber(), amount1)
    assert.equal((await token2.ownerOf(tokenId)).toLowerCase(), address2.toLowerCase())

    const orderId = '0x468fc9c005382579139846222b7b0aebc9182ba073b2455938a86d9753bfb078'
    // get expiration in future in 10 blocks
    const expiration = (await utils.web3Child.eth.getBlockNumber()) + 10

    const obj1 = getSig({
      privateKey: privateKey1,
      spender: marketplace.address,
      orderId: orderId,
      expiration: expiration,

      token1: token1.address,
      amount1: amount1,
      token2: token2.address,
      amount2: tokenId
    })

    const obj2 = getSig({
      privateKey: privateKey2,
      spender: marketplace.address,
      orderId: orderId,
      expiration: expiration,

      token2: token1.address,
      amount2: amount1,
      token1: token2.address,
      amount1: tokenId
    })

    const { receipt } = await marketplace.executeOrder(
      encode(token1.address, obj1.sig, amount1),
      encode(token2.address, obj2.sig, tokenId),
      orderId,
      expiration,
      address2
    )
    // await utils.writeToFile('marketplace/executeOrder-E20-E721.js', receipt)
    const parsedLogs = logDecoder.decodeLogs(receipt.rawLogs)
    // console.log(parsedLogs)
    assert.equal(parsedLogs[0].event, 'Transfer')
    assert.equal(parsedLogs[1].event, 'LogTransfer')
    assert.equal(parsedLogs[2].event, 'Transfer')
    assert.equal(parsedLogs[3].event, 'LogTransfer')

    assert.equal((await token1.balanceOf(address1)).toNumber(), 0)
    assert.equal((await token2.ownerOf(tokenId)).toLowerCase(), address1.toLowerCase())
    assert.equal((await token1.balanceOf(address2)).toNumber(), amount1)
  })
})

function encode(token, sig, tokenIdOrAmount) {
  return web3.eth.abi.encodeParameters(
    ['address', 'bytes', 'uint256'],
    [token, sig, '0x' + tokenIdOrAmount.toString(16)]
  )
}

function decode(token, sig, tokenIdOrAmount) {
  return web3.eth.abi.decodeParameters(
    ['address', 'bytes', 'uint256'],
    [token, sig, '0x' + tokenIdOrAmount.toString(16)]
  )
}
