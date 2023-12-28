import chai, { assert } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import testHelpers from '@openzeppelin/test-helpers'
const expectRevert = testHelpers.expectRevert

import deployer from '../../helpers/deployer.js'

chai.use(chaiAsPromised).should()

describe('ChildErc721', async function (accounts) {
  async function freshDeploy() {
    accounts = await ethers.getSigners()
    accounts = accounts.map((account) => {
      return account.address
    })

    this.childContracts = await deployer.initializeChildChain({ updateRegistry: false })
    this.erc721 = await deployer.deployChildErc721({ mapToken: false })
  }

  describe('erc721 check params', async function () {
    describe('properties', function () {
      before(freshDeploy)

      it('token', async function () {
        assert.strictEqual(await this.erc721.childErc721.token(), this.erc721.rootERC721.address)
      })

      it('child chain', async function () {
        assert.strictEqual(await this.erc721.childErc721.childChain(), this.childContracts.childChain.address)
      })

      it('fail: child chain', async function () {
        const childErc721_2 = this.erc721.childErc721.connect(this.erc721.childErc721.provider.getSigner(2))
        await expectRevert(
          childErc721_2.changeChildChain(accounts[9]),
          hre.__SOLIDITY_COVERAGE_RUNNING ? 'revert' : 'unknown account'
        )
        assert.strictEqual(await this.erc721.childErc721.childChain(), this.childContracts.childChain.address)
      })

      it('success: child chain', async function () {
        const receipt = await (await this.erc721.childErc721.changeChildChain(accounts[9])).wait()

        assert.strictEqual(receipt.events[0].event, 'ChildChainChanged')
        assert.strictEqual(receipt.events[0].args.previousAddress, this.childContracts.childChain.address)
        assert.strictEqual(receipt.events[0].args.newAddress, accounts[9])
        assert.strictEqual(await this.erc721.childErc721.childChain(), accounts[9])
      })

      it('name', async function () {
        assert.strictEqual(await this.erc721.childErc721.name(), 'ChildERC721')
      })

      it('symbol', async function () {
        assert.strictEqual(await this.erc721.childErc721.symbol(), 'C721')
      })

      it('parent', async function () {
        assert.strictEqual(await this.erc721.childErc721.parent(), '0x0000000000000000000000000000000000000000')
      })

      it('fail: set parent', async function () {
        const childErc721_2 = this.erc721.childErc721.connect(this.erc721.childErc721.provider.getSigner(2))
        await expectRevert(
          childErc721_2.setParent(accounts[9]),
          hre.__SOLIDITY_COVERAGE_RUNNING ? 'revert' : 'unknown account'
        )
        assert.strictEqual(await this.erc721.childErc721.parent(), '0x0000000000000000000000000000000000000000')
      })

      it('success: set parent', async function () {
        const receipt = await (await this.erc721.childErc721.setParent(accounts[9])).wait()

        assert.strictEqual(receipt.events[0].event, 'ParentChanged')
        assert.strictEqual(receipt.events[0].args.previousAddress, '0x0000000000000000000000000000000000000000')
        assert.strictEqual(receipt.events[0].args.newAddress, accounts[9])
        assert.strictEqual(await this.erc721.childErc721.parent(), accounts[9])
      })

      it('owner', async function () {
        assert.strictEqual(await this.erc721.childErc721.owner(), accounts[0])
      })

      it('fail: set owner', async function () {
        const childTokenProxy1 = this.erc721.childTokenProxy.connect(this.erc721.childTokenProxy.provider.getSigner(1))

        assert.strictEqual(await this.erc721.childErc721.owner(), accounts[0])
        if (hre.__SOLIDITY_COVERAGE_RUNNING) {
          await expectRevert.unspecified(childTokenProxy1.transferOwnership(accounts[1]))
        } else {
          await chai
            .expect((await childTokenProxy1.transferOwnership(accounts[1])).wait())
            .to.be.rejectedWith(ethers.errors.CALL_EXCEPTION)
        }
      })

      it('success: set Owner', async function () {
        const receipt = await (await this.erc721.childTokenProxy.transferOwnership(accounts[1])).wait()

        assert.strictEqual(receipt.events[0].event, 'OwnerUpdate')
        assert.strictEqual(receipt.events[0].args._new, accounts[1])
        assert.strictEqual(receipt.events[0].args._old, accounts[0])
        assert.strictEqual(await this.erc721.childErc721.owner(), accounts[1])
      })
    })
  })
})
