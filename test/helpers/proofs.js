import Trie from 'merkle-patricia-tree'
import utils from 'ethereumjs-util'
import EthereumTx from 'ethereumjs-tx'
import EthereumBlock from 'ethereumjs-block/from-rpc'
import MerkleTree from '../helpers/merkle-tree.js'

const rlp = utils.rlp

// raw header
function getRawHeader(_block) {
  if (typeof _block.difficulty !== 'string') {
    _block.difficulty = '0x' + _block.difficulty.toString(16)
  }

  const block = new EthereumBlock(_block)
  return block.header
}

// squanch transaction
export function squanchTx(tx) {
  tx.gasPrice = '0x' + parseInt(tx.gasPrice).toString(16)
  tx.value = '0x' + parseInt(tx.value).toString(16) || '0'
  tx.gas = '0x' + parseInt(tx.gas).toString(16)
  tx.data = tx.input
  return tx
}

export async function rewradsTree(validators, accountState) {
  let leafs = []
  let i = 0
  validators.map(key => {
    leafs[i++] = utils.keccak256(
      web3.eth.abi.encodeParameters(
        ['uint256', 'uint256'],
        [key, accountState[key]]
      )
    )
  })
  return new MerkleTree(leafs)
}

export async function buildTreeFee(validators, accountState, checkpointIndex) {
  let leafs = []
  let i = 0
  validators.map(key => {
    const state = accountState[key][checkpointIndex] || [0]
    leafs[i++] = utils.keccak256(
      web3.eth.abi.encodeParameters(
        ['address', 'uint256'],
        [key, state[0].toString()]
      )
    )
  })
  return new MerkleTree(leafs)
}

function nibblesToTraverse(encodedPartialPath, path, pathPtr) {
  let partialPath
  if (
    String(encodedPartialPath[0]) === '0' ||
    String(encodedPartialPath[0]) === '2'
  ) {
    partialPath = encodedPartialPath.slice(2)
  } else {
    partialPath = encodedPartialPath.slice(1)
  }

  if (partialPath === path.slice(pathPtr, pathPtr + partialPath.length)) {
    return partialPath.length
  } else {
    throw new Error('path was wrong')
  }
}

export function getTxBytes(tx) {
  const txObj = new EthereumTx(squanchTx(tx))
  return txObj.serialize()
}

// build
export async function getTxProof(tx, block) {
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
          blockHash: utils.toBuffer(tx.blockHash),
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

export function verifyTxProof(proof) {
  const path = proof.path.toString('hex')
  const value = proof.value
  const parentNodes = proof.parentNodes
  const txRoot = proof.root
  try {
    var currentNode
    var len = parentNodes.length
    var nodeKey = txRoot
    var pathPtr = 0
    for (var i = 0; i < len; i++) {
      currentNode = parentNodes[i]
      const encodedNode = Buffer.from(
        utils.keccak256(rlp.encode(currentNode)),
        'hex'
      )
      if (!nodeKey.equals(encodedNode)) {
        return false
      }
      if (pathPtr > path.length) {
        return false
      }
      switch (currentNode.length) {
        case 17: // branch node
          if (pathPtr === path.length) {
            if (currentNode[16] === rlp.encode(value)) {
              return true
            } else {
              return false
            }
          }
          nodeKey = currentNode[parseInt(path[pathPtr], 16)] // must === sha3(rlp.encode(currentNode[path[pathptr]]))
          pathPtr += 1
          break
        case 2:
          pathPtr += nibblesToTraverse(
            currentNode[0].toString('hex'),
            path,
            pathPtr
          )
          if (pathPtr === path.length) {
            // leaf node
            if (currentNode[1].equals(rlp.encode(value))) {
              return true
            } else {
              return false
            }
          } else {
            // extension node
            nodeKey = currentNode[1]
          }
          break
        default:
          console.log('all nodes must be length 17 or 2')
          return false
      }
    }
  } catch (e) {
    console.log(e)
    return false
  }
  return false
}

export function getReceiptBytes(receipt) {
  return rlp.encode([
    utils.toBuffer(
      receipt.status !== undefined && receipt.status != null
        ? receipt.status
          ? '0x1'
          : '0x'
        : receipt.root
    ),
    utils.toBuffer(receipt.cumulativeGasUsed),
    utils.toBuffer(receipt.logsBloom),

    // encoded log array
    receipt.logs.map(l => {
      // [address, [topics array], data]
      return [
        utils.toBuffer(l.address), // convert address to buffer
        l.topics.map(utils.toBuffer), // convert topics to buffer
        utils.toBuffer(l.data) // convert data to buffer
      ]
    })
  ])
}

export async function getReceiptProof(receipt, block, web3, receipts) {
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
          blockHash: utils.toBuffer(receipt.blockHash),
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

export function verifyReceiptProof(proof) {
  return verifyTxProof(proof, true)
}
