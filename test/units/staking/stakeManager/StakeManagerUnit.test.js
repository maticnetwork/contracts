
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../../../helpers/deployer.js'
import { generateFirstWallets, mnemonics } from '../../../helpers/wallets.js'
import { assertBigNumberEquality } from '../../../helpers/utils.js'

chai.use(chaiAsPromised).should()

contract('StakeManager: unit test governance, delegation contract only functions', async function(accounts) {
  let stakeToken
  let stakeManager
  let wallets

  describe('extra functions', async function() {
    before(async function() {
      wallets = generateFirstWallets(mnemonics, 10)
      let contracts = await deployer.deployStakeManager(wallets)
      stakeToken = contracts.stakeToken
      stakeManager = contracts.stakeManager

      await stakeManager.updateDynastyValue(8)
      await stakeManager.updateCheckPointBlockInterval(1)
      const user = wallets[1].getAddressString()
      const userPubkey = wallets[1].getPublicKeyString()
      const amount = web3.utils.toWei('202')
      const heimdallFee = web3.utils.toWei('2')
      const stakedAmount = web3.utils.toWei('200')
      
      await stakeToken.mint(user, amount)
      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })
      // stake now
      await stakeManager.stake(stakedAmount, heimdallFee, false, userPubkey, {
        from: user
      })
    })

    it('should try to call onlyDelegation contract functions and fail', async function() {
      // delegationDeposit
      try {
        await stakeManager.delegationDeposit(1, 1, wallets[1].getAddressString())
        assert.fail('Modifier check failed: delegationDeposit')
      } catch (error) {
        const invalidOpcode = error.message.search('revert Invalid contract address') >= 0
        assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
      }
      // delegationTransfer
      try {
        await stakeManager.delegationTransfer(1, 1, wallets[1].getAddressString())
        assert.fail('Modifier check failed: delegationTransfer')
      } catch (error) {
        const invalidOpcode = error.message.search('revert Invalid contract address') >= 0
        assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
      }
      // updateValidatorState
      try {
        await stakeManager.updateValidatorState(1, 10000)
        assert.fail('Modifier check failed: updateValidatorState')
      } catch (error) {
        const invalidOpcode = error.message.search('revert Invalid contract address') >= 0
        assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
      }
    })

    it('should test validator id to user(owner) address', async function() {
      const validatorId = await stakeManager.getValidatorId(wallets[1].getAddressString())
      assertBigNumberEquality(validatorId, web3.utils.toBN(1))
    })

    it('should test public key to address function', async function() {
      const signer = await stakeManager.pubToAddress(wallets[1].getPublicKeyString())
      signer.toLowerCase().should.equal(wallets[1].getAddressString().toLowerCase())
    })
  })
})
