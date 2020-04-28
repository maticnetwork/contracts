import { StakingInfo } from '../../../helpers/artifacts'

import {
  checkPoint,
  assertBigNumbergt,
  assertBigNumberEquality
} from '../../../helpers/utils.js'
import { expectEvent, expectRevert } from '@openzeppelin/test-helpers'
import { wallets, walletAmounts, freshDeploy } from './deployment'

module.exports = function(accounts) {
  let owner = accounts[0]

  function doStake(wallet, aproveAmount, stakeAmount) {
    return async function() {
      let user = wallet.getAddressString()
      let userPubkey = wallet.getPublicKeyString()

      let _arpoveAmount = aproveAmount || walletAmounts[user].amount
      let _stakeAmount = stakeAmount || walletAmounts[user].stakeAmount

      await this.stakeToken.approve(this.stakeManager.address, _arpoveAmount, {
        from: user
      })

      await this.stakeManager.stake(_stakeAmount, 0, false, userPubkey, {
        from: user
      })
    }
  }

  describe('stake', function() {
    function testStakeRevert(user, userPubkey, amount, stakeAmount, unspecified) {
      before(async function() {
        this.initialBalance = await this.stakeManager.totalStakedFor(user)
        await this.stakeToken.approve(this.stakeManager.address, amount, {
          from: user
        })
      })

      it('must revert', async function() {
        if (unspecified) {
          await expectRevert.unspecified(this.stakeManager.stake(stakeAmount, 0, false, userPubkey, {
            from: user
          }))
        } else {
          await expectRevert(this.stakeManager.stake(stakeAmount, 0, false, userPubkey, {
            from: user
          }), 'Invalid Signer key')
        }
      })

      it('must have unchanged staked balance', async function() {
        const stakedFor = await this.stakeManager.totalStakedFor(user)
        assertBigNumberEquality(stakedFor, this.initialBalance)
      })
    }

    function testStake(user, userPubkey, amount, stakeAmount, validatorId) {
      before(async function() {
        this.user = user

        await this.stakeToken.approve(this.stakeManager.address, amount, {
          from: user
        })
      })

      it('must stake', async function() {
        this.receipt = await this.stakeManager.stake(stakeAmount, 0, false, userPubkey, {
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

      it(`must have correct staked amount`, async function() {
        const stakedFor = await this.stakeManager.totalStakedFor(user)
        assertBigNumberEquality(stakedFor, stakeAmount)
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
      before(async function() {
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
      before(async function() {
        await this.stakeManager.updateValidatorThreshold(3, {
          from: owner
        })

        await this.stakeManager.updateDynastyValue(2, {
          from: owner
        })
      })

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

    describe('stake and restake following stake', function() {
      before(freshDeploy)
      before(async function() {
        await this.stakeManager.updateValidatorThreshold(3, {
          from: owner
        })

        await this.stakeManager.updateDynastyValue(2, {
          from: owner
        })
      })

      const amounts = walletAmounts[wallets[2].getAddressString()]
      before(doStake(wallets[2], amounts.amount, amounts.stakeAmount))

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
      before(async function() {
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
      before(async function() {
        await this.stakeManager.updateValidatorThreshold(3, {
          from: owner
        })

        await this.stakeManager.updateDynastyValue(2, {
          from: owner
        })
      })

      it('validatorId must increment 1 by 1', async function() {
        const _wallets = [wallets[1], wallets[2], wallets[3]]
        let expectedValidatorId = 1
        for (const wallet of _wallets) {
          await doStake(wallet, web3.utils.toWei('100'), web3.utils.toWei('100')).call(this)

          const validatorId = await this.stakeManager.getValidatorId(wallet.getAddressString())
          assertBigNumberEquality(expectedValidatorId, validatorId)
          expectedValidatorId++
        }
      })
    })
  })

  describe('unstake', function() {
    describe('when user unstakes', async function() {
      before(freshDeploy)
      before(async function() {
        await this.stakeManager.updateValidatorThreshold(3, {
          from: owner
        })

        await this.stakeManager.updateDynastyValue(2, {
          from: owner
        })
      })

      const user = wallets[2].getChecksumAddressString()
      const amounts = walletAmounts[wallets[2].getAddressString()]

      before(doStake(wallets[2]))

      it('must unstake', async function() {
        const validatorId = await this.stakeManager.getValidatorId(user)
        this.receipt = await this.stakeManager.unstake(validatorId, {
          from: user
        })
      })

      it('must emit UnstakeInit', async function() {
        const validatorId = await this.stakeManager.getValidatorId(user)
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'UnstakeInit', {
          amount: amounts.stakeAmount,
          validatorId,
          user
        })
      })
    })

    describe('when user unstakes after 2 epochs', async function() {
      before(freshDeploy)
      before(async function() {
        await this.stakeManager.updateValidatorThreshold(3, {
          from: owner
        })

        await this.stakeManager.updateDynastyValue(2, {
          from: owner
        })
      })

      const user = wallets[3].getChecksumAddressString()
      const amounts = walletAmounts[wallets[3].getAddressString()]

      before(doStake(wallets[3], amounts.amount, amounts.stakeAmount))

      let w = [wallets[1], wallets[3]]

      before(async function() {
        await checkPoint(w, wallets[1], this.stakeManager)
        await checkPoint(w, wallets[1], this.stakeManager)
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
    })
  })

  describe.only('unstakeClaim', function() {
    before(freshDeploy)
    before(doStake(wallets[2]))
    before(doStake(wallets[3]))
    before(async function() {
      let w = [wallets[1], wallets[2], wallets[3]]

      await checkPoint(w, wallets[1], this.stakeManager)
      await checkPoint(w, wallets[1], this.stakeManager)
      await checkPoint(w, wallets[1], this.stakeManager)
      await checkPoint(w, wallets[1], this.stakeManager)
    })

    describe('when user claims', function() {
      const user = wallets[2].getAddressString()

      it('must claim', async function() {
        const ValidatorId2 = await this.stakeManager.getValidatorId(
          user
        )
        await this.stakeManager.unstakeClaim(ValidatorId2, {
          from: user
        })
      })

      it('must have initial balance', async function() {
        let balance = await this.stakeToken.balanceOf(user)
        assertBigNumberEquality(balance, walletAmounts[user].initialBalance)
      })
    })

    describe('when wallets[3] claims', function() {
      const user = wallets[3].getAddressString()

      it('must claim', async function() {
        const ValidatorId2 = await this.stakeManager.getValidatorId(
          user
        )
        await this.stakeManager.unstakeClaim(ValidatorId2, {
          from: user
        })
      })

      it('must have increased balance', async function() {
        let balance = await this.stakeToken.balanceOf(user)
        assertBigNumbergt(balance, walletAmounts[user].initialBalance)
      })
    })

    describe('afterwards verification', function() {
      it('must have corect number of validators', async function() {
        const validators = await this.stakeManager.getCurrentValidatorSet()
        validators.should.have.lengthOf(1)
      })

      it('must have correct staked balance', async function() {
        const amount = walletAmounts[wallets[1].getAddressString()].stakeAmount
        const stake = await this.stakeManager.currentValidatorSetTotalStake()
        assertBigNumberEquality(stake, amount)
      })
    })
  })
}
