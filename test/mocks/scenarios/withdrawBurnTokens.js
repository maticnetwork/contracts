const utils = require('ethereumjs-util')
const assert = require('assert')

const WithdrawManager = require('../WithdrawManager')
const withdrawManager = new WithdrawManager()
const withdrawTx = require('../mockResponses/childTokenWithdrawTx')
const withdrawReceipt = require('../mockResponses/childTokenWithdrawReceipt')
const withdrawBlock = require('../mockResponses/childTokenWithdrawBlock')

const getBlockHeader = require('../../helpers/blocks').getBlockHeader
const MerkleTree = require('../../helpers/merkle-tree')
const Proofs = require('../../helpers/proofs')

async function withdrawBurntTokens() {
  const blockHeader = getBlockHeader(withdrawBlock)
  const headers = [blockHeader]
  const tree = new MerkleTree(headers)
  const root = utils.bufferToHex(tree.getRoot())
  const start = withdrawTx.blockNumber
  const end = withdrawTx.blockNumber
  const withdrawBlockProof = await tree.getProof(blockHeader)

  const txProof = await Proofs.getTxProof(withdrawTx, withdrawBlock)
  const receiptProof = await Proofs.getReceiptProof(withdrawReceipt, withdrawBlock, [withdrawReceipt])
  // console.log('blockHeader 1', blockHeader)
  // console.log(blockHeader,
  //     withdrawBlock.number - start,
  //     tree.getRoot(),
  //     withdrawBlockProof)
  // assert.ok(
  //   tree.verify(
  //     blockHeader,
  //     withdrawBlock.number - start,
  //     tree.getRoot(),
  //     withdrawBlockProof
  //   ),
  //   "Check membership failed"
  // )
  await withdrawManager.withdrawBurntTokens(
    txProof, receiptProof,
    withdrawBlock.number, withdrawBlock.timestamp, withdrawBlock.transactionsRoot, withdrawBlock.receiptsRoot, withdrawBlockProof,
    {start, root}
  )
  // console.log(blockHeader, withdrawBlock.number - start, tree.getRoot(), withdrawBlockProof)
  // const headerNumber = 10000;
  // const headerRoot = utils.bufferToHex(tree.getRoot())
  // const startBlock = 
  // await withdrawManager.checkInclusion(headerRoot, start, withdrawBlockProof, withdrawBlock.number,
  //   withdrawBlock.timestamp, withdrawBlock.transactionsRoot, withdrawBlock.receiptsRoot
  // )
  // await withdrawManager.withdrawBurntTokens(
  //   headerNumber,
  //   // utils.bufferToHex(Buffer.concat(withdrawBlockProof)),
  //   utils.bufferToHex(Buffer.concat(withdrawBlockProof)),
  //   withdrawBlock.number,
  //   withdrawBlock.timestamp,
  //   utils.bufferToHex(withdrawBlock.transactionsRoot),
  //   utils.bufferToHex(withdrawBlock.receiptsRoot),
  //   utils.bufferToHex(rlp.encode(receiptProof.path)), // branch mask
  //   utils.bufferToHex(getTxBytes(withdrawTx)),
  //   utils.bufferToHex(rlp.encode(txProof.parentNodes)), // Merkle proof of the withdraw transaction
  //   utils.bufferToHex(getReceiptBytes(withdrawReceipt)),
  //   utils.bufferToHex(rlp.encode(receiptProof.parentNodes)),
  //   user,
  //   { receiptProof, rootChain: contracts.rootChain }
  // )
}

withdrawBurntTokens()