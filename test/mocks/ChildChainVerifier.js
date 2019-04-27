const utils = require('ethereumjs-util')
const assert = require('assert')

// const merklePatriciaProof = require('./common/lib/MerklePatriciaProof')
const verifyReceiptProof = require('../../test/helpers/proofs').verifyReceiptProof

class ChildChainVerifier {
  processBurnReceipt(receiptBytes, path, receiptProof, receiptRoot, sender, _receiptProof) {
    // console.log(receiptBytes, 'receiptBytes')
    let items = utils.rlp.decode(utils.toBuffer(receiptBytes))
    // console.log('length', utils.rlp.decode(receiptBytes).length)
    assert.ok(items.length === 4, 'not 4 items')

    items = items[3][1]
    assert.ok(items.length === 3, 'not 3 items')

    // const childToken = items[0]
    // Investigate why this is giving > 32 bytes?
    const amountOrTokenId = '0x' + items[2].toString('hex').slice(0, 64) // equivalent of toUint()
    // const amountOrTokenId = items[2]
    console.log('amountOrTokenId', amountOrTokenId)

    items = items[1]
    assert.ok(items.length === 3, 'not 3 items')
    assert.ok(
      '0x' + items[0].toString('hex') === '0xebff2602b3f468259e1e99f613fed6691f3a6526effe6ef3e768ba7ae7a36c4f',
      'WITHDRAW_EVENT_SIGNATURE_NOT_FOUND'
    )

    const rootToken = this.bytesToHex(items[1], 12)
    // console.log('rootToken', rootToken)
    // assert.ok(
    //   registry.rootToChildToken(rootToken) === childToken,
    //   'INVALID_ROOT_TO_CHILD_TOKEN_MAPPING'
    // )
    assert.ok(sender === this.bytesToHex(items[2], 12), 'WRONG_SENDER')

    assert.ok(
      verifyReceiptProof(_receiptProof),
      // merklePatriciaProof.verify(receiptBytes, path, receiptProof, receiptRoot),
      'INVALID_RECEIPT_MERKLE_PROOF'
    )
    return { rootToken, amountOrTokenId }
  }

  bytesToHex(buf, offset) {
    // return buf.toString('hex').toLowerCase().slice(offset * 2)
    return '0x' + buf.toString('hex').toLowerCase().slice(offset * 2)
  }
}

module.exports = ChildChainVerifier
