import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../helpers/deployer.js'
import logDecoder from '../helpers/log-decoder.js'
import { getTransferSig } from '../helpers/marketplaceUtils'
import { generateFirstWallets, mnemonics } from '../helpers/wallets.js'
import { assertBigNumberEquality } from '../helpers/utils.js';

const utils = require('../helpers/utils')
const crypto = require('crypto')

chai
  .use(chaiAsPromised)
  .should()

const wallets = generateFirstWallets(mnemonics, 1)
const alicePrivateKey = wallets[0].getPrivateKeyString()
const alice = wallets[0].getAddressString()
let childContracts, erc20

contract('ChildErc20', async function(accounts) {
  beforeEach(async function() {
    childContracts = await deployer.initializeChildChain(accounts[0])
    erc20 = await deployer.deployChildErc20(accounts[0], { mapToken: false })
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
