import assertRevert from './helpers/assertRevert.js'
import utils from 'ethereumjs-util'

let ECVerify = artifacts.require('./lib/ECVerify.sol')
let BytesLib = artifacts.require('./lib/BytesLib.sol')
let RLP = artifacts.require('./lib/RLP.sol')
let SafeMath = artifacts.require('./lib/SafeMath.sol')
let MerklePatriciaProof = artifacts.require('./lib/MerklePatriciaProof.sol')
let Merkle = artifacts.require('./lib/Merkle.sol')
let RLPEncode = artifacts.require('./lib/RLPEncode.sol')

let RootChain = artifacts.require('./RootChain.sol')
let ChildChain = artifacts.require('./child/ChildChain.sol')
let ChildToken = artifacts.require('./child/ChildERC20.sol')
let RootToken = artifacts.require('./token/TestToken.sol')
let MaticWETH = artifacts.require('./token/MaticWETH.sol')
let StakeManager = artifacts.require('./StakeManager.sol')

const BN = utils.BN
const zeroAddress = '0x0000000000000000000000000000000000000000'

contract('ChildERC20', async function(accounts) {
  async function linkLibs() {
    const libContracts = {
      ECVerify: await ECVerify.new(),
      MerklePatriciaProof: await MerklePatriciaProof.new(),
      Merkle: await Merkle.new(),
      RLPEncode: await RLPEncode.new(),
      BytesLib: await BytesLib.new(),
      SafeMath: await SafeMath.new()
    }

    const contractList = [
      StakeManager,
      RootChain,
      RootToken,
      ChildChain,
      ChildToken,
      MaticWETH
    ]
    Object.keys(libContracts).forEach(key => {
      contractList.forEach(c => {
        c.link(key, libContracts[key].address)
      })
    })
  }

  describe('Initialization', async function() {
    before(async function() {
      // link libs
      await linkLibs()
    })

    it('should initialize properly ', async function() {
      const rootToken = await RootToken.new('Test Token', 'TEST')
      const childToken = await ChildToken.new(rootToken.address, 18)
      assert.equal(await childToken.owner(), accounts[0])
      assert.equal(await childToken.token(), rootToken.address)
    })
  })

  describe('Transaction: deposit', async function() {
    let rootToken
    let childToken
    let amount
    let childChain

    before(async function() {
      childChain = await ChildChain.new()
      rootToken = await RootToken.new('Test Token', 'TEST')
      const receipt = await childChain.addToken(rootToken.address, 18)
      childToken = ChildToken.at(receipt.logs[0].args.token)
      amount = web3.toWei(10)
    })

    it('should allow to deposit', async function() {
      let receipt = await childChain.depositTokens(
        rootToken.address,
        accounts[0],
        amount,
        0
      )

      receipt = receipt.receipt
      assert.equal(receipt.logs.length, 3)
    })
  })

  describe('Transaction: withdraw', async function() {
    let rootToken
    let childToken
    let amount
    let childChain

    before(async function() {
      childChain = await ChildChain.new()
      rootToken = await RootToken.new('Test Token', 'TEST')
      const receipt = await childChain.addToken(rootToken.address, 18)
      childToken = ChildToken.at(receipt.logs[0].args.token)
      amount = web3.toWei(10)
      await childChain.depositTokens(rootToken.address, accounts[0], amount, 0)
    })

    it('should not allow to withdraw more than amount', async function() {
      assertRevert(
        childToken.withdraw(new BN(amount).add(new BN(1)).toString())
      )
    })

    it('should allow to withdraw mentioned amount', async function() {
      const beforeBalance = await childToken.balanceOf(accounts[0])
      const receipt = await childToken.withdraw(amount)
      assert.equal(receipt.logs.length, 2)

      assert.equal(receipt.logs[0].event, 'Withdraw')
      assert.equal(receipt.logs[0].args.token, rootToken.address)
      assert.equal(receipt.logs[0].args.user, accounts[0])
      assert.equal(receipt.logs[0].args.amount.toString(), amount)

      assert.equal(receipt.logs[1].event, 'LogWithdraw')
      assert.equal(receipt.logs[1].args.input1, beforeBalance.toString())
      assert.equal(receipt.logs[1].args.amount, amount)
      assert.isOk(
        new BN(beforeBalance.toString())
          .sub(new BN(amount.toString()))
          .eq(new BN(receipt.logs[1].args.output1.toString()))
      )

      // check balance
      assert.equal((await childToken.balanceOf(accounts[0])).toString(), '0')
    })
  })
})
