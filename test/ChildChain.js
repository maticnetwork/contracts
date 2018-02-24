import assertRevert from './helpers/assertRevert.js'

let ECVerify = artifacts.require('./lib/ECVerify.sol')
let RLP = artifacts.require('./lib/RLP.sol')
let PatriciaUtils = artifacts.require('./lib/PatriciaUtils.sol')
let SafeMath = artifacts.require('./lib/SafeMath.sol')

let ChildChain = artifacts.require('./child/ChildChain.sol')
let ChildToken = artifacts.require('./child/ChildERC20.sol')
let RootToken = artifacts.require('./TestToken.sol')

const zeroAddress = '0x0000000000000000000000000000000000000000'

contract('ChildChain', async function(accounts) {
  async function linkLibs() {
    const libContracts = {
      ECVerify: await ECVerify.new(),
      RLP: await RLP.new(),
      PatriciaUtils: await PatriciaUtils.new(),
      SafeMath: await SafeMath.new()
    }

    Object.keys(libContracts).forEach(key => {
      ChildChain.link(key, libContracts[key].address)
    })
  }

  describe('Initialization', async function() {
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
      childChainContract = await ChildChain.new()
      rootToken = await RootToken.new()
    })

    it('should allow only owner to add new token ', async function() {
      await assertRevert(
        childChainContract.addToken(rootToken.address, {
          from: accounts[1]
        })
      )
      assert.equal(
        await childChainContract.tokens(rootToken.address),
        zeroAddress
      )
    })

    it('should allow owner to add new token ', async function() {
      const receipt = await childChainContract.addToken(rootToken.address, {
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
        childChainContract.addToken(rootToken.address, {
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

  describe('Update token', async function() {
    let childChainContract
    let rootToken
    let rootToken2

    let childToken

    before(async function() {
      childChainContract = await ChildChain.new()
      rootToken = await RootToken.new()
      rootToken2 = await RootToken.new()

      // add token
      const receipt = await childChainContract.addToken(rootToken.address, {
        from: accounts[0]
      })
      // get child chain token
      childToken = ChildToken.at(receipt.logs[0].args.token)
    })

    it('should not allow others to update token', async function() {
      // check address
      assert.equal(await childToken.token(), rootToken.address)
      await assertRevert(
        childChainContract.updateToken(rootToken.address, rootToken2.address, {
          from: accounts[1]
        })
      )
      assert.equal(await childToken.token(), rootToken.address)
    })

    it('should allow owner to update token ', async function() {
      // check address
      assert.equal(await childToken.token(), rootToken.address)
      await childChainContract.updateToken(
        rootToken.address,
        rootToken2.address,
        {
          from: accounts[0]
        }
      )
      assert.equal(await childToken.token(), rootToken2.address)
      assert.equal(
        await childChainContract.tokens(rootToken2.address),
        childToken.address
      )
    })
  })
})
