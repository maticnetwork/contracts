import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBigNumber from 'chai-bignumber'
import BigNumber from 'bignumber.js'
import BN from 'bn.js'

import deployer from './helpers/deployer.js'
import * as _contracts from './helpers/contracts.js'
import logDecoder from './helpers/log-decoder.js'
import { assertBigNumberEquality, assertBigNumbergt } from './helpers/utils.js'

chai
  .use(chaiAsPromised)
  // .use(chaiBigNumber(web3.BigNumber))
  .use(require('chai-bn')(web3.utils.BN))
  .should()

contract("DepositManager", async function(accounts) {
  let rootChain, depositManager, maticWeth

  beforeEach(async function() {
    const contracts = await deployer.freshDeploy()
    rootChain = contracts.rootChain
    depositManager = contracts.depositManager
    maticWeth = contracts.maticWeth
  })

  it("depositEther", async function() {
    const value = web3.utils.toWei('1', 'ether')
    const result = await depositManager.depositEther({
      value,
      from: accounts[0]
    })
    const logs = logDecoder.decodeLogs(result.receipt.rawLogs)

    // Transfer, Deposit, NewDepositBlock
    logs.should.have.lengthOf(3) //
    logs[2].event.should.equal('NewDepositBlock')
    validateDepositBlock(logs[2].args, accounts[0], maticWeth.address, value)
    expect(logs[2].args.depositBlockId.toString()).to.equal('1')

    const depositBlock = await rootChain.deposits(1)
    validateDepositBlock(depositBlock, accounts[0], maticWeth.address, value)
  })

  it("depositERC20", async function() {
    const testToken = await deployer.deployTestErc20()
    let amount = new BigNumber('10').pow(new BigNumber('18'))
    await testToken.approve(depositManager.address, amount)
    const result = await depositManager.depositERC20(testToken.address, amount)
    const logs = logDecoder.decodeLogs(result.receipt.rawLogs)

    // Transfer, Approval, NewDepositBlock
    logs.should.have.lengthOf(3) //
    logs[2].event.should.equal('NewDepositBlock')
    validateDepositBlock(logs[2].args, accounts[0], testToken.address, amount)
    expect(logs[2].args.depositBlockId.toString()).to.equal('1')

    const depositBlock = await rootChain.deposits(1)
    validateDepositBlock(depositBlock, accounts[0], testToken.address, amount)
  })

  it("depositERC20ForUser", async function() {
    const testToken = await deployer.deployTestErc20()
    const user = accounts[1]
    let amount = new BigNumber('10').pow(new BigNumber('18'))
    await testToken.approve(depositManager.address, amount)
    const result = await depositManager.depositERC20ForUser(testToken.address, user, amount)
    const logs = logDecoder.decodeLogs(result.receipt.rawLogs)

    // Transfer, Approval, NewDepositBlock
    logs.should.have.lengthOf(3)
    logs[2].event.should.equal('NewDepositBlock')
    validateDepositBlock(logs[2].args, user, testToken.address, amount)
    expect(logs[2].args.depositBlockId.toString()).to.equal('1')

    const depositBlock = await rootChain.deposits(1)
    validateDepositBlock(depositBlock, user, testToken.address, amount)
  })

  it("depositERC721", async function() {
    const testToken = await deployer.deployTestErc721()
    let tokenId = new BigNumber('1212')
    await testToken.mint(tokenId)
    await testToken.approve(depositManager.address, tokenId)
    const result = await depositManager.depositERC721(testToken.address, tokenId)
    const logs = logDecoder.decodeLogs(result.receipt.rawLogs)

    // Transfer, NewDepositBlock
    // check why Approval event is not being logged
    logs.should.have.lengthOf(2)
    const _depositBlock = logs[1]
    _depositBlock.event.should.equal('NewDepositBlock')
    validateDepositBlock(_depositBlock.args, accounts[0], testToken.address, tokenId)
    expect(_depositBlock.args.depositBlockId.toString()).to.equal('1')

    const depositBlock = await rootChain.deposits(1)
    validateDepositBlock(depositBlock, accounts[0], testToken.address, tokenId)
  })

  it("depositERC721ForUser", async function() {
    const testToken = await deployer.deployTestErc721()
    const user = accounts[1]
    let tokenId = new BigNumber('1212')
    await testToken.mint(tokenId)
    await testToken.approve(depositManager.address, tokenId)
    const result = await depositManager.depositERC721ForUser(testToken.address, user, tokenId)
    const logs = logDecoder.decodeLogs(result.receipt.rawLogs)

    // Transfer, NewDepositBlock
    // check why Approval event is not being logged
    logs.should.have.lengthOf(2)
    const _depositBlock = logs[1]
    _depositBlock.event.should.equal('NewDepositBlock')
    validateDepositBlock(_depositBlock.args, user, testToken.address, tokenId)
    expect(_depositBlock.args.depositBlockId.toString()).to.equal('1')

    const depositBlock = await rootChain.deposits(1)
    validateDepositBlock(depositBlock, user, testToken.address, tokenId)
  })

  it('onERC721Received');
  it('tokenFallback');
})

function validateDepositBlock(depositBlock, owner, token, amountOrNFTId) {
  expect(depositBlock).to.include({owner, token})
  // depositBlock.amountOrNFTId.should.be.bignumber.equal(amountOrNFTId.toString())
}
