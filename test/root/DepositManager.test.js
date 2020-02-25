import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../helpers/deployer.js'
import logDecoder from '../helpers/log-decoder.js'
import * as utils from '../helpers/utils'

const crypto = require('crypto')

chai
  .use(chaiAsPromised)
  .should()

contract('DepositManager', async function(accounts) {
  let depositManager, childContracts
  const amount = web3.utils.toBN('10').pow(web3.utils.toBN('18'))

  describe('deposits only on root', async function() {
    before(async function() {
      await deployer.freshDeploy()
    })

    beforeEach(async function() {
      await deployer.deployRootChain()
      depositManager = await deployer.deployDepositManager()
    })

    it('depositEther', async function() {
      const maticWeth = await deployer.deployMaticWeth()
      const value = web3.utils.toWei('1', 'ether')
      const result = await depositManager.depositEther({
        value,
        from: accounts[0]
      })
      console.log('gasUsed', result.receipt.gasUsed)
      const logs = logDecoder.decodeLogs(result.receipt.rawLogs)

      // Transfer, Deposit, StateSynced, NewDepositBlock
      logs.should.have.lengthOf(4)
      const depositLog = logs[3]
      depositLog.event.should.equal('NewDepositBlock')
      validateDepositBlock(depositLog.args, accounts[0], maticWeth.address, value)
      expect(depositLog.args.depositBlockId.toString()).to.equal('1')

      const depositHash = (await depositManager.deposits(1)).depositHash
      validateDepositHash(depositHash, accounts[0], maticWeth.address, value)
    })

    it('depositERC20', async function() {
      const testToken = await deployer.deployTestErc20()
      await testToken.approve(depositManager.address, amount)
      const result = await depositManager.depositERC20(testToken.address, amount)
      console.log('gasUsed', result.receipt.gasUsed)
      const logs = logDecoder.decodeLogs(result.receipt.rawLogs)

      // Transfer, Approval (ERC20 updates the spender allowance), StateSynced, NewDepositBlock
      logs.should.have.lengthOf(4)
      const depositLog = logs[3]
      depositLog.event.should.equal('NewDepositBlock')
      validateDepositBlock(depositLog.args, accounts[0], testToken.address, amount)
      expect(depositLog.args.depositBlockId.toString()).to.equal('1')

      const depositHash = (await depositManager.deposits(1)).depositHash
      validateDepositHash(depositHash, accounts[0], testToken.address, amount)
    })

    it('depositERC20ForUser', async function() {
      const testToken = await deployer.deployTestErc20()
      const user = accounts[1]
      await testToken.approve(depositManager.address, amount)
      const result = await depositManager.depositERC20ForUser(testToken.address, user, amount)
      console.log('gasUsed', result.receipt.gasUsed)
      const logs = logDecoder.decodeLogs(result.receipt.rawLogs)

      // Transfer, Approval (ERC20 updates the spender allowance), StateSynced, NewDepositBlock
      logs.should.have.lengthOf(4)
      const depositLog = logs[3]
      depositLog.event.should.equal('NewDepositBlock')
      validateDepositBlock(depositLog.args, user, testToken.address, amount)
      expect(depositLog.args.depositBlockId.toString()).to.equal('1')

      const depositHash = (await depositManager.deposits(1)).depositHash
      validateDepositHash(depositHash, user, testToken.address, amount)
    })

    it('depositERC721', async function() {
      const testToken = await deployer.deployTestErc721()
      let tokenId = '1212'
      await testToken.mint(tokenId)
      await testToken.approve(depositManager.address, tokenId)
      const result = await depositManager.depositERC721(testToken.address, tokenId)
      console.log('gasUsed', result.receipt.gasUsed)
      const logs = logDecoder.decodeLogs(result.receipt.rawLogs)

      // Transfer, StateSynced, NewDepositBlock
      logs.should.have.lengthOf(3)
      const _depositBlock = logs[2]
      _depositBlock.event.should.equal('NewDepositBlock')
      validateDepositBlock(_depositBlock.args, accounts[0], testToken.address, tokenId)
      expect(_depositBlock.args.depositBlockId.toString()).to.equal('1')

      const depositHash = (await depositManager.deposits(1)).depositHash
      validateDepositHash(depositHash, accounts[0], testToken.address, tokenId)
    })

    it('depositERC721ForUser', async function() {
      const testToken = await deployer.deployTestErc721()
      const user = accounts[1]
      let tokenId = '1234'
      await testToken.mint(tokenId)
      await testToken.approve(depositManager.address, tokenId)
      const result = await depositManager.depositERC721ForUser(testToken.address, user, tokenId)
      console.log('gasUsed', result.receipt.gasUsed)
      const logs = logDecoder.decodeLogs(result.receipt.rawLogs)

      // Transfer, StateSynced, NewDepositBlock
      logs.should.have.lengthOf(3)
      const _depositBlock = logs[2]
      _depositBlock.event.should.equal('NewDepositBlock')
      validateDepositBlock(_depositBlock.args, user, testToken.address, tokenId)
      expect(_depositBlock.args.depositBlockId.toString()).to.equal('1')

      const depositHash = (await depositManager.deposits(1)).depositHash
      validateDepositHash(depositHash, user, testToken.address, tokenId)
    })

    it('depositBulk', async function() {
      const tokens = []
      const amounts = []
      const NUM_DEPOSITS = 15
      for (let i = 0; i < NUM_DEPOSITS; i++) {
        const testToken = await deployer.deployTestErc20()
        const _amount = amount.add(web3.utils.toBN(i))
        await testToken.approve(depositManager.address, _amount)
        tokens.push(testToken.address)
        amounts.push(_amount)
      }
      for (let i = 0; i < NUM_DEPOSITS; i++) {
        const testToken = await deployer.deployTestErc721()
        const tokenId = web3.utils.toBN(crypto.randomBytes(32).toString('hex'), 16)
        await testToken.mint(tokenId)
        await testToken.approve(depositManager.address, tokenId)
        tokens.push(testToken.address)
        amounts.push(tokenId)
      }
      const user = accounts[1]
      const result = await depositManager.depositBulk(tokens, amounts, user)
      console.log(`gasUsed in ${NUM_DEPOSITS} ERC20 and ERC721 deposits each`, result.receipt.gasUsed)
      const logs = logDecoder.decodeLogs(result.receipt.rawLogs)
      // assert events for erc20 transfers
      for (let i = 0; i < NUM_DEPOSITS; i++) {
        // 3 logs per transfer - Transfer, Approval (ERC20 updates the spender allowance), StateSynced, NewDepositBlock
        const logIndex = i * 4
        logs[logIndex].event.should.equal('Transfer')
        const log = logs[logIndex + 3]
        log.event.should.equal('NewDepositBlock')
        validateDepositBlock(log.args, user, tokens[i], amounts[i])
        expect(log.args.depositBlockId.toString()).to.equal((i + 1).toString())
        const depositHash = (await depositManager.deposits(i + 1)).depositHash
        validateDepositHash(depositHash, user, tokens[i], amounts[i])
      }

      // assert events for erc721 transfers
      for (let j = 0; j < NUM_DEPOSITS; j++) {
        const logIndex = 4 * NUM_DEPOSITS /* add erc20 events */ + j * 3 // 2 logs per transfer - Transfer, StateSynced, NewDepositBlock
        logs[logIndex].event.should.equal('Transfer')
        const log = logs[logIndex + 2]
        const numTransfer = j + NUM_DEPOSITS
        log.event.should.equal('NewDepositBlock')
        validateDepositBlock(log.args, user, tokens[numTransfer], amounts[numTransfer])
        expect(log.args.depositBlockId.toString()).to.equal((numTransfer + 1).toString())
        const depositHash = (await depositManager.deposits(numTransfer + 1)).depositHash
        validateDepositHash(depositHash, user, tokens[numTransfer], amounts[numTransfer])
      }
    })

    it('onERC721Received');
    it('tokenFallback');
  })

  describe('drain assets from DepositManager', async function() {
    before(async function() {
      this.contracts = await deployer.freshDeploy()
    })
    beforeEach(async function() {
      await deployer.deployRootChain()
      depositManager = await deployer.deployDepositManager()
    })
    it('drain ERC20', async function() {
      const testToken = await deployer.deployTestErc20()
      const destination = accounts[0]

      await testToken.transfer(depositManager.address, amount)

      utils.assertBigNumberEquality(await testToken.balanceOf(depositManager.address), amount)

      const tokens = []
      const values = []

      tokens.push(testToken.address)
      values.push(amount.toString())
      const data = depositManager.contract.methods.drainErc20(tokens, values, destination).encodeABI()

      await this.contracts.governance.update(
        depositManager.address,
        data
      )
      utils.assertBigNumberEquality(await testToken.balanceOf(depositManager.address), 0)
    })
    it('drain ERC721', async function() {
      const testToken = await deployer.deployTestErc721()
      const user = accounts[0]
      let tokenId = '1234'
      await testToken.mint(tokenId)
      await testToken.transferFrom(user, depositManager.address, tokenId)

      await testToken.ownerOf(tokenId).should.eventually.equal(depositManager.address)

      const tokens = []
      const values = []

      tokens.push(testToken.address)
      values.push(tokenId)

      const data = depositManager.contract.methods.drainErc721(tokens, values, user).encodeABI()

      await this.contracts.governance.update(
        depositManager.address,
        data
      )
      await testToken.ownerOf(tokenId).should.eventually.equal(user)
    })
    it('drain Ether', async function() {
      await deployer.deployMaticWeth()
      const user = accounts[0]
      const value = web3.utils.toWei('1', 'ether')
      await web3.eth.sendTransaction({
        from: user,
        to: depositManager.address,
        value,
        gas: 200000
      })
      // const data = depositManager.contract.methods.drainEther(value, user).encodeABI()

      // await this.contracts.governance.update(
      //   depositManager.address,
      //   data
      // )
      // utils.assertBigNumberEquality(await web3.eth.getBalance(depositManager.address), 0)
    })
  })

  describe('deposits revert when paused', async function() {
    before(async function() {
      this.contracts = await deployer.freshDeploy()
    })

    beforeEach(async function() {
      await deployer.deployRootChain()
      depositManager = await deployer.deployDepositManager()
    })

    it('depositEther reverts', async function() {
      await deployer.deployMaticWeth()
      await this.contracts.governance.update(
        depositManager.address,
        depositManager.contract.methods.lock().encodeABI()
      )
      const value = web3.utils.toWei('1', 'ether')
      try {
        await depositManager.depositEther({
          value,
          from: accounts[0]
        })
        assert.fail('Transaction should have reverted')
      } catch(e) {
        expect(e.reason).to.equal('Is Locked')
      }
    })

    it('depositERC20 reverts', async function() {
      const testToken = await deployer.deployTestErc20()
      await testToken.approve(depositManager.address, amount)
      await this.contracts.governance.update(
        depositManager.address,
        depositManager.contract.methods.lock().encodeABI()
      )
      try {
        await depositManager.depositERC20(testToken.address, amount)
        assert.fail('Transaction should have reverted')
      } catch(e) {
        expect(e.reason).to.equal('Is Locked')
      }
    })

    it('depositERC721 reverts', async function() {
      const testToken = await deployer.deployTestErc721()
      let tokenId = '1212'
      await testToken.mint(tokenId)
      await testToken.approve(depositManager.address, tokenId)
      await this.contracts.governance.update(
        depositManager.address,
        depositManager.contract.methods.lock().encodeABI()
      )
      try {
        await depositManager.depositERC721(testToken.address, tokenId)
        assert.fail('Transaction should have reverted')
      } catch(e) {
        expect(e.reason).to.equal('Is Locked')
      }
    })

    it('depositBulk reverts', async function() {
      const tokens = []
      const amounts = []
      const NUM_DEPOSITS = 15
      for (let i = 0; i < NUM_DEPOSITS; i++) {
        const testToken = await deployer.deployTestErc20()
        const _amount = amount.add(web3.utils.toBN(i))
        await testToken.approve(depositManager.address, _amount)
        tokens.push(testToken.address)
        amounts.push(_amount)
      }
      for (let i = 0; i < NUM_DEPOSITS; i++) {
        const testToken = await deployer.deployTestErc721()
        const tokenId = web3.utils.toBN(crypto.randomBytes(32).toString('hex'), 16)
        await testToken.mint(tokenId)
        await testToken.approve(depositManager.address, tokenId)
        tokens.push(testToken.address)
        amounts.push(tokenId)
      }
      const user = accounts[1]
      await this.contracts.governance.update(
        depositManager.address,
        depositManager.contract.methods.lock().encodeABI()
      )
      try {
        await depositManager.depositBulk(tokens, amounts, user)
        assert.fail('Transaction should have reverted')
      } catch(e) {
        expect(e.reason).to.equal('Is Locked')
      }
    })
  })

  describe('deposits on root and child', async function() {

    beforeEach(async function() {
      const contracts = await deployer.freshDeploy()
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

function validateDepositBlock(depositBlock, owner, token, amountOrNFTId) {
  expect(depositBlock).to.include({owner, token})
  utils.assertBigNumberEquality(depositBlock.amountOrNFTId, amountOrNFTId)
}

function validateDepositHash(depositHash, owner, token, amountOrNFTId) {
  expect(depositHash).to.equal(web3.utils.soliditySha3(owner, token, amountOrNFTId))
}
