const utils = require('ethereumjs-util')
const Buffer = require('safe-buffer').Buffer

const sha3 = utils.keccak256
const BN = utils.BN

async function getHeaders(start, end, web3) {
  if (start >= end) {
    return []
  }

  let current = start
  let p = []
  let result = []
  while (current <= end) {
    p = []

    for (let i = 0; i < 10 && current <= end; i++) {
      p.push(web3.eth.getBlock(current))
      current++
    }

    if (p.length > 0) {
      result.push(...(await Promise.all(p)))
    }
  }

  return result.map(getBlockHeader)
}

function getBlockHeader(block) {
  const n = new BN(block.number).toArrayLike(Buffer, 'be', 32)
  const ts = new BN(block.timestamp).toArrayLike(Buffer, 'be', 32)
  const txRoot = utils.toBuffer(block.transactionsRoot)
  const receiptsRoot = utils.toBuffer(block.receiptsRoot)
  return sha3(Buffer.concat([n, ts, txRoot, receiptsRoot]))
}

module.exports = { getBlockHeader, getHeaders }
