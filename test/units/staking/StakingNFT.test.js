import { StakingNFT } from '../../helpers/artifacts.js'
import { generateFirstWallets, mnemonics } from '../../helpers/wallets.js'
import { expectRevert } from '@openzeppelin/test-helpers'
import { InterfaceIds, shouldSupportInterfaces } from '../behaviors/SupportsInterface.behavior'

contract('StakingNFT', async function() {
  let stakingNFT, wallets

  before(async function() {
    wallets = generateFirstWallets(mnemonics, 10)
  })

  beforeEach(async function() {
    stakingNFT = await StakingNFT.new('StakingNFT', 'SNFT')
    this.contract = stakingNFT
  })

  shouldSupportInterfaces([
    InterfaceIds.ERC721,
    InterfaceIds.ERC721Enumerable
  ])

  describe('when mint more than once for the same address', function() {
    beforeEach(async function() {
      this.user = wallets[2].getAddressString()
      await stakingNFT.mint(this.user, 1)
    })

    it('reverts', async function() {
      await expectRevert(stakingNFT.mint(this.user, 2), 'Validators MUST NOT own multiple stake position')
    })
  })

  describe('when transfer to another address that already have staking NFT', function() {
    beforeEach(async function() {
      this.user1 = wallets[2].getAddressString()
      this.user2 = wallets[3].getAddressString()
      await stakingNFT.mint(this.user1, 1)
      await stakingNFT.mint(this.user2, 2)
    })

    it('reverts', async function() {
      await expectRevert(stakingNFT.transferFrom(this.user2, this.user1, 2, {
        from: this.user2
      }), 'Validators MUST NOT own multiple stake position')
    })
  })
})
