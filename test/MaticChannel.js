import assertThrows from './helpers/assertThrows'
import assertRevert from './helpers/assertRevert'
import {mineToBlockHeight} from './helpers/utils'

const MaticChannel = artifacts.require('./MaticChannel.sol')
const MaticProtocol = artifacts.require('./MaticProtocol.sol')
const TestToken = artifacts.require('./TestToken.sol')

const BigNumber = web3.BigNumber

// Matic channel
contract('Matic Channel', function(accounts) {
  describe('initialization', async function() {
    let maticProtocolContract = null
    let maticChannelContract = null

    // before task
    before(async function() {
      maticProtocolContract = await MaticProtocol.new()
    })

    it('should create channel contract', async function() {
      const maticAddress = maticProtocolContract.address
      const owner = accounts[0]
      maticChannelContract = await MaticChannel.new(owner, maticAddress, 5)

      assert.equal(await maticChannelContract.owner(), owner)
      assert.equal(await maticChannelContract.matic(), maticAddress)
      assert.equal(await maticChannelContract.challengePeriod(), 5)
    })
  })

  describe('deposit', async function() {
    let maticProtocolContract = null
    let maticChannelContract = null
    let token1 = null
    let token2 = null

    // before task
    before(async function() {
      maticProtocolContract = await MaticProtocol.new()
      const maticAddress = maticProtocolContract.address
      const owner = accounts[0]
      maticChannelContract = await MaticChannel.new(owner, maticAddress, 5)

      // token creation
      token1 = await TestToken.new()
      token2 = await TestToken.new({from: accounts[1]})

      // token allowance to matic contract
      const channelContract = maticChannelContract.address
      token1.approve(channelContract, web3.toWei(1000)) // 1k tokens
      token2.approve(channelContract, web3.toWei(1000), {from: accounts[1]}) // 1k tokens
    })

    it('should allow to deposit tokens', async function() {
      const value = web3.toWei(100)
      const depositReceipt = await maticChannelContract.deposit(
        token1.address,
        value // 100 tokens
      )

      assert.equal(depositReceipt.logs.length, 1)
      assert.equal(depositReceipt.logs[0].event, 'Deposit')
      assert.equal(depositReceipt.logs[0].args.sender, accounts[0])
      assert.equal(depositReceipt.logs[0].args.token, token1.address)
      assert.equal(depositReceipt.logs[0].args.amount, value.toString())

      // check token balance of contract
      let b1 = await token1.balanceOf(maticChannelContract.address)
      assert.equal(b1, value.toString())
    })

    it('should not allow to deposit invalid tokens', async function() {
      const value = web3.toWei(100)
      assertRevert(
        maticChannelContract.deposit(
          '0x0',
          value // 100 tokens
        )
      )

      // check token balance of contract
      let b1 = await token1.balanceOf(maticChannelContract.address)
      assert.equal(b1, value.toString())
    })

    it('should not allow to deposit without existing token', async function() {
      const value = web3.toWei(100)
      assertRevert(
        maticChannelContract.deposit(
          accounts[1],
          value // 100 tokens
        )
      )

      // check token balance of contract
      let b1 = await token1.balanceOf(maticChannelContract.address)
      assert.equal(b1, value.toString())
    })

    it('should allow anyone to deposit multiple token', async function() {
      const value = web3.toWei(100)
      const depositReceipt = await maticChannelContract.deposit(
        token2.address,
        value, // 100 tokens
        {from: accounts[1]}
      )

      assert.equal(depositReceipt.logs.length, 1)
      assert.equal(depositReceipt.logs[0].event, 'Deposit')
      assert.equal(depositReceipt.logs[0].args.sender, accounts[1])
      assert.equal(depositReceipt.logs[0].args.token, token2.address)
      assert.equal(depositReceipt.logs[0].args.amount, value.toString())

      // check token balance of contract
      let b1 = await token1.balanceOf(maticChannelContract.address)
      assert.equal(b1, value.toString())

      let b2 = await token2.balanceOf(maticChannelContract.address)
      assert.equal(b2, value.toString())
    })
  })

  describe('settle', async function() {
    let maticProtocolContract = null
    let maticChannelContract = null
    let token1 = null
    let token2 = null
    let token1Amount = web3.toWei(100)

    // before task
    before(async function() {
      maticProtocolContract = await MaticProtocol.new()
      const maticAddress = maticProtocolContract.address
      const owner = accounts[0]
      maticChannelContract = await MaticChannel.new(owner, maticAddress, 5)

      // token creation
      token1 = await TestToken.new()
      token2 = await TestToken.new({from: accounts[1]})

      // token allowance to matic contract
      const channelContract = maticChannelContract.address
      token1.approve(channelContract, web3.toWei(1000)) // 1k tokens
      token2.approve(channelContract, web3.toWei(1000), {from: accounts[1]}) // 1k tokens

      // token1 deposit
      const depositAmount = web3.toWei(100)
      await maticChannelContract.deposit(
        token1.address,
        depositAmount // 100 tokens
      )

      // token2 deposit
      await maticChannelContract.deposit(
        token2.address,
        depositAmount, // 100 tokens
        {from: accounts[1]}
      )
    })

    it('should allow owner to start settlement window', async function() {
      const period = await maticChannelContract.challengePeriod()

      // no-one other than owner can request settlement
      assertRevert(
        maticChannelContract.requestSettlement(token1.address, token1Amount, {
          from: accounts[1]
        })
      )

      // not more than deposit allowed
      assertRevert(
        maticChannelContract.requestSettlement(token1.address, web3.toWei(101))
      )

      // cannot settle before requesting settlement window
      assertRevert(maticChannelContract.settle(token1.address))

      // check settlement vars
      const [
        settleBlockBefore,
        depositBefore,
        closingBalanceBefore
      ] = await maticChannelContract.getTokenManager(token1.address)

      assert.equal(settleBlockBefore.toString(), String(0))
      assert.equal(depositBefore, token1Amount.toString())
      assert.equal(closingBalanceBefore, String(0))

      // request settlement
      const settlementReceipt = await maticChannelContract.requestSettlement(
        token1.address,
        token1Amount
      )

      assert.equal(settlementReceipt.logs.length, 1)
      assert.equal(settlementReceipt.logs[0].event, 'SettlementRequested')
      assert.equal(settlementReceipt.logs[0].args.owner, accounts[0])
      assert.equal(settlementReceipt.logs[0].args.token, token1.address)
      assert.equal(
        settlementReceipt.logs[0].args.amount.toString(),
        token1Amount.toString()
      )
      assert.equal(
        settlementReceipt.logs[0].args.settleBlock.toString(),
        period.plus(settlementReceipt.receipt.blockNumber).toString()
      )

      // should throw if owner has already requested settlement
      assertRevert(
        maticChannelContract.requestSettlement(token1.address, web3.toWei(100))
      )

      // check settlement vars
      const [
        settleBlockAfter,
        depositAfter,
        closingBalanceAfter
      ] = await maticChannelContract.getTokenManager(token1.address)

      assert.equal(
        settleBlockAfter.toString(),
        period.plus(settlementReceipt.receipt.blockNumber).toString()
      )
      assert.equal(depositAfter, token1Amount.toString())
      assert.equal(closingBalanceAfter, token1Amount.toString())
    })

    it('should allow owner to settle after time window', async function() {
      // cannot settle before time period (settle block)
      assertRevert(maticChannelContract.settle(token1.address))

      // check token balance of contract
      let b1 = await token1.balanceOf(maticChannelContract.address)
      assert.equal(b1.toString(), token1Amount.toString())

      // check settlement vars
      const [
        settleBlockBefore,
        depositBefore,
        closingBalanceBefore
      ] = await maticChannelContract.getTokenManager(token1.address)

      // mine till settlement block
      await mineToBlockHeight(settleBlockBefore.toNumber())

      // settle now
      const settlementReceipt = await maticChannelContract.settle(
        token1.address
      )
      assert.equal(settlementReceipt.logs.length, 1)
      assert.equal(settlementReceipt.logs[0].event, 'Settle')
      assert.equal(settlementReceipt.logs[0].args.owner, accounts[0])
      assert.equal(settlementReceipt.logs[0].args.token, token1.address)
      assert.equal(
        settlementReceipt.logs[0].args.amount.toString(),
        token1Amount.toString()
      )

      // check token balance of contract
      b1 = await token1.balanceOf(maticChannelContract.address)
      assert.equal(b1.toString(), String(0))
    })
  })
})
