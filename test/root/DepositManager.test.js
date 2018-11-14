import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBigNumber from 'chai-bignumber'

import {
  DepositManagerMock,
  StakeManager,
  RootChain,
  RootToken,
  MaticWETH
} from '../helpers/contracts'
import { linkLibs } from '../helpers/utils'
import EVMRevert from '../helpers/evm-revert'
import LogDecoder from '../helpers/log-decoder'

// add chai pluggin
chai
  .use(chaiAsPromised)
  .use(chaiBigNumber(web3.BigNumber))
  .should()

contract('DepositManager', async function(accounts) {
  let depositManager
  let owner
  let rootToken
  let childToken
  let amount
  let stakeManager
  let rootChain
  let stakeToken
  let logDecoder

  beforeEach(async function() {
    await linkLibs()

    logDecoder = new LogDecoder([
      RootChain._json.abi,
      RootToken._json.abi,
      DepositManagerMock._json.abi
    ])

    owner = accounts[0]
    amount = web3.toWei('10', 'ether') // 10 tokens
    rootToken = await RootToken.new('Root Token', 'ROOT')
    childToken = await RootToken.new('Child Token', 'CHILD')
    stakeToken = await RootToken.new('Stake Token', 'STAKE')

    stakeManager = await StakeManager.new(stakeToken.address)
    rootChain = await RootChain.new(stakeManager.address)
    depositManager = await DepositManagerMock.new({ from: owner })
    await depositManager.changeRootChain(rootChain.address, { from: owner })
    await rootChain.setDepositManager(depositManager.address, { from: owner })

    // const childBlockInterval = await depositManager.CHILD_BLOCK_INTERVAL()
    // await depositManager.setCurrentHeaderBlock(+childBlockInterval)

    rootToken = await RootToken.new('Root Token', 'ROOT')
    childToken = await RootToken.new('Child Token', 'CHILD')

    // map token
    await depositManager.mapToken(rootToken.address, childToken.address)
  })

  describe('token deposits', async function() {
    it('should allow anyone to deposit token', async function() {
      const user = accounts[1]

      // mint root token
      await rootToken.mint(user, amount)
      await rootToken.approve(rootChain.address, amount, {
        from: user
      })

      // deposit tokens
      const receipt = await rootChain.deposit(rootToken.address, user, amount, {
        from: user
      })
      let logs = logDecoder.decodeLogs(receipt.receipt.logs)

      logs.should.have.lengthOf(2)
      logs[1].event.should.equal('Deposit')
      logs[1].args._user.toLowerCase().should.equal(user.toLowerCase())
      logs[1].args._token
        .toLowerCase()
        .should.equal(rootToken.address.toLowerCase())
      logs[1].args._amount.should.be.bignumber.equal(amount)

      const contractBalance = await rootToken.balanceOf(rootChain.address)
      contractBalance.should.be.bignumber.equal(amount)
    })

    it('should allow anyone to deposit token for others', async function() {
      const user = accounts[1]

      // mint root token
      await rootToken.approve(rootChain.address, amount)
      // deposit tokens
      const receipt = await rootChain.deposit(rootToken.address, user, amount)

      let logs = logDecoder.decodeLogs(receipt.receipt.logs)

      logs.should.have.lengthOf(2)
      logs[1].event.should.equal('Deposit')
      logs[1].args._user.toLowerCase().should.equal(user.toLowerCase())
      logs[1].args._token
        .toLowerCase()
        .should.equal(rootToken.address.toLowerCase())
      logs[1].args._amount.should.be.bignumber.equal(amount)

      const contractBalance = await rootToken.balanceOf(rootChain.address)
      contractBalance.should.be.bignumber.equal(amount)
    })

    it('should allow anyone to deposit ERC223 token directly without approve', async function() {
      const user = accounts[1]

      // mint root token
      await rootToken.mint(user, amount)

      // transfer token to deposit manager
      await rootToken.transfer(rootChain.address, amount, {
        from: user
      })

      // check deposit manager balance
      const contractBalance = await rootToken.balanceOf(rootChain.address)
      contractBalance.should.be.bignumber.equal(amount)
    })

    it('should not allow to deposit if token is not mapped', async function() {
      const newToken = await RootToken.new('New root Token', 'ROOT2')

      // mint root token
      await newToken.approve(rootChain.address, amount)
      await rootChain
        .deposit(newToken.address, owner, amount)
        .should.be.rejectedWith(EVMRevert)
    })

    it('should not allow to deposit if token is not approved', async function() {
      await rootChain
        .deposit(rootToken.address, owner, amount)
        .should.be.rejectedWith(EVMRevert)
    })

    it('should not allow to deposit if amount is zero', async function() {
      await rootToken.approve(rootChain.address, amount)
      await rootChain
        .deposit(rootToken.address, owner, 0)
        .should.be.rejectedWith(EVMRevert)
    })

    it('should not allow to deposit if amount is more than approved', async function() {
      await rootToken.approve(rootChain.address, amount)
      await rootChain
        .deposit(rootToken.address, owner, web3.toWei(11))
        .should.be.rejectedWith(EVMRevert)
    })
  })

  describe('eth deposits', async function() {
    let wethToken
    let ethAmount

    beforeEach(async function() {
      wethToken = await MaticWETH.new()
      ethAmount = web3.toWei('0.01', 'ether')
      // set weth token and map weth token
      await depositManager.setWETHToken(wethToken.address)
      await depositManager.mapToken(wethToken.address, wethToken.address)
    })

    it('should allow anyone to deposit ethers', async function() {
      // deposit tokens
      await rootChain.depositEthers({
        value: ethAmount
      })

      const wethBalance = await web3.eth.getBalance(wethToken.address)
      wethBalance.should.be.bignumber.equal(ethAmount)

      const contractBalance = await wethToken.balanceOf(rootChain.address)
      contractBalance.should.be.bignumber.equal(ethAmount)
    })

    it('should allow to deposit ethers by sending ethers to contract', async function() {
      await web3.eth.sendTransaction({
        from: owner,
        to: rootChain.address,
        value: ethAmount,
        gas: 200000
      })

      const wethBalance = await web3.eth.getBalance(wethToken.address)
      wethBalance.should.be.bignumber.equal(ethAmount)

      const contractBalance = await wethToken.balanceOf(rootChain.address)
      contractBalance.should.be.bignumber.equal(ethAmount)
    })

    it('should not allow to deposit if eth amount is zero', async function() {
      await rootChain
        .depositEthers({ value: 0 })
        .should.be.rejectedWith(EVMRevert)
    })
  })
})
