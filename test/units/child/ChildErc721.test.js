import chai, { assert } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { expectRevert } from '@openzeppelin/test-helpers'

import * as contracts from '../../helpers/artifacts'
import deployer from '../../helpers/deployer.js'
import { generateFirstWallets, mnemonics } from '../../helpers/wallets.js'

const utils = require('../../helpers/utils')

chai
  .use(chaiAsPromised)
  .should()

const wallets = generateFirstWallets(mnemonics, 1)

contract('ChildErc721', async function(accounts) {
  async function freshDeploy() {
    this.childContracts = await deployer.initializeChildChain(accounts[0], { updateRegistry: false })
    this.erc721 = await deployer.deployChildErc721(accounts[0], { mapToken: false })
  }

  describe('erc721 check params', async function() {
    before(freshDeploy)

    describe('properties', function() {
      it('token', async function() {
        assert.strictEqual(await this.erc721.childErc721.token(), this.erc721.rootERC721.address)
      })

      it('child chain', async function() {
        assert.strictEqual(await this.erc721.childErc721.childChain(), this.childContracts.childChain.address)
      })

      it('fail: child chain', async function() {
        await expectRevert(this.erc721.childErc721.changeChildChain(accounts[9], {
          from: accounts[2]
        }), 'unknown account')
        assert.strictEqual(await this.erc721.childErc721.childChain(), this.childContracts.childChain.address)
      })

      it('success: child chain', async function() {
        const receipt = await this.erc721.childErc721.changeChildChain(accounts[9], {
          from: accounts[0]
        })

        assert.strictEqual(receipt.logs.length, 2)
        assert.strictEqual(receipt.logs[0].event, 'ChildChainChanged')
        assert.strictEqual(receipt.logs[0].args.previousAddress, this.childContracts.childChain.address)
        assert.strictEqual(receipt.logs[0].args.newAddress, accounts[9])
        assert.strictEqual(await this.erc721.childErc721.childChain(), accounts[9])
      })

      it('name', async function() {
        assert.strictEqual(await this.erc721.childErc721.name(), "ChildERC721")
      })

      it('symbol', async function() {
        assert.strictEqual(await this.erc721.childErc721.symbol(), "C721")
      })

      it('parent', async function() {
        assert.strictEqual(await this.erc721.childErc721.parent(), "0x0000000000000000000000000000000000000000")
      })

      it('fail: set parent', async function() {
        await expectRevert(this.erc721.childErc721.setParent(accounts[9], {
          from: accounts[2]
        }), 'unknown account')
        assert.strictEqual(await this.erc721.childErc721.parent(), "0x0000000000000000000000000000000000000000")
      })

      it('success: set parent', async function() {
        const receipt = await this.erc721.childErc721.setParent(accounts[9], {
          from: accounts[0]
        })

        assert.strictEqual(receipt.logs.length, 2)
        assert.strictEqual(receipt.logs[0].event, 'ParentChanged')
        assert.strictEqual(receipt.logs[0].args.previousAddress, '0x0000000000000000000000000000000000000000')
        assert.strictEqual(receipt.logs[0].args.newAddress, accounts[9])
        assert.strictEqual(await this.erc721.childErc721.parent(), accounts[9])
      })

      it('owner', async function() {
        assert.strictEqual(await this.erc721.childErc721.owner(), accounts[0])
      })

      it('fail: set owner', async function() {
        await expectRevert.unspecified(this.erc721.childTokenProxy.transferOwnership(accounts[1], {
          from: accounts[1]
        }))
        assert.strictEqual(await this.erc721.childErc721.owner(), accounts[0])
      })

      it('success: set Owner', async function() {
        const receipt = await this.erc721.childTokenProxy.transferOwnership(accounts[1], {
          from: accounts[0]
        })

        assert.strictEqual(receipt.logs[0].event, 'OwnerUpdate')
        assert.strictEqual(receipt.logs[0].args._new, accounts[1])
        assert.strictEqual(receipt.logs[0].args._old, accounts[0])
        assert.strictEqual(await this.erc721.childErc721.owner(), accounts[1])
      })
    })
  })
})
