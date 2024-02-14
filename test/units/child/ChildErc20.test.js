import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import testHelpers from '@openzeppelin/test-helpers'
const expectRevert = testHelpers.expectRevert

import deployer from '../../helpers/deployer.js'
import { getTransferSig } from '../../helpers/marketplaceUtils.js'
import { generateFirstWallets, mnemonics } from '../../helpers/wallets.js'
import { toChecksumAddress } from '../../helpers/utils.js'
import * as contracts from '../../helpers/artifacts.js'

import * as utils from '../../helpers/utils.js'
import crypto from 'crypto'

chai.use(chaiAsPromised).should()
const assert = chai.assert

const wallets = generateFirstWallets(mnemonics, 2)
const alicePrivateKey = wallets[0].getPrivateKeyString()
const alice = toChecksumAddress(wallets[0].getAddressString())
const bob = toChecksumAddress(wallets[1].getAddressString())

describe('ChildErc20', async function (accounts) {
  before(async () => {
    accounts = await ethers.getSigners()
    accounts = accounts.map((account) => {
      return account.address
    })
  })

  describe('erc20 check params', async function () {
    describe('properties', function () {
      before(freshDeploy)

      it('token', async function () {
        assert.strictEqual(await this.erc20.childToken.token(), this.erc20.rootERC20.address)
      })

      it('child chain', async function () {
        assert.strictEqual(await this.erc20.childToken.childChain(), this.childContracts.childChain.address)
      })

      it('fail: child chain', async function () {
        const childToken2 = this.erc20.childToken.connect(this.erc20.childToken.provider.getSigner(2))

        await expectRevert(
          childToken2.changeChildChain(accounts[9]),
          hre.__SOLIDITY_COVERAGE_RUNNING ? 'revert' : 'unknown account'
        )
        assert.strictEqual(await this.erc20.childToken.childChain(), this.childContracts.childChain.address)
      })

      it('success: child chain', async function () {
        const receipt = await (await this.erc20.childToken.changeChildChain(accounts[9])).wait()

        assert.strictEqual(receipt.events[0].event, 'ChildChainChanged')
        assert.strictEqual(receipt.events[0].args.previousAddress, this.childContracts.childChain.address)
        assert.strictEqual(receipt.events[0].args.newAddress, accounts[9])
        assert.strictEqual(await this.erc20.childToken.childChain(), accounts[9])
      })

      it('name', async function () {
        assert.strictEqual(await this.erc20.childToken.name(), 'ChildToken')
      })

      it('symbol', async function () {
        assert.strictEqual(await this.erc20.childToken.symbol(), 'CTOK')
      })

      it('decimals', async function () {
        utils.assertBigNumberEquality(await this.erc20.childToken.decimals(), 18)
      })

      it('parent', async function () {
        assert.strictEqual(await this.erc20.childToken.parent(), '0x0000000000000000000000000000000000000000')
      })

      it('fail: set parent', async function () {
        const childToken2 = this.erc20.childToken.connect(this.erc20.childToken.provider.getSigner(2))

        await expectRevert(
          childToken2.setParent(accounts[9]),
          hre.__SOLIDITY_COVERAGE_RUNNING ? 'revert' : 'unknown account'
        )
        assert.strictEqual(await this.erc20.childToken.parent(), '0x0000000000000000000000000000000000000000')
      })

      it('success: set parent', async function () {
        const receipt = await (await this.erc20.childToken.setParent(accounts[9])).wait()

        assert.strictEqual(receipt.events[0].event, 'ParentChanged')
        assert.strictEqual(receipt.events[0].args.previousAddress, '0x0000000000000000000000000000000000000000')
        assert.strictEqual(receipt.events[0].args.newAddress, accounts[9])
        assert.strictEqual(await this.erc20.childToken.parent(), accounts[9])
      })

      it('owner', async function () {
        assert.strictEqual(await this.erc20.childToken.owner(), accounts[0])
      })

      it('fail: set owner', async function () {
        const childToken1 = this.erc20.childToken.connect(this.erc20.childToken.provider.getSigner(1))
        assert.strictEqual(await this.erc20.childToken.owner(), accounts[0])
        if (hre.__SOLIDITY_COVERAGE_RUNNING) {
          await expectRevert.unspecified(childToken1.transferOwnership(accounts[1]))
        } else {
          await chai
            .expect((await childToken1.transferOwnership(accounts[1])).wait())
            .to.be.rejectedWith(ethers.errors.CALL_EXCEPTION)
        }
      })

      it('success: set owner', async function () {
        const receipt = await (await this.erc20.childTokenProxy.transferOwnership(accounts[1])).wait()

        assert.strictEqual(receipt.events[0].event, 'OwnerUpdate')
        assert.strictEqual(receipt.events[0].args._new, accounts[1])
        assert.strictEqual(receipt.events[0].args._old, accounts[0])
        assert.strictEqual(await this.erc20.childToken.owner(), accounts[1])
      })

      it('fail: proxy implementation', async function () {
        const newERC20 = await contracts.ChildERC20Proxified.deploy()

        if (hre.__SOLIDITY_COVERAGE_RUNNING) {
          await expectRevert.unspecified(this.erc20.childTokenProxy.updateImplementation(newERC20.address))
        } else {
          await chai
            .expect((await this.erc20.childTokenProxy.updateImplementation(newERC20.address)).wait())
            .to.be.rejectedWith(ethers.errors.CALL_EXCEPTION)
        }
      })

      it('success: proxy implementation', async function () {
        let newERC20 = await contracts.ChildERC20Proxified.deploy()
        const _old = await this.erc20.childTokenProxy.implementation()
        const childTokenProxy1 = this.erc20.childTokenProxy.connect(this.erc20.childTokenProxy.provider.getSigner(1))

        const receipt = await (await childTokenProxy1.updateImplementation(newERC20.address)).wait()

        assert.strictEqual(receipt.events[0].event, 'ProxyUpdated')
        assert.strictEqual(receipt.events[0].args._new, newERC20.address)
        assert.strictEqual(receipt.events[0].args._old, _old)
        assert.strictEqual(await this.erc20.childTokenProxy.implementation(), newERC20.address)

        // can not initialize again
        if (hre.__SOLIDITY_COVERAGE_RUNNING) {
          await expectRevert(
            this.erc20.childToken.initialize(this.erc20.rootERC20.address, 'NewChildToken', 'NCTOK', 18),
            'already inited'
          )
        } else {
          await chai
            .expect(
              (
                await this.erc20.childToken.initialize(this.erc20.rootERC20.address, 'NewChildToken', 'NCTOK', 18)
              ).wait()
            )
            .to.be.rejectedWith(ethers.errors.CALL_EXCEPTION)
        }

        assert.strictEqual(await this.erc20.childToken.name(), 'ChildToken')
      })
    })
  })

  describe('transfer', async function () {
    transferTest(async function (to, tokenIdOrAmount) {
      return this.erc20.childToken.transfer(to, tokenIdOrAmount)
    }, alice)
  })

  describe('transferWithSig', async function () {
    transferTest(async function (to, tokenIdOrAmount) {
      const expiration = (await utils.web3Child.eth.getBlockNumber()) + 10
      const childToken1 = this.erc20.childToken.connect(this.erc20.childToken.provider.getSigner(1))
      const data = '0x' + crypto.randomBytes(32).toString('hex')

      const { sig } = getTransferSig({
        privateKey: alicePrivateKey,
        spender: bob,
        data,
        tokenIdOrAmount,
        tokenAddress: this.erc20.childToken.address,
        expiration
      })
      return childToken1.transferWithSig(sig, tokenIdOrAmount, data, expiration, to)
    }, bob)
  })
})

