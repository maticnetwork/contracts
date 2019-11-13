const BN = require('bn.js')
const Trie = require('merkle-patricia-tree')
const EthereumTx = require('ethereumjs-tx')
const ethUtils = require('ethereumjs-util')
const MerkleTree = require('./merkle-tree')
const EthereumBlock = require('ethereumjs-block/from-rpc')

const rlp = ethUtils.rlp

function getBlockHeader(block) {
  const n = new BN(block.number).toArrayLike(Buffer, 'be', 32)
  const ts = new BN(block.timestamp).toArrayLike(Buffer, 'be', 32)
  const txRoot = ethUtils.toBuffer(block.transactionsRoot)
  const receiptsRoot = ethUtils.toBuffer(block.receiptsRoot)
  return ethUtils.keccak256(Buffer.concat([n, ts, txRoot, receiptsRoot]))
}

async function buildCheckpointRoot(web3, start, end) {
  console.log('buildCheckpointRoot...')
  const tree = await buildBlockHeaderMerkle(web3, start, end)
  return ethUtils.bufferToHex(tree.getRoot())
}

async function buildBlockProof(web3, start, end, blockNumber) {
  console.log('buildBlockProof...', start, end, blockNumber)
  const tree = await buildBlockHeaderMerkle(web3, start, end)
  const proof = tree.getProof(getBlockHeader(await web3.eth.getBlock(blockNumber, true)))
  return ethUtils.bufferToHex(Buffer.concat(proof))
}

async function buildBlockHeaderMerkle(web3, start, end) {
  const headers = []
  for (let i = start; i <= end; i++) {
    console.log('fetching block', i)
    const _blockHeader = getBlockHeader(await web3.eth.getBlock(i, true))
    headers.push(_blockHeader)
  }
  return new MerkleTree(headers)
}

async function getTxProof(tx, block) {
  const txTrie = new Trie()
  for (let i = 0; i < block.transactions.length; i++) {
    const siblingTx = block.transactions[i]
    const path = rlp.encode(siblingTx.transactionIndex)
    const rawSignedSiblingTx = getTxBytes(siblingTx)
    await new Promise((resolve, reject) => {
      txTrie.put(path, rawSignedSiblingTx, err => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  // promise
  return new Promise((resolve, reject) => {
    txTrie.findPath(
      rlp.encode(tx.transactionIndex),
      (err, rawTxNode, reminder, stack) => {
        if (err) {
          return reject(err)
        }

        if (reminder.length > 0) {
          return reject(new Error('Node does not contain the key'))
        }

        const prf = {
          blockHash: ethUtils.toBuffer(tx.blockHash),
          parentNodes: stack.map(s => s.raw),
          root: getRawHeader(block).transactionsTrie,
          path: rlp.encode(tx.transactionIndex),
          value: rlp.decode(rawTxNode.value)
        }
        resolve(prf)
      }
    )
  })
}

function getTxBytes(tx) {
  console.log('in getTxBytes')
  const txObj = new EthereumTx(squanchTx(tx))
  return txObj.serialize()
}

function squanchTx(tx) {
  tx.gasPrice = '0x' + parseInt(tx.gasPrice).toString(16)
  tx.value = '0x' + parseInt(tx.value).toString(16) || '0'
  tx.gas = '0x' + parseInt(tx.gas).toString(16)
  tx.data = tx.input
  return tx
}

function getRawHeader(_block) {
  if (typeof _block.difficulty !== 'string') {
    _block.difficulty = '0x' + _block.difficulty.toString(16)
  }

  const block = new EthereumBlock(_block)
  return block.header
}

async function getReceiptProof(receipt, block, web3, receipts) {
  const receiptsTrie = new Trie()
  const receiptPromises = []
  if (!receipts) {
    block.transactions.forEach(tx => {
      receiptPromises.push(web3.eth.getTransactionReceipt(tx.hash))
    })
    receipts = await Promise.all(receiptPromises)
  }

  for (let i = 0; i < receipts.length; i++) {
    const siblingReceipt = receipts[i]
    const path = rlp.encode(siblingReceipt.transactionIndex)
    const rawReceipt = getReceiptBytes(siblingReceipt)
    await new Promise((resolve, reject) => {
      receiptsTrie.put(path, rawReceipt, err => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  // promise
  return new Promise((resolve, reject) => {
    receiptsTrie.findPath(
      rlp.encode(receipt.transactionIndex),
      (err, rawReceiptNode, reminder, stack) => {
        if (err) {
          return reject(err)
        }

        if (reminder.length > 0) {
          return reject(new Error('Node does not contain the key'))
        }

        const prf = {
          blockHash: ethUtils.toBuffer(receipt.blockHash),
          parentNodes: stack.map(s => s.raw),
          root: getRawHeader(block).receiptTrie,
          path: rlp.encode(receipt.transactionIndex),
          value: rlp.decode(rawReceiptNode.value)
        }
        resolve(prf)
      }
    )
  })
}

function getReceiptBytes(receipt) {
  return rlp.encode([
    ethUtils.toBuffer(
      receipt.status !== undefined && receipt.status != null
        ? receipt.status ? 1 : 0
        : receipt.root
    ),
    ethUtils.toBuffer(receipt.cumulativeGasUsed),
    ethUtils.toBuffer(receipt.logsBloom),

    // encoded log array
    receipt.logs.map(l => {
      // [address, [topics array], data]
      return [
        ethUtils.toBuffer(l.address), // convert address to buffer
        l.topics.map(ethUtils.toBuffer), // convert topics to buffer
        ethUtils.toBuffer(l.data) // convert data to buffer
      ]
    })
  ])
}

module.exports = {
  buildCheckpointRoot,
  buildBlockProof,
  getTxProof,
  getReceiptProof,
  getReceiptBytes
}
