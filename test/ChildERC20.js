import assertRevert from './helpers/assertRevert.js'
import utils from 'ethereumjs-util'

let ECVerify = artifacts.require('./lib/ECVerify.sol')
let RLP = artifacts.require('./lib/RLP.sol')
let PatriciaUtils = artifacts.require('./lib/PatriciaUtils.sol')
let SafeMath = artifacts.require('./lib/SafeMath.sol')

let ChildChain = artifacts.require('./child/ChildChain.sol')
let ChildToken = artifacts.require('./child/ChildERC20.sol')
let RootToken = artifacts.require('./TestToken.sol')

const BN = utils.BN
const zeroAddress = '0x0000000000000000000000000000000000000000'

contract('ChildERC20', async function(accounts) {
  async function linkLibs() {
    const libContracts = {
      ECVerify: await ECVerify.new(),
      RLP: await RLP.new(),
      PatriciaUtils: await PatriciaUtils.new(),
      SafeMath: await SafeMath.new()
    }

    Object.keys(libContracts).forEach(key => {
      ChildChain.link(key, libContracts[key].address)
    })
  }

  describe('Initialization', async function() {
    it('should initialize properly ', async function() {
      const rootToken = await RootToken.new('Test Token', 'TEST')
      const childToken = await ChildToken.new(rootToken.address)
      assert.equal(await childToken.owner(), accounts[0])
      assert.equal(await childToken.token(), rootToken.address)
    })
  })

  describe('Admin: update', async function() {
    let rootToken
    let rootToken2
    let childToken

    before(async function() {
      rootToken = await RootToken.new('Test Token', 'TEST')
      rootToken2 = await RootToken.new('Test Token', 'TEST')
      childToken = await ChildToken.new(rootToken.address)
    })

    it('should allow only owner to update token ', async function() {
      await assertRevert(
        childToken.updateToken(rootToken2.address, {
          from: accounts[1]
        })
      )
      assert.equal(await childToken.token(), rootToken.address)
    })

    it('should allow owner to update token ', async function() {
      await childToken.updateToken(rootToken2.address, {
        from: accounts[0]
      })
      assert.equal(await childToken.token(), rootToken2.address)
    })
  })

  describe('Transaction: deposit', async function() {
    let rootToken
    let childToken
    let amount

    before(async function() {
      rootToken = await RootToken.new('Test Token', 'TEST')
      childToken = await ChildToken.new(rootToken.address)
      amount = web3.toWei(10)
    })

    it('should allow to deposit', async function() {
      const receipt = await childToken.deposit(amount)
      assert.equal(receipt.logs.length, 1)
      assert.equal(receipt.logs[0].event, 'Deposit')
      assert.equal(receipt.logs[0].args.token, rootToken.address)
      assert.equal(receipt.logs[0].args.user, accounts[0])
      assert.equal(receipt.logs[0].args.amount.toString(), amount)

      // check balance
      assert.equal((await childToken.balanceOf(accounts[0])).toString(), amount)
    })
  })

  describe('Transaction: withdraw', async function() {
    let rootToken
    let childToken
    let amount

    before(async function() {
      rootToken = await RootToken.new('Test Token', 'TEST')
      childToken = await ChildToken.new(rootToken.address)
      amount = web3.toWei(10)
      await childToken.deposit(amount)
    })

    it('should not allow to withdraw more than amount', async function() {
      assertRevert(
        childToken.withdraw(new BN(amount).add(new BN(1)).toString())
      )
    })

    it('should allow to withdraw mentioned amount', async function() {
      const receipt = await childToken.withdraw(amount)
      assert.equal(receipt.logs.length, 1)
      assert.equal(receipt.logs[0].event, 'Withdraw')
      assert.equal(receipt.logs[0].args.token, rootToken.address)
      assert.equal(receipt.logs[0].args.user, accounts[0])
      assert.equal(receipt.logs[0].args.amount.toString(), amount)

      // check balance
      assert.equal((await childToken.balanceOf(accounts[0])).toString(), '0')
    })
  })
})
