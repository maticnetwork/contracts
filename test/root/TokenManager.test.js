import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import { TokenManagerMock } from '../helpers/contracts'
import EVMRevert from '../helpers/EVMRevert'

// add chai pluggin
chai.use(chaiAsPromised).should()

contract('TokenManager', async function(accounts) {
  let contract
  let owner

  beforeEach(async function() {
    owner = accounts[0]
    contract = await TokenManagerMock.new({ from: owner })
  })

  it('should allow owner to map token', async function() {
    const [rootToken, childToken] = accounts.slice(1)
    const receipt = await contract.mapToken(rootToken, childToken, {
      from: owner
    })

    receipt.logs.should.have.lengthOf(1)
    receipt.logs[0].event.should.equal('TokenMapped')
    receipt.logs[0].args._rootToken.should.equal(rootToken)
    receipt.logs[0].args._childToken.should.equal(childToken)

    contract.tokens(rootToken).should.eventually.equal(childToken)
    contract.reverseTokens(childToken).should.eventually.equal(rootToken)
  })

  it('should now allow any other than owner to map token', async function() {
    const [mapper, rootToken, childToken] = accounts.slice(2)
    await contract
      .mapToken(rootToken, childToken, {
        from: mapper
      })
      .should.be.rejectedWith(EVMRevert)
  })

  it('should allow owner to set weth token', async function() {
    const [wethToken] = accounts.slice(2)
    await contract.setWETHToken(wethToken, {
      from: owner
    })

    contract.wethToken().should.eventually.equal(wethToken)
  })
})
