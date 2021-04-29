import ethUtils from 'ethereumjs-util'

import { getBlockHeader } from './blocks'
import MerkleTree from './merkle-tree'

import { build } from '../mockResponses/utils'
import {
  getTxProof,
  verifyTxProof,
  getReceiptProof,
  verifyReceiptProof
} from './proofs'

const utils = require('./utils')
const web3Child = utils.web3Child

export default class StatefulUtils {
  constructor() {
    this.lastEndBlock = -1
  }

  async submitCheckpoint(rootChain, receipt, proposer) {
    const event = {
      tx: await web3Child.eth.getTransaction(receipt.transactionHash),
      receipt: await web3Child.eth.getTransactionReceipt(
        receipt.transactionHash
      ),
      block: await web3Child.eth.getBlock(
        receipt.blockHash,
        true /* returnTransactionObjects */
      )
    }

    // rootChain expects the first checkpoint to start from block 0.
    // However, ganache would already be running and would be much ahead of block 0.
    // offset is used to treat the block of the first checkpoint to be 0
    if (this.offset == null) {
      this.offset = event.block.number
    }
    event.block.number -= this.offset // rootChain will thank you for this
    const start = this.lastEndBlock + 1
    const end = event.block.number
    this.lastEndBlock = end
    if (start > end) {
      throw new Error(`Invalid end block number for checkpoint`, { start, end });
    }

    const headers = []
    for (let i = start; i <= end; i++) {
      const block = await web3Child.eth.getBlock(i + this.offset)
      block.number = i
      headers.push(getBlockHeader(block))
    }
    const blockHeader = getBlockHeader(event.block)
    const tree = new MerkleTree(headers)
    const root = ethUtils.bufferToHex(tree.getRoot())
    const blockProof = await tree.getProof(blockHeader)
    // tree
    //   .verify(blockHeader, end - start, tree.getRoot(), blockProof)
    //   .should.equal(true)
    const { data, sigs } = utils.buildsubmitCheckpointPaylod(
      proposer[0],
      start,
      end,
      root,
      proposer,
      { rewardsRootHash: ethUtils.keccak256('RandomState') }
    )
    const submitCheckpoint = await rootChain.submitCheckpoint(
      data, sigs)

    // const txProof = await getTxProof(event.tx, event.block)
    // assert.isTrue(verifyTxProof(txProof), 'Tx proof must be valid (failed in js)')
    // const receiptProof = await getReceiptProof(event.receipt, event.block, web3Child)
    // assert.isTrue(verifyReceiptProof(receiptProof), 'Receipt proof must be valid (failed in js)')

    const NewHeaderBlockEvent = submitCheckpoint.logs.find(
      log => log.event === 'NewHeaderBlock'
    )
    return {
      block: event.block,
      blockProof,
      headerNumber: NewHeaderBlockEvent.args.headerBlockId,
      createdAt: (await rootChain.headerBlocks(
        NewHeaderBlockEvent.args.headerBlockId
      )).createdAt,
      reference: await build(event)
    }
  }
}
