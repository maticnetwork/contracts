import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import utils from 'ethereumjs-util'

import {
  StakeManager,
  DummyERC20,
  ValidatorContract
} from '../helpers/artifacts'

import logDecoder from '../helpers/log-decoder.js'
import { rewradsTree } from '../helpers/proofs.js'

import {
  checkPoint,
  assertBigNumbergt,
  assertBigNumberEquality,
  buildSubmitHeaderBlockPaylod
} from '../helpers/utils.js'
import { generateFirstWallets, mnemonics } from '../helpers/wallets.js'

chai.use(chaiAsPromised).should()

contract('StakeManager', async functionaccounts) {
  let stakeToken
  let stakeManager
  let wallets
  // let logDecoder
  let owner = accounts[0]

  // staking
  describe('Stake', async function) {
    before(async function) {
      wallets = generateFirstWallets(mnemonics, 10)
      stakeToken = await DummyERC20.new('Stake Token', 'STAKE')
      stakeManager = await StakeManager.new(
        stakeToken.address,
        wallets[1].getAddressString()
      ) // dummy registry address
      await stakeManager.setToken(stakeToken.address)

      // transfer tokens to other accounts
      await stakeToken.mint(
        wallets[0].getAddressString(),
        web3.utils.toWei('1200')
      )
      await stakeToken.mint(
        wallets[1].getAddressString(),
        web3.utils.toWei('800')
      )
      await stakeToken.mint(
        wallets[2].getAddressString(),
        web3.utils.toWei('805')
      )
      await stakeToken.mint(
        wallets[3].getAddressString(),
        web3.utils.toWei('850')
      )
      await stakeToken.mint(
        wallets[4].getAddressString(),
        web3.utils.toWei('800')
      )
      await stakeToken.mint(
        wallets[5].getAddressString(),
        web3.utils.toWei('800')
      )
      await stakeToken.mint(
        wallets[6].getAddressString(),
        web3.utils.toWei('800')
      )
      await stakeToken.mint(
        wallets[7].getAddressString(),
        web3.utils.toWei('800')
      )
      await stakeToken.mint(
        wallets[8].getAddressString(),
        web3.utils.toWei('800')
      )
      await stakeToken.mint(
        wallets[9].getAddressString(),
        web3.utils.toWei('800')
      )
    })

    it('should set the validator threshold to 5, dynasty value to 2 epochs', async function) {
      const thresholdReceipt = await stakeManager.updateValidatorThreshold(5, {
        from: owner
      })
      const logs = logDecoder.decodeLogs(thresholdReceipt.receipt.rawLogs)
      logs.should.have.lengthOf(1)
      logs[0].event.should.equal('ThresholdChange')
      assertBigNumberEquality(logs[0].args.newThreshold, '5')
      // logs[0].args.newThreshold.should.be.bignumber.equal(5)

      const newThreshold = await stakeManager.validatorThreshold()
      // newThreshold.should.be.bignumber.equal(5)
      assertBigNumberEquality(newThreshold, '5')

      const dynastyReceipt = await stakeManager.updateDynastyValue(2, {
        from: owner
      })
      const logs1 = logDecoder.decodeLogs(dynastyReceipt.receipt.rawLogs)
      logs1.should.have.lengthOf(1)
      logs1[0].event.should.equal('DynastyValueChange')
      assertBigNumberEquality(logs1[0].args.newDynasty, '2')
      // logs1[0].args.oldDynasty.should.be.bignumber.equal(250)
    })

    it('should set token address and owner properly', async function) {
      await stakeManager.token().should.eventually.equal(stakeToken.address)
      await stakeManager.owner().should.eventually.equal(owner)
    })

    it('should stake via wallets[1]', async function) {
      const user = wallets[1].getAddressString()
      const amount = web3.utils.toWei('200')

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })
      // stake now
      let stakeReceipt = await stakeManager.stake(amount, user, false, {
        from: user
      })
      // decode logs
      const logs = logDecoder.decodeLogs(stakeReceipt.receipt.rawLogs)

      logs.should.have.lengthOf(2)

      // logs[0].event.should.equal('Transfer')
      // logs[0].args.from.toLowerCase().should.equal(user)
      // logs[0].args.to.toLowerCase().should.equal(stakeManager.address)
      // assertBigNumberEquality(logs[0].args.value, amount)

      logs[1].event.should.equal('Staked')
      logs[1].args.signer.toLowerCase().should.equal(user)
      // logs[2].args.amount.should.be.bignumber.equal(amount)
    })

    it('should stake via wallets[2]', async function) {
      const user = wallets[2].getAddressString()
      const amount = web3.utils.toWei('250')

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      const stakeReceipt = await stakeManager.stake(amount, user, false, {
        from: user
      })

      // decode logs
      const logs = logDecoder.decodeLogs(stakeReceipt.receipt.rawLogs)
      logs.should.have.lengthOf(2)

      // logs[0].event.should.equal('Transfer')
      // logs[0].args.from.toLowerCase().should.equal(user)
      // logs[0].args.to.toLowerCase().should.equal(stakeManager.address)
      // logs[0].args.value.should.be.bignumber.equal(amount)
      // assertBigNumberEquality(logs[0].args.value, amount)

      logs[1].event.should.equal('Staked')
      logs[1].args.signer.toLowerCase().should.equal(user)
      // logs[2].args.amount.should.be.bignumber.equal(amount)
      assertBigNumberEquality(logs[1].args.amount, amount)

      // staked for
      const stakedFor = await stakeManager.totalStakedFor(user)
      assertBigNumberEquality(stakedFor, amount)
      // stakedFor.should.be.bignumber.equal(amount)
    })

    it('should stake via wallets[3]', async function) {
      const user = wallets[3].getAddressString()
      const amount = web3.utils.toWei('300')

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(amount, user, false, { from: user })
      // staked for
      const stakedFor = await stakeManager.totalStakedFor(user)
      // stakedFor.should.be.bignumber.equal(amount)
      assertBigNumberEquality(stakedFor, amount)

      const validatorId = await stakeManager.getValidatorId(user)

      const value = await stakeManager.isValidator(validatorId.toString())
      assert.isTrue(value)
    })

    it('Duplicate: should stake via wallets[3] fail', async function) {
      const user = wallets[3].getAddressString()
      const amount = web3.utils.toWei('30')

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      try {
        await stakeManager.stake(amount, user, false, {
          from: user
        })
        assert.fail('Should never allow second time staking')
      } catch (error) {
        const invalidOpcode = error.message.search('revert') >= 0
        assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
      }

      // staked for
      const stakedFor = await stakeManager.totalStakedFor(user)
      assertBigNumberEquality(stakedFor, web3.utils.toWei('300'))
      // stakedFor.should.be.bignumber.equal(web3.utils.toWei(300))
    })

    it('should stake via wallets[4-5]', async function) {
      let user = wallets[4].getAddressString()
      let amount = web3.utils.toWei('750')

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(amount, user, false, { from: user })

      // staked for
      let stakedFor = await stakeManager.totalStakedFor(user)
      assertBigNumberEquality(stakedFor, amount)
      // stakedFor.should.be.bignumber.equal(amount)

      user = wallets[5].getAddressString()
      amount = web3.utils.toWei('740')

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(amount, user, false, { from: user })

      // staked for
      stakedFor = await stakeManager.totalStakedFor(user)
      // stakedFor.should.be.bignumber.equal(amount)
      assertBigNumberEquality(stakedFor, amount)
      const validatorId = await stakeManager.getValidatorId(user)
      const stakerDetails = await stakeManager.getStakerDetails(validatorId)
      stakerDetails[3].toLowerCase().should.equal(user)
    })

    it('should update and verify signer/pubkey', async function) {
      let user = wallets[5].getAddressString()
      let w = [wallets[1], wallets[2], wallets[3], wallets[4]]
      await checkPoint(w, wallets[1], stakeManager)

      // await stakeManager.finalizeCommit({ from: wallets[1].getAddressString() })

      let signer = wallets[0].getAddressString()
      const validatorId = await stakeManager.getValidatorId(user)
      let signerReceipt = await stakeManager.updateSigner(validatorId, signer, {
        from: user
      })
      const logs = logDecoder.decodeLogs(signerReceipt.receipt.rawLogs)
      logs.should.have.lengthOf(1)
      logs[0].event.should.equal('SignerChange')

      // staked for
      let stakerDetails = await stakeManager.getStakerDetails(validatorId)
      stakerDetails[3].toLowerCase().should.equal(signer)

      signerReceipt = await stakeManager.updateSigner(validatorId, user, {
        from: user
      })
      logs.should.have.lengthOf(1)
      logs[0].event.should.equal('SignerChange')

      // staked for
      stakerDetails = await stakeManager.getStakerDetails(validatorId)
      stakerDetails[3].toLowerCase().should.equal(user)
    })

    it('should try to stake after validator threshold', async function) {
      const user = wallets[6].getAddressString()
      const amount = web3.utils.toWei('100')

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      try {
        await stakeManager.stake(amount, user, false, {
          from: user
        })
        assert.fail('Should not allow more validators then validator threshold')
      } catch (error) {
        const invalidOpcode = error.message.search('revert') >= 0
        assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
        return
      }
      // staked for
      const stakedFor = await stakeManager.totalStakedFor(user)
      // stakedFor.should.be.bignumber.equal(0)
      assertBigNumberEquality(stakedFor, '0')
    })

    it('should verify running total stake to be correct', async function) {
      const stake = await stakeManager.currentValidatorSetTotalStake()
      // stake.should.be.bignumber.equal(web3.utils.toWei(2240))
      assertBigNumberEquality(stake, web3.utils.toWei('2240'))
      const validators = await stakeManager.getCurrentValidatorSet()
      validators.should.have.lengthOf(5)
    })
    it('should unstake via wallets[2]', async function) {
      const user = wallets[2].getAddressString()
      const amount = web3.utils.toWei('250')

      const validatorId = await stakeManager.getValidatorId(user)
      // stake now
      const receipt = await stakeManager.unstake(validatorId, {
        from: user
      })
      const logs = logDecoder.decodeLogs(receipt.receipt.rawLogs)

      logs[0].event.should.equal('UnstakeInit')
      logs[0].args.user.toLowerCase().should.equal(user)
      // logs[0].args.amount.should.be.bignumber.equal(amount)
      assertBigNumberEquality(logs[0].args.amount, amount)
      // logs[0].args.validatorId.should.be.bignumber.equal(validatorId)
      assertBigNumberEquality(logs[0].args.validatorId, validatorId)
    })

    it('should unstake via wallets[3] after 2 epoch', async function) {
      const user = wallets[3].getAddressString()
      const amount = web3.utils.toWei('300')
      let w = [wallets[1], wallets[3], wallets[4], wallets[5]]

      await checkPoint(w, wallets[1], stakeManager)
      await checkPoint(w, wallets[1], stakeManager)
      // await stakeManager.finalizeCommit({ from: wallets[1].getAddressString() })
      // await stakeManager.finalizeCommit({ from: wallets[1].getAddressString() })

      const validatorId = await stakeManager.getValidatorId(user)
      // stake now
      const receipt = await stakeManager.unstake(validatorId, {
        from: user
      })
      const logs = logDecoder.decodeLogs(receipt.receipt.rawLogs)

      logs[0].event.should.equal('UnstakeInit')
      logs[0].args.user.toLowerCase().should.equal(user)
      // logs[0].args.amount.should.be.bignumber.equal(amount)
      assertBigNumberEquality(logs[0].args.amount, amount)
      // logs[0].args.validatorId.should.be.bignumber.equal(validatorId)
      assertBigNumberEquality(logs[0].args.validatorId, validatorId)
    })
    it('should set the validator threshold to 6, dynasty value to 2 epochs', async function) {
      const thresholdReceipt = await stakeManager.updateValidatorThreshold(6, {
        from: owner
      })
      const logs = logDecoder.decodeLogs(thresholdReceipt.receipt.rawLogs)
      logs.should.have.lengthOf(1)
      logs[0].event.should.equal('ThresholdChange')
      // logs[0].args.newThreshold.should.be.bignumber.equal(6)
      assertBigNumberEquality(logs[0].args.newThreshold, '6')

      const newThreshold = await stakeManager.validatorThreshold()
      assertBigNumberEquality(newThreshold, '6')
    })

    it('should stake via wallets[6]', async function) {
      const user = wallets[6].getAddressString()
      const amount = web3.utils.toWei('400')
      let w = [wallets[1], wallets[5], wallets[4]]

      await checkPoint(w, wallets[1], stakeManager)
      await checkPoint(w, wallets[1], stakeManager)
      await checkPoint(w, wallets[1], stakeManager)
      await checkPoint(w, wallets[1], stakeManager)

      // await stakeManager.finalizeCommit({ from: wallets[1].getAddressString() })
      // await stakeManager.finalizeCommit({ from: wallets[1].getAddressString() })
      // await stakeManager.finalizeCommit({ from: wallets[1].getAddressString() })
      // await stakeManager.finalizeCommit({ from: wallets[1].getAddressString() })

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      await stakeManager.stake(amount, user, false, {
        from: user
      })
    })

    it('should stake via wallets[7]', async function) {
      let user = wallets[7].getAddressString()
      let amount = web3.utils.toWei('450')

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(amount, user, false, {
        from: user
      })
      user = wallets[0].getAddressString()
      amount = web3.utils.toWei('850')

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      let result = await stakeManager.stake(amount, user, false, {
        from: user
      })
    })

    it('should verify unstaked amount', async function) {
      const ValidatorId2 = await stakeManager.getValidatorId(
        wallets[2].getAddressString()
      )
      const ValidatorId3 = await stakeManager.getValidatorId(
        wallets[3].getAddressString()
      )
      await stakeManager.unstakeClaim(ValidatorId2, {
        from: wallets[2].getAddressString()
      })
      let w = [wallets[1], wallets[5], wallets[6], wallets[7], wallets[4]]
      await checkPoint(w, wallets[1], stakeManager, {
        from: wallets[1].getAddressString()
      })

      // await stakeManager.finalizeCommit({ from: wallets[1].getAddressString() })
      await stakeManager.unstakeClaim(ValidatorId3, {
        from: wallets[3].getAddressString()
      })
      let balance = await stakeToken.balanceOf(wallets[2].getAddressString())
      // balance.should.be.bignumber.equal(web3.utils.toWei(805))
      assertBigNumberEquality(balance, web3.utils.toWei('805'))
      balance = await stakeToken.balanceOf(wallets[3].getAddressString())
      // balance.should.be.bignumber.equal(web3.utils.toWei(850))
      assertBigNumberEquality(balance, web3.utils.toWei('850'))
    })

    it('should verify running total stake to be correct', async function) {
      const amount = web3.utils.toWei('3390')
      //   const currentEpoch = await stakeManager.currentEpoch()
      const stake = await stakeManager.currentValidatorSetTotalStake()
      // stake.should.be.bignumber.equal(amount)
      assertBigNumberEquality(stake, amount)
      const validators = await stakeManager.getCurrentValidatorSet()
      validators.should.have.lengthOf(6)
      // validators.sort()
      // console.log(validators)
      // const users = [
      //   await stakeManager.getValidatorId(wallets[1].getAddressString()),
      //   await stakeManager.getValidatorId(wallets[4].getAddressString()),
      //   await stakeManager.getValidatorId(wallets[5].getAddressString()),
      //   await stakeManager.getValidatorId(wallets[6].getAddressString()),
      //   await stakeManager.getValidatorId(wallets[7].getAddressString()),
      //   await stakeManager.getValidatorId(wallets[0].getAddressString())
      // ]
      // console.log(users)
      // expect(validators).to.equal(users)
    })

    it('should create sigs properly', async function) {
      // dummy vote data
      let w = [wallets[0], wallets[4], wallets[6], wallets[7], wallets[5]]
      await checkPoint(w, wallets[1], stakeManager, {
        from: wallets[1].getAddressString()
      })
    })
  })
})

