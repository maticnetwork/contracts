import utils from 'ethereumjs-util'

import {
  ValidatorShare,
  StakingInfo,
  TestToken
} from '../../../helpers/artifacts'

import { buildTreeFee } from '../../../helpers/proofs.js'

import {
  checkPoint,
  assertBigNumberEquality,
  buildsubmitCheckpointPaylod,
  buildsubmitCheckpointPaylodWithVotes,
  encodeSigsForCheckpoint,
  getSigs
} from '../../../helpers/utils.js'
import { expectEvent, expectRevert, BN } from '@openzeppelin/test-helpers'
import { generateFirstWallets, mnemonics } from '../../../helpers/wallets'
import { wallets, freshDeploy, approveAndStake, walletAmounts } from '../deployment'
import { buyVoucher } from '../ValidatorShareHelper.js'
import { web3 } from '@openzeppelin/test-helpers/src/setup'

const { toWei } = web3.utils

function prepareForTest(dynastyValue, validatorThreshold) {
  return async function() {
    await freshDeploy.call(this)

    await this.stakeManager.updateValidatorThreshold(validatorThreshold)
    await this.stakeManager.updateDynastyValue(dynastyValue)
  }
}

function testCheckpointing(stakers, signers, blockInterval, checkpointsPassed, expectedRewards, order = true, proposer = null) {
  it(`must checkpoint ${checkpointsPassed} time(s) with block interval ${blockInterval}`, async function() {
    let _count = checkpointsPassed
    while (_count-- > 0) {
      await checkPoint(signers, proposer || this.rootChainOwner, this.stakeManager, { blockInterval, order, rootchainOwner: this.rootChainOwner })
    }
  })

  if (expectedRewards) {
    let index = 0
    for (const staker of stakers) {
      let stakerIndex = index + 1
      index++
      it(`staker #${stakerIndex} must have ${expectedRewards[staker.wallet.getAddressString()]} reward`, async function() {
        const validatorId = await this.stakeManager.getValidatorId(staker.wallet.getAddressString())
        const reward = await this.stakeManager.validatorReward(validatorId)
        assertBigNumberEquality(reward, expectedRewards[staker.wallet.getAddressString()])
      })
    }
  }
}

const ZeroAddr = '0x0000000000000000000000000000000000000000'

