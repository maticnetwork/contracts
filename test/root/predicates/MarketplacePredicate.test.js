import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../../helpers/deployer.js'
import logDecoder from '../../helpers/log-decoder.js'
import { getSig } from '../../helpers/marketplaceUtils'
import { generateFirstWallets, mnemonics } from '../../helpers/wallets.js'
import { getBlockHeader } from '../../helpers/blocks'
import MerkleTree from '../../helpers/merkle-tree'
import {
  getTxProof,
  verifyTxProof,
  getReceiptProof,
  verifyReceiptProof
} from '../../helpers/proofs'
const utils = require('../../helpers/utils')
import { build, buildInFlight } from '../../mockResponses/utils'
import ethUtils from 'ethereumjs-util'

chai
  .use(chaiAsPromised)
  .should()

let start = 0
contract("MarketplacePredicate", async function(accounts) {
  let contracts, childContracts, marketplace, predicate, erc20Predicate
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
    contracts = await deployer.freshDeploy()
    erc20Predicate = await deployer.deployErc20Predicate()
    childContracts = await deployer.initializeChildChain(accounts[0])
    marketplace = await deployer.deployMarketplace()
  })

  beforeEach(async function() {
    contracts.withdrawManager = await deployer.deployWithdrawManager()
    predicate = await deployer.deployMarketplacePredicate()
  })

  it('startExit', async function() {
    const erc20 = await deployer.deployChildErc20(accounts[0])
    const token1 = erc20.childToken
    const otherErc20 = await deployer.deployChildErc20(accounts[0])
    const token2 = otherErc20.childToken

    const inputs = []
    // deposit more tokens than spending, otherwise CANNOT_EXIT_ZERO_AMOUNTS
    const depositAmount = amount1.add(web3.utils.toBN('3'))
    const { receipt } = await utils.deposit(null, childContracts.childChain, erc20.rootERC20, address1, depositAmount)
    let { block, blockProof, headerNumber, reference } = await init(contracts.rootChain, receipt, accounts)
    inputs.push({ predicate: erc20Predicate.address, headerNumber, blockProof, blockNumber: block.number, blockTimestamp: block.timestamp, reference, logIndex: 1 })

    let { receipt: d } = await utils.deposit(null, childContracts.childChain, otherErc20.rootERC20, address2, amount2)
    const i = await init(contracts.rootChain, d, accounts)
    inputs.push({ predicate: erc20Predicate.address, headerNumber: i.headerNumber, blockProof: i.blockProof, blockNumber: i.block.number, blockTimestamp: i.block.timestamp, reference: i.reference, logIndex: 1 })

    assert.equal((await token1.balanceOf(address1)).toNumber(), depositAmount)
    assert.equal((await token2.balanceOf(address2)).toNumber(), amount2)

    const orderId = '0x468fc9c005382579139846222b7b0aebc9182ba073b2455938a86d9753bfb078'
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
    const { receipt: r } = await marketplace.executeOrder(
      encode(token1.address, obj1.sig, amount1),
      encode(token2.address, obj2.sig, amount2),
      orderId,
      expiration,
      address2
    )
    let exitTx = await utils.web3Child.eth.getTransaction(r.transactionHash)
    exitTx = await buildInFlight(exitTx)
    const startExitTx = await utils.startExitForMarketplacePredicate(predicate, inputs, token1.address, buildInFlight(exitTx))
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
    const age = log.args.age

    log = logs[3]
    log.event.should.equal('ExitUpdated')
    assert.equal(log.args.signer.toLowerCase(), address2.toLowerCase())
    utils.assertBigNumberEquality(log.args.exitId, exitId)
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

async function init(rootChain, receipt, accounts, _) {
  const event = {
    tx: await utils.web3Child.eth.getTransaction(receipt.transactionHash),
    receipt: await utils.web3Child.eth.getTransactionReceipt(receipt.transactionHash),
    block: await utils.web3Child.eth.getBlock(receipt.blockHash, true /* returnTransactionObjects */)
  }

  const blockHeader = getBlockHeader(event.block)
  const headers = [blockHeader]
  const tree = new MerkleTree(headers)
  const root = ethUtils.bufferToHex(tree.getRoot())
  const end = event.tx.blockNumber
  const blockProof = await tree.getProof(blockHeader)
  start = Math.min(start, end)
  tree
    .verify(blockHeader, event.block.number - start, tree.getRoot(), blockProof)
    .should.equal(true)
  const { vote, sigs, extraData } = utils.buildSubmitHeaderBlockPaylod(accounts[0], start, end, root)
  const submitHeaderBlock = await rootChain.submitHeaderBlock(vote, sigs, extraData)

  const txProof = await getTxProof(event.tx, event.block)
  // assert.isTrue(verifyTxProof(txProof), 'Tx proof must be valid (failed in js)')
  const receiptProof = await getReceiptProof(event.receipt, event.block, utils.web3Child)
  // assert.isTrue(verifyReceiptProof(receiptProof), 'Receipt proof must be valid (failed in js)')

  const NewHeaderBlockEvent = submitHeaderBlock.logs.find(log => log.event === 'NewHeaderBlock')
  start = end + 1
  return { block: event.block, blockProof, headerNumber: NewHeaderBlockEvent.args.headerBlockId, reference: await build(event) }
}
