import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import utils from 'ethereumjs-util'

import deployer from '../helpers/deployer.js'
import { TestToken, ValidatorShare, StakingInfo } from '../helpers/artifacts'
import logDecoder from '../helpers/log-decoder.js'

import { checkPoint, assertBigNumberEquality } from '../helpers/utils.js'
import { generateFirstWallets, mnemonics } from '../helpers/wallets.js'

chai.use(chaiAsPromised).should()

contract('ValidatorShare', async function (accounts) {
  let validatorContract, wallets, stakeToken, registry, stakeManager

  before(async function () {
    wallets = generateFirstWallets(mnemonics, 10)
  })

  beforeEach(async function () {
    let user = wallets[1].getAddressString()
    let amount = web3.utils.toWei('250')
    const contracts = await deployer.freshDeploy({ stakeManager: true })
    registry = contracts.registry
    stakeManager = contracts.stakeManager
    stakeToken = await TestToken.new("MATIC", "MATIC")
    await registry.updateContractMap(
      utils.keccak256('stakeManager'),
      stakeManager.address
    )
    await stakeManager.updateCheckPointBlockInterval(1)
    await stakeManager.updateValidatorThreshold(2)
    await stakeManager.changeRootChain(wallets[1].getAddressString())
    await stakeManager.setToken(stakeToken.address)
    await stakeToken.mint(
      user,
      amount
    )
    await stakeToken.approve(stakeManager.address, amount, {
      from: user
    })

    await stakeManager.stake(amount, user, true, {
      from: user
    })
    let validator = await stakeManager.validators(1)
    validatorContract = await ValidatorShare.at(validator.contractAddress)
  })

  it('Buy shares and test exchange rate', async function () {
    const user = wallets[2].getAddressString()
    await stakeToken.mint(
      user,
      web3.utils.toWei('250')
    )
    await stakeToken.approve(validatorContract.address, web3.utils.toWei('250'), {
      from: user
    })
    let result = await validatorContract.buyVoucher(web3.utils.toWei('100'), {
      from: user
    })
    let logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    // console.log(await validatorContract.exchangeRate())
    // assertBigNumberEquality(logs[3].args.amount, logs[3].args.tokens)
    // await validatorContract.udpateRewards(web3.utils.toWei('100'), web3.utils.toWei('350')
    await checkPoint([wallets[1]], wallets[1], stakeManager, { totalStake: web3.utils.toWei('350') }, {
      from: wallets[1].getAddressString()
    })

    result = await validatorContract.buyVoucher(web3.utils.toWei('150'), {
      from: user
    })

    logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    // console.log(await validatorContract.exchangeRate())
    // assertBigNumberEquality(logs[3].args.amount, web3.utils.toWei('150'))
  })

  it('Sell share and test exchange rate and withdraw pool', async function () {
    const user = wallets[2].getAddressString()
    await stakeToken.mint(
      user,
      web3.utils.toWei('250')
    )
    await stakeToken.approve(validatorContract.address, web3.utils.toWei('250'), {
      from: user
    })
    await validatorContract.buyVoucher(web3.utils.toWei('100'), {
      from: user
    })
    let result = await validatorContract.sellVoucher(web3.utils.toWei('100'), {
      from: user
    })
    let logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    assertBigNumberEquality(logs[1].args.tokens, web3.utils.toWei('100'))
    let delegator = await validatorContract.delegators(user)
    assertBigNumberEquality(delegator.share, web3.utils.toWei('100'))
  })

  it('Claim rewards', async function () {
    const user = wallets[2].getAddressString()
    await stakeToken.mint(
      user,
      web3.utils.toWei('250')
    )
    await stakeToken.approve(validatorContract.address, web3.utils.toWei('250'), {
      from: user
    })
    await validatorContract.buyVoucher(web3.utils.toWei('100'), {
      from: user
    })
    let result = await validatorContract.sellVoucher(web3.utils.toWei('100'), {
      from: user
    })
    let logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    assertBigNumberEquality(logs[1].args.tokens, web3.utils.toWei('100'))
    let delegator = await validatorContract.delegators(user)
    assertBigNumberEquality(delegator.share, web3.utils.toWei('100'))
  })

  it('Restake', async function () {
    const user = wallets[2].getAddressString()
    await stakeToken.mint(
      user,
      web3.utils.toWei('250')
    )
    await stakeToken.approve(validatorContract.address, web3.utils.toWei('250'), {
      from: user
    })
    await validatorContract.buyVoucher(web3.utils.toWei('100'), {
      from: user
    })
    let exchangeRate = await validatorContract.exchangeRate()
    exchangeRate = await validatorContract.exchangeRate()
    exchangeRate = await validatorContract.exchangeRate()
    let result = await validatorContract.reStake()

    let logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    // assertBigNumberEquality(logs[1].args.tokens, web3.utils.toWei('100'))
  })

  it('Buy shares multiple times', async function () {
    const user = wallets[2].getAddressString()
    await stakeToken.mint(
      user,
      web3.utils.toWei('500')
    )
    await stakeToken.approve(validatorContract.address, web3.utils.toWei('500'), {
      from: user
    })
    await validatorContract.buyVoucher(web3.utils.toWei('100'), {
      from: user
    })
    let exchangeRate = await validatorContract.exchangeRate()
    await validatorContract.buyVoucher(web3.utils.toWei('150'), {
      from: user
    })
    exchangeRate = await validatorContract.exchangeRate()
    await validatorContract.buyVoucher(web3.utils.toWei('250'), {
      from: user
    })
    exchangeRate = await validatorContract.exchangeRate()
    let result = await validatorContract.reStake()

    let logs = logDecoder.decodeLogs(result.receipt.rawLogs)

  })

  it('Sell partial shares', async function () {
    const user = wallets[2].getAddressString()
    await stakeToken.mint(
      user,
      web3.utils.toWei('250')
    )
    await stakeToken.approve(validatorContract.address, web3.utils.toWei('250'), {
      from: user
    })
    await validatorContract.buyVoucher(web3.utils.toWei('100'))
    let result = await validatorContract.sellVoucher(web3.utils.toWei('50'), {
      from: user
    })
    let logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    assertBigNumberEquality(logs[1].args.tokens, web3.utils.toWei('100'))
    let delegator = await validatorContract.delegators(user)
    assertBigNumberEquality(delegator.share, web3.utils.toWei('100'))
  })

  it('Complete withdraw', async function () {
    const user = wallets[2].getAddressString()
    await stakeToken.mint(
      user,
      web3.utils.toWei('250')
    )
    await stakeToken.approve(validatorContract.address, web3.utils.toWei('250'), {
      from: user
    })
    await validatorContract.buyVoucher(web3.utils.toWei('100'), {
      from: user
    })
    // fake checkpoints * WITHDRAWAL_DELAY
    // stakeManager
    // await checkPoint(w, wallets[1], stakeManager)
    let result = await validatorContract.sellVoucher(web3.utils.toWei('100'), {
      from: user
    })
    let logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    // assertBigNumberEquality(logs[1].args.tokens, web3.utils.toWei('100'))
    // await validatorContract.unStakeClaimTokens(user)
    // await validatorContract.withdrawExchangeRate
    // assertBigNumberEquality(delegator.share, web3.utils.toWei('100'))

  })
})
