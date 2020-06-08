import utils from 'ethereumjs-util'

import {
  ValidatorShare,
  StakingInfo
} from '../../../helpers/artifacts'

import { buildTreeFee } from '../../../helpers/proofs.js'

import {
  checkPoint,
  assertBigNumberEquality,
  buildSubmitHeaderBlockPaylod,
  buildSubmitHeaderBlockPaylodWithVotes,
  encodeSigs,
  getSigs
} from '../../../helpers/utils.js'
import { expectEvent, expectRevert, BN } from '@openzeppelin/test-helpers'
import { wallets, freshDeploy, approveAndStake } from '../deployment'
import { buyVoucher } from '../ValidatorShareHelper.js'

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

  function testStartAuction(user, bidAmount) {
    it('should bid', async function() {
      this.receipt = await this.stakeManager.startAuction(this.validatorId, bidAmount, {
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
        false,
        this.bidderPubKey,
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
      assertBigNumberEquality(prevValidatorBalance, this.prevValidatorOldBalance.add(this.validator.reward))
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

  describe('updateValidatorDelegation', function() {
    let staker = wallets[1]
    let stakeAmount = web3.utils.toWei('100')

    function doDeploy(acceptDelegation) {
      before('Fresh deploy', freshDeploy)
      before('Approve and stake', async function() {
        await approveAndStake.call(this, { wallet: staker, stakeAmount: stakeAmount, acceptDelegation })

        if (acceptDelegation) {
          const validator = await this.stakeManager.validators('1')
          this.validatorShares = await ValidatorShareTest.at(validator.contractAddress)
        }
      })
    }

    describe('when from is not validator', function() {
      doDeploy(true)

      it('reverts ', async function() {
        await expectRevert(this.stakeManager.updateValidatorDelegation(false, { from: wallets[2].getAddressString() }), 'not a validator')
      })
    })

    describe('when validator has no delegation', function() {
      doDeploy(false)

      it('reverts ', async function() {
        await expectRevert(this.stakeManager.updateValidatorDelegation(false, { from: staker.getAddressString() }), 'delegation not enabled')
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

  describe('drain', function() {
    describe('when not drained by governance', function() {
      before('Fresh deploy', freshDeploy)

      it('reverts ', async function() {
        const balance = await this.stakeToken.balanceOf(this.stakeManager.address)
        await expectRevert(this.stakeManager.drain(owner, balance), 'Only governance contract is authorized')
      })
    })

    describe('when drained by governance', function() {
      before('Fresh deploy', freshDeploy)

      it('must drain all funds ', async function() {
        const balance = await this.stakeToken.balanceOf(this.stakeManager.address)
        await this.governance.update(
          this.stakeManager.address,
          this.stakeManager.contract.methods.drain(owner, balance.toString()).encodeABI()
        )
      })

      it('stake manager must have no funds', async function() {
        (await this.stakeToken.balanceOf(this.stakeManager.address)).toString().should.be.equal('0')
      })
    })
  })

  function testConfirmAuctionBidForOldValidator() {
    it('must confirm auction', async function() {
      this.receipt = await this.stakeManager.confirmAuctionBid(
        this.validatorId,
        0,
        false,
        '0x00',
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
        await this.stakeManager.updateCheckPointBlockInterval(checkpointBlockInterval)
      })
      before('Approve and stake', async function() {
        this.totalAmount = new BN(0)

        for (const staker of stakers) {
          await approveAndStake.call(this, { wallet: staker.wallet, stakeAmount: staker.stake })

          this.totalAmount = this.totalAmount.add(staker.stake)
        }
      })
    }

    function testCheckpointing(stakers, blockInterval, checkpointsPassed, expectedRewards) {
      it('must checkpoint', async function() {
        let _count = checkpointsPassed
        while (_count-- > 0) {
          await checkPoint(stakers.map(x => x.wallet), this.rootChainOwner, this.stakeManager, { blockInterval })
        }
      })

      let index = 0
      for (const staker of stakers) {
        let stakerIndex = index + 1
        index++
        it(`staker #${stakerIndex} must have ${expectedRewards[staker.wallet.getAddressString()]} reward`, async function() {
          const validatorId = await this.stakeManager.getValidatorId(staker.wallet.getAddressString())
          const validator = await this.stakeManager.validators(validatorId)
          assertBigNumberEquality(validator.reward, expectedRewards[staker.wallet.getAddressString()])
        })
      }
    }

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

        testCheckpointing(stakers, 1, 1, {
          [stakers[0].wallet.getAddressString()]: '3000000000000000000000',
          [stakers[1].wallet.getAddressString()]: '6000000000000000000000'
        })
      })

      describe('when proposer updates bonus to 5%', function() {
        before(async function() {
          await this.stakeManager.updateProposerBonus(5)
        })

        testCheckpointing(stakers, 1, 1, {
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
          testCheckpointing(stakers, blockInterval, epochs, expectedRewards)
        })
      }

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
          runTests(1, 10, 1, {
            [stakers[0].wallet.getAddressString()]: '1500000000000000000000',
            [stakers[1].wallet.getAddressString()]: '3000000000000000000000',
            [stakers[2].wallet.getAddressString()]: '4500000000000000000000'
          })
          runTests(1, 10, 5, {
            [stakers[0].wallet.getAddressString()]: '7500000000000000000000',
            [stakers[1].wallet.getAddressString()]: '15000000000000000000000',
            [stakers[2].wallet.getAddressString()]: '22500000000000000000000'
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

      describe.skip('when proposer is not validator', function() {
        beforeEach(function() {
          this.proposer = wallets[1].getAddressString()
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

    describe('with votes', function() {
      const amount = new BN(web3.utils.toWei('200'))

      async function feeCheckpointWithVotes(validatorId, start, end, votes, _sigPrefix, proposer) {
        let tree = await buildTreeFee(this.validators, this.accumulatedFees, this.checkpointIndex)
        this.checkpointIndex++

        const { data, sigs } = buildSubmitHeaderBlockPaylodWithVotes(
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
        }), 'Invalid checkpoint number!')
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
    describe('when set dynasty to 10', function() {
      before(freshDeploy)

      it('must update dynasty', async function() {
        this.receipt = await this.stakeManager.updateDynastyValue('10', {
          from: owner
        })
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
        }), 'Not enough heimdall fee')
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

      const { data, sigs } = buildSubmitHeaderBlockPaylod(
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
      await freshDeploy.call(this)

      await this.stakeManager.updateDynastyValue(8)
      for (const wallet of _initialStakers) {
        await approveAndStake.call(this, { wallet, stakeAmount: initialStakeAmount })
      }

      // cooldown period
      let auctionPeriod = (await this.stakeManager.auctionPeriod()).toNumber()
      let currentEpoch = (await this.stakeManager.currentEpoch()).toNumber()
      for (let i = currentEpoch; i <= auctionPeriod; i++) {
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
        testStartAuction(Alice.getChecksumAddressString(), aliceBidAmount)
      })

      describe('when Bob bids', function() {
        testStartAuction(Bob.getChecksumAddressString(), bobBidAmount)

        it('Alice must get her bid back', async function() {
          const currentBalance = await this.stakeToken.balanceOf(Alice.getAddressString())
          assertBigNumberEquality(this.userOldBalance, currentBalance)
        })
      })
    })

    describe('reverts', function() {
      beforeEach('deploy', doDeploy)

      it('when bid during non-auction period', async function() {
        let auction = await this.stakeManager.validatorAuction(1)
        let currentEpoch = await this.stakeManager.currentEpoch()
        let dynasty = await this.stakeManager.dynasty()

        // skip auction period
        let end = auction.startEpoch.add(dynasty).toNumber()
        for (let i = currentEpoch.toNumber(); i <= end; i++) {
          // 2/3 majority vote
          await checkPoint(_initialStakers, this.rootChainOwner, this.stakeManager)
        }

        await expectRevert(this.stakeManager.startAuction(1, this.amount, {
          from: wallets[3].getAddressString()
        }), 'Invalid auction period')
      })

      it('when bid during replacement cooldown', async function() {
        await this.stakeManager.updateDynastyValue(7)
        await expectRevert(this.stakeManager.startAuction(1, this.amount, {
          from: wallets[3].getAddressString()
        }), 'Cooldown period')
      })

      it('when bid on unstaking validator', async function() {
        await this.stakeManager.unstake(1, { from: _initialStakers[0].getAddressString() })
        await expectRevert(this.stakeManager.startAuction(1, this.amount, {
          from: wallets[3].getAddressString()
        }), 'Invalid validator for an auction')
      })

      it('when restake on unstaking validator', async function() {
        await this.stakeManager.unstake(1, { from: _initialStakers[0].getAddressString() })
        await expectRevert(this.stakeManager.restake(1, this.amount, false, {
          from: _initialStakers[0].getAddressString()
        }), 'No use of restaking')
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
        await expectRevert.unspecified(this.stakeManager.startAuction(0, this.amount, {
          from: wallets[3].getAddressString()
        }))
      })

      it('when bid is too low', async function() {
        await expectRevert(this.stakeManager.startAuction(1, web3.utils.toWei('100'), {
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
        await freshDeploy.call(this)

        await this.stakeManager.updateDynastyValue(8)

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

        await this.stakeManager.startAuction(this.validatorId, bidAmount, {
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
            false,
            this.bidderPubKey,
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
            false,
            this.bidderPubKey,
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
          false,
          wallets[4].getPublicKeyString(),
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
        await freshDeploy.call(this)

        await this.stakeManager.updateDynastyValue(8)

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
      for (let i = currentEpoch; i <= auctionPeriod; i++) {
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

      testStartAuction(auctionValidatorAddr, bidAmount)
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
        this.validator.reward = await this.validatorContract.validatorRewards()
      })

      testConfirmAuctionBidForNewValidator()
    })
  })

  describe('stopAuctions', function() {
    const initialStakers = [wallets[1], wallets[2]]
    const stakeAmount = web3.utils.toWei('1250')
    const bidAmount = web3.utils.toWei('1350')
    const bidder = wallets[3].getChecksumAddressString()

    async function doDeploy() {
      await freshDeploy.call(this)

      await this.stakeManager.updateDynastyValue(8)

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
      await this.stakeManager.stopAuctions(this.newReplacementCoolDownPeriod)
      const currentReplacementCooldown = await this.stakeManager.replacementCoolDown()
      assertBigNumberEquality(currentReplacementCooldown, this.newReplacementCoolDownPeriod.add(await this.stakeManager.epoch()))
    })

    it('bid must revert', async function() {
      await expectRevert(this.stakeManager.startAuction(this.validatorId, bidAmount, {
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
      await this.stakeManager.startAuction(this.validatorId, bidAmount, {
        from: bidder
      })
    })
  })
})
