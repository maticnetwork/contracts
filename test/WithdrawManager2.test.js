import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from './helpers/deployer.js'
import logDecoder from './helpers/log-decoder.js'
import utils from 'ethereumjs-util'

import {
  getTxBytes,
  getTxProof,
  verifyTxProof,
  getReceiptBytes,
  getReceiptProof,
  verifyReceiptProof
} from './helpers/proofs'
import { buildSubmitHeaderBlockPaylod, assertBigNumberEquality } from './helpers/utils.js'
import { getBlockHeader } from './helpers/blocks'
import MerkleTree from './helpers/merkle-tree'

import WithdrawManager from './mocks/WithdrawManager'

const rlp = utils.rlp
const web3Child = new web3.constructor(
  new web3.providers.HttpProvider('http://localhost:8546')
)

chai
  .use(chaiAsPromised)
  .should()

contract('WithdrawManager', async function(accounts) {
  let contracts, childContracts
  const amount = web3.utils.toBN('10')
  // const amount = web3.utils.toBN('10').pow(web3.utils.toBN('18'))

  beforeEach(async function() {
    contracts = await deployer.freshDeploy()
    childContracts = await deployer.initializeChildChain(accounts[0])
  })

  it.only('withdrawBurntTokens', async function() {
    const sender = accounts[1].toLowerCase()
    const user = accounts[0].toLowerCase()
    await deposit(contracts.depositManager, childContracts.childChain, childContracts.rootERC20, sender, amount)

    let { receipt } = await childContracts.childToken.transfer(user, amount)
    receipt = await web3Child.eth.getTransactionReceipt(receipt.transactionHash)
    console.log(JSON.parse(JSON.stringify(receipt)))

    // receipt = await childContracts.childToken.withdraw(amount).receipt
    // console.log(JSON.parse(JSON.stringify(receipt)))
    // const withdrawTx = await web3Child.eth.getTransaction(receipt.transactionHash)
    // // console.log(JSON.parse(JSON.stringify(withdrawTx)))
    // const withdrawReceipt = await web3Child.eth.getTransactionReceipt(receipt.transactionHash)
    // // console.log(JSON.parse(JSON.stringify(withdrawReceipt)))

    // const withdrawBlock = await web3Child.eth.getBlock(receipt.blockHash, true /* returnTransactionObjects */)
    // console.log(JSON.parse(JSON.stringify(withdrawBlock)))
    // const blockHeader = getBlockHeader(withdrawBlock)
    // const headers = [blockHeader]
    // const tree = new MerkleTree(headers)
    // const root = utils.bufferToHex(tree.getRoot())
    // const start = withdrawTx.blockNumber
    // const end = withdrawTx.blockNumber
    // const withdrawBlockProof = await tree.getProof(blockHeader)
    // console.log('blockHeader 1', blockHeader)
    // console.log(blockHeader, withdrawBlock.number - start, tree.getRoot(), withdrawBlockProof)
    // tree
    //   .verify(
    //     blockHeader,
    //     withdrawBlock.number - start,
    //     tree.getRoot(),
    //     withdrawBlockProof
    //   )
    //   .should.equal(true)
    // const payload = buildSubmitHeaderBlockPaylod(accounts[0], 0, start - 1)
    // await contracts.rootChain.submitHeaderBlock(payload.vote, payload.sigs, payload.extraData)

    // const { vote, sigs, extraData } = buildSubmitHeaderBlockPaylod(accounts[0], start, end, root)
    // const submitHeaderBlock = await contracts.rootChain.submitHeaderBlock(vote, sigs, extraData)
    // const NewHeaderBlockEvent = submitHeaderBlock.logs.find(log => log.event == 'NewHeaderBlock')
    // const headerNumber = NewHeaderBlockEvent.args.headerBlockId

    // const txProof = await getTxProof(withdrawTx, withdrawBlock)
    // assert.isTrue(verifyTxProof(txProof), 'Tx proof must be valid')
    // const receiptProof = await getReceiptProof(withdrawReceipt, withdrawBlock, web3Child)
    // assert.isTrue(
    //   verifyReceiptProof(receiptProof),
    //   'Receipt proof must be valid'
    // )
    // // let rb = getReceiptBytes(withdrawReceipt)
    // // console.log('yoyo', rb)
    // // console.log('yoyo3', rlp.decode(rb))
    // // console.log('length', rlp.decode(rb).length)

    // const withdrawManager = new WithdrawManager()
    // await withdrawManager.withdrawBurntTokens(
    //   headerNumber,
    //   // utils.bufferToHex(Buffer.concat(withdrawBlockProof)),
    //   utils.bufferToHex(Buffer.concat(withdrawBlockProof)),
    //   withdrawBlock.number,
    //   withdrawBlock.timestamp,
    //   utils.bufferToHex(withdrawBlock.transactionsRoot),
    //   utils.bufferToHex(withdrawBlock.receiptsRoot),
    //   utils.bufferToHex(rlp.encode(receiptProof.path)), // branch mask
    //   utils.bufferToHex(getTxBytes(withdrawTx)),
    //   utils.bufferToHex(rlp.encode(txProof.parentNodes)), // Merkle proof of the withdraw transaction
    //   utils.bufferToHex(getReceiptBytes(withdrawReceipt)),
    //   utils.bufferToHex(rlp.encode(receiptProof.parentNodes)),
    //   user,
    //   { receiptProof, rootChain: contracts.rootChain }
    // )

    // const burnWithdrawTx = await contracts.withdrawManager.withdrawBurntTokens(
    //   headerNumber,
    //   utils.bufferToHex(Buffer.concat(withdrawBlockProof)),
    //   withdrawBlock.number,
    //   withdrawBlock.timestamp,
    //   utils.bufferToHex(withdrawBlock.transactionsRoot),
    //   utils.bufferToHex(withdrawBlock.receiptsRoot),
    //   utils.bufferToHex(rlp.encode(receiptProof.path)), // branch mask
    //   utils.bufferToHex(getTxBytes(withdrawTx)),
    //   utils.bufferToHex(rlp.encode(txProof.parentNodes)), // Merkle proof of the withdraw transaction
    //   utils.bufferToHex(getReceiptBytes(withdrawReceipt)),
    //   utils.bufferToHex(rlp.encode(receiptProof.parentNodes)), // Merkle proof of the withdraw receipt
    //   {
    //     from: user
    //   }
    // )
    // const logs = logDecoder.decodeLogs(burnWithdrawTx.receipt.rawLogs)
    // console.log('burnWithdrawReceipt', burnWithdrawTx)
    // const log = burnWithdrawTx.logs[0]
    // log.event.should.equal('ExitStarted')
    // expect(log.args).to.include({
    //   exitor: accounts[0],
    //   token: childContracts.rootERC20.address
    // })
    // assertBigNumberEquality(log.args.amount, amount)
  })
})

async function deposit(depositManager, childChain, rootERC20, user, amount) {
  await rootERC20.approve(depositManager.address, amount)
  const result = await depositManager.depositERC20ForUser(rootERC20.address, user, amount)
  const logs = logDecoder.decodeLogs(result.receipt.rawLogs)
  const NewDepositBlockEvent = logs.find(log => log.event == 'NewDepositBlock')
  await childChain.depositTokens(
    rootERC20.address, user, amount, NewDepositBlockEvent.args.depositBlockId)
}
