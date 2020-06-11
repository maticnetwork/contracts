import { TestToken, ValidatorShare, StakingInfo } from '../../helpers/artifacts'
import { BN, expectEvent, expectRevert } from '@openzeppelin/test-helpers'
import { checkPoint, assertBigNumberEquality, updateSlashedAmounts } from '../../helpers/utils.js'
import { wallets, freshDeploy, approveAndStake } from './deployment'
import { buyVoucher, sellVoucher } from './ValidatorShareHelper.js'

const toBN = web3.utils.toBN
const toWei = web3.utils.toWei

contract('ValidatorShare', async function() {
  const ZeroAddr = '0x0000000000000000000000000000000000000000'
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
        this.value = web3.utils.toWei('10')
        await this.testToken.mint(this.validatorContract.address, this.value)

        this.user = wallets[2].getChecksumAddressString()
        this.userOldBalance = await this.testToken.balanceOf(this.user)
      })
    }

    describe('when Alice drain erc20 token', function() {
      prepareForTests()

      it('must drain tokens', async function() {
        await this.governance.update(
          this.stakeManager.address,
          this.stakeManager.contract.methods.drainValidatorShares(this.validatorId, this.testToken.address, this.user, this.value).encodeABI()
        )
      })

      it('Alice must have correct balance', async function() {
        assertBigNumberEquality(this.userOldBalance.add(new BN(this.value)), await this.testToken.balanceOf(this.user))
      })
    })

    describe('when from is not governanace', function() {
      prepareForTests()

      it('reverts', async function() {
        await expectRevert(
          this.stakeManager.drainValidatorShares(this.validatorId, this.testToken.address, this.user, this.value),
          'Only governance contract is authorized'
        )
      })
    })

    describe('when validator id is incorrect', function() {
      prepareForTests()

      it('reverts', async function() {
        await expectRevert(this.governance.update(
          this.stakeManager.address,
          this.stakeManager.contract.methods.drainValidatorShares('9999', this.testToken.address, this.user, this.value).encodeABI()
        ), 'Update failed')
      })
    })
  })

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

  describe('buyVoucher', function() {
    function testBuyVoucher(voucherValue, voucherValueExpected, userTotalStaked, totalStaked, shares) {
      it('must buy voucher', async function() {
        this.receipt = await buyVoucher(this.validatorContract, voucherValue, this.user, shares)
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

      it('must have correct initialRewardPerShare', async function() {
        const currentRewardPerShare = await this.validatorContract.getRewardPerShare()
        const userRewardPerShare = await this.validatorContract.initalRewardPerShare(this.user)
        assertBigNumberEquality(currentRewardPerShare, userRewardPerShare)
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

    describe('when Alice purchases voucher with exact minSharesToMint', function() {
      deployAliceAndBob()

      before(function() {
        this.user = this.alice
      })
      testBuyVoucher(wei100, wei100, wei100, wei100, wei100)
    })

    describe('when validator turns off delegation', function() {
      deployAliceAndBob()

      before('disable delegation', async function() {
        await this.stakeManager.updateValidatorDelegation(false, { from: this.validatorUser.getChecksumAddressString() })
      })

      it('reverts', async function() {
        await expectRevert(buyVoucher(this.validatorContract, web3.utils.toWei('150'), this.alice), 'Delegation is disabled')
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
        await expectRevert(buyVoucher(this.validatorContract, web3.utils.toWei('150'), this.alice), 'no delegation')
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
        testBuyVoucher(web3.utils.toWei('150'), web3.utils.toWei('150'), web3.utils.toWei('250'), web3.utils.toWei('250'), web3.utils.toWei('150'))
      })

      describe('3rd purchase', async function() {
        testBuyVoucher(web3.utils.toWei('250'), web3.utils.toWei('250'), web3.utils.toWei('500'), web3.utils.toWei('500'), web3.utils.toWei('250'))
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

        testBuyVoucher(web3.utils.toWei('100'), web3.utils.toWei('100'), web3.utils.toWei('100'), web3.utils.toWei('200'), web3.utils.toWei('100'))
      })

      describe('when Alice stakes 2nd time', function() {
        advanceCheckpointAfter()
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

    describe('when Alice buys 1 voucher with higher amount of tokens than required', function() {
      deployAliceAndBob()

      before(async function() {
        await buyVoucher(this.validatorContract, '1', this.alice)
        await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)

        this.balanceBefore = await this.stakeToken.balanceOf(this.alice)
      })

      it('must be charged only for 1 share', async function() {
        let rate = await this.validatorContract.exchangeRate()
        // send 1.5% of rate per share, because exchangeRate() returns rate per 100 shares
        await buyVoucher(this.validatorContract, rate.add(rate.div(new BN(2))).div(new BN(100)), this.alice)

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

        await buyVoucher(this.validatorContract, voucherValue, this.user)
      })

      it('exchange rate must be correct', async function() {
        assertBigNumberEquality(await this.validatorContract.exchangeRate(), '100')
      })

      it('must buy another voucher 1 epoch later', async function() {
        await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)

        const voucherValue = web3.utils.toWei('5000')
        this.totalStaked = this.totalStaked.add(new BN(voucherValue))
        await buyVoucher(this.validatorContract, voucherValue, this.user)
      })

      it('exchange rate must be correct', async function() {
        assertBigNumberEquality(await this.validatorContract.exchangeRate(), '100')
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
        await buyVoucher(this.validatorContract, web3.utils.toWei('100'), this.user)
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
          assertBigNumberEquality('50', rate)
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
          assertBigNumberEquality('50', rate)
        })

        it('Bob shares == 200 eth', async function() {
          const shares = await this.validatorContract.balanceOf(this.user)
          assertBigNumberEquality(this.stakeAmount.mul(new BN(2)), shares)
        })
      })
    })
  })

  describe('sellVoucher', function() {
    const aliceStake = new BN(web3.utils.toWei('100'))

    async function doDeployAndBuyVoucherForAlice() {
      await doDeploy.call(this)

      this.user = wallets[2].getAddressString()
      await this.stakeToken.mint(
        this.user,
        aliceStake
      )

      await this.stakeToken.approve(this.stakeManager.address, aliceStake, {
        from: this.user
      })

      await buyVoucher(this.validatorContract, aliceStake, this.user)

      this.userOldBalance = await this.stakeToken.balanceOf(this.user)
      this.shares = await this.validatorContract.balanceOf(this.user)

      for (let i = 0; i < 4; i++) {
        await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)
      }
    }

    function testSellVoucher(returnedStake, minClaimAmount) {
      it('must sell voucher', async function() {
        this.receipt = await sellVoucher(this.validatorContract, this.user, minClaimAmount)
      })

      it('must emit ShareBurned', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'ShareBurned', {
          tokens: this.shares,
          amount: returnedStake
        })
      })
    }

    describe('when Alice sells voucher', function() {
      before(doDeployAndBuyVoucherForAlice)

      testSellVoucher(aliceStake)
    })

    describe('when Alice sells voucher after 50% slash', function() {
      before(doDeployAndBuyVoucherForAlice)
      before('slash', async function() {
        await slash.call(this, [{ validator: this.validatorId, amount: this.stakeAmount }], [this.validatorUser], this.validatorUser)
      })

      testSellVoucher(aliceStake.div(new BN(2)))
    })

    describe('when Alice sells voucher with minClaimAmount', function() {
      before(doDeployAndBuyVoucherForAlice)

      testSellVoucher(aliceStake, aliceStake)
    })

    describe('when delegation is disabled after voucher was purchased by Alice', function() {
      before(doDeployAndBuyVoucherForAlice)
      before('disable delegation', async function() {
        await this.governance.update(
          this.stakeManager.address,
          this.stakeManager.contract.methods.setDelegationEnabled(false).encodeABI()
        )
      })

      testSellVoucher(aliceStake)
    })

    describe('when Alice sells with minClaimAmount greater than expected', function() {
      before(doDeployAndBuyVoucherForAlice)

      it('reverts', async function() {
        await expectRevert(this.validatorContract.sellVoucher(web3.utils.toWei('100.00001'), { from: this.user }), 'Too much slippage')
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
    let delegators = []

    function testWithdraw({ label, user, expectedReward }) {
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

          it('must emit Transfer', async function() {
            await expectEvent.inTransaction(this.receipt.tx, TestToken, 'Transfer', {
              from: this.stakeManager.address,
              to: user,
              value: expectedReward
            })
          })

          it('must emit DelegatorClaimedRewards', async function() {
            await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'DelegatorClaimedRewards', {
              validatorId: this.validatorId,
              user: user,
              rewards: expectedReward
            })
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

    function testStake({ user, amount, label }) {
      describe(`${label} buyVoucher for ${amount.toString()} wei`, function() {
        it(`must purchase voucher`, async function() {
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
        const validator = await this.stakeManager.validators(this.validatorId)
        return validator.reward
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
          const totalStake = await this.validatorContract.totalStake()
          const validatorRewards = await getValidatorReward.call(this)
          const totalReceived = validatorRewards.add(totalDelegatorRewardsReceived)

          await this.stakeManager.withdrawRewards(this.validatorId, { from: this.validatorUser.getChecksumAddressString() })

          const tokensLeft = await this.stakeToken.balanceOf(this.stakeManager.address)
          assertBigNumberEquality(this.initialStakeTokenBalance.sub(totalReceived).add(totalStake).sub(totalSlashed), tokensLeft)
        })
      })
    }

    function runWithdrawRewardsTest(timeline) {
      before(doDeploy)
      before(async function() {
        delegators = {}
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
        { allRewards: { validatorReward: web3.utils.toWei('9000'), totalExpectedRewards: web3.utils.toWei('9000') } }
      ])
    })

    describe('when Alice is not slashed. 1 checkpoint passed', function() {
      runWithdrawRewardsTest([
        { stake: { user: Alice, label: 'Alice', amount: new BN(wei100) } },
        { checkpoints: 1 },
        { withdraw: { user: Alice, label: 'Alice', expectedReward: web3.utils.toWei('4500') } },
        { allRewards: { validatorReward: web3.utils.toWei('4500'), totalExpectedRewards: web3.utils.toWei('9000') } }
      ])
    })

    describe('when Alice is slashed by 50% and Bob purchases voucher after', function() {
      describe('when 1 checkpoint passes', function() {
        describe('when Alice and Bob withdraw rewards after', function() {
          runWithdrawRewardsTest([
            { stake: { user: Alice, label: 'Alice', amount: new BN(wei100) } },
            { slash: { amount: new BN(web3.utils.toWei('100')) } },
            { stake: { user: Bob, label: 'Bob', amount: new BN(wei100) } },
            { checkpoints: 1 },
            { withdraw: { label: 'Alice', user: Alice, expectedReward: web3.utils.toWei('2250') } },
            { withdraw: { label: 'Bob', user: Bob, expectedReward: web3.utils.toWei('4500') } },
            { allRewards: { validatorReward: web3.utils.toWei('2250'), totalExpectedRewards: web3.utils.toWei('9000') } }
          ])
        })
      })

      describe('when 2 checkpoints pass', function() {
        describe('when Alice and Bob withdraw rewards after', function() {
          runWithdrawRewardsTest([
            { stake: { user: Alice, label: 'Alice', amount: new BN(wei100) } },
            { slash: { amount: new BN(web3.utils.toWei('100')) } },
            { stake: { user: Bob, label: 'Bob', amount: new BN(wei100) } },
            { checkpoints: 2 },
            { liquidRewards: { user: Alice, label: 'Alice', expectedReward: web3.utils.toWei('4500') } },
            { liquidRewards: { user: Bob, label: 'Bob', expectedReward: web3.utils.toWei('9000') } },
            { withdraw: { label: 'Alice', user: Alice, expectedReward: web3.utils.toWei('4500') } },
            { withdraw: { label: 'Bob', user: Bob, expectedReward: web3.utils.toWei('9000') } },
            { allRewards: { validatorReward: web3.utils.toWei('4500'), totalExpectedRewards: web3.utils.toWei('18000') } }
          ])
        })
      })
    })

    describe('when Alice is slashed after checkpoint', function() {
      runWithdrawRewardsTest([
        { stake: { user: Alice, label: 'Alice', amount: new BN(wei100) } },
        { checkpoints: 1 },
        { slash: { amount: new BN(web3.utils.toWei('100')) } },
        { liquidRewards: { user: Alice, label: 'Alice', expectedReward: web3.utils.toWei('4500') } },
        { withdraw: { label: 'Alice', user: Alice, expectedReward: web3.utils.toWei('4500') } },
        { allRewards: { validatorReward: web3.utils.toWei('4500'), totalExpectedRewards: web3.utils.toWei('9000') } }
      ])
    })

    describe('Alice, Bob, Eve and Carol stake #1', function() {
      runWithdrawRewardsTest([
        { stake: { user: Alice, label: 'Alice', amount: new BN(web3.utils.toWei('100')) } },
        { checkpoints: 1 },
        { liquidRewards: { user: Alice, label: 'Alice', expectedReward: web3.utils.toWei('4500') } },
        { stake: { user: Bob, label: 'Bob', amount: new BN(web3.utils.toWei('500')) } },
        { slash: { amount: new BN(web3.utils.toWei('350')) } },
        { checkpoints: 1 },
        { liquidRewards: { user: Alice, label: 'Alice', expectedReward: '5785714285714285714285' } },
        { liquidRewards: { user: Bob, label: 'Bob', expectedReward: '6428571428571428571428' } },
        { stake: { user: Carol, label: 'Carol', amount: new BN(web3.utils.toWei('500')) } },
        { checkpoints: 1 },
        { liquidRewards: { user: Alice, label: 'Alice', expectedReward: '6315126050420168067226' } },
        { liquidRewards: { user: Bob, label: 'Bob', expectedReward: '9075630252100840336133' } },
        { liquidRewards: { user: Carol, label: 'Carol', expectedReward: '5294117647058823529411' } },
        { slash: { amount: new BN(web3.utils.toWei('167')), nonce: 2 } },
        { stake: { user: Eve, label: 'Eve', amount: new BN(web3.utils.toWei('500')) } },
        { checkpoints: 1 },
        { withdraw: { user: Alice, label: 'Alice', expectedReward: '6620190835599266177975' } },
        { withdraw: { user: Bob, label: 'Bob', expectedReward: '10600954177996330889877' } },
        { withdraw: { user: Carol, label: 'Carol', expectedReward: '8344765498849804636897' } },
        { withdraw: { user: Eve, label: 'Eve', expectedReward: '3813309814738726384358' } },
        { allRewards: { validatorReward: '6620779672815871910888', totalExpectedRewards: '35999999999999999999995' } }
      ])
    })

    describe('Alice, Bob, Eve and Carol stake #2', function() {
      runWithdrawRewardsTest([
        { stake: { user: Alice, label: 'Alice', amount: new BN(web3.utils.toWei('100')) } },
        { checkpoints: 1 },
        { liquidRewards: { user: Alice, label: 'Alice', expectedReward: web3.utils.toWei('4500') } },
        { stake: { user: Bob, label: 'Bob', amount: new BN(web3.utils.toWei('500')) } },
        { slash: { amount: new BN(web3.utils.toWei('350')) } },
        { checkpoints: 1 },
        { liquidRewards: { user: Alice, label: 'Alice', expectedReward: '5785714285714285714285' } },
        { liquidRewards: { user: Bob, label: 'Bob', expectedReward: '6428571428571428571428' } },
        { stake: { user: Carol, label: 'Carol', amount: new BN(web3.utils.toWei('500')) } },
        { slash: { amount: new BN(web3.utils.toWei('425')), nonce: 2 } },
        { checkpoints: 1 },
        { liquidRewards: { user: Alice, label: 'Alice', expectedReward: '6315126050420168067226' } },
        { liquidRewards: { user: Bob, label: 'Bob', expectedReward: '9075630252100840336133' } },
        { liquidRewards: { user: Carol, label: 'Carol', expectedReward: '5294117647058823529411' } },
        { slash: { amount: new BN(web3.utils.toWei('215')), nonce: 3 } },
        { stake: { user: Eve, label: 'Eve', amount: new BN(web3.utils.toWei('500')) } },
        { checkpoints: 1 },
        { withdraw: { user: Alice, label: 'Alice', expectedReward: '6468480040391960740984' } },
        { withdraw: { user: Bob, label: 'Bob', expectedReward: '9842400201959803704922' } },
        { withdraw: { user: Carol, label: 'Carol', expectedReward: '6827657546776750266987' } },
        { withdraw: { user: Eve, label: 'Eve', expectedReward: '6389749582158028073235' } },
        { allRewards: { validatorReward: '6471712628713457213867', totalExpectedRewards: '35999999999999999999995' } }
      ])
    })

    describe('when not enough rewards', function() {
      before(doDeploy)

      it('reverts', async function() {
        await expectRevert(this.validatorContract.withdrawRewards({ from: Alice }), 'Too small rewards amount')
      })
    })
  })

  describe('restake', function() {
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

        await buyVoucher(this.validatorContract, this.stakeAmount, this.user)
        await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)
        this.totalStaked = new BN(this.stakeAmount)
      })

      it('must have initalRewardPerShare == 0', async function() {
        const userRewardPerShare = await this.validatorContract.initalRewardPerShare(this.user)
        assertBigNumberEquality('0', userRewardPerShare)
      })

      it('must have correct liquid rewards', async function() {
        this.totalStaked = this.totalStaked.add(new BN(web3.utils.toWei('4500')))

        let rewards = await this.validatorContract.getLiquidRewards(this.user)
        assertBigNumberEquality(rewards, web3.utils.toWei('4500'))
      })

      it('must restake', async function() {
        this.receipt = await this.validatorContract.restake({
          from: this.user
        })
      })

      it('must have correct initalRewardPerShare', async function() {
        const currrentRewardPerShare = await this.validatorContract.getRewardPerShare()
        const userRewardPerShare = await this.validatorContract.initalRewardPerShare(this.user)
        assertBigNumberEquality(currrentRewardPerShare, userRewardPerShare)
      })

      it('must have liquid rewards == 0', async function() {
        let rewards = await this.validatorContract.getLiquidRewards(this.user)
        assertBigNumberEquality('0', rewards)
      })

      it('must emit DelegatorRestaked', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'DelegatorRestaked', {
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

        await buyVoucher(this.validatorContract, this.stakeAmount, this.user)
      })

      it('reverts', async function() {
        await expectRevert(this.validatorContract.restake({ from: this.user }), 'Too small rewards to restake')
      })
    })
  })

  describe('unstakeClaimTokens', function() {
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

        this.totalStaked = this.stakeAmount
      })

      before('buy', async function() {
        await buyVoucher(this.validatorContract, this.stakeAmount, this.user)
      })

      before('sell', async function() {
        await sellVoucher(this.validatorContract, this.user)
      })

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
    })
  })

  describe('getLiquidRewards', function() {
    describe('when Alice and Bob buy vouchers (1 checkpoint in-between) and Alice withdraw the rewards', function() {
      deployAliceAndBob()
      before(async function() {
        await buyVoucher(this.validatorContract, web3.utils.toWei('100'), this.alice)
        await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)
        await buyVoucher(this.validatorContract, web3.utils.toWei('4600'), this.bob)
        await this.validatorContract.withdrawRewards({ from: this.alice })
      })

      it('Bob must call getLiquidRewards', async function() {
        await this.validatorContract.getLiquidRewards(this.bob)
      })
    })
  })

  describe('Share transfer', function() {
    deployAliceAndBob()
    before(async function() {
      await buyVoucher(this.validatorContract, web3.utils.toWei('100'), this.alice)
    })

    it('Transfer of shares must revert', async function() {
      await this.validatorContract.Transfer(this.bob)
      const balance = await this.validatorContract.balanceOf(this.bob)
      await expectRevert(this.validatorContract.transfer(this.alice, balance), 'Disabled')
    })
  })
})
