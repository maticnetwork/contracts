import assertRevert from './helpers/assertRevert.js'

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

const zeroAddress = '0x0000000000000000000000000000000000000000'

contract('ChildChain', async function(accounts) {
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
      const childChainContract = await ChildChain.new()
      assert.equal(await childChainContract.owner(), accounts[0])
    })
  })

  describe('New token', async function() {
    let childChainContract
    let rootToken
    let childToken

    before(async function() {
      // link libs
      await linkLibs()

      childChainContract = await ChildChain.new()
      rootToken = await RootToken.new('Test Token', 'TEST')
    })

    it('should allow only owner to add new token ', async function() {
      await assertRevert(
        childChainContract.addToken(rootToken.address, 18, {
          from: accounts[1]
        })
      )
      assert.equal(
        await childChainContract.tokens(rootToken.address),
        zeroAddress
      )
    })

    it('should allow owner to add new token ', async function() {
      const receipt = await childChainContract.addToken(rootToken.address, 18, {
        from: accounts[0]
      })
      assert.equal(receipt.logs.length, 1)
      assert.equal(receipt.logs[0].event, 'NewToken')
      assert.equal(receipt.logs[0].args.rootToken, rootToken.address)
      assert.equal(
        receipt.logs[0].args.token,
        await childChainContract.tokens(rootToken.address)
      )

      // get child chain token
      childToken = ChildToken.at(receipt.logs[0].args.token)
    })

    it('should have proper owner', async function() {
      assert.equal(await childToken.owner(), childChainContract.address)
    })

    it('should not allow to add new token again', async function() {
      await assertRevert(
        childChainContract.addToken(rootToken.address, 18, {
          from: accounts[0]
        })
      )
    })

    it('should match mapping', async function() {
      assert.equal(
        await childChainContract.tokens(rootToken.address),
        childToken.address
      )
    })
  })
})
