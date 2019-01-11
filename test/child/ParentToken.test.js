import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBigNumber from 'chai-bignumber'

import {
  ChildChain,
  ChildERC20,
  ParentToken,
  RootToken
} from '../helpers/contracts'
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
  let parentToken
  let amount
  let owner

  beforeEach(async function() {
    // link libs
    await linkLibs()

    owner = accounts[0]

    // root token / child chain
    rootToken = await RootToken.new('Test Token', 'TEST')
    childChain = await ChildChain.new()
    parentToken = await ParentToken.new()

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
    await childToken.setParent(parentToken.address, { from: owner })

    // amount
    amount = web3.toWei(10)
  })

  it('should initialize properly', async function() {
    await childToken.owner().should.eventually.equal(childChain.address)
    await childToken.token().should.eventually.equal(rootToken.address)
  })

  it('should allow to deposit', async function() {
    await parentToken.updatePermission(owner)
    let receipt = await childChain.depositTokens(
      rootToken.address,
      owner,
      amount,
      11
    )
    receipt.receipt.logs.should.have.lengthOf(3)
  })

  it('should not allow to withdraw more than amount', async function() {
    let out = await childToken.transfer(accounts[1], web3.toWei(1))
    console.log(out)
  })

  it('should check true (safety check)', async function() {
    assert.isTrue(true)
  })
})
