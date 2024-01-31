import * as utils from '../../helpers/utils.js'
import deployer from '../../helpers/deployer.js'
import chaiAsPromised from 'chai-as-promised'
import * as chai from 'chai'
import StatefulUtils from '../../helpers/StatefulUtils.js'

import * as predicateTestUtils from './predicates/predicateTestUtils.js'
import ethUtils from 'ethereumjs-util'
import crypto from 'crypto'
import hardhat from 'hardhat'
const ethers = hardhat.ethers

chai.use(chaiAsPromised).should()
const assert = chai.assert

describe('DepositManagerUpdate @skip-on-coverage', async function () {
  let accounts,
    depositManager,
    childContracts,
    registry,
    governance,
    matic,
    polygonMigrationTest,
    pol,
    statefulUtils,
    contracts
  const amount = web3.utils.toBN('10').pow(web3.utils.toBN('18'))

  describe('test POL and MATIC behaviours', async function () {
    before(async () => {
      accounts = await ethers.getSigners()
      accounts = accounts.map((account) => {
        return account.address
      })

      statefulUtils = new StatefulUtils()
    })

    beforeEach(async function () {
      contracts = await deployer.freshDeploy(accounts[0])
      contracts.ERC20Predicate = await deployer.deployErc20PredicateBurnOnly()
      depositManager = contracts.depositManager
      registry = contracts.registry
      governance = contracts.governance
      childContracts = await deployer.initializeChildChain()

      matic = await deployer.deployMaticToken()
      await governance.update(
        registry.address,
        registry.interface.encodeFunctionData('updateContractMap', [
          ethUtils.keccak256('matic'),
          matic.rootERC20.address
        ])
      )

      // deploy PolygonMigration test impl
      polygonMigrationTest = await (await ethers.deployContract('PolygonMigrationTest')).deployed()

      await governance.update(
        registry.address,
        registry.interface.encodeFunctionData('updateContractMap', [
          ethUtils.keccak256('polygonMigration'),
          polygonMigrationTest.address
        ])
      )

      pol = await (await ethers.deployContract('TestToken', ['Polygon Ecosystem Token', 'POL'])).deployed()

      await governance.update(
        registry.address,
        registry.interface.encodeFunctionData('updateContractMap', [ethUtils.keccak256('pol'), pol.address])
      )

      await polygonMigrationTest.setTokenAddresses(matic.rootERC20.address, pol.address)

      deployer.mapToken(pol.address, matic.childToken.address)

      // mint POL to PolygonMigrationTest
      await pol.mint(polygonMigrationTest.address, amount.toString())
    })

    it('converts MATIC to POL using governance function', async () => {
      // mint MATIC to depositManager
      await matic.rootERC20.mint(depositManager.address, amount.toString())

      // call migrateMatic using governance
      await governance.update(
        depositManager.address,
        depositManager.interface.encodeFunctionData('migrateMatic', [amount.toString()])
      )

      // check that MATIC balance has been converted to POL
      const currentBalance = await pol.balanceOf(depositManager.address)
      utils.assertBigNumberEquality(currentBalance, amount)
    })

    it('migrates to POL when depositing MATIC', async () => {
      // deposit some MATIC
      const bob = '0x' + crypto.randomBytes(20).toString('hex')
      await utils.deposit(depositManager, childContracts.childChain, matic.rootERC20, bob, amount, {
        rootDeposit: true,
        erc20: true
      })

      // check that MATIC balance has been converted to POL
      const currentBalance = await pol.balanceOf(depositManager.address)
      utils.assertBigNumberEquality(currentBalance, amount)

      // assert deposit on child chain
      const childChainMaticBalance = await matic.childToken.balanceOf(bob)
      utils.assertBigNumberEquality(childChainMaticBalance, amount)
    })

    it('bridges MATIC when depositing POL', async () => {
      const bob = '0x' + crypto.randomBytes(20).toString('hex')

      // using the utils function more granularly here so we can call fireDepositFromMainToMatic with the correct token address
      const newDepositBlockEvent = await utils.depositOnRoot(depositManager, pol, bob, amount.toString(), {
        rootDeposit: true,
        erc20: true
      })

      assert.strictEqual(newDepositBlockEvent.args.token, matic.rootERC20.address)

      await (
        await utils.fireDepositFromMainToMatic(
          childContracts.childChain,
          '0xa',
          bob,
          matic.rootERC20.address,
          amount,
          newDepositBlockEvent.args.depositBlockId
        )
      ).wait()

      // deposit on child chain is technically still in MATIC
      utils.assertBigNumberEquality(await matic.childToken.balanceOf(bob), amount)
    })

    it('returns POL when withdrawing MATIC', async () => {
      // in order to send from a different address we connect the ContractFactory to a new Signer
      const childSigner1 = matic.childToken.provider.getSigner(1)
      const childToken1 = matic.childToken.connect(childSigner1)
      const account1 = await childSigner1.getAddress()

      // deposit some MATIC
      await utils.deposit(depositManager, childContracts.childChain, matic.rootERC20, account1, amount, {
        rootDeposit: true,
        erc20: true
      })

      // withdraw again
      const receipt = await (await childToken1.withdraw(amount.toString(), { value: amount.toString() })).wait()

      // submit checkpoint
      let { block, blockProof, headerNumber, reference } = await statefulUtils.submitCheckpoint(
        contracts.rootChain,
        receipt,
        accounts
      )

      const rootSigner1 = contracts.ERC20Predicate.provider.getSigner(1)
      const eRC20Predicate1 = contracts.ERC20Predicate.connect(rootSigner1)

      // call ERC20Predicate
      await utils.startExitWithBurntTokens(eRC20Predicate1, {
        headerNumber,
        blockProof,
        blockNumber: block.number,
        blockTimestamp: block.timestamp,
        reference,
        logIndex: 1
      })

      // process Exits for MATIC
      await predicateTestUtils.processExits(contracts.withdrawManager, matic.rootERC20.address)

      // POL was received
      utils.assertBigNumberEquality(await pol.balanceOf(account1), amount)
    })
  })
})
