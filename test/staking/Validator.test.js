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
    await contracts.governance.update(
      contracts.registry.address,
      contracts.registry.contract.methods.updateContractMap(
        utils.keccak256('stakeManager'),
        stakeManager.address
      ).encodeABI()
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

    await stakeManager.stake(amount, 0, user, true, {
      from: user
    })
    let validator = await stakeManager.validators(1)
    validatorContract = await ValidatorShare.at(validator.contractAddress)
  })

  afterEach(async function () {
    let user = wallets[1].getAddressString()
    let result = await stakeManager.unstake(1, {
      from: user
    })
    let logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    logs[0].event.should.equal('UnstakeInit')
    assertBigNumberEquality(logs[0].args.validatorId, '1')
  })

  it('Buy shares and test exchange rate', async function () {
    const user = wallets[2].getAddressString()
    await stakeToken.mint(
      user,
      web3.utils.toWei('250')
    )
    await stakeToken.approve(stakeManager.address, web3.utils.toWei('250'), {
      from: user
    })
    let result = await validatorContract.buyVoucher(web3.utils.toWei('100'), {
      from: user
    })
    let logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    assertBigNumberEquality(logs[3].args.amount, logs[3].args.tokens)
    assertBigNumberEquality(await validatorContract.exchangeRate(), web3.utils.toBN('100'))

    await checkPoint([wallets[1]], wallets[1], stakeManager, { totalStake: web3.utils.toWei('350') }, {
      from: wallets[1].getAddressString()
    })

    await stakeToken.mint(
      user,
      web3.utils.toWei('10100')
    )
    await stakeToken.approve(stakeManager.address, web3.utils.toWei('2957'), {
      from: user
    })

    result = await validatorContract.buyVoucher(web3.utils.toWei('2957'), {
      from: user
    })

    logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    assertBigNumberEquality(web3.utils.toWei('100'), logs[3].args.tokens)
    assertBigNumberEquality(await validatorContract.exchangeRate(), web3.utils.toBN('2957'))
  })

  it('Sell share and test exchange rate and withdraw pool', async function () {
    const user = wallets[2].getAddressString()
    await stakeToken.mint(
      user,
      web3.utils.toWei('250')
    )
    let beforeExchangeRate = await validatorContract.exchangeRate()
    await stakeToken.approve(stakeManager.address, web3.utils.toWei('250'), {
      from: user
    })
    await validatorContract.buyVoucher(web3.utils.toWei('100'), {
      from: user
    })
    let result = await validatorContract.sellVoucher({
      from: user
    })
    let afterExchangeRate = await validatorContract.exchangeRate()
    let logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    assertBigNumberEquality(afterExchangeRate, beforeExchangeRate)
    assertBigNumberEquality(logs[1].args.tokens, web3.utils.toWei('100'))
  })

  it('Claim rewards', async function () {
    const user = wallets[2].getAddressString()
    await stakeToken.mint(
      user,
      web3.utils.toWei('100')
    )
    await stakeToken.approve(stakeManager.address, web3.utils.toWei('100'), {
      from: user
    })
    await validatorContract.buyVoucher(web3.utils.toWei('100'), {
      from: user
    })

    await checkPoint([wallets[1]], wallets[1], stakeManager, { totalStake: web3.utils.toWei('350') }, {
      from: wallets[1].getAddressString()
    })

    await stakeToken.mint(
      stakeManager.address,
      web3.utils.toWei('10000')
    )

    let result = await validatorContract.withdrawRewards({
      from: user
    })
    let logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    // console.log(logs)
    // console.log(JSON.stringify(logs))
    logs[1].event.should.equal('Transfer')
    logs[1].args.from.toLowerCase().should.equal(stakeManager.address.toLowerCase())
    logs[1].args.to.toLowerCase().should.equal(user.toLowerCase())
    // console.log(logs[2].args.rewards, await validatorContract.rewards())
    // logs[2].args.rewards.should.be.bignumber.equal(await validatorContract.rewards())
    // logs[1].args.value.should.be.bignumber.equal()
    // assertBigNumberEquality(logs[1].args.tokens, web3.utils.toWei('100'))
  })

  it('Restake', async function () {
    const user = wallets[2].getAddressString()
    await stakeToken.mint(
      user,
      web3.utils.toWei('250')
    )
    await stakeToken.approve(stakeManager.address, web3.utils.toWei('250'), {
      from: user
    })
    await validatorContract.buyVoucher(web3.utils.toWei('100'), {
      from: user
    })
    let exchangeRate = await validatorContract.exchangeRate()
    // console.log(exchangeRate)
    await checkPoint([wallets[1]], wallets[1], stakeManager, { totalStake: web3.utils.toWei('350') }, {
      from: wallets[1].getAddressString()
    })

    await stakeToken.mint(
      stakeManager.address,
      web3.utils.toWei('10000')
    )

    let result = await validatorContract.reStake({
      from: user
    })
    exchangeRate = await validatorContract.exchangeRate()
    // console.log(exchangeRate)
    let logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    // console.log(logs, JSON.stringify(logs))
    // assertBigNumberEquality(logs[1].args.tokens, web3.utils.toWei('100'))
  })

  it('Buy shares multiple times', async function () {
    const user = wallets[2].getAddressString()
    await stakeToken.mint(
      user,
      web3.utils.toWei('500')
    )
    await stakeToken.approve(stakeManager.address, web3.utils.toWei('500'), {
      from: user
    })
    await validatorContract.buyVoucher(web3.utils.toWei('100'), {
      from: user
    })
    await validatorContract.buyVoucher(web3.utils.toWei('150'), {
      from: user
    })
    await checkPoint([wallets[1]], wallets[1], stakeManager, { totalStake: web3.utils.toWei('350') }, {
      from: wallets[1].getAddressString()
    })
    await validatorContract.buyVoucher(web3.utils.toWei('250'), {
      from: user
    })
    assertBigNumberEquality(await validatorContract.amountStaked(user), web3.utils.toWei('500'))
  })

  it('Complete withdraw', async function () {
    const user = wallets[2].getAddressString()
    await stakeManager.updateDynastyValue(8)
    await stakeToken.mint(
      user,
      web3.utils.toWei('100')
    )

    await stakeToken.approve(stakeManager.address, web3.utils.toWei('100'), {
      from: user
    })
    await validatorContract.buyVoucher(web3.utils.toWei('100'), {
      from: user
    })

    await validatorContract.sellVoucher({
      from: user
    })
    let currentEpoch = await stakeManager.currentEpoch()
    let exitEpoch = currentEpoch.add(await stakeManager.WITHDRAWAL_DELAY())
    for (let i = currentEpoch; i <= exitEpoch; i++) {
      await checkPoint([wallets[1]], wallets[1], stakeManager, { totalStake: web3.utils.toWei('250') }, {
        from: wallets[1].getAddressString()
      })
    }
    let result = await validatorContract.unStakeClaimTokens({
      from: user
    })

    let logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    assertBigNumberEquality(logs[0].args.value, web3.utils.toWei('100'))
  })
})
