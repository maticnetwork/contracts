import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import utils from 'ethereumjs-util'

import {
  ValidatorShare,
  StakingInfo
} from '../../helpers/artifacts'

import deployer from '../../helpers/deployer.js'
import logDecoder from '../../helpers/log-decoder.js'
import { rewradsTreeFee } from '../../helpers/proofs.js'

import {
  checkPoint,
  assertBigNumbergt,
  assertBigNumberEquality,
  buildSubmitHeaderBlockPaylod,
  encodeSigs,
  getSigs
} from '../../helpers/utils.js'
import { generateFirstWallets, mnemonics } from '../../helpers/wallets.js'
import { expectEvent, expectRevert } from '@openzeppelin/test-helpers'

chai.use(chaiAsPromised).should()

contract('StakeManager', async function(accounts) {
  let stakeToken
  let stakeManager
  let wallets = generateFirstWallets(mnemonics, 10)
  let owner = accounts[0]

  const WalletAmounts = {
    [wallets[0].getAddressString()]: {
      initialBalance: web3.utils.toWei('1200')
    },
    [wallets[1].getAddressString()]: {
      amount: web3.utils.toWei('200'),
      stakeAmount: web3.utils.toWei('200'),
      initialBalance: web3.utils.toWei('1200')
    },
    [wallets[2].getAddressString()]: {
      amount: web3.utils.toWei('250'),
      stakeAmount: web3.utils.toWei('150'),
      restakeAmonut: web3.utils.toWei('100'),
      initialBalance: web3.utils.toWei('805')
    },
    [wallets[3].getAddressString()]: {
      amount: web3.utils.toWei('300'),
      stakeAmount: web3.utils.toWei('300'),
      initialBalance: web3.utils.toWei('850')
    },
    [wallets[4].getAddressString()]: {
      initialBalance: web3.utils.toWei('800')
    }
  }

  async function freshDeploy() {
    let contracts = await deployer.deployStakeManager(wallets)
    stakeToken = contracts.stakeToken
    stakeManager = contracts.stakeManager

    // dummy registry address
    await stakeManager.updateCheckPointBlockInterval(1)
    // transfer tokens to other accounts
    for (const walletAddr in WalletAmounts) {
      await stakeToken.mint(
        walletAddr,
        WalletAmounts[walletAddr].initialBalance
      )
    }
    await stakeToken.mint(
      wallets[9].getAddressString(),
      web3.utils.toWei('90000')
    )
    // rewards transfer
    await stakeToken.transfer(stakeManager.address, web3.utils.toWei('90000'), {
      from: wallets[9].getAddressString()
    })
  }

  describe('checkSignatures', function() {
    let w = [wallets[1], wallets[2], wallets[3]]

    before(freshDeploy)
    before(async function() {
      const amount = web3.utils.toWei('200')
      for (const wallet of w) {
        await stakeToken.approve(stakeManager.address, amount, {
          from: wallet.getAddressString()
        })

        await stakeManager.stake(amount, 0, false, wallet.getPublicKeyString(), {
          from: wallet.getAddressString()
        })
      }
    })

    describe('when payload is valid', function() {
      it('must check', async function() {
        await checkPoint(w, wallets[1], stakeManager)
      })
    })

    describe('when payload is invalid', function() {
      function testRevert() {
        it('must revert', async function() {
          await expectRevert.unspecified(stakeManager.checkSignatures(
            1,
            utils.bufferToHex(utils.keccak256(this.voteData)),
            this.stateRoot,
            this.sigs,
            {
              from: wallets[1].getAddressString()
            }
          ))
        })
      }

      describe('when sigs is empty', function() {
        before(function() {
          this.voteData = 'dummyData'
          this.sigs = []
          this.stateRoot = utils.bufferToHex(utils.keccak256('stateRoot'))
        })

        testRevert()
      })

      describe('when sigs is random string', function() {
        before(function() {
          this.voteData = 'dummyData'
          this.sigs = utils.bufferToHex(utils.keccak256('random_string'))
          this.stateRoot = utils.bufferToHex(utils.keccak256('stateRoot'))
        })

        testRevert()
      })
    })
  })

  describe('updateSigner', function() {
    let user = wallets[3].getChecksumAddressString()
    function testUpdateSigner() {
      it('must update signer', async function() {
        const validatorId = await stakeManager.getValidatorId(user)
        this.receipt = await stakeManager.updateSigner(validatorId, this.userPubkey, {
          from: user
        })
      })

      it('must emit SignerChange', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'SignerChange', {
          newSigner: this.signer
        })
      })

      it('must have correct signer on-chain', async function() {
        const validatorId = await stakeManager.getValidatorId(user)
        let stakerDetails = await stakeManager.validators(validatorId)
        stakerDetails.signer.should.equal(this.signer)
      })
    }

    function prepareTestRun() {
      before(freshDeploy)
      before(async function() {
        let w = [wallets[1], wallets[2], wallets[3]]
        const amount = web3.utils.toWei('200')
        for (const wallet of w) {
          await stakeToken.approve(stakeManager.address, amount, {
            from: wallet.getAddressString()
          })

          await stakeManager.stake(amount, 0, false, wallet.getPublicKeyString(), {
            from: wallet.getChecksumAddressString()
          })
        }

        await checkPoint(w, wallets[1], stakeManager)
      })
    }

    describe('when from is staker', function() {
      prepareTestRun()

      describe('when update signer to different public key', function() {
        before(function() {
          this.signer = wallets[0].getChecksumAddressString()
          this.userPubkey = wallets[0].getPublicKeyString()
        })

        testUpdateSigner()
      })

      describe('when update signer back to staker original public key', function() {
        before(function() {
          this.signer = wallets[3].getChecksumAddressString()
          this.userPubkey = wallets[3].getPublicKeyString()
        })

        testUpdateSigner()
      })
    })

    describe('when from is not staker', function() {
      prepareTestRun()

      it('must revert', async function() {
        const validatorId = await stakeManager.getValidatorId(user)
        await expectRevert.unspecified(stakeManager.updateSigner(validatorId, wallets[6].getPublicKeyString(), {
          from: wallets[6].getAddressString()
        }))
      })
    })

    describe('when validatorId is incorrect', function() {
      prepareTestRun()
      
      it('must revert', async function() {
        await expectRevert.unspecified(stakeManager.updateSigner('9999999', wallets[5].getPublicKeyString(), {
          from: user
        }))
      })
    })
  })

  describe('updateValidatorThreshold', function() {
    before(freshDeploy)
    before(async function() {
      await stakeManager.updateDynastyValue(2, {
        from: owner
      })
    })

    function testUpdate(threshold) {
      it(`'must set validator threshold to ${threshold}'`, async function() {
        this.receipt = await stakeManager.updateValidatorThreshold(threshold, {
          from: owner
        })
      })
  
      it(`validatorThreshold == ${threshold}`, async function() {
        const newThreshold = await stakeManager.validatorThreshold()
        assertBigNumberEquality(newThreshold, threshold)
      })
  
      it('must emit ThresholdChange', async function() {
        await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'ThresholdChange', {
          newThreshold: threshold.toString()
        })
      })
    }

    testUpdate(5)
    testUpdate(6)
    testUpdate(1)

    describe('reverts', function() {
      it('when from is not owner', async function() {
        await expectRevert.unspecified(stakeManager.updateValidatorThreshold(7, {
          from: accounts[1]
        }))
      })

      it('when threshold == 0', async function() {
        await expectRevert.unspecified(stakeManager.updateValidatorThreshold(0, {
          from: owner
        }))
      })
    })
  })

  describe('updateDynastyValue', function() {
    before(freshDeploy)

    it('set dynasty value to 2 epochs', async function() {
      this.receipt = await stakeManager.updateDynastyValue(2, {
        from: owner
      })
    })

    it('must emit DynastyValueChange', async function() {
      await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'DynastyValueChange', {
        newDynasty: '2'
      })
    })
  })

  describe('stake/unstake/unstakeClaim', function() {
    before(freshDeploy)
    before(async function() {
      await stakeManager.updateValidatorThreshold(3, {
        from: owner
      })

      await stakeManager.updateDynastyValue(2, {
        from: owner
      })
    })

    describe('stake', function() {
      function testStakeRevert(user, userPubkey, amount, stakeAmount, unspecified) {
        before(async function() {
          this.initialBalance = await stakeManager.totalStakedFor(user)
          await stakeToken.approve(stakeManager.address, amount, {
            from: user
          })
        })

        it('must revert', async function() {
          if (unspecified) {
            await expectRevert.unspecified(stakeManager.stake(stakeAmount, 0, false, userPubkey, {
              from: user
            }))
          } else {
            await expectRevert(stakeManager.stake(stakeAmount, 0, false, userPubkey, {
              from: user
            }), 'Invalid Signer key')
          }
        })

        it('must have unchanged staked balance', async function() {
          const stakedFor = await stakeManager.totalStakedFor(user)
          assertBigNumberEquality(stakedFor, this.initialBalance)
        })
      }

      function testStake(user, userPubkey, amount, stakeAmount, validatorId) {
        before(async function() {
          this.user = user

          await stakeToken.approve(stakeManager.address, amount, {
            from: user
          })
        })

        it('must stake', async function() {
          this.receipt = await stakeManager.stake(stakeAmount, 0, false, userPubkey, {
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
          const stakedFor = await stakeManager.totalStakedFor(user)
          assertBigNumberEquality(stakedFor, stakeAmount)
        })

        it(`must have validatorId == ${validatorId}`, async function() {
          const _validatorId = await stakeManager.getValidatorId(user)
          _validatorId.toString().should.be.equal(validatorId.toString())
        })

        it('must have valid validatorId', async function() {
          const validatorId = await stakeManager.getValidatorId(user)
          const value = await stakeManager.isValidator(validatorId.toString())
          assert.isTrue(value)
        })
      }

      function testRestake(user, amount, stakeAmount, restakeAmount, totalStaked) {
        before(async function() {
          this.user = user

          await stakeToken.approve(stakeManager.address, amount, {
            from: user
          })
        })

        it('must restake', async function() {
          const validatorId = await stakeManager.getValidatorId(this.user)
          this.receipt = await stakeManager.restake(validatorId, restakeAmount, false, {
            from: this.user
          })
        })

        it('must emit StakeUpdate', async function() {
          const validatorId = await stakeManager.getValidatorId(this.user)
          await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'StakeUpdate', {
            validatorId
          })
        })

        it('must emit ReStaked', async function() {
          const validatorId = await stakeManager.getValidatorId(this.user)
          await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'ReStaked', {
            validatorId,
            amount: stakeAmount,
            total: totalStaked
          })
        })

        it(`must have correct total staked amount`, async function() {
          const stakedFor = await stakeManager.totalStakedFor(user)
          assertBigNumberEquality(stakedFor, stakeAmount)
        })
      }

      describe('when wallets[1] stakes', async function() {
        describe('when stakes first time', function() {
          const amounts = WalletAmounts[wallets[1].getAddressString()]
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

      describe('when wallets[2] stakes', function() {
        const amounts = WalletAmounts[wallets[2].getAddressString()]

        describe('when stakes first', function() {
          testStake(
            wallets[2].getChecksumAddressString(),
            wallets[2].getPublicKeyString(),
            amounts.amount,
            amounts.stakeAmount,
            2
          )
        })

        describe('when restakes', function() {
          testRestake(
            wallets[2].getChecksumAddressString(),
            amounts.restakeAmonut,
            amounts.amount,
            amounts.restakeAmonut,
            web3.utils.toWei('450')
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

      describe('when wallets[3-4] stakes beyond validator threshold', async function() {
        describe('when wallets[3] stakes', function() {
          const amounts = WalletAmounts[wallets[3].getAddressString()]
          testStake(
            wallets[3].getChecksumAddressString(),
            wallets[3].getPublicKeyString(),
            amounts.amount,
            amounts.stakeAmount,
            3
          )
        })

        describe('when wallets[4] stakes beyond validator threshold', function() {
          testStakeRevert(
            wallets[4].getChecksumAddressString(),
            wallets[4].getPublicKeyString(),
            web3.utils.toWei('100'),
            web3.utils.toWei('100'),
            true
          )
        })
      })
    })

    describe('unstake', function() {
      describe('when wallets[2] unstakes', async function() {
        const user = wallets[2].getChecksumAddressString()
        const amounts = WalletAmounts[wallets[2].getAddressString()]

        it('must unstake', async function() {
          const validatorId = await stakeManager.getValidatorId(user)
          this.receipt = await stakeManager.unstake(validatorId, {
            from: user
          })
        })

        it('must emit UnstakeInit', async function() {
          const validatorId = await stakeManager.getValidatorId(user)
          await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'UnstakeInit', {
            amount: amounts.amount,
            validatorId,
            user
          })
        })
      })

      describe('when wallets[3] unstakes after 2 epochs', async function() {
        const user = wallets[3].getChecksumAddressString()
        const amounts = WalletAmounts[wallets[3].getAddressString()]
        let w = [wallets[1], wallets[3]]
    
        before(async function() {
          await checkPoint(w, wallets[1], stakeManager)
          await checkPoint(w, wallets[1], stakeManager)
        })

        it('must unstake', async function() {
          const validatorId = await stakeManager.getValidatorId(user)
          this.receipt = await stakeManager.unstake(validatorId, {
            from: user
          })
        })

        it('must emit UnstakeInit', async function() {
          const validatorId = await stakeManager.getValidatorId(user)
          await expectEvent.inTransaction(this.receipt.tx, StakingInfo, 'UnstakeInit', {
            amount: amounts.amount,
            validatorId,
            user
          })
        })
      })

      describe('unstakeClaim', function() {
        before(async function() {
          let w = [wallets[1]]
  
          await checkPoint(w, wallets[1], stakeManager)
          await checkPoint(w, wallets[1], stakeManager)
          await checkPoint(w, wallets[1], stakeManager)
          await checkPoint(w, wallets[1], stakeManager)
        })

        describe('when wallets[2] claims', function() {
          const user = wallets[2].getAddressString()

          it('must claim', async function() {
            const ValidatorId2 = await stakeManager.getValidatorId(
              user
            )
            await stakeManager.unstakeClaim(ValidatorId2, {
              from: user
            })
          })

          it('must have initial balance', async function() {
            let balance = await stakeToken.balanceOf(user)
            assertBigNumberEquality(balance, WalletAmounts[user].initialBalance)
          })
        })

        describe('when wallets[3] claims', function() {
          const user = wallets[3].getAddressString()

          it('must claim', async function() {
            const ValidatorId2 = await stakeManager.getValidatorId(
              user
            )
            await stakeManager.unstakeClaim(ValidatorId2, {
              from: user
            })
          })

          it('must have increased balance', async function() {
            let balance = await stakeToken.balanceOf(user)
            assertBigNumbergt(balance, WalletAmounts[user].initialBalance)
          })
        })

        describe('afterwards verification', function() {
          it('must have corect number of validators', async function() {
            const validators = await stakeManager.getCurrentValidatorSet()
            validators.should.have.lengthOf(1)
          })

          it('must have correct staked balance', async function() {
            const amount = WalletAmounts[wallets[1].getAddressString()].stakeAmount
            const stake = await stakeManager.currentValidatorSetTotalStake()
            assertBigNumberEquality(stake, amount)
          })
        })
      })
    })
  })
})

// contract('StakeManager:rewards distribution', async function(accounts) {
//   let stakeToken
//   let stakeManager
//   let wallets
//   const totalStake = web3.utils.toWei('2000')

//   describe('staking rewards', async function() {
//     before(async function() {
//       wallets = generateFirstWallets(mnemonics, 2)
//       let contracts = await deployer.deployStakeManager(wallets)
//       stakeToken = contracts.stakeToken
//       stakeManager = contracts.stakeManager

//       await stakeManager.updateCheckPointBlockInterval(1)
//       let amount = web3.utils.toWei('1000')
//       for (let i = 0; i < 2; i++) {
//         await stakeToken.mint(wallets[i].getAddressString(), amount)
//         await stakeToken.approve(stakeManager.address, amount, {
//           from: wallets[i].getAddressString()
//         })
//         await stakeManager.stake(amount, 0, false, wallets[i].getPublicKeyString(), {
//           from: wallets[i].getAddressString()
//         })
//       }
//       // transfer checkpoint rewards
//       await stakeToken.mint(stakeManager.address, web3.utils.toWei('10000'))
//     })

//     it('should get rewards for validator1 for a single checkpoint', async function() {
//       const reward = web3.utils.toWei('5000')

//       // 2/3 majority vote
//       await checkPoint(wallets, wallets[1], stakeManager, {
//         from: wallets[1].getAddressString()
//       })

//       const user = await stakeManager.ownerOf(1)
//       const beforeBalance = await stakeToken.balanceOf(
//         user
//       )

//       let validator = await stakeManager.validators(1)
//       assertBigNumberEquality(validator.reward, web3.utils.toBN(reward))

//       await stakeManager.withdrawRewards(1, {
//         from: user
//       })
//       const afterBalance = await stakeToken.balanceOf(
//         user
//       )
//       assertBigNumberEquality(afterBalance, web3.utils.toBN(reward).add(beforeBalance))
//       assertBigNumbergt(afterBalance, beforeBalance)
//     })
//   })
// })

// contract('StakeManager: Heimdall fee', async function(accounts) {
//   let stakeToken
//   let stakeManager
//   let wallets
//   let accountState = {}

//   describe('staking rewards', async function() {
//     beforeEach(async function() {
//       wallets = generateFirstWallets(mnemonics, 3)
//       let contracts = await deployer.deployStakeManager(wallets)
//       stakeToken = contracts.stakeToken
//       stakeManager = contracts.stakeManager

//       await stakeManager.updateCheckPointBlockInterval(1)
//       await stakeManager.changeRootChain(wallets[1].getAddressString())
//     })

//     it('Stake with fee amount', async function() {
//       const amount = web3.utils.toWei('200')
//       const fee = web3.utils.toWei('50')
//       const user = wallets[2].getAddressString()
//       await stakeToken.mint(user, amount)
//       await stakeToken.approve(stakeManager.address, amount, {
//         from: user
//       })
//       let Receipt = await stakeManager.stake(web3.utils.toWei('150'), fee, false, wallets[2].getPublicKeyString(), {
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
//       await stakeToken.mint(user, amount)
//       await stakeToken.approve(stakeManager.address, amount, {
//         from: user
//       })
//       let Receipt = await stakeManager.stake(web3.utils.toWei('150'), 0, false, wallets[2].getPublicKeyString(), {
//         from: user
//       })
//       let logs = logDecoder.decodeLogs(Receipt.receipt.rawLogs)
//       logs[2].event.should.equal('TopUpFee')
//       logs[1].event.should.equal('Staked')
//       assertBigNumberEquality(logs[2].args.fee, '0')
//       logs[2].args.signer.toLowerCase().should.equal(user.toLowerCase())
//       Receipt = await stakeManager.topUpForFee(1, fee, {
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
//       await stakeToken.mint(user, amount)
//       await stakeToken.approve(stakeManager.address, amount, {
//         from: user
//       })
//       await stakeManager.stake(web3.utils.toWei('150'), fee, false, wallets[2].getPublicKeyString(), {
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
//       await stakeManager.checkSignatures(
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
//       let Receipt = await stakeManager.claimFee(
//         1,
//         0,
//         fee,
//         0,
//         utils.bufferToHex(Buffer.concat(tree.getProof(leaf))),
//         { from: wallets[2].getAddressString() }
//       )

//       let logs = logDecoder.decodeLogs(Receipt.receipt.rawLogs)
//       logs[0].event.should.equal('ClaimFee')
//       assertBigNumberEquality(await stakeToken.balanceOf(
//         wallets[2].getAddressString()
//       ), fee)
//     })

//     it('Withdraw heimdall fee multiple times', async function() {
//       const validators = [1, 2]
//       const amount = web3.utils.toWei('200')
//       let fee = web3.utils.toWei('50')
//       const user = wallets[2].getAddressString()
//       await stakeToken.mint(user, amount)
//       await stakeToken.approve(stakeManager.address, amount, {
//         from: user
//       })
//       await stakeManager.stake(web3.utils.toWei('150'), fee, false, wallets[2].getPublicKeyString(), {
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
//       await stakeManager.checkSignatures(
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
//       let Receipt = await stakeManager.claimFee(
//         1,
//         0,
//         fee,
//         0,
//         utils.bufferToHex(Buffer.concat(tree.getProof(leaf))),
//         { from: wallets[2].getAddressString() }
//       )

//       let logs = logDecoder.decodeLogs(Receipt.receipt.rawLogs)
//       logs[0].event.should.equal('ClaimFee')
//       assertBigNumberEquality(await stakeToken.balanceOf(
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
//       await stakeManager.checkSignatures(
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
//       Receipt = await stakeManager.claimFee(
//         1,
//         0,
//         fee,
//         0,
//         utils.bufferToHex(Buffer.concat(tree.getProof(leaf))),
//         { from: wallets[2].getAddressString() }
//       )
//       logs = logDecoder.decodeLogs(Receipt.receipt.rawLogs)
//       logs[0].event.should.equal('ClaimFee')
//       assertBigNumberEquality(await stakeToken.balanceOf(
//         wallets[2].getAddressString()
//       ), fee)
//     })
//   })
// })

// contract('StakeManager:validator replacement', async function(accounts) {
//   let stakeToken
//   let stakeManager
//   let wallets

//   describe('validator replacement', async function() {
//     before(async function() {
//       wallets = generateFirstWallets(mnemonics, 10)
//       let contracts = await deployer.deployStakeManager(wallets)
//       stakeToken = contracts.stakeToken
//       stakeManager = contracts.stakeManager

//       await stakeManager.updateDynastyValue(8)
//       await stakeManager.updateCheckPointBlockInterval(1)

//       let amount = web3.utils.toWei('1000')
//       for (let i = 0; i < 2; i++) {
//         await stakeToken.mint(wallets[i].getAddressString(), amount)
//         await stakeToken.approve(stakeManager.address, amount, {
//           from: wallets[i].getAddressString()
//         })
//         await stakeManager.stake(amount, 0, false, wallets[i].getPublicKeyString(), {
//           from: wallets[i].getAddressString()
//         })
//       }
//       await stakeToken.mint(stakeManager.address, web3.utils.toWei('1000000'))// rewards amount
//       // cool down period
//       let auctionPeriod = await stakeManager.auctionPeriod()
//       let currentEpoch = await stakeManager.currentEpoch()
//       for (
//         let i = currentEpoch;
//         i <= auctionPeriod;
//         i++
//       ) {
//         // 2/3 majority vote
//         await checkPoint([wallets[0], wallets[1]], wallets[1], stakeManager, {
//           from: wallets[1].getAddressString()
//         })
//       }
//     })

//     it('should try auction start in non-auction period and fail', async function() {
//       const amount = web3.utils.toWei('1200')
//       await stakeToken.mint(wallets[3].getAddressString(), amount)
//       await stakeToken.approve(stakeManager.address, amount, {
//         from: wallets[3].getAddressString()
//       })
//       let auction = await stakeManager.validatorAuction(1)
//       let currentEpoch = await stakeManager.currentEpoch()
//       let dynasty = await stakeManager.dynasty()

//       for (let i = currentEpoch; i <= auction.startEpoch.add(dynasty); i++) {
//         // 2/3 majority vote
//         await checkPoint([wallets[0], wallets[1]], wallets[1], stakeManager, {
//           from: wallets[1].getAddressString()
//         })
//       }
//       try {
//         await stakeManager.startAuction(1, amount, {
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
//       await checkPoint([wallets[0], wallets[1]], wallets[1], stakeManager, {
//         from: wallets[1].getAddressString()
//       })

//       // start an auction from wallet[3]
//       await stakeToken.mint(wallets[3].getAddressString(), amount)
//       await stakeToken.approve(stakeManager.address, amount, {
//         from: wallets[3].getAddressString()
//       })

//       await stakeManager.startAuction(1, amount, {
//         from: wallets[3].getAddressString()
//       })

//       let auctionData = await stakeManager.validatorAuction(1)

//       assertBigNumberEquality(auctionData.amount, amount)
//       assert(
//         auctionData.user.toLowerCase ===
//         wallets[3].getAddressString().toLowerCase
//       )
//       amount = web3.utils.toWei('1250')
//       // outbid wallet[3] from wallet[4]
//       await stakeToken.mint(wallets[4].getAddressString(), amount)
//       await stakeToken.approve(stakeManager.address, amount, {
//         from: wallets[4].getAddressString()
//       })
//       const oldAuctionerBalanceBefore = await stakeToken.balanceOf(
//         wallets[3].getAddressString()
//       )

//       await stakeManager.startAuction(1, amount, {
//         from: wallets[4].getAddressString()
//       })

//       // Balance transfer to stakeManager
//       assertBigNumberEquality(
//         await stakeToken.balanceOf(wallets[4].getAddressString()),
//         '0'
//       )
//       const oldAuctionerBalance = await stakeToken.balanceOf(
//         wallets[3].getAddressString()
//       )

//       assertBigNumberEquality(
//         auctionData.amount.add(oldAuctionerBalanceBefore),
//         oldAuctionerBalance
//       )
//       auctionData = await stakeManager.validatorAuction(1)
//       assertBigNumberEquality(auctionData.amount, amount)
//       assert(
//         auctionData.user.toLowerCase() ===
//         wallets[4].getAddressString().toLowerCase()
//       )
//     })

//     it('should start auction where validator is last bidder', async function() {
//       const amount = web3.utils.toWei('1250')
//       let validator = await stakeManager.validators(2)
//       assert(
//         validator.signer.toLowerCase(),
//         wallets[3].getAddressString().toLowerCase()
//       )

//       await stakeToken.mint(validator.signer, amount)
//       await stakeToken.approve(stakeManager.address, amount, {
//         from: validator.signer
//       })

//       await stakeManager.startAuction(2, amount, {
//         from: validator.signer
//       })
//       const auctionData = await stakeManager.validatorAuction(2)
//       assertBigNumberEquality(auctionData.amount, amount)
//       assert(auctionData.user.toLowerCase() === validator.signer.toLowerCase())
//     })

//     it('should try to unstake in auction interval and fail', async function() {
//       try {
//         await stakeManager.unstake(1, {
//           from: wallets[0].getAddressString()
//         })
//         assert.fail('Unstaked in auction interval')
//       } catch (error) {
//         const invalidOpcode = error.message.search('revert') >= 0
//         assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
//       }
//     })

//     it('should try auction start after auctionPeriod period and fail', async function() {
//       let auctionData = await stakeManager.validatorAuction(1)
//       let auctionPeriod = await stakeManager.auctionPeriod()
//       let currentEpoch = await stakeManager.currentEpoch()

//       // fast forward to skip auctionPeriod
//       for (
//         let i = currentEpoch;
//         i <= auctionPeriod.add(currentEpoch);
//         i++
//       ) {
//         // 2/3 majority vote
//         await checkPoint([wallets[0], wallets[1]], wallets[1], stakeManager, {
//           from: wallets[1].getAddressString()
//         })
//       }
//       const amount = web3.utils.toWei('1300')
//       await stakeToken.mint(wallets[5].getAddressString(), amount)
//       await stakeToken.approve(stakeManager.address, amount, {
//         from: wallets[5].getAddressString()
//       })
//       try {
//         await stakeManager.startAuction(1, amount, {
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
//       const result = await stakeManager.confirmAuctionBid(
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
//       assert.ok(!(await stakeManager.isValidator(logs[4].args.oldValidatorId)))
//       assert.ok(await stakeManager.isValidator(logs[4].args.newValidatorId))
//     })

//     it('should confrim auction and secure the place for validator itself', async function() {
//       // let validator = await stakeManager.validators(2)
//       // let stake = validator.amount
//       // let balanceBefore = await stakeToken.balanceOf(validator.signer)
//       // console.log(await stakeManager.validatorAuction(2))
//       // console.log(await stakeManager.currentEpoch())
//       // const result = await stakeManager.confirmAuctionBid(
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
//       // let balanceAfter = await stakeToken.balanceOf(validator.signer)
//       // assertBigNumberEquality(balanceAfter.sub(balanceBefore), stake)
//     })
//   })
//   describe('validator replacement: skip a dynasty', async function() {
//     before(async function() {
//       wallets = generateFirstWallets(mnemonics, 10)
//       let contracts = await deployer.deployStakeManager(wallets)
//       stakeToken = contracts.stakeToken
//       stakeManager = contracts.stakeManager

//       await stakeManager.updateDynastyValue(8)
//       await stakeManager.updateCheckPointBlockInterval(1)

//       let amount = web3.utils.toWei('1000')
//       for (let i = 0; i < 2; i++) {
//         await stakeToken.mint(wallets[i].getAddressString(), amount)
//         await stakeToken.approve(stakeManager.address, amount, {
//           from: wallets[i].getAddressString()
//         })
//         await stakeManager.stake(amount, 0, false, wallets[i].getPublicKeyString(), {
//           from: wallets[i].getAddressString()
//         })
//       }
//       let dynasty = await stakeManager.dynasty()
//       // cool down period
//       let auctionPeriod = await stakeManager.auctionPeriod()
//       let currentEpoch = await stakeManager.currentEpoch()
//       for (
//         let i = currentEpoch;
//         i <= auctionPeriod.add(dynasty);
//         i++
//       ) {
//         // 2/3 majority vote
//         await checkPoint([wallets[0], wallets[1]], wallets[1], stakeManager, {
//           from: wallets[1].getAddressString()
//         })
//       }
//       await stakeToken.mint(stakeManager.address, web3.utils.toWei('1000000'))// rewards amount
//     })

//     it('should call confirmAuction at diffrent times', async function() {
//       let amount = web3.utils.toWei('1200')
//       // 2/3 majority vote
//       await checkPoint([wallets[0], wallets[1]], wallets[1], stakeManager, {
//         from: wallets[1].getAddressString()
//       })
//       // start an auction from wallet[3]
//       await stakeToken.mint(wallets[3].getAddressString(), amount)
//       await stakeToken.approve(stakeManager.address, amount, {
//         from: wallets[3].getAddressString()
//       })

//       await stakeManager.startAuction(1, amount, {
//         from: wallets[3].getAddressString()
//       })
//       let dynasty = await stakeManager.dynasty()

//       for (
//         let i = 0;
//         i <= dynasty;
//         i++
//       ) {
//         // 2/3 majority vote
//         await checkPoint([wallets[0], wallets[1]], wallets[1], stakeManager, {
//           from: wallets[1].getAddressString()
//         })
//       }

//       try {
//         await stakeManager.confirmAuctionBid(
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

//       await checkPoint([wallets[0], wallets[1]], wallets[1], stakeManager, {
//         from: wallets[1].getAddressString()
//       })
//       await checkPoint([wallets[0], wallets[1]], wallets[1], stakeManager, {
//         from: wallets[1].getAddressString()
//       })

//       const result = await stakeManager.confirmAuctionBid(
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
//       assert.ok(!(await stakeManager.isValidator(1)))
//     })
//   })
// })
// contract('StakeManager: Delegation', async function(accounts) {
//   let stakeToken
//   let stakeManager
//   let wallets

//   describe('validator:delegation', async function() {
//     before(async function() {
//       wallets = generateFirstWallets(mnemonics, 10)
//       let contracts = await deployer.deployStakeManager(wallets)
//       stakeToken = contracts.stakeToken
//       stakeManager = contracts.stakeManager

//       await stakeManager.updateDynastyValue(8)
//       await stakeManager.updateCheckPointBlockInterval(1)

//       let amount = web3.utils.toWei('1000')
//       for (let i = 0; i < 2; i++) {
//         await stakeToken.mint(wallets[i].getAddressString(), amount)
//         await stakeToken.approve(stakeManager.address, amount, {
//           from: wallets[i].getAddressString()
//         })
//         await stakeManager.stake(amount, 0, true, wallets[i].getPublicKeyString(), {
//           from: wallets[i].getAddressString()
//         })
//       }
//       // cool down period
//       let auctionPeriod = await stakeManager.auctionPeriod()
//       let currentEpoch = await stakeManager.currentEpoch()
//       for (
//         let i = currentEpoch;
//         i <= auctionPeriod;
//         i++
//       ) {
//         // 2/3 majority vote
//         await checkPoint([wallets[0], wallets[1]], wallets[1], stakeManager, {
//           from: wallets[1].getAddressString()
//         })
//       }
//     })

//     it('should test reStake with rewards', async function() {
//       const user = wallets[0].getAddressString()
//       const amount = web3.utils.toWei('100')
//       await stakeToken.mint(user, amount)
//       await stakeToken.approve(stakeManager.address, amount, {
//         from: user
//       })

//       let validator = await stakeManager.validators(1)
//       let validatorContract = await ValidatorShare.at(validator.contractAddress)
//       let stakeReceipt = await stakeManager.restake(1, amount, true, {
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
//       await stakeToken.mint(stakeManager.address, web3.utils.toWei('1000000'))// rewards amount
//       await stakeToken.mint(val, amount)
//       await stakeToken.approve(stakeManager.address, amount, {
//         from: val
//       })
//       await stakeManager.stake(amount, 0, true, wallets[4].getPublicKeyString(), {
//         from: val
//       })
//       let validator = await stakeManager.validators(3)
//       let validatorContract = await ValidatorShare.at(validator.contractAddress)
//       await stakeToken.mint(delegator, amount)
//       await stakeToken.approve(stakeManager.address, amount, {
//         from: delegator
//       })
//       await validatorContract.buyVoucher(amount, { from: delegator })
//       amount = web3.utils.toWei('2555')
//       const auctionVal = wallets[5].getAddressString()
//       await stakeToken.mint(auctionVal, amount)
//       await stakeToken.approve(stakeManager.address, amount, {
//         from: auctionVal
//       })

//       await stakeManager.startAuction(3, amount, {
//         from: auctionVal
//       })
//       let auctionPeriod = await stakeManager.auctionPeriod()
//       for (
//         let i = 0;
//         i <= auctionPeriod;
//         i++
//       ) {
//         // 2/3 majority vote
//         await checkPoint([wallets[0], wallets[1], wallets[4]], wallets[1], stakeManager, {
//           from: wallets[1].getAddressString()
//         })
//       }
//       await stakeManager.confirmAuctionBid(
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
