import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import utils from 'ethereumjs-util'

import { ChildChainVerifier } from '../../helpers/artifacts'
import { build } from '../../mockResponses/utils'
import incomingTransfer from '../../mockResponses/incomingTransfer'

const rlp = utils.rlp
chai
  .use(chaiAsPromised)
  .should()

contract('ChildChainVerifier', async function(accounts) {
  describe('processReferenceTx', async function() {
    it('incomingTransfer', async function() {
      const instance = await ChildChainVerifier.deployed()
      const input = await build(incomingTransfer)
      const res = await instance.processReferenceTx(
        utils.bufferToHex(input.receiptsRoot),
        utils.bufferToHex(input.receipt),
        utils.bufferToHex(rlp.encode(input.receiptParentNodes)),

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
