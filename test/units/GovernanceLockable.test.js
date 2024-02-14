import { GovernanceLockableTest } from '../helpers/artifacts.js'
import expectRevert from '@openzeppelin/test-helpers/src/expectRevert.js'
import deployer from '../helpers/deployer.js'
import { generateFirstWallets, mnemonics } from '../helpers/wallets.js'

describe('GovernanceLockable', function() {
  const wallets = generateFirstWallets(mnemonics, 10)

  async function freshDeploy() {
    this.governance = await deployer.deployGovernance()
    this.lockableContract = await GovernanceLockableTest.deploy(this.governance.address)
  }

  beforeEach(freshDeploy)

  describe('lock', function() {
    describe('when from is not governance', function() {
      it('reverts', async function () {
        const rootSigner1 = this.lockableContract.provider.getSigner(1)
        const lockableContract1 = this.lockableContract.connect(rootSigner1)
        
        await expectRevert(lockableContract1.lock(), 'Only governance contract is authorized')
      })
    })

    describe('when from is governance', function() {
      it('must lock', async function() {
        await this.governance.update(
          this.lockableContract.address,
          this.lockableContract.interface.encodeFunctionData("lock", [])
        )
      })
    })
  })

  describe('unlock', function() {
    describe('when from is not governance', function() {
      it('reverts', async function () {
        const rootSigner2 = this.lockableContract.provider.getSigner(2)
        const lockableContract2 = this.lockableContract.connect(rootSigner2)
        await expectRevert(lockableContract2.unlock(), 'Only governance contract is authorized')
      })
    })

    describe('when from is governance', function() {
      it('must unlock', async function() {
        await this.governance.update(
          this.lockableContract.address,
          this.lockableContract.interface.encodeFunctionData("unlock", [])
        )
      })
    })
  })
})
