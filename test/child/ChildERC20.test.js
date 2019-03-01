import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBigNumber from 'chai-bignumber'

import { generateFirstWallets, mnemonics } from '../helpers/wallets'
import { ChildChain, ChildERC20, RootToken } from '../helpers/contracts'
import { linkLibs, ZeroAddress, getSig } from '../helpers/utils'

// add chai pluggin
chai
  .use(chaiAsPromised)
  .use(chaiBigNumber(web3.BigNumber))
  .should()

const web3Child = new web3.constructor(
  new web3.providers.HttpProvider('http://localhost:8545')
)
contract('ChildERC20', async function(accounts) {
  let rootToken
  let childToken
  let childChain
  let amount
  let owner

  beforeEach(async function() {
    // link libs
    await linkLibs(web3Child)

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

  it('should allow transfer using sig', async function() {
    const wallets = generateFirstWallets(mnemonics, 10)
    const address1 = wallets[0].getAddressString()
    const address2 = wallets[1].getAddressString()
    const privateKey1 = wallets[0].getPrivateKeyString()
    const secret =
      '0x468fc9c005382579139846222b7b0aebc9182ba073b2455938a86d9753bfb078'
    const amountOrTokenId = 20
    // const token = await ChildERC20.new()

    // mint tokens
    await childChain.depositTokens(
      rootToken.address,
      address1,
      amountOrTokenId,
      1,
      {
        from: owner
      }
    )

    const beforeBalance = await childToken.balanceOf(address1)
    assert.equal(beforeBalance.toNumber(), amountOrTokenId)

    const obj1 = getSig({
      pk: privateKey1,
      spender: address2,
      secret,
      amountOrTokenId,
      token: childToken.address
    })
    // transfer with sig
    await childToken.transferWithSig(
      obj1.sig,
      obj1.amountOrTokenId,
      obj1.secret,
      address2,
      {
        from: accounts[1]
      }
    )

    const afterBalance = await childToken.balanceOf(address1)
    assert.equal(afterBalance.toNumber(), 0)

    const afterBalance1 = await childToken.balanceOf(address2)
    assert.equal(afterBalance1.toNumber(), amountOrTokenId)
  })

  it('should check true (safety check)', async function() {
    assert.isTrue(true)
  })
})
