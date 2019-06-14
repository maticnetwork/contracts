import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import ethUtils from 'ethereumjs-util'

import deployer from '../../helpers/deployer.js'
import logDecoder from '../../helpers/log-decoder.js'
import { getReceiptBytes } from '../../helpers/proofs'
import { build, buildInFlight } from '../../mockResponses/utils'
import * as artifacts from '../../helpers/artifacts'

const utils = require('../../helpers/utils')
const deposit1 = require('../../mockResponses/marketplace/address1Deposit')
const deposit2 = require('../../mockResponses/marketplace/address2Deposit')
const executeOrder = require('../../mockResponses/marketplace/executeOrder-E20-E20')

chai
  .use(chaiAsPromised)
  .should()

let start = 0
contract("MarketplacePredicate (from mocked responses)", async function(accounts) {
  let contracts, childContracts, marketplace, predicate

  before(async function() {
    predicate = await artifacts.MarketplacePredicateTest.deployed()
  })

  it('processPreState', async function() {
    const processPreState = await predicate.processPreState(
      ethUtils.bufferToHex(ethUtils.rlp.encode(dummyReferenceData(deposit1, 1))),
      '0x9fb29aac15b9a4b7f17c3385939b007540f4d791'
    )
    // console.log('processPreState', processPreState)
    const ans = processPreState.receipt.logs[0].args.b.slice(2)
    const input = deposit1.receipt.logs[1]
    assert.equal(parseInt(ans.slice(0, 64), 16), parseInt(input.data.slice(-64), 16))
    assert.equal(parseInt(ans.slice(64, 128), 16), 1 * 10 /* logIndex * MAX_LOGS */)
    assert.equal(ans.slice(128, 192).slice(24).toLowerCase(), input.address.slice(2).toLowerCase())
    assert.equal(ans.slice(192, 256).slice(24).toLowerCase(), input.topics[1].slice(26).toLowerCase())
  })

  it('processPreState counterparty', async function() {
    const event = deposit2
    const processPreState = await predicate.processPreState(
      ethUtils.bufferToHex(ethUtils.rlp.encode(dummyReferenceData(event, 1))),
      '0x96c42c56fdb78294f96b0cfa33c92bed7d75f96a'
    )
    // console.log('processPreState', processPreState)
    const ans = processPreState.receipt.logs[0].args.b.slice(2)
    const input = event.receipt.logs[1]
    assert.equal(parseInt(ans.slice(0, 64), 16), parseInt(input.data.slice(-64), 16))
    assert.equal(parseInt(ans.slice(64, 128), 16), 1 * 10 /* logIndex * MAX_LOGS */)
    assert.equal(ans.slice(128, 192).slice(24).toLowerCase(), input.address.slice(2).toLowerCase())
    assert.equal(ans.slice(192, 256).slice(24).toLowerCase(), input.topics[1].slice(26).toLowerCase())
  })

  it('processExitTx', async function() {
    const startExit = await predicate.processExitTx(buildInFlight(executeOrder.tx))
    // console.log('startExit', startExit)
    const ans = startExit.receipt.logs[0].args.b.slice(2)
    const input = parseRawTxData(Buffer.from(executeOrder.tx.input.slice(2), 'hex'))
    assert.equal(parseInt(ans.slice(0, 64), 16), parseInt(input.data1.tokenIdOrAmount))
    assert.equal(parseInt(ans.slice(64, 128), 16), parseInt(input.data2.tokenIdOrAmount))
    assert.equal(ans.slice(128, 192).slice(24).toLowerCase(), input.data1.token.slice(2).toLowerCase())
    assert.equal(ans.slice(192, 256).slice(24).toLowerCase(), input.data2.token.slice(2).toLowerCase())
    assert.equal(ans.slice(256).toLowerCase(), input.taker.toString('hex').toLowerCase())
  })
})

function parseRawTxData(input) {
  const res = {
    funcSig: input.slice(0, 4),
    orderId: input.slice(68, 100),
    expiration: input.slice(100, 132),
    taker: input.slice(132, 164),
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