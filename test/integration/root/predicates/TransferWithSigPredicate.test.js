import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../../../helpers/deployer.js'
import logDecoder from '../../../helpers/log-decoder.js'
import StatefulUtils from '../../../helpers/StatefulUtils'
import { generateFirstWallets, mnemonics } from '../../../helpers/wallets.js'
import { getTransferSig } from '../../../helpers/marketplaceUtils'

const utils = require('../../../helpers/utils')
const web3Child = utils.web3Child
const crypto = require('crypto')
const predicateTestUtils = require('./predicateTestUtils')

chai.use(chaiAsPromised).should()
let contracts, childContracts, statefulUtils, transferWithSigPredicate

const wallets = generateFirstWallets(mnemonics, 2)
const alicePrivateKey = wallets[0].getPrivateKeyString()
const alice = wallets[0].getAddressString()

const malloryPrivateKey = wallets[1].getPrivateKeyString()
const mallory = wallets[1].getAddressString()

contract('TransferWithSigPredicate @skip-on-coverage', async function(accounts) {
  before(async function() {
    contracts = await deployer.freshDeploy(accounts[0])
    childContracts = await deployer.initializeChildChain(accounts[0])
    await deployer.deployErc20Predicate()
    transferWithSigPredicate = await deployer.deployTransferWithSigPredicate()
    statefulUtils = new StatefulUtils()
  })

  it('startExit from incoming erc20 transferWithSig', async function() {
    const erc20 = await deployer.deployChildErc20(accounts[0])
    const depositAmount = web3.utils.toBN('10')
    // UTXO1A
    let deposit = await utils.deposit(contracts.depositManager, childContracts.childChain, erc20.rootERC20, alice, depositAmount)
    const utxo1a = { checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, deposit.receipt, accounts), logIndex: 1 }

    // setup for transferWithSig
    const spender = mallory
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
    const to = accounts[2]
    let inFlightTx = await predicateTestUtils.getRawInflightTx(
      erc20.childToken.transferWithSig.bind(null, sig, tokenIdOrAmount, data, expiration, to),
      spender /* from */, web3Child, 40000
    )

    const startExitTx = await utils.startExitForTransferWithSig(
      transferWithSigPredicate.startExitForIncomingErc20Transfer,
      [utxo1a].map(predicateTestUtils.buildInputFromCheckpoint),
      inFlightTx,
      to // exitor
    )

    let logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
    const ageOfUtxo1a = predicateTestUtils.getAge(utxo1a)
    let exitId = ageOfUtxo1a.shln(1)
    await predicateTestUtils.assertStartExit(logs[1], to, erc20.rootERC20.address, tokenIdOrAmount, false /* isRegularExit */, exitId, contracts.exitNFT)
    predicateTestUtils.assertExitUpdated(logs[2], alice, exitId, ageOfUtxo1a)
    predicateTestUtils.assertExitUpdated(logs[3], to, exitId, 0)
  })

  it('startExit from incoming erc20 transferWithSig while also referencing existing balance', async function() {
    const erc20 = await deployer.deployChildErc20(accounts[0])
    const depositAmount = web3.utils.toBN('10')
    // UTXO1A
    let deposit = await utils.deposit(contracts.depositManager, childContracts.childChain, erc20.rootERC20, alice, depositAmount)
    const utxo1a = { checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, deposit.receipt, accounts), logIndex: 1 }

    const bob = accounts[2]
    const bobDepositAmount = web3.utils.toBN('8')
    deposit = await utils.deposit(contracts.depositManager, childContracts.childChain, erc20.rootERC20, bob, bobDepositAmount)
    const utxo1b = { checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, deposit.receipt, accounts), logIndex: 1 }

    // setup for transferWithSig
    const spender = mallory
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

    let inFlightTx = await predicateTestUtils.getRawInflightTx(
      erc20.childToken.transferWithSig.bind(null, sig, tokenIdOrAmount, data, expiration, bob),
      spender /* from */, web3Child, 40000
    )

    const startExitTx = await utils.startExitForTransferWithSig(
      transferWithSigPredicate.startExitForIncomingErc20Transfer,
      [utxo1a, utxo1b].map(predicateTestUtils.buildInputFromCheckpoint),
      inFlightTx,
      bob // exitor
    )

    let logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
    const ageOfUtxo1a = predicateTestUtils.getAge(utxo1a)
    const ageOfUtxo1b = predicateTestUtils.getAge(utxo1b)
    let exitId = ageOfUtxo1b.shln(1)
    await predicateTestUtils.assertStartExit(logs[1], bob, erc20.rootERC20.address, tokenIdOrAmount.add(bobDepositAmount), false /* isRegularExit */, exitId, contracts.exitNFT)
    predicateTestUtils.assertExitUpdated(logs[2], alice, exitId, ageOfUtxo1a)
    predicateTestUtils.assertExitUpdated(logs[3], bob, exitId, ageOfUtxo1b)
  })

  it('startExit from outgoing erc20 transferWithSig', async function() {
    const erc20 = await deployer.deployChildErc20(accounts[0])
    const depositAmount = web3.utils.toBN('10')
    // UTXO1A
    let deposit = await utils.deposit(contracts.depositManager, childContracts.childChain, erc20.rootERC20, alice, depositAmount)
    const utxo1a = { checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, deposit.receipt, accounts), logIndex: 1 }

    // setup for transferWithSig
    const spender = mallory
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
    const to = accounts[2]
    let inFlightTx = await predicateTestUtils.getRawInflightTx(
      erc20.childToken.transferWithSig.bind(null, sig, tokenIdOrAmount, data, expiration, to),
      spender /* from */, web3Child, 40000
    )

    const startExitTx = await utils.startExitForTransferWithSig(
      transferWithSigPredicate.startExitForOutgoingErc20Transfer,
      [utxo1a].map(predicateTestUtils.buildInputFromCheckpoint),
      inFlightTx,
      alice // exitor
    )

    let logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
    const ageOfUtxo1a = predicateTestUtils.getAge(utxo1a)
    let exitId = ageOfUtxo1a.shln(1).or(web3.utils.toBN(1))
    await predicateTestUtils.assertStartExit(logs[1], alice, erc20.rootERC20.address, depositAmount.sub(tokenIdOrAmount), false /* isRegularExit */, exitId, contracts.exitNFT)
    predicateTestUtils.assertExitUpdated(logs[2], alice, exitId, ageOfUtxo1a)
  })
})
