import { StakingInfo, DummyERC20, ValidatorShare } from '../../../helpers/artifacts'

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
          await expectRevert.unspecified(this.stakeManager.stake(stakeAmount, this.defaultHeimdallFee, false, userPubkey, {
            from: user
          }))
        } else {
          await expectRevert(this.stakeManager.stake(stakeAmount, this.defaultHeimdallFee, false, userPubkey, {
            from: user
          }), 'Invalid Signer key')
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
        this.receipt = await this.stakeManager.stake(stakeAmount, this.fee, false, userPubkey, {
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
            validatorId: validatorId.toString(),
            signer: user,
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

      it('must emit ReStaked', async function() {
        const validatorId = await this.stakeManager.getValidatorId(this.user)
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'ReStaked', {
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
    })

    describe('stake beyond validator threshold', async function() {
      before(freshDeploy)
      before('Validator threshold and dynasty', async function() {
        await this.stakeManager.updateValidatorThreshold(1, {
          from: owner
        })

        await this.stakeManager.updateDynastyValue(2, {
          from: owner
        })
      })

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
        await expectRevert(doStake(wallets[3], { signer: AliceWallet.getPublicKeyString() }).call(this), 'Invalid Signer key')
      })
    })
  })

  describe('unstake', function() {
    describe('when user unstakes right after stake', async function() {
      const user = wallets[2].getChecksumAddressString()
      const amounts = walletAmounts[wallets[2].getAddressString()]

      before('Fresh deploy', freshDeploy)
      before('Validator threshold and dynasty', async function() {
        await this.stakeManager.updateValidatorThreshold(3, {
          from: owner
        })

        await this.stakeManager.updateDynastyValue(2, {
          from: owner
        })
      })

      before(doStake(wallets[2]))
      before(async function() {
        this.validatorId = await this.stakeManager.getValidatorId(user)

        const validator = await this.stakeManager.validators(this.validatorId)
        this.reward = validator.reward
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

      // for some reason DummyERC20 doesn't have Transfer event

      // it('must emit Transfer', async function() {
      //   await expectEvent.inTransaction(this.receipt.tx, DummyERC20, 'Transfer', {
      //     value: this.reward,
      //     to: user
      //   })
      // })

      it('must have increased balance by reward', async function() {
        const balance = await this.stakeToken.balanceOf(user)
        assertBigNumberEquality(balance, this.afterStakeBalance.add(this.reward))
      })
    })

    describe('when user unstakes after 2 epochs', async function() {
      before('Fresh deploy', freshDeploy)
      before('Validator threshold and dynasty', async function() {
        await this.stakeManager.updateValidatorThreshold(3, {
          from: owner
        })

        await this.stakeManager.updateDynastyValue(2, {
          from: owner
        })
      })

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

        const validator = await this.stakeManager.validators(this.validatorId)
        this.reward = validator.reward
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

      // for some reason DummyERC20 doesn't have Transfer event

      // it('must emit Transfer', async function() {
      //   await expectEvent.inTransaction(this.receipt.tx, DummyERC20, 'Transfer', {
      //     value: this.reward,
      //     to: user
      //   })
      // })

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
        await this.stakeToken.mint(user, amount)

        await this.stakeToken.approve(this.stakeManager.address, amount, {
          from: user
        })

        const validatorId = await this.stakeManager.getValidatorId(user)
        await this.stakeManager.startAuction(validatorId, amount, {
          from: user
        })

        await expectRevert.unspecified(this.stakeManager.unstake(validatorId, {
          from: user
        }))
      })
    })
  })

  describe('unstakeClaim', function() {
    describe('when user claims right after stake', function() {
      before('Fresh Deploy', freshDeploy)
      before('Validator dynasty', async function() {
        await this.stakeManager.updateDynastyValue(1, {
          from: owner
        })
      })
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
      before('Fresh Deploy', freshDeploy)

      let dynasties = 1

      before('Validator dynasty', async function() {
        await this.stakeManager.updateDynastyValue(dynasties, {
          from: owner
        })
      })

      before('Alice Stake', doStake(wallets[2]))
      before('Bob Stake', doStake(wallets[3]))
      before('Alice Unstake', doUnstake(wallets[2]))

      before('Checkpoint', async function() {
        await checkPoint([wallets[3]], this.rootChainOwner, this.stakeManager)
        while (dynasties-- > 0) {
          await checkPoint([wallets[3]], this.rootChainOwner, this.stakeManager)
        }
      })

      const user = wallets[2].getAddressString()

      it('must claim', async function() {
        const validatorId = await this.stakeManager.getValidatorId(user)
        this.receipt = await this.stakeManager.unstakeClaim(validatorId, {
          from: user
        })
      })

      it('must have correct staked balance', async function() {
        const stake = await this.stakeManager.currentValidatorSetTotalStake()
        assertBigNumberEquality(stake, walletAmounts[wallets[3].getAddressString()].stakeAmount)
      })
    })

    describe('when user claims next epoch', function() {
      before('Fresh Deploy', freshDeploy)
      before('Validator dynasty', async function() {
        await this.stakeManager.updateDynastyValue(1, {
          from: owner
        })
      })

      before('Alice Stake', doStake(wallets[2]))
      before('Bob Stake', doStake(wallets[3]))

      before('Alice Unstake', doUnstake(wallets[2]))

      before('Checkpoint', async function() {
        await checkPoint([wallets[3]], this.rootChainOwner, this.stakeManager)
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
      before('Fresh Deploy', freshDeploy)
      before('Validator dynasty', async function() {
        await this.stakeManager.updateDynastyValue(2, {
          from: owner
        })
      })

      before('Alice Stake', doStake(wallets[2]))
      before('Bob Stake', doStake(wallets[3]))

      before('Alice Unstake', doUnstake(wallets[2]))

      before('Checkpoint', async function() {
        await checkPoint([wallets[3]], this.rootChainOwner, this.stakeManager)
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
      before(freshDeploy)
      before('Validator dynasty', async function() {
        await this.stakeManager.updateDynastyValue(1, {
          from: owner
        })
      })

      const Alice = wallets[2]
      const Bob = wallets[3]
      const Eve = wallets[1]

      before('Alice stake', doStake(Alice, { noMinting: true }))
      before('Bob stake', doStake(Bob, { noMinting: true }))
      before('Eve stake', doStake(Eve, { noMinting: true }))

      before('Alice unstake', doUnstake(Alice))
      before('Bob unstake', doUnstake(Bob))

      before('Checkpoint', async function() {
        const w = [Eve]

        await checkPoint(w, this.rootChainOwner, this.stakeManager)
        await checkPoint(w, this.rootChainOwner, this.stakeManager)
      })

      describe('when Alice claims', function() {
        const user = Alice.getAddressString()

        it('must claim', async function() {
          const validatorId = await this.stakeManager.getValidatorId(user)
          const { reward } = await this.stakeManager.validators(validatorId)
          this.reward = reward

          await this.stakeManager.unstakeClaim(validatorId, {
            from: user
          })
        })

        it('must have pre-stake + reward - heimdall fee balance', async function() {
          let balance = await this.stakeToken.balanceOf(user)

          assertBigNumberEquality(balance, new BN(walletAmounts[user].initialBalance.toString()).add(this.reward).sub(this.defaultHeimdallFee))
        })
      })

      describe('when Bob claims', function() {
        const user = Bob.getAddressString()

        it('must claim', async function() {
          const validatorId = await this.stakeManager.getValidatorId(user)
          const { reward } = await this.stakeManager.validators(validatorId)
          this.reward = reward

          await this.stakeManager.unstakeClaim(validatorId, {
            from: user
          })
        })

        it('must have pre-stake + reward - heimdall fee balance', async function() {
          let balance = await this.stakeToken.balanceOf(user)

          assertBigNumberEquality(balance, new BN(walletAmounts[user].initialBalance).add(this.reward).sub(this.defaultHeimdallFee))
        })
      })

      describe('afterwards verification', function() {
        it('must have corect number of validators', async function() {
          const validators = await this.stakeManager.getCurrentValidatorSet()
          validators.should.have.lengthOf(1)
        })

        it('staked balance must have only Eve balance', async function() {
          const amount = walletAmounts[Eve.getAddressString()].stakeAmount
          const stake = await this.stakeManager.currentValidatorSetTotalStake()
          assertBigNumberEquality(stake, amount)
        })
      })
    })
  })

  describe('restake', function() {
    const initialStake = web3.utils.toWei('1000')
    const initialStakers = [wallets[0], wallets[1]]

    function doDeploy(acceptDelegation) {
      return async function() {
        await freshDeploy.call(this)

        const checkpointReward = new BN(web3.utils.toWei('10000'))

        await this.stakeManager.updateCheckpointReward(checkpointReward)
        await this.stakeManager.updateDynastyValue(8)
        await this.stakeManager.updateCheckPointBlockInterval(1)

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

          let reward = this.validatorOldState.reward

          if (this.validatorOldState.contractAddress !== '0x0000000000000000000000000000000000000000') {
            let validatorContract = await ValidatorShare.at(this.validatorOldState.contractAddress)
            reward = await validatorContract.validatorRewards()
          }

          this.oldReward = reward
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

      it('must emit ReStaked', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'ReStaked', {
          validatorId: this.validatorId,
          amount: this.validatorOldState.amount.add(new BN(this.amount)).add(this.validatorReward),
          total: this.oldTotalStaked.add(new BN(this.amount)).add(this.validatorReward)
        })
      })

      if (withRewards) {
        it('validator rewards must be 0', async function() {
          let validator = await this.stakeManager.validators(this.validatorId)
          let reward = validator.reward

          if (validator.contractAddress !== '0x0000000000000000000000000000000000000000') {
            let validatorContract = await ValidatorShare.at(validator.contractAddress)
            reward = await validatorContract.validatorRewards()
          }

          assertBigNumberEquality(reward, 0)
        })
      } else {
        it('validator rewards must be untouched', async function() {
          let validator = await this.stakeManager.validators(this.validatorId)
          let reward = validator.reward

          if (validator.contractAddress !== '0x0000000000000000000000000000000000000000') {
            let validatorContract = await ValidatorShare.at(validator.contractAddress)
            reward = await validatorContract.validatorRewards()
          }

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
        }), 'No use of restaking')
      })

      it('when auction is active', async function() {
        let auctionBid = web3.utils.toWei('10000')
        await this.stakeToken.mint(this.user, auctionBid)
        await this.stakeToken.approve(this.stakeManager.address, auctionBid, {
          from: this.user
        })
        await this.stakeManager.startAuction(this.validatorId, auctionBid, {
          from: this.user
        })
        await checkPoint(initialStakers, this.rootChainOwner, this.stakeManager)
        await checkPoint(initialStakers, this.rootChainOwner, this.stakeManager)

        await expectRevert(this.stakeManager.restake(this.validatorId, this.amount, false, {
          from: this.user
        }), 'Wait for auction completion')
      })
    })
  })
}
