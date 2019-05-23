import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../../helpers/deployer.js'
import logDecoder from '../../helpers/log-decoder.js'
import utils from 'ethereumjs-util'

import {
  getTxBytes,
  getTxProof,
  verifyTxProof,
  getReceiptBytes,
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

// import { WithdrawManager } from '../helpers/artifacts'
// import burn from '../mockResponses/burn'
// import incomingTransfer from '../mockResponses/incomingTransfer'

const rlp = utils.rlp
const web3Child = new web3.constructor(
  new web3.providers.HttpProvider('http://localhost:8546')
)

chai.use(chaiAsPromised).should()
let contracts, childContracts

contract('ERC721Predicate', async function(accounts) {
  const tokenId = '0x117'
  const user = accounts[0]
  const other = accounts[1]

  describe('startExit', async function() {
    beforeEach(async function() {
      contracts = await deployer.freshDeploy()
      childContracts = await deployer.initializeChildChain(accounts[0], { erc721: true })
    })

    it('reference: incomingTransfer - exitTx: burn', async function() {
      await depositErc721(
        contracts.depositManager,
        childContracts.childChain,
        childContracts.rootERC721,
        other,
        tokenId
      )

      const { receipt } = await childContracts.childErc721.transferFrom(other, user, tokenId, { from: other })
      const { block, blockProof, headerNumber, reference } = await init(contracts.rootChain, receipt, accounts)

      const { receipt: r } = await childContracts.childErc721.withdraw(tokenId)
      let exitTx = await web3Child.eth.getTransaction(r.transactionHash)
      exitTx = await buildInFlight(exitTx)

      const startExitTx = await startExit(
        headerNumber, blockProof, block.number, block.timestamp,
        reference, 1, /* logIndex */ exitTx, contracts.withdrawManager
      )
      // console.log(startExitTx)
      const log = startExitTx.logs[0]
      log.event.should.equal('ExitStarted')
      expect(log.args).to.include({
        exitor: user,
        token: childContracts.rootERC721.address
      })
      assertBigNumberEquality(log.args.amount, tokenId)
    })

    it('reference: counterparty balance (Transfer) - exitTx: incomingTransfer', async function() {
      await depositErc721(
        contracts.depositManager,
        childContracts.childChain,
        childContracts.rootERC721,
        user,
        tokenId
      )

      // proof of counterparty's balance
      const { receipt } = await childContracts.childErc721.transferFrom(user, other, tokenId)
      const { block, blockProof, headerNumber, reference } = await init(contracts.rootChain, receipt, accounts)

      // treating this as in-flight incomingTransfer
      const { receipt: r } = await childContracts.childErc721.transferFrom(other, user, tokenId, { from: other })
      let exitTx = await web3Child.eth.getTransaction(r.transactionHash)
      exitTx = await buildInFlight(exitTx)

      const startExitTx = await startExit(
        headerNumber, blockProof, block.number, block.timestamp,
        reference, 1, /* logIndex */ exitTx, contracts.withdrawManager
      )
      // console.log(startExitTx)
      const log = startExitTx.logs[0]
      log.event.should.equal('ExitStarted')
      expect(log.args).to.include({
        exitor: user,
        token: childContracts.rootERC721.address
      })
      assertBigNumberEquality(log.args.amount, tokenId)
    })
  })
})

async function depositErc721(depositManager, childChain, rootERC721, user, tokenId) {
  // await rootERC721.approve(depositManager.address, tokenId)
  // const result = await depositManager.depositERC721ForUser(
  //   rootERC721.address,
  //   user,
  //   tokenId
  // )
  // const logs = logDecoder.decodeLogs(result.receipt.rawLogs)
  // const NewDepositBlockEvent = logs.find(log => log.event === 'NewDepositBlock')
  await childChain.depositTokens(
    rootERC721.address,
    user,
    tokenId,
    '1' // mock
    // NewDepositBlockEvent.args.depositBlockId
  )
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
  const start = event.tx.blockNumber
  const end = event.tx.blockNumber
  const blockProof = await tree.getProof(blockHeader)
  tree
    .verify(blockHeader, event.block.number - start, tree.getRoot(), blockProof)
    .should.equal(true)
  const payload = buildSubmitHeaderBlockPaylod(accounts[0], 0, start - 1)
  await rootChain.submitHeaderBlock(payload.vote, payload.sigs, payload.extraData)

  const { vote, sigs, extraData } = buildSubmitHeaderBlockPaylod(accounts[0], start, end, root)
  const submitHeaderBlock = await rootChain.submitHeaderBlock(vote, sigs, extraData)

  const txProof = await getTxProof(event.tx, event.block)
  assert.isTrue(verifyTxProof(txProof), 'Tx proof must be valid (failed in js)')
  const receiptProof = await getReceiptProof(event.receipt, event.block, web3Child)
  assert.isTrue(verifyReceiptProof(receiptProof), 'Receipt proof must be valid (failed in js)')

  const NewHeaderBlockEvent = submitHeaderBlock.logs.find(log => log.event === 'NewHeaderBlock')
  return { block: event.block, blockProof, headerNumber: NewHeaderBlockEvent.args.headerBlockId, reference: await build(event) }
}

function startExit(headerNumber, blockProof, blockNumber, blockTimestamp, reference, logIndex, exitTx, ERC721Predicate, registry) {
  return contracts.withdrawManager.startExit2(
    contracts.ERC721Predicate.address,
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
        logIndex,
        utils.bufferToHex(exitTx)
      ])
    )
    // registry
  )
}
