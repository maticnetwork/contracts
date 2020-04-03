import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import utils from 'ethereumjs-util'

import {
  StakeManager,
  DummyERC20,
  StakingInfo,
  ValidatorShare,
  ValidatorShareFactory
} from '../helpers/artifacts'

import deployer from '../helpers/deployer.js'
import logDecoder from '../helpers/log-decoder.js'
import { rewradsTreeFee } from '../helpers/proofs.js'

import {
  checkPoint,
  assertBigNumbergt,
  assertBigNumberEquality,
  buildSubmitHeaderBlockPaylod
} from '../helpers/utils.js'
import { generateFirstWallets, mnemonics } from '../helpers/wallets.js'

chai.use(chaiAsPromised).should()

contract('StakeManager', async function (accounts) {
  let stakeToken
  let stakeManager
  let wallets
  // let logDecoder
  let owner = accounts[0]

  // staking
  describe('Stake', async function () {
    before(async function () {
      wallets = generateFirstWallets(mnemonics, 10)
      let contracts = await deployer.deployStakeManager(wallets)
      stakeToken = contracts.stakeToken
      stakeManager = contracts.stakeManager

      // dummy registry address
      await stakeManager.updateCheckPointBlockInterval(1)
      // transfer tokens to other accounts
      await stakeToken.mint(
        wallets[0].getAddressString(),
        web3.utils.toWei('1200')
      )
      await stakeToken.mint(
        wallets[1].getAddressString(),
        web3.utils.toWei('1200')
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
        web3.utils.toWei('90000')
      )
      // rewards transfer
      await stakeToken.transfer(stakeManager.address, web3.utils.toWei('90000'), {
        from: wallets[9].getAddressString()
      })

    })

    it('should set the validator threshold to 5, dynasty value to 2 epochs', async function () {
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

    it('should set token address and owner properly', async function () {
      await stakeManager.token().should.eventually.equal(stakeToken.address)
      await stakeManager.owner().should.eventually.equal(owner)
    })

    it('should stake via wallets[1]', async function () {
      const user = wallets[1].getAddressString()
      const userPubkey = wallets[1].getPublicKeyString()
      const amount = web3.utils.toWei('200')

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })
      // stake now
      let stakeReceipt = await stakeManager.stake(amount, 0, false, userPubkey, {
        from: user
      })
      // decode logs
      const logs = logDecoder.decodeLogs(stakeReceipt.receipt.rawLogs)

      logs.should.have.lengthOf(3)

      // logs[0].event.should.equal('Transfer')
      // logs[0].args.from.toLowerCase().should.equal(user)
      // logs[0].args.to.toLowerCase().should.equal(stakeManager.address)
      // assertBigNumberEquality(logs[0].args.value, amount)

      logs[1].event.should.equal('Staked')
      logs[1].args.signerPubkey.toLowerCase().should.equal(userPubkey.toLowerCase())
      // logs[2].args.amount.should.be.bignumber.equal(amount)
    })

    it('should stake via wallets[2] and restake', async function () {
      const user = wallets[2].getAddressString()
      const userPubkey = wallets[2].getPublicKeyString()
      const amount = web3.utils.toWei('250')

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      const stakeReceipt = await stakeManager.stake(web3.utils.toWei('150'), 0, false, userPubkey, {
        from: user
      })

      // decode logs
      const logs = logDecoder.decodeLogs(stakeReceipt.receipt.rawLogs)
      logs.should.have.lengthOf(3)

      // logs[0].event.should.equal('Transfer')
      // logs[0].args.from.toLowerCase().should.equal(user)
      // logs[0].args.to.toLowerCase().should.equal(stakeManager.address)
      // logs[0].args.value.should.be.bignumber.equal(amount)
      // assertBigNumberEquality(logs[0].args.value, amount)

      logs[1].event.should.equal('Staked')
      logs[1].args.signerPubkey.toLowerCase().should.equal(userPubkey.toLowerCase())
      logs[1].args.signer.toLowerCase().should.equal(user.toLowerCase())
      // logs[2].args.amount.should.be.bignumber.equal(amount)
      assertBigNumberEquality(logs[1].args.amount, web3.utils.toWei('150'))

      await stakeManager.restake(logs[1].args.validatorId, web3.utils.toWei('100'), false, {
        from: user
      })
      // staked for
      const stakedFor = await stakeManager.totalStakedFor(user)
      assertBigNumberEquality(stakedFor, amount)
      // stakedFor.should.be.bignumber.equal(amount)
    })
    it('should stake via wallets[3]', async function () {
      const user = wallets[3].getAddressString()
      const userPubkey = wallets[3].getPublicKeyString()
      const amount = web3.utils.toWei('300')

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(amount, 0, false, userPubkey, { from: user })
      // staked for
      const stakedFor = await stakeManager.totalStakedFor(user)
      // stakedFor.should.be.bignumber.equal(amount)
      assertBigNumberEquality(stakedFor, amount)

      const validatorId = await stakeManager.getValidatorId(user)

      const value = await stakeManager.isValidator(validatorId.toString())
      assert.isTrue(value)
    })

    it('Duplicate: should stake via wallets[3] fail', async function () {
      const user = wallets[3].getAddressString()
      const userPubkey = wallets[3].getPublicKeyString()
      const amount = web3.utils.toWei('30')

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      try {
        await stakeManager.stake(amount, 0, false, userPubkey, {
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

    it('should stake via wallets[4-5]', async function () {
      let user = wallets[4].getAddressString()
      let userPubkey = wallets[4].getPublicKeyString()
      let amount = web3.utils.toWei('750')

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(amount, 0, false, userPubkey, { from: user })

      // staked for
      let stakedFor = await stakeManager.totalStakedFor(user)
      assertBigNumberEquality(stakedFor, amount)
      // stakedFor.should.be.bignumber.equal(amount)

      user = wallets[5].getAddressString()
      userPubkey = wallets[5].getPublicKeyString()
      amount = web3.utils.toWei('740')

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(amount, 0, false, userPubkey, { from: user })

      // staked for
      stakedFor = await stakeManager.totalStakedFor(user)
      // stakedFor.should.be.bignumber.equal(amount)
      assertBigNumberEquality(stakedFor, amount)
      const validatorId = await stakeManager.getValidatorId(user)
      const stakerDetails = await stakeManager.validators(validatorId)
      stakerDetails.signer.toLowerCase().should.equal(user)
    })

    it('should update and verify signer/pubkey', async function () {
      let user = wallets[5].getAddressString()
      let userPubkey = wallets[0].getPublicKeyString()
      let signer = wallets[0].getAddressString()
      let w = [wallets[1], wallets[2], wallets[3], wallets[4]]
      await checkPoint(w, wallets[1], stakeManager)

      const validatorId = await stakeManager.getValidatorId(user)
      let signerReceipt = await stakeManager.updateSigner(validatorId, userPubkey, {
        from: user
      })
      const logs = logDecoder.decodeLogs(signerReceipt.receipt.rawLogs)
      logs.should.have.lengthOf(1)
      logs[0].event.should.equal('SignerChange')
      logs[0].args.newSigner.toLowerCase().should.equal(signer.toLowerCase())

      // staked for
      let stakerDetails = await stakeManager.validators(validatorId)
      stakerDetails.signer.toLowerCase().should.equal(signer)
      // revert it back
      await stakeManager.updateSigner(validatorId, wallets[5].getPublicKeyString(), {
        from: user
      })
    })

    it('should try to stake after validator threshold', async function () {
      const user = wallets[6].getAddressString()
      let userPubkey = wallets[6].getPublicKeyString()
      const amount = web3.utils.toWei('100')

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      try {
        await stakeManager.stake(amount, 0, false, userPubkey, {
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

    it('should verify running total stake to be correct', async function () {
      const stake = await stakeManager.currentValidatorSetTotalStake()
      // stake.should.be.bignumber.equal(web3.utils.toWei(2240))
      assertBigNumberEquality(stake, web3.utils.toWei('2240'))
      const validators = await stakeManager.getCurrentValidatorSet()
      validators.should.have.lengthOf(5)
    })

    it('should unstake via wallets[2]', async function () {
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

    it('should unstake via wallets[3] after 2 epoch', async function () {
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
    it('should set the validator threshold to 6, dynasty value to 2 epochs', async function () {
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

    it('should stake via wallets[6]', async function () {
      const user = wallets[6].getAddressString()
      const userPubkey = wallets[6].getPublicKeyString()
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

      await stakeManager.stake(amount, 0, false, userPubkey, {
        from: user
      })
    })

    it('should stake via wallets[7]', async function () {
      let user = wallets[7].getAddressString()
      let userPubkey = wallets[7].getPublicKeyString()
      let amount = web3.utils.toWei('450')

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(amount, 0, false, userPubkey, {
        from: user
      })
      user = wallets[0].getAddressString()
      userPubkey = wallets[0].getPublicKeyString()
      amount = web3.utils.toWei('850')

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      let result = await stakeManager.stake(amount, 0, false, userPubkey, {
        from: user
      })
    })

    it('should verify unstaked amount', async function () {
      const ValidatorId2 = await stakeManager.getValidatorId(
        wallets[2].getAddressString()
      )
      const ValidatorId3 = await stakeManager.getValidatorId(wallets[3].getAddressString())

      await stakeManager.unstakeClaim(ValidatorId2, {
        from: wallets[2].getAddressString()
      })

      let w = [wallets[1], wallets[5], wallets[6], wallets[7], wallets[4]]
      await checkPoint(w, wallets[1], stakeManager, {
        from: wallets[1].getAddressString()
      })

      await stakeManager.unstakeClaim(ValidatorId3, {
        from: wallets[3].getAddressString()
      })
      let balance = await stakeToken.balanceOf(wallets[2].getAddressString())
      // TODO: consider rewards as well for assert equal
      assertBigNumbergt(balance, web3.utils.toWei('805'))
      balance = await stakeToken.balanceOf(wallets[3].getAddressString())
      assertBigNumbergt(balance, web3.utils.toWei('850'))
    })

    it('should verify running total stake to be correct', async function () {
      const amount = web3.utils.toWei('3390')
      const stake = await stakeManager.currentValidatorSetTotalStake()

      assertBigNumberEquality(stake, amount)
      const validators = await stakeManager.getCurrentValidatorSet()
      validators.should.have.lengthOf(6)
    })

    it('should create sigs properly', async function () {
      // dummy vote data
      let w = [wallets[0], wallets[4], wallets[6], wallets[7], wallets[5]]
      await checkPoint(w, wallets[1], stakeManager, {
        from: wallets[1].getAddressString()
      })
    })
  })
})

contract('StakeManager:rewards distribution', async function (accounts) {
  let stakeToken
  let stakeManager
  let wallets
  const totalStake = web3.utils.toWei('2000')

  describe('staking rewards', async function () {
    before(async function () {
      wallets = generateFirstWallets(mnemonics, 2)
      let contracts = await deployer.deployStakeManager(wallets)
      stakeToken = contracts.stakeToken
      stakeManager = contracts.stakeManager

      await stakeManager.updateCheckPointBlockInterval(1)
      let amount = web3.utils.toWei('1000')
      for (let i = 0; i < 2; i++) {
        await stakeToken.mint(wallets[i].getAddressString(), amount)
        await stakeToken.approve(stakeManager.address, amount, {
          from: wallets[i].getAddressString()
        })
        await stakeManager.stake(amount, 0, false, wallets[i].getPublicKeyString(), {
          from: wallets[i].getAddressString()
        })
      }
      //transfer checkpoint rewards
      await stakeToken.mint(stakeManager.address, web3.utils.toWei('10000'))
    })

    it('should get rewards for validator1 for a single checkpoint', async function () {
      const reward = web3.utils.toWei('5000')

      // 2/3 majority vote
      await checkPoint(wallets, wallets[1], stakeManager, {
        from: wallets[1].getAddressString()
      })

      const user = await stakeManager.ownerOf(1)
      const beforeBalance = await stakeToken.balanceOf(
        user
      )

      let validator = await stakeManager.validators(1)
      assertBigNumberEquality(validator.reward, web3.utils.toBN(reward))

      await stakeManager.withdrawRewards(1, {
        from: user
      })
      const afterBalance = await stakeToken.balanceOf(
        user
      )
      assertBigNumberEquality(afterBalance, web3.utils.toBN(reward).add(beforeBalance))
      assertBigNumbergt(afterBalance, beforeBalance)
    })
  })
})

contract('StakeManager: Heimdall fee', async function (accounts) {
  let stakeToken
  let stakeManager
  let wallets
  let accountState = {}

  describe('staking rewards', async function () {
    beforeEach(async function () {
      wallets = generateFirstWallets(mnemonics, 3)
      let contracts = await deployer.deployStakeManager(wallets)
      stakeToken = contracts.stakeToken
      stakeManager = contracts.stakeManager

      await stakeManager.updateCheckPointBlockInterval(1)
      await stakeManager.changeRootChain(wallets[1].getAddressString())
    })

    it('Stake with fee amount', async function () {
      const amount = web3.utils.toWei('200')
      const fee = web3.utils.toWei('50')
      const user = wallets[2].getAddressString()
      await stakeToken.mint(user, amount)
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })
      let Receipt = await stakeManager.stake(web3.utils.toWei('150'), fee, false, wallets[2].getPublicKeyString(), {
        from: user
      })
      const logs = logDecoder.decodeLogs(Receipt.receipt.rawLogs)

      logs[2].event.should.equal('TopUpFee')
      logs[1].event.should.equal('Staked')
      assertBigNumberEquality(logs[2].args.fee, fee)
      logs[2].args.signer.toLowerCase().should.equal(user.toLowerCase())
    })

    it('Topup later', async function () {
      const amount = web3.utils.toWei('200')
      const fee = web3.utils.toWei('50')
      const user = wallets[2].getAddressString()
      await stakeToken.mint(user, amount)
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })
      let Receipt = await stakeManager.stake(web3.utils.toWei('150'), 0, false, wallets[2].getPublicKeyString(), {
        from: user
      })
      let logs = logDecoder.decodeLogs(Receipt.receipt.rawLogs)
      logs[2].event.should.equal('TopUpFee')
      logs[1].event.should.equal('Staked')
      assertBigNumberEquality(logs[2].args.fee, '0')
      logs[2].args.signer.toLowerCase().should.equal(user.toLowerCase())
      Receipt = await stakeManager.topUpForFee(1, fee, {
        from: user
      })
      logs = logDecoder.decodeLogs(Receipt.receipt.rawLogs)
      logs[0].event.should.equal('TopUpFee')
      logs[0].args.signer.toLowerCase().should.equal(user.toLowerCase())
      assertBigNumberEquality(logs[0].args.fee, fee)
    })

    it('Withdraw heimdall fee', async function () {
      const validators = [1, 2]
      const amount = web3.utils.toWei('200')
      const fee = web3.utils.toWei('50')
      const user = wallets[2].getAddressString()
      await stakeToken.mint(user, amount)
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })
      await stakeManager.stake(web3.utils.toWei('150'), fee, false, wallets[2].getPublicKeyString(), {
        from: user
      })

      accountState[1] = [web3.utils.toHex(fee.toString()), 0]
      accountState[2] = [0, 0]
      // validatorId, accumBalance, accumSlashedAmount, amount
      let tree = await rewradsTreeFee(validators, accountState)

      const { vote, sigs } = buildSubmitHeaderBlockPaylod(
        wallets[2].getAddressString(),
        0,
        22,
        '' /* root */,
        [wallets[2]],
        { rewardsRootHash: tree.getRoot(), allValidators: true, getSigs: true, totalStake: web3.utils.toWei('150') }
      )

      // 2/3 majority vote
      await stakeManager.checkSignatures(
        1,
        utils.bufferToHex(utils.keccak256(vote)),
        utils.bufferToHex(tree.getRoot()),
        sigs, { from: wallets[1].getAddressString() }
      )
      const leaf = utils.keccak256(
        web3.eth.abi.encodeParameters(
          ['uint256', 'uint256', 'uint256'],
          [1, accountState[1][0].toString(), accountState[1][1]]
        )
      )
      // validatorId, accumBalance, accumSlashedAmount, amount, index, bytes memory proof
      let Receipt = await stakeManager.claimFee(
        1,
        0,
        fee,
        0,
        utils.bufferToHex(Buffer.concat(tree.getProof(leaf))),
        { from: wallets[2].getAddressString() }
      )

      let logs = logDecoder.decodeLogs(Receipt.receipt.rawLogs)
      logs[0].event.should.equal('ClaimFee')
      assertBigNumberEquality(await stakeToken.balanceOf(
        wallets[2].getAddressString()
      ), fee)
    })

    it('Withdraw heimdall fee multiple times', async function () {
      const validators = [1, 2]
      const amount = web3.utils.toWei('200')
      let fee = web3.utils.toWei('50')
      const user = wallets[2].getAddressString()
      await stakeToken.mint(user, amount)
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })
      await stakeManager.stake(web3.utils.toWei('150'), fee, false, wallets[2].getPublicKeyString(), {
        from: user
      })
      fee = web3.utils.toWei('25')
      accountState[1] = [web3.utils.toHex(fee.toString()), 0]
      accountState[2] = [0, 0]
      // validatorId, accumBalance, accumSlashedAmount, amount
      let tree = await rewradsTreeFee(validators, accountState)

      const { vote, sigs } = buildSubmitHeaderBlockPaylod(
        wallets[2].getAddressString(),
        0,
        22,
        '' /* root */,
        [wallets[2]],
        { rewardsRootHash: tree.getRoot(), allValidators: true, getSigs: true, totalStake: web3.utils.toWei('150') }
      )

      // 2/3 majority vote
      await stakeManager.checkSignatures(
        22,
        utils.bufferToHex(utils.keccak256(vote)),
        utils.bufferToHex(tree.getRoot()),
        sigs, { from: wallets[1].getAddressString() }
      )
      let leaf = utils.keccak256(
        web3.eth.abi.encodeParameters(
          ['uint256', 'uint256', 'uint256'],
          [1, accountState[1][0].toString(), accountState[1][1]]
        )
      )
      // validatorId, accumBalance, accumSlashedAmount, amount, index, bytes memory proof
      let Receipt = await stakeManager.claimFee(
        1,
        0,
        fee,
        0,
        utils.bufferToHex(Buffer.concat(tree.getProof(leaf))),
        { from: wallets[2].getAddressString() }
      )

      let logs = logDecoder.decodeLogs(Receipt.receipt.rawLogs)
      logs[0].event.should.equal('ClaimFee')
      assertBigNumberEquality(await stakeToken.balanceOf(
        wallets[2].getAddressString()
      ), fee)

      fee = web3.utils.toWei('50')

      accountState[1] = [web3.utils.toHex(fee.toString()), 0]
      // validatorId, accumBalance, accumSlashedAmount, amount
      tree = await rewradsTreeFee(validators, accountState)

      const header = buildSubmitHeaderBlockPaylod(
        wallets[2].getAddressString(),
        22,
        44,
        '' /* root */,
        [wallets[2]],
        { rewardsRootHash: tree.getRoot(), allValidators: true, getSigs: true, totalStake: web3.utils.toWei('150') }
      )
      // 2/3 majority vote
      await stakeManager.checkSignatures(
        22,
        utils.bufferToHex(utils.keccak256(header.vote)),
        utils.bufferToHex(tree.getRoot()),
        header.sigs, { from: wallets[1].getAddressString() }
      )

      leaf = utils.keccak256(
        web3.eth.abi.encodeParameters(
          ['uint256', 'uint256', 'uint256'],
          [1, accountState[1][0].toString(), accountState[1][1]]
        )
      )
      // validatorId, accumBalance, accumSlashedAmount, amount, index, bytes memory proof
      Receipt = await stakeManager.claimFee(
        1,
        0,
        fee,
        0,
        utils.bufferToHex(Buffer.concat(tree.getProof(leaf))),
        { from: wallets[2].getAddressString() }
      )
      logs = logDecoder.decodeLogs(Receipt.receipt.rawLogs)
      logs[0].event.should.equal('ClaimFee')
      assertBigNumberEquality(await stakeToken.balanceOf(
        wallets[2].getAddressString()
      ), fee)
    })
  })
})

contract('StakeManager:validator replacement', async function (accounts) {
  let stakeToken
  let stakeManager
  let wallets

  describe('validator replacement', async function () {
    before(async function () {
      wallets = generateFirstWallets(mnemonics, 10)
      let contracts = await deployer.deployStakeManager(wallets)
      stakeToken = contracts.stakeToken
      stakeManager = contracts.stakeManager

      await stakeManager.updateDynastyValue(8)
      await stakeManager.updateCheckPointBlockInterval(1)

      let amount = web3.utils.toWei('1000')
      for (let i = 0; i < 2; i++) {
        await stakeToken.mint(wallets[i].getAddressString(), amount)
        await stakeToken.approve(stakeManager.address, amount, {
          from: wallets[i].getAddressString()
        })
        await stakeManager.stake(amount, 0, false, wallets[i].getPublicKeyString(), {
          from: wallets[i].getAddressString()
        })
      }
      // cool down period
      let auctionPeriod = await stakeManager.auctionPeriod()
      let currentEpoch = await stakeManager.currentEpoch()
      for (
        let i = currentEpoch;
        i <= auctionPeriod;
        i++
      ) {
        // 2/3 majority vote
        await checkPoint([wallets[0], wallets[1]], wallets[1], stakeManager, {
          from: wallets[1].getAddressString()
        })
      }
    })

    it('should try auction start in non-auction period and fail', async function () {
      const amount = web3.utils.toWei('1200')
      await stakeToken.mint(wallets[3].getAddressString(), amount)
      await stakeToken.approve(stakeManager.address, amount, {
        from: wallets[3].getAddressString()
      })
      let auction = await stakeManager.validatorAuction(1)
      let currentEpoch = await stakeManager.currentEpoch()
      let dynasty = await stakeManager.dynasty()

      for (let i = currentEpoch; i <= auction.startEpoch.add(dynasty); i++) {
        // 2/3 majority vote
        await checkPoint([wallets[0], wallets[1]], wallets[1], stakeManager, {
          from: wallets[1].getAddressString()
        })
      }
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

    it('should start Auction and bid multiple times', async function () {
      let amount = web3.utils.toWei('1200')

      // 2/3 majority vote
      await checkPoint([wallets[0], wallets[1]], wallets[1], stakeManager, {
        from: wallets[1].getAddressString()
      })

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

    it('should start auction where validator is last bidder', async function () {
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

    it('should try to unstake in auction interval and fail', async function () {
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

    it('should try auction start after auctionPeriod period and fail', async function () {
      let auctionData = await stakeManager.validatorAuction(1)
      let auctionPeriod = await stakeManager.auctionPeriod()
      let currentEpoch = await stakeManager.currentEpoch()

      // fast forward to skip auctionPeriod
      for (
        let i = currentEpoch;
        i <= auctionPeriod.add(currentEpoch);
        i++
      ) {
        // 2/3 majority vote
        await checkPoint([wallets[0], wallets[1]], wallets[1], stakeManager, {
          from: wallets[1].getAddressString()
        })
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

    // TODO : get events from stakingInfo and add more test for auction
    it('should confrim auction and secure the place', async function () {
      const result = await stakeManager.confirmAuctionBid(
        1,
        0,
        false,
        wallets[4].getPublicKeyString(),
        {
          from: wallets[4].getAddressString()
        }
      )
      const logs = result.receipt.logs
      // console.log(logs)
      // logs[2].event.should.equal('Staked')
      // logs[3].event.should.equal('ConfirmAuction')

      // assertBigNumberEquality(logs[3].args.amount, web3.utils.toWei('1250'))
      // assert.ok(!(await stakeManager.isValidator(logs[3].args.oldValidatorId)))
      // assert.ok(await stakeManager.isValidator(logs[3].args.newValidatorId))
    })

    it('should confrim auction and secure the place for validator itself', async function () {
      // let validator = await stakeManager.validators(2)
      // let stake = validator.amount
      // let balanceBefore = await stakeToken.balanceOf(validator.signer)
      // console.log(await stakeManager.validatorAuction(2))
      // console.log(await stakeManager.currentEpoch())
      // const result = await stakeManager.confirmAuctionBid(
      //   2,
      //   0,
      //   validator.signer,
      //   false,
      //   {
      //     from: validator.signer
      //   }
      // )
      // const logs = result.receipt.logs

      // logs[1].event.should.equal('ConfirmAuction')

      // assertBigNumberEquality(logs[1].args.amount, web3.utils.toWei('1250'))
      // assertBigNumberEquality(
      //   logs[1].args.oldValidatorId,
      //   logs[1].args.newValidatorId
      // )

      // test if validator got the diff balance back
      // let balanceAfter = await stakeToken.balanceOf(validator.signer)
      // assertBigNumberEquality(balanceAfter.sub(balanceBefore), stake)
    })
    // TODO: add more tests with delegation enabled
  })
})
contract('StakeManager: Delegation', async function (accounts) {
  let stakeToken
  let stakeManager
  let wallets

  describe('validator:delegation', async function () {
    before(async function () {
      wallets = generateFirstWallets(mnemonics, 10)
      let contracts = await deployer.deployStakeManager(wallets)
      stakeToken = contracts.stakeToken
      stakeManager = contracts.stakeManager

      await stakeManager.updateDynastyValue(8)
      await stakeManager.updateCheckPointBlockInterval(1)

      let amount = web3.utils.toWei('1000')
      for (let i = 0; i < 2; i++) {
        await stakeToken.mint(wallets[i].getAddressString(), amount)
        await stakeToken.approve(stakeManager.address, amount, {
          from: wallets[i].getAddressString()
        })
        await stakeManager.stake(amount, 0, true, wallets[i].getPublicKeyString(), {
          from: wallets[i].getAddressString()
        })
      }
      // cool down period
      let auctionPeriod = await stakeManager.auctionPeriod()
      let currentEpoch = await stakeManager.currentEpoch()
      for (
        let i = currentEpoch;
        i <= auctionPeriod;
        i++
      ) {
        // 2/3 majority vote
        await checkPoint([wallets[0], wallets[1]], wallets[1], stakeManager, {
          from: wallets[1].getAddressString()
        })
      }
    })

    it('should test reStake with rewards', async function () {
      const user = wallets[0].getAddressString()
      const amount = web3.utils.toWei('100')
      await stakeToken.mint(user, amount)
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      let validator = await stakeManager.validators(1)
      let validatorContract = await ValidatorShare.at(validator.contractAddress)
      let stakeReceipt = await stakeManager.restake(1, amount, true, {
        from: user
      })
      const logs = logDecoder.decodeLogs(stakeReceipt.receipt.rawLogs)
      logs.should.have.lengthOf(2)
      logs[0].event.should.equal('StakeUpdate')
      logs[1].event.should.equal('ReStaked')

      assertBigNumberEquality(await validatorContract.validatorRewards(), 0)
      assertBigNumberEquality(logs[1].args.amount, web3.utils.toWei('11100'))
    })
  })
})
