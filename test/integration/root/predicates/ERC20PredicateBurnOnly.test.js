import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../../../helpers/deployer.js'
import logDecoder from '../../../helpers/log-decoder.js'
import StatefulUtils from '../../../helpers/StatefulUtils.js'
import * as predicateTestUtils from './predicateTestUtils.js'

import * as utils from '../../../helpers/utils.js'

chai.use(chaiAsPromised).should()
const assert = chai.assert

const amount = web3.utils.toBN('10').mul(utils.scalingFactor)
let contracts, childContracts, statefulUtils, user

describe('ERC20PredicateBurnOnly @skip-on-coverage', async function (accounts) {

  before(async function () {
    accounts = await ethers.getSigners()
    accounts = accounts.map((account) => {
      return account.address
    })

    contracts = await deployer.freshDeploy(accounts[0])
    childContracts = await deployer.initializeChildChain()
    statefulUtils = new StatefulUtils()

    user = accounts[0]
  })

  describe('startExitWithBurntTokens', async function () {
    beforeEach(async function () {
      contracts.withdrawManager = await deployer.deployWithdrawManager()
      contracts.ERC20PredicateBurnOnly = await deployer.deployErc20PredicateBurnOnly()
    })

    it('Exit with burnt tokens', async function () {
      const { rootERC20, childToken } = await deployer.deployChildErc20()
      childContracts.rootERC20 = rootERC20
      childContracts.childToken = childToken
      await utils.deposit(contracts.depositManager, childContracts.childChain, childContracts.rootERC20, user, amount, {
        rootDeposit: true,
        erc20: true
      })

      const receipt = await (await childContracts.childToken.withdraw(amount.toString())).wait()
      let { block, blockProof, headerNumber, reference } = await statefulUtils.submitCheckpoint(
        contracts.rootChain,
        receipt,
        accounts
      )

      const startExitTx = await (await utils.startExitWithBurntTokens(contracts.ERC20PredicateBurnOnly, {
        headerNumber,
        blockProof,
        blockNumber: block.number,
        blockTimestamp: block.timestamp,
        reference,
        logIndex: 1
      })).wait()
      let logs = logDecoder.decodeLogs(startExitTx.events, contracts.withdrawManager.interface)
      let log = logs[utils.filterEvent(logs, 'ExitStarted')]

      chai.assert.deepEqual(log.args.exitor, user)
      chai.assert.deepEqual(log.args.token, childContracts.rootERC20.address)
      chai.assert.deepEqual(log.args.isRegularExit, true)
      utils.assertBigNumberEquality(log.args.amount, amount)

      const processExits = await (await predicateTestUtils.processExits(
        contracts.withdrawManager,
        childContracts.rootERC20.address
      )).wait()
      // if the event is part of the ABI of the contract we called,
      // the event will already be parsed
      log = processExits.events[utils.filterEvent(processExits.events, 'Withdraw')]
      chai.assert.deepEqual(log.args.token, rootERC20.address)
      
      try {
        await utils.startExitWithBurntTokens(contracts.ERC20PredicateBurnOnly, {
          headerNumber,
          blockProof,
          blockNumber: block.number,
          blockTimestamp: block.timestamp,
          reference,
          logIndex: 1
        })
        assert.fail('was able to start an exit again with the same tx')
      } catch (e) {
        assert(e.message.search('KNOWN_EXIT') >= 0)
      }
    })

    it('Exit with burnt Matic tokens', async function () {
      const { rootERC20, childToken } = await deployer.deployMaticToken()
      childContracts.rootERC20 = rootERC20
      childContracts.childToken = childToken
      await utils.deposit(contracts.depositManager, childContracts.childChain, childContracts.rootERC20, user, amount)
      const receipt = await (
        await childContracts.childToken.withdraw(amount.toString(), { value: amount.toString() })
      ).wait()
      let { block, blockProof, headerNumber, reference } = await statefulUtils.submitCheckpoint(
        contracts.rootChain,
        receipt,
        accounts
      )
      const startExitTx = await (await utils.startExitWithBurntTokens(contracts.ERC20PredicateBurnOnly, {
        headerNumber,
        blockProof,
        blockNumber: block.number,
        blockTimestamp: block.timestamp,
        reference,
        logIndex: 1
      })).wait()
      const logs = logDecoder.decodeLogs(startExitTx.events, contracts.withdrawManager.interface)
      // console.log(startExitTx, logs)
      let log = logs[utils.filterEvent(logs, 'ExitStarted')]

      chai.assert.deepEqual(log.args.exitor, user)
      chai.assert.deepEqual(log.args.token, childContracts.rootERC20.address)
      chai.assert.deepEqual(log.args.isRegularExit, true)
      utils.assertBigNumberEquality(log.args.amount, amount)
    })
  })
})
