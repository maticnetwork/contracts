import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import ethUtils from 'ethereumjs-util'

import deployer from '../../../helpers/deployer.js'
import logDecoder from '../../../helpers/log-decoder.js'
import { getSig } from '../../../helpers/marketplaceUtils'
import { generateFirstWallets, mnemonics } from '../../../helpers/wallets.js'
import StatefulUtils from '../../../helpers/StatefulUtils'

import { buildInFlight } from '../../../mockResponses/utils'

const crypto = require('crypto')
const utils = require('../../../helpers/utils')
const executeOrder = require('../../../mockResponses/marketplace/executeOrder-E20-E20')
const predicateTestUtils = require('./predicateTestUtils')

chai
  .use(chaiAsPromised)
  .should()
const rlp = ethUtils.rlp

contract('MarketplacePredicate @skip-on-coverage', async function(accounts) {
  let contracts, childContracts, marketplace, predicate, erc20Predicate, erc721Predicate, statefulUtils
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
    childContracts = await deployer.initializeChildChain(accounts[0], { updateRegistry: false })
  })

  beforeEach(async function() {
    contracts = await deployer.freshDeploy(accounts[0])
    contracts.withdrawManager = await deployer.deployWithdrawManager()
    erc20Predicate = await deployer.deployErc20Predicate()
    erc721Predicate = await deployer.deployErc721Predicate()
    childContracts = await deployer.initializeChildChain(accounts[0])
    predicate = await deployer.deployMarketplacePredicate()
    marketplace = await deployer.deployMarketplace()
    statefulUtils = new StatefulUtils()
  })

  it('startExit (erc20/20 swap)', async function() {
    const erc20 = await deployer.deployChildErc20(accounts[0])
    const token1 = erc20.childToken
    const otherErc20 = await deployer.deployChildErc20(accounts[0])
    const token2 = otherErc20.childToken

    const inputs = []
    // deposit more tokens than spending, otherwise CANNOT_EXIT_ZERO_AMOUNTS
    const depositAmount = amount1.add(web3.utils.toBN('3'))
    const { receipt } = await utils.deposit(null, childContracts.childChain, erc20.rootERC20, address1, depositAmount)
    let { block, blockProof, headerNumber, reference } = await statefulUtils.submitCheckpoint(contracts.rootChain, receipt, accounts)
    inputs.push({ predicate: erc20Predicate.address, headerNumber, blockProof, blockNumber: block.number, blockTimestamp: block.timestamp, reference, logIndex: 1 })

    let { receipt: d } = await utils.deposit(null, childContracts.childChain, otherErc20.rootERC20, address2, amount2)
    const i = await statefulUtils.submitCheckpoint(contracts.rootChain, d, accounts)
    inputs.push({ predicate: erc20Predicate.address, headerNumber: i.headerNumber, blockProof: i.blockProof, blockNumber: i.block.number, blockTimestamp: i.block.timestamp, reference: i.reference, logIndex: 1 })

    assert.equal((await token1.balanceOf(address1)).toNumber(), depositAmount)
    assert.equal((await token2.balanceOf(address2)).toNumber(), amount2)

    const orderId = '0x' + crypto.randomBytes(32).toString('hex')
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
    const { receipt: r } = await marketplace.executeOrder(
      encode(token1.address, obj1.sig, amount1),
      encode(token2.address, obj2.sig, amount2),
      orderId,
      expiration,
      address2
    )
    let exitTx = await utils.web3Child.eth.getTransaction(r.transactionHash)
    exitTx = await buildInFlight(exitTx)
    const startExitTx = await utils.startExitForMarketplacePredicate(predicate, inputs, token1.address, exitTx)
    const logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
    // console.log('startExit', startExitTx, logs)
    let log = logs[1]
    log.event.should.equal('ExitStarted')
    assert.equal(log.args.exitor.toLowerCase(), address1.toLowerCase())
    assert.equal(log.args.token.toLowerCase(), erc20.rootERC20.address.toLowerCase())
    utils.assertBigNumberEquality(log.args.amount, depositAmount.sub(amount1)) // Exit starts with x tokens in total
    const exitId = log.args.exitId

    log = logs[2]
    log.event.should.equal('ExitUpdated')
    assert.equal(log.args.signer.toLowerCase(), address1.toLowerCase())
    utils.assertBigNumberEquality(log.args.exitId, exitId)

    log = logs[3]
    log.event.should.equal('ExitUpdated')
    assert.equal(log.args.signer.toLowerCase(), address2.toLowerCase())
    utils.assertBigNumberEquality(log.args.exitId, exitId)
  })

  it('startExit (erc20/721 swap)', async function() {
    const erc20 = await deployer.deployChildErc20(accounts[0])
    const token1 = erc20.childToken
    const erc721 = await deployer.deployChildErc721(accounts[0])
    const token2 = erc721.childErc721

    const inputs = []
    // deposit more tokens than spending, otherwise CANNOT_EXIT_ZERO_AMOUNTS
    const depositAmount = amount1.add(web3.utils.toBN('3'))
    const { receipt } = await utils.deposit(null, childContracts.childChain, erc20.rootERC20, address1, depositAmount)
    let { block, blockProof, headerNumber, reference } = await statefulUtils.submitCheckpoint(contracts.rootChain, receipt, accounts)
    inputs.push({ predicate: erc20Predicate.address, headerNumber, blockProof, blockNumber: block.number, blockTimestamp: block.timestamp, reference, logIndex: 1 })

    let { receipt: d } = await utils.deposit(null, childContracts.childChain, erc721.rootERC721, address2, tokenId)
    const i = await statefulUtils.submitCheckpoint(contracts.rootChain, d, accounts)
    inputs.push({ predicate: erc721Predicate.address, headerNumber: i.headerNumber, blockProof: i.blockProof, blockNumber: i.block.number, blockTimestamp: i.block.timestamp, reference: i.reference, logIndex: 1 })

    assert.equal((await token1.balanceOf(address1)).toNumber(), depositAmount)
    assert.equal((await token2.ownerOf(tokenId)).toLowerCase(), address2.toLowerCase())

    const orderId = '0x' + crypto.randomBytes(32).toString('hex')
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
    const { receipt: r } = await marketplace.executeOrder(
      encode(token1.address, obj1.sig, amount1),
      encode(token2.address, obj2.sig, tokenId),
      orderId,
      expiration,
      address2
    )
    let exitTx = await utils.web3Child.eth.getTransaction(r.transactionHash)
    exitTx = await buildInFlight(exitTx)
    const startExitTx = await utils.startExitForMarketplacePredicate(predicate, inputs, token1.address, exitTx)
    const logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
    // console.log('startExit', startExitTx, logs)
    let log = logs[1]
    log.event.should.equal('ExitStarted')
    assert.equal(log.args.exitor.toLowerCase(), address1.toLowerCase())
    assert.equal(log.args.token.toLowerCase(), erc20.rootERC20.address.toLowerCase())
    utils.assertBigNumberEquality(log.args.amount, depositAmount.sub(amount1)) // Exit starts with x tokens in total
    const exitId = log.args.exitId

    log = logs[2]
    log.event.should.equal('ExitUpdated')
    assert.equal(log.args.signer.toLowerCase(), address1.toLowerCase())
    utils.assertBigNumberEquality(log.args.exitId, exitId)

    log = logs[3]
    log.event.should.equal('ExitUpdated')
    assert.equal(log.args.signer.toLowerCase(), address2.toLowerCase())
    utils.assertBigNumberEquality(log.args.exitId, exitId)
  })

  it('startExit fails if some other token is referenced', async function() {
    const erc20 = await deployer.deployChildErc20(accounts[0])
    const token1 = erc20.childToken
    const erc721 = await deployer.deployChildErc721(accounts[0])
    const token2 = erc721.childErc721

    const inputs = []
    // deposit more tokens than spending, otherwise CANNOT_EXIT_ZERO_AMOUNTS
    const depositAmount = amount1.add(web3.utils.toBN('3'))
    await utils.deposit(null, childContracts.childChain, erc20.rootERC20, address1, depositAmount)

    // Use erc20 in the marketplace tx but reference some other token deposit
    const otherErc20 = await deployer.deployChildErc20(accounts[0])
    // const token3 = otherErc20.childToken
    const { receipt } = await utils.deposit(null, childContracts.childChain, otherErc20.rootERC20, address1, depositAmount)
    let { block, blockProof, headerNumber, reference } = await statefulUtils.submitCheckpoint(contracts.rootChain, receipt, accounts)
    inputs.push({ predicate: erc20Predicate.address, headerNumber, blockProof, blockNumber: block.number, blockTimestamp: block.timestamp, reference, logIndex: 1 })

    let { receipt: d } = await utils.deposit(null, childContracts.childChain, erc721.rootERC721, address2, tokenId)
    const i = await statefulUtils.submitCheckpoint(contracts.rootChain, d, accounts)
    inputs.push({ predicate: erc721Predicate.address, headerNumber: i.headerNumber, blockProof: i.blockProof, blockNumber: i.block.number, blockTimestamp: i.block.timestamp, reference: i.reference, logIndex: 1 })

    assert.equal((await token1.balanceOf(address1)).toNumber(), depositAmount)
    assert.equal((await token2.ownerOf(tokenId)).toLowerCase(), address2.toLowerCase())

    const orderId = '0x' + crypto.randomBytes(32).toString('hex')
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
    const { receipt: r } = await marketplace.executeOrder(
      encode(token1.address, obj1.sig, amount1),
      encode(token2.address, obj2.sig, tokenId),
      orderId,
      expiration,
      address2
    )
    let exitTx = await utils.web3Child.eth.getTransaction(r.transactionHash)
    exitTx = await buildInFlight(exitTx)
    try {
      await utils.startExitForMarketplacePredicate(predicate, inputs, token1.address, exitTx)
      assert.fail(1, 2, 'Expected to fail')
    } catch (e) {
      assert.equal(e.reason, 'Child tokens do not match')
    }
  })

  it('startExit fails if inputs are given in an incorrect order', async function() {
    const erc20 = await deployer.deployChildErc20(accounts[0])
    const token1 = erc20.childToken
    const erc721 = await deployer.deployChildErc721(accounts[0])
    const token2 = erc721.childErc721

    const inputs = []
    // Provide the counterparty's deposit as the first input
    let { receipt: d } = await utils.deposit(null, childContracts.childChain, erc721.rootERC721, address2, tokenId)
    const i = await statefulUtils.submitCheckpoint(contracts.rootChain, d, accounts)
    inputs.push({ predicate: erc721Predicate.address, headerNumber: i.headerNumber, blockProof: i.blockProof, blockNumber: i.block.number, blockTimestamp: i.block.timestamp, reference: i.reference, logIndex: 1 })

    // deposit more tokens than spending, otherwise CANNOT_EXIT_ZERO_AMOUNTS
    const depositAmount = amount1.add(web3.utils.toBN('3'))
    const { receipt } = await utils.deposit(null, childContracts.childChain, erc20.rootERC20, address1, depositAmount)
    let { block, blockProof, headerNumber, reference } = await statefulUtils.submitCheckpoint(contracts.rootChain, receipt, accounts)
    inputs.push({ predicate: erc20Predicate.address, headerNumber, blockProof, blockNumber: block.number, blockTimestamp: block.timestamp, reference, logIndex: 1 })

    const orderId = '0x' + crypto.randomBytes(32).toString('hex')
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
    const { receipt: r } = await marketplace.executeOrder(
      encode(token1.address, obj1.sig, amount1),
      encode(token2.address, obj2.sig, tokenId),
      orderId,
      expiration,
      address2
    )
    let exitTx = await utils.web3Child.eth.getTransaction(r.transactionHash)
    exitTx = await buildInFlight(exitTx)
    try {
      await utils.startExitForMarketplacePredicate(predicate, inputs, token1.address, exitTx)
      assert.fail(1, 2, 'Expected to fail')
    } catch (e) {
      assert.equal(e.reason, 'tx / log doesnt concern the participant')
    }
  })

  it('startExit fails if not a valid predicate', async function() {
    const inputs = [
      web3.eth.abi.encodeParameters(
        ['address', 'bytes'],
        ['0xc46EB8c1ea86bC8c24f26D9FdF9B76B300FFFE43', rlp.encode(ethUtils.bufferToHex(Buffer.from('dummy')))]
      )
    ]
    try {
      await predicate.startExit(
        ethUtils.bufferToHex(rlp.encode(inputs)),
        buildInFlight(executeOrder.tx),
        { value: web3.utils.toWei('.1', 'ether') }
      )
      assert.fail(1, 2, 'Expected to fail')
    } catch (e) {
      assert.equal(e.reason, 'Not a valid predicate')
    }
  })

  it('startExit fails if marketplace order has expired', async function() {
    const erc20 = await deployer.deployChildErc20(accounts[0])
    const token1 = erc20.childToken
    const otherErc20 = await deployer.deployChildErc20(accounts[0])
    const token2 = otherErc20.childToken

    const inputs = []
    // deposit more tokens than spending, otherwise CANNOT_EXIT_ZERO_AMOUNTS
    const depositAmount = amount1.add(web3.utils.toBN('3'))
    const { receipt } = await utils.deposit(null, childContracts.childChain, erc20.rootERC20, address1, depositAmount)
    let { block, blockProof, headerNumber, reference } = await statefulUtils.submitCheckpoint(contracts.rootChain, receipt, accounts)
    inputs.push({ predicate: erc20Predicate.address, headerNumber, blockProof, blockNumber: block.number, blockTimestamp: block.timestamp, reference, logIndex: 1 })

    let { receipt: d } = await utils.deposit(null, childContracts.childChain, otherErc20.rootERC20, address2, amount2)
    const i = await statefulUtils.submitCheckpoint(contracts.rootChain, d, accounts)
    inputs.push({ predicate: erc20Predicate.address, headerNumber: i.headerNumber, blockProof: i.blockProof, blockNumber: i.block.number, blockTimestamp: i.block.timestamp, reference: i.reference, logIndex: 1 })

    assert.equal((await token1.balanceOf(address1)).toNumber(), depositAmount)
    assert.equal((await token2.balanceOf(address2)).toNumber(), amount2)

    const orderId = '0x' + crypto.randomBytes(32).toString('hex')
    // Sign an expired order
    const expiration = statefulUtils.lastEndBlock - 1
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
    const executeOrderTx = await predicateTestUtils.getRawInflightTx(
      marketplace.executeOrder.bind(null,
        encode(token1.address, obj1.sig, amount1),
        encode(token2.address, obj2.sig, amount2),
        orderId,
        expiration,
        address2),
      accounts[0] /* from */, utils.web3Child, 39128 // gas
    )
    try {
      await utils.startExitForMarketplacePredicate(predicate, inputs, token1.address, executeOrderTx)
      assert.fail('startExit should have failed')
    } catch (e) {
      assert.ok(
        e.message.includes('The inflight exit is not valid, because the marketplace order has expired'),
        'Expected tx to fail for a different reason'
      )
    }
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
