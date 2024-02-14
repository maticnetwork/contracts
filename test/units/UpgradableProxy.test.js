import { assertBigNumberEquality } from '../helpers/utils.js'
import expectRevert from '@openzeppelin/test-helpers/src/expectRevert.js'
import { generateFirstWallets, mnemonics } from '../helpers/wallets.js'
import chaiAsPromised from 'chai-as-promised'
import * as chai from 'chai'
chai.use(chaiAsPromised).should()

describe('UpgradableProxy', function () {
  const wallets = generateFirstWallets(mnemonics, 10)

  async function doDeploy() {
    const UpgradableProxy = await ethers.getContractFactory('UpgradableProxy')
    const ProxyTestImpl = await ethers.getContractFactory('ProxyTestImpl')
    this.impl = await ProxyTestImpl.deploy()
    this.proxy = await UpgradableProxy.deploy(this.impl.address)
    this.testContract = await ProxyTestImpl.attach(this.proxy.address)
  }

  describe('updateImplementation', function () {
    before(doDeploy)
    before(async function () {
      const ProxyTestImpl = await ethers.getContractFactory('ProxyTestImpl')
      this.newImpl = await ProxyTestImpl.deploy()
    })

    describe('when from is not owner', function () {
      it('reverts', async function () {
        const proxy1 = this.proxy.connect(this.proxy.provider.getSigner(1))
        await expectRevert(proxy1.updateImplementation(this.newImpl.address), 'NOT_OWNER')
      })
    })

    describe('when from is owner', function () {
      it('must update implementation', async function () {
        const ProxyTestImpl = await ethers.getContractFactory('ProxyTestImpl')
        await this.proxy.updateImplementation(this.newImpl.address)
        this.newTestContract = await ProxyTestImpl.attach(this.proxy.address)
      })

      it('must have correct implementation', async function () {
        const impl = await this.proxy.implementation()
        impl.should.be.equal(this.newImpl.address)
      })

      it('must have a == 0', async function () {
        assertBigNumberEquality(await this.newTestContract.a(), '0')
      })

      it('must have b == 0', async function () {
        assertBigNumberEquality(await this.newTestContract.b(), '0')
      })

      it('must have ctorInit == 0', async function () {
        assertBigNumberEquality(await this.newTestContract.ctorInit(), '0')
      })

      it('must invoke init()', async function () {
        await this.newTestContract.init()
      })

      it('must have a == 1', async function () {
        assertBigNumberEquality(await this.newTestContract.a(), '1')
      })

      it('must have b == 2', async function () {
        assertBigNumberEquality(await this.newTestContract.b(), '2')
      })
    })
  })

  describe('transferOwnership', function () {
    before(doDeploy)
    before(async function () {
      this.newOwner = wallets[1].getChecksumAddressString()
    })

    describe('when from is not owner', function () {
      it('reverts', async function () {
        const proxy1 = this.proxy.connect(this.proxy.provider.getSigner(1))
        await expectRevert(proxy1.transferOwnership(this.newOwner), 'NOT_OWNER')
      })
    })

    describe('when from is owner', function () {
      it('must update owner', async function () {
        await this.proxy.transferOwnership(this.newOwner)
      })

      it('must have correct owner', async function () {
        const owner = await this.proxy.owner()
        owner.should.be.equal(this.newOwner)
      })
    })
  })

  describe('updateAndCall', function () {
    before(doDeploy)
    before(async function () {
      const ProxyTestImpl = await ethers.getContractFactory('ProxyTestImpl')
      this.newImpl = await ProxyTestImpl.deploy()
    })

    describe('when from is not owner', function () {
      it('reverts', async function () {
        const proxy1 = this.proxy.connect(this.proxy.provider.getSigner(1))
        await expectRevert(proxy1.updateImplementation(this.newImpl.address), 'NOT_OWNER')
      })
    })

    describe('when from is owner', function () {
      it('must update and initialize new implementation', async function () {
        const calldata = this.newImpl.interface.encodeFunctionData('init')

        const ProxyTestImpl = await ethers.getContractFactory('ProxyTestImpl')
        await this.proxy.updateAndCall(this.newImpl.address, calldata)
        this.newTestContract = await ProxyTestImpl.attach(this.proxy.address)
      })

      it('must have a == 1', async function () {
        assertBigNumberEquality(await this.newTestContract.a(), '1')
      })

      it('must have b == 2', async function () {
        assertBigNumberEquality(await this.newTestContract.b(), '2')
      })
    })
  })

  describe('when implementation is not contract', function () {
    before(doDeploy)

    it('reverts', async function () {
      await expectRevert(
        this.proxy.updateImplementation(wallets[1].getAddressString()),
        'DESTINATION_ADDRESS_IS_NOT_A_CONTRACT'
      )
    })
  })

  describe('when implementation changes storage layout', function () {
    before(doDeploy)
    before(async function () {
      await this.testContract.init()

      const ProxyTestImplStorageLayoutChange = await ethers.getContractFactory('ProxyTestImplStorageLayoutChange')
      this.newImpl = await ProxyTestImplStorageLayoutChange.deploy()
      await this.proxy.updateImplementation(this.newImpl.address)

      this.newTestContract = await ProxyTestImplStorageLayoutChange.attach(this.proxy.address)
    })

    it('must have a == 2', async function () {
      assertBigNumberEquality(await this.newTestContract.a(), '2')
    })

    it('must have b == 1', async function () {
      assertBigNumberEquality(await this.newTestContract.b(), '1')
    })
  })
})
