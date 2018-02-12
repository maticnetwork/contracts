import sigUtil from 'eth-sig-util'

import assertThrows from './helpers/assertThrows'
import assertRevert from './helpers/assertRevert'
import {mineToBlockHeight} from './helpers/utils'

const MaticChannel = artifacts.require('./MaticChannel.sol')
const MaticProtocol = artifacts.require('./MaticProtocol.sol')
const TestToken = artifacts.require('./TestToken.sol')

const BigNumber = web3.BigNumber

const getBalanceMessage = (
  contract,
  receiver,
  token,
  matic,
  orderId,
  balance
) => {
  return [
    {
      type: 'address',
      name: 'contract',
      value: contract
    },
    {
      type: 'address',
      name: 'receiver',
      value: receiver
    },
    {
      type: 'address',
      name: 'token',
      value: token
    },
    {
      type: 'address',
      name: 'matic',
      value: matic
    },
    {
      type: 'bytes32',
      name: 'orderId',
      value: orderId
    },
    {
      type: 'uint256',
      name: 'balance',
      value: balance
    }
  ]
}

// Matic channel
contract('Matic Channel', function(accounts) {
  describe('initialization', async function() {
    let maticProtocolContract = null
    let maticChannelContract = null

    // before task
    before(async function() {
      maticProtocolContract = await MaticProtocol.new({from: accounts[9]})
    })

    it('should create channel contract', async function() {
      const maticAddress = maticProtocolContract.address
      const owner = accounts[0]
      const contractReceipt = await maticProtocolContract.createMaticChannel(
        owner,
        5
      )

      assert.equal(contractReceipt.logs.length, 1)
      assert.equal(contractReceipt.logs[0].event, 'MaticChannelCreated')
      assert.equal(contractReceipt.logs[0].args._sender, accounts[0])

      const channelAddress = contractReceipt.logs[0].args._address
      maticChannelContract = MaticChannel.at(channelAddress)
      assert.equal(await maticChannelContract.owner(), owner)
      assert.equal(await maticChannelContract.matic(), accounts[9])
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
      maticProtocolContract = await MaticProtocol.new({from: accounts[9]})
      const owner = accounts[0]
      const contractReceipt = await maticProtocolContract.createMaticChannel(
        owner,
        5
      )
      const channelAddress = contractReceipt.logs[0].args._address
      maticChannelContract = MaticChannel.at(channelAddress)

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
      assert.equal(depositReceipt.logs[0].args.balance, value.toString())

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
      assert.equal(depositReceipt.logs[0].args.balance, value.toString())

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
      maticProtocolContract = await MaticProtocol.new({from: accounts[9]})
      const owner = accounts[0]
      const contractReceipt = await maticProtocolContract.createMaticChannel(
        owner,
        5
      )
      const channelAddress = contractReceipt.logs[0].args._address
      maticChannelContract = MaticChannel.at(channelAddress)

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
        settlementReceipt.logs[0].args.balance.toString(),
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
        settlementReceipt.logs[0].args.balance.toString(),
        token1Amount.toString()
      )

      // check token balance of contract
      b1 = await token1.balanceOf(maticChannelContract.address)
      assert.equal(b1.toString(), String(0))
    })
  })

  describe('withdraw', async function() {
    let maticProtocolContract = null
    let maticChannelContract = null
    let token1 = null
    let token2 = null
    let token1Amount = web3.toWei(100)

    // Sender and private key
    const sender = '0x9fb29aac15b9a4b7f17c3385939b007540f4d791'
    const senderPrivateKey = Buffer.from(
      '9b28f36fbd67381120752d6172ecdcf10e06ab2d9a1367aac00cdcd6ac7855d3',
      'hex'
    )

    // Matic owner and private key
    const maticOwner = '0x96c42c56fdb78294f96b0cfa33c92bed7d75f96a'
    const maticOwnerPrivateKey = Buffer.from(
      'c8deb0bea5c41afe8e37b4d1bd84e31adff11b09c8c96ff4b605003cce067cd9',
      'hex'
    )

    // before task
    before(async function() {
      // fill ethers
      await web3.eth.sendTransaction({
        from: accounts[9],
        to: sender,
        value: web3.toWei(20)
      })

      await web3.eth.sendTransaction({
        from: accounts[9],
        to: maticOwner,
        value: web3.toWei(20)
      })

      maticProtocolContract = await MaticProtocol.new({from: maticOwner})
      const owner = accounts[0]
      const contractReceipt = await maticProtocolContract.createMaticChannel(
        owner,
        5
      )
      const channelAddress = contractReceipt.logs[0].args._address
      maticChannelContract = MaticChannel.at(channelAddress)

      // token creation
      token1 = await TestToken.new({from: sender})
      token2 = await TestToken.new({from: sender})

      // token allowance to matic contract
      const channelContract = maticChannelContract.address
      token1.approve(channelContract, web3.toWei(1000), {from: sender}) // 1k tokens
      token2.approve(channelContract, web3.toWei(1000), {from: sender}) // 1k tokens

      // token1 deposit
      const depositAmount = web3.toWei(100)
      await maticChannelContract.deposit(
        token1.address,
        depositAmount, // 100 tokens
        {from: sender}
      )

      // token2 deposit
      await maticChannelContract.deposit(
        token2.address,
        depositAmount, // 100 tokens
        {from: sender}
      )
    })

    it('should allow receivers to withdraw tokens', async function() {
      let receiver = accounts[4]

      // check order id and index
      let orderId = await maticChannelContract.generateOrderId(receiver)
      let orderIndex = await maticChannelContract.orderIndexes(receiver)
      assert.equal(orderIndex.toString(), String(0))

      let balance = web3.toWei(10)

      // sender's signature
      let balanceMessage = sigUtil.signTypedData(senderPrivateKey, {
        data: getBalanceMessage(
          maticChannelContract.address,
          receiver,
          token1.address,
          maticOwner,
          orderId,
          balance
        )
      })

      // matic's signature
      let verifierMessage = sigUtil.signTypedData(maticOwnerPrivateKey, {
        data: getBalanceMessage(
          maticChannelContract.address,
          receiver,
          token1.address,
          maticOwner,
          orderId,
          balance
        )
      })

      // verify
      let recoveredAddress = await maticChannelContract.verifyBalanceProof(
        receiver,
        token1.address,
        orderId,
        balance,
        balanceMessage
      )

      let recoveredMaticAddress = await maticChannelContract.verifyBalanceProof(
        receiver,
        token1.address,
        orderId,
        balance,
        verifierMessage
      )

      // check recoveredAddress vs sender
      assert.equal(recoveredAddress, sender)
      assert.equal(recoveredMaticAddress, maticOwner)

      // withdraw tokens
      assert.equal(await token1.balanceOf(receiver), String(0))
      let withdrawReceipt = await maticChannelContract.withdraw(
        receiver,
        token1.address,
        balance,
        balanceMessage,
        verifierMessage
      )
      assert.equal(withdrawReceipt.logs.length, 1)
      assert.equal(withdrawReceipt.logs[0].event, 'Withdraw')
      assert.equal(withdrawReceipt.logs[0].args.receiver, receiver)
      assert.equal(withdrawReceipt.logs[0].args.token, token1.address)
      assert.equal(withdrawReceipt.logs[0].args.orderId, orderId)
      assert.equal(withdrawReceipt.logs[0].args.balance, balance.toString())

      // check balance
      let receiverBalance = await token1.balanceOf(receiver)
      assert.equal(receiverBalance, balance.toString())

      orderId = await maticChannelContract.generateOrderId(receiver)
      orderIndex = await maticChannelContract.orderIndexes(receiver)
      assert.equal(orderIndex.toString(), String(1))
    })
  })
})
