import { TestToken, ValidatorShare, StakingInfo, EventsHub } from '../../helpers/artifacts'
import { BN, expectEvent, expectRevert } from '@openzeppelin/test-helpers'
import { checkPoint, assertBigNumberEquality, updateSlashedAmounts } from '../../helpers/utils.js'
import { wallets, freshDeploy, approveAndStake } from './deployment'
import { buyVoucher, sellVoucher, sellVoucherNew } from './ValidatorShareHelper.js'
import { web3 } from '@openzeppelin/test-helpers/src/setup'

const toWei = web3.utils.toWei
const ZeroAddr = '0x0000000000000000000000000000000000000000'
const ExchangeRatePrecision = new BN('100000000000000000000000000000')
const Dynasty = 8
const ValidatorDefaultStake = new BN(toWei('100'))

function shouldHaveCorrectStakes({ user, userTotalStaked, totalStaked }) {
  it('must have correct total staked', async function() {
    const result = await this.validatorContract.amountStaked(user || this.user)
    assertBigNumberEquality(result, userTotalStaked)
  })

  it('validator state must have correct amount', async function() {
    assertBigNumberEquality(await this.stakeManager.currentValidatorSetTotalStake(), totalStaked)
  })
}

function shouldBuyShares({ shares, voucherValueExpected, totalStaked }) {
  it('ValidatorShare must mint correct amount of shares', async function() {
    await expectEvent.inTransaction(this.receipt.tx, ValidatorShare, 'Transfer', {
      from: ZeroAddr,
      to: this.user,
      value: shares
    })
  })

  it('must emit ShareMinted', async function() {
    await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'ShareMinted', {
      validatorId: this.validatorId,
      user: this.user,
      amount: voucherValueExpected,
      tokens: shares
    })
  })

  it('must emit StakeUpdate', async function() {
    await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'StakeUpdate', {
      validatorId: this.validatorId,
      newAmount: totalStaked
    })
  })
}

function shouldWithdrawReward({ initialBalance, validatorId, user, reward, checkBalance = true }) {
  if (reward > 0) {
    it('must emit Transfer', async function() {
      await expectEvent.inTransaction(this.receipt.tx, TestToken, 'Transfer', {
        from: this.stakeManager.address,
        to: user || this.user,
        value: reward
      })
    })

    it('must emit DelegatorClaimedRewards', async function() {
      await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'DelegatorClaimedRewards', {
        validatorId: validatorId.toString(),
        user: user || this.user,
        rewards: reward
      })
    })
  }

  if (checkBalance) {
    it('must have updated balance', async function() {
      const balance = await this.stakeToken.balanceOf(user || this.user)
      assertBigNumberEquality(balance, new BN(initialBalance).add(new BN(reward)))
    })
  }

  it('must have liquid rewards == 0', async function() {
    let rewards = await this.validatorContract.getLiquidRewards(user || this.user)
    assertBigNumberEquality('0', rewards)
  })

  it('must have correct initialRewardPerShare', async function() {
    const currentRewardPerShare = await this.validatorContract.rewardPerShare()
    const userRewardPerShare = await this.validatorContract.initalRewardPerShare(user || this.user)
    assertBigNumberEquality(currentRewardPerShare, userRewardPerShare)
  })
}

