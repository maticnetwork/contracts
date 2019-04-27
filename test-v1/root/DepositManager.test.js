import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBigNumber from 'chai-bignumber'

import {
  DepositManagerMock,
  RootChain,
  RootToken,
  RootERC721,
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
  let rootChain
  let logDecoder
  let rootERC721
  let childERC721

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

    rootChain = await RootChain.new()
    depositManager = await DepositManagerMock.new({ from: owner })

    rootERC721 = await RootERC721.new('Root ERC721', 'R721')

    childERC721 = await RootERC721.new('Child ERC721', 'C721')

    await depositManager.changeRootChain(rootChain.address, { from: owner })
    await rootChain.setDepositManager(depositManager.address, { from: owner })

    // map token
    await depositManager.mapToken(rootToken.address, childToken.address, false)
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
      logs[1].args._amountOrTokenId.should.be.bignumber.equal(amount)

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
      logs[1].args._amountOrTokenId.should.be.bignumber.equal(amount)

      const contractBalance = await rootToken.balanceOf(rootChain.address)
      contractBalance.should.be.bignumber.equal(amount)
    })

    it('should allow to map, add erc721 and deposit ERC721', async function() {
      let receipt = await depositManager.mapToken(
        rootERC721.address,
        childERC721.address,
        true
      )
      const tokenID = web3.toWei(12)
      await rootERC721.mint(tokenID, { from: owner })
      await rootERC721.approve(rootChain.address, tokenID, { from: owner })

      receipt = await rootChain.depositERC721(
        rootERC721.address,
        owner,
        tokenID
      )
      receipt.receipt.logs.should.have.length(2)
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

    it('should allow anyone to deposit ERC721 token directly without approve', async function() {
      let receipt = await depositManager.mapToken(
        rootERC721.address,
        childERC721.address,
        true
      )

      const tokenID = web3.toWei(12)
      await rootERC721.mint(tokenID, { from: owner })

      receipt = await rootERC721.safeTransferFrom(
        owner,
        rootChain.address,
        tokenID
      )

      // receipt.receipt.logs.should.have.length(2)
      const contractBalance = await rootERC721.balanceOf(rootChain.address)
      contractBalance.should.be.bignumber.equal(1)

      const tokenOwner = await rootERC721.ownerOf(tokenID)
      tokenOwner.should.equal(rootChain.address)
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
      await depositManager.mapToken(wethToken.address, wethToken.address, false)
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
