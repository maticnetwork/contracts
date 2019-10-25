import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../helpers/deployer.js'
import logDecoder from '../helpers/log-decoder.js'
import { getTransferSig } from '../helpers/marketplaceUtils'
import { generateFirstWallets, mnemonics } from '../helpers/wallets.js'
import { toChecksumAddress, assertBigNumberEquality } from '../helpers/utils.js'

const utils = require('../helpers/utils')
const crypto = require('crypto')

chai
  .use(chaiAsPromised)
  .should()

const wallets = generateFirstWallets(mnemonics, 1)
const alicePrivateKey = wallets[0].getPrivateKeyString()
const alice = toChecksumAddress(wallets[0].getAddressString())
let childContracts, erc20

contract('ChildErc20', async function(accounts) {
  beforeEach(async function() {
    childContracts = await deployer.initializeChildChain(accounts[0], { updateRegistry: false })
    erc20 = await deployer.deployChildErc20(accounts[0], { mapToken: false })
  })

  it('transfer', async function() {
    const depositAmount = web3.utils.toBN('10')
    const tokenIdOrAmount = web3.utils.toBN('3')
    await utils.deposit(null, childContracts.childChain, erc20.rootERC20, alice, depositAmount)
    const to = toChecksumAddress('0x' + crypto.randomBytes(20).toString('hex'))
    assert.strictEqual((await erc20.childToken.balanceOf(alice)).toString(), depositAmount.toString())
    assert.strictEqual((await erc20.childToken.balanceOf(to)).toString(), '0')
    const { receipt } = await erc20.childToken.transfer(to, tokenIdOrAmount, { from: alice })
    const parsedLogs = logDecoder.decodeLogs(receipt.rawLogs)
    // console.log(parsedLogs)

    assert.equal(parsedLogs[0].event, 'Transfer')
    expect(parsedLogs[0].args).to.include({ from: alice, to })
    assertBigNumberEquality(parsedLogs[0].args.value, tokenIdOrAmount)

    assert.equal(parsedLogs[1].event, 'LogTransfer')
    expect(parsedLogs[1].args).to.include({ token: toChecksumAddress(erc20.rootERC20.address), from: alice, to })
    assertBigNumberEquality(parsedLogs[1].args.amount, tokenIdOrAmount)

    assert.equal(parsedLogs[2].event, 'LogFeeTransfer')
    expect(parsedLogs[1].args).to.include({ from: alice })
  })

  it('transferWithSig', async function() {
    const depositAmount = web3.utils.toBN('10')
    await utils.deposit(null, childContracts.childChain, erc20.rootERC20, alice, depositAmount)
    const spender = accounts[1]
    const data = '0x' + crypto.randomBytes(32).toString('hex')
    const tokenIdOrAmount = web3.utils.toBN('3')
    const expiration = (await utils.web3Child.eth.getBlockNumber()) + 10
    const { sig } = getTransferSig({
      privateKey: alicePrivateKey,
      spender,
      data,
      tokenIdOrAmount,
      tokenAddress: erc20.childToken.address,
      expiration
    })
    const to = '0x' + crypto.randomBytes(20).toString('hex')
    assert.strictEqual((await erc20.childToken.balanceOf(alice)).toString(), depositAmount.toString())
    assert.strictEqual((await erc20.childToken.balanceOf(to)).toString(), '0')
    const { receipt } = await erc20.childToken.transferWithSig(sig, tokenIdOrAmount, data, expiration, to, { from: spender })
    // await utils.writeToFile('child/erc20-transferWithSig.js', receipt)
    assert.strictEqual((await erc20.childToken.balanceOf(alice)).toString(), depositAmount.sub(tokenIdOrAmount).toString())
    assert.strictEqual((await erc20.childToken.balanceOf(to)).toString(), tokenIdOrAmount.toString())
  })
})
