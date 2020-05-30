import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../../helpers/deployer.js'
import StatefulUtils from '../../helpers/StatefulUtils'

const predicateTestUtils = require('./predicates/predicateTestUtils')
const utils = require('../../helpers/utils')

chai.use(chaiAsPromised).should()
let contracts, childContracts, statefulUtils, erc20Predicate

contract('WithdrawManager @skip-on-coverage', async function(accounts) {
  const amount = web3.utils.toBN('10')
  const owner = accounts[0]
  const user = accounts[1]
  const other = accounts[2]

  describe('startExitWithDepositedTokens', async function() {
    before(async function() {
      contracts = await deployer.freshDeploy()
      statefulUtils = new StatefulUtils()
      erc20Predicate = await deployer.deployErc20Predicate()
      childContracts = await deployer.initializeChildChain(owner)
      const { rootERC20, childToken } = await deployer.deployChildErc20(owner)
      contracts.rootERC20 = rootERC20
      childContracts.childToken = childToken
    })

    it('start and challenge exit started with deposited tokens', async function() {
      // mint tokens to user account for testing
      await contracts.rootERC20.mint(user, amount)

      // deposit tokens to plasma and mint on child chain
      const depositTx = await utils.deposit(
        contracts.depositManager, childContracts.childChain,
        contracts.rootERC20, user, amount,
        { rootDeposit: true, erc20: true } // options
      )
      const depositId = depositTx.logs[0].args.depositCount // TokenDeposited
      expect(depositId.toString()).to.equal('1') // first deposit
      const { depositHash, createdAt } = await contracts.depositManager.deposits(depositId)
      expect(depositHash).to.equal(web3.utils.soliditySha3(user, contracts.rootERC20.address, amount))

      const exitTx = await contracts.withdrawManager.startExitWithDepositedTokens(
        depositId,
        contracts.rootERC20.address,
        amount,
        { value: web3.utils.toWei('.1', 'ether'), from: user }
      )
      let log = exitTx.logs[0]
      const ageOfInput = createdAt.add(web3.utils.toBN(7 * 86400)).shln(127)
      const exitId = ageOfInput.shln(1)
      await predicateTestUtils.assertStartExit(log, user, contracts.rootERC20.address, amount, false /* isRegularExit */, exitId, contracts.exitNFT)
      predicateTestUtils.assertExitUpdated(exitTx.logs[1], user, exitId, ageOfInput)

      // The test above is complete in itself, now the challenge part
      // assuming the exitor made spending txs on child chain
      const { receipt } = await childContracts.childToken.transfer(other, amount, { from: user })
      const utxo = { checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, receipt, accounts), logIndex: 1 }
      const challengeData = utils.buildChallengeData(predicateTestUtils.buildInputFromCheckpoint(utxo))
      // This will be used to assert that challenger received the bond amount
      const originalBalance = web3.utils.toBN(await web3.eth.getBalance(owner))
      const challenge = await contracts.withdrawManager.challengeExit(exitId, ageOfInput, challengeData, erc20Predicate.address)
      await predicateTestUtils.assertChallengeBondReceived(challenge, originalBalance)
      log = challenge.logs[0]
      log.event.should.equal('ExitCancelled')
      utils.assertBigNumberEquality(log.args.exitId, exitId)
    })
  })
})
