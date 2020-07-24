import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { expectRevert, expectEvent } from '@openzeppelin/test-helpers'

import deployer from '../../helpers/deployer.js'
import { getTransferSig } from '../../helpers/marketplaceUtils'
import { generateFirstWallets, mnemonics } from '../../helpers/wallets.js'
import { toChecksumAddress } from '../../helpers/utils.js'
import * as contracts from '../../helpers/artifacts'

const ChildContracts = contracts.childContracts
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

  describe('erc20 check params', async function() {
    before(freshDeploy)

    describe('properties', function() {
      it('token', async function() {
        assert.strictEqual(await this.erc20.childToken.token(), this.erc20.rootERC20.address)
      })

      it('child chain', async function() {
        assert.strictEqual(await this.erc20.childToken.childChain(), this.childContracts.childChain.address)
      })

      it('fail: child chain', async function() {
        await expectRevert(this.erc20.childToken.changeChildChain(accounts[9], {
          from: accounts[2]
        }), 'unknown account')
        assert.strictEqual(await this.erc20.childToken.childChain(), this.childContracts.childChain.address)
      })

      it('success: child chain', async function() {
        const receipt = await this.erc20.childToken.changeChildChain(accounts[9], {
          from: accounts[0]
        })

        assert.strictEqual(receipt.logs.length, 2)
        assert.strictEqual(receipt.logs[0].event, 'ChildChainChanged')
        assert.strictEqual(receipt.logs[0].args.previousAddress, this.childContracts.childChain.address)
        assert.strictEqual(receipt.logs[0].args.newAddress, accounts[9])
        assert.strictEqual(await this.erc20.childToken.childChain(), accounts[9])
      })

      it('name', async function() {
        assert.strictEqual(await this.erc20.childToken.name(), "ChildToken")
      })

      it('symbol', async function() {
        assert.strictEqual(await this.erc20.childToken.symbol(), "CTOK")
      })

      it('decimals', async function() {
        utils.assertBigNumberEquality(await this.erc20.childToken.decimals(), 18)
      })

      it('parent', async function() {
        assert.strictEqual(await this.erc20.childToken.parent(), "0x0000000000000000000000000000000000000000")
      })

      it('fail: set parent', async function() {
        await expectRevert(this.erc20.childToken.setParent(accounts[9], {
          from: accounts[2]
        }), 'unknown account')
        assert.strictEqual(await this.erc20.childToken.parent(), "0x0000000000000000000000000000000000000000")
      })

      it('success: set parent', async function() {
        const receipt = await this.erc20.childToken.setParent(accounts[9], {
          from: accounts[0]
        })

        assert.strictEqual(receipt.logs.length, 2)
        assert.strictEqual(receipt.logs[0].event, 'ParentChanged')
        assert.strictEqual(receipt.logs[0].args.previousAddress, '0x0000000000000000000000000000000000000000')
        assert.strictEqual(receipt.logs[0].args.newAddress, accounts[9])
        assert.strictEqual(await this.erc20.childToken.parent(), accounts[9])
      })

      it('owner', async function() {
        assert.strictEqual(await this.erc20.childToken.owner(), accounts[0])
      })

      it('fail: set owner', async function() {
        await expectRevert.unspecified(this.erc20.childToken.transferOwnership(accounts[1], {
          from: accounts[1]
        }))
        assert.strictEqual(await this.erc20.childToken.owner(), accounts[0])
      })

      it('success: set owner', async function() {
        const receipt = await this.erc20.childTokenProxy.transferOwnership(accounts[1], {
          from: accounts[0]
        })

        assert.strictEqual(receipt.logs[0].event, 'OwnerUpdate')
        assert.strictEqual(receipt.logs[0].args._new, accounts[1])
        assert.strictEqual(receipt.logs[0].args._old, accounts[0])
        assert.strictEqual(await this.erc20.childToken.owner(), accounts[1])
      })

      it('fail: proxy implementation', async function() {
        const newERC20 = await ChildContracts.ChildERC20Proxified.new({ gas: 20000000 })
        await expectRevert.unspecified(this.erc20.childTokenProxy.updateImplementation(newERC20.address, {
          from: accounts[0]
        }))
      })

      it('success: proxy implementation', async function() {
        let newERC20 = await ChildContracts.ChildERC20Proxified.new({ gas: 20000000 })
        const _old = await this.erc20.childTokenProxy.implementation()
        const receipt = await this.erc20.childTokenProxy.updateImplementation(newERC20.address, {
          from: accounts[1]
        })

        assert.strictEqual(receipt.logs[0].event, 'ProxyUpdated')
        assert.strictEqual(receipt.logs[0].args._new, newERC20.address)
        assert.strictEqual(receipt.logs[0].args._old, _old)
        assert.strictEqual(await this.erc20.childTokenProxy.implementation(), newERC20.address)

        // can not initialize again
        await expectRevert.unspecified(this.erc20.childToken.initialize(
          this.erc20.rootERC20.address,
          'NewChildToken',
          'NCTOK',
          18
        ))

        assert.strictEqual(await this.erc20.childToken.name(), "ChildToken")
      })
    })
  })

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