async function freshDeploy() {
  this.childContracts = await deployer.initializeChildChain({ updateRegistry: false })
  this.erc20 = await deployer.deployChildErc20({ mapToken: false })
}

function transferTest(transferFn, feeSpender) {
  before(freshDeploy)

  const depositAmount = web3.utils.toBN('10')
  const tokenIdOrAmount = web3.utils.toBN('3')
  const expectedAfterBalance = depositAmount.sub(tokenIdOrAmount)
  const to = toChecksumAddress('0x' + crypto.randomBytes(20).toString('hex'))

  it('deposits to alice', async function () {
    // deposit inside has 2 contract calls, failing one will bring confustion
    await utils.deposit(null, this.childContracts.childChain, this.erc20.rootERC20, alice, depositAmount)
  })

  it(`alice has ${depositAmount.toString()} tokens`, async function () {
    assert.strictEqual((await this.erc20.childToken.balanceOf(alice)).toString(), depositAmount.toString())
  })

  it('new address has 0 balance', async function () {
    assert.strictEqual((await this.erc20.childToken.balanceOf(to)).toString(), '0')
  })

  it('transfers from alice to new address', async function () {
    this.receipt = await (await transferFn.call(this, to, tokenIdOrAmount.toString())).wait()
  })

  it(`alice has ${expectedAfterBalance.toString()} balance`, async function () {
    assert.strictEqual((await this.erc20.childToken.balanceOf(alice)).toString(), expectedAfterBalance.toString())
  })

  it(`new address has ${tokenIdOrAmount.toString()} balance`, async function () {
    assert.strictEqual((await this.erc20.childToken.balanceOf(to)).toString(), tokenIdOrAmount.toString())
  })

  it('emits Transfer', async function () {
    const log = this.receipt.events[utils.filterEvent(this.receipt.events, 'Transfer')]
    assert.deepEqual(log.args.from, alice)
    assert.deepEqual(log.args.to, to)
    utils.assertBigNumberEquality(log.args.value, tokenIdOrAmount)
  })

  it('emits LogTransfer', async function () {
    const log = this.receipt.events[utils.filterEvent(this.receipt.events, 'LogTransfer')]
    assert.deepEqual(log.args.token, toChecksumAddress(this.erc20.rootERC20.address))
    assert.deepEqual(log.args.from, alice)
    utils.assertBigNumberEquality(log.args.amount, tokenIdOrAmount)
  })

  if (!hre.__SOLIDITY_COVERAGE_RUNNING) {
    it('emits LogFeeTransfer', async function () {
      const log = this.receipt.events[utils.filterEvent(this.receipt.events, 'LogFeeTransfer')]
      assert.deepEqual(log.args.from, feeSpender)
    })
  }
}
