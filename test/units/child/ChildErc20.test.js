import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../../helpers/deployer.js'
import { getTransferSig } from '../../helpers/marketplaceUtils'
import { generateFirstWallets, mnemonics } from '../../helpers/wallets.js'
import { toChecksumAddress } from '../../helpers/utils.js'
import { expectEvent } from '@openzeppelin/test-helpers'

const utils = require('../../helpers/utils')
const crypto = require('crypto')

chai
  .use(chaiAsPromised)
  .should()

const wallets = generateFirstWallets(mnemonics, 1)
const alicePrivateKey = wallets[0].getPrivateKeyString()
const alice = toChecksumAddress(wallets[0].getAddressString())

contract('ChildErc20', async function(accounts) {
  async function freshDeploy() {
    this.childContracts = await deployer.initializeChildChain(accounts[0], { updateRegistry: false })
    this.erc20 = await deployer.deployChildErc20(accounts[0], { mapToken: false })
  }

  function transferTest(transferFn, feeSpender) {
    before(freshDeploy)

    const depositAmount = web3.utils.toBN('10')
    const tokenIdOrAmount = web3.utils.toBN('3')
    const expectedAfterBalance = depositAmount.sub(tokenIdOrAmount)
    const to = toChecksumAddress('0x' + crypto.randomBytes(20).toString('hex'))

    it('deposits to alice', async function() {
      // deposit inside has 2 contract calls, failing one will bring confustion
      await utils.deposit(null, this.childContracts.childChain, this.erc20.rootERC20, alice, depositAmount)
    })

    it(`alice has ${depositAmount.toString()} tokens`, async function() {
      assert.strictEqual((await this.erc20.childToken.balanceOf(alice)).toString(), depositAmount.toString())
    })

    it('new address has 0 balance', async function() {
      assert.strictEqual((await this.erc20.childToken.balanceOf(to)).toString(), '0')
    })

    it('transfers from alice to new address', async function() {
      this.receipt = await transferFn.call(this, to, tokenIdOrAmount)
    })

    it(`alice has ${expectedAfterBalance.toString()} balance`, async function() {
      assert.strictEqual((await this.erc20.childToken.balanceOf(alice)).toString(), expectedAfterBalance.toString())
    })

    it(`new address has ${tokenIdOrAmount.toString()} balance`, async function() {
      assert.strictEqual((await this.erc20.childToken.balanceOf(to)).toString(), tokenIdOrAmount.toString())
    })

    it('emits Transfer', async function() {
      await expectEvent(this.receipt, 'Transfer',
        {
          from: alice,
          to,
          value: tokenIdOrAmount
        })
    })

    it('emits LogTransfer', async function() {
      await expectEvent(this.receipt, 'LogTransfer',
        {
          amount: tokenIdOrAmount,
          token: toChecksumAddress(this.erc20.rootERC20.address),
          from: alice
        })
    })

    if (!process.env.SOLIDITY_COVERAGE) {
      it('emits LogFeeTransfer', async function() {
        await expectEvent(this.receipt, 'LogFeeTransfer',
          {
            from: feeSpender
          })
      })
    }
  }

  describe('transfer', async function() {
    transferTest(async function(to, tokenIdOrAmount) {
      return this.erc20.childToken.transfer(to, tokenIdOrAmount, { from: alice })
    }, alice)
  })

  describe('transferWithSig', async function() {
    const spender = accounts[1]
    const data = '0x' + crypto.randomBytes(32).toString('hex')

    transferTest(async function(to, tokenIdOrAmount) {
      const expiration = (await utils.web3Child.eth.getBlockNumber()) + 10
      const { sig } = getTransferSig({
        privateKey: alicePrivateKey,
        spender,
        data,
        tokenIdOrAmount,
        tokenAddress: this.erc20.childToken.address,
        expiration
      })
      return this.erc20.childToken.transferWithSig(sig, tokenIdOrAmount, data, expiration, to, { from: spender })
    }, spender)
  })
})
