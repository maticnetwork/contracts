import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBigNumber from 'chai-bignumber'
import utils from 'ethereumjs-util'

import { generateFirstWallets, mnemonics } from '../helpers/wallets'
import {
  ChildChain,
  ChildERC20,
  RootToken,
  ChildERC721,
  RootERC721,
  Marketplace
} from '../helpers/contracts'
import { linkLibs, getSig } from '../helpers/utils'
import LogDecoder from '../helpers/log-decoder'

// add chai pluggin
chai
  .use(chaiAsPromised)
  .use(chaiBigNumber(web3.BigNumber))
  .should()

const web3Child = new web3.constructor(
  new web3.providers.HttpProvider('http://localhost:8545')
)
contract('Marketplace', async function(accounts) {
  let rootToken
  let childToken
  let rootERC721
  let childERC721
  let childChain
  let marketplace
  let owner

  beforeEach(async function() {
    // link libs
    await linkLibs(web3Child)
    owner = accounts[0]

    // root token / child chain
    rootERC721 = await RootERC721.new('Test Token', 'TEST')
    childChain = await ChildChain.new()
    // receipt
    let receipt = await childChain.addToken(
      accounts[0],
      rootERC721.address,
      'test token',
      'tst',
      18,
      true
    )
    childERC721 = ChildERC721.at(receipt.logs[1].args.token)

    // root token / child chain
    rootToken = await RootToken.new('Test Token', 'TEST')
    marketplace = await Marketplace.new()
    // receipt
    receipt = await childChain.addToken(
      accounts[0],
      rootToken.address,
      'Token Test',
      'TEST',
      18,
      false
    )
    childToken = ChildERC20.at(receipt.logs[1].args.token.toLowerCase())
  })

  it('should initialize properly', async function() {
    await childToken.owner().should.eventually.equal(childChain.address)
    await childToken.token().should.eventually.equal(rootToken.address)

    await childERC721.owner().should.eventually.equal(childChain.address)
    await childERC721.token().should.eventually.equal(rootERC721.address)
  })

  it('should allow transfer using sig', async function() {
    const wallets = generateFirstWallets(mnemonics, 10)

    const privateKey1 = wallets[0].getPrivateKeyString()
    const address1 = wallets[0].getAddressString()
    const privateKey2 = wallets[1].getPrivateKeyString()
    const address2 = wallets[1].getAddressString()

    const secret1 =
      '0x468fc9c005382579139846222b7b0aebc9182ba073b2455938a86d9753bfb078'
    const secret2 =
      '0x468fc9c005382579139846222b7b0aebc9182ba073b2455938a86d9753bfb079'
    const amountOrTokenId1 = 2
    const amountOrTokenId2 = 2
    const token1 = childToken.address
    const token2 = childERC721.address
    // mint tokens
    await childChain.depositTokens(
      rootToken.address,
      address1,
      amountOrTokenId1,
      1,
      {
        from: owner
      }
    )
    await childChain.depositTokens(
      rootERC721.address,
      address2,
      amountOrTokenId2,
      2,
      {
        from: owner
      }
    )

    const beforeBalance = await childToken.balanceOf(address1)
    assert.equal(beforeBalance.toNumber(), amountOrTokenId1)

    const beforeOwner = await childERC721.ownerOf(amountOrTokenId2)
    assert.equal(beforeOwner, address2)

    // token1, tokenIdOrAmount1, keccak256(abi.encodePacked(secret1, token2, tokenIdOrAmount2)), spender
    const orderSecret1 = Buffer.concat([
      utils.toBuffer(secret1),
      utils.toBuffer(token2),
      utils.setLengthLeft(amountOrTokenId2, 32)
    ])
    const orderSecretHash1 = utils.keccak256(orderSecret1)

    const obj1 = getSig({
      pk: privateKey1,
      spender: marketplace.address,
      secret: orderSecretHash1,
      amountOrTokenId: amountOrTokenId1,
      token: token1
    })
    const orderSecret2 = Buffer.concat([
      utils.toBuffer(secret2),
      utils.toBuffer(token1),
      utils.setLengthLeft(amountOrTokenId1, 32)
    ])
    const orderSecretHash2 = utils.keccak256(orderSecret2)

    const obj2 = getSig({
      pk: privateKey2,
      spender: marketplace.address,
      secret: orderSecretHash2,
      amountOrTokenId: amountOrTokenId2,
      token: token2
    })

    const { receipt } = await marketplace.executeOrder(
      token1,
      obj1.sig,
      amountOrTokenId1,
      secret1,

      token2,
      obj2.sig,
      amountOrTokenId2,
      secret2,

      address2
    )
    const afterBalance = await childToken.balanceOf(address1)
    assert.equal(afterBalance.toNumber(), 0)

    const afterBalance1 = await childToken.balanceOf(address2)
    assert.equal(afterBalance1.toNumber(), amountOrTokenId1)

    const afterOwner = await childERC721.ownerOf(amountOrTokenId2)
    assert.equal(afterOwner, address1)
  })

  it('should check true (safety check)', async function() {
    assert.isTrue(true)
  })
})
