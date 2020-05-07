import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import ethUtils from 'ethereumjs-util'

import { getReceiptBytes } from '../../../helpers/proofs'
import { buildInFlight } from '../../../mockResponses/utils'
import * as artifacts from '../../../helpers/artifacts'

const deposit1 = require('../../../mockResponses/marketplace/erc20_20_Deposit_1')
const deposit2 = require('../../../mockResponses/marketplace/erc20_20_Deposit_2')
const executeOrder = require('../../../mockResponses/marketplace/executeOrder-E20-E20')

const erc20_721_Deposit_1 = require('../../../mockResponses/marketplace/erc20_721_Deposit_1')
const erc20_721_Deposit_2 = require('../../../mockResponses/marketplace/erc20_721_Deposit_2')
const executeOrder_E20_E721 = require('../../../mockResponses/marketplace/executeOrder-E20-E721')

const incomingTransfer = require('../../../mockResponses/incomingTransfer')


chai
  .use(chaiAsPromised)
  .should()

contract('MarketplacePredicate (from mocked responses) @skip-on-coverage', async function(accounts) {
  let predicate, erc20Predicate, erc721Predicate

  before(async function() {
    erc721Predicate = await artifacts.ERC721Predicate.deployed()
    erc20Predicate = await artifacts.ERC20Predicate.deployed()
    predicate = await artifacts.MarketplacePredicateTest.new()
  })

  it('processLogTransferReceipt (Erc20 Deposit)', async function() {
    let event = deposit1
    let processLogTransferReceipt = await predicate.processLogTransferReceiptTest(
      erc20Predicate.address,
      ethUtils.bufferToHex(ethUtils.rlp.encode(dummyReferenceData(event, 1))),
      '0x9fb29aac15b9a4b7f17c3385939b007540f4d791'
    )
    // console.log('processLogTransferReceipt', processLogTransferReceipt)
    let ans = processLogTransferReceipt.slice(2)
    let input = event.receipt.logs[1]
    assert.equal(parseInt(ans.slice(0, 64), 16), parseInt(input.data.slice(-64), 16))
    assert.equal(parseInt(ans.slice(64, 128), 16), 1 * 10 /* logIndex * MAX_LOGS */)
    assert.equal(ans.slice(128, 192).slice(24).toLowerCase(), input.address.slice(2).toLowerCase())
    assert.equal(ans.slice(192, 256).slice(24).toLowerCase(), input.topics[1].slice(26).toLowerCase())

    event = deposit2
    processLogTransferReceipt = await predicate.processLogTransferReceiptTest(
      erc20Predicate.address,
      ethUtils.bufferToHex(ethUtils.rlp.encode(dummyReferenceData(event, 1))),
      '0x96c42c56fdb78294f96b0cfa33c92bed7d75f96a'
    )
    // console.log('processLogTransferReceipt', processLogTransferReceipt)
    ans = processLogTransferReceipt.slice(2)
    input = event.receipt.logs[1]
    assert.equal(parseInt(ans.slice(0, 64), 16), parseInt(input.data.slice(-64), 16))
    assert.equal(parseInt(ans.slice(64, 128), 16), 1 * 10 /* logIndex * MAX_LOGS */)
    assert.equal(ans.slice(128, 192).slice(24).toLowerCase(), input.address.slice(2).toLowerCase())
    assert.equal(ans.slice(192, 256).slice(24).toLowerCase(), input.topics[1].slice(26).toLowerCase())
  })

  it('processLogTransferReceipt (Erc20 outgoingTransfer)', async function() {
    let event = incomingTransfer
    let processLogTransferReceipt = await predicate.processLogTransferReceiptTest(
      erc20Predicate.address,
      ethUtils.bufferToHex(ethUtils.rlp.encode(dummyReferenceData(event, 1))),
      '0x96c42c56fdb78294f96b0cfa33c92bed7d75f96a'
    )
    // console.log('processLogTransferReceipt', processLogTransferReceipt)
    let ans = processLogTransferReceipt.slice(2)
    let input = event.receipt.logs[1]
    assert.equal(parseInt(ans.slice(0, 64), 16), parseInt(input.data.slice(-128, -64) /* output1 */, 16))
    assert.equal(parseInt(ans.slice(64, 128), 16), 1 * 10 /* logIndex * MAX_LOGS */)
    assert.equal(ans.slice(128, 192).slice(24).toLowerCase(), input.address.slice(2).toLowerCase())
    assert.equal(ans.slice(192, 256).slice(24).toLowerCase(), input.topics[1].slice(26).toLowerCase())
  })

  it('processLogTransferReceipt (Erc20 incomingTransfer)', async function() {
    let event = incomingTransfer
    let processLogTransferReceipt = await predicate.processLogTransferReceiptTest(
      erc20Predicate.address,
      ethUtils.bufferToHex(ethUtils.rlp.encode(dummyReferenceData(event, 1))),
      '0x9fb29aac15b9a4b7f17c3385939b007540f4d791'
    )
    // console.log('processLogTransferReceipt', processLogTransferReceipt)
    let ans = processLogTransferReceipt.slice(2)
    let input = event.receipt.logs[1]
    assert.equal(parseInt(ans.slice(0, 64), 16), parseInt(input.data.slice(-64) /* output2 */, 16))
    assert.equal(parseInt(ans.slice(64, 128), 16), 1 * 10 + 1 /* logIndex * MAX_LOGS + oIndex */)
    assert.equal(ans.slice(128, 192).slice(24).toLowerCase(), input.address.slice(2).toLowerCase())
    assert.equal(ans.slice(192, 256).slice(24).toLowerCase(), input.topics[1].slice(26).toLowerCase())
  })

  it('processLogTransferReceipt (Erc721 Deposit)', async function() {
    let event = erc20_721_Deposit_1
    let processLogTransferReceipt = await predicate.processLogTransferReceiptTest(
      erc20Predicate.address,
      ethUtils.bufferToHex(ethUtils.rlp.encode(dummyReferenceData(event, 1))),
      '0x9fb29aac15b9a4b7f17c3385939b007540f4d791'
    )
    // console.log('processLogTransferReceipt', processLogTransferReceipt)
    let ans = processLogTransferReceipt.slice(2)
    let input = event.receipt.logs[1]
    assert.equal(parseInt(ans.slice(0, 64), 16), parseInt(input.data.slice(-64), 16))
    assert.equal(parseInt(ans.slice(64, 128), 16), 1 * 10 /* logIndex * MAX_LOGS */)
    assert.equal(ans.slice(128, 192).slice(24).toLowerCase(), input.address.slice(2).toLowerCase())
    assert.equal(ans.slice(192, 256).slice(24).toLowerCase(), input.topics[1].slice(26).toLowerCase())

    event = erc20_721_Deposit_2
    processLogTransferReceipt = await predicate.processLogTransferReceiptTest(
      erc721Predicate.address,
      ethUtils.bufferToHex(ethUtils.rlp.encode(dummyReferenceData(event, 1))),
      '0x96c42c56fdb78294f96b0cfa33c92bed7d75f96a'
    )
    // console.log('processLogTransferReceipt', processLogTransferReceipt)
    ans = processLogTransferReceipt.slice(2)
    input = event.receipt.logs[1]
    assert.equal(parseInt(ans.slice(0, 64), 16), parseInt(input.data.slice(-64), 16))
    assert.equal(parseInt(ans.slice(64, 128), 16), 1 * 10 /* logIndex * MAX_LOGS */)
    assert.equal(ans.slice(128, 192).slice(24).toLowerCase(), input.address.slice(2).toLowerCase())
    assert.equal(ans.slice(192, 256).slice(24).toLowerCase(), input.topics[1].slice(26).toLowerCase())
  })

  it('processExitTx (20/20)', async function() {
    const startExit = await predicate.processExitTx(ethUtils.bufferToHex(buildInFlight(executeOrder.tx)))
    // console.log('startExit', startExit)
    const ans = startExit.slice(2)
    const input = parseRawTxData(Buffer.from(executeOrder.tx.input.slice(2), 'hex'))
    assert.equal(parseInt(ans.slice(0, 64), 16), parseInt(input.data1.tokenIdOrAmount))
    assert.equal(parseInt(ans.slice(64, 128), 16), parseInt(input.data2.tokenIdOrAmount))
    assert.equal(ans.slice(128, 192).slice(24).toLowerCase(), input.data1.token.slice(2).toLowerCase())
    assert.equal(ans.slice(192, 256).slice(24).toLowerCase(), input.data2.token.slice(2).toLowerCase())
    assert.equal(ans.slice(256).toLowerCase(), input.taker.toString('hex').toLowerCase())
  })

  it('processExitTx (20/721)', async function() {
    const event = executeOrder_E20_E721
    const startExit = await predicate.processExitTx(ethUtils.bufferToHex(buildInFlight(event.tx)))
    const ans = startExit.slice(2)
    const input = parseRawTxData(Buffer.from(event.tx.input.slice(2), 'hex'))
    assert.equal(parseInt(ans.slice(0, 64), 16), parseInt(input.data1.tokenIdOrAmount))
    assert.equal(parseInt(ans.slice(64, 128), 16), parseInt(input.data2.tokenIdOrAmount))
    assert.equal(ans.slice(128, 192).slice(24).toLowerCase(), input.data1.token.slice(2).toLowerCase())
    assert.equal(ans.slice(192, 256).slice(24).toLowerCase(), input.data2.token.slice(2).toLowerCase())
    assert.equal(ans.slice(256).toLowerCase(), input.taker.toString('hex').toLowerCase())
  })

  it('testGetAddressFromTx', async function() {
    let event = executeOrder
    const getAddressFromTx = await predicate.testGetAddressFromTx(ethUtils.bufferToHex(buildInFlight(event.tx)))
    assert.equal(getAddressFromTx.signer, event.tx.from)
  })
})

