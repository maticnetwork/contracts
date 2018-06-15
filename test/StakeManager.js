import bip39 from 'bip39'
import utils from 'ethereumjs-util'
import {Buffer} from 'safe-buffer'

import {generateFirstWallets, mnemonics} from './helpers/wallets'
import {linkLibs, encodeSigs, getSigs} from './helpers/utils'
import {StakeManager, RootToken, RootChain} from './helpers/contracts'

const BN = utils.BN
const rlp = utils.rlp

contract('StakeManager', async function(accounts) {
  describe('initialization', async function() {
    let stakeToken
    let stakeManager

    before(async function() {
      // link libs
      await linkLibs()

      stakeToken = await RootToken.new('Stake Token', 'STAKE')
      stakeManager = await StakeManager.new(stakeToken.address, {
        from: accounts[0]
      })
    })

    it('should set token address and owner properly', async function() {
      assert.equal(await stakeManager.token(), stakeToken.address)
    })

    it('should set owner properly', async function() {
      assert.equal(await stakeManager.owner(), accounts[0])
    })
  })

  // staking
  describe('Stake', async function() {
    let stakeToken
    let stakeManager
    let wallets

    before(async function() {
      wallets = generateFirstWallets(mnemonics, 5)

      stakeToken = await RootToken.new('Stake Token', 'STAKE')
      stakeManager = await StakeManager.new(stakeToken.address, {
        from: accounts[0]
      })

      // transfer tokens to other accounts
      await stakeToken.transfer(wallets[1].getAddressString(), web3.toWei(100))
      await stakeToken.transfer(wallets[2].getAddressString(), web3.toWei(100))
      await stakeToken.transfer(wallets[3].getAddressString(), web3.toWei(100))
      await stakeToken.transfer(wallets[4].getAddressString(), web3.toWei(100))
    })

    it('should set the validator threshold to 2', async function() {
      const receipt = await stakeManager.updateValidatorThreshold(2)
      assert.equal(receipt.logs.length, 1)
      assert.equal(receipt.logs[0].event, 'ThresholdChange')
      assert.equal(+receipt.logs[0].args.newThreshold, 2)
      assert.equal(parseInt(await stakeManager.validatorThreshold()), 2)
    })

    it('should stake via wallets[1]', async function() {
      const user = wallets[1].getAddressString()
      const amount = web3.toWei(1)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      const receipt = await stakeManager.stake(amount, '0x0', {from: user})
      assert.equal(receipt.logs[0].event, 'Staked')
      assert.equal(receipt.logs[0].args.user, user)
      assert.equal(receipt.logs[0].args.amount.toString(), amount)
      assert.equal(receipt.logs[0].args.total.toString(), amount)

      // check amount and stake sum
      assert.equal(await stakeManager.totalStaked(), amount)
      assert.equal(await stakeManager.totalStakedFor(user), amount)
    })

    it('should stake via wallets[2]', async function() {
      const user = wallets[2].getAddressString()
      const amount = web3.toWei(5)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(amount, '0x0', {from: user})

      // check amount and stake sum
      assert.equal(await stakeManager.totalStaked(), web3.toWei(6))
      assert.equal(await stakeManager.totalStakedFor(user), amount)
    })

    it('should stake via wallets[3]', async function() {
      const user = wallets[3].getAddressString()
      const amount = web3.toWei(20)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(amount, '0x0', {from: user})

      // check amount and stake sum
      assert.equal(await stakeManager.totalStaked(), web3.toWei(26))
      assert.equal(await stakeManager.totalStakedFor(user), amount)
    })

    it('should stake via wallets[4]', async function() {
      const user = wallets[4].getAddressString()
      const amount = web3.toWei(100)

      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })

      // stake now
      await stakeManager.stake(amount, '0x0', {from: user})

      // check amount and stake sum
      assert.equal(await stakeManager.totalStaked(), web3.toWei(126))
      assert.equal(await stakeManager.totalStakedFor(user), amount)
    })

    it('should unstake a small amount from wallets[4]', async() => {
      const user = wallets[4].getAddressString()

      // unstake
      const receipt = await stakeManager.unstake(web3.toWei(26), '0x0', {
        from: user
      })
      assert.equal(receipt.logs[0].event, 'Unstaked')
      assert.equal(receipt.logs[0].args.user, user)
      assert.equal(receipt.logs[0].args.amount.toString(), web3.toWei(26))
      assert.equal(receipt.logs[0].args.total.toString(), web3.toWei(100 - 26))

      // check amount and stake sum
      assert.equal(await stakeManager.totalStaked(), web3.toWei(126 - 26))
      assert.equal(
        await stakeManager.totalStakedFor(user),
        web3.toWei(100 - 26)
      )
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

  describe('Validation', async function() {
    let stakeToken
    let stakeManager
    let rootChain
    let wallets
    let stakes = {
      1: web3.toWei(1),
      2: web3.toWei(10),
      3: web3.toWei(20),
      4: web3.toWei(50)
    }
    let chain
    let dummyRoot
    let sigs

    before(async function() {
      wallets = generateFirstWallets(mnemonics, Object.keys(stakes).length)
      stakeToken = await RootToken.new('Stake Token', 'STAKE')
      stakeManager = await StakeManager.new(stakeToken.address)
      rootChain = await RootChain.new(stakeManager.address)
      await stakeManager.setRootChain(rootChain.address)

      for (var i = 1; i < wallets.length; i++) {
        const amount = stakes[i]
        const user = wallets[i].getAddressString()

        // get tokens
        await stakeToken.transfer(user, amount)

        // approve transfer
        await stakeToken.approve(stakeManager.address, amount, {
          from: user
        })

        // stake
        await stakeManager.stake(amount, '0x0', {from: user})
      }

      // increase threshold to 2
      await stakeManager.updateValidatorThreshold(2)

      chain = await rootChain.chain()
      dummyRoot = utils.bufferToHex(utils.sha3('dummy'))
    })

    it('should create sigs properly', async function() {
      sigs = utils.bufferToHex(
        encodeSigs(
          getSigs(wallets.slice(1), chain, dummyRoot, 0, 10, [
            await stakeManager.getProposer()
          ])
        )
      )

      const signers = await stakeManager.checkSignatures(dummyRoot, 0, 10, sigs)

      // total sigs = wallet.length - proposer - owner
      assert.equal(signers.toNumber(), wallets.length - 2)
    })
  })
})
