import { StakingNFT } from '../../helpers/artifacts.js'
import { generateFirstWallets, mnemonics } from '../../helpers/wallets.js'
import { InterfaceIds, shouldSupportInterfaces } from '../behaviors/SupportsInterface.behavior.js'
import testHelpers from '@openzeppelin/test-helpers'
const expectRevert = testHelpers.expectRevert

describe('StakingNFT', async function () {
  let stakingNFT, wallets

  before(async function () {
    wallets = generateFirstWallets(mnemonics, 10)
  })

  beforeEach(async function () {
    stakingNFT = await StakingNFT.deploy('StakingNFT', 'SNFT')
    this.contract = stakingNFT
  })

  shouldSupportInterfaces([InterfaceIds.ERC721, InterfaceIds.ERC721Enumerable])

  describe('when mint more than once for the same address', function () {
    beforeEach(async function () {
      this.user = wallets[2].getAddressString()
      await stakingNFT.mint(this.user, 1)
    })

    it('reverts', async function () {
      await expectRevert(stakingNFT.mint(this.user, 2), 'Validators MUST NOT own multiple stake position')
    })
  })

  describe('when transfer to another address that already have staking NFT', function () {
    beforeEach(async function () {
      this.user1 = wallets[2].getAddressString()
      this.user2 = wallets[3].getAddressString()
      await stakingNFT.mint(this.user1, 1)
      await stakingNFT.mint(this.user2, 2)
    })

    it('reverts', async function () {
      const stakingNFT_2 = stakingNFT.connect(stakingNFT.provider.getSigner(this.user2))
      await expectRevert(
        stakingNFT_2.transferFrom(this.user2, this.user1, 2),
        'Validators MUST NOT own multiple stake position'
      )
    })
  })
})