contract('StakeManager', async function(accounts) {
  let owner = accounts[0]

  async function calculateExpectedCheckpointReward(blockInterval, amount, totalAmount, checkpointsPassed) {
    const checkpointBlockInterval = await this.stakeManager.checkPointBlockInterval()
    let checkpointReward = await this.stakeManager.CHECKPOINT_REWARD()
    let proposerBonus = await this.stakeManager.proposerBonus()

    let expectedCheckpointReward = new BN(blockInterval).mul(checkpointReward).div(checkpointBlockInterval)
    if (expectedCheckpointReward.gt(checkpointReward)) {
      expectedCheckpointReward = checkpointReward
    }

    let proposerReward = expectedCheckpointReward.mul(new BN(proposerBonus)).div(new BN('100'))
    expectedCheckpointReward = expectedCheckpointReward.sub(proposerReward)

    let expectedBalance = amount.mul(expectedCheckpointReward).div(totalAmount)
    return expectedBalance.mul(new BN(checkpointsPassed))
  }

  function testStartAuction(user, signerPubkey, bidAmount) {
    it('should bid', async function() {
      this.receipt = await this.stakeManager.startAuction(this.validatorId, bidAmount, false, signerPubkey, {
        from: user
      })
    })

    it('must emit StartAuction', async function() {
      await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'StartAuction', {
        validatorId: this.validatorId,
        amount: this.initialStakeAmount,
        auctionAmount: bidAmount
      })
    })

    it('validator auction must have correct balance equal to bid amount', async function() {
      let auctionData = await this.stakeManager.validatorAuction(this.validatorId)
      assertBigNumberEquality(auctionData.amount, bidAmount)
    })

    it('validator auction must have correct user', async function() {
      let auctionData = await this.stakeManager.validatorAuction(this.validatorId)
      assert(auctionData.user === user)
    })

    it('balance must decrease by bid amount', async function() {
      assertBigNumberEquality(
        await this.stakeToken.balanceOf(user),
        this.userOldBalance.sub(new BN(bidAmount))
      )
    })
  }

  function testConfirmAuctionBidForNewValidator() {
    it('must confirm auction with heimdall fee', async function() {
      this.receipt = await this.stakeManager.confirmAuctionBid(
        this.validatorId,
        this.heimdallFee,
        {
          from: this.bidder
        }
      )
    })

    it('must emit Staked', async function() {
      await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'Staked', {
        signer: this.bidder,
        signerPubkey: this.bidderPubKey,
        activationEpoch: await this.stakeManager.currentEpoch(),
        validatorId: this.newValidatorId,
        amount: this.bidAmount,
        total: this.totalStakedBeforeAuction.add(new BN(this.bidAmount))
      })
    })

    it('must emit UnstakeInit', async function() {
      await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'UnstakeInit', {
        user: this.prevValidatorAddr,
        validatorId: this.validatorId,
        deactivationEpoch: await this.stakeManager.currentEpoch(),
        amount: this.validator.amount
      })
    })

    it('must emit ConfirmAuction', async function() {
      await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'ConfirmAuction', {
        newValidatorId: this.newValidatorId,
        oldValidatorId: this.validatorId,
        amount: this.bidAmount
      })
    })

    it('must emit TopUpFee', async function() {
      await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'TopUpFee', {
        user: this.bidder,
        fee: this.heimdallFee
      })
    })

    it('previous validator must get his reward', async function() {
      let prevValidatorBalance = await this.stakeToken.balanceOf(this.prevValidatorAddr)
      assertBigNumberEquality(prevValidatorBalance, this.prevValidatorOldBalance.add(this.reward))
    })

    it('previous validator is not validator anymore', async function() {
      assert.ok(!(await this.stakeManager.isValidator(this.validatorId)))
    })

    it('new validator is validator', async function() {
      assert.ok(await this.stakeManager.isValidator(this.newValidatorId))
    })

    it('bidder balance must be correct', async function() {
      const currentBalance = await this.stakeToken.balanceOf(this.bidder)
      assertBigNumberEquality(this.bidderBalanceBeforeAuction.sub(new BN(this.bidAmount)).sub(new BN(this.heimdallFee)), currentBalance)
    })
  }

  describe('updateCommissionRate', function() {
    async function batchDeploy() {
      await prepareForTest(4, 2).call(this)

      this.stakeToken = await TestToken.new('MATIC', 'MATIC')

      await this.governance.update(
        this.stakeManager.address,
        this.stakeManager.contract.methods.setStakingToken(this.stakeToken.address).encodeABI()
      )

      await this.stakeToken.mint(this.stakeManager.address, web3.utils.toWei('10000000'))

      this.validatorId = '1'
      this.validatorUser = wallets[0]
      this.stakeAmount = new BN(web3.utils.toWei('100'))

      await approveAndStake.call(this, { wallet: this.validatorUser, stakeAmount: this.stakeAmount, acceptDelegation: true })

      let validator = await this.stakeManager.validators(this.validatorId)
      this.validatorContract = await ValidatorShare.at(validator.contractAddress)

      this.user = wallets[2].getChecksumAddressString()

      const approveAmount = web3.utils.toWei('20000')
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
          const validator = await this.stakeManager.validators(this.validatorId)
          let lastCommissionUpdate = validator.lastCommissionUpdate
          if (+lastCommissionUpdate !== 0) {
            let n = lastCommissionUpdate.add(await this.stakeManager.WITHDRAWAL_DELAY())
            const start = await this.stakeManager.epoch()
            for (let i = start; i < n; i++) {
              await checkPoint([this.validatorUser], this.rootChainOwner, this.stakeManager)
            }
          }
          this.receipt = await this.stakeManager.updateCommissionRate(this.validatorId, newRate, { from: this.validatorUser.getAddressString() })
        })

        it('must emit UpdateCommissionRate', async function() {
          await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'UpdateCommissionRate', {
            validatorId: this.validatorId,
            oldCommissionRate: previousRate,
            newCommissionRate: newRate
          })
        })

        it('commissionRate must be correct', async function() {
          const validator = await this.stakeManager.validators(this.validatorId)
          assertBigNumberEquality(validator.commissionRate, newRate)
        })

        it('lastCommissionUpdate must be equal to current epoch', async function() {
          const validator = await this.stakeManager.validators(this.validatorId)
          assertBigNumberEquality(validator.lastCommissionUpdate, await this.stakeManager.epoch())
        })
      })
    }

    describe('when Alice buy voucher and validator sets 50% commision rate, 1 checkpoint commited', function() {
      before(batchDeploy)

      testCommisionRate('0', '50')

      describe('after commision rate changed', function() {
        it('Alice must purchase voucher', async function() {
          await buyVoucher(this.validatorContract, web3.utils.toWei('100'), this.user)
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

          oldRewards = await this.validatorContract.getRewardPerShare()
          oldExchangeRate = await this.validatorContract.exchangeRate()
        })

        it('liquid rewards must be correct', async function() {
          assertBigNumberEquality(await this.validatorContract.getLiquidRewards(this.user), liquidRewards)
        })

        it('exchange rate must be correct', async function() {
          assertBigNumberEquality(await this.validatorContract.exchangeRate(), exchangeRate)
        })

        it('ValidatorShare getRewardPerShare must be unchanged', async function() {
          assertBigNumberEquality(oldRewards, await this.validatorContract.getRewardPerShare())
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
          await buyVoucher(this.validatorContract, this.stakeAmount, this.user)
        })
        // get 25% of checkpoint rewards
        testAfterComissionChange(web3.utils.toWei('2250'), '100')
      })

      testCommisionRate('50', '100')

      describe('after commision rate changed', function() {
        // get 0% of checkpoint rewards
        testAfterComissionChange(web3.utils.toWei('9000'), '100')
      })

      testCommisionRate('100', '0')

      describe('after commision rate changed', function() {
        // get only 50% of checkpoint rewards
        testAfterComissionChange(web3.utils.toWei('13500'), '100')
      })
    })

    describe('when new commision rate is greater than 100', function() {
      before(batchDeploy)

      it('reverts', async function() {
        await expectRevert(
          this.stakeManager.updateCommissionRate(this.validatorId, 101, { from: this.validatorUser.getAddressString() }),
          'Incorrect value'
        )
      })
    })

    describe('when trying to set commision again within commissionCooldown period', function() {
      before(batchDeploy)
      before(async function() {
        this.stakeManager.updateCommissionRate(this.validatorId, 10, { from: this.validatorUser.getAddressString() })
      })

      it('reverts', async function() {
        await expectRevert(
          this.stakeManager.updateCommissionRate(this.validatorId, 15, { from: this.validatorUser.getAddressString() }),
          'Cooldown'
        )
      })
    })
  })

  describe('updateValidatorDelegation', function() {
    let staker = wallets[1]
    let stakeAmount = web3.utils.toWei('100')

    function doDeploy(acceptDelegation) {
      before('Fresh deploy', freshDeploy)
      before('Approve and stake', async function() {
        await approveAndStake.call(this, { wallet: staker, stakeAmount: stakeAmount, acceptDelegation })

        if (acceptDelegation) {
          const validator = await this.stakeManager.validators('1')
          this.validatorShares = await ValidatorShare.at(validator.contractAddress)
        }
      })
    }

    describe('when from is not validator', function() {
      doDeploy(true)

      it('reverts ', async function() {
        await expectRevert(this.stakeManager.updateValidatorDelegation(false, { from: wallets[2].getAddressString() }), 'not validator')
      })
    })

    describe('when validator has Delegation is disabled', function() {
      doDeploy(false)

      it('reverts ', async function() {
        await expectRevert(this.stakeManager.updateValidatorDelegation(false, { from: staker.getAddressString() }), 'Delegation is disabled')
      })
    })

    describe('when validator is valid', function() {
      doDeploy(true)

      it('disables delegation ', async function() {
        await this.stakeManager.updateValidatorDelegation(false, { from: staker.getAddressString() })
      })

      it('validatorShares delegation == false', async function() {
        assert.isFalse(await this.validatorShares.delegation())
      })

      it('enables delegation ', async function() {
        await this.stakeManager.updateValidatorDelegation(true, { from: staker.getAddressString() })
      })

      it('validatorShares delegation == true', async function() {
        assert.isTrue(await this.validatorShares.delegation())
      })
    })
  })

  function testConfirmAuctionBidForOldValidator() {
    it('must confirm auction', async function() {
      this.receipt = await this.stakeManager.confirmAuctionBid(
        this.validatorId,
        0,
        {
          from: this.prevValidatorAddr
        }
      )
    })

    it('must emit ConfirmAuction', async function() {
      await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'ConfirmAuction', {
        newValidatorId: this.validatorId,
        oldValidatorId: this.validatorId,
        amount: this.validator.amount
      })
    })

    it('validator is still a validator', async function() {
      assert.ok(await this.stakeManager.isValidator(this.validatorId))
    })

    it('bidder balance must be correct', async function() {
      const currentBalance = await this.stakeToken.balanceOf(this.bidder)
      assertBigNumberEquality(this.bidderBalanceBeforeAuction, currentBalance)
    })
  }

  describe('checkSignatures', function() {
    function prepareToTest(stakers, checkpointBlockInterval = 1) {
      before('Fresh deploy', freshDeploy)
      before('updateCheckPointBlockInterval', async function() {
        await this.stakeManager.updateValidatorThreshold(200)
        await this.stakeManager.updateCheckPointBlockInterval(checkpointBlockInterval)
        await this.stakeManager.updateCheckpointRewardParams(20, 5, 10)
      })
      before('Approve and stake', async function() {
        this.totalAmount = new BN(0)

        for (const staker of stakers) {
          await approveAndStake.call(this, { wallet: staker.wallet, stakeAmount: staker.stake, acceptDelegation: true })

          this.totalAmount = this.totalAmount.add(staker.stake)
        }
      })
    }

    describe('proposer bonus must be rewarded to the proposer without distribution to the delegators', function() {
      const delegator = wallets[1].getChecksumAddressString()
      const stakers = [
        { wallet: wallets[2], stake: new BN(web3.utils.toWei('100')) },
        { wallet: wallets[4], stake: new BN(web3.utils.toWei('100')) },
        { wallet: wallets[3], stake: new BN(web3.utils.toWei('100')) }
      ]

      const signers = stakers.map(x => x.wallet)

      prepareToTest(stakers, 1)

      before(async function() {
        await this.stakeManager.updateProposerBonus(10)

        await this.stakeToken.mint(
          delegator,
          toWei('1000')
        )
        await this.stakeToken.approve(this.stakeManager.address, toWei('1000'), {
          from: delegator
        })

        const validator = await this.stakeManager.validators('1')
        const validatorContract = await ValidatorShare.at(validator.contractAddress)

        await buyVoucher(validatorContract, toWei('100'), delegator)
      })

      testCheckpointing(stakers, signers, 1, 1, {
        [stakers[0].wallet.getAddressString()]: toWei('3250'), // proposer fixed bonus + 50% of reward
        [stakers[1].wallet.getAddressString()]: toWei('2250'),
        [stakers[2].wallet.getAddressString()]: toWei('2250')
      }, true, stakers[0].wallet)
    })

    describe('when 1st validator unstakes but 2nd do not sign a checkpoint', function() {
      const validatorWallet = wallets[2]
      const validatorId = '1'
      const stakers = [
        { wallet: validatorWallet, stake: new BN(web3.utils.toWei('200')) },
        { wallet: wallets[4], stake: new BN(web3.utils.toWei('100')) },
        { wallet: wallets[3], stake: new BN(web3.utils.toWei('200')) }
      ]

      const signers = stakers.map(x => x.wallet)
      signers.splice(1, 1)

      prepareToTest(stakers, 1)

      before('must unstake', async function() {
        await this.stakeManager.unstake(validatorId, {
          from: validatorWallet.getChecksumAddressString()
        })
      })

      testCheckpointing(stakers, signers, 1, 1, {
        [stakers[0].wallet.getAddressString()]: '3600000000000000000000',
        [stakers[1].wallet.getAddressString()]: '0000000000000000000000',
        [stakers[2].wallet.getAddressString()]: '3600000000000000000000'
      })
    })

    describe('when validator unstakes and do not sign last checkpoint', function() {
      const validatorWallet = wallets[4]
      const validatorId = '2'
      const stakers = [
        { wallet: wallets[2], stake: new BN(web3.utils.toWei('200')) },
        { wallet: validatorWallet, stake: new BN(web3.utils.toWei('100')) },
        { wallet: wallets[3], stake: new BN(web3.utils.toWei('200')) }
      ]

      const signers = stakers.map(x => x.wallet)
      signers.splice(1, 1)

      prepareToTest(stakers, 1)

      before('must unstake', async function() {
        await this.stakeManager.unstake(validatorId, {
          from: validatorWallet.getChecksumAddressString()
        })
      })

      testCheckpointing(stakers, signers, 1, 1, {
        [stakers[0].wallet.getAddressString()]: '3600000000000000000000',
        [stakers[1].wallet.getAddressString()]: '0000000000000000000000',
        [stakers[2].wallet.getAddressString()]: '3600000000000000000000'
      })
    })

    describe('when validator signs twice and sends his 2nd signature out of order', function() {
      let stakers = [
        { wallet: wallets[2], stake: new BN(web3.utils.toWei('100')) },
        { wallet: wallets[4], stake: new BN(web3.utils.toWei('100')) },
        { wallet: wallets[3], stake: new BN(web3.utils.toWei('1000')) }
      ]

      const signers = stakers.map(x => x.wallet)
      signers.splice(0, 0, stakers[2].wallet)

      prepareToTest(stakers, 1)

      before(async function() {
        await this.stakeManager.updateProposerBonus(0)
      })

      testCheckpointing(stakers, signers, 1, 1, {
        [stakers[0].wallet.getAddressString()]: '0',
        [stakers[1].wallet.getAddressString()]: '0',
        [stakers[2].wallet.getAddressString()]: '8333333333333333333333' // because not everyone signed, 1000 out of 1200 staked tokens
      }, false)
    })

    describe('when validators sign several times', function() {
      const stakers = [
        { wallet: wallets[2], stake: new BN(web3.utils.toWei('100')) },
        { wallet: wallets[3], stake: new BN(web3.utils.toWei('200')) }
      ]

      const signers = stakers.map(x => x.wallet)
      signers.push(stakers[0].wallet)
      signers.push(stakers[0].wallet)
      signers.push(stakers[1].wallet)
      signers.push(stakers[1].wallet)

      prepareToTest(stakers)

      before(async function() {
        await this.stakeManager.updateProposerBonus(10)
      })

      testCheckpointing(stakers, signers, 1, 1, {
        [stakers[0].wallet.getAddressString()]: '3000000000000000000000',
        [stakers[1].wallet.getAddressString()]: '6000000000000000000000'
      })
    })

    describe('when 100 validators stake, block interval 1, 2 epochs', function() {
      const stakers = []

      const w = generateFirstWallets(mnemonics, 100)
      for (let i = 0; i < 100; ++i) {
        stakers.push({
          wallet: w[i],
          stake: new BN(web3.utils.toWei('1'))
        })
      }

      prepareToTest(stakers)

      testCheckpointing(stakers, stakers.map(x => x.wallet), 1, 1)
      testCheckpointing(stakers, stakers.map(x => x.wallet), 1, 1)
    })

    describe('when 2 validators stakes, block interval 1, 1 epoch', function() {
      const stakers = [
        { wallet: wallets[2], stake: new BN(web3.utils.toWei('100')) },
        { wallet: wallets[3], stake: new BN(web3.utils.toWei('200')) }
      ]

      prepareToTest(stakers)

      describe('when proposer bonus is 10%', function() {
        before(async function() {
          await this.stakeManager.updateProposerBonus(10)
        })

        testCheckpointing(stakers, stakers.map(x => x.wallet), 1, 1, {
          [stakers[0].wallet.getAddressString()]: '3000000000000000000000',
          [stakers[1].wallet.getAddressString()]: '6000000000000000000000'
        })
      })

      describe('when proposer updates bonus to 5%', function() {
        before(async function() {
          await this.stakeManager.updateProposerBonus(5)
        })

        testCheckpointing(stakers, stakers.map(x => x.wallet), 1, 1, {
          [stakers[0].wallet.getAddressString()]: '6166666666666666666666',
          [stakers[1].wallet.getAddressString()]: '12333333333333333333333'
        })
      })
    })

    describe('when 3 validators stake', function() {
      let stakers = [
        { wallet: wallets[2], stake: new BN(web3.utils.toWei('100')) },
        { wallet: wallets[3], stake: new BN(web3.utils.toWei('200')) },
        { wallet: wallets[4], stake: new BN(web3.utils.toWei('300')) }
      ]

      function runTests(checkpointBlockInterval, blockInterval, epochs, expectedRewards) {
        describe(`when ${epochs} epoch passed`, function() {
          prepareToTest(stakers, checkpointBlockInterval)
          testCheckpointing(stakers, stakers.map(x => x.wallet), blockInterval, epochs, expectedRewards)
        })
      }

      describe('when next checkpoint is slower than previous', function() {
        prepareToTest(stakers, 1)

        testCheckpointing(stakers, stakers.map(x => x.wallet), 1, 1, {
          [stakers[0].wallet.getAddressString()]: toWei('1500'),
          [stakers[1].wallet.getAddressString()]: toWei('3000'),
          [stakers[2].wallet.getAddressString()]: toWei('4500')
        })

        testCheckpointing(stakers, stakers.map(x => x.wallet), 2, 1, {
          [stakers[0].wallet.getAddressString()]: toWei('3930'),
          [stakers[1].wallet.getAddressString()]: toWei('7860'),
          [stakers[2].wallet.getAddressString()]: toWei('11790')
        })

        testCheckpointing(stakers, stakers.map(x => x.wallet), 2, 1, {
          [stakers[0].wallet.getAddressString()]: toWei('6630'),
          [stakers[1].wallet.getAddressString()]: toWei('13260'),
          [stakers[2].wallet.getAddressString()]: toWei('19890')
        })
      })

      describe('when next checkpoint is faster than previous', function() {
        prepareToTest(stakers, 1)

        testCheckpointing(stakers, stakers.map(x => x.wallet), 2, 1, {
          [stakers[0].wallet.getAddressString()]: toWei('2700'),
          [stakers[1].wallet.getAddressString()]: toWei('5400'),
          [stakers[2].wallet.getAddressString()]: toWei('8100')
        })

        testCheckpointing(stakers, stakers.map(x => x.wallet), 1, 1, {
          [stakers[0].wallet.getAddressString()]: toWei('4350'),
          [stakers[1].wallet.getAddressString()]: toWei('8700'),
          [stakers[2].wallet.getAddressString()]: toWei('13050')
        })

        testCheckpointing(stakers, stakers.map(x => x.wallet), 1, 1, {
          [stakers[0].wallet.getAddressString()]: toWei('5850'),
          [stakers[1].wallet.getAddressString()]: toWei('11700'),
          [stakers[2].wallet.getAddressString()]: toWei('17550')
        })
      })

      describe('when checkpoint block interval is 1', function() {
        describe('when block interval is 1', function() {
          runTests(1, 1, 1, {
            [stakers[0].wallet.getAddressString()]: '1500000000000000000000',
            [stakers[1].wallet.getAddressString()]: '3000000000000000000000',
            [stakers[2].wallet.getAddressString()]: '4500000000000000000000'
          })
          runTests(1, 1, 5, {
            [stakers[0].wallet.getAddressString()]: '7500000000000000000000',
            [stakers[1].wallet.getAddressString()]: '15000000000000000000000',
            [stakers[2].wallet.getAddressString()]: '22500000000000000000000'
          })
        })

        describe('when block interval is 10', function() {
          prepareToTest(stakers, 1)

          runTests(1, 10, 1, {
            [stakers[0].wallet.getAddressString()]: toWei('4500'),
            [stakers[1].wallet.getAddressString()]: toWei('9000'),
            [stakers[2].wallet.getAddressString()]: toWei('13500')
          })
        })

        describe('when block interval is 3', function() {
          prepareToTest(stakers, 1)

          runTests(1, 3, 1, {
            [stakers[0].wallet.getAddressString()]: toWei('3600'),
            [stakers[1].wallet.getAddressString()]: toWei('7200'),
            [stakers[2].wallet.getAddressString()]: toWei('10800')
          })
        })
      })

      describe('when checkpoint block interval is 10', function() {
        describe('when block interval is 5', function() {
          runTests(10, 5, 1, {
            [stakers[0].wallet.getAddressString()]: toWei('750'),
            [stakers[1].wallet.getAddressString()]: toWei('1500'),
            [stakers[2].wallet.getAddressString()]: toWei('2250')
          })
        })

        describe('when block interval is 15', function() {
          prepareToTest(stakers, 1)

          runTests(10, 15, 1, {
            [stakers[0].wallet.getAddressString()]: toWei('2100'),
            [stakers[1].wallet.getAddressString()]: toWei('4200'),
            [stakers[2].wallet.getAddressString()]: toWei('6300')
          })
        })
      })

      describe('when checkpoint block interval is 10', function() {
        describe('when block interval is 1', function() {
          runTests(10, 1, 1, {
            [stakers[0].wallet.getAddressString()]: '150000000000000000000',
            [stakers[1].wallet.getAddressString()]: '300000000000000000000',
            [stakers[2].wallet.getAddressString()]: '450000000000000000000'
          })
          runTests(10, 1, 5, {
            [stakers[0].wallet.getAddressString()]: '750000000000000000000',
            [stakers[1].wallet.getAddressString()]: '1500000000000000000000',
            [stakers[2].wallet.getAddressString()]: '2250000000000000000000'
          })
        })

        describe('when block interval is 5', function() {
          runTests(10, 5, 1, {
            [stakers[0].wallet.getAddressString()]: '750000000000000000000',
            [stakers[1].wallet.getAddressString()]: '1500000000000000000000',
            [stakers[2].wallet.getAddressString()]: '2250000000000000000000'
          })
          runTests(10, 5, 5, {
            [stakers[0].wallet.getAddressString()]: '3750000000000000000000',
            [stakers[1].wallet.getAddressString()]: '7500000000000000000000',
            [stakers[2].wallet.getAddressString()]: '11250000000000000000000'
          })
        })
      })
    })

    describe('when 3 validators stake but only 1 signs', function() {
      let stakers = [
        { wallet: wallets[2], stake: new BN(web3.utils.toWei('1000')) },
        { wallet: wallets[3], stake: new BN(web3.utils.toWei('100')) },
        { wallet: wallets[4], stake: new BN(web3.utils.toWei('100')) }
      ]

      prepareToTest(stakers, 1)
      testCheckpointing(stakers, [stakers[0].wallet], 1, 1, {
        [stakers[0].wallet.getAddressString()]: web3.utils.toWei('7500'),
        [stakers[1].wallet.getAddressString()]: '0',
        [stakers[2].wallet.getAddressString()]: '0'
      })
    })

    describe('when 7 validators stake but only 1 signs', function() {
      let stakers = [
        { wallet: wallets[2], stake: new BN(web3.utils.toWei('10000')) },
        { wallet: wallets[3], stake: new BN(web3.utils.toWei('100')) },
        { wallet: wallets[4], stake: new BN(web3.utils.toWei('100')) },
        { wallet: wallets[5], stake: new BN(web3.utils.toWei('100')) },
        { wallet: wallets[6], stake: new BN(web3.utils.toWei('100')) },
        { wallet: wallets[7], stake: new BN(web3.utils.toWei('100')) },
        { wallet: wallets[8], stake: new BN(web3.utils.toWei('100')) }
      ]

      prepareToTest(stakers, 1)
      testCheckpointing(stakers, [stakers[0].wallet], 1, 1, {
        [stakers[0].wallet.getAddressString()]: '8490566037735849056604',
        [stakers[1].wallet.getAddressString()]: '0',
        [stakers[2].wallet.getAddressString()]: '0',
        [stakers[3].wallet.getAddressString()]: '0',
        [stakers[4].wallet.getAddressString()]: '0',
        [stakers[5].wallet.getAddressString()]: '0',
        [stakers[6].wallet.getAddressString()]: '0'
      })
    })

    describe('when payload is invalid', function() {
      beforeEach(freshDeploy)
      beforeEach('Prepare to test', async function() {
        this.amount = new BN(web3.utils.toWei('200'))
        this.wallets = [wallets[2]]
        this.voteData = 'dummyData'
        this.stateRoot = utils.bufferToHex(utils.keccak256('stateRoot'))
        this.proposer = wallets[2].getAddressString()

        for (const wallet of this.wallets) {
          await approveAndStake.call(this, { wallet, stakeAmount: this.amount })
        }

        this.sigs = encodeSigsForCheckpoint(getSigs(this.wallets, utils.keccak256(this.voteData)))
      })

      function testRevert() {
        it('must revert', async function() {
          await expectRevert.unspecified(this.stakeManager.checkSignatures(
            1,
            utils.bufferToHex(utils.keccak256(this.voteData)),
            this.stateRoot,
            this.proposer,
            this.sigs,
            {
              from: this.rootChainOwner.getAddressString()
            }
          ))
        })
      }

      describe('when sigs is empty', function() {
        beforeEach(function() {
          this.sigs = []
        })

        testRevert()
      })

      describe('when sigs are random', function() {
        beforeEach(function() {
          this.sigs = [[
            new BN(utils.keccak256('random_string')),
            new BN(utils.keccak256('abvcsdsds')),
            new BN(27)
          ]]
        })

        testRevert()
      })

      describe('when from is not root chain', function() {
        beforeEach(function() {
          this.rootChainOwner = wallets[2]
        })

        testRevert()
      })
    })

    describe('with votes', function() {
      const amount = new BN(web3.utils.toWei('200'))

      async function feeCheckpointWithVotes(validatorId, start, end, votes, _sigPrefix, proposer) {
        let tree = await buildTreeFee(this.validators, this.accumulatedFees, this.checkpointIndex)
        this.checkpointIndex++

        const { data, sigs } = buildsubmitCheckpointPaylodWithVotes(
          this.validatorsWallets[validatorId].getAddressString(),
          start,
          end,
          '' /* root */,
          Object.values(this.validatorsWallets),
          votes, // yes votes
          { rewardsRootHash: tree.getRoot(), allValidators: true, getSigs: true, totalStake: this.totalStaked, sigPrefix: _sigPrefix }
        )

        await this.stakeManager.checkSignatures(
          end - start,
          utils.bufferToHex(utils.keccak256(Buffer.concat([utils.toBuffer('0x01'), utils.toBuffer(data)]))),
          utils.bufferToHex(tree.getRoot()),
          proposer || this.validatorsWallets[validatorId].getAddressString(),
          sigs,
          { from: this.rootChainOwner.getAddressString() }
        )

        return tree
      }

      async function doDeploy() {
        await freshDeploy.call(this)

        this.checkpointIndex = 0
        this.validators = []
        this.validatorsWallets = {}
        this.totalStaked = new BN(0)
        this.accumulatedFees = {}

        for (let i = 0; i < this.validatorsCount; i++) {
          await approveAndStake.call(this, { wallet: wallets[i], stakeAmount: amount })

          const validatorId = i + 1
          this.validatorsWallets[validatorId] = wallets[i]
          this.validators.push(wallets[i].getAddressString())
          this.totalStaked = this.totalStaked.add(amount)
          this.accumulatedFees[wallets[i].getAddressString()] = []
        }

        this.index = 0
      }

      describe('Deploying and staking with 4 validators...', async function() {
        const AliceValidatorId = 1
        const firstFeeToClaim = new BN(web3.utils.toWei('25'))

        beforeEach(function() {
          this.trees = []
          this.validatorsCount = 4

          this.validators = [wallets[0].getAddressString()]
        })
        beforeEach('fresh deploy', doDeploy)

        describe('Alice proposes with more than 2/3+1 votes votes', function() {
          it('should pass the check', async function() {
            this.accumulatedFees[wallets[0].getAddressString()] = [[firstFeeToClaim]]
            this.tree = await feeCheckpointWithVotes.call(this, AliceValidatorId, 0, 22, 3, '') //  3 yes votes
          })
          it('sig prefix is 0x00, reverts', async function() {
            this.accumulatedFees[wallets[0].getAddressString()] = [[firstFeeToClaim]]
            this.tree = await expectRevert.unspecified(feeCheckpointWithVotes.call(this, AliceValidatorId, 0, 22, 3, '0x00')) //  3 yes votes
          })
          it('sig prefix is 0x02, reverts', async function() {
            this.accumulatedFees[wallets[0].getAddressString()] = [[firstFeeToClaim]]
            this.tree = await expectRevert.unspecified(feeCheckpointWithVotes.call(this, AliceValidatorId, 0, 22, 3, '0x02')) //  3 yes votes
          })
        })

        describe('Alice proposes with less than 2/3 votes', function() {
          it('should revert', async function() {
            this.accumulatedFees[wallets[0].getAddressString()] = [[firstFeeToClaim]]
            this.tree = await expectRevert.unspecified(feeCheckpointWithVotes.call(this, AliceValidatorId, 0, 22, 2, '')) //  2 yes votes
          })
        })
      })
    })

    describe('when trying to checkpoint when 1 of the validators unstakes with more than 1/3 stake and don\'t sign', function() {
      before('Fresh Deploy', freshDeploy)
      before('Alice And Bob Stake', async function() {
        for (const wallet of [wallets[2], wallets[3]]) {
          await approveAndStake.call(this, { wallet: wallet, stakeAmount: walletAmounts[wallet.getAddressString()].stakeAmount })
        }
      })
      before('Alice unstakes', async function() {
        const validatorId = await this.stakeManager.getValidatorId(wallets[2].getAddressString())
        await this.stakeManager.unstake(validatorId, { from: wallets[2].getAddressString() })
      })

      it('reverts', async function() {
        await expectRevert(checkPoint([wallets[3]], this.rootChainOwner, this.stakeManager), '2/3+1 non-majority!')
      })
    })
  })

  describe('dethroneAndStake', function() {
    describe('when from is not stake manager', function() {
      before('Fresh Deploy', freshDeploy)

      it('reverts', async function() {
        await expectRevert(this.stakeManager.dethroneAndStake(
          wallets[2].getAddressString(),
          this.defaultHeimdallFee,
          '1',
          '1000',
          true,
          wallets[2].getPublicKeyString()
        ), 'not allowed')
      })
    })
  })

  describe('setDelegationEnabled', function() {
    describe('when from is governance', function() {
      before(freshDeploy)

      it('must disable delegation', async function() {
        await this.governance.update(
          this.stakeManager.address,
          this.stakeManager.contract.methods.setDelegationEnabled(false).encodeABI()
        )
      })

      it('delegationEnabled must be false', async function() {
        assert.isFalse(await this.stakeManager.delegationEnabled())
      })

      it('must enable delegation', async function() {
        await this.governance.update(
          this.stakeManager.address,
          this.stakeManager.contract.methods.setDelegationEnabled(true).encodeABI()
        )
      })

      it('delegationEnabled must be true', async function() {
        assert.isTrue(await this.stakeManager.delegationEnabled())
      })
    })

    describe('when from is not governance', function() {
      before(freshDeploy)

      it('reverts', async function() {
        await expectRevert(this.stakeManager.setDelegationEnabled(false), 'Only governance contract is authorized')
      })
    })
  })

  describe('updateSigner', function() {
    const w = [wallets[3], wallets[5]]
    const user = wallets[3].getChecksumAddressString()
    const userOriginalPubKey = wallets[3].getPublicKeyString()

    async function doDeploy() {
      await freshDeploy.call(this)

      const amount = web3.utils.toWei('200')
      for (const wallet of w) {
        await approveAndStake.call(this, { wallet, stakeAmount: amount })
      }

      const signerUpdateLimit = await this.stakeManager.signerUpdateLimit()
      await this.stakeManager.advanceEpoch(signerUpdateLimit)
    }

    function testUpdateSigner() {
      it('must update signer', async function() {
        const validatorId = await this.stakeManager.getValidatorId(user)
        this.receipt = await this.stakeManager.updateSigner(validatorId, this.userPubkey, {
          from: user
        })
      })

      it('must emit SignerChange', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'SignerChange', {
          newSigner: this.signer
        })
      })

      it('must have correct signer on-chain', async function() {
        const validatorId = await this.stakeManager.getValidatorId(user)
        let stakerDetails = await this.stakeManager.validators(validatorId)
        stakerDetails.signer.should.equal(this.signer)
      })
    }

    describe('when update signer to different public key', function() {
      before(doDeploy)

      before(function() {
        this.signer = wallets[0].getChecksumAddressString()
        this.userPubkey = wallets[0].getPublicKeyString()
      })

      testUpdateSigner()

      testCheckpointing([
        { wallet: wallets[5] },
        { wallet: wallets[3] }
      ], [wallets[5], wallets[0]], 1, 1, {
        [wallets[5].getAddressString()]: web3.utils.toWei('4500'),
        [wallets[3].getAddressString()]: web3.utils.toWei('4500')
      })
    })

    describe('when update signer after signerUpdateLimit was update to be shorter', function() {
      before(doDeploy)

      describe('when update signer 1st time, signerUpdateLimit is 100', function() {
        before('set signerUpdateLimit to 100', async function() {
          await this.stakeManager.updateSignerUpdateLimit(100)
          await this.stakeManager.advanceEpoch(100)

          this.signer = wallets[1].getChecksumAddressString()
          this.userPubkey = wallets[1].getPublicKeyString()
        })

        testUpdateSigner()
      })

      describe('when update signer 2nd time, after signerUpdateLimit is 10', function() {
        before('set signerUpdateLimit to 10', async function() {
          await this.stakeManager.updateSignerUpdateLimit(10)
          await this.stakeManager.advanceEpoch(10)

          this.signer = wallets[0].getChecksumAddressString()
          this.userPubkey = wallets[0].getPublicKeyString()
        })

        testUpdateSigner()
      })
    })

    describe('when update signer back to staker original public key', function() {
      before(doDeploy)
      before(async function() {
        this.validatorId = await this.stakeManager.getValidatorId(user)

        await this.stakeManager.updateSigner(this.validatorId, wallets[0].getPublicKeyString(), {
          from: user
        })

        const signerUpdateLimit = await this.stakeManager.signerUpdateLimit()
        await this.stakeManager.advanceEpoch(signerUpdateLimit)
      })

      it('reverts', async function() {
        await expectRevert(this.stakeManager.updateSigner(this.validatorId, userOriginalPubKey, {
          from: user
        }), 'Invalid signer')
      })
    })

    describe('when updating public key 2 times within signerUpdateLimit period', function() {
      before(doDeploy)
      before(async function() {
        this.validatorId = await this.stakeManager.getValidatorId(user)

        await this.stakeManager.updateSigner(this.validatorId, wallets[0].getPublicKeyString(), {
          from: user
        })
      })

      it('reverts', async function() {
        await expectRevert(this.stakeManager.updateSigner(this.validatorId, wallets[6].getPublicKeyString(), {
          from: user
        }), 'Not allowed')
      })
    })

    describe('when public key is already in use', function() {
      before(doDeploy)
      before(async function() {
        this.newPubKey = wallets[0].getPublicKeyString()

        let validatorId = await this.stakeManager.getValidatorId(wallets[5].getAddressString())
        await this.stakeManager.updateSigner(validatorId, this.newPubKey, {
          from: wallets[5].getAddressString()
        })

        validatorId = await this.stakeManager.getValidatorId(wallets[3].getAddressString())
        this.validatorId = validatorId
      })

      it('reverts', async function() {
        await expectRevert.unspecified(this.stakeManager.updateSigner(this.validatorId, this.newPubKey, {
          from: wallets[3].getAddressString()
        }))
      })
    })

    describe('when from is not staker', function() {
      before(doDeploy)
      before(async function() {
        this.validatorId = await this.stakeManager.getValidatorId(user)
      })

      it('reverts', async function() {
        await expectRevert.unspecified(this.stakeManager.updateSigner(this.validatorId, wallets[6].getPublicKeyString(), {
          from: wallets[6].getAddressString()
        }))
      })
    })

    describe('when validatorId is incorrect', function() {
      before(doDeploy)

      it('reverts', async function() {
        await expectRevert.unspecified(this.stakeManager.updateSigner('9999999', wallets[5].getPublicKeyString(), {
          from: user
        }))
      })
    })
  })

  describe('updateValidatorThreshold', function() {
    before(prepareForTest(2, 10))

    function testUpdate(threshold) {
      it(`must set validator threshold to ${threshold}`, async function() {
        this.receipt = await this.governance.update(
          this.stakeManager.address,
          this.stakeManager.contract.methods.updateValidatorThreshold(threshold).encodeABI()
        )
      })

      it(`validatorThreshold == ${threshold}`, async function() {
        const newThreshold = await this.stakeManager.validatorThreshold()
        assertBigNumberEquality(newThreshold, threshold)
      })

      it('must emit ThresholdChange', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'ThresholdChange', {
          newThreshold: threshold.toString()
        })
      })
    }

    describe('must update threshold one after another', function() {
      testUpdate(5)
      testUpdate(6)
      testUpdate(1)
    })

    describe('reverts', function() {
      it('when from is not governance', async function() {
        await expectRevert(this.stakeManager.contract.methods.updateCheckPointBlockInterval(7).send({
          from: owner
        }), 'Only governance contract is authorized')
      })

      it('when threshold == 0', async function() {
        await expectRevert.unspecified(this.stakeManager.updateValidatorThreshold(0))
      })
    })
  })

  describe('updateDynastyValue', function() {
    describe('when set dynasty to 10', function() {
      before(freshDeploy)

      it('must update dynasty', async function() {
        this.receipt = await this.stakeManager.updateDynastyValue('10')
      })

      it('must emit DynastyValueChange', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'DynastyValueChange', {
          newDynasty: '10'
        })
      })

      it('WITHDRAWAL_DELAY must be 10', async function() {
        assertBigNumberEquality('10', await this.stakeManager.WITHDRAWAL_DELAY())
      })

      it('dynasty must be 10', async function() {
        assertBigNumberEquality('10', await this.stakeManager.dynasty())
      })

      it('auctionPeriod must be 2', async function() {
        assertBigNumberEquality('2', await this.stakeManager.auctionPeriod())
      })

      it('replacementCooldown must be 3', async function() {
        assertBigNumberEquality('3', await this.stakeManager.replacementCoolDown())
      })
    })

    describe('when set dynasty to 0', function() {
      before(freshDeploy)

      it('must revert', async function() {
        await expectRevert.unspecified(this.stakeManager.updateDynastyValue('0'))
      })
    })

    describe('when from is not governance', function() {
      before(freshDeploy)

      it('reverts', async function() {
        await expectRevert(this.stakeManager.contract.methods.updateDynastyValue('10').send({
          from: owner
        }), 'Only governance contract is authorized')
      })
    })
  })

  describe('updateCheckpointReward', function() {
    describe('when set reward to 20', function() {
      before(freshDeploy)

      it('must update', async function() {
        this.oldReward = await this.stakeManager.CHECKPOINT_REWARD()
        this.receipt = await this.stakeManager.updateCheckpointReward(20)
      })

      it('must emit RewardUpdate', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'RewardUpdate', {
          newReward: '20',
          oldReward: this.oldReward
        })
      })
    })

    describe('when set reward to 0', function() {
      before(freshDeploy)

      it('must revert', async function() {
        await expectRevert.unspecified(this.stakeManager.updateCheckpointReward(0))
      })
    })

    describe('when from is not governance', function() {
      before(freshDeploy)

      it('reverts', async function() {
        await expectRevert(this.stakeManager.contract.methods.updateCheckpointReward(20).send({
          from: owner
        }), 'Only governance contract is authorized')
      })
    })
  })

  describe('withdrawRewards', function() {
    const Alice = wallets[2]
    const Bob = wallets[3]

    let _wallets = [Alice, Bob]

    async function doDeploy() {
      await freshDeploy.call(this)

      this.amount = new BN(web3.utils.toWei('200'))
      this.totalStaked = new BN(0)

      for (const wallet of _wallets) {
        await approveAndStake.call(this, { wallet, stakeAmount: this.amount })

        this.totalStaked = this.totalStaked.add(this.amount)
      }

      const blockInterval = 1
      this.epochs = this.epochs || 1
      let _epochs = this.epochs
      while (_epochs-- > 0) {
        await checkPoint(_wallets, this.rootChainOwner, this.stakeManager, { blockInterval })
      }

      this.expectedReward = await calculateExpectedCheckpointReward.call(this, blockInterval, this.amount, this.totalStaked, this.epochs)
    }

    function testWithRewards() {
      it('must have correct balance', async function() {
        this.validatorId = await this.stakeManager.getValidatorId(this.user)
        const beforeBalance = await this.stakeToken.balanceOf(this.user)

        this.receipt = await this.stakeManager.withdrawRewards(this.validatorId, {
          from: this.user
        })

        const afterBalance = await this.stakeToken.balanceOf(this.user)

        assertBigNumberEquality(afterBalance, this.expectedReward.add(beforeBalance))
      })

      it('must emit ClaimRewards', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'ClaimRewards', {
          validatorId: this.validatorId,
          amount: this.expectedReward,
          totalAmount: await this.stakeManager.totalRewardsLiquidated()
        })
      })
    }

    function runTests(epochs) {
      describe(`when Alice and Bob stakes for ${epochs} epochs`, function() {
        before(function() {
          this.epochs = epochs
        })

        before(doDeploy)

        describe('when Alice claims reward', function() {
          before(function() {
            this.user = Alice.getAddressString()
          })

          testWithRewards()
        })

        describe('when Bob claims reward', function() {
          before(function() {
            this.user = Bob.getAddressString()
          })

          testWithRewards()
        })
      })
    }

    runTests(1)
    runTests(10)

    describe('reverts', function() {
      beforeEach(doDeploy)

      it('when from is not staker', async function() {
        const user = Bob.getAddressString()
        const validatorId = await this.stakeManager.getValidatorId(user)
        await expectRevert.unspecified(this.stakeManager.withdrawRewards(validatorId, {
          from: Alice.getAddressString()
        }))
      })

      it('when validatorId is invalid', async function() {
        await expectRevert.unspecified(this.stakeManager.withdrawRewards('99999', {
          from: Alice.getAddressString()
        }))
      })
    })
  })

  describe('Staking', function() {
    require('./StakeManager.Staking')(accounts)
  })

  describe('topUpForFee', function() {
    const wallet = wallets[1]
    const validatorUser = wallet.getChecksumAddressString()
    const amount = web3.utils.toWei('200')
    const fee = new BN(web3.utils.toWei('50'))

    async function doDeploy() {
      await freshDeploy.call(this)
      await approveAndStake.call(this, { wallet, stakeAmount: amount })
    }

    function testTopUp(user) {
      it('must top up', async function() {
        await this.stakeToken.approve(this.stakeManager.address, fee, {
          from: user
        })

        this.receipt = await this.stakeManager.topUpForFee(user, fee, {
          from: user
        })
      })

      it('must emit TopUpFee', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'TopUpFee', {
          user: user,
          fee
        })
      })
    }

    function runTopUpTests(doDeploy, user) {
      describe('once', function() {
        before(doDeploy)

        testTopUp(user)
      })

      describe('2 times within same checkpoint', function() {
        before(doDeploy)

        describe('1st top up', function() {
          testTopUp(user)
        })

        describe('2nd top up', function() {
          testTopUp(user)
        })
      })

      describe('2 times with 1 checkpoint inbetween', function() {
        before(doDeploy)

        describe('1st top up', function() {
          testTopUp(user)
        })

        describe('2nd top up', function() {
          before(async function() {
            await checkPoint([wallet], this.rootChainOwner, this.stakeManager)
          })

          testTopUp(user)
        })
      })
    }

    describe('when validator tops up', function() {
      runTopUpTests(doDeploy, validatorUser)
    })

    describe('when non-validator tops up', function() {
      const user = wallets[2].getChecksumAddressString()

      runTopUpTests(async function() {
        await doDeploy.call(this)
        const mintAmount = web3.utils.toWei('10000')
        await this.stakeToken.mint(user, mintAmount)
        await this.stakeToken.approve(this.stakeManager.address, new BN(mintAmount), {
          from: user
        })
      }, user)
    })

    describe('when used signer tops up', function() {
      before(doDeploy)
      before('change signer', async function() {
        const signerUpdateLimit = await this.stakeManager.signerUpdateLimit()
        await this.stakeManager.advanceEpoch(signerUpdateLimit)
        await this.stakeManager.updateSigner('1', wallets[5].getPublicKeyString(), {
          from: validatorUser
        })
      })

      testTopUp(validatorUser)
    })

    describe('reverts', function() {
      beforeEach(doDeploy)

      it('when user approves less than fee', async function() {
        await this.stakeToken.approve(this.stakeManager.address, fee.sub(new BN(1)), {
          from: validatorUser
        })

        await expectRevert.unspecified(this.stakeManager.topUpForFee(validatorUser, fee, {
          from: validatorUser
        }))
      })

      it('when fee is too small', async function() {
        const minHeimdallFee = await this.stakeManager.minHeimdallFee()
        await expectRevert(this.stakeManager.topUpForFee(validatorUser, minHeimdallFee.sub(new BN(1)), {
          from: validatorUser
        }), 'fee too small')
      })

      it('when fee overflows', async function() {
        const overflowFee = new BN(2).pow(new BN(256))
        await expectRevert.unspecified(this.stakeManager.topUpForFee(validatorUser, overflowFee, {
          from: validatorUser
        }))
      })
    })
  })

  describe('claimFee', function() {
    const amount = new BN(web3.utils.toWei('200'))

    async function feeCheckpoint(validatorId, start, end, proposer) {
      let tree = await buildTreeFee(this.validators, this.accumulatedFees, this.checkpointIndex)
      this.checkpointIndex++

      const { data, sigs } = buildsubmitCheckpointPaylod(
        this.validatorsWallets[validatorId].getAddressString(),
        start,
        end,
        '' /* root */,
        Object.values(this.validatorsWallets),
        { rewardsRootHash: tree.getRoot(), allValidators: true, getSigs: true, totalStake: this.totalStaked }
      )

      await this.stakeManager.checkSignatures(
        end - start,
        utils.bufferToHex(utils.keccak256(Buffer.concat([utils.toBuffer('0x01'), utils.toBuffer(data)]))),
        utils.bufferToHex(tree.getRoot()),
        proposer || this.validatorsWallets[validatorId].getAddressString(),
        sigs,
        { from: this.rootChainOwner.getAddressString() }
      )

      return tree
    }

    function createLeafFrom(validatorAddr, checkpointIndex) {
      return utils.keccak256(
        web3.eth.abi.encodeParameters(
          ['address', 'uint256'],
          [validatorAddr, this.accumulatedFees[validatorAddr][checkpointIndex][0].toString()]
        )
      )
    }

    async function doDeploy() {
      await freshDeploy.call(this)

      this.checkpointIndex = 0
      this.validators = []
      this.validatorsWallets = {}
      this.totalStaked = new BN(0)
      this.accumulatedFees = {}

      for (let i = 0; i < this.validatorsCount; i++) {
        await approveAndStake.call(this, { wallet: wallets[i], stakeAmount: amount })

        const validatorId = i + 1
        this.validatorsWallets[validatorId] = wallets[i]
        this.validators.push(wallets[i].getChecksumAddressString())
        this.totalStaked = this.totalStaked.add(amount)
        this.accumulatedFees[wallets[i].getChecksumAddressString()] = []
      }

      this.index = 0
    }

    function doTopUp(checkpointIndex) {
      return async function() {
        for (const validatorAddr in this.topUpFeeFor) {
          const fee = this.topUpFeeFor[validatorAddr]

          let newTopUp = [fee, 0]
          if (checkpointIndex === this.accumulatedFees[validatorAddr].length) {
            let newTopUpIndex = this.accumulatedFees[validatorAddr].push(newTopUp) - 1
            for (let i = 0; i < newTopUpIndex; ++i) {
              newTopUp[0] = newTopUp[0].add(this.accumulatedFees[validatorAddr][i][0])
            }
          } else {
            this.accumulatedFees[validatorAddr][checkpointIndex][0] = newTopUp[0].add(this.accumulatedFees[validatorAddr][checkpointIndex][0])
          }

          await this.stakeToken.approve(this.stakeManager.address, fee, {
            from: validatorAddr
          })

          await this.stakeManager.topUpForFee(validatorAddr, fee, {
            from: validatorAddr
          })
        }

        this.beforeClaimTotalHeimdallFee = await this.stakeManager.totalHeimdallFee()
      }
    }

    function testAliceClaim() {
      it('Alice must withdraw heimdall fee', async function() {
        this.receipt = await this.stakeManager.claimFee(
          this.fee,
          this.index,
          utils.bufferToHex(Buffer.concat(this.tree.getProof(this.leaf))),
          { from: this.user }
        )
      })

      it('must emit ClaimFee', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'ClaimFee', {
          user: this.user,
          fee: this.claimedFee
        })
      })

      it('balance must increase by fee', async function() {
        const newBalance = await this.stakeToken.balanceOf(this.user)
        assertBigNumberEquality(this.beforeClaimBalance.add(this.claimedFee), newBalance)
      })

      it('total heimdall fee must decrease by fee', async function() {
        const totalHeimdallFee = await this.stakeManager.totalHeimdallFee()
        assertBigNumberEquality(this.beforeClaimTotalHeimdallFee.sub(this.claimedFee), totalHeimdallFee)
      })
    }

    describe('when Alice topups once and claims 2 times', async function() {
      const AliceValidatorId = 1
      const totalFee = new BN(web3.utils.toWei('100'))
      const firstFeeToClaim = new BN(web3.utils.toWei('25'))
      const secondFeeToClaim = new BN(web3.utils.toWei('100'))

      before(function() {
        this.trees = []
        this.validatorsCount = 2
      })

      before('fresh deploy', doDeploy)
      before('top up', async function() {
        this.user = this.validatorsWallets[AliceValidatorId].getChecksumAddressString()

        await this.stakeToken.approve(this.stakeManager.address, totalFee, {
          from: this.user
        })

        await this.stakeManager.topUpForFee(this.user, totalFee, {
          from: this.user
        })
      })

      describe('after 1st checkpoint', function() {
        before('1st checkpoint', async function() {
          this.accumulatedFees[this.user] = [[firstFeeToClaim]]
          this.tree = await feeCheckpoint.call(this, AliceValidatorId, 0, 22)
          this.leaf = createLeafFrom.call(this, this.user, 0)
          this.fee = firstFeeToClaim
          this.claimedFee = this.fee
          this.beforeClaimBalance = await this.stakeToken.balanceOf(this.user)
          this.beforeClaimTotalHeimdallFee = await this.stakeManager.totalHeimdallFee()
        })

        testAliceClaim()
      })

      describe('after 2nd checkpoint', function() {
        before('2nd checkpoint', async function() {
          this.accumulatedFees[this.user] = [[secondFeeToClaim]]
          this.tree = await feeCheckpoint.call(this, AliceValidatorId, 22, 44)
          this.leaf = createLeafFrom.call(this, this.user, 0)
          this.fee = secondFeeToClaim
          this.claimedFee = secondFeeToClaim.sub(firstFeeToClaim)
          this.beforeClaimBalance = await this.stakeToken.balanceOf(this.user)
          this.beforeClaimTotalHeimdallFee = await this.stakeManager.totalHeimdallFee()
        })

        testAliceClaim()
      })
    })

    describe('when Alice and Bob stakes, but only Alice topups heimdall fee', function() {
      const AliceValidatorId = 1
      const BobValidatorId = 2

      before(function() {
        this.trees = []
        this.validatorsCount = 2
      })
      before(doDeploy)
      before(function() {
        this.user = this.validatorsWallets[AliceValidatorId].getChecksumAddressString()
        this.validatorsCount = 2
        this.fee = new BN(web3.utils.toWei('50'))
        this.claimedFee = this.fee
        this.topUpFeeFor = {
          [this.user]: this.fee
        }
      })

      before(doTopUp(0))

      before(async function() {
        this.tree = await feeCheckpoint.call(this, AliceValidatorId, 0, 22)
        this.leaf = createLeafFrom.call(this, this.user, 0)
        this.beforeClaimBalance = await this.stakeToken.balanceOf(this.user)
      })

      it('Bob must fail withdrawing', async function() {
        await expectRevert.unspecified(this.stakeManager.claimFee(
          this.fee,
          this.index,
          utils.bufferToHex(Buffer.concat(this.tree.getProof(this.leaf))),
          { from: this.validatorsWallets[BobValidatorId].getAddressString() }
        ))
      })

      testAliceClaim()
    })

    // accountStateRoot is being replaced during checkpoint
    // If i want to be able to withdraw fee from previous checkpoint - should i commit previous tree root?
    describe.skip('when Alice top ups 2 times with different values', function() {
      const AliceValidatorId = 1
      const firstFee = new BN(web3.utils.toWei('50'))
      const secondFee = new BN(web3.utils.toWei('30'))

      describe('when topup', function() {
        before(function() {
          this.trees = []
          this.user = this.validatorsWallets[AliceValidatorId].getChecksumAddressString()
          this.validatorsCount = 2
          this.topUpFeeFor = {
            [this.user]: firstFee
          }
        })

        before('fresh deploy', doDeploy)
        before('1st top up', doTopUp(0))
        before('1st checkpoint', async function() {
          this.trees.push(await feeCheckpoint.call(this, AliceValidatorId, 0, 22))
          this.topUpFeeFor = {
            [this.user]: secondFee
          }
        })
        before('2nd top up', doTopUp(1))
        before('2nd checkpoint', async function() {
          this.trees.push(await feeCheckpoint.call(this, AliceValidatorId, 22, 44))
        })

        describe('claims 1st time', function() {
          before(async function() {
            this.beforeClaimBalance = await this.stakeToken.balanceOf(this.user)
            this.tree = this.trees[0]
            this.fee = firstFee
            this.leaf = createLeafFrom.call(this, AliceValidatorId, 0)
          })

          testAliceClaim()
        })

        describe('claims 2nd time', function() {
          before(async function() {
            this.tree = this.trees[1]
            this.fee = secondFee
            this.index = 0
            this.leaf = createLeafFrom.call(this, this.user, 1)
            this.beforeClaimBalance = await this.stakeToken.balanceOf(this.user)
          })

          testAliceClaim()
        })
      })

      describe('when 1 checkpoint between claims', function() {
        // testAliceClaim(AliceValidatorId)
      })
    })

    describe('reverts', function() {
      beforeEach(function() {
        this.validatorsCount = 2
        this.fee = new BN(web3.utils.toWei('50'))
        this.validatorId = 1
      })

      beforeEach(doDeploy)
      beforeEach(function() {
        this.user = this.validatorsWallets[this.validatorId].getChecksumAddressString()
        this.topUpFeeFor = {
          [this.user]: this.fee
        }
      })
      beforeEach(doTopUp(0))
      beforeEach(async function() {
        this.tree = await feeCheckpoint.call(this, this.validatorId, 0, 22)
        this.leaf = createLeafFrom.call(this, this.user, 0)
        this.beforeClaimBalance = await this.stakeToken.balanceOf(this.user)
        this.proof = utils.bufferToHex(Buffer.concat(this.tree.getProof(this.leaf)))
      })

      async function testRevert() {
        await expectRevert.unspecified(this.stakeManager.claimFee(
          this.fee,
          this.index,
          this.proof,
          { from: this.user }
        ))
      }

      it('when index is incorrect', async function() {
        this.index = 1
        await testRevert.call(this)
      })

      it('when proof is incorrect', async function() {
        this.proof = utils.bufferToHex(Buffer.from('random_string'))
        await testRevert.call(this)
      })

      it('when claim less than checkpointed balance', async function() {
        this.fee = this.fee.sub(new BN(1))
        await testRevert.call(this)
      })

      it('when claim more than checkpointed balance', async function() {
        this.fee = this.fee.add(new BN(1))
        await testRevert.call(this)
      })
    })
  })

  describe('startAuction', function() {
    const _initialStakers = [wallets[1], wallets[2]]
    const initialStakeAmount = web3.utils.toWei('200')

    async function doDeploy() {
      await prepareForTest(8, 10).call(this)

      for (const wallet of _initialStakers) {
        await approveAndStake.call(this, { wallet, stakeAmount: initialStakeAmount })
      }

      // cooldown period
      let auctionPeriod = (await this.stakeManager.auctionPeriod()).toNumber()
      let currentEpoch = (await this.stakeManager.currentEpoch()).toNumber()
      for (let i = currentEpoch; i <= auctionPeriod + (await this.stakeManager.dynasty()).toNumber(); i++) {
        await checkPoint(_initialStakers, this.rootChainOwner, this.stakeManager)
      }
      this.amount = web3.utils.toWei('500')
      await this.stakeToken.approve(this.stakeManager.address, this.amount, {
        from: wallets[3].getAddressString()
      })
    }

    describe('Alice and Bob bid', function() {
      const Alice = wallets[3]
      const Bob = wallets[4]

      let aliceBidAmount = web3.utils.toWei('1200')
      let bobBidAmount = web3.utils.toWei('1250')

      before('deploy', doDeploy)
      before(async function() {
        await this.stakeToken.mint(Alice.getAddressString(), aliceBidAmount)
        await this.stakeToken.approve(this.stakeManager.address, aliceBidAmount, {
          from: Alice.getAddressString()
        })

        await this.stakeToken.mint(Bob.getAddressString(), bobBidAmount)
        await this.stakeToken.approve(this.stakeManager.address, bobBidAmount, {
          from: Bob.getAddressString()
        })

        this.userOldBalance = await this.stakeToken.balanceOf(Alice.getAddressString())
        this.bobOldBalance = await this.stakeToken.balanceOf(Bob.getAddressString())

        this.validatorId = '1'
        this.initialStakeAmount = initialStakeAmount
      })

      describe('when Alice bids', function() {
        testStartAuction(Alice.getChecksumAddressString(), Alice.getPrivateKeyString(), aliceBidAmount)
      })

      describe('when Bob bids', function() {
        testStartAuction(Bob.getChecksumAddressString(), Bob.getPublicKeyString(), bobBidAmount)

        it('Alice must get her bid back', async function() {
          const currentBalance = await this.stakeToken.balanceOf(Alice.getAddressString())
          assertBigNumberEquality(this.userOldBalance, currentBalance)
        })
      })
    })

    describe('reverts', function() {
      beforeEach('deploy', doDeploy)

      it('when bid during non-auction period', async function() {
        let auctionPeriod = await this.stakeManager.auctionPeriod()
        await this.stakeManager.advanceEpoch((auctionPeriod).toNumber())
        await expectRevert(this.stakeManager.startAuction(1, this.amount, false, wallets[3].getPrivateKeyString(), {
          from: wallets[3].getAddressString()
        }), 'Invalid auction period')
      })

      it('when trying to start and confirm in last epoch', async function() {
        this.validatorId = 1
        await this.stakeManager.advanceEpoch(1)
        await this.stakeManager.startAuction(this.validatorId, this.amount, false, wallets[3].getPublicKeyString(), {
          from: wallets[3].getAddressString()
        })
        await this.stakeToken.approve(this.stakeManager.address, web3.utils.toWei('1'), {
          from: wallets[3].getAddressString()
        })
        await expectRevert(this.stakeManager.confirmAuctionBid(
          this.validatorId,
          web3.utils.toWei('1'),
          {
            from: wallets[3].getAddressString()
          }
        ), 'Not allowed before auctionPeriod')
        await this.stakeManager.advanceEpoch(1)
        await this.stakeManager.confirmAuctionBid(
          this.validatorId,
          web3.utils.toWei('1'),
          {
            from: wallets[3].getAddressString()
          }
        )
        assert.ok(!(await this.stakeManager.isValidator(this.validatorId)))
      })

      it('when bid during replacement cooldown', async function() {
        await this.governance.update(
          this.stakeManager.address,
          this.stakeManager.contract.methods.updateDynastyValue('7').encodeABI()
        )

        await expectRevert(this.stakeManager.startAuction(1, this.amount, false, wallets[3].getPrivateKeyString(), {
          from: wallets[3].getAddressString()
        }), 'Cooldown period')
      })

      it('when bid on unstaking validator', async function() {
        await this.stakeManager.unstake(1, { from: _initialStakers[0].getAddressString() })
        await expectRevert(this.stakeManager.startAuction(1, this.amount, false, wallets[3].getPrivateKeyString(), {
          from: wallets[3].getAddressString()
        }), 'Invalid validator for an auction')
      })

      it('when restake on unstaking validator', async function() {
        await this.stakeManager.unstake(1, { from: _initialStakers[0].getAddressString() })
        await expectRevert(this.stakeManager.restake(1, this.amount, false, {
          from: _initialStakers[0].getAddressString()
        }), 'No restaking')
      })

      // since all the rewards are given in unstake already
      it('Must not transfer any rewards after unstaking', async function() {
        await this.stakeManager.unstake(1, { from: _initialStakers[0].getAddressString() })
        const receipt = await this.stakeManager.withdrawRewards(1, { from: _initialStakers[0].getAddressString() })
        await expectEvent.inTransaction(receipt.tx, StakingInfo, 'ClaimRewards', {
          validatorId: '1',
          amount: '0',
          totalAmount: await this.stakeManager.totalRewardsLiquidated()
        })
      })

      it('when validatorId is invalid', async function() {
        await expectRevert.unspecified(this.stakeManager.startAuction(0, this.amount, false, wallets[3].getPrivateKeyString(), {
          from: wallets[3].getAddressString()
        }))
      })

      it('when bid is too low', async function() {
        await expectRevert(this.stakeManager.startAuction(1, web3.utils.toWei('100'), false, wallets[3].getPrivateKeyString(), {
          from: wallets[3].getAddressString()
        }), 'Must bid higher')
      })
    })
  })

  describe('confirmAuctionBid', function() {
    const initialStakers = [wallets[1], wallets[2]]
    const bidAmount = new BN(web3.utils.toWei('1200'))
    const initialStakeAmount = web3.utils.toWei('200')

    function doDeploy(skipAuctionPeriod = true) {
      return async function() {
        await prepareForTest(8, 10).call(this)

        // cooldown period
        const replacementCooldown = await this.stakeManager.replacementCoolDown()
        await this.stakeManager.advanceEpoch(replacementCooldown)

        for (const wallet of initialStakers) {
          await approveAndStake.call(this, { wallet, stakeAmount: initialStakeAmount })
        }

        this.amount = web3.utils.toWei('500')
        await this.stakeToken.approve(this.stakeManager.address, this.amount, {
          from: wallets[3].getAddressString()
        })

        // bid
        const mintAmount = bidAmount.add(new BN(this.heimdallFee || this.defaultHeimdallFee))
        await this.stakeToken.mint(this.bidder, mintAmount)
        await this.stakeToken.approve(this.stakeManager.address, mintAmount, {
          from: this.bidder
        })

        this.bidderBalanceBeforeAuction = await this.stakeToken.balanceOf(this.bidder)
        this.totalStakedBeforeAuction = await this.stakeManager.totalStaked()

        await this.stakeManager.startAuction(this.validatorId, bidAmount, false, this.bidderPubKey, {
          from: this.bidder
        })

        if (skipAuctionPeriod) {
          const auction = await this.stakeManager.validatorAuction(this.validatorId)
          const currentEpoch = await this.stakeManager.currentEpoch()
          const dynasty = await this.stakeManager.dynasty()

          const end = auction.startEpoch.add(dynasty).toNumber()
          for (let i = currentEpoch.toNumber(); i <= end; i++) {
            await checkPoint(initialStakers, this.rootChainOwner, this.stakeManager)
          }
        }
      }
    }

    describe('when last auctioner is not validator', function() {
      const heimdallFee = web3.utils.toWei('100')

      function prepareToTest() {
        before(async function() {
          this.validatorId = '1'
          this.newValidatorId = '3'
          this.bidder = wallets[4].getChecksumAddressString()
          this.bidderPubKey = wallets[4].getPublicKeyString()
          this.heimdallFee = heimdallFee
          this.bidAmount = bidAmount
        })

        before(doDeploy())

        before(async function() {
          this.prevValidatorAddr = initialStakers[0].getChecksumAddressString()
          this.prevValidatorOldBalance = await this.stakeToken.balanceOf(this.prevValidatorAddr)

          this.validator = await this.stakeManager.validators(this.validatorId)
          this.reward = await this.stakeManager.validatorReward(this.validatorId)
        })
      }

      describe('when 0 dynasties has passed', function() {
        prepareToTest()
        testConfirmAuctionBidForNewValidator()
      })
      describe('when 1000 dynasties has passed', function() {
        prepareToTest()
        before(async function() {
          const currentDynasty = await this.stakeManager.dynasty()
          await this.stakeManager.advanceEpoch(currentDynasty.mul(new BN('1000')))
        })

        testConfirmAuctionBidForNewValidator()
      })
      describe('when validator has more stake then last bid', function() {
        prepareToTest()
        before(async function() {
          let restakeAmount = web3.utils.toWei('10000')
          await this.stakeToken.mint(this.prevValidatorAddr, restakeAmount)
          await this.stakeToken.approve(this.stakeManager.address, restakeAmount, {
            from: this.prevValidatorAddr
          })
          // restake
          await this.stakeManager.restake(this.validatorId, restakeAmount, false, {
            from: this.prevValidatorAddr
          })
          this.validator = await this.stakeManager.validators(this.validatorId)
        })

        testConfirmAuctionBidForOldValidator()
      })
    })

    describe('when auction period hasn\'t been passed after initial stake', function() {
      before(async function() {
        this.validatorId = '1'
        this.bidder = wallets[3].getChecksumAddressString()
        this.bidderPubKey = wallets[3].getPublicKeyString()
        this.bidAmount = bidAmount
      })

      beforeEach(doDeploy(false))

      describe('when 0 dynasties has passed', function() {
        it('reverts', async function() {
          await expectRevert(this.stakeManager.confirmAuctionBid(
            this.validatorId,
            this.defaultHeimdallFee,
            {
              from: this.bidder
            }
          ), 'Not allowed before auctionPeriod')
        })
      })

      describe('when 1000 dynasties has passed', function() {
        beforeEach(async function() {
          const currentDynasty = await this.stakeManager.dynasty()
          await this.stakeManager.advanceEpoch(currentDynasty.mul(new BN('1000')))
        })

        it('reverts', async function() {
          await expectRevert(this.stakeManager.confirmAuctionBid(
            this.validatorId,
            this.defaultHeimdallFee,
            {
              from: this.bidder
            }
          ), 'Not allowed before auctionPeriod')
        })
      })
    })

    describe('when from is not bidder', function() {
      before(async function() {
        this.validatorId = '1'
        this.bidder = wallets[3].getChecksumAddressString()
        this.bidderPubKey = wallets[3].getPublicKeyString()
        this.bidAmount = bidAmount
      })

      before(doDeploy())

      it('reverts', async function() {
        await expectRevert.unspecified(this.stakeManager.confirmAuctionBid(
          this.validatorId,
          0,
          {
            from: wallets[4].getChecksumAddressString()
          }
        ))
      })
    })
  })

  describe('auction with delegator, 3 validators initially', async function() {
    const initialStakers = [wallets[1], wallets[2]]
    const delegatedValidatorId = '3'
    const delegator = wallets[3].getChecksumAddressString()
    const validatorUser = wallets[4]
    const validatorUserAddr = wallets[4].getChecksumAddressString()
    const auctionValidatorAddr = wallets[5].getChecksumAddressString()
    const auctionValidatorPubKey = wallets[5].getPublicKeyString()
    const stakeAmount = web3.utils.toWei('1250')
    const bidAmount = web3.utils.toWei('2555')

    function doDeploy() {
      return async function() {
        await prepareForTest(8, 10).call(this)

        for (const wallet of initialStakers) {
          await approveAndStake.call(this, { wallet, stakeAmount })
        }
      }
    }

    before('fresh deploy', doDeploy())
    before(async function() {
      await this.stakeToken.mint(this.stakeManager.address, web3.utils.toWei('1000000'))// rewards amount

      await approveAndStake.call(this, { wallet: validatorUser, stakeAmount, acceptDelegation: true })

      let validator = await this.stakeManager.validators(delegatedValidatorId)

      this.validatorContract = await ValidatorShare.at(validator.contractAddress)

      await this.stakeToken.mint(delegator, stakeAmount)
      await this.stakeToken.approve(this.stakeManager.address, stakeAmount, {
        from: delegator
      })

      // cooldown period
      let auctionPeriod = (await this.stakeManager.auctionPeriod()).toNumber()
      let currentEpoch = (await this.stakeManager.currentEpoch()).toNumber()
      for (let i = currentEpoch; i <= auctionPeriod + (await this.stakeManager.dynasty()).toNumber(); i++) {
        await checkPoint([...initialStakers, validatorUser], this.rootChainOwner, this.stakeManager)
      }

      await buyVoucher(this.validatorContract, stakeAmount, delegator)

      this.heimdallFee = this.defaultHeimdallFee

      const approveAmount = new BN(bidAmount).add(this.heimdallFee)
      await this.stakeToken.mint(auctionValidatorAddr, approveAmount)
      await this.stakeToken.approve(this.stakeManager.address, approveAmount, {
        from: auctionValidatorAddr
      })

      this.totalStakedBeforeAuction = await this.stakeManager.totalStaked()
      this.bidderBalanceBeforeAuction = await this.stakeToken.balanceOf(auctionValidatorAddr)
    })

    describe('when new validator bids', function() {
      before(async function() {
        this.initialStakeAmount = stakeAmount
        this.validatorId = delegatedValidatorId
        this.userOldBalance = this.bidderBalanceBeforeAuction
      })

      after('skip auction', async function() {
        let auctionPeriod = (await this.stakeManager.auctionPeriod()).toNumber()
        for (let i = 0; i <= auctionPeriod; i++) {
          await checkPoint([...initialStakers, validatorUser], this.rootChainOwner, this.stakeManager)
        }
      })

      testStartAuction(auctionValidatorAddr, auctionValidatorPubKey, bidAmount)
    })

    describe('when new validator confirm auction', function() {
      before(async function() {
        this.validatorId = delegatedValidatorId
        this.bidderPubKey = auctionValidatorPubKey
        this.bidder = auctionValidatorAddr
        this.newValidatorId = '4'
        this.bidAmount = bidAmount
        this.prevValidatorAddr = validatorUserAddr
        this.prevValidatorOldBalance = await this.stakeToken.balanceOf(validatorUserAddr)
        this.validator = await this.stakeManager.validators(delegatedValidatorId)
        this.reward = await this.stakeManager.validatorReward(delegatedValidatorId)
      })

      testConfirmAuctionBidForNewValidator()
    })
  })

  describe('stopAuctions', function() {
    const initialStakers = [wallets[1], wallets[2]]
    const stakeAmount = web3.utils.toWei('1250')
    const bidAmount = web3.utils.toWei('1350')
    const bidder = wallets[3].getChecksumAddressString()
    const bidderPubKey = wallets[3].getPublicKeyString()

    async function doDeploy() {
      await prepareForTest(8, 10).call(this)

      for (const wallet of initialStakers) {
        await approveAndStake.call(this, { wallet, stakeAmount, approveAmount: web3.utils.toWei('12500') })
      }
    }

    before(doDeploy)
    before(async function() {
      this.initialStakeAmount = stakeAmount
      this.validatorId = '1'
      this.oldReplacementCoolDownPeriod = await this.stakeManager.replacementCoolDown()
      this.newReplacementCoolDownPeriod = new BN(100)
    })

    it('must increase replacement cooldown', async function() {
      await this.stakeManager.stopAuctions(this.newReplacementCoolDownPeriod.toString())
      const currentReplacementCooldown = await this.stakeManager.replacementCoolDown()
      assertBigNumberEquality(currentReplacementCooldown, this.newReplacementCoolDownPeriod.add(await this.stakeManager.epoch()))
    })

    it('bid must revert', async function() {
      await expectRevert(this.stakeManager.startAuction(this.validatorId, bidAmount, false, bidderPubKey, {
        from: bidder
      }), 'Cooldown period')
    })

    it('must reset replacement cooldown to current epoch', async function() {
      await this.stakeManager.stopAuctions(0)
      const currentReplacementCooldown = await this.stakeManager.replacementCoolDown()
      assertBigNumberEquality(currentReplacementCooldown, await this.stakeManager.epoch())
    })

    it('must bid', async function() {
      await this.stakeToken.mint(bidder, bidAmount)
      await this.stakeToken.approve(this.stakeManager.address, bidAmount, { from: bidder })
      await this.stakeManager.startAuction(this.validatorId, bidAmount, false, bidderPubKey, {
        from: bidder
      })
    })
  })

  describe('stake migration', function() {
    const initialStakers = [wallets[1], wallets[2], wallets[3], wallets[4], wallets[5], wallets[6], wallets[7], wallets[8], wallets[9]]
    const stakeAmount = web3.utils.toWei('1250')
    const stakeAmountBN = new BN(stakeAmount)
    const delegationAmount = web3.utils.toWei('150')
    const delegationAmountBN = new BN(delegationAmount)
    const migrationAmount = web3.utils.toWei('100')
    const migrationAmountBN = new BN(migrationAmount)

    async function prepareForTest() {
      await freshDeploy.call(this)
      await this.stakeManager.updateValidatorThreshold(10, {
        from: owner
      })
      for (const wallet of initialStakers) {
        await approveAndStake.call(this, { wallet, stakeAmount, acceptDelegation: true })
      }
    }

    describe('when Chad moves stake from unstaked validator', function() {
      const aliceId = '2'
      const bobId = '8'
      const delegator = wallets[9].getChecksumAddressString()
      let aliceContract

      before(prepareForTest)
      before(async function() {
        await this.stakeManager.updateDynastyValue(1)
        await this.stakeToken.mint(delegator, delegationAmount)
        await this.stakeToken.approve(this.stakeManager.address, delegationAmount, {
          from: delegator
        })

        const aliceValidator = await this.stakeManager.validators(aliceId)
        aliceContract = await ValidatorShare.at(aliceValidator.contractAddress)

        await buyVoucher(aliceContract, delegationAmount, delegator)

        await this.stakeManager.unstake(aliceId, { from: initialStakers[1].getChecksumAddressString() })
        await this.stakeManager.advanceEpoch(100)
        await this.stakeManager.unstakeClaim(aliceId, { from: initialStakers[1].getChecksumAddressString() })
      })

      it('Should migrate', async function() {
        await this.stakeManager.migrateDelegation(aliceId, bobId, migrationAmount, { from: delegator })
      })
    })

    describe('when Chad delegates to Alice then migrates partialy to Bob', async function() {
      const aliceId = '2'
      const bobId = '8'
      const delegator = wallets[9].getChecksumAddressString()
      let aliceContract

      before(prepareForTest)
      before(async function() {
        await this.stakeToken.mint(delegator, delegationAmount)
        await this.stakeToken.approve(this.stakeManager.address, delegationAmount, {
          from: delegator
        })

        const aliceValidator = await this.stakeManager.validators(aliceId)
        aliceContract = await ValidatorShare.at(aliceValidator.contractAddress)
      })

      describe('Chad delegates to Alice', async function() {
        it('Should delegate', async function() {
          this.receipt = await buyVoucher(aliceContract, delegationAmount, delegator)
        })

        it('ValidatorShare must mint correct amount of shares', async function() {
          await expectEvent.inTransaction(this.receipt.tx, ValidatorShare, 'Transfer', {
            from: ZeroAddr,
            to: delegator,
            value: delegationAmount
          })
        })

        it('must emit ShareMinted', async function() {
          await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'ShareMinted', {
            validatorId: aliceId,
            user: delegator,
            amount: delegationAmount,
            tokens: delegationAmount
          })
        })

        it('must emit StakeUpdate', async function() {
          await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'StakeUpdate', {
            validatorId: aliceId,
            newAmount: stakeAmountBN.add(delegationAmountBN).toString(10)
          })
        })

        it('Active amount must be updated', async function() {
          const validator = await this.stakeManager.validators(aliceId)
          assertBigNumberEquality(validator.delegatedAmount, delegationAmountBN)
        })
      })

      describe('Chad migrates delegation to Bob', async function() {
        it('Should migrate', async function() {
          this.receipt = await this.stakeManager.migrateDelegation(aliceId, bobId, migrationAmount, { from: delegator })
        })

        it('Alice\'s contract must burn correct amount of shares', async function() {
          await expectEvent.inTransaction(this.receipt.tx, ValidatorShare, 'Transfer', {
            from: delegator,
            to: ZeroAddr,
            value: migrationAmount
          })
        })

        it('Alice\'s contract must emit ShareBurned', async function() {
          await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'ShareBurned', {
            validatorId: aliceId,
            user: delegator,
            amount: migrationAmount,
            tokens: migrationAmount
          })
        })

        it('must emit StakeUpdate for Alice', async function() {
          await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'StakeUpdate', {
            validatorId: aliceId,
            newAmount: stakeAmountBN.add(delegationAmountBN).sub(migrationAmountBN).toString(10)
          })
        })

        it('Bob\'s contract must mint correct amount of shares', async function() {
          await expectEvent.inTransaction(this.receipt.tx, ValidatorShare, 'Transfer', {
            from: ZeroAddr,
            to: delegator,
            value: migrationAmount
          })
        })

        it('Bob\'s contract must emit ShareMinted', async function() {
          await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'ShareMinted', {
            validatorId: bobId,
            user: delegator,
            amount: migrationAmount,
            tokens: migrationAmount
          })
        })

        it('must emit StakeUpdate for Bob', async function() {
          await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'StakeUpdate', {
            validatorId: bobId,
            newAmount: stakeAmountBN.add(migrationAmountBN).toString(10)
          })
        })

        it('Alice active amount must be updated', async function() {
          const validator = await this.stakeManager.validators(aliceId)
          assertBigNumberEquality(validator.delegatedAmount, delegationAmountBN.sub(migrationAmountBN))
        })

        it('Bob active amount must be updated', async function() {
          const validator = await this.stakeManager.validators(bobId)
          assertBigNumberEquality(validator.delegatedAmount, migrationAmount)
        })
      })
    })

    describe('when Chad migrates to foundation validator', function() {
      const foundationNodeId = '2'
      const bobId = '8'
      const delegator = wallets[1].getChecksumAddressString()

      before(prepareForTest)
      before('delegate to Alice', async function() {
        await this.stakeToken.mint(delegator, delegationAmount)
        await this.stakeToken.approve(this.stakeManager.address, delegationAmount, {
          from: delegator
        })
        const nonFoundationValidator = await this.stakeManager.validators(bobId)
        const nonFoundationContract = await ValidatorShare.at(nonFoundationValidator.contractAddress)
        await buyVoucher(nonFoundationContract, delegationAmount, delegator)
      })

      it('Migration should fail', async function() {
        await expectRevert(
          this.stakeManager.migrateDelegation(bobId, foundationNodeId, migrationAmount, { from: delegator }),
          'Invalid migration')
      })
    })

    describe('when Chad migrates to matic validator', function() {
      const aliceId = '8'
      const bobId = '2'
      const delegator = wallets[9].getChecksumAddressString()

      before(prepareForTest)
      before('delegate to Alice', async function() {
        await this.stakeToken.mint(delegator, delegationAmount)
        await this.stakeToken.approve(this.stakeManager.address, delegationAmount, {
          from: delegator
        })
        const aliceValidator = await this.stakeManager.validators(aliceId)
        const aliceContract = await ValidatorShare.at(aliceValidator.contractAddress)
        await buyVoucher(aliceContract, delegationAmount, delegator)
      })

      it('Migration should fail', async function() {
        await expectRevert(
          this.stakeManager.migrateDelegation(aliceId, bobId, migrationAmount, { from: delegator }),
          'Invalid migration')
      })
    })

    describe('when Chad migrates with more tokens than his delegation amount', async function() {
      const aliceId = '2'
      const bobId = '8'
      const delegator = wallets[9].getChecksumAddressString()

      before(prepareForTest)
      before('delegate to Alice', async function() {
        await this.stakeToken.mint(delegator, delegationAmount)
        await this.stakeToken.approve(this.stakeManager.address, delegationAmount, {
          from: delegator
        })
        const aliceValidator = await this.stakeManager.validators(aliceId)
        const aliceContract = await ValidatorShare.at(aliceValidator.contractAddress)
        await buyVoucher(aliceContract, delegationAmount, delegator)
      })

      it('Migration should fail', async function() {
        await expectRevert(
          this.stakeManager.migrateDelegation(aliceId, bobId, migrationAmountBN.add(delegationAmountBN), { from: delegator }),
          'Migrating too much')
      })
    })
  })
})
