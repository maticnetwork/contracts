import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../../helpers/deployer.js'
import logDecoder from '../../helpers/log-decoder.js'
// import { assertBigNumberEquality } from '../helpers/utils.js'
import { getSig } from '../../helpers/marketplaceUtils'
import { generateFirstWallets, mnemonics } from '../../helpers/wallets.js'
// import { }
const utils = require('../../helpers/utils')

chai
  .use(chaiAsPromised)
  .should()

contract("Marketplace", async function(accounts) {
  let childContracts, _marketContracts, marketplace, wallets
  const amount1 = web3.utils.toBN('10')
  const amount2 = web3.utils.toBN('5')
  const user = accounts[1]
  const other = accounts[2]

  before(async function() {
    // contracts = await deployer.freshDeploy()
    childContracts = await deployer.initializeChildChain(accounts[0])
    _marketContracts = await deployer.deployMarketplace(accounts[0])
    marketplace = _marketContracts.marketplace
    const stakes = {
      1: web3.utils.toWei('101'),
      2: web3.utils.toWei('100'),
      3: web3.utils.toWei('100'),
      4: web3.utils.toWei('100')
    }
    wallets = generateFirstWallets(mnemonics, Object.keys(stakes).length)
  })

  it('executeOrder', async function() {
    const privateKey1 = wallets[0].getPrivateKeyString()
    const address1 = wallets[0].getAddressString()
    const privateKey2 = wallets[1].getPrivateKeyString()
    const address2 = wallets[1].getAddressString()
    await utils.deposit(null, childContracts.childChain, _marketContracts.erc20.rootERC20, address1, amount1)
    await utils.deposit(null, childContracts.childChain, _marketContracts.erc20_1.rootERC20, address2, amount2)
    console.log(address1, address2)
    const orderId = '0x468fc9c005382579139846222b7b0aebc9182ba073b2455938a86d9753bfb078'
    const token1 = _marketContracts.erc20.childToken
    console.log('token1', token1.address)
    const token2 = _marketContracts.erc20_1.childToken
    console.log('token2', token2.address)

    const b1 = await token1.balanceOf(address1)
    console.log('b1', b1.toNumber())
    assert.equal(b1.toNumber(), amount1)

    const b2 = await token2.balanceOf(address2)
    console.log('b2', b2.toNumber())
    assert.equal(b2.toNumber(), amount2)

    // const o1 = await token2.ownerOf(amount2)
    // console.log('o1', o1)
    // assert.equal(o1.toLowerCase(), address2.toLowerCase())

    // get expiration in future in 10 blocks
    const expiration = 0 // (await web3.eth.getBlockNumber()) + 10

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

    // const { receipt } = await marketplace.executeOrder(
    const receipt = await marketplace.executeOrder(
      token1.address,
      obj1.sig,
      amount1,

      token2.address,
      obj2.sig,
      amount2,

      orderId,
      expiration,
      address2
    )
    console.log(receipt)

    // const parsedLogs = logDecoder.decodeLogs(receipt.rawLogs)
    // assert.equal(parsedLogs[0].event, "Transfer")
    // assert.equal(parsedLogs[1].event, "Transfer")

    // const b2 = await token1.balanceOf(address1)
    // assert.equal(b2.toNumber(), 0)

    // const b3 = await token1.balanceOf(address2)
    // assert.equal(b3.toNumber(), amount1)

    // const o2 = await token2.ownerOf(amount2)
    // assert.equal(o2.toLowerCase(), address1.toLowerCase())
  })
})
