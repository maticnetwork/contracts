import { StakingInfo, DummyERC20 } from '../../../helpers/artifacts'

import {
  checkPoint,
  assertBigNumbergt,
  assertBigNumberEquality
} from '../../../helpers/utils.js'
import { expectEvent, expectRevert, BN } from '@openzeppelin/test-helpers'
import { wallets, walletAmounts, freshDeploy } from './deployment'

module.exports = function(accounts) {
  let owner = accounts[0]

  function doStake(wallet, aproveAmount, stakeAmount) {
    return async function() {
      let user = wallet.getAddressString()
      let userPubkey = wallet.getPublicKeyString()

      let _aproveAmount = aproveAmount || walletAmounts[user].amount
      let _stakeAmount = stakeAmount || walletAmounts[user].stakeAmount

      await this.stakeToken.approve(this.stakeManager.address, _aproveAmount, {
        from: user
      })

      await this.stakeManager.stake(_stakeAmount, 0, false, userPubkey, {
        from: user
      })
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
    function testStakeRevert(user, userPubkey, amount, stakeAmount, unspecified) {
      before('Approve', async function() {
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

    function testStake(user, userPubkey, amount, stakeAmount, validatorId, fee) {
      before('Approve', async function() {
        this.user = user

        await this.stakeToken.approve(this.stakeManager.address, amount, {
          from: user
        })

        this.fee = new BN(fee) || 0
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
          await doStake(wallet, web3.utils.toWei('100'), web3.utils.toWei('100')).call(this)

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

      before('Alice stake', doStake(Alice))
      before('Bob stake', doStake(Bob))
      before('Eve stake', doStake(Eve))

      before('Alice unstake', doUnstake(Alice))
      before('Bob unstake', doUnstake(Bob))

      before('Checkpoint', async function() {
        let w = [Eve]

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

        it('must have pre-stake + reward balance', async function() {
          let balance = await this.stakeToken.balanceOf(user)

          assertBigNumberEquality(balance, new BN(walletAmounts[user].initialBalance.toString()).add(this.reward))
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

        it('must have pre-stake + reward balance', async function() {
          let balance = await this.stakeToken.balanceOf(user)

          assertBigNumberEquality(balance, new BN(walletAmounts[user].initialBalance.toString()).add(this.reward))
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
}
