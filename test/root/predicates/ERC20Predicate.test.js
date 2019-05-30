import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../../helpers/deployer.js'
import logDecoder from '../../helpers/log-decoder.js'
import utils from 'ethereumjs-util'

import {
  getTxProof,
  verifyTxProof,
  getReceiptProof,
  verifyReceiptProof
} from '../../helpers/proofs'
import {
  buildSubmitHeaderBlockPaylod,
  assertBigNumberEquality
} from '../../helpers/utils.js'

import { getBlockHeader } from '../../helpers/blocks'
import MerkleTree from '../../helpers/merkle-tree'

import { build, buildInFlight } from '../../mockResponses/utils'

const crypto = require('crypto')
const rlp = utils.rlp
const web3Child = new web3.constructor(
  new web3.providers.HttpProvider('http://localhost:8546')
)

chai.use(chaiAsPromised).should()
let contracts, childContracts, start

contract('ERC20Predicate', async function(accounts) {
  const amount = web3.utils.toBN('10')
  const halfAmount = web3.utils.toBN('5')
  const user = accounts[0]
  const other = accounts[1]

  before(async function() {
    contracts = await deployer.freshDeploy()
    childContracts = await deployer.initializeChildChain(accounts[0])
  })

  describe('startExit', async function() {
    beforeEach(async function() {
      contracts.withdrawManager = await deployer.deployWithdrawManager()
      contracts.ERC20Predicate = await deployer.deployErc20Predicate()
      const { rootERC20, childToken } = await deployer.deployChildErc20(accounts[0])
      childContracts.rootERC20 = rootERC20
      childContracts.childToken = childToken
      // start = 0
    })

    it('reference: deposit - exitTx: fullBurn')

    it('reference: incomingTransfer - exitTx: fullBurn', async function() {
      await deposit(
        contracts.depositManager,
        childContracts.childChain,
        childContracts.rootERC20,
        other,
        amount
      )
      const { receipt } = await childContracts.childToken.transfer(user, amount, { from: other })
      const { block, blockProof, headerNumber, reference } = await init(contracts.rootChain, receipt, accounts)
      const { receipt: r } = await childContracts.childToken.withdraw(amount)
      let exitTx = await web3Child.eth.getTransaction(r.transactionHash)
      exitTx = await buildInFlight(exitTx)

      const startExitTx = await startExit(headerNumber, blockProof, block.number, block.timestamp, reference, 1, /* logIndex */ exitTx)
      const logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
      // console.log(startExitTx, logs)
      const log = logs[1]
      log.event.should.equal('ExitStarted')
      expect(log.args).to.include({
        exitor: user,
        token: childContracts.rootERC20.address
      })
      assertBigNumberEquality(log.args.amount, amount)
    })

    it('reference: outgoingTransfer - exitTx: fullBurn', async function() {
      await deposit(
        contracts.depositManager,
        childContracts.childChain,
        childContracts.rootERC20,
        user,
        amount
      )

      const { receipt } = await childContracts.childToken.transfer(other, halfAmount)
      const { block, blockProof, headerNumber, reference } = await init(contracts.rootChain, receipt, accounts)

      const { receipt: r } = await childContracts.childToken.withdraw(halfAmount)
      let exitTx = await web3Child.eth.getTransaction(r.transactionHash)
      exitTx = await buildInFlight(exitTx)

      const startExitTx = await startExit(headerNumber, blockProof, block.number, block.timestamp, reference, 1, /* logIndex */ exitTx)
      const logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
      // console.log(startExitTx, logs)
      const log = logs[1]
      log.event.should.equal('ExitStarted')
      expect(log.args).to.include({
        exitor: user,
        token: childContracts.rootERC20.address
      })
      assertBigNumberEquality(log.args.amount, halfAmount)
    })

    it('reference: deposit - exitTx: outgoingTransfer', async function() {
      // Reference the counterparty's deposit which is the proof of counterparty's balance
      const { receipt } = await deposit(
        contracts.depositManager,
        childContracts.childChain,
        childContracts.rootERC20,
        user,
        amount
      )
      const { block, blockProof, headerNumber, reference } = await init(contracts.rootChain, receipt, accounts)
      // Treating this tx as an in-flight incoming transfer
      const { receipt: r } = await childContracts.childToken.transfer(other, halfAmount)
      let exitTx = await web3Child.eth.getTransaction(r.transactionHash)
      exitTx = await buildInFlight(exitTx)

      const startExitTx = await startExit(headerNumber, blockProof, block.number, block.timestamp, reference, 1, /* logIndex */ exitTx)
      // console.log('startExitTx', startExitTx.closingBalance.toNumber())
      const logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
      // console.log(startExitTx, logs)
      const log = logs[1]
      log.event.should.equal('ExitStarted')
      expect(log.args).to.include({
        exitor: user,
        token: childContracts.rootERC20.address
      })
      assertBigNumberEquality(log.args.amount, halfAmount)
    })

    it('reference: counterparty balance (Deposit) - exitTx: incomingTransfer', async function() {
      // Reference the counterparty's deposit which is the proof of counterparty's balance
      const { receipt } = await deposit(
        contracts.depositManager,
        childContracts.childChain,
        childContracts.rootERC20,
        other,
        amount
      )
      const { block, blockProof, headerNumber, reference } = await init(contracts.rootChain, receipt, accounts)

      // Treating this tx as an in-flight incoming transfer
      const { receipt: r } = await childContracts.childToken.transfer(user, halfAmount, { from: other })
      let exitTx = await web3Child.eth.getTransaction(r.transactionHash)
      exitTx = await buildInFlight(exitTx)

      const startExitTx = await startExit(headerNumber, blockProof, block.number, block.timestamp, reference, 1, /* logIndex */ exitTx)
      const logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
      // console.log(startExitTx, logs)
      const log = logs[1]
      log.event.should.equal('ExitStarted')
      expect(log.args).to.include({
        exitor: user,
        token: childContracts.rootERC20.address
      })
      assertBigNumberEquality(log.args.amount, halfAmount)
    })

    it('reference: counterparty balance (Transfer) - exitTx: incomingTransfer', async function() {
      await deposit(
        contracts.depositManager,
        childContracts.childChain,
        childContracts.rootERC20,
        user,
        amount
      )

      // We will reference the following tx which is a proof of counterparty's balance
      const { receipt } = await childContracts.childToken.transfer(other, amount)
      const { block, blockProof, headerNumber, reference } = await init(contracts.rootChain, receipt, accounts)

      // Treating this tx as an in-flight incoming transfer
      const { receipt: r } = await childContracts.childToken.transfer(user, halfAmount, { from: other })
      let exitTx = await web3Child.eth.getTransaction(r.transactionHash)
      exitTx = await buildInFlight(exitTx)

      const startExitTx = await startExit(headerNumber, blockProof, block.number, block.timestamp, reference, 1, /* logIndex */ exitTx)
      const logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
      // console.log(startExitTx, logs)
      const log = logs[1]
      log.event.should.equal('ExitStarted')
      expect(log.args).to.include({
        exitor: user,
        token: childContracts.rootERC20.address
      })
      assertBigNumberEquality(log.args.amount, halfAmount)
    })

    it('reference: own balance (Deposit) and counterparty balance (Deposit) - exitTx: incomingTransfer', async function() {
      // Will reference user's pre-existing balance on the side-chain, currently this needs to given as the 2nd input so will process this later
      const { receipt } = await deposit(
        contracts.depositManager,
        childContracts.childChain,
        childContracts.rootERC20,
        user,
        halfAmount
      )
      const inputs = []
      let { block, blockProof, headerNumber, reference } = await init(contracts.rootChain, receipt, accounts)
      inputs.push({ headerNumber, blockProof, blockNumber: block.number, blockTimestamp: block.timestamp, reference, logIndex: 1 })

      // We will reference the following tx (Deposit) which is a proof of counterparty's balance
      const { receipt: d } = await childContracts.childChain.depositTokens(childContracts.rootERC20.address, other, halfAmount, '2' /* mock depositBlockId */)
      const i = await init(contracts.rootChain, d, accounts)
      inputs.unshift({ headerNumber: i.headerNumber, blockProof: i.blockProof, blockNumber: i.block.number, blockTimestamp: i.block.timestamp, reference: i.reference, logIndex: 1 })

      // Treating this tx as an in-flight incoming transfer
      const { receipt: r } = await childContracts.childToken.transfer(user, halfAmount, { from: other })
      let exitTx = await web3Child.eth.getTransaction(r.transactionHash)
      exitTx = await buildInFlight(exitTx)

      const startExitTx = await startExitNew(inputs, exitTx)
      const logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
      // console.log(startExitTx, logs)
      let log = logs[1]
      log.event.should.equal('ExitStarted')
      expect(log.args).to.include({
        exitor: user,
        token: childContracts.rootERC20.address
      })
      assertBigNumberEquality(log.args.amount, amount)
      const exitId = log.args.exitId

      log = logs[2]
      log.event.should.equal('ExitUpdated')
      expect(log.args).to.include({
        signer: other
      })
      assertBigNumberEquality(log.args.exitId, exitId)

      log = logs[3]
      log.event.should.equal('ExitUpdated')
      expect(log.args).to.include({
        signer: user
      })
      assertBigNumberEquality(log.args.exitId, exitId)
    })

    it('reference: own balance (outgoingTransfer) and counterparty balance (incomingTransfer) - exitTx: incomingTransfer', async function() {
      // This test case tests an interesting case.
      // 1. I deposit x tokens.
      await deposit(
        contracts.depositManager,
        childContracts.childChain,
        childContracts.rootERC20,
        user,
        amount
      )

      // 2. I transfer x/2 tokens to a user. Calling this tx A.
      let { receipt } = await childContracts.childToken.transfer(other, halfAmount)
      const { block, blockProof, headerNumber, reference } = await init(contracts.rootChain, receipt, accounts)
      const inputs = []
      // We add an input which is the proof of counterparty's balance (x/2 amount)
      inputs.push({ headerNumber, blockProof, blockNumber: block.number, blockTimestamp: block.timestamp, reference, logIndex: 1 })

      // 3. The user transfers x/2 tokens back to me but this tx goes in-flight
      const { receipt: r } = await childContracts.childToken.transfer(user, halfAmount, { from: other })

      let exitTx = await web3Child.eth.getTransaction(r.transactionHash)
      exitTx = await buildInFlight(exitTx)

      // 4. Now I would like to exit with x/2 (received) + x/2 (pre-existing balance) tokens
      // What's interesting here is that tx A acts as proof-of-balance for both the counterparty and the user, so add the same input again
      inputs.push({ headerNumber, blockProof, blockNumber: block.number, blockTimestamp: block.timestamp, reference, logIndex: 1 })

      const startExitTx = await startExitNew(inputs, exitTx)
      const logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
      let log = logs[1]
      log.event.should.equal('ExitStarted')
      expect(log.args).to.include({
        exitor: user,
        token: childContracts.rootERC20.address
      })
      assertBigNumberEquality(log.args.amount, amount) // Exit starts with x tokens in total
      const exitId = log.args.exitId

      log = logs[2]
      log.event.should.equal('ExitUpdated')
      expect(log.args).to.include({
        signer: other
      })
      assertBigNumberEquality(log.args.exitId, exitId)
      const age = log.args.age

      log = logs[3]
      log.event.should.equal('ExitUpdated')
      expect(log.args).to.include({
        signer: user
      })
      assertBigNumberEquality(log.args.exitId, exitId)
      assertBigNumberEquality(
        // Referenced inputs are adjacent UTXOs in the same LogTransfer log in a particular tx
        web3.utils.toBN(log.args.age).add(web3.utils.toBN(1)),
        age
      )
    })
  })

  describe('verifyDeprecation', async function() {
    beforeEach(async function() {
      contracts.withdrawManager = await deployer.deployWithdrawManager()
      contracts.ERC20Predicate = await deployer.deployErc20Predicate()
      const { rootERC20, childToken } = await deployer.deployChildErc20(accounts[0])
      childContracts.rootERC20 = rootERC20
      childContracts.childToken = childToken
      // start = 0
    })

    it('reference: Deposit - challenge: spend - exit: Burn', async function() {
      const inputs = []
      const { receipt } = await deposit(
        contracts.depositManager,
        childContracts.childChain,
        childContracts.rootERC20,
        user,
        amount
      )
      let { block, blockProof, headerNumber, reference } = await init(contracts.rootChain, receipt, accounts)
      inputs.push({ headerNumber, blockProof, blockNumber: block.number, blockTimestamp: block.timestamp, reference, logIndex: 1 })
      let { receipt: i } = await childContracts.childToken.transfer(other, halfAmount)
      i = await init(contracts.rootChain, i, accounts)
      const challengeData = buildChallengeData({ headerNumber: i.headerNumber, blockProof: i.blockProof, blockNumber: i.block.number, blockTimestamp: i.block.timestamp, reference: i.reference, logIndex: 1 })

      let { receipt: w } = await childContracts.childToken.transfer(other, halfAmount) // to make it evm compatible but still challengeable bcoz we are referencing an older input
      let exitTx = await web3Child.eth.getTransaction(w.transactionHash)
      exitTx = await buildInFlight(exitTx)
      const startExitTx = await startExitNew(inputs, exitTx)
      const logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
      // console.log(startExitTx, logs)
      let log = logs[1]
      log.event.should.equal('ExitStarted')
      expect(log.args).to.include({
        exitor: user,
        token: childContracts.rootERC20.address
      })
      assertBigNumberEquality(log.args.amount, halfAmount)

      log = logs[2]
      // const exit = await contracts.withdrawManager.exits(log.args.exitId._hex)
      // console.log(exit)

      const verifyDeprecationTx = await verifyDeprecation(
        log.args.exitId._hex, log.args.age._hex, challengeData,
        { childToken: childContracts.childToken.address, age: log.args.age._hex, signer: log.args.signer }
      )
      // console.log('verifyDeprecationTx', verifyDeprecationTx)
    })

    it('should not be able to challenge with the in-flight tx from which the exit was started', async function() {
      const { receipt } = await deposit(
        contracts.depositManager,
        childContracts.childChain,
        childContracts.rootERC20,
        user,
        amount
      )
      const inputs = []
      let { block, blockProof, headerNumber, reference } = await init(contracts.rootChain, receipt, accounts)
      inputs.push({ headerNumber, blockProof, blockNumber: block.number, blockTimestamp: block.timestamp, reference, logIndex: 1 })

      let { receipt: i } = await childContracts.childToken.transfer(other, halfAmount) // to make it evm compatible but still challengeable bcoz we are referencing an older input
      let exitTx = await web3Child.eth.getTransaction(i.transactionHash)
      exitTx = await buildInFlight(exitTx)
      const startExitTx = await startExitNew(inputs, exitTx)
      const logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)

      i = await init(contracts.rootChain, i, accounts)
      const challengeData = buildChallengeData({ headerNumber: i.headerNumber, blockProof: i.blockProof, blockNumber: i.block.number, blockTimestamp: i.block.timestamp, reference: i.reference, logIndex: 1 })

      let log = logs[2] // 'ExitUpdated'
      try {
        // await verifyDeprecation(exit, childContracts.childToken.address, log.args.age._hex, log.args.signer, exit.txHash, challengeData)
        await verifyDeprecation(
          log.args.exitId._hex, log.args.age._hex, challengeData,
          { childToken: childContracts.childToken.address, age: log.args.age._hex, signer: log.args.signer }
        )
        assert.fail()
      } catch (e) {
        expect(e.toString()).to.include('Cannot challenge with the exit tx')
      }
    })
  })
})

