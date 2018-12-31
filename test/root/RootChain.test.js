/* global artifacts */

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBigNumber from 'chai-bignumber'
import utils from 'ethereumjs-util'
import encode from 'ethereumjs-abi'

import { generateFirstWallets, mnemonics } from '../helpers/wallets.js'
import { linkLibs, encodeSigs, getSigs, ZeroAddress } from '../helpers/utils.js'
import {
  StakeManagerMock,
  DepositManagerMock,
  WithdrawManagerMock,
  RootToken,
  RootChain,
  RootERC721,
  RootChainMock,
  ChildERC721
} from '../helpers/contracts.js'
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
    let rootToken
    let childToken
    let depositManager
    let withdrawManager
    let owner
    let logDecoder
    let rootERC721
    let childChain

    before(async function() {
      // link libs
      await linkLibs(web3Child)

      logDecoder = new LogDecoder([
        StakeManagerMock._json.abi,
        RootToken._json.abi,
        RootChain._json.abi,
        DepositManagerMock._json.abi,
        WithdrawManagerMock._json.abi,
        RootERC721._json.abi
      ])

      owner = accounts[0]

      childChain = await ChildChain.new()

      rootToken = await RootToken.new('Root Token', 'ROOT')
      childToken = await RootToken.new('Child Token', 'CHILD')

      rootERC721 = await RootERC721.new('Root ERC721', 'R721')
      stakeToken = await RootToken.new('Stake Token', 'STAKE')

      stakeManager = await StakeManagerMock.new()
      await stakeManager.setToken(stakeToken.address)
      rootChain = await RootChain.new()
      await rootChain.setStakeManager(stakeManager.address)
      depositManager = await DepositManagerMock.new({ from: owner })
      withdrawManager = await WithdrawManagerMock.new({ from: owner })
      await stakeManager.changeRootChain(rootChain.address, { from: owner })
      await depositManager.changeRootChain(rootChain.address, { from: owner })
      await withdrawManager.changeRootChain(rootChain.address, { from: owner })
      await rootChain.setDepositManager(depositManager.address, { from: owner })
      await rootChain.setWithdrawManager(withdrawManager.address, {
        from: owner
      })
    })
    it('should allow to map, add erc721 and deposit ERC721', async function() {
      let receipt = await childChain.addToken(
        rootERC721.address,
        'Root ERC721',
        'R721',
        18,
        true
      )
      const childERC721 = ChildERC721.at(receipt.logs[1].args.token)
      receipt = await rootChain.mapToken(
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

    it('should allow to map token', async function() {
      // check if child has correct root token
      // await childToken.token().should.eventually.equal(rootToken.address)

      // map token
      const receipt = await depositManager.mapToken(
        rootToken.address,
        childToken.address,
        false
      )

      const logs = logDecoder.decodeLogs(receipt.receipt.logs)
      logs.should.have.lengthOf(1)
      logs[0].event.should.equal('TokenMapped')
      logs[0].args._rootToken.toLowerCase().should.equal(rootToken.address)
      logs[0].args._childToken.toLowerCase().should.equal(childToken.address)
    })

    it('should have correct mapping', async function() {
      await depositManager
        .tokens(rootToken.address)
        .should.eventually.equal(childToken.address)
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
      await depositManager
        .rootChain()
        .should.eventually.equal(rootChain.address)
      await withdrawManager
        .rootChain()
        .should.eventually.equal(rootChain.address)
    })
  })

  describe('Stakers: header block', async function() {
    let stakeToken
    let stakeManager
    let rootChain
    let wallets
    let owner = accounts[0]
    let depositManager
    let withdrawManager
    let stakes = {
      1: web3.toWei(101),
      2: web3.toWei(100),
      3: web3.toWei(100),
      4: web3.toWei(100)
    }
    let logDecoder

    before(async function() {
      // log decoder
      logDecoder = new LogDecoder([
        StakeManagerMock._json.abi,
        RootToken._json.abi,
        RootChain._json.abi,
        DepositManagerMock._json.abi,
        WithdrawManagerMock._json.abi
      ])

      wallets = generateFirstWallets(mnemonics, Object.keys(stakes).length)

      stakeToken = await RootToken.new('Stake Token', 'STAKE')
      stakeManager = await StakeManagerMock.new()
      await stakeManager.setToken(stakeToken.address)
      rootChain = await RootChainMock.new()

      depositManager = await DepositManagerMock.new({ from: owner })
      withdrawManager = await WithdrawManagerMock.new({ from: owner })
      await rootChain.setStakeManager(stakeManager.address)
      await depositManager.changeRootChain(rootChain.address, { from: owner })
      await withdrawManager.changeRootChain(rootChain.address, {
        from: owner
      })

      await rootChain.setDepositManager(depositManager.address, {
        from: owner
      })
      await rootChain.setWithdrawManager(withdrawManager.address, {
        from: owner
      })

      await stakeManager.changeRootChain(rootChain.address)

      for (var i = 1; i < wallets.length; i++) {
        const amount = stakes[i]
        const user = wallets[i].getAddressString()
        // get tokens
        await stakeToken.mint(user, amount)

        // approve transfer
        await stakeToken.approve(stakeManager.address, amount, { from: user })
        // stake
        await stakeManager.stake(ZeroAddress, user, amount, {
          from: user
        })
      }
    })

    it('should create sigs properly', async function() {
      // dummy vote data
      const voteData = 'dummy'
      let w = [wallets[1], wallets[2], wallets[3]]

      const sigs = utils.bufferToHex(
        encodeSigs(getSigs(w, utils.keccak256(voteData)))
      )

      const result = await stakeManager.checkSignatures(
        utils.bufferToHex(utils.keccak256(voteData)),
        sigs
      )
      assert.isTrue(result)
    })

    it('should submit header block properly', async function() {
      // [[proposer,start,end,root]]
      const extraData = utils.bufferToHex(
        utils.rlp.encode([owner, 0, 22, utils.keccak256(encode(0, 22))])
      )
      const chain = 'test-chain-E5igIA'

      const roundType = 'vote'
      const voteType = await rootChain.voteType()
      const extraDataSHA3 = utils.bufferToHex(utils.sha256(extraData))

      // [chain, roundType, , , voteType, user, keccak256(bytes20(sha256(extradata)))]
      const voteData = utils.bufferToHex(
        utils.rlp.encode([
          chain,
          roundType,
          'a',
          'b',
          voteType,
          // owner,
          extraDataSHA3.slice(0, 42)
        ])
      )

      let w = [wallets[1], wallets[2], wallets[3]]

      const sigs = utils.bufferToHex(
        encodeSigs(getSigs(w, utils.keccak256(voteData)))
      )

      let prevHeader = await rootChain.currentHeaderBlock()
      let childBlockInterval = await rootChain.CHILD_BLOCK_INTERVAL()

      const result = await rootChain.submitHeaderBlock(
        voteData,
        sigs,
        extraData
      )
      const logs = logDecoder.decodeLogs(result.receipt.logs)
      logs.should.have.lengthOf(1)
      logs[0].event.should.equal('NewHeaderBlock')
      logs[0].args.proposer.toLowerCase().should.equal(owner)

      let currentHeader = await rootChain.currentHeaderBlock()
      currentHeader.should.be.bignumber.equal(+prevHeader + +childBlockInterval)
    })
  })
})
