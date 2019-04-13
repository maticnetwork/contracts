import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBigNumber from 'chai-bignumber'
import BigNumber from 'bignumber.js'

import deployer from './helpers/deployer.js'
import logDecoder from './helpers/log-decoder.js'

import { buildSubmitHeaderBlockPaylod } from './helpers/utils.js'

chai
  .use(chaiAsPromised)
  .use(chaiBigNumber(web3.BigNumber))
  .should()

contract('WithdrawManager', async function(accounts) {
  let contracts, childContracts

  beforeEach(async function() {
    contracts = await deployer.freshDeploy({deployTestErc20: true})
    childContracts = await deployer.initializeChildChain(accounts[0])
  })

  it.only('withdrawBurntTokens', async function() {
    const user = accounts[0]
    const amount = new BigNumber('10').pow(new BigNumber('18'))
    await deposit(contracts, childContracts, user, amount)

    const { receipt } = await childContracts.childToken.withdraw(amount)
    const withdrawTx = await web3.eth.getTransaction(receipt.transactionHash)
    const withdrawReceipt = await web3.eth.getTransactionReceipt(receipt.transactionHash)
    const withdrawBlock = await web3.eth.getBlock(receipt.blockHash)

    const { vote, sigs, extraData } = buildSubmitHeaderBlockPaylod(accounts[0], 0, withdrawTx.blockNumber)
    await contracts.rootChain.submitHeaderBlock(vote, sigs, extraData)

    const txProof = await getTxProof(withdraw, withdrawBlock)

  })

  it('withdrawTokens');
  it('withdrawDepositTokens');
})

async function deposit(contracts, childContracts, user, amount) {
  await contracts.testToken.approve(contracts.depositManager.address, amount)
  const result = await contracts.depositManager.depositERC20ForUser(contracts.testToken.address, user, amount)
  const logs = logDecoder.decodeLogs(result.receipt.rawLogs)
  const NewDepositBlockEvent = logs.find(log => log.event == 'NewDepositBlock')
  const c = await childContracts.childChain.depositTokens(
    contracts.testToken.address, user, amount, NewDepositBlockEvent.args.depositBlockId)
  console.log(c)
}
