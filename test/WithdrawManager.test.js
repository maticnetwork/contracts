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
const web3Child = new web3.constructor(
  new web3.providers.HttpProvider('http://localhost:8546')
)

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
    const m = await contracts.registry.rootToChildToken(childContracts.rootERC20.address)
    console.log('childContracts.rootERC20.address', childContracts.rootERC20.address, 'rootToChildToken', m)
    const ml = await contracts.registry.rootToChildToken(childContracts.rootERC20.address.toLowerCase())
    console.log('childContracts.rootERC20.address.toLowerCase()', childContracts.rootERC20.address.toLowerCase(), 'rootToChildToken', ml)

    const { receipt } = await childContracts.childToken.withdraw(amount)
    const withdrawTx = await web3Child.eth.getTransaction(receipt.transactionHash)
    const withdrawReceipt = await web3Child.eth.getTransactionReceipt(receipt.transactionHash)
    // let items = rlp.decode(getReceiptBytes(withdrawReceipt))
    // console.log('childToken', items[3][1][0].toString('hex'))
    // console.log(items[3][1][1].map(i => i.toString('hex')))
    // console.log('amount', items[3][1][2].toString('hex'))
    // throw new Error()
    // console.log('getReceiptBytes', rlp.decode(
    //   getReceiptBytes(withdrawReceipt)).map(e => {
    //     if (typeof e == )
    //     e.toString()
    //   })
    // )
    const withdrawBlock = await web3Child.eth.getBlock(receipt.blockHash)

    const blockHeader = getBlockHeader(withdrawBlock)
    const headers = [blockHeader]
    const tree = new MerkleTree(headers)
    const root = utils.bufferToHex(tree.getRoot())
    const start = withdrawTx.blockNumber
    const end = withdrawTx.blockNumber
    const withdrawBlockProof = await tree.getProof(blockHeader)
    tree
      .verify(
        blockHeader,
        withdrawBlock.number - start,
        tree.getRoot(),
        withdrawBlockProof
      )
      .should.equal(true)
    const payload = buildSubmitHeaderBlockPaylod(accounts[0], 0, start - 1)
    await contracts.rootChain.submitHeaderBlock(payload.vote, payload.sigs, payload.extraData)

    const { vote, sigs, extraData } = buildSubmitHeaderBlockPaylod(accounts[0], start, end, root)
    const submitHeaderBlock = await contracts.rootChain.submitHeaderBlock(vote, sigs, extraData)
    const NewHeaderBlockEvent = submitHeaderBlock.logs.find(log => log.event == 'NewHeaderBlock')
    const headerNumber = NewHeaderBlockEvent.args.headerBlockId
    console.log('headerNumber', headerNumber.toString())

    const txProof = await getTxProof(withdrawTx, withdrawBlock, web3Child)
    assert.isTrue(verifyTxProof(txProof), 'Tx proof must be valid')
    const receiptProof = await getReceiptProof(withdrawReceipt, withdrawBlock, web3Child)
    assert.isTrue(
      verifyReceiptProof(receiptProof),
      'Receipt proof must be valid'
    )
    const burnWithdrawTx = await contracts.withdrawManager.withdrawBurntTokens(
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
    // const logs = logDecoder.decodeLogs(burnWithdrawTx.receipt.rawLogs)
    console.log('burnWithdrawReceipt', burnWithdrawTx)
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