async function deposit(depositManager, childChain, rootERC20, user, amount, options = { rootDeposit: false }) {
  let depositBlockId
  if (options.rootDeposit) {
    await rootERC20.approve(depositManager.address, amount)
    const result = await depositManager.depositERC20ForUser(
      rootERC20.address,
      user,
      amount
    )
    const logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    const NewDepositBlockEvent = logs.find(log => log.event === 'NewDepositBlock')
    depositBlockId = NewDepositBlockEvent.args.depositBlockId
  } else {
    depositBlockId = '0x' + crypto.randomBytes(32).toString('hex')
  }
  return childChain.depositTokens(rootERC20.address, user, amount, depositBlockId)
}

async function init(rootChain, receipt, accounts) {
  const event = {
    tx: await web3Child.eth.getTransaction(receipt.transactionHash),
    receipt: await web3Child.eth.getTransactionReceipt(receipt.transactionHash),
    block: await web3Child.eth.getBlock(receipt.blockHash, true /* returnTransactionObjects */)
  }

  const blockHeader = getBlockHeader(event.block)
  const headers = [blockHeader]
  const tree = new MerkleTree(headers)
  const root = utils.bufferToHex(tree.getRoot())
  const end = event.tx.blockNumber
  const blockProof = await tree.getProof(blockHeader)
  start = Math.min(start, end)
  tree
    .verify(blockHeader, event.block.number - start, tree.getRoot(), blockProof)
    .should.equal(true)
  const { vote, sigs, extraData } = buildSubmitHeaderBlockPaylod(accounts[0], start, end, root)
  const submitHeaderBlock = await rootChain.submitHeaderBlock(vote, sigs, extraData)

  const txProof = await getTxProof(event.tx, event.block)
  assert.isTrue(verifyTxProof(txProof), 'Tx proof must be valid (failed in js)')
  const receiptProof = await getReceiptProof(event.receipt, event.block, web3Child)
  assert.isTrue(verifyReceiptProof(receiptProof), 'Receipt proof must be valid (failed in js)')

  const NewHeaderBlockEvent = submitHeaderBlock.logs.find(log => log.event === 'NewHeaderBlock')
  start = end + 1
  return { block: event.block, blockProof, headerNumber: NewHeaderBlockEvent.args.headerBlockId, reference: await build(event) }
}

