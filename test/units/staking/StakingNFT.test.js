import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import { StakingNFT } from '../../helpers/artifacts.js'

import { generateFirstWallets, mnemonics } from '../../helpers/wallets.js'

chai.use(chaiAsPromised).should()

contract('StakingNFT', async function (accounts) {
  let stakingNFT, wallets

  before(async function () {
    wallets = generateFirstWallets(mnemonics, 10)
  })

  beforeEach(async function () {
    stakingNFT = await StakingNFT.new('StakingNFT', 'SNFT')
  })

  it('should test for unique ownership:mint', async function () {
    const user = wallets[2].getAddressString()
    await stakingNFT.mint(user, 1)
    try {
      await stakingNFT.mint(user, 2)
      assert.fail('Should never allow second time minting')
    } catch (error) {
      const invalidOpcode = error.message.search('revert Validators MUST NOT own multiple stake position') >= 0
      assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
    }
  })

  it('should test for unique ownership:transfer', async function () {
    const user1 = wallets[2].getAddressString()
    const user2 = wallets[3].getAddressString()
    await stakingNFT.mint(user1, 1)
    await stakingNFT.mint(user2, 2)
    try {
      await stakingNFT.transferFrom(user2, user1, 2, {
        from: user2
      })
      assert.fail('Should never allow second time staking')
    } catch (error) {
      const invalidOpcode = error.message.search('revert Validators MUST NOT own multiple stake position') >= 0
      assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
    }
  })
})
