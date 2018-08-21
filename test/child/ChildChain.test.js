import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBigNumber from 'chai-bignumber'

import assertRevert from '../helpers/assertRevert.js'
import { linkLibs } from '../helpers/utils.js'

import { ChildChain, ChildToken, RootToken } from '../helpers/contracts.js'

const zeroAddress = '0x0000000000000000000000000000000000000000'

// add chai pluggin
chai
  .use(chaiAsPromised)
  .use(chaiBigNumber(web3.BigNumber))
  .should()

contract('ChildChain', async function(accounts) {
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
