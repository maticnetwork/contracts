const Buffer = require('safe-buffer').Buffer
const BN = require('bn.js')
const moment = require('moment')
const utils = require('ethereumjs-util')
const PriorityQueue = require('js-priority-queue')
const assert = require('assert')

const MerkleTree = require('../helpers/merkle-tree')
const Proofs = require('../helpers/proofs')
const getBlockHeader = require('../helpers/blocks').getBlockHeader


const ChildChainVerifier = require('./ChildChainVerifier')
const merklePatriciaProof = require('./common/lib/MerklePatriciaProof')
const HEADER_BLOCK_NUMBER_WEIGHT = new BN('10').pow(new BN('30'))
const WITHDRAW_BLOCK_NUMBER_WEIGHT = new BN('10').pow(new BN('12'))
const TX_INDEX_WEIGHT = new BN('10').pow(new BN('5'))

class WithdrawManager {
  constructor(rootChain, registry, options) {
    this.rootChain = rootChain
    this.registry = registry
    this.ownerExits = {}
    this.exits = {}
    this.exitsQueues = {}
    this.childChainVerifier = new ChildChainVerifier()
    this.options = options
  }

  verifyReceipt(input) {
    let { header, receiptProof, number, timestamp, transactionsRoot, receiptsRoot, proof } = input
    receiptProof.proof = receiptsRoot
    assert.ok(Proofs.verifyTxProof(receiptProof), "receiptProof failed")
    const blockHeader = getBlockHeader({ number, timestamp, transactionsRoot, receiptsRoot })
    assert.ok(
      new MerkleTree([blockHeader]).verify(
        blockHeader,
        parseInt(number, 10) - parseInt(header.start, 10),
        utils.toBuffer(header.root),
        proof
      ),
      'WITHDRAW_BLOCK_NOT_A_PART_OF_SUBMITTED_HEADER'
    )
  }

  async withdrawBurntTokens(inputs, exitTx) {
    let exitId = 0;
    for (let i = 0; i < inputs.length; i++) {
      const header = rootChain.headers(input.headerNumber)
      this.verifyReceipt(input[i])
    }
  }

  async withdrawBurntTokens(
    txProof, receiptProof,
    number, timestamp, transactionsRoot, receiptsRoot, proof,
    options
  ) {
    txProof.proof = transactionsRoot
    assert.ok(Proofs.verifyTxProof(txProof), "txProof failed")
    receiptProof.proof = receiptsRoot
    assert.ok(Proofs.verifyTxProof(receiptProof), "receiptProof failed")

    const blockHeader = getBlockHeader({ number, timestamp, transactionsRoot, receiptsRoot })
    // console.log('blockHeader 2', blockHeader)
    assert.ok(
      new MerkleTree([blockHeader]).verify(
        blockHeader,
        parseInt(number, 10) - parseInt(options.start, 10),
        utils.toBuffer(options.root),
        proof
      ),
      'WITHDRAW_BLOCK_NOT_A_PART_OF_SUBMITTED_HEADER'
    )
  }

  // async withdrawBurntTokens(
  //   headerNumber, withdrawBlockProof, withdrawBlockNumber, withdrawBlockTime,
  //   withdrawBlockTxRoot, withdrawBlockReceiptRoot,
  //   path, withdrawTx, withdrawTxProof, withdrawReceipt, withdrawReceiptProof,
  //   sender, options
  // ) {
  //   merklePatriciaProof.verify(withdrawTx, )
  //   let { rootToken, amountOrTokenId } = this.childChainVerifier.processBurnReceipt(
  //     withdrawReceipt, path, withdrawReceiptProof, withdrawBlockReceiptRoot, sender, options.receiptProof)
  //   console.log(rootToken, amountOrTokenId)
  //   // rootToken = this.registry.childToRootToken[rootToken]
  //   const exitObject = { rootToken, amountOrTokenId, burnt: true }
  //   await this.bla(headerNumber, withdrawBlockProof, withdrawBlockNumber, withdrawBlockTime, withdrawBlockTxRoot, withdrawBlockReceiptRoot)
  //   // await this._withdraw(
  //   //   exitObject, headerNumber, withdrawBlockProof, withdrawBlockNumber, withdrawBlockTime,
  //   //   withdrawBlockTxRoot, withdrawBlockReceiptRoot, path, 0 /* oIndex */, options
  //   // )
  // }

  async _withdraw(
    exitObject, headerNumber, withdrawBlockProof, withdrawBlockNumber, withdrawBlockTime,
    withdrawBlockTxRoot, withdrawBlockReceiptRoot, path, oIndex, options
  ) {
    this.bla()
    const _exitId = this.getExitId(headerNumber, withdrawBlockNumber, path, oIndex)
    this._addExitToQueue(exitObject, _exitId)
  }

  _addExitToQueue(_exitObject, _exitId) {
    console.log(_exitObject, _exitId)
    let key = utils.keccak256(_exitObject.token, _exitObject.owner)
    // if (this.registry.isERC721[_exitObject.token]) {
    //   key = utils.keccak256(_exitObject.token, _exitObject.owner, _exitObject.receiptAmountOrNFTId)
    // } else {
    //   // validate amount
    //   // this.require(_exitObject.receiptAmountOrNFTId > 0, "CANNOT_EXIT_ZERO_AMOUNTS")
    //   key = utils.keccak256(_exitObject.token, _exitObject.owner)
    // }
    // validate token exit
    assert.ok(this.ownerExits[key] == null, 'EXIT_ALREADY_IN_PROGRESS')

    // Calculate priority.
    const token = _exitObject.rootToken
    console.log('in _addExitToQueue', token)
    const exitableAt = moment().add(7, 'days').valueOf()
    if (!this.exitsQueues[token]) this.createExitQueue(token)
    this.exitsQueues[token].queue({ exitableAt, exitId: _exitId })
    console.log(this.exitsQueues[token].dequeue())
    // // create NFT for exit UTXO
    // // @todo
    // // ExitNFT(exitNFTContract).mint(_exitObject.owner, _exitId);
    this.exits[_exitId] = _exitObject
    this.ownerExits[key] = _exitId
  }

  createExitQueue(token) {
    console.log('in createExitQueue', token)
    this.exitsQueues[token] = new PriorityQueue({ comparator: (a, b) => a.exitableAt - b.exitableAt })
  }

  getExitId(headerNumber, withdrawBlockNumber, txIndex, oIndex) {
    // return headerNumber * 1000 + withdrawBlockNumber * 100 + txIndex * 10 + oIndex
    return new BN(headerNumber).mul(HEADER_BLOCK_NUMBER_WEIGHT)
    .add(new BN(withdrawBlockNumber).mul(WITHDRAW_BLOCK_NUMBER_WEIGHT))
    .add(new BN(txIndex).mul(TX_INDEX_WEIGHT))
    .add(new BN(oIndex))
  }
}

module.exports = WithdrawManager
