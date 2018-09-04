import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBigNumber from 'chai-bignumber'

import { DepositManagerMock, RootToken, MaticWETH } from '../helpers/contracts'
import { linkLibs } from '../helpers/utils'
import EVMRevert from '../helpers/evm-revert'

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

  beforeEach(async function() {
    await linkLibs()

    owner = accounts[0]
    amount = web3.toWei(10) // 10 tokens
    depositManager = await DepositManagerMock.new({ from: owner })

    const childBlockInterval = await depositManager.CHILD_BLOCK_INTERVAL()
    await depositManager.setCurrentHeaderBlock(+childBlockInterval)

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
      await rootToken.approve(depositManager.address, amount, {
        from: user
      })

      // deposit tokens
      const receipt = await depositManager.deposit(
        rootToken.address,
        user,
        amount,
        {
          from: user
        }
      )

      receipt.logs.should.have.lengthOf(1)
      receipt.logs[0].event.should.equal('Deposit')
      receipt.logs[0].args._user.should.equal(user)
      receipt.logs[0].args._token.should.equal(rootToken.address)
      receipt.logs[0].args._amount.should.be.bignumber.equal(amount)

      const contractBalance = await rootToken.balanceOf(depositManager.address)
      contractBalance.should.be.bignumber.equal(amount)
    })

    it('should allow anyone to deposit token for others', async function() {
      const user = accounts[1]

      // mint root token
      await rootToken.approve(depositManager.address, amount)
      // deposit tokens
      const receipt = await depositManager.deposit(
        rootToken.address,
        user,
        amount
      )

      receipt.logs.should.have.lengthOf(1)
      receipt.logs[0].event.should.equal('Deposit')
      receipt.logs[0].args._user.should.equal(user)
      receipt.logs[0].args._token.should.equal(rootToken.address)
      receipt.logs[0].args._amount.should.be.bignumber.equal(amount)

      const contractBalance = await rootToken.balanceOf(depositManager.address)
      contractBalance.should.be.bignumber.equal(amount)
    })

    it('should allow anyone to deposit ERC223 token directly without approve', async function() {
      const user = accounts[1]

      // mint root token
      await rootToken.mint(user, amount)

      // transfer token to deposit manager
      await rootToken.transfer(depositManager.address, amount, {
        from: user
      })

      // check deposit manager balance
      const contractBalance = await rootToken.balanceOf(depositManager.address)
      contractBalance.should.be.bignumber.equal(amount)
    })

    it('should not allow to deposit if token is not mapped', async function() {
      const newToken = await RootToken.new('New root Token', 'ROOT2')

      // mint root token
      await newToken.approve(depositManager.address, amount)
      await depositManager
        .deposit(newToken.address, owner, amount)
        .should.be.rejectedWith(EVMRevert)
    })

    it('should not allow to deposit if token is not approved', async function() {
      await depositManager
        .deposit(rootToken.address, owner, amount)
        .should.be.rejectedWith(EVMRevert)
    })

    it('should not allow to deposit if amount is zero', async function() {
      await rootToken.approve(depositManager.address, amount)
      await depositManager
        .deposit(rootToken.address, owner, 0)
        .should.be.rejectedWith(EVMRevert)
    })

    it('should not allow to deposit if amount is more than approved', async function() {
      await rootToken.approve(depositManager.address, amount)
      await depositManager
        .deposit(rootToken.address, owner, web3.toWei(11))
        .should.be.rejectedWith(EVMRevert)
    })
  })

  describe('eth deposits', async function() {
    let wethToken
    let ethAmount

    beforeEach(async function() {
      wethToken = await MaticWETH.new()
      ethAmount = web3.toWei('0.01')
      // set weth token and map weth token
      await depositManager.setWETHToken(wethToken.address)
      await depositManager.mapToken(wethToken.address, wethToken.address)
    })

    it('should allow anyone to deposit ethers', async function() {
      // deposit tokens
      const receipt = await depositManager.depositEthers(owner, {
        value: ethAmount
      })

      receipt.logs.should.have.lengthOf(1)
      receipt.logs[0].event.should.equal('Deposit')
      receipt.logs[0].args._user.should.equal(owner)
      receipt.logs[0].args._token.should.equal(wethToken.address)
      receipt.logs[0].args._amount.should.be.bignumber.equal(ethAmount)

      const wethBalance = await web3.eth.getBalance(wethToken.address)
      wethBalance.should.be.bignumber.equal(ethAmount)

      const contractBalance = await wethToken.balanceOf(depositManager.address)
      contractBalance.should.be.bignumber.equal(ethAmount)
    })

    it('should allow to deposit ethers by sending ethers to contract', async function() {
      await web3.eth.sendTransaction({
        from: owner,
        to: depositManager.address,
        value: ethAmount,
        gas: 200000
      })

      const wethBalance = await web3.eth.getBalance(wethToken.address)
      wethBalance.should.be.bignumber.equal(ethAmount)

      const contractBalance = await wethToken.balanceOf(depositManager.address)
      contractBalance.should.be.bignumber.equal(ethAmount)
    })

    it('should not allow to deposit if eth amount is zero', async function() {
      await depositManager
        .depositEthers(owner, { value: 0 })
        .should.be.rejectedWith(EVMRevert)
    })
  })
})
