import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import ethUtils from 'ethereumjs-util'

import deployer from '../helpers/deployer.js'
import logDecoder from '../helpers/log-decoder.js'
import { getBlockHeader } from '../helpers/blocks'
import MerkleTree from '../helpers/merkle-tree'
import {
  getTxProof,
  verifyTxProof,
  getReceiptProof,
  verifyReceiptProof
} from '../helpers/proofs'
import { build, buildInFlight } from '../mockResponses/utils'

const utils = require('../helpers/utils')
const web3Child = utils.web3Child

chai.use(chaiAsPromised).should()
let contracts, childContracts, start

contract('WithdrawManager', async function(accounts) {
  const amount = web3.utils.toBN('10')
  const owner = accounts[0]
  const user = accounts[1]
  const other = accounts[2]

  describe('startExitWithDepositedTokens', async function() {
    let exitId

    before(async function() {
      contracts = await deployer.freshDeploy()
      await deployer.deployErc20Predicate()
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
      const depositId = depositTx.logs[0].args.depositCount
      expect(depositId.toString()).to.equal('1') // first deposit
      const depositHash = await contracts.depositManager.deposits(depositId)
      expect(depositHash).to.equal(web3.utils.soliditySha3(user, contracts.rootERC20.address, amount))

      const exitTx = await contracts.withdrawManager.startExitWithDepositedTokens(
        depositId,
        contracts.rootERC20.address,
        amount,
        { value: web3.utils.toWei('.1', 'ether'), from: user }
      )
      let log = exitTx.logs[0]
      exitId = log.args.exitId
      const HEADER_BLOCK_NUMBER_WEIGHT = web3.utils.toBN(10).pow(web3.utils.toBN(30))
      utils.assertBigNumberEquality(exitId, depositId.mul(HEADER_BLOCK_NUMBER_WEIGHT))

      log.event.should.equal('ExitStarted')
      expect(log.args).to.include({
        exitor: user,
        token: contracts.rootERC20.address,
        isRegularExit: false
      })
      utils.assertBigNumberEquality(log.args.amount, amount)

      // The test above is complete in itself, now the challenge part
      // assuming the exitor made spending txs on child chain
      const { receipt } = await childContracts.childToken.transfer(other, amount, { from: user })
      const i = await init(contracts.rootChain, receipt, accounts, start)
      const challengeData = utils.buildChallengeData({ headerNumber: i.headerNumber, blockProof: i.blockProof, blockNumber: i.block.number, blockTimestamp: i.block.timestamp, reference: i.reference, logIndex: 1 })
      // This will be used to assert that challenger received the bond amount
      const originalBalance = web3.utils.toBN(await web3.eth.getBalance(owner))
      const challenge = await contracts.withdrawManager.challengeExit(exitId, exitId, challengeData)

      // Need this to get the gasPrice to assert that challenger received the bond amount
      const tx = await web3.eth.getTransaction(challenge.tx)
      const ethSpent = web3.utils.toBN(challenge.receipt.gasUsed).mul(web3.utils.toBN(tx.gasPrice))
      const expectedBalance = originalBalance.sub(ethSpent).add(web3.utils.toBN(10 ** 17)) // bond amount
      const nowBalance = web3.utils.toBN(await web3.eth.getBalance(owner))
      expect(expectedBalance.eq(nowBalance)).to.be.true

      log = challenge.logs[0]
      log.event.should.equal('ExitCancelled')
      utils.assertBigNumberEquality(log.args.exitId, exitId)
    })
  })
})

async function init(rootChain, receipt, accounts, _) {
  const event = {
    tx: await web3Child.eth.getTransaction(receipt.transactionHash),
    receipt: await web3Child.eth.getTransactionReceipt(receipt.transactionHash),
    block: await web3Child.eth.getBlock(receipt.blockHash, true /* returnTransactionObjects */)
  }

  const blockHeader = getBlockHeader(event.block)
  const headers = [blockHeader]
  const tree = new MerkleTree(headers)
  const root = ethUtils.bufferToHex(tree.getRoot())
  const end = event.tx.blockNumber
  const blockProof = await tree.getProof(blockHeader)
  start = Math.min(start, end)
  tree
    .verify(blockHeader, event.block.number - start, tree.getRoot(), blockProof)
    .should.equal(true)
  const { vote, sigs, extraData } = utils.buildSubmitHeaderBlockPaylod(accounts[0], start, end, root)
  const submitHeaderBlock = await rootChain.submitHeaderBlock(vote, sigs, extraData)

  const txProof = await getTxProof(event.tx, event.block)
  assert.isTrue(verifyTxProof(txProof), 'Tx proof must be valid (failed in js)')
  const receiptProof = await getReceiptProof(event.receipt, event.block, web3Child)
  assert.isTrue(verifyReceiptProof(receiptProof), 'Receipt proof must be valid (failed in js)')

  const NewHeaderBlockEvent = submitHeaderBlock.logs.find(log => log.event === 'NewHeaderBlock')
  start = end + 1
  return { block: event.block, blockProof, headerNumber: NewHeaderBlockEvent.args.headerBlockId, reference: await build(event) }
}