contract('ValidatorShare', async function() {
  const wei100 = toWei('100')

  async function slash(slashes = [], validators = [], proposer = wallets[1], nonce = 1) {
    let slashingInfoList = []
    for (const slash of slashes) {
      slashingInfoList.push([parseInt(slash.validator), new BN(slash.amount), '0x0'])
    }

    return updateSlashedAmounts(validators, proposer, nonce, slashingInfoList, this.slashingManager)
  }

  async function doDeploy() {
    await freshDeploy.call(this)

    this.stakeToken = await TestToken.new('MATIC', 'MATIC')

    await this.stakeManager.setStakingToken(this.stakeToken.address)

    await this.stakeToken.mint(this.stakeManager.address, toWei('10000000'))

    this.validatorId = '8'
    this.validatorUser = wallets[0]
    this.stakeAmount = ValidatorDefaultStake

    await this.stakeManager.updateDynastyValue(Dynasty)
    await this.stakeManager.updateValidatorThreshold(8)

    // we need to increase validator id beyond foundation id, repeat 7 times
    for (let i = 0; i < 7; ++i) {
      await approveAndStake.call(this, { wallet: this.validatorUser, stakeAmount: this.stakeAmount, acceptDelegation: true })
      await this.governance.update(
        this.stakeManager.address,
        this.stakeManager.contract.methods.forceUnstake(i + 1).encodeABI()
      )
      await this.stakeManager.forceFinalizeCommit()
      await this.stakeManager.advanceEpoch(Dynasty)
      await this.stakeManager.unstakeClaim(i + 1, { from: this.validatorUser.getChecksumAddressString() })
      await this.stakeManager.resetSignerUsed(this.validatorUser.getChecksumAddressString())
    }

    await approveAndStake.call(this, { wallet: this.validatorUser, stakeAmount: this.stakeAmount, acceptDelegation: true })
    await this.stakeManager.forceFinalizeCommit()

    let validator = await this.stakeManager.validators(this.validatorId)
    this.validatorContract = await ValidatorShare.at(validator.contractAddress)
  }

  describe('locking', function() {
    before(doDeploy)

    describe('lock', function() {
      describe('when from is not stake manager', function() {
        it('reverts', async function() {
          await expectRevert.unspecified(this.validatorContract.lock())
        })
      })
    })

    describe('unlock', function() {
      describe('when from is not stake manager', function() {
        it('reverts', async function() {
          await expectRevert.unspecified(this.validatorContract.unlock())
        })
      })
    })
  })

  describe('updateDelegation', function() {
    describe('when from is not stake manager', function() {
      before(doDeploy)

      it('reverts', async function() {
        await expectRevert.unspecified(this.validatorContract.updateDelegation(false, { from: wallets[1].getAddressString() }))
      })
    })

    describe('when from is stake manager', function() {
      before(doDeploy)

      it('updates delegation', async function() {
        await this.stakeManager.updateValidatorDelegation(false, { from: this.validatorUser.getAddressString() })
      })
    })
  })

  describe('drain', function() {
    function prepareForTests() {
      before(doDeploy)
      before(async function() {
        this.testToken = await TestToken.new('MATIC2', 'MATIC2')
        this.value = toWei('10')
        await this.testToken.mint(this.validatorContract.address, this.value)

        this.user = wallets[2].getChecksumAddressString()
        this.userOldBalance = await this.testToken.balanceOf(this.user)
      })
    }
  })

  function deployAliceAndBob() {
    before(doDeploy)
    before('Alice & Bob', async function() {
      this.alice = wallets[2].getChecksumAddressString()
      this.bob = wallets[3].getChecksumAddressString()
      this.totalStaked = new BN(0)

      const mintAmount = new BN(toWei('70000'))

      await this.stakeToken.mint(this.alice, mintAmount)
      await this.stakeToken.approve(this.stakeManager.address, mintAmount, {
        from: this.alice
      })

      await this.stakeToken.mint(this.bob, mintAmount)
      await this.stakeToken.approve(this.stakeManager.address, mintAmount, {
        from: this.bob
      })
    })
  }

  describe('buyVoucher', function() {
    function testBuyVoucher({ voucherValue, voucherValueExpected, userTotalStaked, totalStaked, shares, reward, initialBalance }) {
      it('must buy voucher', async function() {
        this.receipt = await buyVoucher(this.validatorContract, voucherValue, this.user, shares)
      })

      shouldBuyShares({
        voucherValueExpected,
        shares,
        totalStaked
      })

      shouldHaveCorrectStakes({
        userTotalStaked,
        totalStaked
      })

      shouldWithdrawReward({
        initialBalance,
        reward,
        validatorId: '8'
      })
    }

    describe('when Alice purchases voucher once', function() {
      deployAliceAndBob()

      before(function() {
        this.user = this.alice
      })

      testBuyVoucher({
        voucherValue: toWei('100'),
        voucherValueExpected: toWei('100'),
        userTotalStaked: toWei('100'),
        totalStaked: toWei('200'),
        shares: toWei('100'),
        reward: '0',
        initialBalance: toWei('69900')
      })
    })

    describe('when Alice purchases voucher with exact minSharesToMint', function() {
      deployAliceAndBob()

      before(function() {
        this.user = this.alice
      })

      testBuyVoucher({
        voucherValue: toWei('100'),
        voucherValueExpected: toWei('100'),
        userTotalStaked: toWei('100'),
        totalStaked: toWei('200'),
        shares: toWei('100'),
        reward: '0',
        initialBalance: toWei('69900')
      })
    })

    describe('when validator turns off delegation', function() {
      deployAliceAndBob()

      before('disable delegation', async function() {
        await this.stakeManager.updateValidatorDelegation(false, { from: this.validatorUser.getChecksumAddressString() })
      })

      it('reverts', async function() {
        await expectRevert(buyVoucher(this.validatorContract, toWei('150'), this.alice), 'Delegation is disabled')
      })
    })

    describe('when staking manager delegation is disabled', function() {
      deployAliceAndBob()

      before('disable delegation', async function() {
        await this.governance.update(
          this.stakeManager.address,
          this.stakeManager.contract.methods.setDelegationEnabled(false).encodeABI()
        )
      })

      it('reverts', async function() {
        await expectRevert(buyVoucher(this.validatorContract, web3.utils.toWei('150'), this.alice), 'Delegation is disabled')
      })
    })

    describe('when Alice purchases voucher 3 times in a row, no checkpoints inbetween', function() {
      deployAliceAndBob()

      before(function() {
        this.user = this.alice
      })

      describe('1st purchase', async function() {
        testBuyVoucher({
          voucherValue: toWei('100'),
          voucherValueExpected: toWei('100'),
          userTotalStaked: toWei('100'),
          totalStaked: toWei('200'),
          shares: toWei('100'),
          reward: '0',
          initialBalance: toWei('69900')
        })
      })

      describe('2nd purchase', async function() {
        testBuyVoucher({
          voucherValue: toWei('150'),
          voucherValueExpected: toWei('150'),
          userTotalStaked: toWei('250'),
          totalStaked: toWei('350'),
          shares: toWei('150'),
          reward: '0',
          initialBalance: toWei('69750')
        })
      })

      describe('3rd purchase', async function() {
        testBuyVoucher({
          voucherValue: toWei('250'),
          voucherValueExpected: toWei('250'),
          userTotalStaked: toWei('500'),
          totalStaked: toWei('600'),
          shares: toWei('250'),
          reward: '0',
          initialBalance: toWei('69500')
        })
      })
    })

    describe('when Alice purchases voucher 3 times in a row, 1 checkpoint inbetween', function() {
      function advanceCheckpointAfter() {
        after(async function() {
          await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)
        })
      }

      deployAliceAndBob()

      before(function() {
        this.user = this.alice
      })

      describe('1st purchase', async function() {
        advanceCheckpointAfter()

        testBuyVoucher({
          voucherValue: toWei('100'),
          voucherValueExpected: toWei('100'),
          userTotalStaked: toWei('100'),
          totalStaked: toWei('200'),
          shares: toWei('100'),
          reward: '0',
          initialBalance: toWei('69900')
        })
      })

      describe('2nd purchase', async function() {
        advanceCheckpointAfter()

        testBuyVoucher({
          voucherValue: toWei('150'),
          voucherValueExpected: toWei('150'),
          userTotalStaked: toWei('250'),
          totalStaked: toWei('350'),
          shares: toWei('150'),
          reward: toWei('4500'),
          initialBalance: toWei('69750')
        })
      })

      describe('3rd purchase', async function() {
        testBuyVoucher({
          voucherValue: toWei('250'),
          voucherValueExpected: toWei('250'),
          userTotalStaked: toWei('500'),
          totalStaked: toWei('600'),
          shares: toWei('250'),
          reward: '6428571428571428571428',
          initialBalance: toWei('74000')
        })
      })
    })

    describe('when Alice and Bob purchase vouchers, no checkpoints inbetween', function() {
      deployAliceAndBob()

      describe('when Alice stakes 1st time', function() {
        before(function() {
          this.user = this.alice
        })

        testBuyVoucher({
          voucherValue: toWei('100'),
          voucherValueExpected: toWei('100'),
          userTotalStaked: toWei('100'),
          totalStaked: toWei('200'),
          shares: toWei('100'),
          reward: '0',
          initialBalance: toWei('69900')
        })
      })

      describe('when Bob stakes 1st time', function() {
        before(function() {
          this.user = this.bob
        })

        testBuyVoucher({
          voucherValue: toWei('100'),
          voucherValueExpected: toWei('100'),
          userTotalStaked: toWei('100'),
          totalStaked: toWei('300'),
          shares: toWei('100'),
          reward: '0',
          initialBalance: toWei('69900')
        })
      })

      describe('when Alice stakes 2nd time', function() {
        before(function() {
          this.user = this.alice
        })

        testBuyVoucher({
          voucherValue: toWei('200'),
          voucherValueExpected: toWei('200'),
          userTotalStaked: toWei('300'),
          totalStaked: toWei('500'),
          shares: toWei('200'),
          reward: '0',
          initialBalance: toWei('69700')
        })
      })

      describe('when Bob stakes 2nd time', function() {
        before(function() {
          this.user = this.bob
        })

        testBuyVoucher({
          voucherValue: toWei('200'),
          voucherValueExpected: toWei('200'),
          userTotalStaked: toWei('300'),
          totalStaked: toWei('700'),
          shares: toWei('200'),
          reward: '0',
          initialBalance: toWei('69700')
        })
      })
    })

    describe('when Alice and Bob purchase vouchers, 1 checkpoint inbetween', function() {
      function advanceCheckpointAfter() {
        after(async function() {
          await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)
        })
      }

      deployAliceAndBob()

      describe('when Alice stakes 1st time', function() {
        advanceCheckpointAfter()
        before(function() {
          this.user = this.alice
        })

        testBuyVoucher({
          voucherValue: toWei('100'),
          voucherValueExpected: toWei('100'),
          userTotalStaked: toWei('100'),
          totalStaked: toWei('200'),
          shares: toWei('100'),
          reward: '0',
          initialBalance: toWei('69900')
        })
      })

      describe('when Bob stakes 1st time', function() {
        advanceCheckpointAfter()
        before(function() {
          this.user = this.bob
        })

        testBuyVoucher({
          voucherValue: toWei('100'),
          voucherValueExpected: toWei('100'),
          userTotalStaked: toWei('100'),
          totalStaked: toWei('300'),
          shares: toWei('100'),
          reward: '0',
          initialBalance: toWei('69900')
        })
      })

      describe('when Alice stakes 2nd time', function() {
        advanceCheckpointAfter()
        before(function() {
          this.user = this.alice
        })

        testBuyVoucher({
          voucherValue: toWei('200'),
          voucherValueExpected: toWei('200'),
          userTotalStaked: toWei('300'),
          totalStaked: toWei('500'),
          shares: toWei('200'),
          reward: toWei('7500'),
          initialBalance: toWei('69700')
        })
      })

      describe('when Bob stakes 2nd time', function() {
        before(function() {
          this.user = this.bob
        })

        testBuyVoucher({
          voucherValue: toWei('200'),
          voucherValueExpected: toWei('200'),
          userTotalStaked: toWei('300'),
          totalStaked: toWei('700'),
          shares: toWei('200'),
          reward: toWei('4800'),
          initialBalance: toWei('69700')
        })
      })
    })

    describe('when locked', function() {
      deployAliceAndBob()

      before(async function() {
        await this.stakeManager.testLockShareContract(this.validatorId, true)
      })

      it('reverts', async function() {
        await expectRevert(buyVoucher(this.validatorContract, toWei('100'), this.alice, toWei('100')), 'locked')
      })
    })

    describe('when validator unstaked', function() {
      deployAliceAndBob()
      before(async function() {
        await this.stakeManager.unstake(this.validatorId, { from: this.validatorUser.getChecksumAddressString() })
        await this.stakeManager.advanceEpoch(Dynasty)
      })

      it('reverts', async function() {
        await expectRevert(buyVoucher(this.validatorContract, new BN(toWei('100')), this.alice), 'locked')
      })
    })
  })

  describe('exchangeRate', function() {
    describe('when Alice purchases voucher 2 times, 1 epoch between', function() {
      before(doDeploy)

      before(async function() {
        this.user = wallets[2].getAddressString()
        this.totalStaked = new BN(0)

        const voucherAmount = new BN(toWei('70000'))
        await this.stakeToken.mint(this.user, voucherAmount)
        await this.stakeToken.approve(this.stakeManager.address, voucherAmount, {
          from: this.user
        })
      })

      it('must buy voucher', async function() {
        const voucherValue = toWei('100')
        this.totalStaked = this.totalStaked.add(new BN(voucherValue))

        await buyVoucher(this.validatorContract, voucherValue, this.user)
      })

      it('exchange rate must be correct', async function() {
        assertBigNumberEquality(await this.validatorContract.exchangeRate(), ExchangeRatePrecision)
      })

      it('must buy another voucher 1 epoch later', async function() {
        await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)

        const voucherValue = toWei('5000')
        this.totalStaked = this.totalStaked.add(new BN(voucherValue))
        await buyVoucher(this.validatorContract, voucherValue, this.user)
      })

      it('exchange rate must be correct', async function() {
        assertBigNumberEquality(await this.validatorContract.exchangeRate(), ExchangeRatePrecision)
      })
    })

    describe('when Alice purchases voucher and sells it', function() {
      before(doDeploy)
      before(async function() {
        this.user = wallets[2].getAddressString()
        await this.stakeToken.mint(
          this.user,
          toWei('250')
        )

        this.beforeExchangeRate = await this.validatorContract.exchangeRate()
        await this.stakeToken.approve(this.stakeManager.address, toWei('250'), {
          from: this.user
        })
      })

      it('must purchase voucher', async function() {
        await buyVoucher(this.validatorContract, toWei('100'), this.user)
      })

      it('must sell voucher', async function() {
        await sellVoucher(this.validatorContract, this.user)
      })

      it('must have initial exchange rate', async function() {
        let afterExchangeRate = await this.validatorContract.exchangeRate()
        assertBigNumberEquality(afterExchangeRate, this.beforeExchangeRate)
      })
    })

    describe('when Alice is slashed by 50% and then Bob purchases voucher (both buy 100 eth worth of shares)', function() {
      before(doDeploy)

      describe('when Alice is slashed by 50%', function() {
        before(async function() {
          this.user = wallets[2].getAddressString()
          await this.stakeToken.mint(
            this.user,
            this.stakeAmount
          )

          await this.stakeToken.approve(this.stakeManager.address, this.stakeAmount, {
            from: this.user
          })

          await buyVoucher(this.validatorContract, this.stakeAmount, this.user)
        })
        before('slash', async function() {
          await slash.call(this, [{ validator: this.validatorId, amount: this.stakeAmount }], [this.validatorUser], this.validatorUser)
        })

        it('exchange rate == 50', async function() {
          let rate = await this.validatorContract.exchangeRate()
          assertBigNumberEquality(ExchangeRatePrecision.div(new BN(2)), rate)
        })

        it('Alice shares == 100 eth', async function() {
          const shares = await this.validatorContract.balanceOf(this.user)
          assertBigNumberEquality(this.stakeAmount, shares)
        })
      })

      describe('when Bob purchases a voucher', function() {
        before(async function() {
          this.user = wallets[1].getAddressString()
          await this.stakeToken.mint(
            this.user,
            this.stakeAmount
          )

          this.beforeExchangeRate = await this.validatorContract.exchangeRate()
          await this.stakeToken.approve(this.stakeManager.address, this.stakeAmount, {
            from: this.user
          })

          await buyVoucher(this.validatorContract, this.stakeAmount, this.user)
        })

        it('exchange rate == 50', async function() {
          let rate = await this.validatorContract.exchangeRate()
          assertBigNumberEquality(ExchangeRatePrecision.div(new BN(2)), rate)
        })

        it('Bob shares == 200 eth', async function() {
          const shares = await this.validatorContract.balanceOf(this.user)
          assertBigNumberEquality(this.stakeAmount.mul(new BN(2)), shares)
        })
      })
    })

    describe('when all tokens are slashed', function() {
      before(doDeploy)
      before(async function() {
        this.user = wallets[2].getAddressString()
        await this.stakeToken.mint(
          this.user,
          toWei('250')
        )
        await this.stakeToken.approve(this.stakeManager.address, toWei('250'), {
          from: this.user
        })
        await buyVoucher(this.validatorContract, toWei('100'), this.user)
        // slash all tokens
        await slash.call(this, [{ validator: this.validatorId, amount: await this.stakeManager.currentValidatorSetTotalStake() }], [this.validatorUser], this.validatorUser, 1)
      })

      it('exchange rate must be == 0', async function() {
        assertBigNumberEquality(await this.validatorContract.exchangeRate(), '0')
      })
    })
  })

  describe('sellVoucher', function() {
    const aliceStake = new BN(toWei('100'))
    const bobStake = new BN(toWei('200'))
    const Alice = wallets[2].getChecksumAddressString()
    const Bob = wallets[1].getChecksumAddressString()

    async function doDeployAndBuyVoucherForAliceAndBob(includeBob = false) {
      await doDeploy.call(this)

      const stake = async({ user, stake }) => {
        await this.stakeToken.mint(user, stake)
        await this.stakeToken.approve(this.stakeManager.address, stake, {
          from: user
        })
        await buyVoucher(this.validatorContract, stake, user)
      }

      await stake({ user: Alice, stake: aliceStake })

      if (includeBob) {
        await stake({ user: Bob, stake: bobStake })
      }

      for (let i = 0; i < 4; i++) {
        await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)
      }
    }

    function testSellVoucherNew({
      returnedStake,
      reward,
      initialBalance,
      validatorId,
      user,
      minClaimAmount,
      userTotalStaked,
      totalStaked,
      shares,
      nonce,
      withdrawalExchangeRate = ExchangeRatePrecision
    }) {
      if (minClaimAmount) {
        it('must sell voucher with slippage', async function() {
          this.receipt = await sellVoucherNew(this.validatorContract, user, minClaimAmount)
        })
      } else {
        it('must sell voucher', async function() {
          this.receipt = await sellVoucherNew(this.validatorContract, user)
        })
      }

      if (nonce) {
        it('must emit ShareBurnedWithId', async function() {
          await expectEvent.inTransaction(this.receipt.tx, EventsHub, 'ShareBurnedWithId', {
            validatorId: validatorId,
            tokens: shares,
            amount: returnedStake,
            user: user,
            nonce
          })
        })
      } else {
        it('must emit ShareBurned', async function() {
          await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'ShareBurned', {
            validatorId: validatorId,
            tokens: shares,
            amount: returnedStake,
            user: user
          })
        })
      }

      shouldWithdrawReward({ initialBalance, validatorId, user, reward })

      shouldHaveCorrectStakes({
        userTotalStaked,
        totalStaked,
        user
      })

      it('must have correct withdrawal exchange rate', async function() {
        const rate = await this.validatorContract.withdrawExchangeRate()
        assertBigNumberEquality(rate, withdrawalExchangeRate)
      })
    }

    function testSellVoucher({
      returnedStake,
      reward,
      initialBalance,
      validatorId,
      user,
      minClaimAmount,
      userTotalStaked,
      totalStaked,
      shares,
      withdrawalExchangeRate = ExchangeRatePrecision
    }) {
      if (minClaimAmount) {
        it('must sell voucher with slippage', async function() {
          this.receipt = await sellVoucher(this.validatorContract, user, minClaimAmount)
        })
      } else {
        it('must sell voucher', async function() {
          this.receipt = await sellVoucher(this.validatorContract, user)
        })
      }

      it('must emit ShareBurned', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'ShareBurned', {
          validatorId: validatorId,
          tokens: shares,
          amount: returnedStake,
          user: user
        })
      })

      shouldWithdrawReward({ initialBalance, validatorId, user, reward })

      shouldHaveCorrectStakes({
        userTotalStaked,
        totalStaked,
        user
      })

      it('must have correct withdrawal exchange rate', async function() {
        const rate = await this.validatorContract.withdrawExchangeRate()
        assertBigNumberEquality(rate, withdrawalExchangeRate)
      })
    }

    describe('when Alice sells voucher', function() {
      before(doDeployAndBuyVoucherForAliceAndBob)

      testSellVoucher({
        returnedStake: aliceStake,
        reward: toWei('18000'),
        initialBalance: new BN(0),
        validatorId: '8',
        user: Alice,
        userTotalStaked: toWei('0'),
        totalStaked: ValidatorDefaultStake,
        shares: aliceStake
      })
    })

    describe('when Alice sells voucher after 50% slash', function() {
      before(doDeployAndBuyVoucherForAliceAndBob)
      before('slash', async function() {
        await slash.call(this, [{ validator: this.validatorId, amount: this.stakeAmount }], [this.validatorUser], this.validatorUser)
      })

      const halfStake = aliceStake.div(new BN(2))

      testSellVoucher({
        returnedStake: halfStake,
        reward: toWei('18000'),
        initialBalance: new BN(0),
        validatorId: '8',
        user: Alice,
        userTotalStaked: toWei('0'),
        totalStaked: ValidatorDefaultStake.div(new BN(2)),
        shares: aliceStake
      })
    })

    describe('when all tokens are slashed', function() {
      before(doDeployAndBuyVoucherForAliceAndBob)
      before('slash', async function() {
        await slash.call(this, [{ validator: this.validatorId, amount: await this.stakeManager.currentValidatorSetTotalStake() }], [this.validatorUser], this.validatorUser)
      })

      it('reverts', async function() {
        await expectRevert(sellVoucher(this.validatorContract, Alice, '0'), 'Too much requested')
      })
    })

    describe('when delegation is disabled after voucher was purchased by Alice', function() {
      before(doDeployAndBuyVoucherForAliceAndBob)
      before('disable delegation', async function() {
        await this.governance.update(
          this.stakeManager.address,
          this.stakeManager.contract.methods.setDelegationEnabled(false).encodeABI()
        )
      })

      testSellVoucher({
        returnedStake: aliceStake,
        reward: toWei('18000'),
        initialBalance: new BN(0),
        validatorId: '8',
        user: Alice,
        userTotalStaked: toWei('0'),
        totalStaked: ValidatorDefaultStake,
        shares: aliceStake
      })
    })

    describe('when Alice sells with claimAmount greater than expected', function() {
      before(doDeployAndBuyVoucherForAliceAndBob)

      it('reverts', async function() {
        const maxShares = await this.validatorContract.balanceOf(Alice)
        await expectRevert(this.validatorContract.sellVoucher(toWei('100.00001'), maxShares, { from: Alice }), 'Too much requested')
      })
    })

    describe('when locked', function() {
      before(doDeployAndBuyVoucherForAliceAndBob)

      before(async function() {
        await this.stakeManager.testLockShareContract(this.validatorId, true)
      })

      testSellVoucher({
        returnedStake: aliceStake,
        reward: toWei('18000'),
        initialBalance: new BN(0),
        validatorId: '8',
        user: Alice,
        userTotalStaked: toWei('0'),
        totalStaked: ValidatorDefaultStake,
        shares: aliceStake
      })
    })

    describe('when validator unstaked', function() {
      before(doDeployAndBuyVoucherForAliceAndBob)
      before(async function() {
        await this.stakeManager.unstake(this.validatorId, { from: this.validatorUser.getChecksumAddressString() })
        await this.stakeManager.advanceEpoch(Dynasty)
      })

      testSellVoucher({
        returnedStake: aliceStake,
        reward: toWei('18000'),
        initialBalance: new BN(0),
        validatorId: '8',
        user: Alice,
        userTotalStaked: toWei('0'),
        totalStaked: ValidatorDefaultStake,
        shares: aliceStake
      })
    })

    describe('when Alice and Bob sell within withdrawal delay', function() {
      before(async function() {
        await doDeployAndBuyVoucherForAliceAndBob.call(this, true)
      })

      describe('when Alice sells', function() {
        testSellVoucher({
          returnedStake: aliceStake,
          reward: toWei('9000'),
          initialBalance: new BN(0),
          validatorId: '8',
          user: Alice,
          userTotalStaked: toWei('0'),
          shares: aliceStake,
          totalStaked: new BN(bobStake).add(ValidatorDefaultStake)
        })
      })

      describe('when Bob sells', function() {
        testSellVoucher({
          returnedStake: bobStake,
          reward: toWei('18000'),
          initialBalance: new BN(0),
          validatorId: '8',
          user: Bob,
          userTotalStaked: toWei('0'),
          shares: bobStake,
          totalStaked: ValidatorDefaultStake
        })
      })
    })

    describe('partial sell', function() {
      describe('new API', function() {
        describe('when Alice is not slashed', function() {
          before(doDeployAndBuyVoucherForAliceAndBob)

          const halfStake = aliceStake.div(new BN('2'))

          describe('when Alice sells 50%', function() {
            testSellVoucherNew({
              shares: new BN(toWei('50')),
              minClaimAmount: halfStake,
              returnedStake: halfStake,
              reward: toWei('18000'),
              initialBalance: new BN(0),
              validatorId: '8',
              user: Alice,
              userTotalStaked: halfStake,
              nonce: '1',
              totalStaked: halfStake.add(ValidatorDefaultStake)
            })
          })

          describe('when Alice sells 50%, after 1 epoch, within withdrawal delay', function() {
            before(async function() {
              await this.stakeManager.advanceEpoch(1)
            })

            testSellVoucherNew({
              shares: new BN(toWei('50')),
              minClaimAmount: halfStake,
              returnedStake: halfStake,
              reward: '0',
              initialBalance: new BN(toWei('18000')),
              validatorId: '8',
              user: Alice,
              userTotalStaked: '0',
              nonce: '2',
              totalStaked: ValidatorDefaultStake
            })
          })
        })

        describe('when Alice is slashed by 50%', function() {
          before(doDeployAndBuyVoucherForAliceAndBob)
          before(async function() {
            await slash.call(this, [{ validator: this.validatorId, amount: toWei('100') }], [this.validatorUser], this.validatorUser, 1)
          })

          const halfStake = aliceStake.div(new BN('4')) // slash by 50% occured
          const validatorHalfStake = ValidatorDefaultStake.div(new BN(2))

          describe('when Alice sells 50%', function() {
            testSellVoucherNew({
              shares: new BN(toWei('50')),
              minClaimAmount: halfStake,
              returnedStake: halfStake,
              reward: toWei('18000'),
              initialBalance: new BN(0),
              validatorId: '8',
              user: Alice,
              nonce: '1',
              userTotalStaked: halfStake,
              totalStaked: halfStake.add(validatorHalfStake)
            })
          })

          describe('when Alice sells 50%, after 1 epoch, within withdrawal delay', function() {
            before(async function() {
              await this.stakeManager.advanceEpoch(1)
            })

            testSellVoucherNew({
              shares: new BN(toWei('50')),
              minClaimAmount: halfStake,
              returnedStake: halfStake,
              reward: '0',
              initialBalance: new BN(toWei('18000')),
              validatorId: '8',
              user: Alice,
              userTotalStaked: '0',
              nonce: '2',
              totalStaked: validatorHalfStake
            })
          })
        })
      })

      describe('old API', function() {
        describe('when Alice is not slashed', function() {
          before(doDeployAndBuyVoucherForAliceAndBob)

          const halfStake = aliceStake.div(new BN('2'))

          describe('when Alice sells 50%', function() {
            testSellVoucher({
              shares: new BN(toWei('50')),
              minClaimAmount: halfStake,
              returnedStake: halfStake,
              reward: toWei('18000'),
              initialBalance: new BN(0),
              validatorId: '8',
              user: Alice,
              userTotalStaked: halfStake,
              totalStaked: halfStake.add(ValidatorDefaultStake)
            })
          })

          describe('when Alice sells 50%, after 1 epoch, within withdrawal delay', function() {
            before(async function() {
              await this.stakeManager.advanceEpoch(1)
            })

            testSellVoucher({
              shares: new BN(toWei('50')),
              minClaimAmount: halfStake,
              returnedStake: halfStake,
              reward: '0',
              initialBalance: new BN(toWei('18000')),
              validatorId: '8',
              user: Alice,
              userTotalStaked: '0',
              totalStaked: ValidatorDefaultStake
            })

            it('unbond epoch must be set to current epoch', async function() {
              const unbond = await this.validatorContract.unbonds(Alice)
              assertBigNumberEquality(unbond.withdrawEpoch, await this.stakeManager.currentEpoch())
            })
          })
        })

        describe('when Alice is slashed by 50%', function() {
          before(doDeployAndBuyVoucherForAliceAndBob)
          before(async function() {
            await slash.call(this, [{ validator: this.validatorId, amount: toWei('100') }], [this.validatorUser], this.validatorUser, 1)
          })

          const halfStake = aliceStake.div(new BN('4')) // slash by 50% occured
          const validatorHalfStake = ValidatorDefaultStake.div(new BN(2))

          describe('when Alice sells 50%', function() {
            testSellVoucher({
              shares: new BN(toWei('50')),
              minClaimAmount: halfStake,
              returnedStake: halfStake,
              reward: toWei('18000'),
              initialBalance: new BN(0),
              validatorId: '8',
              user: Alice,
              userTotalStaked: halfStake,
              totalStaked: halfStake.add(validatorHalfStake)
            })
          })

          describe('when Alice sells 50%, after 1 epoch, within withdrawal delay', function() {
            before(async function() {
              await this.stakeManager.advanceEpoch(1)
            })

            testSellVoucher({
              shares: new BN(toWei('50')),
              minClaimAmount: halfStake,
              returnedStake: halfStake,
              reward: '0',
              initialBalance: new BN(toWei('18000')),
              validatorId: '8',
              user: Alice,
              userTotalStaked: '0',
              totalStaked: validatorHalfStake
            })

            it('unbond epoch must be set to current epoch', async function() {
              const unbond = await this.validatorContract.unbonds(Alice)
              assertBigNumberEquality(unbond.withdrawEpoch, await this.stakeManager.currentEpoch())
            })
          })
        })
      })
    })
  })

  describe('withdrawRewards', function() {
    const Alice = wallets[2].getChecksumAddressString()
    const Bob = wallets[3].getChecksumAddressString()
    const Eve = wallets[4].getChecksumAddressString()
    const Carol = wallets[5].getChecksumAddressString()

    let totalDelegatorRewardsReceived
    let totalSlashed
    let totalStaked
    let totalInitialBalance
    let delegators = []

    function testWithdraw({ label, user, expectedReward, initialBalance }) {
      describe(`when ${label} withdraws`, function() {
        if (expectedReward.toString() === '0') {
          it('reverts', async function() {
            await expectRevert(this.validatorContract.withdrawRewards({
              from: user
            }), 'Too small rewards amount')
          })
        } else {
          it('must withdraw rewards', async function() {
            this.receipt = await this.validatorContract.withdrawRewards({
              from: user
            })
          })

          shouldWithdrawReward({
            reward: expectedReward,
            user: user,
            validatorId: '8',
            initialBalance: initialBalance
          })
        }
      })
    }

    function testSlash({ amount, nonce }) {
      describe('Slash', function() {
        it(`${amount.toString()} wei`, async function() {
          await slash.call(this, [{ validator: this.validatorId, amount: amount }], [this.validatorUser], this.validatorUser, nonce)
          totalSlashed = totalSlashed.add(new BN(amount))
        })
      })
    }

    function testStake({ user, amount, label, initialBalance = new BN(0) }) {
      describe(`${label} buyVoucher for ${amount.toString()} wei`, function() {
        it(`must purchase voucher`, async function() {
          totalInitialBalance = totalInitialBalance.add(initialBalance)
          totalStaked = totalStaked.add(new BN(amount))

          await this.stakeToken.mint(
            user,
            amount
          )
          await this.stakeToken.approve(this.stakeManager.address, amount, {
            from: user
          })
          await buyVoucher(this.validatorContract, amount, user)
          delegators[user] = delegators[user] || {
            rewards: new BN(0)
          }
        })

        it('must have correct initalRewardPerShare', async function() {
          const currentRewardPerShare = await this.validatorContract.getRewardPerShare()
          const userRewardPerShare = await this.validatorContract.initalRewardPerShare(user)
          assertBigNumberEquality(currentRewardPerShare, userRewardPerShare)
        })
      })
    }

    function testCheckpoint(checkpoints) {
      describe('checkpoints', function() {
        it(`${checkpoints} more checkpoint(s)`, async function() {
          let c = 0
          while (c++ < checkpoints) {
            await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)
          }

          totalDelegatorRewardsReceived = new BN(0)
          for (const user in delegators) {
            const rewards = await this.validatorContract.getLiquidRewards(user)
            totalDelegatorRewardsReceived = totalDelegatorRewardsReceived.add(rewards)
          }
        })
      })
    }

    function testLiquidRewards({ user, label, expectedReward }) {
      describe(`${label} liquid rewards`, function() {
        it(`${expectedReward.toString()}`, async function() {
          const rewards = await this.validatorContract.getLiquidRewards(user)
          assertBigNumberEquality(rewards, expectedReward)
        })
      })
    }

    function testAllRewardsReceived({ validatorReward, totalExpectedRewards }) {
      async function getValidatorReward() {
        return this.stakeManager.validatorReward(this.validatorId)
      }

      describe('total rewards', function() {
        it(`validator rewards == ${validatorReward.toString()}`, async function() {
          assertBigNumberEquality(await getValidatorReward.call(this), validatorReward)
        })

        it(`all expected rewards should be ${totalExpectedRewards.toString()}`, async function() {
          const validatorRewards = await getValidatorReward.call(this)
          assertBigNumberEquality(validatorRewards.add(totalDelegatorRewardsReceived), totalExpectedRewards)
        })

        it(`total received rewards must be correct`, async function() {
          const validatorRewards = await getValidatorReward.call(this)
          const totalReceived = validatorRewards.add(totalDelegatorRewardsReceived)

          await this.stakeManager.withdrawRewards(this.validatorId, { from: this.validatorUser.getChecksumAddressString() })

          const tokensLeft = await this.stakeToken.balanceOf(this.stakeManager.address)

          assertBigNumberEquality(
            this.initialStakeTokenBalance
              .add(totalStaked)
              .sub(totalReceived)
              .sub(totalInitialBalance)
              .sub(totalSlashed),
            tokensLeft
          )
        })
      })
    }

    function runWithdrawRewardsTest(timeline) {
      before(doDeploy)
      before(async function() {
        delegators = {}
        totalInitialBalance = new BN(0)
        totalStaked = new BN(0)
        totalSlashed = new BN(0)
        totalDelegatorRewardsReceived = new BN(0)
        this.initialStakeTokenBalance = await this.stakeToken.balanceOf(this.stakeManager.address)
      })

      for (const step of timeline) {
        if (step.slash) {
          testSlash(step.slash)
        } else if (step.stake) {
          testStake(step.stake)
        } else if (step.checkpoints) {
          testCheckpoint(step.checkpoints)
        } else if (step.withdraw) {
          testWithdraw(step.withdraw)
        } else if (step.liquidRewards) {
          testLiquidRewards(step.liquidRewards)
        } else if (step.allRewards) {
          testAllRewardsReceived(step.allRewards)
        }
      }
    }

    describe('when Alice purchases voucher after checkpoint', function() {
      runWithdrawRewardsTest([
        { checkpoints: 1 },
        { stake: { user: Alice, label: 'Alice', amount: new BN(wei100) } },
        { withdraw: { user: Alice, label: 'Alice', expectedReward: '0' } },
        { allRewards: { validatorReward: toWei('9000'), totalExpectedRewards: toWei('9000') } }
      ])
    })

    describe('when Alice is not slashed. 1 checkpoint passed', function() {
      runWithdrawRewardsTest([
        { stake: { user: Alice, label: 'Alice', amount: new BN(wei100) } },
        { checkpoints: 1 },
        { withdraw: { user: Alice, label: 'Alice', expectedReward: toWei('4500') } },
        { allRewards: { validatorReward: toWei('4500'), totalExpectedRewards: toWei('9000') } }
      ])
    })

    describe('when Alice is slashed by 50% and Bob purchases voucher after', function() {
      describe('when 1 checkpoint passes', function() {
        describe('when Alice and Bob withdraw rewards after', function() {
          runWithdrawRewardsTest([
            { stake: { user: Alice, label: 'Alice', amount: new BN(wei100) } },
            { slash: { amount: new BN(toWei('100')) } },
            { stake: { user: Bob, label: 'Bob', amount: new BN(wei100) } },
            { checkpoints: 1 },
            { withdraw: { label: 'Alice', user: Alice, expectedReward: toWei('2250') } },
            { withdraw: { label: 'Bob', user: Bob, expectedReward: toWei('4500') } },
            { allRewards: { validatorReward: toWei('2250'), totalExpectedRewards: toWei('9000') } }
          ])
        })
      })

      describe('when 2 checkpoints pass', function() {
        describe('when Alice and Bob withdraw rewards after', function() {
          runWithdrawRewardsTest([
            { stake: { user: Alice, label: 'Alice', amount: new BN(wei100) } },
            { slash: { amount: new BN(toWei('100')) } },
            { stake: { user: Bob, label: 'Bob', amount: new BN(wei100) } },
            { checkpoints: 2 },
            { liquidRewards: { user: Alice, label: 'Alice', expectedReward: toWei('4500') } },
            { liquidRewards: { user: Bob, label: 'Bob', expectedReward: toWei('9000') } },
            { withdraw: { label: 'Alice', user: Alice, expectedReward: toWei('4500') } },
            { withdraw: { label: 'Bob', user: Bob, expectedReward: toWei('9000') } },
            { allRewards: { validatorReward: toWei('4500'), totalExpectedRewards: toWei('18000') } }
          ])
        })
      })
    })

    describe('when Alice is slashed after checkpoint', function() {
      runWithdrawRewardsTest([
        { stake: { user: Alice, label: 'Alice', amount: new BN(wei100) } },
        { checkpoints: 1 },
        { slash: { amount: new BN(toWei('100')) } },
        { liquidRewards: { user: Alice, label: 'Alice', expectedReward: toWei('4500') } },
        { withdraw: { label: 'Alice', user: Alice, expectedReward: toWei('4500') } },
        { allRewards: { validatorReward: toWei('4500'), totalExpectedRewards: toWei('9000') } }
      ])
    })

    describe('Alice, Bob, Eve and Carol stake #1', function() {
      runWithdrawRewardsTest([
        { stake: { user: Alice, label: 'Alice', amount: new BN(toWei('100')) } },
        { checkpoints: 1 },
        { liquidRewards: { user: Alice, label: 'Alice', expectedReward: toWei('4500') } },
        { stake: { user: Bob, label: 'Bob', amount: new BN(toWei('500')) } },
        { slash: { amount: new BN(toWei('350')) } },
        { checkpoints: 1 },
        { liquidRewards: { user: Alice, label: 'Alice', expectedReward: '5785714285714285714285' } },
        { liquidRewards: { user: Bob, label: 'Bob', expectedReward: '6428571428571428571428' } },
        { stake: { user: Carol, label: 'Carol', amount: new BN(toWei('500')) } },
        { checkpoints: 1 },
        { liquidRewards: { user: Alice, label: 'Alice', expectedReward: '6315126050420168067226' } },
        { liquidRewards: { user: Bob, label: 'Bob', expectedReward: '9075630252100840336133' } },
        { liquidRewards: { user: Carol, label: 'Carol', expectedReward: '5294117647058823529411' } },
        { slash: { amount: new BN(toWei('167')), nonce: 2 } },
        { stake: { user: Eve, label: 'Eve', amount: new BN(toWei('500')), initialBalance: new BN(1) } },
        { checkpoints: 1 },
        { withdraw: { user: Alice, label: 'Alice', expectedReward: '6620779672815871910894' } },
        { withdraw: { user: Bob, label: 'Bob', expectedReward: '10603898364079359554473' } },
        { withdraw: { user: Carol, label: 'Carol', expectedReward: '8350653871015861966090' } },
        { withdraw: { user: Eve, label: 'Eve', expectedReward: '3803888419273034657649', initialBalance: new BN(1) } },
        { allRewards: { validatorReward: '6620779672815871910888', totalExpectedRewards: '35999999999999999999994' } }
      ])
    })

    describe('Alice, Bob, Eve and Carol stake #2', function() {
      runWithdrawRewardsTest([
        { stake: { user: Alice, label: 'Alice', amount: new BN(toWei('100')) } },
        { checkpoints: 1 },
        { liquidRewards: { user: Alice, label: 'Alice', expectedReward: toWei('4500') } },
        { stake: { user: Bob, label: 'Bob', amount: new BN(toWei('500')) } },
        { slash: { amount: new BN(toWei('350')) } },
        { checkpoints: 1 },
        { liquidRewards: { user: Alice, label: 'Alice', expectedReward: '5785714285714285714285' } },
        { liquidRewards: { user: Bob, label: 'Bob', expectedReward: '6428571428571428571428' } },
        { stake: { user: Carol, label: 'Carol', amount: new BN(toWei('500')) } },
        { slash: { amount: new BN(toWei('425')), nonce: 2 } },
        { checkpoints: 1 },
        { liquidRewards: { user: Alice, label: 'Alice', expectedReward: '6315126050420168067226' } },
        { liquidRewards: { user: Bob, label: 'Bob', expectedReward: '9075630252100840336133' } },
        { liquidRewards: { user: Carol, label: 'Carol', expectedReward: '5294117647058823529411' } },
        { slash: { amount: new BN(toWei('215')), nonce: 3 } },
        { stake: { user: Eve, label: 'Eve', amount: new BN(toWei('500')), initialBalance: new BN(1) } },
        { checkpoints: 1 },
        { withdraw: { user: Alice, label: 'Alice', expectedReward: '6471712628713457213871' } },
        { withdraw: { user: Bob, label: 'Bob', expectedReward: '9858563143567286069357' } },
        { withdraw: { user: Carol, label: 'Carol', expectedReward: '6859983429991714995859' } },
        { withdraw: { user: Eve, label: 'Eve', expectedReward: '6338028169014084507041', initialBalance: new BN(1) } },
        { allRewards: { validatorReward: '6471712628713457213867', totalExpectedRewards: '35999999999999999999995' } }
      ])
    })

    describe('when not enough rewards', function() {
      before(doDeploy)

      it('reverts', async function() {
        await expectRevert(this.validatorContract.withdrawRewards({ from: Alice }), 'Too small rewards amount')
      })
    })

    describe('when Alice withdraws 2 times in a row', async function() {
      runWithdrawRewardsTest([
        { stake: { user: Alice, label: 'Alice', amount: new BN(toWei('100')) } },
        { checkpoints: 1 },
        { withdraw: { user: Alice, label: 'Alice', expectedReward: toWei('4500') } },
        { withdraw: { user: Alice, label: 'Alice', expectedReward: '0' } }
      ])
    })

    describe('when locked', function() {
      before(doDeploy)

      before(async function() {
        const amount = toWei('100')
        await this.stakeToken.mint(
          Alice,
          amount
        )
        await this.stakeToken.approve(this.stakeManager.address, amount, {
          from: Alice
        })
        await buyVoucher(this.validatorContract, amount, Alice)
        await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)
        await this.stakeManager.testLockShareContract(this.validatorId, true)
      })

      it('must withdraw rewards', async function() {
        this.receipt = await this.validatorContract.withdrawRewards({
          from: Alice
        })
      })

      shouldWithdrawReward({
        initialBalance: new BN('0'),
        validatorId: '8',
        user: Alice,
        reward: toWei('4500')
      })
    })

    describe('when validator unstaked', function() {
      before(doDeploy)
      before(async function() {
        const amount = toWei('100')
        await this.stakeToken.mint(
          Alice,
          amount
        )
        await this.stakeToken.approve(this.stakeManager.address, amount, {
          from: Alice
        })
        await buyVoucher(this.validatorContract, amount, Alice)
        await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)
        await this.stakeManager.unstake(this.validatorId, { from: this.validatorUser.getChecksumAddressString() })
        await this.stakeManager.advanceEpoch(Dynasty)
      })

      it('must withdraw rewards', async function() {
        this.receipt = await this.validatorContract.withdrawRewards({
          from: Alice
        })
      })

      shouldWithdrawReward({
        initialBalance: new BN('0'),
        validatorId: '8',
        user: Alice,
        reward: toWei('4500')
      })
    })

    describe('when all tokens are slashed', function() {
      before(doDeploy)
      before('slash', async function() {
        const amount = toWei('100')
        await this.stakeToken.mint(
          Alice,
          amount
        )
        await this.stakeToken.approve(this.stakeManager.address, amount, {
          from: Alice
        })
        await buyVoucher(this.validatorContract, amount, Alice)
        await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)
        await slash.call(this, [{ validator: this.validatorId, amount: await this.stakeManager.currentValidatorSetTotalStake() }], [this.validatorUser], this.validatorUser)
      })

      it('must withdraw rewards', async function() {
        this.receipt = await this.validatorContract.withdrawRewards({
          from: Alice
        })
      })

      shouldWithdrawReward({
        initialBalance: new BN(0),
        validatorId: '8',
        user: Alice,
        reward: toWei('4500')
      })
    })
  })

  describe('restake', function() {
    function prepareForTest({ skipCheckpoint } = {}) {
      before(doDeploy)
      before(async function() {
        this.user = wallets[2].getChecksumAddressString()

        await this.stakeToken.mint(
          this.user,
          this.stakeAmount
        )
        await this.stakeToken.approve(this.stakeManager.address, this.stakeAmount, {
          from: this.user
        })

        await buyVoucher(this.validatorContract, this.stakeAmount, this.user)
        this.shares = await this.validatorContract.balanceOf(this.user)

        if (!skipCheckpoint) {
          await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)
        }
      })
    }

    describe('when Alice restakes', function() {
      const voucherValueExpected = new BN(toWei('4500'))
      const reward = new BN(toWei('4500'))
      const userTotalStaked = new BN(toWei('4600'))
      const shares = new BN(toWei('4500'))
      const totalStaked = new BN(toWei('4700'))
      const initialBalance = new BN(toWei('100'))

      prepareForTest()

      it('must restake', async function() {
        this.receipt = await this.validatorContract.restake({
          from: this.user
        })
      })

      shouldBuyShares({
        voucherValueExpected,
        userTotalStaked,
        totalStaked,
        shares,
        reward,
        initialBalance
      })

      shouldWithdrawReward({
        reward: '0', // we need only partial test here, reward is not really claimed
        initialBalance,
        checkBalance: false,
        validatorId: '8'
      })

      it('must emit DelegatorRestaked', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'DelegatorRestaked', {
          validatorId: this.validatorId,
          totalStaked: userTotalStaked
        })
      })
    })

    describe('when no liquid rewards', function() {
      prepareForTest({ skipCheckpoint: true })

      it('reverts', async function() {
        await expectRevert(this.validatorContract.restake({ from: this.user }), 'Too small rewards to restake')
      })
    })

    describe('when staking manager delegation is disabled', function() {
      prepareForTest()

      before('disable delegation', async function() {
        await this.governance.update(
          this.stakeManager.address,
          this.stakeManager.contract.methods.setDelegationEnabled(false).encodeABI()
        )
      })

      it('reverts', async function() {
        await expectRevert(this.validatorContract.restake({ from: this.user }), 'Delegation is disabled')
      })
    })

    describe('when validator unstaked', function() {
      prepareForTest()
      before(async function() {
        await this.stakeManager.unstake(this.validatorId, { from: this.validatorUser.getChecksumAddressString() })
      })

      it('reverts', async function() {
        await expectRevert(this.validatorContract.restake({ from: this.user }), 'locked')
      })
    })

    describe('when locked', function() {
      prepareForTest()

      before(async function() {
        await this.stakeManager.testLockShareContract(this.validatorId, true)
      })

      it('reverts', async function() {
        await expectRevert(this.validatorContract.restake({ from: this.user }), 'locked')
      })
    })
  })

  describe('unstakeClaimTokens', function() {
    function prepareForTest({ skipSell, skipBuy } = {}) {
      before(doDeploy)
      before(async function() {
        this.user = wallets[2].getChecksumAddressString()

        await this.stakeToken.mint(
          this.user,
          this.stakeAmount
        )
        await this.stakeToken.approve(this.stakeManager.address, this.stakeAmount, {
          from: this.user
        })

        this.totalStaked = this.stakeAmount
      })

      if (!skipBuy) {
        before('buy', async function() {
          await buyVoucher(this.validatorContract, this.stakeAmount, this.user)
        })
      }

      if (!skipSell) {
        before('sell', async function() {
          await sellVoucher(this.validatorContract, this.user)
        })
      }
    }

    describe('when Alice unstakes right after voucher sell', function() {
      prepareForTest()

      before('checkpoint', async function() {
        let currentEpoch = await this.stakeManager.currentEpoch()
        let exitEpoch = currentEpoch.add(await this.stakeManager.WITHDRAWAL_DELAY())

        for (let i = currentEpoch; i <= exitEpoch; i++) {
          await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)
        }
      })

      it('must unstake', async function() {
        this.receipt = await this.validatorContract.unstakeClaimTokens({
          from: this.user
        })
      })

      it('must emit DelegatorUnstaked', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'DelegatorUnstaked', {
          validatorId: this.validatorId,
          user: this.user,
          amount: this.stakeAmount
        })
      })

      shouldHaveCorrectStakes({
        userTotalStaked: '0',
        totalStaked: toWei('100')
      })
    })

    describe('when Alice claims too early', function() {
      prepareForTest()

      it('reverts', async function() {
        await expectRevert(this.validatorContract.unstakeClaimTokens({
          from: this.user
        }), 'Incomplete withdrawal period')
      })
    })

    describe('when Alice claims with 0 shares', function() {
      prepareForTest({ skipSell: true })

      it('reverts', async function() {
        await expectRevert(this.validatorContract.unstakeClaimTokens({
          from: this.user
        }), 'Incomplete withdrawal period')
      })
    })

    describe('when Alice didn\'t buy voucher', function() {
      prepareForTest({ skipSell: true, skipBuy: true })

      it('reverts', async function() {
        await expectRevert(this.validatorContract.unstakeClaimTokens({
          from: this.user
        }), 'Incomplete withdrawal period')
      })
    })

    describe('new API', function() {
      describe('when Alice claims 2 seperate unstakes (1 epoch between unstakes)', function() {
        prepareForTest({ skipSell: true })

        before('sell shares twice', async function() {
          this.claimAmount = this.stakeAmount.div(new BN('2'))

          await sellVoucherNew(this.validatorContract, this.user, this.claimAmount)
          await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)
          await sellVoucherNew(this.validatorContract, this.user, this.claimAmount)
        })

        before('checkpoint', async function() {
          let currentEpoch = await this.stakeManager.currentEpoch()
          let exitEpoch = currentEpoch.add(await this.stakeManager.WITHDRAWAL_DELAY())

          for (let i = currentEpoch; i <= exitEpoch; i++) {
            await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)
          }
        })

        it('must claim 1st unstake', async function() {
          this.receipt = await this.validatorContract.unstakeClaimTokens_new('1', {
            from: this.user
          })
        })

        it('must emit DelegatorUnstakeWithId', async function() {
          await expectEvent.inTransaction(this.receipt.tx, EventsHub, 'DelegatorUnstakeWithId', {
            validatorId: this.validatorId,
            user: this.user,
            amount: this.claimAmount,
            nonce: '1'
          })
        })

        it('must claim 2nd unstake', async function() {
          this.receipt = await this.validatorContract.unstakeClaimTokens_new('2', {
            from: this.user
          })
        })

        it('must emit DelegatorUnstakeWithId', async function() {
          await expectEvent.inTransaction(this.receipt.tx, EventsHub, 'DelegatorUnstakeWithId', {
            validatorId: this.validatorId,
            user: this.user,
            amount: this.claimAmount,
            nonce: '2'
          })
        })

        it('must have 0 shares', async function() {
          assertBigNumberEquality(await this.validatorContract.balanceOf(this.user), '0')
        })
      })
    })
  })

  describe('getLiquidRewards', function() {
    describe('when Alice and Bob buy vouchers (1 checkpoint in-between) and Alice withdraw the rewards', function() {
      deployAliceAndBob()
      before(async function() {
        await buyVoucher(this.validatorContract, toWei('100'), this.alice)
        await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)
        await buyVoucher(this.validatorContract, toWei('4600'), this.bob)
        await this.validatorContract.withdrawRewards({ from: this.alice })
      })

      it('Bob must call getLiquidRewards', async function() {
        await this.validatorContract.getLiquidRewards(this.bob)
      })
    })
  })

  describe('transfer', function() {
    describe('when Alice has no rewards', function() {
      deployAliceAndBob()

      let initialSharesBalance

      before('Alice purchases voucher', async function() {
        await buyVoucher(this.validatorContract, toWei('100'), this.alice)
        initialSharesBalance = await this.validatorContract.balanceOf(this.alice)
      })

      it('must Transfer shares', async function() {
        await this.validatorContract.transfer(this.bob, initialSharesBalance, { from: this.alice })
      })

      it('Alice must have 0 shares', async function() {
        assertBigNumberEquality(await this.validatorContract.balanceOf(this.alice), '0')
      })

      it('Bob must have Alice\'s shares', async function() {
        assertBigNumberEquality(await this.validatorContract.balanceOf(this.bob), initialSharesBalance)
      })
    })

    describe('when Alice and Bob has unclaimed rewards', function() {
      deployAliceAndBob()

      let initialAliceSharesBalance
      let initialBobSharesBalance

      let initialAliceMaticBalance
      let initialBobMaticBalance

      before('Alice and Bob purchases voucher, checkpoint is commited', async function() {
        await buyVoucher(this.validatorContract, ValidatorDefaultStake, this.alice)
        await buyVoucher(this.validatorContract, ValidatorDefaultStake, this.bob)

        initialAliceSharesBalance = await this.validatorContract.balanceOf(this.alice)
        initialBobSharesBalance = await this.validatorContract.balanceOf(this.bob)

        initialAliceMaticBalance = await this.stakeToken.balanceOf(this.alice)
        initialBobMaticBalance = await this.stakeToken.balanceOf(this.bob)

        await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)
      })

      it('must Transfer shares', async function() {
        this.receipt = await this.validatorContract.transfer(this.bob, initialAliceSharesBalance, { from: this.alice })
      })

      it('must emit DelegatorClaimedRewards for Alice', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'DelegatorClaimedRewards', {
          validatorId: this.validatorId,
          user: this.alice,
          rewards: toWei('3000')
        })
      })

      it('Alice must claim 3000 matic', async function() {
        assertBigNumberEquality(await this.stakeToken.balanceOf(this.alice), new BN(initialAliceMaticBalance).add(new BN(toWei('3000'))))
      })

      it('Alice must have 0 liquid rewards', async function() {
        assertBigNumberEquality(await this.validatorContract.getLiquidRewards(this.alice), '0')
      })

      it('Alice must have 0 shares', async function() {
        assertBigNumberEquality(await this.validatorContract.balanceOf(this.alice), '0')
      })

      it('Bob must have Alice\'s shares', async function() {
        assertBigNumberEquality(await this.validatorContract.balanceOf(this.bob), initialBobSharesBalance.add(initialAliceSharesBalance))
      })

      it('must emit DelegatorClaimedRewards for Bob', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'DelegatorClaimedRewards', {
          validatorId: this.validatorId,
          user: this.bob,
          rewards: toWei('3000')
        })
      })

      it('Bob must claim 3000 matic', async function() {
        assertBigNumberEquality(await this.stakeToken.balanceOf(this.bob), new BN(initialBobMaticBalance).add(new BN(toWei('3000'))))
      })

      it('Bob must have 0 liquid rewards', async function() {
        assertBigNumberEquality(await this.validatorContract.getLiquidRewards(this.bob), '0')
      })
    })

    describe('when transfer to 0x0 address', function() {
      deployAliceAndBob()

      let initialAliceSharesBalance

      before('Alice purchases voucher', async function() {
        initialAliceSharesBalance = await this.validatorContract.balanceOf(this.alice)

        await buyVoucher(this.validatorContract, ValidatorDefaultStake, this.alice)
      })

      it('reverts', async function() {
        await expectRevert.unspecified(this.validatorContract.transfer(ZeroAddr, initialAliceSharesBalance, { from: this.alice }))
      })
    })
  })
})
