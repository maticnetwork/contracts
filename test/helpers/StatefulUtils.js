import ethUtils from 'ethereumjs-util'

import { getBlockHeader } from './blocks'
import MerkleTree from './merkle-tree'
import {
  getTxProof,
  verifyTxProof,
  getReceiptProof,
  verifyReceiptProof
} from './proofs'
import { build } from '../mockResponses/utils'

const utils = require('./utils')
const web3Child = utils.web3Child

export default class StatefulUtils {
  constructor() {
    this.start = 0
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

    const blockHeader = getBlockHeader(event.block)
    const headers = [blockHeader]
    const tree = new MerkleTree(headers)
    const root = ethUtils.bufferToHex(tree.getRoot())
    const end = event.tx.blockNumber
    const blockProof = await tree.getProof(blockHeader)
    this.start = Math.min(this.start, end)
    // tree
    //   .verify(blockHeader, event.block.number - start, tree.getRoot(), blockProof)
    //   .should.equal(true)
    const { vote, sigs, extraData } = utils.buildSubmitHeaderBlockPaylod(
      proposer[0],
      this.start,
      end,
      root,
      proposer,
      { rewardsRootHash: ethUtils.keccak256('RandomState') }
    )
    const submitHeaderBlock = await rootChain.submitHeaderBlock(
      vote,
      sigs,
      extraData
    )

    // const txProof = await getTxProof(event.tx, event.block)
    // assert.isTrue(verifyTxProof(txProof), 'Tx proof must be valid (failed in js)')
    // const receiptProof = await getReceiptProof(event.receipt, event.block, web3Child)
    // assert.isTrue(verifyReceiptProof(receiptProof), 'Receipt proof must be valid (failed in js)')

    const NewHeaderBlockEvent = submitHeaderBlock.logs.find(
      log => log.event === 'NewHeaderBlock'
    )
    this.start = end + 1
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
