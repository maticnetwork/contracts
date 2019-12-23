import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../../helpers/deployer.js'
import { generateFirstWallets, mnemonics } from '../../helpers/wallets.js'
import logDecoder from '../../helpers/log-decoder.js'
import * as utils from '../../helpers/utils'

const crypto = require('crypto')

chai
  .use(chaiAsPromised)
  .should()

const wallets = generateFirstWallets(mnemonics, 1)
const alice = utils.toChecksumAddress(wallets[0].getAddressString())
const bob = utils.toChecksumAddress('0x' + crypto.randomBytes(20).toString('hex'))
const charlie = utils.toChecksumAddress('0x' + crypto.randomBytes(20).toString('hex'))

contract('SapienChildERC20', async function(accounts) {
  let childContracts, erc20
  const maticOwner = accounts[0]
  const sapienOwner = accounts[1]

  beforeEach(async function() {
    childContracts = await deployer.initializeChildChain(maticOwner, { updateRegistry: false });
    erc20 = await deployer.deploySapienChildErc20(maticOwner, { mapToken: false })
  })

  it('transfer', async function() {
    const depositAmount = web3.utils.toBN('10')
    const transferAmount = web3.utils.toBN('3')
    await utils.deposit(null, childContracts.childChain, erc20.rootERC20, alice, depositAmount)
    assert.strictEqual((await erc20.childToken.balanceOf(alice)).toString(), depositAmount.toString())
    assert.strictEqual((await erc20.childToken.balanceOf(bob)).toString(), '0')
    const { receipt } = await erc20.childToken.transfer(bob, transferAmount, { from: alice })
    const parsedLogs = logDecoder.decodeLogs(receipt.rawLogs)

    assert.equal(parsedLogs[0].event, 'Transfer')
    expect(parsedLogs[0].args).to.include({ from: alice, to: bob })
    utils.assertBigNumberEquality(parsedLogs[0].args.value, transferAmount)

    assert.equal(parsedLogs[1].event, 'LogTransfer')
    expect(parsedLogs[1].args).to.include({ token: utils.toChecksumAddress(erc20.rootERC20.address), from: alice, to: bob })
    utils.assertBigNumberEquality(parsedLogs[1].args.amount, transferAmount)

    assert.equal(parsedLogs[2].event, 'LogFeeTransfer')
    expect(parsedLogs[2].args).to.include({ from: alice })

    const aliceBalance = depositAmount.minus(transferAmount)
    assert.strictEqual((await erc20.childToken.balanceOf(alice)).toString(), aliceBalance.toString())
    const bobBalance = transferAmount
    assert.strictEqual((await erc20.childToken.balanceOf(bob)).toString(), bobBalance.toString())
  })

  it('transferBatchIdempotent - transfer to all', async function() {
    const depositToAliceAmount = web3.utils.toBN('10')
    const depositToBobAmount = web3.utils.toBN('11')
    const transferToBobAmount = web3.utils.toBN('2')
    const transferToCharlieAmount = web3.utils.toBN('3')

    await utils.deposit(null, childContracts.childChain, erc20.rootERC20, alice, depositToAliceAmount)
    await utils.deposit(null, childContracts.childChain, erc20.rootERC20, bob, depositToBobAmount)
    
    assert.strictEqual((await erc20.childToken.balanceOf(alice)).toString(), depositToAliceAmount.toString())
    assert.strictEqual((await erc20.childToken.balanceOf(bob)).toString(), depositToBobAmount.toString())
    assert.strictEqual((await erc20.childToken.balanceOf(charlie)).toString(), '0')
    
    const { receipt } = await erc20.childToken.transferBatchIdempotent(
      [ bob, charlie ], 
      [ transferToBobAmount, transferToCharlieAmount ],
      false,  // expectZero
      { from: alice })
    const parsedLogs = logDecoder.decodeLogs(receipt.rawLogs)

    assert.equal(parsedLogs[0].event, 'Transfer')
    expect(parsedLogs[0].args).to.include({ from: alice, to: bob })
    utils.assertBigNumberEquality(parsedLogs[0].args.value, transferToBobAmount)

    assert.equal(parsedLogs[1].event, 'LogTransfer')
    expect(parsedLogs[1].args).to.include({ token: utils.toChecksumAddress(erc20.rootERC20.address), from: alice, to: bob })
    utils.assertBigNumberEquality(parsedLogs[1].args.amount, transferToBobAmount)

    assert.equal(parsedLogs[2].event, 'Transfer')
    expect(parsedLogs[2].args).to.include({ from: alice, to: charlie })
    utils.assertBigNumberEquality(parsedLogs[2].args.value, transferToCharlieAmount)

    assert.equal(parsedLogs[3].event, 'LogTransfer')
    expect(parsedLogs[3].args).to.include({ token: utils.toChecksumAddress(erc20.rootERC20.address), from: alice, to: charlie })
    utils.assertBigNumberEquality(parsedLogs[3].args.amount, transferToCharlieAmount)

    assert.equal(parsedLogs[4].event, 'LogFeeTransfer')
    expect(parsedLogs[4].args).to.include({ from: alice })

    const aliceBalance = depositToAliceAmount.minus(transferToBobAmount).minus(transferToCharlieAmount)
    assert.strictEqual((await erc20.childToken.balanceOf(alice)).toString(), aliceBalance.toString())
    
    const bobBalance = depositToBobAmount.plus(transferToBobAmount)
    assert.strictEqual((await erc20.childToken.balanceOf(bob)).toString(), bobBalance.toString())
    
    const charlieBalance = transferToCharlieAmount
    assert.strictEqual((await erc20.childToken.balanceOf(bob)).toString(), charlieBalance.toString())
  })

  it('transferBatchIdempotent - transfer to non zero', async function() {
    const depositToAliceAmount = web3.utils.toBN('10')
    const depositToBobAmount = web3.utils.toBN('11')
    const transferToBobAmount = web3.utils.toBN('2')
    const transferToCharlieAmount = web3.utils.toBN('3')

    await utils.deposit(null, childContracts.childChain, erc20.rootERC20, alice, depositToAliceAmount)
    await utils.deposit(null, childContracts.childChain, erc20.rootERC20, bob, depositToBobAmount)
    
    assert.strictEqual((await erc20.childToken.balanceOf(alice)).toString(), depositToAliceAmount.toString())
    assert.strictEqual((await erc20.childToken.balanceOf(bob)).toString(), depositToBobAmount.toString())
    assert.strictEqual((await erc20.childToken.balanceOf(charlie)).toString(), '0')
    
    const { receipt } = await erc20.childToken.transferBatchIdempotent(
      [ bob, charlie ], 
      [ transferToBobAmount, transferToCharlieAmount ],
      true,  // expectZero
      { from: alice })
    const parsedLogs = logDecoder.decodeLogs(receipt.rawLogs)

    assert.equal(parsedLogs[0].event, 'Transfer')
    expect(parsedLogs[0].args).to.include({ from: alice, to: charlie })
    utils.assertBigNumberEquality(parsedLogs[0].args.value, transferToCharlieAmount)

    assert.equal(parsedLogs[1].event, 'LogTransfer')
    expect(parsedLogs[1].args).to.include({ token: utils.toChecksumAddress(erc20.rootERC20.address), from: alice, to: charlie })
    utils.assertBigNumberEquality(parsedLogs[1].args.amount, transferToCharlieAmount)

    assert.equal(parsedLogs[2].event, 'LogFeeTransfer')
    expect(parsedLogs[2].args).to.include({ from: alice })

    const aliceBalance = depositToAliceAmount.minus(transferToCharlieAmount)
    assert.strictEqual((await erc20.childToken.balanceOf(alice)).toString(), aliceBalance.toString())
    
    const bobBalance = depositToBobAmount
    assert.strictEqual((await erc20.childToken.balanceOf(bob)).toString(), bobBalance.toString())
    
    const charlieBalance = transferToCharlieAmount
    assert.strictEqual((await erc20.childToken.balanceOf(bob)).toString(), charlieBalance.toString())
  })
})
