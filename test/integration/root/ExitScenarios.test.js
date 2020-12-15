import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../../helpers/deployer.js'
import logDecoder from '../../helpers/log-decoder.js'
import StatefulUtils from '../../helpers/StatefulUtils'
import { generateFirstWallets, mnemonics } from '../../helpers/wallets.js'
import { getSig, getTransferSig } from '../../helpers/marketplaceUtils'

const crypto = require('crypto')
const utils = require('../../helpers/utils')
const predicateTestUtils = require('./predicates/predicateTestUtils')
const web3Child = utils.web3Child

chai.use(chaiAsPromised).should()
let contracts, childContracts, rootERC20, childErc20, statefulUtils

contract('Misc Predicates tests @skip-on-coverage', async function(accounts) {
  before(async function() {
    contracts = await deployer.freshDeploy(accounts[0])
    childContracts = await deployer.initializeChildChain(accounts[0])
    statefulUtils = new StatefulUtils()
  })

  beforeEach(async function() {
    contracts.withdrawManager = await deployer.deployWithdrawManager()
    contracts.ERC20Predicate = await deployer.deployErc20Predicate()
    const e20 = await deployer.deployChildErc20(accounts[0])
    rootERC20 = e20.rootERC20
    childErc20 = e20.childToken
  })

  it('Alice starts exit and transfers the exitNft to bob', async function() {
    const alice = accounts[1]
    const bob = accounts[2]
    const aliceInitial = web3.utils.toBN('13')
    const bobInitial = web3.utils.toBN('0')
    const aliceToBobtransferAmount = web3.utils.toBN('7')
    let deposit = await utils.deposit(
      contracts.depositManager,
      childContracts.childChain,
      rootERC20,
      alice,
      aliceInitial,
      { rootDeposit: true, erc20: true }
    )
    const utxo1a = { checkpoint: await statefulUtils.submitCheckpoint(
      contracts.rootChain, deposit.receipt, accounts), logIndex: 1 }
    let inFlightTx = await predicateTestUtils.getRawInflightTx(
      childErc20.transfer.bind(
        null, bob, aliceToBobtransferAmount), alice /* from */, web3Child)
    // Alice starts an exit
    await utils.startExitForErc20Predicate(
      contracts.ERC20Predicate.startExitForOutgoingErc20Transfer,
      [utxo1a].map(predicateTestUtils.buildInputFromCheckpoint),
      inFlightTx,
      alice // exitor
    )
    // let logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
    const ageOfUtxo1a = predicateTestUtils.getAge(utxo1a)
    // last bit is to differentiate whether the sender or receiver of the in-flight tx is starting an exit
    let exitId = ageOfUtxo1a.shln(1).or(web3.utils.toBN(1))
    // await predicateTestUtils.assertStartExit(
    //   logs[1], alice, rootERC20.address, aliceInitial.sub(
    //     aliceToBobtransferAmount), false /* isRegularExit */, exitId, contracts.exitNFT)
    // predicateTestUtils.assertExitUpdated(logs[2], alice, exitId, ageOfUtxo1a)
    await contracts.exitNFT.transferFrom(alice, bob, exitId, { from: alice })
    await predicateTestUtils.processExits(contracts.withdrawManager, rootERC20.address)
    assert.strictEqual((await rootERC20.balanceOf(bob)).toString(), aliceInitial.sub(aliceToBobtransferAmount).toString())
  })

  it('Alice & Bob are honest and cooperating', async function() {
    const alice = accounts[1]
    const bob = accounts[2]
    const aliceInitial = web3.utils.toBN('13')
    const bobInitial = web3.utils.toBN('9')
    const aliceToBobtransferAmount = web3.utils.toBN('7')

    // Utxo1B
    let deposit = await utils.deposit(
      contracts.depositManager,
      childContracts.childChain,
      rootERC20,
      bob,
      bobInitial,
      { rootDeposit: true, erc20: true }
    )
    const utxo1b = { checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, deposit.receipt, accounts), logIndex: 1 }

    // Utxo1a
    deposit = await utils.deposit(
      contracts.depositManager,
      childContracts.childChain,
      rootERC20,
      alice,
      aliceInitial,
      { rootDeposit: true, erc20: true }
    )
    const utxo1a = { checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, deposit.receipt, accounts), logIndex: 1 }

    let inFlightTx = await predicateTestUtils.getRawInflightTx(childErc20.transfer.bind(null, bob, aliceToBobtransferAmount), alice /* from */, web3Child)

    // Alice starts an exit
    let startExitTx = await utils.startExitForErc20Predicate(
      contracts.ERC20Predicate.startExitForOutgoingErc20Transfer,
      [utxo1a].map(predicateTestUtils.buildInputFromCheckpoint),
      inFlightTx,
      alice // exitor
    )
    let logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
    const ageOfUtxo1a = predicateTestUtils.getAge(utxo1a)
    // last bit is to differentiate whether the sender or receiver of the in-flight tx is starting an exit
    let exitId = ageOfUtxo1a.shln(1).or(web3.utils.toBN(1))
    await predicateTestUtils.assertStartExit(logs[1], alice, rootERC20.address, aliceInitial.sub(aliceToBobtransferAmount), false /* isRegularExit */, exitId, contracts.exitNFT)
    predicateTestUtils.assertExitUpdated(logs[2], alice, exitId, ageOfUtxo1a)

    // Bob starts an exit
    startExitTx = await utils.startExitForErc20Predicate(
      contracts.ERC20Predicate.startExitForIncomingErc20Transfer,
      // utxo1a is a proof-of-funds of counterparty and utxo1b is a proof-of-funds (that already existed on-chain) of the exitor
      [utxo1a, utxo1b].map(predicateTestUtils.buildInputFromCheckpoint),
      inFlightTx,
      bob // exitor
    )
    logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
    // exitId is the "age of the youngest input" which is derived from utxo1a since it came after utxo1b
    exitId = exitId = ageOfUtxo1a.shln(1)
    await predicateTestUtils.assertStartExit(logs[1], bob, rootERC20.address, bobInitial.add(aliceToBobtransferAmount), false /* isRegularExit */, exitId, contracts.exitNFT)
    predicateTestUtils.assertExitUpdated(logs[2], alice, exitId, ageOfUtxo1a)
    predicateTestUtils.assertExitUpdated(logs[3], bob, exitId, predicateTestUtils.getAge(utxo1b))

    assert.strictEqual((await rootERC20.balanceOf(alice)).toString(), '0')
    assert.strictEqual((await rootERC20.balanceOf(bob)).toString(), '0')
    const processExits = await predicateTestUtils.processExits(contracts.withdrawManager, rootERC20.address)
    processExits.logs.forEach(log => {
      log.event.should.equal('Withdraw')
      expect(log.args).to.include({ token: rootERC20.address })
    })
    assert.strictEqual((await rootERC20.balanceOf(alice)).toString(), aliceInitial.sub(aliceToBobtransferAmount).toString())
    assert.strictEqual((await rootERC20.balanceOf(bob)).toString(), bobInitial.add(aliceToBobtransferAmount).toString())
  })

  it('Mallory tries to exit a spent output', async function() {
    const alice = accounts[0]
    const mallory = accounts[1]
    const aliceInitial = web3.utils.toBN('13')
    const aliceToMalloryTransferAmount = web3.utils.toBN('7')

    // UTXO1A
    let deposit = await utils.deposit(
      contracts.depositManager,
      childContracts.childChain,
      rootERC20,
      alice,
      aliceInitial
    )
    const utxo1a = { checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, deposit.receipt, accounts), logIndex: 1 }

    // Alice spends UTXO1A in tx1 to Mallory, creating UTXO2M (and UTXO2A)
    const tx1 = await childErc20.transfer(mallory, aliceToMalloryTransferAmount, { from: alice })

    // Mallory spends UTXO2M in TX2 creating UTXO3M
    const tx2 = await childErc20.transfer('0x' + crypto.randomBytes(20).toString('hex'), web3.utils.toBN('5'), { from: mallory })
    const utxo3m = { checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, tx2.receipt, accounts), logIndex: 1 }

    // Mallory starts an exit from TX1 (from UTXO2M) while referencing UTXO1A and places exit bond
    let startExitTx = await utils.startExitForErc20Predicate(
      contracts.ERC20Predicate.startExitForIncomingErc20Transfer,
      [utxo1a].map(predicateTestUtils.buildInputFromCheckpoint), // proof-of-funds of counterparty
      await predicateTestUtils.buildInFlight(await web3Child.eth.getTransaction(tx1.receipt.transactionHash)),
      mallory // exitor
    )
    let logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
    const ageOfUtxo1a = predicateTestUtils.getAge(utxo1a)
    let exitId = ageOfUtxo1a.shln(1)
    await predicateTestUtils.assertStartExit(logs[1], mallory, rootERC20.address, aliceToMalloryTransferAmount, false /* isRegularExit */, exitId, contracts.exitNFT)
    predicateTestUtils.assertExitUpdated(logs[2], alice, exitId, ageOfUtxo1a)

    // During the challenge period, the challenger reveals TX2 and receives exit bond
    const challengeData = utils.buildChallengeData(predicateTestUtils.buildInputFromCheckpoint(utxo3m))
    // This will be used to assert that challenger received the bond amount
    const originalBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[0]))
    const challenge = await contracts.withdrawManager.challengeExit(exitId, 0, challengeData, contracts.ERC20Predicate.address)
    await predicateTestUtils.assertChallengeBondReceived(challenge, originalBalance)
    predicateTestUtils.assertExitCancelled(challenge.logs[0], exitId)
  })

  it('Alice double spends her input (eager exit fails)', async function() {
    const alice = accounts[0]
    const bob = accounts[1]
    const aliceInitial = web3.utils.toBN('13')
    const bobInitial = web3.utils.toBN('9')
    const aliceToBobTransferAmount = web3.utils.toBN('7')

    // UTXO1A
    let deposit = await utils.deposit(
      contracts.depositManager,
      childContracts.childChain,
      rootERC20,
      alice,
      aliceInitial
    )
    const utxo1a = { checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, deposit.receipt, accounts), logIndex: 1 }

    // Utxo1B
    deposit = await utils.deposit(
      contracts.depositManager,
      childContracts.childChain,
      rootERC20,
      bob,
      bobInitial
    )
    const utxo1b = { checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, deposit.receipt, accounts), logIndex: 1 }

    // Alice spends UTXO1A in tx1 to Bob, creating UTXO2B (and UTXO2A)
    // Operator begins withholding blocks while TX1 is still in-flight. Neither Alice nor Bob know if the transaction has been included in a block.
    let tx1 = await predicateTestUtils.getRawInflightTx(childErc20.transfer.bind(null, bob, aliceToBobTransferAmount), alice /* from */, web3Child)

    // Alice spends UTXO1A in TX2 creating _utxo2A
    const tx2 = await childErc20.transfer('0x' + crypto.randomBytes(20).toString('hex'), web3.utils.toBN('10'), { from: alice })
    const _utxo2A = { checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, tx2.receipt, accounts), logIndex: 1 }

    // TX2 is included in a withheld block. TX1 is not included in a block.

    // Bob eagerly starts an exit from TX1, referencing UTXO1A and UTXO1B and places exit bond.
    const startExitTx = await utils.startExitForErc20Predicate(
      contracts.ERC20Predicate.startExitForIncomingErc20Transfer,
      // utxo1a is a proof-of-funds of counterparty and utxo1b is a proof-of-funds (that already existed on-chain) of the exitor
      [utxo1a, utxo1b].map(predicateTestUtils.buildInputFromCheckpoint),
      tx1, // inFlightTx
      bob // exitor
    )
    let logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
    let ageOfUtxo1a = predicateTestUtils.getAge(utxo1a)
    let ageOfUtxo1b = predicateTestUtils.getAge(utxo1b)
    // exitId is the "age of the youngest input" which is derived from utxo1a since it came after utxo1b
    let exitId = ageOfUtxo1b.shln(1)
    await predicateTestUtils.assertStartExit(logs[1], bob, rootERC20.address, bobInitial.add(aliceToBobTransferAmount), false /* isRegularExit */, exitId, contracts.exitNFT)
    predicateTestUtils.assertExitUpdated(logs[2], alice, exitId, ageOfUtxo1a)
    predicateTestUtils.assertExitUpdated(logs[3], bob, exitId, ageOfUtxo1b)

    // During the challenge period, the challenger reveals TX2 and receives exit bond
    const challengeData = utils.buildChallengeData(predicateTestUtils.buildInputFromCheckpoint(_utxo2A))
    // This will be used to assert that challenger received the bond amount
    const originalBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[0]))
    const challenge = await contracts.withdrawManager.challengeExit(exitId, ageOfUtxo1a, challengeData, contracts.ERC20Predicate.address)
    await predicateTestUtils.assertChallengeBondReceived(challenge, originalBalance)
    predicateTestUtils.assertExitCancelled(challenge.logs[0], exitId)
  })

  it('Alice double spends her inputs and both of these transactions are checkpointed', async function() {
    const alice = accounts[0]
    const bob = accounts[1]
    const aliceInitial = web3.utils.toBN('13')

    // UTXO1A
    let deposit = await utils.deposit(
      contracts.depositManager,
      childContracts.childChain,
      rootERC20,
      alice,
      aliceInitial
    )
    const utxo1a = { checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, deposit.receipt, accounts), logIndex: 1 }

    // Alice spends UTXO1A in tx1 to Bob, creating UTXO2A
    // Operator begins withholding blocks while TX1 is still in-flight. Neither Alice nor Bob know if the transaction has been included in a block.
    let tx1 = await childErc20.transfer(bob, web3.utils.toBN('5'), { from: alice })
    const utxo2A = { checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, tx1.receipt, accounts), logIndex: 1 }

    // Alice spends UTXO1A in TX2 creating _utxo2A
    const tx2 = await childErc20.transfer('0x' + crypto.randomBytes(20).toString('hex'), web3.utils.toBN('6'), { from: alice })
    const _utxo2A = { checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, tx2.receipt, accounts), logIndex: 1 }

    // Both tx1 and tx2 are checkpointed

    // Alice starts an exit from TX2, referencing UTXO1A
    const startExitTx = await utils.startExitForErc20Predicate(
      contracts.ERC20Predicate.startExitForOutgoingErc20Transfer,
      // utxo1a is a proof-of-funds of counterparty and utxo1b is a proof-of-funds (that already existed on-chain) of the exitor
      [utxo1a].map(predicateTestUtils.buildInputFromCheckpoint),
      await predicateTestUtils.buildInFlight(await web3Child.eth.getTransaction(tx2.receipt.transactionHash)),
      alice // exitor
    )
    let logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
    let ageOfUtxo1a = predicateTestUtils.getAge(utxo1a)
    let exitId = ageOfUtxo1a.shln(1).or(web3.utils.toBN(1))
    await predicateTestUtils.assertStartExit(logs[1], alice, rootERC20.address, aliceInitial.sub(web3.utils.toBN('6')), false /* isRegularExit */, exitId, contracts.exitNFT)
    predicateTestUtils.assertExitUpdated(logs[2], alice, exitId, ageOfUtxo1a)

    // challenging with the exit tx itself should fail
    try {
      const challengeData = utils.buildChallengeData(predicateTestUtils.buildInputFromCheckpoint(_utxo2A))
      await contracts.withdrawManager.challengeExit(exitId, ageOfUtxo1a, challengeData, contracts.ERC20Predicate.address)
      assert.fail('Challenge should have failed')
    } catch(e) {
      assert.strictEqual(e.reason, 'Cannot challenge with the exit tx')
    }

    // During the challenge period, the challenger reveals TX2 and receives exit bond
    const challengeData = utils.buildChallengeData(predicateTestUtils.buildInputFromCheckpoint(utxo2A))
    // This will be used to assert that challenger received the bond amount
    const originalBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[0]))
    const challenge = await contracts.withdrawManager.challengeExit(exitId, ageOfUtxo1a, challengeData, contracts.ERC20Predicate.address)
    await predicateTestUtils.assertChallengeBondReceived(challenge, originalBalance)
    predicateTestUtils.assertExitCancelled(challenge.logs[0], exitId)
  })

  describe('Mallory is challenged with a marketplace tx', async function() {
    let privateKey1, alice, privateKey2, mallory, marketplacePredicate, marketplace
    before(async function() {
      const stakes = {
        1: web3.utils.toWei('101'),
        2: web3.utils.toWei('100'),
        3: web3.utils.toWei('100'),
        4: web3.utils.toWei('100')
      }
      const wallets = generateFirstWallets(mnemonics, Object.keys(stakes).length)

      privateKey1 = wallets[0].getPrivateKeyString()
      alice = wallets[0].getAddressString()

      privateKey2 = wallets[1].getPrivateKeyString()
      mallory = wallets[1].getAddressString()

      marketplacePredicate = await deployer.deployMarketplacePredicate()
      marketplace = await deployer.deployMarketplace()
    })

    it('erc20/20 swap', async function() {
      // setup tokens and predicate
      const erc20 = await deployer.deployChildErc20(accounts[0])
      const token1 = erc20.childToken
      const otherErc20 = await deployer.deployChildErc20(accounts[0])
      const token2 = otherErc20.childToken

      // These are the amounts that will be used in Marketplace.executeOrder
      const amount1 = web3.utils.toBN('3')
      const amount2 = web3.utils.toBN('7')

      // UTXO1A
      let deposit = await utils.deposit(
        contracts.depositManager,
        childContracts.childChain,
        otherErc20.rootERC20,
        alice,
        web3.utils.toBN('13')
      )
      const utxo1a = { checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, deposit.receipt, accounts), logIndex: 1 }

      // Alice spends UTXO1A in tx1 to Mallory, creating UTXO2M (and UTXO2A)
      const tx1 = await token2.transfer(mallory, amount2, { from: alice })

      // Mallory starts an exit from TX1 (from UTXO2M) while referencing UTXO1A and places exit bond
      let startExitTx = await utils.startExitForErc20Predicate(
        contracts.ERC20Predicate.startExitForIncomingErc20Transfer,
        [utxo1a].map(predicateTestUtils.buildInputFromCheckpoint), // proof-of-funds of counterparty
        await predicateTestUtils.buildInFlight(await web3Child.eth.getTransaction(tx1.receipt.transactionHash)),
        mallory // exitor
      )
      let logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
      const ageOfUtxo1a = predicateTestUtils.getAge(utxo1a)
      let exitId = ageOfUtxo1a.shln(1)
      await predicateTestUtils.assertStartExit(logs[1], mallory, otherErc20.rootERC20.address, amount2, false /* isRegularExit */, exitId, contracts.exitNFT)
      predicateTestUtils.assertExitUpdated(logs[2], alice, exitId, ageOfUtxo1a)

      // setup for marketplace swap
      const depositAmount = amount1.add(web3.utils.toBN('1'))
      // deposit tokens of another type for a 3rd party (re-using alice here, but not necessary)
      await utils.deposit(null, childContracts.childChain, erc20.rootERC20, alice, depositAmount)

      assert.equal((await token1.balanceOf(alice)).toNumber(), depositAmount)
      assert.equal((await token2.balanceOf(mallory)).toNumber(), amount2)

      const orderId = '0x' + crypto.randomBytes(32).toString('hex')
      // get expiration in future in 10 blocks
      const expiration = (await utils.web3Child.eth.getBlockNumber()) + 10
      // Alice's sig on marketplace order
      const obj1 = getSig({
        privateKey: privateKey1,
        spender: marketplace.address,
        orderId: orderId,
        expiration: expiration,

        token1: token1.address,
        amount1: amount1,
        token2: token2.address,
        amount2: amount2
      })
      // Mallory's sig on marketplace order
      const obj2 = getSig({
        privateKey: privateKey2,
        spender: marketplace.address,
        orderId: orderId,
        expiration: expiration,

        token2: token1.address,
        amount2: amount1,
        token1: token2.address,
        amount1: amount2
      })
      const tx2 = await marketplace.executeOrder(
        encode(token1.address, obj1.sig, amount1),
        encode(token2.address, obj2.sig, amount2),
        orderId,
        expiration,
        mallory
      )
      // logIndex = 3 because token2 was the second token transfer in executeOrder
      const utxo3m = { checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, tx2.receipt, accounts), logIndex: 3 }

      // During the challenge period, the challenger reveals TX2 and receives exit bond
      const challengeData = utils.buildChallengeData(predicateTestUtils.buildInputFromCheckpoint(utxo3m))
      // This will be used to assert that challenger received the bond amount
      const originalBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[0]))
      const challenge = await contracts.withdrawManager.challengeExit(exitId, 0, challengeData, marketplacePredicate.address)
      await predicateTestUtils.assertChallengeBondReceived(challenge, originalBalance)
      predicateTestUtils.assertExitCancelled(challenge.logs[0], exitId)
    })

    it('erc20/721 swap', async function() {
      const amount1 = web3.utils.toBN('10')
      const tokenId = web3.utils.toBN('789')

      const erc20 = await deployer.deployChildErc20(accounts[0])
      const token1 = erc20.childToken
      const erc721 = await deployer.deployChildErc721(accounts[0])
      const token2 = erc721.childErc721

      let deposit = await utils.deposit(
        contracts.depositManager,
        childContracts.childChain,
        erc721.rootERC721,
        alice,
        tokenId
      )
      const utxo1a = { checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, deposit.receipt, accounts), logIndex: 1 }

      const tx1 = await token2.transferFrom(alice, mallory, tokenId, { from: alice })
      const ERC721Predicate = await deployer.deployErc721Predicate()
      const startExitTx = await utils.startExitNew(
        ERC721Predicate,
        [utxo1a].map(predicateTestUtils.buildInputFromCheckpoint), // proof-of-funds of counterparty
        await predicateTestUtils.buildInFlight(await web3Child.eth.getTransaction(tx1.receipt.transactionHash)),
        mallory // exitor
      )
      let logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
      let ageOfUtxo1a = predicateTestUtils.getAge(utxo1a)
      let exitId = ageOfUtxo1a.shln(1)
      await predicateTestUtils.assertStartExit(logs[1], mallory, erc721.rootERC721.address, tokenId, false /* isRegularExit */, exitId, contracts.exitNFT)
      predicateTestUtils.assertExitUpdated(logs[2], alice, exitId, ageOfUtxo1a)

      deposit = await utils.deposit(
        contracts.depositManager,
        childContracts.childChain,
        erc20.rootERC20,
        alice,
        amount1
      )

      assert.equal((await token1.balanceOf(alice)).toNumber(), amount1)
      assert.equal((await token2.ownerOf(tokenId)).toLowerCase(), mallory.toLowerCase())

      const orderId = '0x' + crypto.randomBytes(32).toString('hex')
      // get expiration in future in 10 blocks
      const expiration = (await utils.web3Child.eth.getBlockNumber()) + 10
      const obj1 = getSig({
        privateKey: privateKey1,
        spender: marketplace.address,
        orderId: orderId,
        expiration: expiration,

        token1: token1.address,
        amount1: amount1,
        token2: token2.address,
        amount2: tokenId
      })
      const obj2 = getSig({
        privateKey: privateKey2,
        spender: marketplace.address,
        orderId: orderId,
        expiration: expiration,

        token2: token1.address,
        amount2: amount1,
        token1: token2.address,
        amount1: tokenId
      })
      const tx2 = await marketplace.executeOrder(
        encode(token1.address, obj1.sig, amount1),
        encode(token2.address, obj2.sig, tokenId),
        orderId,
        expiration,
        mallory
      )
      // logIndex = 3 because token2 was the second token transfer in executeOrder
      const utxo3m = { checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, tx2.receipt, accounts), logIndex: 3 }

      // During the challenge period, the challenger reveals TX2 and receives exit bond
      const challengeData = utils.buildChallengeData(predicateTestUtils.buildInputFromCheckpoint(utxo3m))
      // This will be used to assert that challenger received the bond amount
      const originalBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[0]))
      const challenge = await contracts.withdrawManager.challengeExit(exitId, ageOfUtxo1a.sub(web3.utils.toBN(1)), challengeData, marketplacePredicate.address)
      await predicateTestUtils.assertChallengeBondReceived(challenge, originalBalance)
      predicateTestUtils.assertExitCancelled(challenge.logs[0], exitId)
    })
  })

  describe('Challenge with transferWithSig tx', async function() {
    let alicePrivateKey, alice, malloryPrivateKey, mallory, transferWithSigPredicate
    before(async function() {
      const wallets = generateFirstWallets(mnemonics, 2)

      alicePrivateKey = wallets[0].getPrivateKeyString()
      alice = wallets[0].getAddressString()

      malloryPrivateKey = wallets[1].getPrivateKeyString()
      mallory = wallets[1].getAddressString()

      transferWithSigPredicate = await deployer.deployTransferWithSigPredicate()
    })

    it('exit became stale because erc20 transferWithSig is executed', async function() {
      const erc20 = await deployer.deployChildErc20(accounts[0])
      const depositAmount = web3.utils.toBN('10')
      // UTXO1A
      let deposit = await utils.deposit(contracts.depositManager, childContracts.childChain, erc20.rootERC20, alice, depositAmount)
      const utxo1a = { checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, deposit.receipt, accounts), logIndex: 1 }

      // Alice spends UTXO1A in tx1 to Mallory, creating UTXO2M (and UTXO2A)
      const transferAmount = web3.utils.toBN('3')
      const tx1 = await erc20.childToken.transfer(mallory, transferAmount, { from: alice })

      // Mallory starts an exit from TX1 (from UTXO2M) while referencing UTXO1A and places exit bond
      let startExitTx = await utils.startExitForErc20Predicate(
        contracts.ERC20Predicate.startExitForIncomingErc20Transfer,
        [utxo1a].map(predicateTestUtils.buildInputFromCheckpoint), // proof-of-funds of counterparty
        await predicateTestUtils.buildInFlight(await web3Child.eth.getTransaction(tx1.receipt.transactionHash)),
        mallory // exitor
      )
      let logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
      const ageOfUtxo1a = predicateTestUtils.getAge(utxo1a)
      let exitId = ageOfUtxo1a.shln(1)
      await predicateTestUtils.assertStartExit(logs[1], mallory, erc20.rootERC20.address, transferAmount, false /* isRegularExit */, exitId, contracts.exitNFT)
      predicateTestUtils.assertExitUpdated(logs[2], alice, exitId, ageOfUtxo1a)
      predicateTestUtils.assertExitUpdated(logs[3], mallory, exitId, 0)

      // setup for transferWithSig
      const spender = alice
      const data = '0x' + crypto.randomBytes(32).toString('hex')
      const tokenIdOrAmount = web3.utils.toBN('1')
      const expiration = (await utils.web3Child.eth.getBlockNumber()) + 10
      const { sig } = getTransferSig({
        privateKey: malloryPrivateKey,
        spender,
        data,
        tokenIdOrAmount,
        tokenAddress: erc20.childToken.address,
        expiration
      })
      const to = '0x' + crypto.randomBytes(20).toString('hex')
      // Mallory spends in tx2, creating UTXO3M
      const tx2 = await erc20.childToken.transferWithSig(sig, tokenIdOrAmount, data, expiration, to, { from: spender })
      const utxo3m = { checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, tx2.receipt, accounts), logIndex: 1 }

      // During the challenge period, the challenger reveals TX2 and receives exit bond
      const challengeData = utils.buildChallengeData(predicateTestUtils.buildInputFromCheckpoint(utxo3m))
      // This will be used to assert that challenger received the bond amount
      const originalBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[0]))
      const challenge = await contracts.withdrawManager.challengeExit(exitId, 0, challengeData, transferWithSigPredicate.address)
      await predicateTestUtils.assertChallengeBondReceived(challenge, originalBalance)
      predicateTestUtils.assertExitCancelled(challenge.logs[0], exitId)
    })

    it('exit became stale because erc721 transferWithSig is executed', async function() {
      contracts.ERC721Predicate = await deployer.deployErc721Predicate()
      const erc721 = await deployer.deployChildErc721(accounts[0])
      const tokenId = '0x' + crypto.randomBytes(32).toString('hex')
      // UTXO1A
      let deposit = await utils.deposit(contracts.depositManager, childContracts.childChain, erc721.rootERC721, alice, tokenId)
      const utxo1a = { checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, deposit.receipt, accounts), logIndex: 1 }

      // Alice spends UTXO1A in tx1 to Mallory
      const tx1 = await erc721.childErc721.transferFrom(alice, mallory, tokenId, { from: alice })

      // Mallory starts an exit from TX1 while referencing UTXO1A and places exit bond
      let startExitTx = await utils.startExitNew(
        contracts.ERC721Predicate,
        [utxo1a].map(predicateTestUtils.buildInputFromCheckpoint), // proof-of-funds of counterparty
        await predicateTestUtils.buildInFlight(await web3Child.eth.getTransaction(tx1.receipt.transactionHash)),
        mallory // exitor
      )
      let logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
      const ageOfUtxo1a = predicateTestUtils.getAge(utxo1a)
      let exitId = ageOfUtxo1a.shln(1)
      await predicateTestUtils.assertStartExit(logs[1], mallory, erc721.rootERC721.address, tokenId, false /* isRegularExit */, exitId, contracts.exitNFT)
      predicateTestUtils.assertExitUpdated(logs[2], alice, exitId, ageOfUtxo1a)
      predicateTestUtils.assertExitUpdated(logs[3], mallory, exitId, ageOfUtxo1a.sub(web3.utils.toBN(1)))

      // setup for transferWithSig
      const spender = alice
      const data = '0x' + crypto.randomBytes(32).toString('hex')
      const expiration = (await utils.web3Child.eth.getBlockNumber()) + 10
      const { sig } = getTransferSig({
        privateKey: malloryPrivateKey,
        spender,
        data,
        tokenIdOrAmount: tokenId,
        tokenAddress: erc721.childErc721.address,
        expiration
      })
      const to = '0x' + crypto.randomBytes(20).toString('hex')
      // Mallory spends in tx2, creating UTXO3M
      const tx2 = await erc721.childErc721.transferWithSig(sig, tokenId, data, expiration, to, { from: spender })
      const utxo3m = { checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, tx2.receipt, accounts), logIndex: 1 }

      // During the challenge period, the challenger reveals TX2 and receives exit bond
      const challengeData = utils.buildChallengeData(predicateTestUtils.buildInputFromCheckpoint(utxo3m))
      // This will be used to assert that challenger received the bond amount
      const originalBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[0]))
      const challenge = await contracts.withdrawManager.challengeExit(exitId, ageOfUtxo1a.sub(web3.utils.toBN(1)), challengeData, transferWithSigPredicate.address)
      await predicateTestUtils.assertChallengeBondReceived(challenge, originalBalance)
      predicateTestUtils.assertExitCancelled(challenge.logs[0], exitId)
    })
  })
})

function encode(token, sig, tokenIdOrAmount) {
  return web3.eth.abi.encodeParameters(
    ['address', 'bytes', 'uint256'],
    [token, sig, '0x' + tokenIdOrAmount.toString(16)]
  )
}
