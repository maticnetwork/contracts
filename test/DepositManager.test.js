import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBigNumber from 'chai-bignumber'
import utils from 'ethereumjs-util'
import encode from 'ethereumjs-abi'
import BN from 'bn.js'
import BigNumber from 'bignumber.js'

import deployer from './helpers/deployer.js'
import * as _contracts from './helpers/contracts'
import LogDecoder from './helpers/log-decoder'

chai
  .use(chaiAsPromised)
  .use(chaiBigNumber(web3.BigNumber))
  .should()

contract("DepositManager", async function(accounts) {
  // let rootChain, depositManager, maticWeth
  let rootChain, depositManager, maticWeth
  let logDecoder
  before(async function() {
    const contracts = await deployer.freshDeploy()
    rootChain = contracts.rootChain
    depositManager = contracts.depositManager
    // console.dir(depositManager, {depth: null})
    maticWeth = contracts.maticWeth

    logDecoder = new LogDecoder([
      _contracts.RootChain._json.abi,
      _contracts.MaticWETH._json.abi,
      _contracts.DepositManager._json.abi
    ])

    // console.log('in DepositManager', rootChain.address)
    // console.log('header', await rootChain.headerBlocks(1000))
  })

  // beforeEach(async function() {})

  it("depositEther", async function() {
    const value = web3.utils.toWei('1', 'ether')
    // console.log('value', value)
    const result = await depositManager.depositEther({
      value,
      from: accounts[0]
    })
    // console.dir(result, {depth: null})
    const logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    // console.dir(logs, {depth: null})

    // Transfer, Deposit, NewDepositBlock
    logs.should.have.lengthOf(3) //
    logs[2].event.should.equal('NewDepositBlock')
    expect(logs[2].args).to.include({
      owner: accounts[0],
      token: maticWeth.address
    })
    expect(logs[2].args.amountOrNFTId.toString()).to.equal(value)
    expect(logs[2].args.depositBlockId.toString()).to.equal('1')

    const depositBlock = await rootChain.deposits(1)
    // console.log('depositBlock', depositBlock)
    expect(depositBlock).to.include({
      owner: accounts[0],
      token: maticWeth.address
    })
    expect(depositBlock.amountOrNFTId.toString()).to.equal(value)
    expect(logs[2].args.depositBlockId.toString()).to.equal('1')
  })
})
