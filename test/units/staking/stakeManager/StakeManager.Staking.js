import { StakingInfo, TestToken, ValidatorShare } from '../../../helpers/artifacts'

import {
  checkPoint,
  assertBigNumberEquality
} from '../../../helpers/utils.js'
import { expectEvent, expectRevert, BN } from '@openzeppelin/test-helpers'
import { wallets, walletAmounts, freshDeploy, approveAndStake } from '../deployment'

module.exports = function(accounts) {
  let owner = accounts[0]

  function doStake(wallet, { aproveAmount, stakeAmount, noMinting = false, signer } = {}) {
    return async function() {
      let user = wallet.getAddressString()

      let _aproveAmount = aproveAmount || walletAmounts[user].amount
      let _stakeAmount = stakeAmount || walletAmounts[user].stakeAmount

      await approveAndStake.call(this, { wallet, stakeAmount: _stakeAmount, approveAmount: _aproveAmount, noMinting, signer })
    }
  }

  function doUnstake(wallet) {
    return async function() {
      let user = wallet.getAddressString()

      const validatorId = await this.stakeManager.getValidatorId(user)
      await this.stakeManager.unstake(validatorId, {
        from: user
      })
    }
  }

  function prepareForTest(dynastyValue, validatorThreshold) {
    return async function() {
      await freshDeploy.call(this)

      await this.governance.update(
        this.stakeManager.address,
        this.stakeManager.contract.methods.updateValidatorThreshold(validatorThreshold).encodeABI()
      )

      await this.governance.update(
        this.stakeManager.address,
        this.stakeManager.contract.methods.updateDynastyValue(dynastyValue).encodeABI()
      )
    }
  }

  describe('stake', function() {
    function testStakeRevert(user, userPubkey, amount, stakeAmount, unspecified = false) {
      before('Approve', async function() {
        this.initialBalance = await this.stakeManager.totalStakedFor(user)

        await this.stakeToken.approve(this.stakeManager.address, new BN(amount).add(this.defaultHeimdallFee), {
          from: user
        })
      })

      it('must revert', async function() {
        if (unspecified) {
          await expectRevert.unspecified(this.stakeManager.stakeFor(user, stakeAmount, this.defaultHeimdallFee, false, userPubkey, {
            from: user
          }))
        } else {
          await expectRevert(this.stakeManager.stakeFor(user, stakeAmount, this.defaultHeimdallFee, false, userPubkey, {
            from: user
          }), 'Invalid signer')
        }
      })

      it('must have unchanged staked balance', async function() {
        const stakedFor = await this.stakeManager.totalStakedFor(user)
        assertBigNumberEquality(stakedFor, this.initialBalance)
      })
    }

    function testStake(user, userPubkey, amount, stakeAmount, validatorId, fee) {
      before('Approve', async function() {
        this.user = user
        this.fee = new BN(fee || this.defaultHeimdallFee)

        await this.stakeToken.approve(this.stakeManager.address, new BN(amount).add(this.fee), {
          from: user
        })
      })

      it('must stake', async function() {
        this.receipt = await this.stakeManager.stakeFor(user, stakeAmount, this.fee, false, userPubkey, {
          from: user
        })
      })

      it('must emit Staked', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'Staked', {
          signerPubkey: userPubkey,
          signer: user,
          amount: stakeAmount
        })
      })

      if (fee) {
        it('must emit TopUpFee', async function() {
          await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'TopUpFee', {
            user: user,
            fee: this.fee
          })
        })
      }

      it(`must have correct staked amount`, async function() {
        const stakedFor = await this.stakeManager.totalStakedFor(user)
        assertBigNumberEquality(stakedFor, stakeAmount)
      })

      it('must have correct total staked balance', async function() {
        const stake = await this.stakeManager.currentValidatorSetTotalStake()
        assertBigNumberEquality(stake, stakeAmount)
      })

      it(`must have validatorId == ${validatorId}`, async function() {
        const _validatorId = await this.stakeManager.getValidatorId(user)
        _validatorId.toString().should.be.equal(validatorId.toString())
      })

      it('must have valid validatorId', async function() {
        const validatorId = await this.stakeManager.getValidatorId(user)
        const value = await this.stakeManager.isValidator(validatorId.toString())
        assert.isTrue(value)
      })
    }

    function testRestake(user, amount, stakeAmount, restakeAmount, totalStaked) {
      before('Approve', async function() {
        this.user = user

        await this.stakeToken.approve(this.stakeManager.address, amount, {
          from: user
        })
      })

      it('must restake', async function() {
        const validatorId = await this.stakeManager.getValidatorId(this.user)
        this.receipt = await this.stakeManager.restake(validatorId, restakeAmount, false, {
          from: this.user
        })
      })

      it('must emit StakeUpdate', async function() {
        const validatorId = await this.stakeManager.getValidatorId(this.user)
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'StakeUpdate', {
          validatorId
        })
      })

      it('must emit Restaked', async function() {
        const validatorId = await this.stakeManager.getValidatorId(this.user)
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'Restaked', {
          validatorId,
          amount: stakeAmount,
          total: totalStaked
        })
      })

      it(`must have correct total staked amount`, async function() {
        const stakedFor = await this.stakeManager.totalStakedFor(user)
        assertBigNumberEquality(stakedFor, stakeAmount)
      })
    }

    describe('double stake', async function() {
      before(freshDeploy)

      describe('when stakes first time', function() {
        const amounts = walletAmounts[wallets[1].getAddressString()]
        testStake(
          wallets[1].getChecksumAddressString(),
          wallets[1].getPublicKeyString(),
          amounts.amount,
          amounts.stakeAmount,
          1
        )
      })

      describe('when stakes again', function() {
        testStakeRevert(
          wallets[1].getChecksumAddressString(),
          wallets[1].getPublicKeyString(),
          web3.utils.toWei('200'),
          web3.utils.toWei('200')
        )
      })
    })

    describe('stake and restake following by another stake', function() {
      before(freshDeploy)

      const amounts = walletAmounts[wallets[2].getAddressString()]
      before('Stake', doStake(wallets[2]))

      describe('when restakes', function() {
        testRestake(
          wallets[2].getChecksumAddressString(),
          amounts.restakeAmonut,
          amounts.amount,
          amounts.restakeAmonut,
          amounts.amount
        )
      })

      describe('when stakes again', function() {
        testStakeRevert(
          wallets[2].getChecksumAddressString(),
          wallets[2].getPublicKeyString(),
          web3.utils.toWei('250'),
          web3.utils.toWei('150')
        )
      })
      describe('when reStakes while on going auction', function() {
        it('when auction is active', async function() {
          let auctionBid = web3.utils.toWei('10000')
          const auctionUser = wallets[4].getAddressString()
          await this.stakeToken.mint(auctionUser, auctionBid)
          await this.stakeToken.approve(this.stakeManager.address, auctionBid, {
            from: auctionUser
          })
          const validatorId = await this.stakeManager.getValidatorId(wallets[2].getChecksumAddressString())
          await this.stakeManager.startAuction(validatorId, auctionBid, false, wallets[4].getPublicKeyString(), {
            from: auctionUser
          })
          testRestake(
            wallets[2].getChecksumAddressString(),
            amounts.restakeAmonut,
            amounts.amount,
            amounts.restakeAmonut,
            amounts.amount
          )
        })
      })
    })

    describe('stake beyond validator threshold', async function() {
      before(prepareForTest(2, 1))

      describe('when user stakes', function() {
        const amounts = walletAmounts[wallets[3].getAddressString()]
        testStake(
          wallets[3].getChecksumAddressString(),
          wallets[3].getPublicKeyString(),
          amounts.amount,
          amounts.stakeAmount,
          1
        )
      })

      describe('when other user stakes beyond validator threshold', function() {
        testStakeRevert(
          wallets[4].getChecksumAddressString(),
          wallets[4].getPublicKeyString(),
          web3.utils.toWei('100'),
          web3.utils.toWei('100'),
          true
        )
      })
    })

    describe('consecutive stakes', function() {
      before(freshDeploy)

      it('validatorId must increment 1 by 1', async function() {
        const _wallets = [wallets[1], wallets[2], wallets[3]]
        let expectedValidatorId = 1
        for (const wallet of _wallets) {
          await doStake(wallet, { approveAmount: web3.utils.toWei('100'), stakeAmount: web3.utils.toWei('100') }).call(this)

          const validatorId = await this.stakeManager.getValidatorId(wallet.getAddressString())
          assertBigNumberEquality(expectedValidatorId, validatorId)
          expectedValidatorId++
        }
      })
    })

    describe('stake with heimdall fee', function() {
      before(freshDeploy)

      testStake(
        wallets[0].getChecksumAddressString(),
        wallets[0].getPublicKeyString(),
        web3.utils.toWei('200'),
        web3.utils.toWei('150'),
        1,
        web3.utils.toWei('50')
      )
    })

    describe('when Alice stakes, change signer and stakes with old signer', function() {
      const AliceWallet = wallets[1]
      const newSigner = wallets[2].getPublicKeyString()

      before(freshDeploy)
      before(doStake(AliceWallet))
      before('Change signer', async function() {
        const signerUpdateLimit = await this.stakeManager.signerUpdateLimit()
        await this.stakeManager.advanceEpoch(signerUpdateLimit)

        this.validatorId = await this.stakeManager.getValidatorId(AliceWallet.getAddressString())
        await this.stakeManager.updateSigner(this.validatorId, newSigner, {
          from: AliceWallet.getAddressString()
        })
      })

      it('reverts', async function() {
        await expectRevert(doStake(wallets[3], { signer: AliceWallet.getPublicKeyString() }).call(this), 'Invalid signer')
      })
    })
  })

  describe('unstake', function() {
    describe('when user unstakes right after stake', async function() {
      const user = wallets[2].getChecksumAddressString()
      const amounts = walletAmounts[wallets[2].getAddressString()]

      before('Fresh deploy', prepareForTest(2, 3))
      before(doStake(wallets[2]))
      before(async function() {
        this.validatorId = await this.stakeManager.getValidatorId(user)

        const reward = await this.stakeManager.validatorReward(this.validatorId)
        this.reward = reward
        this.afterStakeBalance = await this.stakeToken.balanceOf(user)
      })

      it('must unstake', async function() {
        this.receipt = await this.stakeManager.unstake(this.validatorId, {
          from: user
        })
      })

      it('must emit UnstakeInit', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'UnstakeInit', {
          amount: amounts.stakeAmount,
          validatorId: this.validatorId,
          user
        })
      })

      it('must emit ClaimRewards', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'ClaimRewards', {
          validatorId: this.validatorId,
          amount: '0',
          totalAmount: '0'
        })
      })

      it('must emit Transfer', async function() {
        await expectEvent.inTransaction(this.receipt.tx, TestToken, 'Transfer', {
          value: this.reward,
          to: user
        })
      })

      it('must have increased balance by reward', async function() {
        const balance = await this.stakeToken.balanceOf(user)
        assertBigNumberEquality(balance, this.afterStakeBalance.add(this.reward))
      })
    })

    describe('when user unstakes after 2 epochs', async function() {
      before('Fresh deploy', prepareForTest(2, 3))

      const user = wallets[3].getChecksumAddressString()
      const amounts = walletAmounts[wallets[3].getAddressString()]

      before(doStake(wallets[3]))
      before(async function() {
        this.validatorId = await this.stakeManager.getValidatorId(user)
        this.afterStakeBalance = await this.stakeToken.balanceOf(user)
      })

      before(async function() {
        const w = [wallets[3]]
        await checkPoint(w, this.rootChainOwner, this.stakeManager)
        await checkPoint(w, this.rootChainOwner, this.stakeManager)

        this.reward = await this.stakeManager.validatorReward(this.validatorId)
      })

      it('must unstake', async function() {
        const validatorId = await this.stakeManager.getValidatorId(user)
        this.receipt = await this.stakeManager.unstake(validatorId, {
          from: user
        })
      })

      it('must emit UnstakeInit', async function() {
        const validatorId = await this.stakeManager.getValidatorId(user)
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'UnstakeInit', {
          amount: amounts.amount,
          validatorId,
          user
        })
      })

      it('must emit ClaimRewards', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'ClaimRewards', {
          validatorId: this.validatorId,
          amount: this.reward,
          totalAmount: this.reward
        })
      })

      it('must emit Transfer', async function() {
        await expectEvent.inTransaction(this.receipt.tx, TestToken, 'Transfer', {
          value: this.reward,
          to: user
        })
      })

      it('must have increased balance by reward', async function() {
        const balance = await this.stakeToken.balanceOf(user)
        assertBigNumberEquality(balance, this.afterStakeBalance.add(this.reward))
      })
    })

    describe('reverts', function() {
      beforeEach('Fresh Deploy', freshDeploy)
      const user = wallets[2].getChecksumAddressString()

      beforeEach(doStake(wallets[2]))

      it('when validatorId is invalid', async function() {
        await expectRevert.unspecified(this.stakeManager.unstake('999999', {
          from: user
        }))
      })

      it('when user is not staker', async function() {
        const validatorId = await this.stakeManager.getValidatorId(user)
        await expectRevert.unspecified(this.stakeManager.unstake(validatorId, {
          from: wallets[3].getAddressString()
        }))
      })

      it('when unstakes 2 times', async function() {
        const validatorId = await this.stakeManager.getValidatorId(user)
        await this.stakeManager.unstake(validatorId, {
          from: user
        })

        await expectRevert.unspecified(this.stakeManager.unstake(validatorId, {
          from: user
        }))
      })

      it('when unstakes during auction', async function() {
        const amount = web3.utils.toWei('1200')
        const auctionUser = wallets[4].getAddressString()
        await this.stakeToken.mint(auctionUser, amount)

        await this.stakeToken.approve(this.stakeManager.address, amount, {
          from: auctionUser
        })
        const validatorId = await this.stakeManager.getValidatorId(user)
        await this.stakeManager.startAuction(validatorId, amount, false, wallets[4].getPublicKeyString(), {
          from: auctionUser
        })
        await expectRevert.unspecified(this.stakeManager.unstake(validatorId, {
          from: user
        }))
      })
    })
  })

  describe('unstakeClaim', function() {
    describe('when user claims right after stake', function() {
      before('Fresh Deploy', prepareForTest(1, 10))
      before('Stake', doStake(wallets[2]))
      before('Unstake', doUnstake(wallets[2]))

      const user = wallets[2].getAddressString()

      it('must revert', async function() {
        const ValidatorId = await this.stakeManager.getValidatorId(user)
        await expectRevert.unspecified(this.stakeManager.unstakeClaim(ValidatorId, {
          from: user
        }))
      })
    })

    describe('when user claims after 1 epoch and 1 dynasty passed', function() {
      let dynasties = 1
      const Alice = wallets[2].getChecksumAddressString()

      before('Fresh Deploy', prepareForTest(dynasties, 10))
      before('Alice Stake', doStake(wallets[2]))
      before('Bob Stake', doStake(wallets[3]))
      before('Alice Unstake', doUnstake(wallets[2]))

      before('Checkpoint', async function() {
        this.validatorId = await this.stakeManager.getValidatorId(Alice)
        this.aliceStakeAmount = await this.stakeManager.validatorStake(this.validatorId)

        await checkPoint([wallets[3], wallets[2]], this.rootChainOwner, this.stakeManager)

        while (dynasties-- > 0) {
          await checkPoint([wallets[3]], this.rootChainOwner, this.stakeManager)
        }
      })

      it('must claim', async function() {
        this.receipt = await this.stakeManager.unstakeClaim(this.validatorId, {
          from: Alice
        })
      })

      it('must emit Unstaked', async function() {
        const stake = await this.stakeManager.currentValidatorSetTotalStake()
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'Unstaked', {
          user: Alice,
          validatorId: this.validatorId,
          amount: this.aliceStakeAmount,
          total: stake
        })
      })

      it('must have correct staked balance', async function() {
        const stake = await this.stakeManager.currentValidatorSetTotalStake()
        assertBigNumberEquality(stake, walletAmounts[wallets[3].getAddressString()].stakeAmount)
      })
    })

    describe('when user claims next epoch', function() {
      before('Fresh Deploy', prepareForTest(1, 10))

      before('Alice Stake', doStake(wallets[2]))
      before('Bob Stake', doStake(wallets[3]))

      before('Alice Unstake', doUnstake(wallets[2]))

      before('Checkpoint', async function() {
        await checkPoint([wallets[3], wallets[2]], this.rootChainOwner, this.stakeManager)
      })

      const user = wallets[2].getAddressString()

      it('must revert', async function() {
        const validatorId = await this.stakeManager.getValidatorId(user)
        await expectRevert.unspecified(this.stakeManager.unstakeClaim(validatorId, {
          from: user
        }))
      })
    })

    describe('when user claims before 1 dynasty passed', function() {
      before('Fresh Deploy', prepareForTest(2, 10))

      before('Alice Stake', doStake(wallets[2]))
      before('Bob Stake', doStake(wallets[3]))

      before('Alice Unstake', doUnstake(wallets[2]))

      before('Checkpoint', async function() {
        await checkPoint([wallets[3], wallets[2]], this.rootChainOwner, this.stakeManager)
      })

      const user = wallets[2].getAddressString()

      it('must revert', async function() {
        const validatorId = await this.stakeManager.getValidatorId(user)
        await expectRevert.unspecified(this.stakeManager.unstakeClaim(validatorId, {
          from: user
        }))
      })
    })

    describe('when Alice, Bob and Eve stake, but Alice and Bob claim after 1 epoch and 1 dynasty passed', function() {
      before(prepareForTest(1, 10))

      const Alice = wallets[2]
      const Bob = wallets[3]
      const Eve = wallets[4]
      const stakeAmount = web3.utils.toWei('100')

      before('Alice stake', doStake(Alice, { noMinting: true, stakeAmount }))
      before('Bob stake', doStake(Bob, { noMinting: true, stakeAmount }))
      before('Eve stake', doStake(Eve, { noMinting: true, stakeAmount }))

      before('Alice unstake', doUnstake(Alice))
      before('Bob unstake', doUnstake(Bob))

      before('Checkpoint', async function() {
        await checkPoint([Eve, Bob, Alice], this.rootChainOwner, this.stakeManager)
        await checkPoint([Eve], this.rootChainOwner, this.stakeManager)
      })

      describe('when Alice claims', function() {
        const user = Alice.getAddressString()

        it('must claim', async function() {
          this.validatorId = await this.stakeManager.getValidatorId(user)
          this.reward = await this.stakeManager.validatorReward(this.validatorId)
          this.receipt = await this.stakeManager.unstakeClaim(this.validatorId, {
            from: user
          })
        })

        it('must have correct reward', async function() {
          assertBigNumberEquality(this.reward, web3.utils.toWei('3000'))
        })

        it('must emit ClaimRewards', async function() {
          await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'ClaimRewards', {
            validatorId: this.validatorId,
            amount: web3.utils.toWei('3000'),
            totalAmount: await this.stakeManager.totalRewardsLiquidated()
          })
        })

        it('must have pre-stake + reward - heimdall fee balance', async function() {
          let balance = await this.stakeToken.balanceOf(user)
          assertBigNumberEquality(balance, new BN(walletAmounts[user].initialBalance).add(this.reward).sub(this.defaultHeimdallFee))
        })
      })

      describe('when Bob claims', function() {
        const user = Bob.getAddressString()

        it('must claim', async function() {
          this.validatorId = await this.stakeManager.getValidatorId(user)
          this.reward = await this.stakeManager.validatorReward(this.validatorId)
          this.receipt = await this.stakeManager.unstakeClaim(this.validatorId, {
            from: user
          })
        })

        it('must have correct reward', async function() {
          assertBigNumberEquality(this.reward, web3.utils.toWei('3000'))
        })

        it('must emit ClaimRewards', async function() {
          await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'ClaimRewards', {
            validatorId: this.validatorId,
            amount: web3.utils.toWei('3000'),
            totalAmount: await this.stakeManager.totalRewardsLiquidated()
          })
        })

        it('must have pre-stake + reward - heimdall fee balance', async function() {
          let balance = await this.stakeToken.balanceOf(user)
          assertBigNumberEquality(balance, new BN(walletAmounts[user].initialBalance).add(this.reward).sub(this.defaultHeimdallFee))
        })
      })

      describe('afterwards verification', function() {
        it('must have corect number of validators', async function() {
          const validatorCount = await this.stakeManager.currentValidatorSetSize()
          assertBigNumberEquality(validatorCount, '1')
        })

        it('staked balance must have only Eve balance', async function() {
          const stake = await this.stakeManager.currentValidatorSetTotalStake()
          assertBigNumberEquality(stake, stakeAmount)
        })

        it('Eve must have correct rewards', async function() {
          const validatorId = await this.stakeManager.getValidatorId(Eve.getAddressString())
          this.reward = await this.stakeManager.validatorReward(validatorId)
          assertBigNumberEquality(this.reward, web3.utils.toWei('12000'))
        })
      })
    })
  })

  describe('restake', function() {
    const initialStake = web3.utils.toWei('1000')
    const initialStakers = [wallets[0], wallets[1]]

    function doDeploy(acceptDelegation) {
      return async function() {
        await prepareForTest(8, 8).call(this)

        const checkpointReward = new BN(web3.utils.toWei('10000'))

        await this.governance.update(
          this.stakeManager.address,
          this.stakeManager.contract.methods.updateCheckpointReward(checkpointReward.toString()).encodeABI()
        )

        await this.governance.update(
          this.stakeManager.address,
          this.stakeManager.contract.methods.updateCheckPointBlockInterval(1).encodeABI()
        )

        const proposerBonus = 10
        await this.stakeManager.updateProposerBonus(proposerBonus)

        for (const wallet of initialStakers) {
          await approveAndStake.call(this, { wallet, stakeAmount: initialStake, acceptDelegation })
        }

        // cooldown period
        let auctionPeriod = (await this.stakeManager.auctionPeriod()).toNumber()
        let currentEpoch = (await this.stakeManager.currentEpoch()).toNumber()

        for (let i = currentEpoch; i <= auctionPeriod; i++) {
          await checkPoint(initialStakers, this.rootChainOwner, this.stakeManager)
        }
        // without 10% proposer bonus
        this.validatorReward = checkpointReward.mul(new BN(100 - proposerBonus)).div(new BN(100)).mul(new BN(auctionPeriod - currentEpoch))
        this.validatorId = '1'
        this.user = initialStakers[0].getAddressString()
        this.amount = web3.utils.toWei('100')

        await this.stakeToken.mint(this.user, this.amount)
        await this.stakeToken.approve(this.stakeManager.address, this.amount, {
          from: this.user
        })
      }
    }

    function testRestake(withDelegation, withRewards) {
      before(doDeploy(withDelegation))

      before(async function() {
        this.oldTotalStaked = await this.stakeManager.totalStaked()
        this.validatorOldState = await this.stakeManager.validators(this.validatorId)

        if (!withRewards) {
          this.validatorReward = new BN(0)
          this.oldReward = await this.stakeManager.validatorReward(this.validatorId)
        }
      })

      it('must restake rewards', async function() {
        this.receipt = await this.stakeManager.restake(this.validatorId, this.amount, withRewards, {
          from: this.user
        })
      })

      it('must emit StakeUpdate', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'StakeUpdate', {
          validatorId: this.validatorId,
          newAmount: this.validatorOldState.amount.add(new BN(this.amount)).add(this.validatorReward)
        })
      })

      it('must emit Restaked', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'Restaked', {
          validatorId: this.validatorId,
          amount: this.validatorOldState.amount.add(new BN(this.amount)).add(this.validatorReward),
          total: this.oldTotalStaked.add(new BN(this.amount)).add(this.validatorReward)
        })
      })

      if (withRewards) {
        it('validator rewards must be 0', async function() {
          const reward = await this.stakeManager.validatorReward(this.validatorId)

          assertBigNumberEquality(reward, 0)
        })
      } else {
        it('validator rewards must be untouched', async function() {
          const reward = await this.stakeManager.validatorReward(this.validatorId)

          assertBigNumberEquality(reward, this.oldReward)
        })
      }
    }

    describe('with delegation', function() {
      describe('with rewards', function() {
        testRestake(true, true)
      })

      describe('without rewards', function() {
        testRestake(true, false)
      })
    })

    describe('without delegation', function() {
      describe('with rewards', function() {
        testRestake(false, true)
      })

      describe('without rewards', function() {
        testRestake(false, false)
      })
    })

    describe('reverts', function() {
      before(doDeploy(false))

      it('when validatorId is incorrect', async function() {
        await expectRevert.unspecified(this.stakeManager.restake('0', this.amount, false, {
          from: this.user
        }))
      })

      it('when restake after unstake during same epoch', async function() {
        await this.stakeManager.unstake(this.validatorId)
        await expectRevert(this.stakeManager.restake(this.validatorId, this.amount, false, {
          from: this.user
        }), 'No restaking')
      })
    })
  })
}