function startExit(headerNumber, blockProof, blockNumber, blockTimestamp, reference, logIndex, exitTx) {
  return contracts.ERC20Predicate.startExit(
    utils.bufferToHex(
      rlp.encode([
        headerNumber,
        utils.bufferToHex(Buffer.concat(blockProof)),
        blockNumber,
        blockTimestamp,
        utils.bufferToHex(reference.transactionsRoot),
        utils.bufferToHex(reference.receiptsRoot),
        utils.bufferToHex(reference.receipt),
        utils.bufferToHex(rlp.encode(reference.receiptParentNodes)),
        utils.bufferToHex(rlp.encode(reference.path)), // branch mask,
        logIndex
      ])
    ),
    utils.bufferToHex(exitTx)
  )
}

function startExitNew(inputs, exitTx) {
  let _inputs = []
  inputs.forEach(input => {
    _inputs = _inputs.concat(buildReferenceTxPayload(input))
  })

  return contracts.ERC20Predicate.startExit(
    utils.bufferToHex(rlp.encode(_inputs)),
    utils.bufferToHex(exitTx)
  )
}

async function verifyDeprecation(exitId, inputId, challengeData, options) {
  const exit = await contracts.withdrawManager.exits(exitId)
  // console.log('exit', exit, exit.receiptAmountOrNFTId.toString(16))
  const exitData = web3.eth.abi.encodeParameters(
    ['address', 'address', 'uint256', 'bytes32', 'bool'],
    [exit.owner, options.childToken, exit.receiptAmountOrNFTId.toString(16), exit.txHash, exit.burnt]
  )
  // console.log('exitData', exitData)
  const inputUtxoData = web3.eth.abi.encodeParameters(
    ['uint256', 'address'],
    [options.age, options.signer]
  )
  // console.log('inputUtxoData', inputUtxoData)
  return contracts.ERC20Predicate.verifyDeprecation(exitData, inputUtxoData, challengeData)
}

function buildReferenceTxPayload(input) {
  const { headerNumber, blockProof, blockNumber, blockTimestamp, reference, logIndex } = input
  return [
    headerNumber,
    utils.bufferToHex(Buffer.concat(blockProof)),
    blockNumber,
    blockTimestamp,
    utils.bufferToHex(reference.transactionsRoot),
    utils.bufferToHex(reference.receiptsRoot),
    utils.bufferToHex(reference.receipt),
    utils.bufferToHex(rlp.encode(reference.receiptParentNodes)),
    utils.bufferToHex(rlp.encode(reference.path)), // branch mask,
    logIndex
  ]
}

function buildChallengeData(input) {
  const data = buildReferenceTxPayload(input)
  const { reference } = input
  return utils.bufferToHex(rlp.encode(
    data.concat([
      utils.bufferToHex(reference.tx),
      utils.bufferToHex(rlp.encode(reference.txParentNodes))
    ])
  ))
}
