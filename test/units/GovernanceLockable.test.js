import { GovernanceLockableTest } from '../helpers/artifacts'
import { expectRevert } from '@openzeppelin/test-helpers'
import deployer from '../helpers/deployer.js'
import { generateFirstWallets, mnemonics } from '../helpers/wallets.js'

contract('GovernanceLockable', function() {
  const wallets = generateFirstWallets(mnemonics, 10)

  async function freshDeploy() {
    this.governance = await deployer.deployGovernance()
    this.lockableContract = await GovernanceLockableTest.new(this.governance.address)
  }

  beforeEach(freshDeploy)

  describe('lock', function() {
    describe('when from is not governance', function() {
      it('reverts', async function() {
        await expectRevert(this.lockableContract.lock({ from: wallets[5].getAddressString() }), 'Only governance contract is authorized')
      })
    })

    describe('when from is governance', function() {
      it('must lock', async function() {
        await this.governance.update(
          this.lockableContract.address,
          this.lockableContract.contract.methods.lock().encodeABI()
        )
      })
    })
  })

  describe('unlock', function() {
    describe('when from is not governance', function() {
      it('reverts', async function() {
        await expectRevert(this.lockableContract.unlock({ from: wallets[2].getAddressString() }), 'Only governance contract is authorized')
      })
    })

    describe('when from is governance', function() {
      it('must unlock', async function() {
        await this.governance.update(
          this.lockableContract.address,
          this.lockableContract.contract.methods.unlock().encodeABI()
        )
      })
    })
  })
})
