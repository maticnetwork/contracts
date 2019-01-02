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
      await stakeManager.setToken(stakeToken.address)
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
      const stakeReceipt = await stakeManager.stake(
        ZeroAddress,
        user,
        amount,

        {
          from: user
        }
      )

      // decode logs
      const logs = logDecoder.decodeLogs(stakeReceipt.receipt.logs)
      logs.should.have.lengthOf(2)

      logs[0].event.should.equal('Transfer')
      logs[0].args.from.toLowerCase().should.equal(user)
      logs[0].args.to.toLowerCase().should.equal(stakeManager.address)
      logs[0].args.value.should.be.bignumber.equal(amount)

      logs[1].event.should.equal('Staked')
      logs[1].args.user.toLowerCase().should.equal(user)
      logs[1].args.amount.should.be.bignumber.equal(amount)
    })

    it('should stake via wallets[2]', async function() {
      const user = wallets[2].getAddressString()
      const amount = web3.toWei(250)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      const stakeReceipt = await stakeManager.stake(ZeroAddress, user, amount, {
        from: user
      })

      // decode logs
      const logs = logDecoder.decodeLogs(stakeReceipt.receipt.logs)
      logs.should.have.lengthOf(2)

      logs[0].event.should.equal('Transfer')
      logs[0].args.from.toLowerCase().should.equal(user)
      logs[0].args.to.toLowerCase().should.equal(stakeManager.address)
      logs[0].args.value.should.be.bignumber.equal(amount)

      logs[1].event.should.equal('Staked')
      logs[1].args.user.toLowerCase().should.equal(user)
      logs[1].args.amount.should.be.bignumber.equal(amount)

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
      await stakeManager.stake(ZeroAddress, user, amount, { from: user })

      // staked for
      const stakedFor = await stakeManager.totalStakedFor(user)
      stakedFor.should.be.bignumber.equal(amount)
      const value = await stakeManager.isValidator(user)
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
        await stakeManager.stake(ZeroAddress, user, amount, {
          from: user
        })
      } catch (error) {
        const invalidOpcode = error.message.search('revert') >= 0
        assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
        return
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
      await stakeManager.stake(ZeroAddress, user, amount, { from: user })

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
      await stakeManager.stake(ZeroAddress, user, amount, { from: user })

      // staked for
      stakedFor = await stakeManager.totalStakedFor(user)
      stakedFor.should.be.bignumber.equal(amount)
      const stakerDetails = await stakeManager.getStakerDetails(user)
      stakerDetails[3].should.equal(user)
    })

    it('should update and verify signer/pubkey', async function() {
      let user = wallets[5].getAddressString()

      let signer = wallets[0].getAddressString()
      let signerReceipt = await stakeManager.updateSigner(signer, {
        from: user
      })
      const logs = logDecoder.decodeLogs(signerReceipt.receipt.logs)
      logs.should.have.lengthOf(1)
      logs[0].event.should.equal('SignerChange')

      // staked for
      let stakerDetails = await stakeManager.getStakerDetails(user)
      stakerDetails[3].should.equal(signer)

      signerReceipt = await stakeManager.updateSigner(user, { from: user })
      logs.should.have.lengthOf(1)
      logs[0].event.should.equal('SignerChange')

      // staked for
      stakerDetails = await stakeManager.getStakerDetails(user)
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
        await stakeManager.stake(ZeroAddress, user, amount, {
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

    it('should dethrone address via wallets[7] and fail', async function() {
      const user = wallets[7].getAddressString()
      const amount = web3.toWei(1)

      // stake now
      try {
        await stakeManager.stake(ZeroAddress, user, amount, {
          from: user
        })
      } catch (error) {
        const invalidOpcode = error.message.search('revert') >= 0
        assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
        return
      }
      let validators = await stakeManager.getCurrentValidatorSet()
      expect(validators).to.not.include.members([user])
      validators = await stakeManager.getNextValidatorSet()
      expect(validators).to.not.include.members([user])
    })

    it('should stake via wallets[6]', async function() {
      const user = wallets[6].getAddressString()
      const amount = web3.toWei(400)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      await stakeManager.stake(wallets[1].getAddressString(), user, amount, {
        from: user
      })
    })

    it('should stake via wallets[7]', async function() {
      const user = wallets[7].getAddressString()
      const amount = web3.toWei(450)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(wallets[2].getAddressString(), user, amount, {
        from: user
      })
    })

    it('should stake via wallets[8]', async function() {
      const user = wallets[8].getAddressString()
      const amount = web3.toWei(600)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(wallets[3].getAddressString(), user, amount, {
        from: user
      })
    })

    it('should stake via wallets[9]', async function() {
      const user = wallets[9].getAddressString()
      const amount = web3.toWei(760)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(wallets[4].getAddressString(), user, amount, {
        from: user
      })
    })

    it('should stake via wallets[0]', async function() {
      const user = wallets[0].getAddressString()
      const amount = web3.toWei(800)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(wallets[5].getAddressString(), user, amount, {
        from: user
      })
      let size = await stakeManager.currentValidatorSetSize()
      size.should.be.bignumber.equal(5)
      const value = await stakeManager.isValidator(user)
      assert.isTrue(!value)
    })

    it('should unstake all validators and wait for d*2 and varify new validators', async function() {
      let users = [
        wallets[1].getAddressString(),
        wallets[2].getAddressString(),
        wallets[3].getAddressString(),
        wallets[4].getAddressString(),
        wallets[5].getAddressString()
      ]
      let amounts = [
        web3.toWei(200),
        web3.toWei(250),
        web3.toWei(300),
        web3.toWei(750),
        web3.toWei(740)
      ]
      // let rootChain = await stakeManager.rootChain()
      await stakeManager.finalizeCommit()
      await stakeManager.finalizeCommit()
      await stakeManager.finalizeCommit()
      await stakeManager.finalizeCommit()
      await stakeManager.finalizeCommit()
      await stakeManager.finalizeCommit()

      // const validatorDetails = await stakeManager.getDetails(users[])
      const unstakeClaimEvents = [
        await stakeManager.unstakeClaim({ from: users[0] }),
        await stakeManager.unstakeClaim({ from: users[1] }),
        await stakeManager.unstakeClaim({ from: users[2] }),
        await stakeManager.unstakeClaim({ from: users[3] }),
        await stakeManager.unstakeClaim({ from: users[4] })
      ]
      const newValidators = await stakeManager.getCurrentValidatorSet()
      expect(newValidators).to.not.have.members(users)
    })

    it('should verify unstaked amount', async function() {
      let balance = await stakeToken.balanceOf(wallets[1].getAddressString())
      balance.should.be.bignumber.equal(web3.toWei(800))
      balance = await stakeToken.balanceOf(wallets[2].getAddressString())
      balance.should.be.bignumber.equal(web3.toWei(805))
      balance = await stakeToken.balanceOf(wallets[3].getAddressString())
      balance.should.be.bignumber.equal(web3.toWei(850))
      balance = await stakeToken.balanceOf(wallets[4].getAddressString())
      balance.should.be.bignumber.equal(web3.toWei(800))
      balance = await stakeToken.balanceOf(wallets[5].getAddressString())
      balance.should.be.bignumber.equal(web3.toWei(800))
    })

    it('should verify running total stake to be correct', async function() {
      const amount = web3.toWei(3010)
      const currentEpoch = await stakeManager.currentEpoch()
      const stake = await stakeManager.currentValidatorSetTotalStake()
      stake.should.be.bignumber.equal(amount)
      const validators = await stakeManager.getCurrentValidatorSet()
      expect(validators).to.have.members([
        wallets[0].getAddressString(),
        wallets[6].getAddressString(),
        wallets[7].getAddressString(),
        wallets[8].getAddressString(),
        wallets[9].getAddressString()
      ])
    })

    it('should create sigs properly', async function() {
      // dummy vote data
      let w = [wallets[0], wallets[6], wallets[7], wallets[8], wallets[9]]

      const voteData = 'dummyData'
      const sigs = utils.bufferToHex(
        encodeSigs(getSigs(w, utils.keccak256(voteData)))
      )
      const result = await stakeManager.checkSignatures(
        utils.bufferToHex(utils.keccak256(voteData)),
        sigs
      )
      // 2/3 majority vote
      assert.isTrue(result)
    })
  })
})
