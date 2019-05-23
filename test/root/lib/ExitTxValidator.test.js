import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import utils from 'ethereumjs-util'

import { ExitTxValidator } from '../../helpers/artifacts'
import { buildInFlight } from '../../mockResponses/utils'
import burn from '../../mockResponses/burn'
import incomingTransfer from '../../mockResponses/incomingTransfer'

chai
  .use(chaiAsPromised)
  .should()

contract('ExitTxValidator', async function(accounts) {
  describe('processExitTx', async function() {
    let instance
    beforeEach(async function() {
      instance = await ExitTxValidator.deployed()
    })

    it('processExitTxSender - WITHDRAW', async function() {
      const exitTx = await buildInFlight(burn.tx)
      const res = await instance.processExitTx(utils.bufferToHex(exitTx))
      // console.log(res)
      expect(res.exitAmountOrTokenId.toNumber()).to.equal(parseInt(burn.tx.input.slice(10), 16))
      expect(res.childToken).to.equal(burn.tx.to)
      expect(res.participant).to.equal(burn.tx.from)
      expect(res.burnt).to.be.true
    })

    it('processExitTxCounterparty - TRANSFER', async function() {
      const event = incomingTransfer
      const exitTx = await buildInFlight(event.tx)
      const res = await instance.processExitTx(utils.bufferToHex(exitTx))
      // console.log(res)
      expect(res.exitAmountOrTokenId.toNumber()).to.equal(parseInt(event.tx.input.slice(74), 16))
      expect(res.childToken).to.equal(event.tx.to)
      expect(res.participant).to.equal(event.tx.from)
      expect(res.burnt).to.be.false
    })
  })
})
