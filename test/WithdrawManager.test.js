import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBigNumber from 'chai-bignumber'
import BigNumber from 'bignumber.js'

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
import { buildSubmitHeaderBlockPaylod } from './helpers/utils.js'
import { getHeaders, getBlockHeader } from './helpers/blocks'
import MerkleTree from './helpers/merkle-tree'

const rlp = utils.rlp
chai
  .use(chaiAsPromised)
  .use(chaiBigNumber(web3.BigNumber))
  .should()

contract('WithdrawManager', async function(accounts) {
  let contracts, childContracts

  beforeEach(async function() {
    contracts = await deployer.freshDeploy()
    childContracts = await deployer.initializeChildChain(accounts[0])
  })

  it.only('withdrawBurntTokens', async function() {
    const user = accounts[0]
    const amount = new BigNumber('10').pow(new BigNumber('18'))
    await deposit(contracts.depositManager, childContracts.childChain, childContracts.rootERC20, user, amount)

    const { receipt } = await childContracts.childToken.withdraw(amount)
    console.log('childToken.withdraw', receipt)
    const withdrawTx = await web3.eth.getTransaction(receipt.transactionHash)
    // console.log('withdrawTx', withdrawTx)
    const withdrawReceipt = await web3.eth.getTransactionReceipt(receipt.transactionHash)
    const withdrawBlock = await web3.eth.getBlock(receipt.blockHash)

    let payload = buildSubmitHeaderBlockPaylod(accounts[0], 0, withdrawTx.blockNumber-1)
    await contracts.rootChain.submitHeaderBlock(payload.vote, payload.sigs, payload.extraData)
    const { vote, sigs, extraData } = buildSubmitHeaderBlockPaylod(accounts[0], withdrawTx.blockNumber, withdrawTx.blockNumber)
    const submitHeaderBlock = await contracts.rootChain.submitHeaderBlock(vote, sigs, extraData)
    // console.log(submitHeaderBlock)

    const txProof = await getTxProof(withdrawTx, withdrawBlock, web3)
    const receiptProof = await getReceiptProof(withdrawReceipt, withdrawBlock, web3)

    const NewHeaderBlockEvent = submitHeaderBlock.logs.find(log => log.event == 'NewHeaderBlock')

    const headerNumber = NewHeaderBlockEvent.args.headerBlockId

    const headers = await getHeaders(withdrawTx.blockNumber - 1, withdrawTx.blockNumber, web3)
    const tree = new MerkleTree(headers)
    const blockHeader = getBlockHeader(withdrawBlock)
    const withdrawBlockProof = await tree.getProof(blockHeader)
    // console.log('withdrawTx2', withdrawTx)
    getReceiptBytes(withdrawReceipt)
    const burnWithdrawReceipt = await contracts.withdrawManager.withdrawBurntTokens(
      headerNumber,
      utils.bufferToHex(Buffer.concat(withdrawBlockProof)),
      withdrawBlock.number,
      withdrawBlock.timestamp,
      utils.bufferToHex(withdrawBlock.transactionsRoot),
      utils.bufferToHex(withdrawBlock.receiptsRoot),
      utils.bufferToHex(rlp.encode(receiptProof.path)), // branch mask
      utils.bufferToHex(getTxBytes(withdrawTx)),
      utils.bufferToHex(rlp.encode(txProof.parentNodes)), // Merkle proof of the withdraw transaction
      utils.bufferToHex(getReceiptBytes(withdrawReceipt)),
      utils.bufferToHex(rlp.encode(receiptProof.parentNodes)), // Merkle proof of the withdraw receipt
      {
        from: user
      }
    )
    console.log(burnWithdrawReceipt)
  })

  it('withdrawTokens');
  it('withdrawDepositTokens');
})

async function deposit(depositManager, childChain, rootERC20, user, amount) {
  await rootERC20.approve(depositManager.address, amount)
  const result = await depositManager.depositERC20ForUser(rootERC20.address, user, amount)
  const logs = logDecoder.decodeLogs(result.receipt.rawLogs)
  const NewDepositBlockEvent = logs.find(log => log.event == 'NewDepositBlock')
  await childChain.depositTokens(
    rootERC20.address, user, amount, NewDepositBlockEvent.args.depositBlockId)
}
