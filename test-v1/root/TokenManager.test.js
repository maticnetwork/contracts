import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBigNumber from 'chai-bignumber'

import { TokenManagerMock } from '../helpers/contracts'

// add chai pluggin
chai
  .use(chaiAsPromised)
  .use(chaiBigNumber(web3.BigNumber))
  .should()

contract('TokenManager', async function(accounts) {
  let tokenManager
  let owner

  beforeEach(async function() {
    owner = accounts[0]
    tokenManager = await TokenManagerMock.new({ from: owner })
  })

  it('should allow owner to map token:ERC20', async function() {
    const [rootToken, childToken] = accounts.slice(1)
    const receipt = await tokenManager.mapToken(rootToken, childToken, false, {
      from: owner
    })

    receipt.logs.should.have.lengthOf(1)
    receipt.logs[0].event.should.equal('TokenMapped')
    receipt.logs[0].args._rootToken.should.equal(rootToken)
    receipt.logs[0].args._childToken.should.equal(childToken)

    await tokenManager.tokens(rootToken).should.eventually.equal(childToken)
    await tokenManager
      .reverseTokens(childToken)
      .should.eventually.equal(rootToken)

    await tokenManager.isERC721(rootToken).should.eventually.equal(false)
  })

  it('should allow owner to map token:ERC721', async function() {
    const [rootToken, childToken] = accounts.slice(1)
    const receipt = await tokenManager.mapToken(rootToken, childToken, true, {
      from: owner
    })

    receipt.logs.should.have.lengthOf(1)
    receipt.logs[0].event.should.equal('TokenMapped')
    receipt.logs[0].args._rootToken.should.equal(rootToken)
    receipt.logs[0].args._childToken.should.equal(childToken)

    await tokenManager.tokens(rootToken).should.eventually.equal(childToken)
    await tokenManager
      .reverseTokens(childToken)
      .should.eventually.equal(rootToken)

    await tokenManager.isERC721(rootToken).should.eventually.equal(true)
  })

  // not valid anymore
  // it('should now allow any other than owner to map token', async function() {
  //   const [mapper, rootToken, childToken] = accounts.slice(2)
  //   await tokenManager
  //     .mapToken(rootToken, childToken, {
  //       from: mapper
  //     })
  //     .should.be.rejectedWith(EVMRevert)
  // })

  it('should allow owner to set weth token', async function() {
    const [wethToken] = accounts.slice(2)
    await tokenManager.setWETHToken(wethToken, {
      from: owner
    })

    await tokenManager.wethToken().should.eventually.equal(wethToken)
  })
})
