import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBigNumber from 'chai-bignumber'

import { ChildChain, ChildERC20, RootToken } from '../helpers/contracts'
import { linkLibs, ZeroAddress } from '../helpers/utils'

// add chai pluggin
chai
  .use(chaiAsPromised)
  .use(chaiBigNumber(web3.BigNumber))
  .should()

contract('ChildERC20', async function(accounts) {
  let rootToken
  let childToken
  let childChain
  let amount
  let owner

  beforeEach(async function() {
    // link libs
    await linkLibs()

    owner = accounts[0]

    // root token / child chain
    rootToken = await RootToken.new('Test Token', 'TEST')
    childChain = await ChildChain.new()

    // receipt
    const receipt = await childChain.addToken(
      accounts[0],
      rootToken.address,
      'Token Test',
      'TEST',
      18,
      false
    )
    childToken = ChildERC20.at(receipt.logs[1].args.token.toLowerCase())

    // amount
    amount = web3.toWei(10)
  })

  it('should initialize properly', async function() {
    await childToken.owner().should.eventually.equal(childChain.address)
    await childToken.token().should.eventually.equal(rootToken.address)
  })

  it('should allow to deposit', async function() {
    let receipt = await childChain.depositTokens(
      rootToken.address,
      owner,
      amount,
      11
    )
    receipt.receipt.logs.should.have.lengthOf(3)
  })

  it('should not allow to withdraw more than amount', async function() {
    await childToken.withdraw(web3.toWei(11)).should.be.rejected
  })

  it('should allow to withdraw mentioned amount', async function() {
    // deposit tokens
    await childChain.depositTokens(rootToken.address, owner, amount, 0)

    // withdraw those tokens
    const receipt = await childToken.withdraw(amount)
    receipt.logs.should.have.lengthOf(2)

    receipt.logs[0].event.should.equal('Transfer')
    receipt.logs[0].args.from.toLowerCase().should.equal(owner)
    receipt.logs[0].args.to.toLowerCase().should.equal(ZeroAddress)
    receipt.logs[0].args.value.should.be.bignumber.equal(amount)

    receipt.logs[1].event.should.equal('Withdraw')
    receipt.logs[1].args.token.should.equal(rootToken.address)
    receipt.logs[1].args.from.should.equal(owner)
    receipt.logs[1].args.amountOrTokenId.toString().should.equal(amount)

    const afterBalance = await childToken.balanceOf(owner)
    afterBalance.should.be.bignumber.equal(0)
  })

  it('should check true (safety check)', async function() {
    assert.isTrue(true)
  })
})
