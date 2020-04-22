/* jshint esversion: 9 */

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import {

  DrainStakeManager
} from '../helpers/artifacts'

import deployer from '../helpers/deployer.js'

import { generateFirstWallets, mnemonics } from '../helpers/wallets.js'

chai.use(chaiAsPromised).should()

contract('DrainStakeManager', async function([owner]) {
  describe('Upgrade and drain staking contract', async function() {
    before(async function() {
      this.wallets = generateFirstWallets(mnemonics, 10)

      let contracts = await deployer.deployStakeManager(this.wallets)

      this.governance = contracts.governance
      this.stakeToken = contracts.stakeToken
      this.stakeManager = contracts.stakeManager
      this.proxy = contracts.stakeManagerProxy
      this.stakeManagerImpl = contracts.stakeManagerImpl

      await this.stakeManager.updateCheckPointBlockInterval(1)
    })

    it('must have some tokens', async function() {
      const amount = web3.utils.toWei('90000')
      await this.stakeToken.mint(
        this.stakeManager.address,
        amount
      );
      (await this.stakeToken.balanceOf(this.stakeManager.address)).toString().should.be.equal(amount.toString())
    })

    it('must lock stake manager', async function() {
      await this.governance.update(
        this.stakeManager.address,
        this.stakeManager.contract.methods.lock().encodeABI()
      );
      (await this.stakeManager.locked()).should.be.equal(true)
    })

    it('must swap to drainable implementaion', async function() {
      this.stakeManagerDrainable = await DrainStakeManager.new()

      await this.proxy.updateImplementation(this.stakeManagerDrainable.address)
    })

    it('must fail draining when not drained by governance', async function() {
      const balance = await this.stakeToken.balanceOf(this.stakeManager.address)
      try {
        await this.stakeManagerDrainable.drain(owner, balance)
        assert.fail('Funds should not be drained')
      } catch (error) {
        assert(error.message.search('revert') >= 0, "Expected revert, got '" + error + "' instead")
        assert(error.message.search('Only governance contract is authorized') >= 0, `Expected 'Only governance contract is authorized', got ${error} instead`)
      }
    })

    it('must drain all funds when drained by governance', async function() {
      const balance = await this.stakeToken.balanceOf(this.stakeManager.address)
      await this.governance.update(
        this.stakeManager.address,
        this.stakeManagerDrainable.contract.methods.drain(owner, balance.toString()).encodeABI()
      );
      (await this.stakeToken.balanceOf(this.stakeManager.address)).toString().should.be.equal('0')
    })

    it('must swap back to normal implementaion', async function() {
      await this.proxy.updateImplementation(this.stakeManagerImpl.address)
    })

    it('must unlock stake manager', async function() {
      await this.governance.update(
        this.stakeManager.address,
        this.stakeManager.contract.methods.unlock().encodeABI()
      );
      (await this.stakeManager.locked()).should.be.equal(false)
    })
  })
})
