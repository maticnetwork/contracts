import { assertBigNumberEquality } from '../helpers/utils'
import { expectRevert } from '@openzeppelin/test-helpers'
import { generateFirstWallets, mnemonics } from '../helpers/wallets.js'

const UpgradableProxy = artifacts.require('UpgradableProxy')
const ProxyTestImpl = artifacts.require('ProxyTestImpl')
const ProxyTestImplStorageLayoutChange = artifacts.require('ProxyTestImplStorageLayoutChange')

contract('UpgradableProxy', function() {
  const wallets = generateFirstWallets(mnemonics, 10)

  async function doDeploy() {
    this.impl = await ProxyTestImpl.new()
    this.proxy = await UpgradableProxy.new(this.impl.address)
    this.testContract = await ProxyTestImpl.at(this.proxy.address)
  }

  describe('updateImplementation', function() {
    before(doDeploy)
    before(async function() {
      this.newImpl = await ProxyTestImpl.new()
    })

    describe('when from is not owner', function() {
      it('reverts', async function() {
        await expectRevert(this.proxy.updateImplementation(this.newImpl.address, { from: wallets[1].getAddressString() }), 'NOT_OWNER')
      })
    })

    describe('when from is owner', function() {
      it('must update implementation', async function() {
        await this.proxy.updateImplementation(this.newImpl.address)
        this.newTestContract = await ProxyTestImpl.at(this.proxy.address)
      })

      it('must have correct implementation', async function() {
        const impl = await this.proxy.implementation()
        impl.should.be.equal(this.newImpl.address)
      })

      it('must have a == 0', async function() {
        assertBigNumberEquality(await this.newTestContract.a(), '0')
      })

      it('must have b == 0', async function() {
        assertBigNumberEquality(await this.newTestContract.b(), '0')
      })

      it('must have ctorInit == 0', async function() {
        assertBigNumberEquality(await this.newTestContract.ctorInit(), '0')
      })

      it('must invoke init()', async function() {
        await this.newTestContract.init()
      })

      it('must have a == 1', async function() {
        assertBigNumberEquality(await this.newTestContract.a(), '1')
      })

      it('must have b == 2', async function() {
        assertBigNumberEquality(await this.newTestContract.b(), '2')
      })
    })
  })

  describe('transferOwnership', function() {
    before(doDeploy)
    before(async function() {
      this.newOwner = wallets[1].getChecksumAddressString()
    })

    describe('when from is not owner', function() {
      it('reverts', async function() {
        await expectRevert(this.proxy.transferOwnership(this.newOwner, { from: this.newOwner }), 'NOT_OWNER')
      })
    })

    describe('when from is owner', function() {
      it('must update owner', async function() {
        await this.proxy.transferOwnership(this.newOwner)
      })

      it('must have correct owner', async function() {
        const owner = await this.proxy.owner()
        owner.should.be.equal(this.newOwner)
      })
    })
  })

  describe('updateAndCall', function() {
    before(doDeploy)
    before(async function() {
      this.newImpl = await ProxyTestImpl.new()
    })

    describe('when from is not owner', function() {
      it('reverts', async function() {
        await expectRevert(this.proxy.updateImplementation(this.newImpl.address, { from: wallets[1].getAddressString() }), 'NOT_OWNER')
      })
    })

    describe('when from is owner', function() {
      it('must update and initialize new implementation', async function() {
        const calldata = this.newImpl.contract.methods.init().encodeABI()

        await this.proxy.updateAndCall(this.newImpl.address, calldata)
        this.newTestContract = await ProxyTestImpl.at(this.proxy.address)
      })

      it('must have a == 1', async function() {
        assertBigNumberEquality(await this.newTestContract.a(), '1')
      })

      it('must have b == 2', async function() {
        assertBigNumberEquality(await this.newTestContract.b(), '2')
      })
    })
  })

  describe('when implementation is not contract', function() {
    before(doDeploy)

    it('reverts', async function() {
      await expectRevert(this.proxy.updateImplementation(wallets[1].getAddressString()), 'DESTINATION_ADDRESS_IS_NOT_A_CONTRACT')
    })
  })

  describe('when implementation changes storage layout', function() {
    before(doDeploy)
    before(async function() {
      await this.testContract.init()

      this.newImpl = await ProxyTestImplStorageLayoutChange.new()
      await this.proxy.updateImplementation(this.newImpl.address)

      this.newTestContract = await ProxyTestImplStorageLayoutChange.at(this.proxy.address)
    })

    it('must have a == 2', async function() {
      assertBigNumberEquality(await this.newTestContract.a(), '2')
    })

    it('must have b == 1', async function() {
      assertBigNumberEquality(await this.newTestContract.b(), '1')
    })
  })
})
