import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBigNumber from 'chai-bignumber'

import { generateFirstWallets, mnemonics } from '../helpers/wallets'
import { linkLibs, ZeroAddress, getSig } from '../helpers/utils'
import { ChildChain, ChildERC721, RootERC721 } from '../helpers/contracts'

import LogDecoder from '../helpers/log-decoder'

// add chai pluggin
chai
  .use(chaiAsPromised)
  .use(chaiBigNumber(web3.BigNumber))
  .should()

const web3Child = new web3.constructor(
  new web3.providers.HttpProvider('http://localhost:8545')
)

contract('ChildERC721', async function(accounts) {
  let rootToken
  let childToken
  let childChain
  let tokenId
  let owner
  let logDecoder

  beforeEach(async function() {
    // link libs
    await linkLibs(web3Child)

    logDecoder = new LogDecoder([
      RootERC721._json.abi,
      ChildChain._json.abi,
      ChildERC721._json.abi
    ])
    owner = accounts[0]
    // root token / child chain
    rootToken = await RootERC721.new('Test Token', 'TEST')
    childChain = await ChildChain.new()
    // receipt
    const receipt = await childChain.addToken(
      accounts[0],
      rootToken.address,
      'test token',
      'tst',
      18,
      true
    )
    childToken = ChildERC721.at(receipt.logs[1].args.token)

    // tokenId
    tokenId = web3.toWei(11)
  })

  it('should initialize properly', async function() {
    await childToken.owner().should.eventually.equal(childChain.address)
    await childToken.token().should.eventually.equal(rootToken.address)
  })

  it('should allow to deposit', async function() {
    tokenId = tokenId + 9
    let receipt = await childChain.depositTokens(
      rootToken.address,
      owner,
      tokenId,
      11
    )
    const logs = logDecoder.decodeLogs(receipt.receipt.logs)
    logs.should.have.lengthOf(3)
    // todo: add event wise validation
  })

  it('should not allow to withdraw more than amount', async function() {
    await childToken.withdraw(web3.toWei(13)).should.be.rejected
  })

  it('should allow to withdraw mentioned amount', async function() {
    // deposit tokens
    tokenId += 1
    let rec = await childChain.depositTokens(
      rootToken.address,
      owner,
      tokenId,
      12
    )

    let logs = logDecoder.decodeLogs(rec.receipt.logs)
    logs.should.have.lengthOf(3)

    // withdraw those tokens
    const receipt = await childToken.withdraw(tokenId)

    logs = logDecoder.decodeLogs(receipt.receipt.logs)

    logs.should.have.lengthOf(2)

    logs[0].event.should.equal('Transfer')
    logs[0].args.from.toLowerCase().should.equal(owner)
    logs[0].args.to.should.equal(ZeroAddress)
    logs[0].args.tokenId.should.be.bignumber.equal(tokenId)

    logs[1].event.should.equal('Withdraw')
    logs[1].args.token.toLowerCase().should.equal(rootToken.address)
    logs[1].args.from.toLowerCase().should.equal(owner)
    logs[1].args.amountOrTokenId.should.be.bignumber.equal(tokenId)
    logs[1].args.output1.should.be.bignumber.equal(0)

    // const afterBalance = await childToken.balanceOf(owner)
    // afterBalance.should.be.bignumber.equal(0)
  })
  it('should allow transfer using sig', async function() {
    const wallets = generateFirstWallets(mnemonics, 10)
    const address1 = wallets[0].getAddressString()
    const address2 = wallets[1].getAddressString()
    const privateKey1 = wallets[0].getPrivateKeyString()
    const secret =
      '0x468fc9c005382579139846222b7b0aebc9182ba073b2455938a86d9753bfb078'
    const tokenId = 20
    // const token = await ChildERC20.new()

    // mint tokens
    await childChain.depositTokens(rootToken.address, address1, tokenId, 1, {
      from: owner
    })

    const beforeOwner = await childToken.ownerOf(tokenId)

    assert.equal(beforeOwner, address1)

    const obj1 = getSig({
      pk: privateKey1,
      spender: address2,
      secret,
      tokenId,
      token: childToken.address
    })

    const from = await childToken.getAddressFromTransferSig(
      obj1.sig,
      obj1.tokenId,
      obj1.secret,
      address2
    )

    assert.equal(from, address1)
    // transfer with sig
    await childToken.transferWithSig(
      obj1.sig,
      obj1.tokenId,
      obj1.secret,
      address2,
      {
        from: accounts[1]
      }
    )

    const afterOwner = await childToken.ownerOf(tokenId)
    assert.equal(afterOwner, address2)
  })

  it('should check true (safety check)', async function() {
    assert.isOk(true)
  })
})
