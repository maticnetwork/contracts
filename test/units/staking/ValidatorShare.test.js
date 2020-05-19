import { BN, expectEvent, expectRevert } from '@openzeppelin/test-helpers'
import { TestToken, ValidatorShare, StakingInfo } from '../../helpers/artifacts'

import { checkPoint, assertBigNumberEquality } from '../../helpers/utils.js'
import { wallets, freshDeploy, approveAndStake } from './deployment'

contract('ValidatorShare', async function() {
  const ZeroAddr = '0x0000000000000000000000000000000000000000'

  async function doDeploy() {
    await freshDeploy.call(this)

    this.stakeToken = await TestToken.new('MATIC', 'MATIC')
    await this.stakeManager.setToken(this.stakeToken.address)
    await this.stakeToken.mint(this.stakeManager.address, web3.utils.toWei('10000000'))

    this.validatorId = '1'
    this.validatorUser = wallets[0]
    this.stakeAmount = new BN(web3.utils.toWei('100'))

    await this.stakeManager.updateDynastyValue(8)
    await this.stakeManager.updateValidatorThreshold(2)

    await approveAndStake.call(this, { wallet: this.validatorUser, stakeAmount: this.stakeAmount, acceptDelegation: true })

    let validator = await this.stakeManager.validators(this.validatorId)
    this.validatorContract = await ValidatorShare.at(validator.contractAddress)
  }

  describe.only('buyVoucher', function() {
    function deployAliceAndBob() {
      before(doDeploy)
      before(async function() {
        this.alice = wallets[2].getChecksumAddressString()
        this.bob = wallets[3].getChecksumAddressString()
        this.totalStaked = new BN(0)

        const mintAmount = new BN(web3.utils.toWei('70000'))

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

    function testBuyVoucher(voucherValue, voucherValueExpected, userTotalStaked, totalStaked, shares) {
      it('must buy voucher', async function() {
        this.receipt = await this.validatorContract.buyVoucher(voucherValue, {
          from: this.user
        })
      })

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
          newAmount: this.stakeAmount.add(new BN(totalStaked))
        })
      })

      it('must have correct total staked', async function() {
        assertBigNumberEquality(await this.validatorContract.amountStaked(this.user), userTotalStaked)
      })

      it('validator state must have correct amount', async function() {
        assertBigNumberEquality(await this.stakeManager.currentValidatorSetTotalStake(), this.stakeAmount.add(new BN(totalStaked)))
      })
    }

    describe('when Alice purchases voucher once', function() {
      deployAliceAndBob()

      before(function() {
        this.user = this.alice
      })

      testBuyVoucher(web3.utils.toWei('100'), web3.utils.toWei('100'), web3.utils.toWei('100'), web3.utils.toWei('100'), web3.utils.toWei('100'))
    })

    describe('when delegation is disabled', function() {
      deployAliceAndBob()

      before('disable delegation', async function() {
        await this.governance.update(
          this.stakeManager.address,
          this.stakeManager.contract.methods.setDelegationEnabled(false).encodeABI()
        )
      })

      it('reverts', async function() {
        await expectRevert(this.validatorContract.buyVoucher(web3.utils.toWei('150'), {
          from: this.alice
        }), 'Delegation is disabled')
      })
    })

    describe('when Alice purchases voucher 3 times in a row, no checkpoints inbetween', function() {
      deployAliceAndBob()

      before(function() {
        this.user = this.alice
      })

      describe('1st purchase', async function() {
        testBuyVoucher(web3.utils.toWei('100'), web3.utils.toWei('100'), web3.utils.toWei('100'), web3.utils.toWei('100'), web3.utils.toWei('100'))
      })

      describe('2nd purchase', async function() {
        testBuyVoucher(web3.utils.toWei('150'), web3.utils.toWei('150'), web3.utils.toWei('250'), web3.utils.toWei('250'), web3.utils.toWei('150'))
      })

      describe('3rd purchase', async function() {
        testBuyVoucher(web3.utils.toWei('250'), web3.utils.toWei('250'), web3.utils.toWei('500'), web3.utils.toWei('500'), web3.utils.toWei('250'))
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
        testBuyVoucher(web3.utils.toWei('100'), web3.utils.toWei('100'), web3.utils.toWei('100'), web3.utils.toWei('100'), web3.utils.toWei('100'))
      })

      describe('2nd purchase', async function() {
        advanceCheckpointAfter()
        testBuyVoucher(web3.utils.toWei('150'), '149999999999999999984', '249999999999999999984', '249999999999999999984', '3260869565217391304')
      })

      describe('3rd purchase', async function() {
        testBuyVoucher(web3.utils.toWei('250'), '249999999999999999909', '499999999999999999893', '499999999999999999893', '2309468822170900692')
      })
    })

    describe('when Alice and Bob purchase vouchers, no checkpoints inbetween', function() {
      deployAliceAndBob()

      describe('when Alice stakes 1st time', function() {
        before(function() {
          this.user = this.alice
        })

        testBuyVoucher(web3.utils.toWei('100'), web3.utils.toWei('100'), web3.utils.toWei('100'), web3.utils.toWei('100'), web3.utils.toWei('100'))
      })

      describe('when Bob stakes 1st time', function() {
        before(function() {
          this.user = this.bob
        })

        testBuyVoucher(web3.utils.toWei('100'), web3.utils.toWei('100'), web3.utils.toWei('100'), web3.utils.toWei('200'), web3.utils.toWei('100'))
      })

      describe('when Alice stakes 2nd time', function() {
        before(function() {
          this.user = this.alice
        })

        testBuyVoucher(web3.utils.toWei('200'), web3.utils.toWei('200'), web3.utils.toWei('300'), web3.utils.toWei('400'), web3.utils.toWei('200'))
      })

      describe('when Bob stakes 2nd time', function() {
        before(function() {
          this.user = this.bob
        })

        testBuyVoucher(web3.utils.toWei('200'), web3.utils.toWei('200'), web3.utils.toWei('300'), web3.utils.toWei('600'), web3.utils.toWei('200'))
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

        testBuyVoucher(web3.utils.toWei('100'), web3.utils.toWei('100'), web3.utils.toWei('100'), web3.utils.toWei('100'), web3.utils.toWei('100'))
      })

      describe('when Bob stakes 1st time', function() {
        advanceCheckpointAfter()
        before(function() {
          this.user = this.bob
        })

        testBuyVoucher(web3.utils.toWei('100'), '99999999999999999974', '99999999999999999974', '199999999999999999974', '2173913043478260869')
      })

      describe('when Alice stakes 2nd time', function() {
        advanceCheckpointAfter()
        before(function() {
          this.user = this.alice
        })

        testBuyVoucher(web3.utils.toWei('200'), '199999999999999999941', '299999999999999999941', '399999999999999999915', '1909854851031321619')
      })

      describe('when Bob stakes 2nd time', function() {
        before(function() {
          this.user = this.bob
        })

        testBuyVoucher(web3.utils.toWei('200'), '199999999999999999983', '299999999999999999957', '599999999999999999898', '1150152395192362988')
      })
    })

    describe('when Alice buys 1 voucher with higher amount of tokens than required', function() {
      deployAliceAndBob()

      before(async function() {
        await this.validatorContract.buyVoucher('1', {
          from: this.alice
        })
        await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)

        this.balanceBefore = await this.stakeToken.balanceOf(this.alice)
      })

      it('must be charged only for 1 share', async function() {
        let rate = await this.validatorContract.exchangeRate()
        // send 1.5% of rate per share, because exchangeRate() returns rate per 100 shares
        await this.validatorContract.buyVoucher(rate.add(rate.div(new BN(2))).div(new BN(100)), {
          from: this.alice
        })

        const balanceNow = await this.stakeToken.balanceOf(this.alice)
        const diff = this.balanceBefore.sub(balanceNow)
        // should pay for 1% of exchange rate = 1 share exactly
        assertBigNumberEquality(rate.div(new BN(100)), diff)
      })
    })
  })

  describe('exchangeRate', function() {
    describe('when Alice purchases voucher 2 times, 1 epoch between', function() {
      before(doDeploy)

      before(async function() {
        this.user = wallets[2].getAddressString()
        this.totalStaked = new BN(0)

        const voucherAmount = new BN(web3.utils.toWei('70000'))
        await this.stakeToken.mint(this.user, voucherAmount)
        await this.stakeToken.approve(this.stakeManager.address, voucherAmount, {
          from: this.user
        })
      })

      it('must buy voucher', async function() {
        const voucherValue = web3.utils.toWei('100')
        this.totalStaked = this.totalStaked.add(new BN(voucherValue))

        await this.validatorContract.buyVoucher(voucherValue, {
          from: this.user
        })
      })

      it('exchange rate must be correct', async function() {
        assertBigNumberEquality(await this.validatorContract.exchangeRate(), '100')
      })

      it('must buy another voucher 1 epoch later', async function() {
        await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)

        const voucherValue = web3.utils.toWei('5000')
        this.totalStaked = this.totalStaked.add(new BN(voucherValue))
        await this.validatorContract.buyVoucher(voucherValue, {
          from: this.user
        })
      })

      it('exchange rate must be correct', async function() {
        assertBigNumberEquality(await this.validatorContract.exchangeRate(), '4600')
      })
    })

    describe('when Alice purchases voucher and sells it', function() {
      before(doDeploy)
      before(async function() {
        this.user = wallets[2].getAddressString()
        await this.stakeToken.mint(
          this.user,
          web3.utils.toWei('250')
        )

        this.beforeExchangeRate = await this.validatorContract.exchangeRate()
        await this.stakeToken.approve(this.stakeManager.address, web3.utils.toWei('250'), {
          from: this.user
        })
      })

      it('must purchase voucher', async function() {
        await this.validatorContract.buyVoucher(web3.utils.toWei('100'), {
          from: this.user
        })
      })

      it('must sell voucher', async function() {
        await this.validatorContract.sellVoucher({
          from: this.user
        })
      })

      it('must have initial exchange rate', async function() {
        let afterExchangeRate = await this.validatorContract.exchangeRate()
        assertBigNumberEquality(afterExchangeRate, this.beforeExchangeRate)
      })
    })
  })

  describe('sellVoucher', function() {
    async function doDeployAndBuyVoucherForAlice() {
      await doDeploy.call(this)

      this.user = wallets[2].getAddressString()
      await this.stakeToken.mint(
        this.user,
        this.stakeAmount
      )
      await this.stakeToken.approve(this.stakeManager.address, web3.utils.toWei('100'), {
        from: this.user
      })

      await this.validatorContract.buyVoucher(web3.utils.toWei('100'), {
        from: this.user
      })

      this.shares = await this.validatorContract.balanceOf(this.user)

      for (let i = 0; i < 4; i++) {
        await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)
      }
    }

    function testSellVoucher() {
      it('must sell voucher', async function() {
        this.receipt = await this.validatorContract.sellVoucher({
          from: this.user
        })
      })

      it('must emit ShareBurned', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'ShareBurned', {
          tokens: this.shares
        })
      })
    }

    describe('when Alice sells voucher', function() {
      before(doDeployAndBuyVoucherForAlice)

      testSellVoucher()
    })

    describe('when delegation is disabled after voucher was purchased by Alice', function() {
      before(doDeployAndBuyVoucherForAlice)
      before('disable delegation', async function() {
        await this.governance.update(
          this.stakeManager.address,
          this.stakeManager.contract.methods.setDelegationEnabled(false).encodeABI()
        )
      })

      testSellVoucher()
    })
  })

  describe('withdrawRewards', function() {
    const rewards = new BN('97826086956521739130')

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

      await this.validatorContract.buyVoucher(this.stakeAmount, {
        from: this.user
      })

      await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)
    })

    it('must withdraw rewards', async function() {
      this.receipt = await this.validatorContract.withdrawRewards({
        from: this.user
      })
    })

    it('must emit Transfer (burn)', async function() {
      await expectEvent.inTransaction(this.receipt.tx, TestToken, 'Transfer', {
        from: this.user,
        to: ZeroAddr,
        value: rewards
      })
    })

    it('must emit Transfer', async function() {
      const proposerBonus = await this.stakeManager.proposerBonus()
      // 1st staker had stakeAmount and voucher also has stakeAmount - 50%/50% split of reward
      let expectedReward = (await this.stakeManager.CHECKPOINT_REWARD()).div(new BN(2))
      expectedReward = expectedReward.mul(new BN('100').sub(proposerBonus)).div(new BN('100'))

      await expectEvent.inTransaction(this.receipt.tx, TestToken, 'Transfer', {
        from: this.stakeManager.address,
        to: this.user,
        value: expectedReward
      })
    })

    it('must emit DelClaimRewards', async function() {
      const proposerBonus = await this.stakeManager.proposerBonus()
      // 1st staker had stakeAmount and voucher also has stakeAmount - 50%/50% split of reward
      let expectedReward = (await this.stakeManager.CHECKPOINT_REWARD()).div(new BN(2))
      expectedReward = expectedReward.mul(new BN('100').sub(proposerBonus)).div(new BN('100'))

      await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'DelClaimRewards', {
        validatorId: this.validatorId,
        user: this.user,
        rewards: expectedReward,
        tokens: rewards
      })
    })
  })

  describe('reStake', function() {
    describe('when Alice restakes', function() {
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

        await this.validatorContract.buyVoucher(this.stakeAmount, {
          from: this.user
        })

        await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)
        this.totalStaked = new BN(this.stakeAmount)
      })

      it('must have correct luquid rewards', async function() {
        this.totalStaked = this.totalStaked.add(new BN(web3.utils.toWei('4500')))

        let rewards = await this.validatorContract.getLiquidRewards(this.user)
        assertBigNumberEquality(rewards, web3.utils.toWei('4500'))
      })

      it('must restake', async function() {
        this.receipt = await this.validatorContract.reStake({
          from: this.user
        })
      })

      it('must emit DelReStaked', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'DelReStaked', {
          validatorId: this.validatorId,
          totalStaked: this.totalStaked
        })
      })
    })

    describe('when no liquid rewards', function() {
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

        await this.validatorContract.buyVoucher(this.stakeAmount, {
          from: this.user
        })
      })

      it('reverts', async function() {
        await expectRevert(this.validatorContract.reStake({ from: this.user }), 'Too small rewards to restake')
      })
    })
  })

  describe('unStakeClaimTokens', function() {
    describe('when Alice unstakes right after voucher sell', function() {
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

        await this.validatorContract.buyVoucher(this.stakeAmount, {
          from: this.user
        })

        this.totalStaked = this.stakeAmount

        await this.validatorContract.sellVoucher({
          from: this.user
        })

        let currentEpoch = await this.stakeManager.currentEpoch()
        let exitEpoch = currentEpoch.add(await this.stakeManager.WITHDRAWAL_DELAY())

        for (let i = currentEpoch; i <= exitEpoch; i++) {
          await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)
        }
      })

      it('must unstake', async function() {
        this.receipt = await this.validatorContract.unStakeClaimTokens({
          from: this.user
        })
      })

      it('must emit DelUnstaked', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'DelUnstaked', {
          validatorId: this.validatorId,
          user: this.user,
          amount: this.stakeAmount
        })
      })
    })
  })

  describe('updateCommissionRate', function() {
    async function batchDeploy() {
      await doDeploy.call(this)

      this.user = wallets[2].getChecksumAddressString()

      const approveAmount = web3.utils.toWei('20000')
      this.stakeManager.updateDynastyValue(4)
      await this.stakeToken.mint(
        this.user,
        approveAmount
      )
      await this.stakeToken.approve(this.stakeManager.address, approveAmount, {
        from: this.user
      })
    }

    function testCommisionRate(previousRate, newRate) {
      describe(`when validator sets commision rate to ${newRate}%`, function() {
        it(`validator must set ${newRate}% commision rate`, async function() {
          // simulate cool down period
          let lastCommissionUpdate = await this.validatorContract.lastCommissionUpdate()
          if (+lastCommissionUpdate !== 0) {
            let n = lastCommissionUpdate.add(await this.stakeManager.WITHDRAWAL_DELAY())
            const start = await this.stakeManager.epoch()
            for (let i = start; i < n; i++) {
              await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)
            }
          }
          this.receipt = await this.validatorContract.updateCommissionRate(newRate, { from: this.validatorUser.getAddressString() })
        })

        it('must emit UpdateCommissionRate', async function() {
          await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'UpdateCommissionRate', {
            validatorId: this.validatorId,
            oldCommissionRate: previousRate,
            newCommissionRate: newRate
          })
        })

        it('commissionRate must be correct', async function() {
          assertBigNumberEquality(await this.validatorContract.commissionRate(), newRate)
        })

        it('lastCommissionUpdate must be equal to current epoch', async function() {
          assertBigNumberEquality(await this.validatorContract.lastCommissionUpdate(), await this.stakeManager.epoch())
        })
      })
    }

    describe('when Alice buy voucher and validator sets 50% commision rate, 1 checkpoint commited', function() {
      before(batchDeploy)

      testCommisionRate('0', '50')

      describe('after commision rate changed', function() {
        it('Alice must purchase voucher', async function() {
          await this.validatorContract.buyVoucher(web3.utils.toWei('100'), {
            from: this.user
          })
        })

        it('1 checkpoint must be commited', async function() {
          await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)
        })

        it('liquid rewards must be correct', async function() {
          assertBigNumberEquality(await this.validatorContract.getLiquidRewards(this.user), web3.utils.toWei('2250'))
        })
      })
    })

    describe('when Alice stake same as validator, and validator sets 50%, 100%, 0% commision rates, 1 checkpoint between rate\'s change', function() {
      let oldRewards, oldExchangeRate

      function testAfterComissionChange(liquidRewards, exchangeRate) {
        it('1 checkpoint must be commited', async function() {
          await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)

          oldRewards = await this.validatorContract.rewards()
          oldExchangeRate = await this.validatorContract.exchangeRate()
        })

        it('liquid rewards must be correct', async function() {
          assertBigNumberEquality(await this.validatorContract.getLiquidRewards(this.user), liquidRewards)
        })

        it('exchange rate must be correct', async function() {
          assertBigNumberEquality(await this.validatorContract.exchangeRate(), exchangeRate)
        })

        it('ValidatorShare rewards must be unchanged', async function() {
          assertBigNumberEquality(oldRewards, await this.validatorContract.rewards())
        })

        it('ValidatorShare exchangeRate must be unchanged', async function() {
          assertBigNumberEquality(oldExchangeRate, await this.validatorContract.exchangeRate())
        })
      }

      before(batchDeploy)
      before(function() {
        this.oldRewards = new BN('0')
        this.oldExchangeRate = new BN('0')
      })

      testCommisionRate('0', '50')

      describe('after commision rate changed', function() {
        it('Alice must purchase voucher', async function() {
          await this.validatorContract.buyVoucher(this.stakeAmount, {
            from: this.user
          })
        })
        // get 25% of checkpoint rewards
        testAfterComissionChange(web3.utils.toWei('2250'), '2350')
      })

      testCommisionRate('50', '100')

      describe('after commision rate changed', function() {
        // get 0% of checkpoint rewards
        testAfterComissionChange(web3.utils.toWei('9000'), '9100')
      })

      testCommisionRate('100', '0')

      describe('after commision rate changed', function() {
        // get only 50% of checkpoint rewards
        testAfterComissionChange(web3.utils.toWei('13500'), '13600')
      })
    })

    describe('when new commision rate is greater than 100', function() {
      before(batchDeploy)

      it('reverts', async function() {
        await expectRevert(
          this.validatorContract.updateCommissionRate(101, { from: this.validatorUser.getAddressString() }),
          'Commission rate should be in range of 0-100'
        )
      })
    })

    describe('when trying to set commision again within commissionCooldown period', function() {
      before(batchDeploy)
      before(async function() {
        this.validatorContract.updateCommissionRate(10, { from: this.validatorUser.getAddressString() })
      })

      it('reverts', async function() {
        await expectRevert(
          this.validatorContract.updateCommissionRate(15, { from: this.validatorUser.getAddressString() }),
          'Commission rate update cooldown period'
        )
      })
    })
  })
})
