import utils from 'ethereumjs-util'

import {
  ValidatorShare,
  StakingInfo
} from '../../../helpers/artifacts'

import deployer from '../../../helpers/deployer.js'
import logDecoder from '../../../helpers/log-decoder.js'
import { rewradsTreeFee } from '../../../helpers/proofs.js'

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

    function doDeploy() {
      before(freshDeploy)
      before(async function() {
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
      doDeploy()

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

    describe('when updating public key 2 times in 1 epoch', function() {
      doDeploy()

      before(function() {
        this.signer = wallets[0].getChecksumAddressString()
        this.userPubkey = wallets[0].getPublicKeyString()
      })

      it('must revert', async function() {
        let validatorId = await this.stakeManager.getValidatorId(user)
        await this.stakeManager.updateSigner(validatorId, wallets[0].getPublicKeyString(), {
          from: user
        })

        validatorId = await this.stakeManager.getValidatorId(user)
        await expectRevert.unspecified(this.stakeManager.updateSigner(validatorId, wallets[6].getPublicKeyString(), {
          from: user
        }))
      })
    })

    describe('when from is not staker', function() {
      doDeploy()

      it('must revert', async function() {
        const validatorId = await this.stakeManager.getValidatorId(user)
        await expectRevert.unspecified(this.stakeManager.updateSigner(validatorId, wallets[6].getPublicKeyString(), {
          from: wallets[6].getAddressString()
        }))
      })
    })

    describe('when validatorId is incorrect', function() {
      doDeploy()

      it('must revert', async function() {
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
      before(doDeploy)

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
})

// contract('this.stakeManager:rewards distribution', async function(accounts) {
//   let this.stakeToken
//   let this.stakeManager
//   let wallets
//   const totalStake = web3.utils.toWei('2000')

//   describe('staking rewards', async function() {
//     before(async function() {
//       wallets = generateFirstWallets(mnemonics, 2)
//       let contracts = await deployer.deploythis.stakeManager(wallets)
//       this.stakeToken = contracts.this.stakeToken
//       this.stakeManager = contracts.this.stakeManager

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
//       // transfer checkpoint rewards
//       await this.stakeToken.mint(this.stakeManager.address, web3.utils.toWei('10000'))
//     })

  //   it('should get rewards for validator1 for a single checkpoint', async function() {
  //     const reward = web3.utils.toWei('5000')

  //     // 2/3 majority vote
  //     await checkPoint(wallets, wallets[1], this.stakeManager, {
  //       from: wallets[1].getAddressString()
  //     })

  //     const user = await this.stakeManager.ownerOf(1)
  //     const beforeBalance = await this.stakeToken.balanceOf(
  //       user
  //     )

  //     let validator = await this.stakeManager.validators(1)
  //     assertBigNumberEquality(validator.reward, web3.utils.toBN(reward))

  //     await this.stakeManager.withdrawRewards(1, {
  //       from: user
  //     })
  //     const afterBalance = await this.stakeToken.balanceOf(
  //       user
  //     )
  //     assertBigNumberEquality(afterBalance, web3.utils.toBN(reward).add(beforeBalance))
  //     assertBigNumbergt(afterBalance, beforeBalance)
  //   })
  // })
// })

// contract('this.stakeManager: Heimdall fee', async function(accounts) {
//   let this.stakeToken
//   let this.stakeManager
//   let wallets
//   let accountState = {}

//   describe('staking rewards', async function() {
//     beforeEach(async function() {
//       wallets = generateFirstWallets(mnemonics, 3)
//       let contracts = await deployer.deploythis.stakeManager(wallets)
//       this.stakeToken = contracts.this.stakeToken
//       this.stakeManager = contracts.this.stakeManager

//       await this.stakeManager.updateCheckPointBlockInterval(1)
//       await this.stakeManager.changeRootChain(wallets[1].getAddressString())
//     })

//     it('Stake with fee amount', async function() {
//       const amount = web3.utils.toWei('200')
//       const fee = web3.utils.toWei('50')
//       const user = wallets[2].getAddressString()
//       await this.stakeToken.mint(user, amount)
//       await this.stakeToken.approve(this.stakeManager.address, amount, {
//         from: user
//       })
//       let Receipt = await this.stakeManager.stake(web3.utils.toWei('150'), fee, false, wallets[2].getPublicKeyString(), {
//         from: user
//       })
//       const logs = logDecoder.decodeLogs(Receipt.receipt.rawLogs)

//       logs[2].event.should.equal('TopUpFee')
//       logs[1].event.should.equal('Staked')
//       assertBigNumberEquality(logs[2].args.fee, fee)
//       logs[2].args.signer.toLowerCase().should.equal(user.toLowerCase())
//     })

//     it('Topup later', async function() {
//       const amount = web3.utils.toWei('200')
//       const fee = web3.utils.toWei('50')
//       const user = wallets[2].getAddressString()
//       await this.stakeToken.mint(user, amount)
//       await this.stakeToken.approve(this.stakeManager.address, amount, {
//         from: user
//       })
//       let Receipt = await this.stakeManager.stake(web3.utils.toWei('150'), 0, false, wallets[2].getPublicKeyString(), {
//         from: user
//       })
//       let logs = logDecoder.decodeLogs(Receipt.receipt.rawLogs)
//       logs[2].event.should.equal('TopUpFee')
//       logs[1].event.should.equal('Staked')
//       assertBigNumberEquality(logs[2].args.fee, '0')
//       logs[2].args.signer.toLowerCase().should.equal(user.toLowerCase())
//       Receipt = await this.stakeManager.topUpForFee(1, fee, {
//         from: user
//       })
//       logs = logDecoder.decodeLogs(Receipt.receipt.rawLogs)
//       logs[0].event.should.equal('TopUpFee')
//       logs[0].args.signer.toLowerCase().should.equal(user.toLowerCase())
//       assertBigNumberEquality(logs[0].args.fee, fee)
//     })

//     it('Withdraw heimdall fee', async function() {
//       const validators = [1, 2]
//       const amount = web3.utils.toWei('200')
//       const fee = web3.utils.toWei('50')
//       const user = wallets[2].getAddressString()
//       await this.stakeToken.mint(user, amount)
//       await this.stakeToken.approve(this.stakeManager.address, amount, {
//         from: user
//       })
//       await this.stakeManager.stake(web3.utils.toWei('150'), fee, false, wallets[2].getPublicKeyString(), {
//         from: user
//       })

//       accountState[1] = [web3.utils.toHex(fee.toString()), 0]
//       accountState[2] = [0, 0]
//       // validatorId, accumBalance, accumSlashedAmount, amount
//       let tree = await rewradsTreeFee(validators, accountState)

//       const { vote, sigs } = buildSubmitHeaderBlockPaylod(
//         wallets[2].getAddressString(),
//         0,
//         22,
//         '' /* root */,
//         [wallets[2]],
//         { rewardsRootHash: tree.getRoot(), allValidators: true, getSigs: true, totalStake: web3.utils.toWei('150') }
//       )

//       // 2/3 majority vote
//       await this.stakeManager.checkSignatures(
//         1,
//         utils.bufferToHex(utils.keccak256(vote)),
//         utils.bufferToHex(tree.getRoot()),
//         sigs, { from: wallets[1].getAddressString() }
//       )
//       const leaf = utils.keccak256(
//         web3.eth.abi.encodeParameters(
//           ['uint256', 'uint256', 'uint256'],
//           [1, accountState[1][0].toString(), accountState[1][1]]
//         )
//       )
//       // validatorId, accumBalance, accumSlashedAmount, amount, index, bytes memory proof
//       let Receipt = await this.stakeManager.claimFee(
//         1,
//         0,
//         fee,
//         0,
//         utils.bufferToHex(Buffer.concat(tree.getProof(leaf))),
//         { from: wallets[2].getAddressString() }
//       )

//       let logs = logDecoder.decodeLogs(Receipt.receipt.rawLogs)
//       logs[0].event.should.equal('ClaimFee')
//       assertBigNumberEquality(await this.stakeToken.balanceOf(
//         wallets[2].getAddressString()
//       ), fee)
//     })

//     it('Withdraw heimdall fee multiple times', async function() {
//       const validators = [1, 2]
//       const amount = web3.utils.toWei('200')
//       let fee = web3.utils.toWei('50')
//       const user = wallets[2].getAddressString()
//       await this.stakeToken.mint(user, amount)
//       await this.stakeToken.approve(this.stakeManager.address, amount, {
//         from: user
//       })
//       await this.stakeManager.stake(web3.utils.toWei('150'), fee, false, wallets[2].getPublicKeyString(), {
//         from: user
//       })
//       fee = web3.utils.toWei('25')
//       accountState[1] = [web3.utils.toHex(fee.toString()), 0]
//       accountState[2] = [0, 0]
//       // validatorId, accumBalance, accumSlashedAmount, amount
//       let tree = await rewradsTreeFee(validators, accountState)

//       const { vote, sigs } = buildSubmitHeaderBlockPaylod(
//         wallets[2].getAddressString(),
//         0,
//         22,
//         '' /* root */,
//         [wallets[2]],
//         { rewardsRootHash: tree.getRoot(), allValidators: true, getSigs: true, totalStake: web3.utils.toWei('150') }
//       )

//       // 2/3 majority vote
//       await this.stakeManager.checkSignatures(
//         22,
//         utils.bufferToHex(utils.keccak256(vote)),
//         utils.bufferToHex(tree.getRoot()),
//         sigs, { from: wallets[1].getAddressString() }
//       )
//       let leaf = utils.keccak256(
//         web3.eth.abi.encodeParameters(
//           ['uint256', 'uint256', 'uint256'],
//           [1, accountState[1][0].toString(), accountState[1][1]]
//         )
//       )
//       // validatorId, accumBalance, accumSlashedAmount, amount, index, bytes memory proof
//       let Receipt = await this.stakeManager.claimFee(
//         1,
//         0,
//         fee,
//         0,
//         utils.bufferToHex(Buffer.concat(tree.getProof(leaf))),
//         { from: wallets[2].getAddressString() }
//       )

//       let logs = logDecoder.decodeLogs(Receipt.receipt.rawLogs)
//       logs[0].event.should.equal('ClaimFee')
//       assertBigNumberEquality(await this.stakeToken.balanceOf(
//         wallets[2].getAddressString()
//       ), fee)

//       fee = web3.utils.toWei('50')

//       accountState[1] = [web3.utils.toHex(fee.toString()), 0]
//       // validatorId, accumBalance, accumSlashedAmount, amount
//       tree = await rewradsTreeFee(validators, accountState)

//       const header = buildSubmitHeaderBlockPaylod(
//         wallets[2].getAddressString(),
//         22,
//         44,
//         '' /* root */,
//         [wallets[2]],
//         { rewardsRootHash: tree.getRoot(), allValidators: true, getSigs: true, totalStake: web3.utils.toWei('150') }
//       )
//       // 2/3 majority vote
//       await this.stakeManager.checkSignatures(
//         22,
//         utils.bufferToHex(utils.keccak256(header.vote)),
//         utils.bufferToHex(tree.getRoot()),
//         header.sigs, { from: wallets[1].getAddressString() }
//       )

//       leaf = utils.keccak256(
//         web3.eth.abi.encodeParameters(
//           ['uint256', 'uint256', 'uint256'],
//           [1, accountState[1][0].toString(), accountState[1][1]]
//         )
//       )
//       // validatorId, accumBalance, accumSlashedAmount, amount, index, bytes memory proof
//       Receipt = await this.stakeManager.claimFee(
//         1,
//         0,
//         fee,
//         0,
//         utils.bufferToHex(Buffer.concat(tree.getProof(leaf))),
//         { from: wallets[2].getAddressString() }
//       )
//       logs = logDecoder.decodeLogs(Receipt.receipt.rawLogs)
//       logs[0].event.should.equal('ClaimFee')
//       assertBigNumberEquality(await this.stakeToken.balanceOf(
//         wallets[2].getAddressString()
//       ), fee)
//     })
//   })
// })

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
