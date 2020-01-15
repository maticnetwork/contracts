import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import utils from 'ethereumjs-util'

import deployer from '../helpers/deployer.js'
import { TestToken, ValidatorShare } from '../helpers/artifacts'
import logDecoder from '../helpers/log-decoder.js'

import { assertBigNumberEquality } from '../helpers/utils.js'
import { generateFirstWallets, mnemonics } from '../helpers/wallets.js'

chai.use(chaiAsPromised).should()

contract('ValidatorContract', async function (accounts) {
  let validatorContract, wallets, stakeToken, registry, stakeManager

  before(async function () {
    wallets = generateFirstWallets(mnemonics, 10)
    const contracts = await deployer.freshDeploy({ stakeManager: true })
    registry = contracts.registry
    stakeManager = contracts.stakeManager
    stakeToken = await TestToken.new("MATIC", "MATIC")
    await stakeManager.setToken(stakeToken.address)
  })

  beforeEach(async function () {
    validatorContract = await ValidatorShare.new(
      1,
      stakeToken.address
    )
  })

  it('Buy shares and test exchange rate', async function () {
    const user = wallets[2].getAddressString()
    await stakeToken.mint(
      user,
      web3.utils.toWei('250')
    )
    await stakeToken.approve(validatorContract.address, web3.utils.toWei('250'))
    let result = await validatorContract.buyVoucher(user, web3.utils.toWei('100'))
    let logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    assertBigNumberEquality(logs[3].args.amount, logs[3].args.tokens)
    await validatorContract.udpateRewards(web3.utils.toWei('50'))
    result = await validatorContract.buyVoucher(user, web3.utils.toWei('150'))
    logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    // exchange rate is 150
    assertBigNumberEquality(logs[3].args.amount, web3.utils.toWei('150'))
  })

  it('Sell share and test exchange rate and withdraw pool', async function () {
    const user = wallets[2].getAddressString()
    await stakeToken.mint(
      user,
      web3.utils.toWei('250')
    )
    await stakeToken.approve(validatorContract.address, web3.utils.toWei('250'))
    await validatorContract.buyVoucher(user, web3.utils.toWei('100'))
    await validatorContract.transferOwnership(stakeManager.address)
    let result = await validatorContract.sellVoucher(web3.utils.toWei('100'), {
      from: user
    })
    let logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    assertBigNumberEquality(logs[1].args.tokens, web3.utils.toWei('100'))
    let delegator = await validatorContract.delegators(user)
    assertBigNumberEquality(delegator.share, web3.utils.toWei('100'))
  })

  it('Pull rewards', async function () {

  })

  it('Partial withdraw', async function () {
    // function claimTokens(address user) public {
  })

  it('Complete withdraw', async function () {
    // const user = wallets[2].getAddressString()
    // await stakeToken.mint(
    //   user,
    //   web3.utils.toWei('250')
    // )
    // await stakeToken.approve(validatorContract.address, web3.utils.toWei('250'))
    // await validatorContract.buyVoucher(user, web3.utils.toWei('100'))
    // await validatorContract.transferOwnership(stakeManager.address)
    // let result = await validatorContract.sellVoucher(web3.utils.toWei('100'), {
    //   from: user
    // })
  })
})
