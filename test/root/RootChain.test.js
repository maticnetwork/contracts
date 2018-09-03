/* global artifacts */

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBigNumber from 'chai-bignumber'
import utils from 'ethereumjs-util'

import { generateFirstWallets, mnemonics } from '../helpers/wallets.js'
import { linkLibs, encodeSigs, getSigs } from '../helpers/utils.js'
import { StakeManager, RootToken, RootChain } from '../helpers/contracts.js'
import LogDecoder from '../helpers/log-decoder'

let ChildChain = artifacts.require('./child/ChildChain.sol')
let ChildToken = artifacts.require('./child/ChildERC20.sol')

const web3Child = new web3.constructor(
  new web3.providers.HttpProvider('http://localhost:8546')
)

ChildChain.web3 = web3Child
ChildToken.web3 = web3Child

// add chai pluggin
chai
  .use(chaiAsPromised)
  .use(chaiBigNumber(web3.BigNumber))
  .should()

contract('RootChain', async function(accounts) {
  describe('initialization', async function() {
    let stakeToken
    let stakeManager
    let rootChain

    before(async function() {
      // link libs
      await linkLibs(web3Child)

      stakeToken = await RootToken.new('Stake Token', 'STAKE')
      stakeManager = await StakeManager.new(stakeToken.address)
      rootChain = await RootChain.new(stakeManager.address)
      await stakeManager.changeRootChain(rootChain.address)
    })

    it('should set stake manager address', async function() {
      await rootChain
        .stakeManager()
        .should.eventually.equal(stakeManager.address)
    })

    it('should set owner properly', async function() {
      await rootChain.owner().should.eventually.equal(accounts[0])
    })

    it('should set root chain properly for stake manager', async function() {
      await stakeManager.rootChain().should.eventually.equal(rootChain.address)
    })
  })

  describe('Stakers: header block', async function() {
    let stakeToken
    let stakeManager
    let rootChain
    let wallets
    let stakes = {
      1: web3.toWei(1),
      2: web3.toWei(10),
      3: web3.toWei(20),
      4: web3.toWei(50)
    }
    let chain
    let dummyRoot
    let sigs
    let logDecoder
    let childBlockInterval

    before(async function() {
      // log decoder
      logDecoder = new LogDecoder([
        StakeManager._json.abi,
        RootToken._json.abi,
        RootChain._json.abi
      ])

      wallets = generateFirstWallets(mnemonics, Object.keys(stakes).length)
      stakeToken = await RootToken.new('Stake Token', 'STAKE')
      stakeManager = await StakeManager.new(stakeToken.address)
      rootChain = await RootChain.new(stakeManager.address)
      childBlockInterval = await rootChain.CHILD_BLOCK_INTERVAL()
      await stakeManager.changeRootChain(rootChain.address)

      for (var i = 1; i < wallets.length; i++) {
        const amount = stakes[i]
        const user = wallets[i].getAddressString()

        // get tokens
        await stakeToken.mint(user, amount)

        // approve transfer
        await stakeToken.approve(stakeManager.address, amount, { from: user })

        // stake
        await stakeManager.stake(amount, '0x0', { from: user })
      }

      // increase threshold to 2
      await stakeManager.updateValidatorThreshold(2)
      chain = await rootChain.chain()
      dummyRoot = utils.bufferToHex(utils.sha3('dummy'))
    })

    it('should create sigs properly', async function() {
      sigs = utils.bufferToHex(
        encodeSigs(
          getSigs(wallets.slice(1), chain, dummyRoot, 0, 10, [
            await stakeManager.getProposer()
          ])
        )
      )

      const signers = await stakeManager.checkSignatures(dummyRoot, 0, 10, sigs)

      // total sigs = wallet.length - proposer - owner
      signers.toNumber().should.be.bignumber.equal(wallets.length - 2)

      // current header block
      const currentHeaderBlock = await rootChain.currentHeaderBlock()
      currentHeaderBlock.should.be.bignumber.equal(childBlockInterval)

      // check current child block
      const currentChildBlock = await rootChain.currentChildBlock()
      currentChildBlock.should.be.bignumber.equal(0)
    })

    it('should allow proposer to submit block', async function() {
      const proposer = await stakeManager.getProposer()

      // submit header block
      const receipt = await rootChain.submitHeaderBlock(dummyRoot, 10, sigs, {
        from: proposer
      })

      const logs = logDecoder.decodeLogs(receipt.receipt.logs)
      logs.should.have.lengthOf(1)
      logs[0].event.should.equal('NewHeaderBlock')
      logs[0].args.proposer.toLowerCase().should.equal(proposer)
      logs[0].args.start.should.be.bignumber.equal(0)
      logs[0].args.end.should.be.bignumber.equal(10)
      logs[0].args.root.should.equal(dummyRoot)

      // current header block
      const currentHeaderBlock = await rootChain.currentHeaderBlock()
      currentHeaderBlock.should.be.bignumber.equal(childBlockInterval.mul(2))
      // assert.equal(+currentHeaderBlock, 1)

      // current child block
      const currentChildBlock = await rootChain.currentChildBlock()
      assert.equal(+currentChildBlock, 10)
    })
  })

  describe('Token: map tokens', async function() {
    let stakeToken
    let rootToken
    let childToken
    let rootChain
    let stakeManager
    let logDecoder

    before(async function() {
      stakeToken = await RootToken.new('Stake Token', 'STAKE')
      rootToken = await RootToken.new('Test Token', 'TEST')
      stakeManager = await StakeManager.new(stakeToken.address)
      rootChain = await RootChain.new(stakeManager.address)
      await stakeManager.changeRootChain(rootChain.address)
      childToken = await ChildToken.new(rootToken.address, 18)

      // log decoder
      logDecoder = new LogDecoder([RootToken._json.abi, RootChain._json.abi])
    })

    it('should allow to map token', async function() {
      // check if child has correct root token
      await childToken.token().should.eventually.equal(rootToken.address)

      const receipt = await rootChain.mapToken(
        rootToken.address,
        childToken.address
      )

      const logs = logDecoder.decodeLogs(receipt.receipt.logs)
      logs.should.have.lengthOf(1)
      logs[0].event.should.equal('TokenMapped')
      logs[0].args._rootToken.toLowerCase().should.equal(rootToken.address)
      logs[0].args._childToken.toLowerCase().should.equal(childToken.address)
    })

    it('should have correct mapping', async function() {
      await rootChain
        .tokens(rootToken.address)
        .should.eventually.equal(childToken.address)
    })
  })
})
