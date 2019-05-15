import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
const utils = require('ethereumjs-util')

const Proofs = require('../helpers/proofs')
import { ExitTxValidator } from '../helpers/artifacts'

// import deployer from './helpers/deployer.js'
import burn from '../mockResponses/burn'

chai
  .use(chaiAsPromised)
  .should()

contract("ExitTxValidator", async function(accounts) {
  describe("processExitTx", async function() {
    it("burn", async function() {
      const instance = await ExitTxValidator.deployed()
      const exitTx = await buildInFlight(burn)
      const res = await instance.processExitTx(
        utils.bufferToHex(exitTx),
        burn.tx.from
      )
      // console.log(res)
      expect(res.token).to.equal(burn.tx.to)
      expect(res.exitAmount.toNumber()).to.equal(parseInt(burn.tx.input.slice(10), 16))
      expect(res.burnt).to.be.true
    })
  })
})

function buildInFlight(event) {
  // no receipt, no block
  return Proofs.getTxBytes(event.tx)
}
