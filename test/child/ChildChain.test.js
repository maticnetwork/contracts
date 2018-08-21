import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBigNumber from 'chai-bignumber'

import { linkLibs, ZeroAddress } from '../helpers/utils.js'
import EVMRevert from '../helpers/EVMRevert.js'

import { ChildChain, ChildToken, RootToken } from '../helpers/contracts.js'

// add chai pluggin
chai
  .use(chaiAsPromised)
  .use(chaiBigNumber(web3.BigNumber))
  .should()

contract('ChildChain', async function(accounts) {
  let childChainContract
  let rootToken
  let childToken

  before(async function() {
    // link libs
    await linkLibs()

    // create child chain contract
    childChainContract = await ChildChain.new()
    // create new root token
    rootToken = await RootToken.new('Test Token', 'TEST')
  })

  it('should initialize properly ', async function() {
    await childChainContract.owner().should.eventually.equal(accounts[0])
  })

  it('should allow only owner to add new token ', async function() {
    await childChainContract
      .addToken(rootToken.address, 18, {
        from: accounts[1]
      })
      .should.be.rejectedWith(EVMRevert)

    await childChainContract
      .tokens(rootToken.address)
      .should.eventually.equal(ZeroAddress)
  })

  it('should allow owner to add new token ', async function() {
    const receipt = await childChainContract.addToken(rootToken.address, 18, {
      from: accounts[0]
    })

    receipt.logs.should.have.lengthOf(1)
    receipt.logs[0].event.should.equal('NewToken')
    receipt.logs[0].args.rootToken.should.equal(rootToken.address)

    // child chain contract
    await childChainContract
      .tokens(rootToken.address)
      .should.eventually.equal(receipt.logs[0].args.token)

    // get child chain token
    childToken = ChildToken.at(receipt.logs[0].args.token)
  })

  it('should have proper owner', async function() {
    await childToken.owner().should.eventually.equal(childChainContract.address)
  })

  it('should not allow to add new token again', async function() {
    await childChainContract
      .addToken(rootToken.address, 18, {
        from: accounts[0]
      })
      .should.be.rejectedWith(EVMRevert)
  })

  it('should match mapping', async function() {
    await childChainContract
      .tokens(rootToken.address)
      .should.eventually.equal(childToken.address)
  })
})