contract('StakeManager:rewards distribution', async functionaccounts) {
  let stakeToken
  let stakeManager
  let wallets
  let accountState = {}
  const rewardsAmount = 5

  describe('staking rewards', async function) {
    before(async function) {
      wallets = generateFirstWallets(mnemonics, 2)
      stakeToken = await DummyERC20.new('Stake Token', 'STAKE')
      stakeManager = await StakeManager.new(
        stakeToken.address,
        wallets[0].getAddressString()
      ) // dummy registry address
      await stakeManager.setToken(stakeToken.address)

      let amount = web3.utils.toWei('1000')
      for (let i = 0; i < 2; i++) {
        await stakeToken.mint(wallets[i].getAddressString(), amount)
        await stakeToken.approve(stakeManager.address, amount, {
          from: wallets[i].getAddressString()
        })
        await stakeManager.stake(amount, wallets[i].getAddressString(), false, {
          from: wallets[i].getAddressString()
        })
        accountState[i + 1] = rewardsAmount
      }
    })

    it('should get rewards for validator [1, 2]', async function) {
      const validators = [1, 2]
      let tree = await rewradsTree(validators, accountState)
      const { vote, sigs } = buildSubmitHeaderBlockPaylod(
        accounts[0],
        0,
        22,
        '' /* root */,
        wallets,
        { rewardsRootHash: tree.getRoot(), allValidators: true, getSigs: true }
      )

      // 2/3 majority vote
      await stakeManager.checkSignatures(
        1,
        utils.bufferToHex(utils.keccak256(vote)),
        utils.bufferToHex(tree.getRoot()),
        sigs
      )
      const leaf = utils.keccak256(
        web3.eth.abi.encodeParameters(
          ['uint256', 'uint256'],
          [1, accountState[1]]
        )
      )
      await stakeManager.claimRewards(
        1,
        rewardsAmount,
        0,
        utils.bufferToHex(Buffer.concat(tree.getProof(leaf)))
      )
      let validator = await stakeManager.validators(1)
      assertBigNumberEquality(validator.reward, rewardsAmount)
      const beforeBalance = await stakeToken.balanceOf(
        wallets[1].getAddressString()
      )
      await stakeManager.withdrawRewards(1, {
        from: wallets[1].getAddressString()
      })
      const afterBalance = await stakeToken.balanceOf(
        wallets[1].getAddressString()
      )
      assertBigNumbergt(afterBalance, beforeBalance)
    })
  })
})

