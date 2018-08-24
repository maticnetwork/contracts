import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBigNumber from 'chai-bignumber'

import { generateFirstWallets, mnemonics } from '../helpers/wallets'
import { linkLibs } from '../helpers/utils'
import { StakeManagerMock, RootToken } from '../helpers/contracts'
import LogDecoder from '../helpers/log-decoder'

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
      wallets = generateFirstWallets(mnemonics, 5)

      // transfer tokens to other accounts
      await stakeToken.mint(wallets[1].getAddressString(), web3.toWei(100))
      await stakeToken.mint(wallets[2].getAddressString(), web3.toWei(100))
      await stakeToken.mint(wallets[3].getAddressString(), web3.toWei(100))
      await stakeToken.mint(wallets[4].getAddressString(), web3.toWei(100))
    })

    it('should set token address and owner properly', async function() {
      await stakeManager.token().should.eventually.equal(stakeToken.address)
      await stakeManager.owner().should.eventually.equal(accounts[0])
    })

    it('should set the validator threshold to 2', async function() {
      const thresholdReceipt = await stakeManager.updateValidatorThreshold(2)
      const logs = logDecoder.decodeLogs(thresholdReceipt.receipt.logs)
      logs.should.have.lengthOf(1)
      logs[0].event.should.equal('ThresholdChange')
      logs[0].args.newThreshold.should.be.bignumber.equal(2)

      const newThreshold = await stakeManager.validatorThreshold()
      newThreshold.should.be.bignumber.equal(2)
    })

    it('should stake via wallets[1]', async function() {
      const user = wallets[1].getAddressString()
      const amount = web3.toWei(1)

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

      logs[1].event.should.equal('Staked')
      logs[1].args.user.toLowerCase().should.equal(user)
      logs[1].args.amount.should.be.bignumber.equal(amount)
      logs[1].args.total.should.be.bignumber.equal(amount)

      // check amount
      const totalStake = await stakeManager.totalStaked()
      totalStake.should.be.bignumber.equal(amount)

      // staked for
      const stakedFor = await stakeManager.totalStakedFor(user)
      stakedFor.should.be.bignumber.equal(amount)
    })

    it('should stake via wallets[2]', async function() {
      const user = wallets[2].getAddressString()
      const amount = web3.toWei(5)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(amount, '0x0', { from: user })

      // check amount
      const totalStake = await stakeManager.totalStaked()
      totalStake.should.be.bignumber.equal(web3.toWei(6))

      // staked for
      const stakedFor = await stakeManager.totalStakedFor(user)
      stakedFor.should.be.bignumber.equal(amount)
    })

    it('should stake via wallets[3]', async function() {
      const user = wallets[3].getAddressString()
      const amount = web3.toWei(20)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(amount, '0x0', { from: user })

      // check amount
      const totalStake = await stakeManager.totalStaked()
      totalStake.should.be.bignumber.equal(web3.toWei(26))

      // staked for
      const stakedFor = await stakeManager.totalStakedFor(user)
      stakedFor.should.be.bignumber.equal(amount)
    })

    it('should stake via wallets[4]', async function() {
      const user = wallets[4].getAddressString()
      const amount = web3.toWei(100)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(amount, '0x0', { from: user })

      // check amount
      const totalStake = await stakeManager.totalStaked()
      totalStake.should.be.bignumber.equal(web3.toWei(126))

      // staked for
      const stakedFor = await stakeManager.totalStakedFor(user)
      stakedFor.should.be.bignumber.equal(amount)
    })

    it('should unstake a small amount from wallets[4]', async() => {
      const user = wallets[4].getAddressString()

      // unstake
      const unstakeReceipt = await stakeManager.unstake(web3.toWei(26), '0x0', {
        from: user
      })
      const logs = logDecoder.decodeLogs(unstakeReceipt.receipt.logs)
      logs.should.have.lengthOf(2)

      logs[0].event.should.equal('Transfer')
      logs[0].args.from.toLowerCase().should.equal(stakeManager.address)
      logs[0].args.to.toLowerCase().should.equal(user)
      logs[0].args.value.should.be.bignumber.equal(web3.toWei(26))

      logs[1].event.should.equal('Unstaked')
      logs[1].args.user.toLowerCase().should.equal(user)
      logs[1].args.amount.should.be.bignumber.equal(web3.toWei(26))
      logs[1].args.total.should.be.bignumber.equal(web3.toWei(100 - 26))

      // check amount
      const totalStake = await stakeManager.totalStaked()
      totalStake.should.be.bignumber.equal(web3.toWei(126 - 26))

      // staked for
      const stakedFor = await stakeManager.totalStakedFor(user)
      stakedFor.should.be.bignumber.equal(web3.toWei(100 - 26))
    })

    it('should get the proposer and make sure it is a staker', async() => {
      const proposer = await stakeManager.getProposer()
      assert.isOk(
        proposer === wallets[1].getAddressString() ||
          proposer === wallets[2].getAddressString() ||
          proposer === wallets[3].getAddressString() ||
          proposer === wallets[4].getAddressString()
      )
    })
  })

  describe('Proposer', async function() {
    let stakeToken
    let stakeManager
    let wallets
    let stakes = {
      1: web3.toWei(1),
      2: web3.toWei(10),
      3: web3.toWei(20),
      4: web3.toWei(50)
    }

    before(async function() {
      wallets = generateFirstWallets(mnemonics, Object.keys(stakes).length)
      stakeToken = await RootToken.new('Stake Token', 'STAKE')
      stakeManager = await StakeManagerMock.new(stakeToken.address)

      for (var i = 1; i < wallets.length; i++) {
        const amount = stakes[i]
        const user = wallets[i].getAddressString()

        // get tokens
        await stakeToken.mint(user, amount)

        // approve transfer
        await stakeToken.approve(stakeManager.address, amount, {
          from: user
        })

        // stake
        await stakeManager.stake(amount, '0x0', { from: user })
      }

      // increase threshold to 2
      await stakeManager.updateValidatorThreshold(2)
    })

    it('should change proposer properly', async function() {
      let proposer = await stakeManager.getProposer()
      assert.isOk(
        proposer === wallets[1].getAddressString() ||
          proposer === wallets[2].getAddressString() ||
          proposer === wallets[3].getAddressString() ||
          proposer === wallets[4].getAddressString()
      )

      // finalize commit (changing proproser)
      await stakeManager.finalizeCommit(proposer)

      proposer = await stakeManager.getProposer()
      assert.isOk(
        proposer === wallets[1].getAddressString() ||
          proposer === wallets[2].getAddressString() ||
          proposer === wallets[3].getAddressString() ||
          proposer === wallets[4].getAddressString()
      )
    })
  })
})
