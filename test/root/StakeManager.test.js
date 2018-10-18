import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBigNumber from 'chai-bignumber'

import { generateFirstWallets, mnemonics } from '../helpers/wallets'
import { linkLibs, ZeroAddress } from '../helpers/utils'
import { assertRevert } from '../helpers/assert-revert'
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
      stakeManager = await StakeManagerMock.new(stakeToken.address)
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
      const thresholdReceipt = await stakeManager.updateValidatorThreshold(5)
      const logs = logDecoder.decodeLogs(thresholdReceipt.receipt.logs)
      logs.should.have.lengthOf(1)
      logs[0].event.should.equal('ThresholdChange')
      logs[0].args.newThreshold.should.be.bignumber.equal(5)

      const newThreshold = await stakeManager.validatorThreshold()
      newThreshold.should.be.bignumber.equal(5)

      const dynastyReceipt = await stakeManager.updateDynastyValue(2)
      const logs1 = logDecoder.decodeLogs(dynastyReceipt.receipt.logs)
      logs1.should.have.lengthOf(1)
      logs1[0].event.should.equal('DynastyValueChange')
      logs1[0].args.newDynasty.should.be.bignumber.equal(2)
      // logs1[0].args.oldDynasty.should.be.bignumber.equal(250)
    })

    it('should set token address and owner properly', async function() {
      await stakeManager.token().should.eventually.equal(stakeToken.address)
      await stakeManager.owner().should.eventually.equal(accounts[0])
    })

    it('should stake via wallets[1]', async function() {
      const user = wallets[1].getAddressString()
      const amount = web3.toWei(200)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      const stakeReceipt = await stakeManager.stake(amount, '0x0', {
        from: user
      })

      // decode logs
      const logs = logDecoder.decodeLogs(stakeReceipt.receipt.logs)
      logs.should.have.lengthOf(2)

      logs[0].event.should.equal('Transfer')
      logs[0].args.from.toLowerCase().should.equal(user)
      logs[0].args.to.toLowerCase().should.equal(stakeManager.address)
      logs[0].args.value.should.be.bignumber.equal(amount)

      logs[1].event.should.equal('ValidatorJoin')
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
      const stakeReceipt = await stakeManager.stake(amount, '0x0', {
        from: user
      })

      // decode logs
      const logs = logDecoder.decodeLogs(stakeReceipt.receipt.logs)
      logs.should.have.lengthOf(2)

      logs[0].event.should.equal('Transfer')
      logs[0].args.from.toLowerCase().should.equal(user)
      logs[0].args.to.toLowerCase().should.equal(stakeManager.address)
      logs[0].args.value.should.be.bignumber.equal(amount)

      logs[1].event.should.equal('ValidatorJoin')
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
      await stakeManager.stake(amount, '0x0', { from: user })

      // staked for
      const stakedFor = await stakeManager.totalStakedFor(user)
      stakedFor.should.be.bignumber.equal(amount)
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
        await stakeManager.stake(amount, '0x0', { from: user })
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
      const user = wallets[4].getAddressString()
      const amount = web3.toWei(750)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(amount, '0x0', { from: user })

      // staked for
      let stakedFor = await stakeManager.totalStakedFor(user)
      stakedFor.should.be.bignumber.equal(amount)

      const user1 = wallets[5].getAddressString()
      const amount1 = web3.toWei(740)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount1, {
        from: user1
      })

      // stake now
      await stakeManager.stake(amount1, '0x0', { from: user1 })

      // staked for
      stakedFor = await stakeManager.totalStakedFor(user1)
      stakedFor.should.be.bignumber.equal(amount1)
      // let validators = await stakeManager.getNextValidatorSet()
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
        await stakeManager.stake(amount, '0x0', { from: user })
      } catch (error) {
        const invalidOpcode = error.message.search('revert') >= 0
        assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
        console.log('reverted check')
        return
      }
      // staked for
      const stakedFor = await stakeManager.totalStakedFor(user)
      stakedFor.should.be.bignumber.equal(0)
    })

    it('should dethrone via wallets[1] and become currentValidator', async function() {
      const user = wallets[1].getAddressString()
      const amount = web3.toWei(200)
      // stake now
      await stakeManager.dethrone(ZeroAddress, { from: user })

      // claim stake
      await stakeManager.stakeClaim({ from: user })

      // check amount
      const totalStake = await stakeManager.totalStaked()
      totalStake.should.be.bignumber.equal(amount)
      // staked for
      const stakedFor = await stakeManager.totalStakedFor(user)
      stakedFor.should.be.bignumber.equal(amount)
      let validators = await stakeManager.getCurrentValidatorSet()
      expect(validators).to.eql([user])
      validators = await stakeManager.getNextValidatorSet()
      expect(validators).to.not.have.members([user])
      // const validatorDetails = await stakeManager.getDetails(user)
    })

    it('should dethrone via wallets[2] and become currentValidator', async function() {
      const user = wallets[2].getAddressString()
      const UserAmount = web3.toWei(250)
      const amount = web3.toWei(450)
      // stake now
      await stakeManager.dethrone(ZeroAddress, { from: user })

      // claim stake
      await stakeManager.stakeClaim({ from: user })

      // check amount
      const totalStake = await stakeManager.totalStaked()
      totalStake.should.be.bignumber.equal(amount)
      // staked for
      const stakedFor = await stakeManager.totalStakedFor(user)
      stakedFor.should.be.bignumber.equal(UserAmount)
      let users = [user, wallets[1].getAddressString()]
      let validators = await stakeManager.getCurrentValidatorSet()
      expect(validators).to.include.members(users)
      validators = await stakeManager.getNextValidatorSet()
      expect(validators).to.not.include.members(users)
    })

    it('should try to dethrone currentValidator while there is empty slot', async function() {
      const user = wallets[3].getAddressString()
      const UserAmount = web3.toWei(300)
      const amount = web3.toWei(750)
      const validator = wallets[1].getAddressString()
      // stake now
      await stakeManager.dethrone(validator, { from: user })

      // claim stake
      await stakeManager.stakeClaim({ from: user })

      // check amount
      const totalStake = await stakeManager.totalStaked()
      totalStake.should.be.bignumber.equal(amount)
      // staked for
      const stakedFor = await stakeManager.totalStakedFor(user)
      stakedFor.should.be.bignumber.equal(UserAmount)
      let validators = await stakeManager.getCurrentValidatorSet()
      expect(validators).to.include.members([validator])
      validators = await stakeManager.getNextValidatorSet()
      expect(validators).to.not.include.members([validator])
    })

    it('should dethrone address(0) from wallet[4-5]', async function() {
      const user = wallets[4].getAddressString()
      const UserAmount = web3.toWei(750)
      let amount = web3.toWei(2240)
      let users = [user]
      // stake now
      await stakeManager.dethrone(ZeroAddress, { from: user })
      // claim stake
      await stakeManager.stakeClaim({ from: user })
      // staked for
      let stakedFor = await stakeManager.totalStakedFor(user)
      stakedFor.should.be.bignumber.equal(UserAmount)
      const totalStake1 = await stakeManager.totalStaked()
      const am2 = web3.toWei(1500)
      totalStake1.should.be.bignumber.equal(am2)
      const user1 = wallets[5].getAddressString()
      const UserAmount1 = web3.toWei(740)
      users.push(user1)

      // stake now
      await stakeManager.dethrone(ZeroAddress, { from: user1 })
      //  claim stake
      await stakeManager.stakeClaim({ from: user1 })

      const stakedFor1 = await stakeManager.totalStakedFor(user1)
      stakedFor1.should.be.bignumber.equal(UserAmount1)

      // check amount
      const totalStake = await stakeManager.totalStaked()
      totalStake.should.be.bignumber.equal(amount)
    })

    it('should dethrone address via wallets[7] and fail', async function() {
      const user = wallets[7].getAddressString()
      const amount = web3.toWei(1)

      // stake now
      try {
        await stakeManager.dethrone(ZeroAddress, { from: user })
      } catch (error) {
        const invalidOpcode = error.message.search('revert') >= 0
        console.log('revert')
        assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
        return
      }
      let validators = await stakeManager.getCurrentValidatorSet()
      expect(validators).to.not.include.members([user])
      validators = await stakeManager.getNextValidatorSet()
      expect(validators).to.not.include.members([user])
    })

    it('should stake via wallets[6-9]', async function() {
      let user = wallets[6].getAddressString()
      let amount = web3.toWei(400)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(amount, '0x0', { from: user })

      user = wallets[7].getAddressString()
      amount = web3.toWei(450)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(amount, '0x0', { from: user })

      user = wallets[8].getAddressString()
      amount = web3.toWei(600)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(amount, '0x0', { from: user })
      user = wallets[9].getAddressString()
      amount = web3.toWei(700)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(amount, '0x0', { from: user })

      user = wallets[0].getAddressString()
      amount = web3.toWei(800)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(amount, '0x0', { from: user })
      let size = await stakeManager.validatorSetSize()
      size.should.be.bignumber.equal(5)

      size = await stakeManager.nextValidatorSetSize()
      size.should.be.bignumber.equal(5)
    })

    it('should dethrone address via wallets[8] -> wallet[1]', async function() {
      const user = wallets[8].getAddressString()
      const validator = wallets[1].getAddressString()

      // stake now
      await stakeManager.dethrone(validator, { from: user })
      let validators = await stakeManager.getNextValidatorSet()
      expect(validators).to.not.include.members([user])
      const userDetails = await stakeManager.getDetails(user)
      const validatorDetails = await stakeManager.getDetails(validator)
      // exit of validator and entry of new validator should be same
      userDetails[0].should.be.bignumber.equal(validatorDetails[1])
      // validator should be unstaking
      validatorDetails[2].should.be.bignumber.equal(2)
    })

    it('should unstake and select descendent', async function() {
      const user = wallets[2].getAddressString()
      const amount = web3.toWei(250)
      // stake now
      const events = await stakeManager.unstake(amount, '0x0', { from: user })
      const logs = logDecoder.decodeLogs(events.receipt.logs)
      logs[0].event.should.equal('StakeInit') // StakeInit
      logs[0].args.user
        .toLowerCase()
        .should.equal(wallets[0].getAddressString())
      logs[0].args.amount.should.be.bignumber.equal(web3.toWei(800))
      logs[1].event.should.equal('UnstakeInit') // StakeInit
      logs[1].args.user.toLowerCase().should.equal(user)
      logs[1].args.amount.should.be.bignumber.equal(amount)
      // expect(validators).to.not.include.members([user])
      const userDetails = await stakeManager.getDetails(user)
      // should be unstaking
      userDetails[2].should.be.bignumber.equal(2)
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
      const oldValidators = await stakeManager.getCurrentValidatorSet()
      const unstakeEvents = [
        await stakeManager.unstake(amounts[2], '0x0', { from: users[2] }),
        await stakeManager.unstake(amounts[3], '0x0', { from: users[3] }),
        await stakeManager.unstake(amounts[4], '0x0', { from: users[4] })
      ]
      await stakeManager.updateEpoch()
      await stakeManager.updateEpoch()
      await stakeManager.updateEpoch()
      await stakeManager.updateEpoch()
      const unstakeClaimEvents = [
        await stakeManager.unstakeClaim({ from: users[0] }),
        await stakeManager.unstakeClaim({ from: users[1] }),
        await stakeManager.unstakeClaim({ from: users[2] }),
        await stakeManager.unstakeClaim({ from: users[3] }),
        await stakeManager.unstakeClaim({ from: users[4] })
      ]
      // const logs = [
      //   logDecoder.decodeLogs(unstakeClaimEvents[0].receipt.logs),
      //   logDecoder.decodeLogs(unstakeClaimEvents[1].receipt.logs),
      //   logDecoder.decodeLogs(unstakeClaimEvents[2].receipt.logs),
      //   logDecoder.decodeLogs(unstakeClaimEvents[3].receipt.logs),
      //   logDecoder.decodeLogs(unstakeClaimEvents[4].receipt.logs)
      // ]
      // console.log(logs)
      // console.log(users)
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
  })
})
