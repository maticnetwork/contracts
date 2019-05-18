import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import utils from 'ethereumjs-util'

import { ExitTxValidator } from '../../helpers/artifacts'
import { buildInFlight } from '../../mockResponses/utils'
import burn from '../../mockResponses/burn'

chai
  .use(chaiAsPromised)
  .should()

contract('ExitTxValidator', async function(accounts) {
  describe('processExitTx', async function() {
    it('burn', async function() {
      const instance = await ExitTxValidator.deployed()
      const exitTx = await buildInFlight(burn.tx)
      const res = await instance.processExitTx(
        utils.bufferToHex(exitTx),
        burn.tx.to,
        burn.tx.from
      )
      // console.log(res)
      expect(res.exitAmount.toNumber()).to.equal(parseInt(burn.tx.input.slice(10), 16))
      expect(res.burnt).to.be.true
    })
  })
})
