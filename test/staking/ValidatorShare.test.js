import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import utils from 'ethereumjs-util'

import deployer from '../helpers/deployer.js'
import { TestToken, ValidatorShare } from '../helpers/artifacts'
import logDecoder from '../helpers/log-decoder.js'

import { checkPoint, assertBigNumberEquality, assertBigNumbergt } from '../helpers/utils.js'
import { generateFirstWallets, mnemonics } from '../helpers/wallets.js'

chai.use(chaiAsPromised).should()

contract('ValidatorShare', async function (accounts) {
  let validatorContract, wallets, stakeToken, registry, stakeManager

  before(async function () {
    wallets = generateFirstWallets(mnemonics, 10)
  })

  beforeEach(async function () {
    let user = wallets[1].getAddressString()
    const userPubkey = wallets[1].getPublicKeyString()
    let amount = web3.utils.toWei('100')
    const contracts = await deployer.freshDeploy({ stakeManager: true })
    registry = contracts.registry
    stakeManager = contracts.stakeManager
    stakeToken = await TestToken.new("MATIC", "MATIC")

    await stakeManager.updateCheckPointBlockInterval(1)
    await stakeManager.updateValidatorThreshold(2)
    await stakeManager.changeRootChain(wallets[1].getAddressString())
    await stakeManager.setToken(stakeToken.address)
    await stakeToken.mint(stakeManager.address, web3.utils.toWei('10000000'))// rewards amount
    await stakeToken.mint(
      user,
      amount
    )
    await stakeToken.approve(stakeManager.address, amount, {
      from: user
    })

    await stakeManager.stake(amount, 0, true, userPubkey, {
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
    logs[1].event.should.equal('UnstakeInit')
    assertBigNumberEquality(logs[1].args.validatorId, '1')
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
    await stakeToken.approve(stakeManager.address, web3.utils.toWei('5000'), {
      from: user
    })

    result = await validatorContract.buyVoucher(web3.utils.toWei('5000'), {
      from: user
    })
    logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    assertBigNumberEquality(logs[3].args.tokens, web3.utils.toBN('98039215686274509803'))
    assertBigNumberEquality(await validatorContract.exchangeRate(), web3.utils.toBN('5100'))
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
    logs[1].event.should.equal('Transfer')
    logs[1].args.from.toLowerCase().should.equal(stakeManager.address.toLowerCase())
    logs[1].args.to.toLowerCase().should.equal(user.toLowerCase())
    // logs[2].args.rewards.should.be.bignumber.equal(await validatorContract.rewards())
    // logs[1].args.value.should.be.bignumber.equal()
    // assertBigNumberEquality(logs[1].args.tokens, web3.utils.toWei('100'))
  })

  it('Sell voucher with big rewards', async function () {
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
    const shares = await validatorContract.balanceOf(user)

    for (let i = 0; i < 4; i++) {
      await checkPoint([wallets[1]], wallets[1], stakeManager, { totalStake: web3.utils.toWei('350') }, {
        from: wallets[1].getAddressString()
      })
    }

    await stakeToken.mint(
      stakeManager.address,
      web3.utils.toWei('30000')
    )
    let result = await validatorContract.sellVoucher({
      from: user
    })
    let logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    logs[2].event.should.equal('ShareBurned')
    // logs[2].args.tokens.should.be.bignumber.equal(await validatorContract.rewards())
    assertBigNumberEquality(logs[2].args.tokens, shares)
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
    await checkPoint([wallets[1]], wallets[1], stakeManager, { totalStake: web3.utils.toWei('350') }, {
      from: wallets[1].getAddressString()
    })
    await stakeToken.mint(
      stakeManager.address,
      web3.utils.toWei('10000')
    )
    let rewards = await validatorContract.getLiquidRewards(user)
    let result = await validatorContract.reStake({
      from: user
    })
    let logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    logs.should.have.lengthOf(3)
    logs[2].event.should.equal('DelReStaked')
    assertBigNumberEquality(rewards, web3.utils.toWei('5000'))
    assertBigNumberEquality(logs[2].args.totalStaked, web3.utils.toWei('5100'))
    assertBigNumberEquality(logs[2].args.validatorId, '1')
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

contract('ValidatorShare: commissionRate', async function (accounts) {
  let validatorContract, wallets, stakeToken, registry, stakeManager

  before(async function () {
    wallets = generateFirstWallets(mnemonics, 10)
  })

  beforeEach(async function () {
    let user = wallets[1].getAddressString()
    const userPubkey = wallets[1].getPublicKeyString()
    let amount = web3.utils.toWei('100')
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
    await stakeToken.mint(stakeManager.address, web3.utils.toWei('1000000'))// rewards amount
    await stakeToken.mint(
      user,
      amount
    )
    await stakeToken.approve(stakeManager.address, amount, {
      from: user
    })

    await stakeManager.stake(amount, 0, true, userPubkey, {
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
    logs[1].event.should.equal('UnstakeInit')
    assertBigNumberEquality(logs[1].args.validatorId, '1')
  })

  it('Buy shares and test exchange rate with commission update', async function () {
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
    assertBigNumberEquality(await validatorContract.rewards(), web3.utils.toBN('0'))
    assertBigNumberEquality(await validatorContract.validatorRewards(), web3.utils.toBN('0'))

    await validatorContract.updateCommissionRate(50, { from: wallets[1].getAddressString() })
    await checkPoint([wallets[1]], wallets[1], stakeManager, { totalStake: web3.utils.toWei('200') }, {
      from: wallets[1].getAddressString()
    })
    assertBigNumberEquality(await validatorContract.getLiquidRewards(user), web3.utils.toWei('2500'))
    const oldRewards = await validatorContract.rewards()
    const oldExchangeRate = await validatorContract.exchangeRate()
    await validatorContract.updateCommissionRate(100, { from: wallets[1].getAddressString() })
    await checkPoint([wallets[1]], wallets[1], stakeManager, { totalStake: web3.utils.toWei('200') }, {
      from: wallets[1].getAddressString()
    })
    assertBigNumberEquality(oldRewards, await validatorContract.rewards())
    assertBigNumberEquality(oldExchangeRate, await validatorContract.exchangeRate())
    await stakeToken.mint(
      user,
      web3.utils.toWei('20000')
    )
    await stakeToken.approve(stakeManager.address, web3.utils.toWei('2600'), {
      from: user
    })

    result = await validatorContract.buyVoucher(web3.utils.toWei('2600'), {
      from: user
    })
    logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    await validatorContract.updateCommissionRate(0, { from: wallets[1].getAddressString() })
    assertBigNumberEquality(web3.utils.toWei('100'), logs[3].args.tokens)
    // should be around 25 something
    assertBigNumberEquality(await validatorContract.exchangeRate(), web3.utils.toBN('2600'))
  })
})
