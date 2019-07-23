import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../helpers/deployer.js'
import logDecoder from '../helpers/log-decoder.js'
import StatefulUtils from '../helpers/StatefulUtils'

const utils = require('../helpers/utils')
const predicateTestUtils = require('./predicates/predicateTestUtils')
const web3Child = utils.web3Child

chai.use(chaiAsPromised).should()
let contracts, childContracts, rootERC20, childErc20, statefulUtils

contract('Misc Predicates tests', async function(accounts) {
  const alice = accounts[1]
  const bob = accounts[2]

  before(async function() {
    contracts = await deployer.freshDeploy()
    childContracts = await deployer.initializeChildChain(accounts[0])
    statefulUtils = new StatefulUtils()
  })

  beforeEach(async function() {
    contracts.withdrawManager = await deployer.deployWithdrawManager()
    contracts.ERC20Predicate = await deployer.deployErc20Predicate()
    const e20 = await deployer.deployChildErc20(accounts[0])
    rootERC20 = e20.rootERC20
    childErc20 = e20.childToken
  })

  it('Alice & Bob are honest and cooperating', async function() {
    const aliceInitial = web3.utils.toBN('13')
    const bobInitial = web3.utils.toBN('9')
    const aliceToBobtransferAmount = web3.utils.toBN('7')

    // Utxo1a
    let receipt = (await utils.deposit(
      contracts.depositManager,
      childContracts.childChain,
      rootERC20,
      alice,
      aliceInitial
    )).receipt
    const utxo1a = {
      checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, receipt, accounts),
      logIndex: 1
    }
    let aliceExitId = predicateTestUtils.getAge(utxo1a)

    // Utxo1B
    receipt = (await utils.deposit(
      contracts.depositManager,
      childContracts.childChain,
      rootERC20,
      bob,
      bobInitial
    )).receipt
    const utxo1b = {
      checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, receipt, accounts),
      logIndex: 1
    }
    let bobExitId = predicateTestUtils.getAge(utxo1b)

    let inFlightTx = await predicateTestUtils.getRawInflightTx(childErc20.transfer.bind(null, bob, aliceToBobtransferAmount), alice /* from */, web3Child)

    // Alice starts an exit
    let startExitTx = await utils.startExitNew(
      contracts.ERC20Predicate,
      predicateTestUtils.buildInputFromCheckpoint([utxo1a]),
      inFlightTx,
      alice // exitor
    )
    let logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
    // console.log(startExitTx, logs)
    predicateTestUtils.assertStartExit(logs[1], alice, rootERC20.address, aliceInitial.sub(aliceToBobtransferAmount), false /* isRegularExit */, aliceExitId)
    predicateTestUtils.assertExitUpdated(logs[2], alice, aliceExitId)

    // Bob starts an exit
    startExitTx = await utils.startExitNew(
      contracts.ERC20Predicate,
      predicateTestUtils.buildInputFromCheckpoint([
        utxo1a, // proof-of-funds of counterparty
        utxo1b // proof-of-funds of exitor
      ]),
      inFlightTx,
      bob // exitor
    )
    logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
    // console.log(startExitTx, logs)
    predicateTestUtils.assertStartExit(logs[1], bob, rootERC20.address, bobInitial.add(aliceToBobtransferAmount), false /* isRegularExit */, bobExitId)
    predicateTestUtils.assertExitUpdated(logs[2], alice, bobExitId, aliceExitId)
    predicateTestUtils.assertExitUpdated(logs[3], bob, bobExitId)
  })
})