contract('StakeManager:validator contract rewards distribution', async function
  accounts
) {
  let stakeToken
  let stakeManager
  let wallets
  let accountState = {}
  const rewardsAmount = 5

  describe('staking rewards', async function) {
    before(async function) {
      wallets = generateFirstWallets(mnemonics, 2)
      stakeToken = await DummyERC20.new('Stake Token', 'STAKE')
      stakeManager = await StakeManager.new(
        stakeToken.address,
        wallets[0].getAddressString()
      ) // dummy registry address
      await stakeManager.setToken(stakeToken.address)

      let amount = web3.utils.toWei('1000')
      for (let i = 0; i < 2; i++) {
        await stakeToken.mint(wallets[i].getAddressString(), amount)
        await stakeToken.approve(stakeManager.address, amount, {
          from: wallets[i].getAddressString()
        })
        await stakeManager.stake(amount, wallets[i].getAddressString(), true, {
          from: wallets[i].getAddressString()
        })
        accountState[i + 1] = rewardsAmount
      }
    })

    it('should get rewards for validator 1 with ValidatorContract/delegation on', async function) {
      const validators = [1, 2]
      let tree = await rewradsTree(validators, accountState)
      const { vote, sigs } = buildSubmitHeaderBlockPaylod(
        accounts[0],
        0,
        22,
        '' /* root */,
        wallets,
        {
          rewardsRootHash: tree.getRoot(),
          allValidators: true,
          getSigs: true
        }
      )

      // 2/3 majority vote
      await stakeManager.checkSignatures(
        1,
        utils.bufferToHex(utils.keccak256(vote)),
        utils.bufferToHex(tree.getRoot()),
        sigs
      )
      const leaf = utils.keccak256(
        web3.eth.abi.encodeParameters(
          ['uint256', 'uint256'],
          [1, accountState[1]]
        )
      )
      await stakeManager.claimRewards(
        1,
        rewardsAmount,
        0,
        utils.bufferToHex(Buffer.concat(tree.getProof(leaf)))
      )
      let validator = await stakeManager.validators(1)
      let contractV = await ValidatorContract.at(validator.contractAddress)

      assertBigNumberEquality(
        accountState[1],
        await contractV.validatorRewards()
      )
      const beforeBalance = await stakeToken.balanceOf(
        wallets[1].getAddressString()
      )

      await stakeManager.withdrawRewards(1, {
        from: wallets[1].getAddressString()
      })
      const afterBalance = await stakeToken.balanceOf(
        wallets[1].getAddressString()
      )
      assertBigNumbergt(afterBalance, beforeBalance)
    })
  })
})

