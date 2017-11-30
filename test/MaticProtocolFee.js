import assertRevert from './helpers/assertRevert.js'

let MaticProtocol = artifacts.require('./MaticProtocol.sol')
let MaticChannel = artifacts.require('./MaticChannel.sol')

contract('MaticProtocolFee', function(accounts) {
  describe('initialization', async function() {
    let maticProtocol

    beforeEach(async function() {
      maticProtocol = await MaticProtocol.new({from: accounts[0]})
    })

    it('should create contract with proper owner and should allow to update', async function() {
      let owner = await maticProtocol.owner()
      assert.equal(owner, accounts[0])

      // change transfer ownership
      let receipt = await maticProtocol.transferOwnership(accounts[1])
      assert.equal(receipt.logs.length, 1)
      assert.equal(receipt.logs[0].event, 'OwnershipTransferred')
      assert.equal(receipt.logs[0].args.newOwner, accounts[1])
      assert.equal(receipt.logs[0].args.previousOwner, accounts[0])

      owner = await maticProtocol.owner()
      assert.equal(owner, accounts[1])
    })

    it('should create contract with proper fee and should allow to update', async function() {
      let fee = await maticProtocol.fee()
      assert.equal(fee, 0)

      let newFee = web3.toWei(1, 'ether')
      let feeReceipt = await maticProtocol.updateFee(newFee)
      assert.equal(feeReceipt.logs.length, 1)
      assert.equal(feeReceipt.logs[0].event, 'FeeChanged')
      assert.equal(feeReceipt.logs[0].args.newFee.toString(), newFee.toString())

      fee = await maticProtocol.fee()
      assert.equal(fee.toString(), newFee.toString())
    })
  })

  describe('create contract', async function() {
    let maticProtocol

    beforeEach(async function() {
      maticProtocol = await MaticProtocol.new({from: accounts[0]})
    })

    it('should anyone to create MaticChannel contract', async function() {
      let fee = web3.toWei(0, 'ether')
      let receipt = await maticProtocol.createMaticChannel(accounts[0], 5, {
        value: fee
      }) // with zero fee
      assert.equal(receipt.logs.length, 1)
      assert.equal(receipt.logs[0].event, 'MaticChannelCreated')
      assert.equal(receipt.logs[0].args._sender, accounts[0])

      // contract count
      let count = await maticProtocol.getContractCount(accounts[0])
      assert.equal(count.toNumber(), 1)

      // maticChannel address from event
      let maticChannelAddress = receipt.logs[0].args._address
      let maticChannelContract = MaticChannel.at(maticChannelAddress)

      // check owner of maticChannel contract
      const maticChannelOwner = await maticChannelContract.owner()
      assert.equal(maticChannelOwner, accounts[0])
    })

    it('should not allow to create with lesser fees', async function() {
      let fee = await maticProtocol.fee()
      assert.equal(fee, 0)

      let newFee = web3.toWei(1, 'ether')
      let feeReceipt = await maticProtocol.updateFee(newFee)
      assert.equal(feeReceipt.logs.length, 1)
      assert.equal(feeReceipt.logs[0].event, 'FeeChanged')
      assert.equal(feeReceipt.logs[0].args.newFee.toString(), newFee.toString())

      assertRevert(
        maticProtocol.createMaticChannel(accounts[0], 5, {value: fee})
      )
    })

    it('should allow to create with more or same fees', async function() {
      let fee = await maticProtocol.fee()
      assert.equal(fee, 0)

      let newFee = web3.toWei(1, 'ether')
      let feeReceipt = await maticProtocol.updateFee(newFee)
      assert.equal(feeReceipt.logs.length, 1)
      assert.equal(feeReceipt.logs[0].event, 'FeeChanged')
      assert.equal(feeReceipt.logs[0].args.newFee.toString(), newFee.toString())

      let receipt = await maticProtocol.createMaticChannel(accounts[0], 5, {
        value: newFee
      })
      assert.equal(receipt.logs.length, 1)
      assert.equal(receipt.logs[0].event, 'MaticChannelCreated')
      assert.equal(receipt.logs[0].args._sender, accounts[0])

      // contract count
      let count = await maticProtocol.getContractCount(accounts[0])
      assert.equal(count.toNumber(), 1)

      // contract address from event
      let maticChannelAddress = receipt.logs[0].args._address
      let maticChannelContract = MaticChannel.at(maticChannelAddress)

      // check maticProtocol balance
      let shouldBalance = web3.toWei(1, 'ether')
      let maticProtocolBalance = web3.eth.getBalance(maticProtocol.address)
      assert.equal(shouldBalance.toString(), maticProtocolBalance.toString())
    })
  })

  describe('withdraw', async function() {
    let maticProtocol

    beforeEach(async function() {
      maticProtocol = await MaticProtocol.new({from: accounts[0]})
      await maticProtocol.updateFee(web3.toWei(1, 'ether'))
    })

    it('should allow owner to withdraw fund', async function() {
      assertRevert(maticProtocol.createMaticChannel(accounts[0], 5))

      // get account balance
      let accountBalance = web3.eth.getBalance(accounts[0])

      let testData = [
        {from: accounts[1], period: 5, value: web3.toWei(1, 'ether')},
        {from: accounts[2], period: 15, value: web3.toWei(2, 'ether')},
        {from: accounts[3], period: 25, value: web3.toWei(3, 'ether')},
        {from: accounts[4], period: 35, value: web3.toWei(4, 'ether')}
      ]
      for (let i = 0; i < testData.length; i++) {
        // create contract with fee 1 ETH
        let createReceipt = await maticProtocol.createMaticChannel(
          testData[i].from,
          testData[i].period,
          testData[i]
        )
        assert.equal(createReceipt.logs.length, 1)
        assert.equal(createReceipt.logs[0].event, 'MaticChannelCreated')

        let shouldBalance = testData[i].value
        let maticProtocolBalance = web3.eth.getBalance(maticProtocol.address)
        assert.equal(shouldBalance.toString(), maticProtocolBalance.toString())

        // withdraw receipt
        let withdrawReceipt = await maticProtocol.withdrawFee({
          from: accounts[0]
        })
        assert.equal(withdrawReceipt.logs.length, 1)
        assert.equal(withdrawReceipt.logs[0].event, 'FeeWithdraw')
        assert.equal(
          withdrawReceipt.logs[0].args.amount.toString(),
          testData[i].value.toString()
        )

        shouldBalance = web3.toWei(0, 'ether')
        maticProtocolBalance = web3.eth.getBalance(maticProtocol.address)
        assert.equal(shouldBalance.toString(), maticProtocolBalance.toString())
      }

      // check account[0] balance
      let newAccountBalance = web3.eth.getBalance(accounts[0])
      assert.equal(
        newAccountBalance.minus(accountBalance).gt(web3.toWei(9, 'ether')),
        true
      )
    })

    it('should not allow other to withdraw fund', async function() {
      assertRevert(maticProtocol.createMaticChannel(accounts[0], 5))

      let createReceipt = await maticProtocol.createMaticChannel(
        accounts[0],
        5,
        {
          value: web3.toWei(1, 'ether')
        }
      )
      assert.equal(createReceipt.logs.length, 1)
      assert.equal(createReceipt.logs[0].event, 'MaticChannelCreated')

      // withdraw should not be allowed
      assertRevert(maticProtocol.withdrawFee({from: accounts[1]}))
      assertRevert(maticProtocol.withdrawFee({from: accounts[2]}))
      assertRevert(maticProtocol.withdrawFee({from: accounts[6]}))

      // check maticProtocol balance
      let shouldBalance = web3.toWei(1, 'ether')
      let maticProtocolBalance = web3.eth.getBalance(maticProtocol.address)
      assert.equal(shouldBalance.toString(), maticProtocolBalance.toString())
    })
  })
})
