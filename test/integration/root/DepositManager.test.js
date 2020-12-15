import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../../helpers/deployer.js'
import * as utils from '../../helpers/utils'

const crypto = require('crypto')

chai
  .use(chaiAsPromised)
  .should()

contract('DepositManager @skip-on-coverage', async function(accounts) {
  let depositManager, childContracts
  const amount = web3.utils.toBN('10').pow(web3.utils.toBN('18'))

  describe('deposits on root and child', async function() {

    beforeEach(async function() {
      const contracts = await deployer.freshDeploy(accounts[0])
      depositManager = contracts.depositManager
      childContracts = await deployer.initializeChildChain(accounts[0])
    })

    it('depositERC20', async function() {
      const bob = accounts[1]
      const e20 = await deployer.deployChildErc20(accounts[0])
      await utils.deposit(
        depositManager,
        childContracts.childChain,
        e20.rootERC20,
        bob,
        amount,
        { rootDeposit: true, erc20: true }
      )

      // assert deposit on child chain
      utils.assertBigNumberEquality(await e20.childToken.balanceOf(bob), amount)
    })

    it('deposit Matic Tokens', async function() {
      const bob = '0x' + crypto.randomBytes(20).toString('hex')
      const e20 = await deployer.deployMaticToken()
      utils.assertBigNumberEquality(await e20.childToken.balanceOf(bob), 0)
      await utils.deposit(
        depositManager,
        childContracts.childChain,
        e20.rootERC20,
        bob,
        amount,
        { rootDeposit: true, erc20: true }
      )

      // assert deposit on child chain
      utils.assertBigNumberEquality(await e20.childToken.balanceOf(bob), amount)
    })
  })
})