contract('StakeManager:validator replacement', async functionaccounts) {
  let stakeToken
  let stakeManager
  let wallets
  let accountState = {}
  const rewardsAmount = 5

  describe('validator replacement', async function) {
    before(async function) {
      wallets = generateFirstWallets(mnemonics, 10)
      stakeToken = await DummyERC20.new('Stake Token', 'STAKE')
      stakeManager = await StakeManager.new(
        stakeToken.address,
        wallets[0].getAddressString()
      ) // dummy registry address
      await stakeManager.setToken(stakeToken.address)
      await stakeManager.updateDynastyValue(8)

      let amount = web3.utils.toWei('1000')
      for (let i = 0; i < 2; i++) {
        await stakeToken.mint(wallets[i].getAddressString(), amount)
        await stakeToken.approve(stakeManager.address, amount, {
          from: wallets[i].getAddressString()
        })
        await stakeManager.stake(amount, wallets[i].getAddressString(), false, {
          from: wallets[i].getAddressString()
        })
        accountState[i + 1] = rewardsAmount
      }
    })

    it('should try auction start in non-auction period and fail', async function) {
      const amount = web3.utils.toWei('1200')
      await stakeToken.mint(wallets[3].getAddressString(), amount)
      await stakeToken.approve(stakeManager.address, amount, {
        from: wallets[3].getAddressString()
      })
      try {
        await stakeManager.startAuction(1, amount, {
          from: wallets[3].getAddressString()
        })
        assert.fail('Auction started in non-auction period')
      } catch (error) {
        const invalidOpcode = error.message.search('revert') >= 0
        assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
      }
    })

    it('should start Auction and bid multiple times', async function) {
      let amount = web3.utils.toWei('1200')
      const { vote, sigs } = buildSubmitHeaderBlockPaylod(
        accounts[0],
        0,
        22,
        '' /* root */,
        wallets,
        {
          rewardsRootHash: '',
          allValidators: true,
          getSigs: true
        }
      )
      let auction = await stakeManager.validatorAuction(1)
      let currentEpoch = await stakeManager.currentEpoch()
      for (let i = currentEpoch; i <= auction.startEpoch; i++) {
        // 2/3 majority vote
        await stakeManager.checkSignatures(
          1,
          utils.bufferToHex(utils.keccak256(vote)),
          utils.bufferToHex(''),
          sigs
        )
      }

      // start an auction from wallet[3]
      await stakeToken.mint(wallets[3].getAddressString(), amount)
      await stakeToken.approve(stakeManager.address, amount, {
        from: wallets[3].getAddressString()
      })
      await stakeManager.startAuction(1, amount, {
        from: wallets[3].getAddressString()
      })

      let auctionData = await stakeManager.validatorAuction(1)
      assertBigNumberEquality(auctionData.amount, amount)
      assert(
        auctionData.user.toLowerCase ===
        wallets[3].getAddressString().toLowerCase
      )
      amount = web3.utils.toWei('1250')
      // outbid wallet[3] from wallet[4]
      await stakeToken.mint(wallets[4].getAddressString(), amount)
      await stakeToken.approve(stakeManager.address, amount, {
        from: wallets[4].getAddressString()
      })
      const oldAuctionerBalanceBefore = await stakeToken.balanceOf(
        wallets[3].getAddressString()
      )
      await stakeManager.startAuction(1, amount, {
        from: wallets[4].getAddressString()
      })
      // Balance transfer to stakeManager
      assertBigNumberEquality(
        await stakeToken.balanceOf(wallets[4].getAddressString()),
        '0'
      )
      const oldAuctionerBalance = await stakeToken.balanceOf(
        wallets[3].getAddressString()
      )

      assertBigNumberEquality(
        auctionData.amount.add(oldAuctionerBalanceBefore),
        oldAuctionerBalance
      )
      auctionData = await stakeManager.validatorAuction(1)
      assertBigNumberEquality(auctionData.amount, amount)
      assert(
        auctionData.user.toLowerCase() ===
        wallets[4].getAddressString().toLowerCase()
      )
    })

    it('should start auction where validator is last bidder', async function) {
      const amount = web3.utils.toWei('1250')
      let validator = await stakeManager.validators(2)
      assert(
        validator.signer.toLowerCase(),
        wallets[3].getAddressString().toLowerCase()
      )

      await stakeToken.mint(validator.signer, amount)
      await stakeToken.approve(stakeManager.address, amount, {
        from: validator.signer
      })

      await stakeManager.startAuction(2, amount, {
        from: validator.signer
      })
      const auctionData = await stakeManager.validatorAuction(2)
      assertBigNumberEquality(auctionData.amount, amount)
      assert(auctionData.user.toLowerCase() === validator.signer.toLowerCase())
    })

    it('should try to unstake in auction interval and fail', async function) {
      try {
        await stakeManager.unstake(1, {
          from: wallets[0].getAddressString()
        })
        assert.fail('Unstaked in auction interval')
      } catch (error) {
        const invalidOpcode = error.message.search('revert') >= 0
        assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
      }
    })

    it('should try auction start after auctionPeriod period and fail', async function) {
      const { vote, sigs } = buildSubmitHeaderBlockPaylod(
        accounts[0],
        0,
        22,
        '' /* root */,
        wallets,
        {
          rewardsRootHash: '',
          allValidators: true,
          getSigs: true
        }
      )
      let auctionData = await stakeManager.validatorAuction(1)
      let auctionPeriod = await stakeManager.auctionPeriod()
      let currentEpoch = await stakeManager.currentEpoch()

      // fast forward to skip auctionPeriod
      for (
        let i = currentEpoch;
        i <= auctionPeriod.add(auctionData.startEpoch);
        i++
      ) {
        // 2/3 majority vote
        await stakeManager.checkSignatures(
          1,
          utils.bufferToHex(utils.keccak256(vote)),
          utils.bufferToHex(''),
          sigs
        )
      }
      const amount = web3.utils.toWei('1300')
      await stakeToken.mint(wallets[5].getAddressString(), amount)
      await stakeToken.approve(stakeManager.address, amount, {
        from: wallets[5].getAddressString()
      })
      try {
        await stakeManager.startAuction(1, amount, {
          from: wallets[5].getAddressString()
        })
        assert.fail('Test should fail due to invalid auction period')
      } catch (error) {
        const invalidOpcode = error.message.search('revert') >= 0
        const errorMessage = error.message.search('Invalid auction period') >= 0
        assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
        assert(
          errorMessage,
          "Expected 'Invalid auction period', got '" + error + "' instead"
        )
      }
    })

    it('should confrim auction and secure the place', async function) {
      const result = await stakeManager.confirmAuctionBid(
        1,
        wallets[4].getAddressString(),
        false,
        {
          from: wallets[4].getAddressString()
        }
      )
      const logs = result.receipt.logs

      logs[2].event.should.equal('Staked')
      logs[3].event.should.equal('ConfirmAuction')

      assertBigNumberEquality(logs[3].args.amount, web3.utils.toWei('1250'))
      assert.ok(!(await stakeManager.isValidator(logs[3].args.oldValidatorId)))
      assert.ok(await stakeManager.isValidator(logs[3].args.newValidatorId))
    })

    it('should confrim auction and secure the place for validator itself', async function) {
      let validator = await stakeManager.validators(2)
      let stake = validator.amount
      let balanceBefore = await stakeToken.balanceOf(validator.signer)

      const result = await stakeManager.confirmAuctionBid(
        2,
        validator.signer,
        false,
        {
          from: validator.signer
        }
      )
      const logs = result.receipt.logs

      logs[1].event.should.equal('ConfirmAuction')

      assertBigNumberEquality(logs[1].args.amount, web3.utils.toWei('1250'))
      assertBigNumberEquality(
        logs[1].args.oldValidatorId,
        logs[1].args.newValidatorId
      )

      // test if validator got the diff balance back
      let balanceAfter = await stakeToken.balanceOf(validator.signer)
      assertBigNumberEquality(balanceAfter.sub(balanceBefore), stake)
    })
    // TODO: add more tests with delegation enabled
  })
})
