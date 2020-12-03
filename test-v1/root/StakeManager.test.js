import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBigNumber from 'chai-bignumber'
import utils from 'ethereumjs-util'

import { generateFirstWallets, mnemonics } from '../helpers/wallets'
import { linkLibs, encodeSigs, getSigs, ZeroAddress } from '../helpers/utils'
import { StakeManagerMock, RootToken } from '../helpers/contracts'
import LogDecoder from '../helpers/log-decoder'

// TODO: make faster (promisify/parallel)
// add chai pluggin
chai
  .use(chaiAsPromised)
  .use(chaiBigNumber(web3.BigNumber))
  .should()

contract('StakeManager', async function(accounts) {
  let stakeToken
  let stakeManager
  let wallets
  let logDecoder
  let owner = accounts[0]

  before(async function() {
    // link libs
    await linkLibs()

    // log decoder
    logDecoder = new LogDecoder([
      StakeManagerMock._json.abi,
      RootToken._json.abi
    ])
  })

  // staking
  describe('Stake', async function() {
    before(async function() {
      stakeToken = await RootToken.new('Stake Token', 'STAKE')
      stakeManager = await StakeManagerMock.new()
      await stakeManager.setStakingToken(stakeToken.address)
      wallets = generateFirstWallets(mnemonics, 10)

      // transfer tokens to other accounts
      await stakeToken.mint(wallets[0].getAddressString(), web3.toWei(1200))
      await stakeToken.mint(wallets[1].getAddressString(), web3.toWei(800))
      await stakeToken.mint(wallets[2].getAddressString(), web3.toWei(805))
      await stakeToken.mint(wallets[3].getAddressString(), web3.toWei(850))
      await stakeToken.mint(wallets[4].getAddressString(), web3.toWei(800))
      await stakeToken.mint(wallets[5].getAddressString(), web3.toWei(800))
      await stakeToken.mint(wallets[6].getAddressString(), web3.toWei(800))
      await stakeToken.mint(wallets[7].getAddressString(), web3.toWei(800))
      await stakeToken.mint(wallets[8].getAddressString(), web3.toWei(800))
      await stakeToken.mint(wallets[9].getAddressString(), web3.toWei(800))
    })

    it('should set the validator threshold to 5, dynasty value to 2 epochs', async function() {
      const thresholdReceipt = await stakeManager.updateValidatorThreshold(5, {
        from: owner
      })
      const logs = logDecoder.decodeLogs(thresholdReceipt.receipt.logs)
      logs.should.have.lengthOf(1)
      logs[0].event.should.equal('ThresholdChange')
      logs[0].args.newThreshold.should.be.bignumber.equal(5)

      const newThreshold = await stakeManager.validatorThreshold()
      newThreshold.should.be.bignumber.equal(5)

      const dynastyReceipt = await stakeManager.updateDynastyValue(2, {
        from: owner
      })
      const logs1 = logDecoder.decodeLogs(dynastyReceipt.receipt.logs)
      logs1.should.have.lengthOf(1)
      logs1[0].event.should.equal('DynastyValueChange')
      logs1[0].args.newDynasty.should.be.bignumber.equal(2)
      // logs1[0].args.oldDynasty.should.be.bignumber.equal(250)
    })

    it('should set token address and owner properly', async function() {
      await stakeManager.token().should.eventually.equal(stakeToken.address)
      await stakeManager.owner().should.eventually.equal(owner)
    })

    it('should stake via wallets[1]', async function() {
      const user = wallets[1].getAddressString()
      const amount = web3.toWei(200)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      const stakeReceipt = await stakeManager.stake(amount, user, {
        from: user
      })

      // decode logs
      const logs = logDecoder.decodeLogs(stakeReceipt.receipt.logs)

      logs.should.have.lengthOf(3)

      logs[0].event.should.equal('Transfer')
      logs[0].args.from.toLowerCase().should.equal(user)
      logs[0].args.to.toLowerCase().should.equal(stakeManager.address)
      logs[0].args.value.should.be.bignumber.equal(amount)

      logs[2].event.should.equal('Staked')
      logs[2].args.user.toLowerCase().should.equal(user)
      logs[2].args.amount.should.be.bignumber.equal(amount)
    })

    it('should stake via wallets[2]', async function() {
      const user = wallets[2].getAddressString()
      const amount = web3.toWei(250)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      const stakeReceipt = await stakeManager.stake(amount, user, {
        from: user
      })

      // decode logs
      const logs = logDecoder.decodeLogs(stakeReceipt.receipt.logs)
      logs.should.have.lengthOf(3)

      logs[0].event.should.equal('Transfer')
      logs[0].args.from.toLowerCase().should.equal(user)
      logs[0].args.to.toLowerCase().should.equal(stakeManager.address)
      logs[0].args.value.should.be.bignumber.equal(amount)

      logs[2].event.should.equal('Staked')
      logs[2].args.user.toLowerCase().should.equal(user)
      logs[2].args.amount.should.be.bignumber.equal(amount)

      // staked for
      const stakedFor = await stakeManager.totalStakedFor(user)
      stakedFor.should.be.bignumber.equal(amount)
    })

    it('should stake via wallets[3]', async function() {
      const user = wallets[3].getAddressString()
      const amount = web3.toWei(300)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(amount, user, { from: user })
      // staked for
      const stakedFor = await stakeManager.totalStakedFor(user)
      stakedFor.should.be.bignumber.equal(amount)
      const validatorId = await stakeManager.getValidatorId(user)
      const value = await stakeManager.isValidator(validatorId)
      assert.isTrue(value)
    })

    it('Duplicate: should stake via wallets[3] fail', async function() {
      const user = wallets[3].getAddressString()
      const amount = web3.toWei(30)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      try {
        await stakeManager.stake(amount, user, {
          from: user
        })
      } catch (error) {
        const invalidOpcode = error.message.search('revert') >= 0
        assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
      }

      // staked for
      const stakedFor = await stakeManager.totalStakedFor(user)
      stakedFor.should.be.bignumber.equal(web3.toWei(300))
    })

    it('should stake via wallets[4-5]', async function() {
      let user = wallets[4].getAddressString()
      let amount = web3.toWei(750)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(amount, user, { from: user })

      // staked for
      let stakedFor = await stakeManager.totalStakedFor(user)
      stakedFor.should.be.bignumber.equal(amount)

      user = wallets[5].getAddressString()
      amount = web3.toWei(740)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(amount, user, { from: user })

      // staked for
      stakedFor = await stakeManager.totalStakedFor(user)
      stakedFor.should.be.bignumber.equal(amount)
      const validatorId = await stakeManager.getValidatorId(user)
      const stakerDetails = await stakeManager.getStakerDetails(validatorId)
      stakerDetails[3].should.equal(user)
    })

    it('should update and verify signer/pubkey', async function() {
      let user = wallets[5].getAddressString()
      await stakeManager.finalizeCommit()

      let signer = wallets[0].getAddressString()
      const validatorId = await stakeManager.getValidatorId(user)
      let signerReceipt = await stakeManager.updateSigner(validatorId, signer, {
        from: user
      })
      const logs = logDecoder.decodeLogs(signerReceipt.receipt.logs)
      logs.should.have.lengthOf(1)
      logs[0].event.should.equal('SignerChange')

      // staked for
      let stakerDetails = await stakeManager.getStakerDetails(validatorId)
      stakerDetails[3].should.equal(signer)

      signerReceipt = await stakeManager.updateSigner(validatorId, user, {
        from: user
      })
      logs.should.have.lengthOf(1)
      logs[0].event.should.equal('SignerChange')

      // staked for
      stakerDetails = await stakeManager.getStakerDetails(validatorId)
      stakerDetails[3].should.equal(user)
    })

    it('should try to stake after validator threshold', async function() {
      const user = wallets[6].getAddressString()
      const amount = web3.toWei(100)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      try {
        await stakeManager.stake(amount, user, {
          from: user
        })
      } catch (error) {
        const invalidOpcode = error.message.search('revert') >= 0
        assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
        return
      }
      // staked for
      const stakedFor = await stakeManager.totalStakedFor(user)
      stakedFor.should.be.bignumber.equal(0)
    })

    it('should verify running total stake to be correct', async function() {
      const stake = await stakeManager.currentValidatorSetTotalStake()
      stake.should.be.bignumber.equal(web3.toWei(2240))
      const validators = await stakeManager.getCurrentValidatorSet()
      validators.should.have.lengthOf(5)
    })
    it('should unstake via wallets[2]', async function() {
      const user = wallets[2].getAddressString()
      const amount = web3.toWei(250)

      const validatorId = await stakeManager.getValidatorId(user)
      // stake now
      const receipt = await stakeManager.unstake(validatorId, {
        from: user
      })
      const logs = logDecoder.decodeLogs(receipt.receipt.logs)

      logs[0].event.should.equal('UnstakeInit')
      logs[0].args.user.toLowerCase().should.equal(user)
      logs[0].args.amount.should.be.bignumber.equal(amount)
      logs[0].args.validatorId.should.be.bignumber.equal(validatorId)
    })

    it('should unstake via wallets[3] after 2 epoch', async function() {
      const user = wallets[3].getAddressString()
      const amount = web3.toWei(300)
      await stakeManager.finalizeCommit()
      await stakeManager.finalizeCommit()

      const validatorId = await stakeManager.getValidatorId(user)
      // stake now
      const receipt = await stakeManager.unstake(validatorId, {
        from: user
      })
      const logs = logDecoder.decodeLogs(receipt.receipt.logs)

      logs[0].event.should.equal('UnstakeInit')
      logs[0].args.user.toLowerCase().should.equal(user)
      logs[0].args.amount.should.be.bignumber.equal(amount)
      logs[0].args.validatorId.should.be.bignumber.equal(validatorId)
    })
    it('should set the validator threshold to 6, dynasty value to 2 epochs', async function() {
      const thresholdReceipt = await stakeManager.updateValidatorThreshold(6, {
        from: owner
      })
      const logs = logDecoder.decodeLogs(thresholdReceipt.receipt.logs)
      logs.should.have.lengthOf(1)
      logs[0].event.should.equal('ThresholdChange')
      logs[0].args.newThreshold.should.be.bignumber.equal(6)

      const newThreshold = await stakeManager.validatorThreshold()
      newThreshold.should.be.bignumber.equal(6)
    })

    it('should stake via wallets[6]', async function() {
      const user = wallets[6].getAddressString()
      const amount = web3.toWei(400)

      await stakeManager.finalizeCommit()
      await stakeManager.finalizeCommit()
      await stakeManager.finalizeCommit()
      await stakeManager.finalizeCommit()

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      await stakeManager.stake(amount, user, {
        from: user
      })
    })

    it('should stake via wallets[7]', async function() {
      let user = wallets[7].getAddressString()
      let amount = web3.toWei(450)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(amount, user, {
        from: user
      })
      user = wallets[0].getAddressString()
      amount = web3.toWei(850)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(amount, user, {
        from: user
      })
    })

    it('should verify unstaked amount', async function() {
      const ValidatorId2 = await stakeManager.getValidatorId(
        wallets[2].getAddressString()
      )
      const ValidatorId3 = await stakeManager.getValidatorId(
        wallets[3].getAddressString()
      )
      await stakeManager.unstakeClaim(ValidatorId2, {
        from: wallets[2].getAddressString()
      })

      // await stakeManager.finalizeCommit()
      await stakeManager.unstakeClaim(ValidatorId3, {
        from: wallets[3].getAddressString()
      })
      let balance = await stakeToken.balanceOf(wallets[2].getAddressString())
      balance.should.be.bignumber.equal(web3.toWei(805))
      balance = await stakeToken.balanceOf(wallets[3].getAddressString())
      balance.should.be.bignumber.equal(web3.toWei(850))
    })

    it('should verify running total stake to be correct', async function() {
      const amount = web3.toWei(3390)
      //   const currentEpoch = await stakeManager.currentEpoch()
      const stake = await stakeManager.currentValidatorSetTotalStake()
      stake.should.be.bignumber.equal(amount)
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

    it('should create sigs properly', async function() {
      // dummy vote data
      let w = [wallets[0], wallets[4], wallets[6], wallets[7], wallets[5]]

      const voteData = 'dummyData'
      const sigs = utils.bufferToHex(
        encodeSigs(getSigs(w, utils.keccak256(voteData)))
      )
      const result = await stakeManager.checkSignatures(
        utils.bufferToHex(utils.keccak256(voteData)),
        sigs,
        wallets[0].getAddressString()
      )
      // 2/3 majority vote
      assert.isTrue(result)
    })
  })
})
