import deployer from '../../helpers/deployer.js'
import * as utils from '../../helpers/utils.js'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import * as artifacts from '../../helpers/artifacts.js'
import StatefulUtils from '../../helpers/StatefulUtils'

const predicateTestUtils = require('./predicates/predicateTestUtils')
const ethUtils = require('ethereumjs-util')
const crypto = require('crypto')

chai
  .use(chaiAsPromised)
  .should()

contract('DepositManager Update @skip-on-coverage', async function(accounts) {
  let depositManager, childContracts, registry, governance, e20, polygonMigrationTest, pol, statefulUtils, contracts
  const amount = web3.utils.toBN('10').pow(web3.utils.toBN('18'))

  describe('test POL and MATIC behaviours', async function() {
    before(async() => {
      statefulUtils = new StatefulUtils()
    })

    beforeEach(async function() {
      contracts = await deployer.freshDeploy(accounts[0])
      contracts.ERC20Predicate = await deployer.deployErc20Predicate()
      depositManager = contracts.depositManager
      registry = contracts.registry
      governance = contracts.governance
      childContracts = await deployer.initializeChildChain(accounts[0])

      e20 = await deployer.deployMaticToken()
      await governance.update(
        registry.address,
        registry.contract.methods.updateContractMap(ethUtils.keccak256('matic'), e20.rootERC20.address).encodeABI()
      )

      // deploy PolygonMigration test impl
      polygonMigrationTest = await artifacts.PolygonMigrationTest.new()

      await governance.update(
        registry.address,
        registry.contract.methods.updateContractMap(ethUtils.keccak256('polygonMigration'), polygonMigrationTest.address).encodeABI()
      )

      pol = await artifacts.POLTokenMock.new('Polygon Ecosystem Token', 'POL')

      await governance.update(
        registry.address,
        registry.contract.methods.updateContractMap(ethUtils.keccak256('pol'), pol.address).encodeABI()
      )

      await polygonMigrationTest.contract.methods.setTokenAddresses(e20.rootERC20.address, pol.address).send({
        from: accounts[0]
      })

      // mint POL to PolygonMigrationTest
      await pol.contract.methods.mint(polygonMigrationTest.address, amount.toString()).send(
        { from: accounts[0] }
      )
    })

    it('converts MATIC to POL using governance function', async() => {
      // mint MATIC to depositManager
      await e20.rootERC20.contract.methods.mint(depositManager.address, amount.toString()).send(
        { from: accounts[0] }
      )

      // call migrateMatic using governance
      await governance.update(
        depositManager.address,
        depositManager.contract.methods.migrateMatic(amount.toString()).encodeABI()
      )

      // check that MATIC balance has been converted to POL
      const currentBalance = await pol.contract.methods.balanceOf(depositManager.address).call()
      utils.assertBigNumberEquality(currentBalance, amount)
    })

    it('migrates to POL when depositing MATIC', async() => {
      // deposit some MATIC
      const bob = '0x' + crypto.randomBytes(20).toString('hex')
      await utils.deposit(
        depositManager,
        childContracts.childChain,
        e20.rootERC20,
        bob,
        amount,
        { rootDeposit: true, erc20: true }
      )

      // check that MATIC balance has been converted to POL
      const currentBalance = await pol.contract.methods.balanceOf(depositManager.address).call()
      utils.assertBigNumberEquality(currentBalance, amount)

      // assert deposit on child chain
      utils.assertBigNumberEquality(await e20.childToken.balanceOf(bob), amount)
    })

    it('bridges MATIC when depositing POL', async() => {
      const bob = '0x' + crypto.randomBytes(20).toString('hex')

      // using the utils function more granularly here so we can call fireDepositFromMainToMatic with the correct token address
      const newDepositBlockEvent = await utils.depositOnRoot(
        depositManager,
        pol,
        bob,
        amount,
        { rootDeposit: true, erc20: true }
      )

      // token has been changed to MATIC
      assert.strictEqual(newDepositBlockEvent.args.token, e20.rootERC20.address)

      await utils.fireDepositFromMainToMatic(childContracts.childChain, '0xa', bob, e20.rootERC20.address, amount, newDepositBlockEvent.args.depositBlockId)

      // deposit on child chain is technically still in MATIC
      utils.assertBigNumberEquality(await e20.childToken.balanceOf(bob), amount)
    })

    it('returns POL when withdrawing MATIC', async() => {
      // no POL on this account
      utils.assertBigNumberEquality(await pol.balanceOf(accounts[1]), 0)

      // deposit some MATIC
      await utils.deposit(
        depositManager,
        childContracts.childChain,
        e20.rootERC20,
        accounts[1],
        amount,
        { rootDeposit: true, erc20: true }
      )

      // withdraw again
      const { receipt } = await e20.childToken.withdraw(amount, { from: accounts[1], value: amount })

      // submit checkpoint
      let { block, blockProof, headerNumber, reference } = await statefulUtils.submitCheckpoint(contracts.rootChain, receipt, accounts)

      // call ERC20Predicate
      await utils.startExitWithBurntTokens(
        contracts.ERC20Predicate,
        { headerNumber, blockProof, blockNumber: block.number, blockTimestamp: block.timestamp, reference, logIndex: 1 },
        accounts[1]
      )

      // process Exits for MATIC
      await predicateTestUtils.processExits(contracts.withdrawManager, e20.rootERC20.address)

      // POL was received
      utils.assertBigNumberEquality(await pol.balanceOf(accounts[1]), amount)
    })
  })
})
