import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
const utils = require('ethereumjs-util')
const rlp = utils.rlp

const Proofs = require('../helpers/proofs')
const getBlockHeader = require('../helpers/blocks').getBlockHeader
// const MerkleTree = require('../helpers/merkle-tree')
import MerkleTree from '../helpers/merkle-tree'
import { ChildChainVerifier } from '../helpers/artifacts'

// import deployer from './helpers/deployer.js'
// import logDecoder from './helpers/log-decoder.js'
// import { assertBigNumberEquality } from './helpers/utils.js'
import incomingTransfer from '../mockResponses/incomingTransfer'
chai
  .use(chaiAsPromised)
  .should()

contract("ChildChainVerifier", async function(accounts) {
  describe("processReferenceTx", async function() {
    it("incomingTransfer", async function() {
      const instance = await ChildChainVerifier.deployed()
      const input = await build(incomingTransfer)
      console.log('0x' + incomingTransfer.receipt.logs[1].topics[3].slice(26))
      const res = await instance.processReferenceTx(
        utils.bufferToHex(input.receipt),
        utils.bufferToHex(rlp.encode(input.receiptParentNodes)),
        utils.bufferToHex(input.receiptsRoot),

        // utils.bufferToHex(input.tx),
        // utils.bufferToHex(rlp.encode(input.txParentNodes)),
        // utils.bufferToHex(input.transactionsRoot),

        utils.bufferToHex(rlp.encode(input.path)),
        1,
        // '0x96C42C56fdb78294F96B0cFa33c92bed7D75F96a'
        '0x' + incomingTransfer.receipt.logs[1].topics[3].slice(26) // recipient address
      )
      const rootToken = '0x' + incomingTransfer.receipt.logs[1].topics[1].slice(26).toLowerCase()
      expect(res.childToken.toLowerCase()).to.equal(incomingTransfer.receipt.to.toLowerCase())
      expect(res.rootToken.toLowerCase()).to.equal(rootToken)
      // expect(res.closingBalance.toNumber()).to.equal(parseInt(burn.tx.input.slice(10), 16))
      // console.log(res, res.closingBalance.toNumber())
    })
  })
})

let headerNumber = 0
async function build(event) {
  let blockHeader = getBlockHeader(event.block)
  let tree = new MerkleTree([blockHeader])
  let receiptProof = await Proofs.getReceiptProof(event.receipt, event.block, null /* web3 */, [event.receipt])
  let txProof = await Proofs.getTxProof(event.tx, event.block)
  assert.ok(
    Proofs.verifyTxProof(receiptProof),
    'verify receipt proof failed in js'
  )
  headerNumber += 1
  return {
    header: { number: headerNumber, root: tree.getRoot(), start: event.receipt.blockNumber },
    receipt: Proofs.getReceiptBytes(event.receipt), // rlp encoded
    receiptParentNodes: receiptProof.parentNodes,
    tx: Proofs.getTxBytes(event.tx), // rlp encoded
    txParentNodes: txProof.parentNodes,
    path: receiptProof.path,
    number: event.receipt.blockNumber,
    timestamp: event.block.timestamp,
    // transactionsRoot: event.block.transactionsRoot,
    transactionsRoot: Buffer.from(event.block.transactionsRoot.slice(2), 'hex'),
    receiptsRoot: Buffer.from(event.block.receiptsRoot.slice(2), 'hex'),
    proof: await tree.getProof(blockHeader)
  }
  // return {
  //   input: utils.rlp.encode(t),
  //   options: { root: tree.getRoot(), start: event.receipt.blockNumber }
  // }
}
