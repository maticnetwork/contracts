import utils from 'ethereumjs-util'

import {
  ValidatorShare,
  StakingInfo
} from '../../../helpers/artifacts'

import deployer from '../../../helpers/deployer.js'
import logDecoder from '../../../helpers/log-decoder.js'
import { buildTreeFee } from '../../../helpers/proofs.js'

import {
  checkPoint,
  assertBigNumbergt,
  assertBigNumberEquality,
  buildSubmitHeaderBlockPaylod,
  encodeSigs,
  getSigs
} from '../../../helpers/utils.js'
import { expectEvent, expectRevert, BN } from '@openzeppelin/test-helpers'
import { wallets, freshDeploy } from './deployment'

contract('StakeManager', async function(accounts) {
  let owner = accounts[0]

  async function calculateExpectedCheckpointReward(blockInterval, amount, totalAmount, checkpointsPassed) {
    const checkpointBlockInterval = await this.stakeManager.checkPointBlockInterval()
    let checkpointReward = await this.stakeManager.CHECKPOINT_REWARD()
    let expectedCheckpointReward = checkpointReward.mul(new BN(blockInterval)).div(checkpointBlockInterval)
    if (expectedCheckpointReward.gt(checkpointReward)) {
      expectedCheckpointReward = checkpointReward
    }

    let expectedBalance = amount.mul(expectedCheckpointReward).div(totalAmount)
    return expectedBalance.mul(new BN(checkpointsPassed))
  }

  describe('checkSignatures', function() {
    let _wallets = [wallets[1], wallets[2], wallets[3]]

    describe('when payload is valid', function() {
      function prepareToTest(checkpointBlockInterval = 1) {
        before('Fresh deploy', freshDeploy)
        before('updateCheckPointBlockInterval', async function() {
          await this.stakeManager.updateCheckPointBlockInterval(checkpointBlockInterval)
        })
        before('Approve and stake equally', async function() {
          this.amount = new BN(web3.utils.toWei('200'))
          this.totalAmount = new BN(0)

          for (const wallet of _wallets) {
            await this.stakeToken.approve(this.stakeManager.address, this.amount, {
              from: wallet.getAddressString()
            })

            await this.stakeManager.stake(this.amount, 0, false, wallet.getPublicKeyString(), {
              from: wallet.getAddressString()
            })

            this.totalAmount = this.totalAmount.add(this.amount)
          }
        })
      }

      function testCheckpointing(blockInterval, checkpointsPassed) {
        it('must checkpoint', async function() {
          let _count = checkpointsPassed
          while (_count-- > 0) {
            await checkPoint(_wallets, this.rootChainOwner, this.stakeManager, { blockInterval })
          }
        })

        it('every wallet must have equal expected reward balance on the respective validator', async function() {
          const expectedReward = await calculateExpectedCheckpointReward.call(this, blockInterval, this.amount, this.totalAmount, checkpointsPassed)

          for (const wallet of _wallets) {
            const validatorId = await this.stakeManager.getValidatorId(wallet.getAddressString())
            const validator = await this.stakeManager.validators(validatorId)
            assertBigNumberEquality(validator.reward, expectedReward)
          }
        })
      }

      function runTests(checkpointBlockInterval) {
        function runInnerTests(blockInterval, epochs) {
          describe(`when ${epochs} epoch passed`, function() {
            prepareToTest(checkpointBlockInterval)
            testCheckpointing(blockInterval, epochs)
          })
        }

        describe('when block interval is 1', function() {
          runInnerTests(1, 1)
          runInnerTests(1, 5)
        })

        describe('when block interval is 3', function() {
          runInnerTests(3, 1)
          runInnerTests(3, 5)
        })
      }

      describe('when checkpoint block interval is 1', function() {
        runTests(1)
      })

      describe('when checkpoint block interval is 10', function() {
        runTests(10)
      })
    })

    describe('when payload is invalid', function() {
      beforeEach(freshDeploy)
      beforeEach('Prepare to test', async function() {
        this.amount = new BN(web3.utils.toWei('200'))
        this.wallets = [wallets[2]]
        this.voteData = 'dummyData'
        this.stateRoot = utils.bufferToHex(utils.keccak256('stateRoot'))

        for (const wallet of this.wallets) {
          await this.stakeToken.approve(this.stakeManager.address, this.amount, {
            from: wallet.getAddressString()
          })

          await this.stakeManager.stake(this.amount, 0, false, wallet.getPublicKeyString(), {
            from: wallet.getAddressString()
          })
        }

        this.sigs = utils.bufferToHex(
          encodeSigs(getSigs(this.wallets, utils.keccak256(this.voteData)))
        )
      })

      function testRevert() {
        it('must revert', async function() {
          await expectRevert.unspecified(this.stakeManager.checkSignatures(
            1,
            utils.bufferToHex(utils.keccak256(this.voteData)),
            this.stateRoot,
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

      describe('when sigs is random string', function() {
        beforeEach(function() {
          this.sigs = utils.bufferToHex(utils.keccak256('random_string'))
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
  })

  describe('updateSigner', function() {
    let w = [wallets[1], wallets[2], wallets[3]]
    let user = wallets[3].getChecksumAddressString()

    async function doDeploy() {
      await freshDeploy.call(this)

      const amount = web3.utils.toWei('200')
      for (const wallet of w) {
        await this.stakeToken.approve(this.stakeManager.address, amount, {
          from: wallet.getAddressString()
        })

        await this.stakeManager.stake(amount, 0, false, wallet.getPublicKeyString(), {
          from: wallet.getChecksumAddressString()
        })
      }

      await checkPoint(w, this.rootChainOwner, this.stakeManager)
      })
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

    describe('must able to change to original public key. 1 epoch between stakes', function() {
      before(doDeploy)

      describe('when update signer to different public key', function() {
        before(function() {
          this.signer = wallets[0].getChecksumAddressString()
          this.userPubkey = wallets[0].getPublicKeyString()
        })

        testUpdateSigner()
      })

      describe('when update signer back to staker original public key', function() {
        before(async function() {
          // include recently changed signer
          await checkPoint([...w, wallets[0]], this.rootChainOwner, this.stakeManager)
        })

        before(function() {
          this.signer = wallets[3].getChecksumAddressString()
          this.userPubkey = wallets[3].getPublicKeyString()
        })

        testUpdateSigner()
      })
    })

    describe('reverts', function() {
      beforeEach(doDeploy)

      it('when updating public key 2 times in 1 epoch', async function() {
        let validatorId = await this.stakeManager.getValidatorId(user)
        await this.stakeManager.updateSigner(validatorId, wallets[0].getPublicKeyString(), {
          from: user
        })

        validatorId = await this.stakeManager.getValidatorId(user)
        await expectRevert.unspecified(this.stakeManager.updateSigner(validatorId, wallets[6].getPublicKeyString(), {
          from: user
        }))
      })

      it('when from is not staker', async function() {
        const validatorId = await this.stakeManager.getValidatorId(user)
        await expectRevert.unspecified(this.stakeManager.updateSigner(validatorId, wallets[6].getPublicKeyString(), {
          from: wallets[6].getAddressString()
        }))
      })

      it('when validatorId is incorrect', async function() {
        await expectRevert.unspecified(this.stakeManager.updateSigner('9999999', wallets[5].getPublicKeyString(), {
          from: user
        }))
      })

      it('when public key is already in use', async function() {
        const newPubKey = wallets[0].getPublicKeyString()

        let validatorId = await this.stakeManager.getValidatorId(wallets[1].getAddressString())
        await this.stakeManager.updateSigner(validatorId, newPubKey, {
          from: wallets[1].getAddressString()
        })

        validatorId = await this.stakeManager.getValidatorId(wallets[2].getAddressString())
        await expectRevert.unspecified(this.stakeManager.updateSigner(validatorId, newPubKey, {
          from: wallets[2].getAddressString()
        }))
      })
    })
  })

  describe('updateValidatorThreshold', function() {
    before(freshDeploy)
    before(async function() {
      await this.stakeManager.updateDynastyValue(2, {
        from: owner
      })
    })

    function testUpdate(threshold) {
      it(`'must set validator threshold to ${threshold}'`, async function() {
        this.receipt = await this.stakeManager.updateValidatorThreshold(threshold, {
          from: owner
        })
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
      it('when from is not owner', async function() {
        await expectRevert.unspecified(this.stakeManager.updateValidatorThreshold(7, {
          from: accounts[1]
        }))
      })

      it('when threshold == 0', async function() {
        await expectRevert.unspecified(this.stakeManager.updateValidatorThreshold(0, {
          from: owner
        }))
      })
    })
  })

  describe('updateDynastyValue', function() {
    describe('when set dynasty to 2', function() {
      before(freshDeploy)

      it('must update dynasty', async function() {
        this.receipt = await this.stakeManager.updateDynastyValue(2, {
          from: owner
        })
      })

      it('must emit DynastyValueChange', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'DynastyValueChange', {
          newDynasty: '2'
        })
      })
    })

    describe('when set dynasty to 0', function() {
      before(freshDeploy)

      it('must revert', async function() {
        await expectRevert.unspecified(this.stakeManager.updateDynastyValue(0, {
          from: owner
        }))
      })
    })
  })

  describe('updateCheckpointReward', function() {
    describe('when set reward to 20', function() {
      before(freshDeploy)

      it('must update', async function() {
        this.oldReward = await this.stakeManager.CHECKPOINT_REWARD()
        this.receipt = await this.stakeManager.updateCheckpointReward(20, {
          from: owner
        })
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
        await expectRevert.unspecified(this.stakeManager.updateCheckpointReward(0, {
          from: owner
        }))
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
        await this.stakeToken.approve(this.stakeManager.address, this.amount, {
          from: wallet.getAddressString()
        })

        await this.stakeManager.stake(this.amount, 0, false, wallet.getPublicKeyString(), {
          from: wallet.getChecksumAddressString()
        })

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

    function runTests(epochs) {
      describe(`when Alice and Bob stakes for ${epochs} epochs`, function() {
        before(function() {
          this.epochs = epochs
        })

        before(doDeploy)

        it('Alice must have correct balance', async function() {
          const user = Alice.getAddressString()
          const validatorId = await this.stakeManager.getValidatorId(user)
          const beforeBalance = await this.stakeToken.balanceOf(user)

          await this.stakeManager.withdrawRewards(validatorId, {
            from: user
          })

          const afterBalance = await this.stakeToken.balanceOf(user)

          assertBigNumberEquality(afterBalance, this.expectedReward.add(beforeBalance))
        })

        it('Bob must have correct balance', async function() {
          const user = Bob.getAddressString()
          const validatorId = await this.stakeManager.getValidatorId(user)
          const beforeBalance = await this.stakeToken.balanceOf(user)

          await this.stakeManager.withdrawRewards(validatorId, {
            from: user
          })

          const afterBalance = await this.stakeToken.balanceOf(user)

          assertBigNumberEquality(afterBalance, this.expectedReward.add(beforeBalance))
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
        await this.stakeManager.withdrawRewards(validatorId, {
          from: Alice.getAddressString()
        })
      })

      it('when validatorId is invalid', async function() {
        await this.stakeManager.withdrawRewards('99999', {
          from: Alice.getAddressString()
        })
      })
    })
  })

  describe('Staking', function() {
    require('./StakeManager.Staking')(accounts)
  })

  describe('topUpForFee', function() {
    const wallet = wallets[1]
    const user = wallet.getAddressString()
    const userPubkey = wallet.getPublicKeyString()
    const amount = web3.utils.toWei('200')
    const fee = new BN(web3.utils.toWei('50'))

    async function doDeploy() {
      await freshDeploy.call(this)

      await this.stakeToken.approve(this.stakeManager.address, amount, {
        from: user
      })

      await this.stakeManager.stake(amount, 0, false, userPubkey, {
        from: user
      })
    }

    describe('when user tops up', function() {
      function testTopUp() {
        it('must top up', async function() {
          await this.stakeToken.approve(this.stakeManager.address, fee, {
            from: user
          })

          const validatorId = await this.stakeManager.getValidatorId(user)
          this.receipt = await this.stakeManager.topUpForFee(validatorId, fee, {
            from: user
          })
        })

        it('must emit TopUpFee', async function() {
          await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'TopUpFee', {
            signer: wallet.getChecksumAddressString(),
            fee
          })
        })
      }

      describe('once', function() {
        before(doDeploy)

        testTopUp()
      })

      describe('2 times within same checkpoint', function() {
        before(doDeploy)

        describe('1st top up', function() {
          testTopUp()
        })

        describe('2nd top up', function() {
          testTopUp()
        })
      })

      describe('2 times with 1 checkpoint between', function() {
        before(doDeploy)

        describe('1st top up', function() {
          testTopUp()
        })

        describe('2nd top up', function() {
          before(async function() {
            await checkPoint([wallet], this.rootChainOwner, this.stakeManager)
          })

          testTopUp()
        })
      })
    })

    describe('reverts', function() {
      beforeEach(doDeploy)

      it('when user approves less than fee', async function() {
        await this.stakeToken.approve(this.stakeManager.address, fee.sub(new BN(1)), {
          from: user
        })

        const validatorId = await this.stakeManager.getValidatorId(user)
        await expectRevert.unspecified(this.stakeManager.topUpForFee(validatorId, fee, {
          from: user
        }))
      })

      it('when fee is too small', async function() {
        const validatorId = await this.stakeManager.getValidatorId(user)
        const minHeimdallFee = await this.stakeManager.minHeimdallFee()
        await expectRevert(this.stakeManager.topUpForFee(validatorId, minHeimdallFee.sub(new BN(1)), {
          from: user
        }), 'Minimum amount is 1 Matic')
      })

      it('when fee overflows', async function() {
        const validatorId = await this.stakeManager.getValidatorId(user)
        const overflowFee = new BN(2).pow(new BN(256))
        await expectRevert.unspecified(this.stakeManager.topUpForFee(validatorId, overflowFee, {
          from: user
        }))
      })
    })
  })

  describe('claimFee', function() {
    const amount = new BN(web3.utils.toWei('200'))

    async function feeCheckpoint(validatorId, start, end) {
      let tree = await buildTreeFee(this.validators, this.accumulatedFees, this.checkpointIndex)
      this.checkpointIndex++

      const { vote, sigs } = buildSubmitHeaderBlockPaylod(
        this.validatorsWallets[validatorId].getAddressString(),
        start,
        end,
        '' /* root */,
        Object.values(this.validatorsWallets),
        { rewardsRootHash: tree.getRoot(), allValidators: true, getSigs: true, totalStake: this.totalStaked }
      )

      await this.stakeManager.checkSignatures(
        end - start,
        utils.bufferToHex(utils.keccak256(vote)),
        utils.bufferToHex(tree.getRoot()),
        sigs,
        { from: this.rootChainOwner.getAddressString() }
      )

      return tree
    }

    function createLeafFrom(validatorId, checkpointIndex) {
      return utils.keccak256(
        web3.eth.abi.encodeParameters(
          ['uint256', 'uint256', 'uint256'],
          [1, this.accumulatedFees[validatorId][checkpointIndex][0].toString(), this.accumulatedFees[validatorId][checkpointIndex][1].toString()]
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
        await this.stakeToken.approve(this.stakeManager.address, amount, {
          from: wallets[i].getAddressString()
        })

        await this.stakeManager.stake(amount, 0, false, wallets[i].getPublicKeyString(), {
          from: wallets[i].getAddressString()
        })

        const validatorId = i + 1
        this.validatorsWallets[validatorId] = wallets[i]
        this.validators.push(validatorId)
        this.totalStaked = this.totalStaked.add(amount)
        this.accumulatedFees[validatorId] = []
      }

      this.accumSlashedAmount = 0
      this.index = 0
    }

    function doTopUp(checkpointIndex) {
      return async function() {
        for (const validatorId in this.topUpFeeFor) {
          const fee = this.topUpFeeFor[validatorId]

          let newTopUp = [fee, 0]
          if (checkpointIndex === this.accumulatedFees[validatorId].length) {
            let newTopUpIndex = this.accumulatedFees[validatorId].push(newTopUp) - 1
            for (let i = 0; i < newTopUpIndex; ++i) {
              newTopUp[0] = newTopUp[0].add(this.accumulatedFees[validatorId][i][0])
            }
          } else {
            this.accumulatedFees[validatorId][checkpointIndex][0] = newTopUp[0].add(this.accumulatedFees[validatorId][checkpointIndex][0])
          }

          const user = this.validatorsWallets[validatorId].getAddressString()
          await this.stakeToken.approve(this.stakeManager.address, fee, {
            from: user
          })

          await this.stakeManager.topUpForFee(validatorId, fee, {
            from: user
          })
        }

        this.beforeClaimTotalHeimdallFee = await this.stakeManager.totalHeimdallFee()
      }
    }

    function testAliceClaim(AliceValidatorId) {
      it('Alice must withdraw heimdall fee', async function() {
        this.receipt = await this.stakeManager.claimFee(
          AliceValidatorId,
          this.accumSlashedAmount,
          this.fee,
          this.index,
          utils.bufferToHex(Buffer.concat(this.tree.getProof(this.leaf))),
          { from: this.user }
        )
      })

      it('must emit ClaimFee', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'ClaimFee', {
          signer: this.signer,
          validatorId: AliceValidatorId.toString(),
          fee: this.fee
        })
      })

      it('balance must increase by fee', async function() {
        const newBalance = await this.stakeToken.balanceOf(this.user)
        assertBigNumberEquality(this.beforeClaimBalance.add(this.fee), newBalance)
      })

      it('total heimdall fee must decrease by fee', async function() {
        const totalHeimdallFee = await this.stakeManager.totalHeimdallFee()
        assertBigNumberEquality(this.beforeClaimTotalHeimdallFee.sub(this.fee), totalHeimdallFee)
      })
    }

    describe('when Alice and Bob stakes, but only Alice topups heimdall fee', function() {
      const AliceValidatorId = 1
      const BobValidatorId = 2

      before(function() {
        this.validatorsCount = 2
        this.fee = new BN(web3.utils.toWei('50'))
        this.topUpFeeFor = {
          [AliceValidatorId]: this.fee
        }
      })

      before(doDeploy)
      before(doTopUp(0))

      before(async function() {
        this.tree = await feeCheckpoint.call(this, AliceValidatorId, 0, 22)
        this.user = this.validatorsWallets[AliceValidatorId].getAddressString()
        this.signer = this.validatorsWallets[AliceValidatorId].getChecksumAddressString()
        this.leaf = createLeafFrom.call(this, AliceValidatorId, 0)
        this.beforeClaimBalance = await this.stakeToken.balanceOf(this.user)
      })

      it('Bob must fail withdrawing', async function() {
        await expectRevert.unspecified(this.stakeManager.claimFee(
          BobValidatorId,
          this.accumSlashedAmount,
          this.fee,
          this.index,
          utils.bufferToHex(Buffer.concat(this.tree.getProof(this.leaf))),
          { from: this.validatorsWallets[BobValidatorId].getAddressString() }
        ))
      })

      testAliceClaim(AliceValidatorId)
    })

    // accountStateRoot is being replaced during checkpoint
    // If i want to be able to withdraw fee from previous checkpoint - should i commit previous tree root?
    describe.skip('when Alice top ups 2 times with different values', function() {
      const AliceValidatorId = 1
      const firstFee = new BN(web3.utils.toWei('50'))
      const secondFee = new BN(web3.utils.toWei('30'))

      describe('when top', function() {
        before(function() {
          this.trees = []
          this.user = this.validatorsWallets[AliceValidatorId].getAddressString()
          this.signer = this.validatorsWallets[AliceValidatorId].getChecksumAddressString()
          this.validatorsCount = 2
          this.topUpFeeFor = {
            [AliceValidatorId]: firstFee
          }
        })

        before('fresh deploy', doDeploy)
        before('1st top up', doTopUp(0))
        before('1st checkpoint', async function() {
          this.trees.push(await feeCheckpoint.call(this, AliceValidatorId, 0, 22))
          this.topUpFeeFor = {
            [AliceValidatorId]: secondFee
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

          testAliceClaim(AliceValidatorId)
        })

        describe('claims 2nd time', function() {
          before(async function() {
            this.tree = this.trees[1]
            this.fee = secondFee
            this.index = 0
            this.leaf = createLeafFrom.call(this, AliceValidatorId, 1)
            this.beforeClaimBalance = await this.stakeToken.balanceOf(this.user)
          })

          testAliceClaim(AliceValidatorId)
        })

        // describe('claims 2nd time', function() {
        //   testAliceClaim(AliceValidatorId)
        // })

        // describe('claims 3rd time', function() {
        //   testAliceClaim(AliceValidatorId)
        // })
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
        this.topUpFeeFor = {
          [this.validatorId]: this.fee
        }
      })

      beforeEach(doDeploy)
      beforeEach(doTopUp(0))
      beforeEach(async function() {
        this.tree = await feeCheckpoint.call(this, this.validatorId, 0, 22)
        this.user = this.validatorsWallets[this.validatorId].getAddressString()
        this.signer = this.validatorsWallets[this.validatorId].getChecksumAddressString()
        this.leaf = createLeafFrom.call(this, this.validatorId, 0)
        this.beforeClaimBalance = await this.stakeToken.balanceOf(this.user)
        this.proof = utils.bufferToHex(Buffer.concat(this.tree.getProof(this.leaf)))
      })

      async function testRevert() {
        await expectRevert.unspecified(this.stakeManager.claimFee(
          this.validatorId,
          this.accumSlashedAmount,
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
      
      it('when validator id is incorrect', async function() {
        this.validatorId = 999
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
})

// contract('this.stakeManager:validator replacement', async function(accounts) {
//   let this.stakeToken
//   let this.stakeManager
//   let wallets

//   describe('validator replacement', async function() {
//     before(async function() {
//       wallets = generateFirstWallets(mnemonics, 10)
//       let contracts = await deployer.deploythis.stakeManager(wallets)
//       this.stakeToken = contracts.this.stakeToken
//       this.stakeManager = contracts.this.stakeManager

//       await this.stakeManager.updateDynastyValue(8)
//       await this.stakeManager.updateCheckPointBlockInterval(1)

//       let amount = web3.utils.toWei('1000')
//       for (let i = 0; i < 2; i++) {
//         await this.stakeToken.mint(wallets[i].getAddressString(), amount)
//         await this.stakeToken.approve(this.stakeManager.address, amount, {
//           from: wallets[i].getAddressString()
//         })
//         await this.stakeManager.stake(amount, 0, false, wallets[i].getPublicKeyString(), {
//           from: wallets[i].getAddressString()
//         })
//       }
//       await this.stakeToken.mint(this.stakeManager.address, web3.utils.toWei('1000000'))// rewards amount
//       // cool down period
//       let auctionPeriod = await this.stakeManager.auctionPeriod()
//       let currentEpoch = await this.stakeManager.currentEpoch()
//       for (
//         let i = currentEpoch;
//         i <= auctionPeriod;
//         i++
//       ) {
//         // 2/3 majority vote
//         await checkPoint([wallets[0], wallets[1]], wallets[1], this.stakeManager, {
//           from: wallets[1].getAddressString()
//         })
//       }
//     })

//     it('should try auction start in non-auction period and fail', async function() {
//       const amount = web3.utils.toWei('1200')
//       await this.stakeToken.mint(wallets[3].getAddressString(), amount)
//       await this.stakeToken.approve(this.stakeManager.address, amount, {
//         from: wallets[3].getAddressString()
//       })
//       let auction = await this.stakeManager.validatorAuction(1)
//       let currentEpoch = await this.stakeManager.currentEpoch()
//       let dynasty = await this.stakeManager.dynasty()

//       for (let i = currentEpoch; i <= auction.startEpoch.add(dynasty); i++) {
//         // 2/3 majority vote
//         await checkPoint([wallets[0], wallets[1]], wallets[1], this.stakeManager, {
//           from: wallets[1].getAddressString()
//         })
//       }
//       try {
//         await this.stakeManager.startAuction(1, amount, {
//           from: wallets[3].getAddressString()
//         })
//         assert.fail('Auction started in non-auction period')
//       } catch (error) {
//         const invalidOpcode = error.message.search('revert') >= 0
//         assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
//       }
//     })

//     it('should start Auction and bid multiple times', async function() {
//       let amount = web3.utils.toWei('1200')

//       // 2/3 majority vote
//       await checkPoint([wallets[0], wallets[1]], wallets[1], this.stakeManager, {
//         from: wallets[1].getAddressString()
//       })

//       // start an auction from wallet[3]
//       await this.stakeToken.mint(wallets[3].getAddressString(), amount)
//       await this.stakeToken.approve(this.stakeManager.address, amount, {
//         from: wallets[3].getAddressString()
//       })

//       await this.stakeManager.startAuction(1, amount, {
//         from: wallets[3].getAddressString()
//       })

//       let auctionData = await this.stakeManager.validatorAuction(1)

//       assertBigNumberEquality(auctionData.amount, amount)
//       assert(
//         auctionData.user.toLowerCase ===
//         wallets[3].getAddressString().toLowerCase
//       )
//       amount = web3.utils.toWei('1250')
//       // outbid wallet[3] from wallet[4]
//       await this.stakeToken.mint(wallets[4].getAddressString(), amount)
//       await this.stakeToken.approve(this.stakeManager.address, amount, {
//         from: wallets[4].getAddressString()
//       })
//       const oldAuctionerBalanceBefore = await this.stakeToken.balanceOf(
//         wallets[3].getAddressString()
//       )

//       await this.stakeManager.startAuction(1, amount, {
//         from: wallets[4].getAddressString()
//       })

//       // Balance transfer to this.stakeManager
//       assertBigNumberEquality(
//         await this.stakeToken.balanceOf(wallets[4].getAddressString()),
//         '0'
//       )
//       const oldAuctionerBalance = await this.stakeToken.balanceOf(
//         wallets[3].getAddressString()
//       )

//       assertBigNumberEquality(
//         auctionData.amount.add(oldAuctionerBalanceBefore),
//         oldAuctionerBalance
//       )
//       auctionData = await this.stakeManager.validatorAuction(1)
//       assertBigNumberEquality(auctionData.amount, amount)
//       assert(
//         auctionData.user.toLowerCase() ===
//         wallets[4].getAddressString().toLowerCase()
//       )
//     })

//     it('should start auction where validator is last bidder', async function() {
//       const amount = web3.utils.toWei('1250')
//       let validator = await this.stakeManager.validators(2)
//       assert(
//         validator.signer.toLowerCase(),
//         wallets[3].getAddressString().toLowerCase()
//       )

//       await this.stakeToken.mint(validator.signer, amount)
//       await this.stakeToken.approve(this.stakeManager.address, amount, {
//         from: validator.signer
//       })

//       await this.stakeManager.startAuction(2, amount, {
//         from: validator.signer
//       })
//       const auctionData = await this.stakeManager.validatorAuction(2)
//       assertBigNumberEquality(auctionData.amount, amount)
//       assert(auctionData.user.toLowerCase() === validator.signer.toLowerCase())
//     })

//     it('should try to unstake in auction interval and fail', async function() {
//       try {
//         await this.stakeManager.unstake(1, {
//           from: wallets[0].getAddressString()
//         })
//         assert.fail('Unstaked in auction interval')
//       } catch (error) {
//         const invalidOpcode = error.message.search('revert') >= 0
//         assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
//       }
//     })

//     it('should try auction start after auctionPeriod period and fail', async function() {
//       let auctionData = await this.stakeManager.validatorAuction(1)
//       let auctionPeriod = await this.stakeManager.auctionPeriod()
//       let currentEpoch = await this.stakeManager.currentEpoch()

//       // fast forward to skip auctionPeriod
//       for (
//         let i = currentEpoch;
//         i <= auctionPeriod.add(currentEpoch);
//         i++
//       ) {
//         // 2/3 majority vote
//         await checkPoint([wallets[0], wallets[1]], wallets[1], this.stakeManager, {
//           from: wallets[1].getAddressString()
//         })
//       }
//       const amount = web3.utils.toWei('1300')
//       await this.stakeToken.mint(wallets[5].getAddressString(), amount)
//       await this.stakeToken.approve(this.stakeManager.address, amount, {
//         from: wallets[5].getAddressString()
//       })
//       try {
//         await this.stakeManager.startAuction(1, amount, {
//           from: wallets[5].getAddressString()
//         })
//         assert.fail('Test should fail due to invalid auction period')
//       } catch (error) {
//         const invalidOpcode = error.message.search('revert') >= 0
//         const errorMessage = error.message.search('Invalid auction period') >= 0
//         assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
//         assert(
//           errorMessage,
//           "Expected 'Invalid auction period', got '" + error + "' instead"
//         )
//       }
//     })

//     it('should confrim auction and secure the place', async function() {
//       const result = await this.stakeManager.confirmAuctionBid(
//         1,
//         0,
//         false,
//         wallets[4].getPublicKeyString(),
//         {
//           from: wallets[4].getAddressString()
//         }
//       )
//       const logs = logDecoder.decodeLogs(result.receipt.rawLogs)
//       logs[2].event.should.equal('Staked')
//       logs[4].event.should.equal('ConfirmAuction')

//       assertBigNumberEquality(logs[4].args.amount, web3.utils.toWei('1250'))
//       assert.ok(!(await this.stakeManager.isValidator(logs[4].args.oldValidatorId)))
//       assert.ok(await this.stakeManager.isValidator(logs[4].args.newValidatorId))
//     })

//     it('should confrim auction and secure the place for validator itself', async function() {
//       // let validator = await this.stakeManager.validators(2)
//       // let stake = validator.amount
//       // let balanceBefore = await this.stakeToken.balanceOf(validator.signer)
//       // console.log(await this.stakeManager.validatorAuction(2))
//       // console.log(await this.stakeManager.currentEpoch())
//       // const result = await this.stakeManager.confirmAuctionBid(
//       //   2,
//       //   0,
//       //   validator.signer,
//       //   false,
//       //   {
//       //     from: validator.signer
//       //   }
//       // )
//       // const logs = result.receipt.logs

//       // logs[1].event.should.equal('ConfirmAuction')

//       // assertBigNumberEquality(logs[1].args.amount, web3.utils.toWei('1250'))
//       // assertBigNumberEquality(
//       //   logs[1].args.oldValidatorId,
//       //   logs[1].args.newValidatorId
//       // )

//       // test if validator got the diff balance back
//       // let balanceAfter = await this.stakeToken.balanceOf(validator.signer)
//       // assertBigNumberEquality(balanceAfter.sub(balanceBefore), stake)
//     })
//   })
//   describe('validator replacement: skip a dynasty', async function() {
//     before(async function() {
//       wallets = generateFirstWallets(mnemonics, 10)
//       let contracts = await deployer.deploythis.stakeManager(wallets)
//       this.stakeToken = contracts.this.stakeToken
//       this.stakeManager = contracts.this.stakeManager

//       await this.stakeManager.updateDynastyValue(8)
//       await this.stakeManager.updateCheckPointBlockInterval(1)

//       let amount = web3.utils.toWei('1000')
//       for (let i = 0; i < 2; i++) {
//         await this.stakeToken.mint(wallets[i].getAddressString(), amount)
//         await this.stakeToken.approve(this.stakeManager.address, amount, {
//           from: wallets[i].getAddressString()
//         })
//         await this.stakeManager.stake(amount, 0, false, wallets[i].getPublicKeyString(), {
//           from: wallets[i].getAddressString()
//         })
//       }
//       let dynasty = await this.stakeManager.dynasty()
//       // cool down period
//       let auctionPeriod = await this.stakeManager.auctionPeriod()
//       let currentEpoch = await this.stakeManager.currentEpoch()
//       for (
//         let i = currentEpoch;
//         i <= auctionPeriod.add(dynasty);
//         i++
//       ) {
//         // 2/3 majority vote
//         await checkPoint([wallets[0], wallets[1]], wallets[1], this.stakeManager, {
//           from: wallets[1].getAddressString()
//         })
//       }
//       await this.stakeToken.mint(this.stakeManager.address, web3.utils.toWei('1000000'))// rewards amount
//     })

//     it('should call confirmAuction at diffrent times', async function() {
//       let amount = web3.utils.toWei('1200')
//       // 2/3 majority vote
//       await checkPoint([wallets[0], wallets[1]], wallets[1], this.stakeManager, {
//         from: wallets[1].getAddressString()
//       })
//       // start an auction from wallet[3]
//       await this.stakeToken.mint(wallets[3].getAddressString(), amount)
//       await this.stakeToken.approve(this.stakeManager.address, amount, {
//         from: wallets[3].getAddressString()
//       })

//       await this.stakeManager.startAuction(1, amount, {
//         from: wallets[3].getAddressString()
//       })
//       let dynasty = await this.stakeManager.dynasty()

//       for (
//         let i = 0;
//         i <= dynasty;
//         i++
//       ) {
//         // 2/3 majority vote
//         await checkPoint([wallets[0], wallets[1]], wallets[1], this.stakeManager, {
//           from: wallets[1].getAddressString()
//         })
//       }

//       try {
//         await this.stakeManager.confirmAuctionBid(
//           1,
//           0,
//           false,
//           wallets[4].getPublicKeyString(),
//           {
//             from: wallets[4].getAddressString()
//           }
//         )
//         assert.fail(`Confirmation should've failed`)
//       } catch (error) {
//         const invalidOpcode = error.message.search('Confirmation is not allowed before auctionPeriod') >= 0
//         assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
//       }

//       await checkPoint([wallets[0], wallets[1]], wallets[1], this.stakeManager, {
//         from: wallets[1].getAddressString()
//       })
//       await checkPoint([wallets[0], wallets[1]], wallets[1], this.stakeManager, {
//         from: wallets[1].getAddressString()
//       })

//       const result = await this.stakeManager.confirmAuctionBid(
//         1,
//         0,
//         false,
//         wallets[3].getPublicKeyString(),
//         {
//           from: wallets[3].getAddressString()
//         }
//       )

//       const logs = logDecoder.decodeLogs(result.receipt.rawLogs)
//       logs[2].event.should.equal('Staked')
//       logs[4].event.should.equal('ConfirmAuction')
//       assert.ok(!(await this.stakeManager.isValidator(1)))
//     })
//   })
// })
// contract('this.stakeManager: Delegation', async function(accounts) {
//   let this.stakeToken
//   let this.stakeManager
//   let wallets

//   describe('validator:delegation', async function() {
//     before(async function() {
//       wallets = generateFirstWallets(mnemonics, 10)
//       let contracts = await deployer.deploythis.stakeManager(wallets)
//       this.stakeToken = contracts.this.stakeToken
//       this.stakeManager = contracts.this.stakeManager

//       await this.stakeManager.updateDynastyValue(8)
//       await this.stakeManager.updateCheckPointBlockInterval(1)

//       let amount = web3.utils.toWei('1000')
//       for (let i = 0; i < 2; i++) {
//         await this.stakeToken.mint(wallets[i].getAddressString(), amount)
//         await this.stakeToken.approve(this.stakeManager.address, amount, {
//           from: wallets[i].getAddressString()
//         })
//         await this.stakeManager.stake(amount, 0, true, wallets[i].getPublicKeyString(), {
//           from: wallets[i].getAddressString()
//         })
//       }
//       // cool down period
//       let auctionPeriod = await this.stakeManager.auctionPeriod()
//       let currentEpoch = await this.stakeManager.currentEpoch()
//       for (
//         let i = currentEpoch;
//         i <= auctionPeriod;
//         i++
//       ) {
//         // 2/3 majority vote
//         await checkPoint([wallets[0], wallets[1]], wallets[1], this.stakeManager, {
//           from: wallets[1].getAddressString()
//         })
//       }
//     })

//     it('should test reStake with rewards', async function() {
//       const user = wallets[0].getAddressString()
//       const amount = web3.utils.toWei('100')
//       await this.stakeToken.mint(user, amount)
//       await this.stakeToken.approve(this.stakeManager.address, amount, {
//         from: user
//       })

//       let validator = await this.stakeManager.validators(1)
//       let validatorContract = await ValidatorShare.at(validator.contractAddress)
//       let stakeReceipt = await this.stakeManager.restake(1, amount, true, {
//         from: user
//       })
//       const logs = logDecoder.decodeLogs(stakeReceipt.receipt.rawLogs)
//       logs.should.have.lengthOf(2)
//       logs[0].event.should.equal('StakeUpdate')
//       logs[1].event.should.equal('ReStaked')

//       assertBigNumberEquality(await validatorContract.validatorRewards(), 0)
//       assertBigNumberEquality(logs[1].args.amount, web3.utils.toWei('11100'))
//     })

//     it('should test auction with delegation', async function() {
//       let amount = web3.utils.toWei('1250')
//       const delegator = wallets[3].getAddressString()
//       const val = wallets[4].getAddressString()
//       await this.stakeToken.mint(this.stakeManager.address, web3.utils.toWei('1000000'))// rewards amount
//       await this.stakeToken.mint(val, amount)
//       await this.stakeToken.approve(this.stakeManager.address, amount, {
//         from: val
//       })
//       await this.stakeManager.stake(amount, 0, true, wallets[4].getPublicKeyString(), {
//         from: val
//       })
//       let validator = await this.stakeManager.validators(3)
//       let validatorContract = await ValidatorShare.at(validator.contractAddress)
//       await this.stakeToken.mint(delegator, amount)
//       await this.stakeToken.approve(this.stakeManager.address, amount, {
//         from: delegator
//       })
//       await validatorContract.buyVoucher(amount, { from: delegator })
//       amount = web3.utils.toWei('2555')
//       const auctionVal = wallets[5].getAddressString()
//       await this.stakeToken.mint(auctionVal, amount)
//       await this.stakeToken.approve(this.stakeManager.address, amount, {
//         from: auctionVal
//       })

//       await this.stakeManager.startAuction(3, amount, {
//         from: auctionVal
//       })
//       let auctionPeriod = await this.stakeManager.auctionPeriod()
//       for (
//         let i = 0;
//         i <= auctionPeriod;
//         i++
//       ) {
//         // 2/3 majority vote
//         await checkPoint([wallets[0], wallets[1], wallets[4]], wallets[1], this.stakeManager, {
//           from: wallets[1].getAddressString()
//         })
//       }
//       await this.stakeManager.confirmAuctionBid(
//         3,
//         0,
//         false,
//         wallets[5].getPublicKeyString(),
//         {
//           from: auctionVal
//         }
//       )
//       assert.isOk(true, 'Should complete above txs')
//     })
//   })
// })