function parseRawTxData(input) {
  const res = {
    funcSig: input.slice(0, 4),
    orderId: input.slice(68, 100),
    expiration: input.slice(100, 132),
    taker: input.slice(132, 164)
  }
  let length = parseInt(input.slice(164, 196).toString('hex'), 16)
  res.data1 = decode(input.slice(196, 196 + length))
  let offset = 196 + length
  length = parseInt(input.slice(offset, offset + 32).toString('hex'), 16)
  res.data2 = decode(input.slice(offset + 32, offset + 32 + length))
  return res
}

function encode(token, sig, tokenIdOrAmount) {
  return web3.eth.abi.encodeParameters(
    ['address', 'bytes', 'uint256'],
    [token, sig, '0x' + tokenIdOrAmount.toString(16)]
  )
}

function decode(input) {
  return web3.eth.abi.decodeParameters(
    [{type: 'address', name: 'token'}, {type: 'bytes', name: 'sig'}, {type: 'uint256', name: 'tokenIdOrAmount'}], input.toString('hex'))
}

function dummyReferenceData(event, logIndex) {
  let a = new Array(10).fill(0);
  const referenceReceipt = getReceiptBytes(event.receipt)
  a[6] = ethUtils.bufferToHex(referenceReceipt)
  a[9] = logIndex
  return a
}
