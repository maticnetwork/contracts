import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../../../helpers/deployer.js'
import logDecoder from '../../../helpers/log-decoder.js'
import { buildInFlight } from '../../../mockResponses/utils'
import StatefulUtils from '../../../helpers/StatefulUtils'
const predicateTestUtils = require('./predicateTestUtils')

const utils = require('../../../helpers/utils')
const web3Child = utils.web3Child

chai.use(chaiAsPromised).should()
let contracts, childContracts, statefulUtils

contract('ERC20PredicateBurnOnly @skip-on-coverage', async function(accounts) {
  const amount = web3.utils.toBN('10').mul(utils.scalingFactor)
  const halfAmount = web3.utils.toBN('5').mul(utils.scalingFactor)
  const user = accounts[0]
  const other = accounts[1]

  before(async function() {
    contracts = await deployer.freshDeploy(accounts[0])
    childContracts = await deployer.initializeChildChain(accounts[0])
    statefulUtils = new StatefulUtils()
  })

  describe('startExitWithBurntTokens', async function() {
    beforeEach(async function() {
      contracts.withdrawManager = await deployer.deployWithdrawManager()
      contracts.ERC20Predicate = await deployer.deployErc20Predicate(true)
    })

    it('Exit with burnt tokens', async function() {
      const { rootERC20, childToken } = await deployer.deployChildErc20(accounts[0])
      childContracts.rootERC20 = rootERC20
      childContracts.childToken = childToken
      await utils.deposit(
        contracts.depositManager,
        childContracts.childChain,
        childContracts.rootERC20,
        user,
        amount
      )
      const { receipt } = await childContracts.childToken.withdraw(amount)
      let { block, blockProof, headerNumber, reference } = await statefulUtils.submitCheckpoint(contracts.rootChain, receipt, accounts)
      const startExitTx = await utils.startExitWithBurntTokens(
        contracts.ERC20Predicate,
        { headerNumber, blockProof, blockNumber: block.number, blockTimestamp: block.timestamp, reference, logIndex: 1 }
      )
      const logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
      let log = logs[utils.filterEvent(logs, 'ExitStarted')]
      expect(log.args).to.include({
        exitor: user,
        token: childContracts.rootERC20.address,
        isRegularExit: true
      })
      utils.assertBigNumberEquality(log.args.amount, amount)

      const processExits = await predicateTestUtils.processExits(contracts.withdrawManager, childContracts.rootERC20.address)
      processExits.logs.forEach(log => {
        log.event.should.equal('Withdraw')
        expect(log.args).to.include({ token: rootERC20.address })
      })
      try {
        await utils.startExitWithBurntTokens(
          contracts.ERC20Predicate,
          { headerNumber, blockProof, blockNumber: block.number, blockTimestamp: block.timestamp, reference, logIndex: 1 }
        )
        assert.fail('was able to start an exit again with the same tx')
      } catch(e) {
        assert(e.message.search('KNOWN_EXIT') >= 0)
      }
    })

    it('Exit with burnt Matic tokens', async function() {
      const { rootERC20, childToken } = await deployer.deployMaticToken()
      childContracts.rootERC20 = rootERC20
      childContracts.childToken = childToken
      await utils.deposit(
        contracts.depositManager,
        childContracts.childChain,
        childContracts.rootERC20,
        user,
        amount
      )
      const { receipt } = await childContracts.childToken.withdraw(amount, { value: amount })
      let { block, blockProof, headerNumber, reference } = await statefulUtils.submitCheckpoint(contracts.rootChain, receipt, accounts)
      const startExitTx = await utils.startExitWithBurntTokens(
        contracts.ERC20Predicate,
        { headerNumber, blockProof, blockNumber: block.number, blockTimestamp: block.timestamp, reference, logIndex: 1 }
      )
      const logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
      // console.log(startExitTx, logs)
      let log = logs[utils.filterEvent(logs, 'ExitStarted')]
      expect(log.args).to.include({
        exitor: user,
        token: childContracts.rootERC20.address,
        isRegularExit: true
      })
      utils.assertBigNumberEquality(log.args.amount, amount)
    })
  })
})
