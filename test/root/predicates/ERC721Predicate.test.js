import ethUtils from 'ethereumjs-util'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../../helpers/deployer.js'
import logDecoder from '../../helpers/log-decoder.js'
import { buildInFlight } from '../../mockResponses/utils'
import StatefulUtils from '../../helpers/StatefulUtils'

const predicateTestUtils = require('./predicateTestUtils')
const crypto = require('crypto')
const utils = require('../../helpers/utils')
const web3Child = utils.web3Child

chai.use(chaiAsPromised).should()
let contracts, childContracts
let predicate, statefulUtils

contract('ERC721Predicate', async function(accounts) {
  let tokenId
  const alice = accounts[0]
  const bob = accounts[1]

  before(async function() {
    contracts = await deployer.freshDeploy()
    contracts.ERC721Predicate = await deployer.deployErc721Predicate()
    childContracts = await deployer.initializeChildChain(accounts[0])
    statefulUtils = new StatefulUtils()
  })

  describe('startExitWithBurntTokens', async function() {
    beforeEach(async function() {
      contracts.ERC721Predicate = await deployer.deployErc721Predicate()
      const { rootERC721, childErc721 } = await deployer.deployChildErc721(accounts[0])
      childContracts.rootERC721 = rootERC721
      childContracts.childErc721 = childErc721
      tokenId = '0x' + crypto.randomBytes(32).toString('hex')
    })

    it('Valid exit with burnt tokens', async function() {
      await utils.deposit(
        contracts.depositManager,
        childContracts.childChain,
        childContracts.rootERC721,
        alice,
        tokenId
      )
      const { receipt } = await childContracts.childErc721.withdraw(tokenId)
      let { block, blockProof, headerNumber, reference } = await statefulUtils.submitCheckpoint(contracts.rootChain, receipt, accounts)
      const startExitTx = await utils.startExitWithBurntTokens(
        contracts.ERC721Predicate,
        { headerNumber, blockProof, blockNumber: block.number, blockTimestamp: block.timestamp, reference, logIndex: 1 }
      )
      const logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
      // console.log(startExitTx, logs)
      const log = logs[1]
      log.event.should.equal('ExitStarted')
      expect(log.args).to.include({
        exitor: alice,
        token: childContracts.rootERC721.address,
        isRegularExit: true
      })
      utils.assertBigNumberEquality(log.args.amount, tokenId)
    })
  })

  describe('startExit', async function() {
    beforeEach(async function() {
      // contracts.ERC721Predicate = await deployer.deployErc721Predicate()
      const { rootERC721, childErc721 } = await deployer.deployChildErc721(accounts[0])
      childContracts.rootERC721 = rootERC721
      childContracts.childErc721 = childErc721
      tokenId = '0x' + crypto.randomBytes(32).toString('hex')
    })

    it('reference: incomingTransfer - exitTx: burn', async function() {
      await utils.deposit(
        contracts.depositManager,
        childContracts.childChain,
        childContracts.rootERC721,
        bob,
        tokenId
      )

      const { receipt } = await childContracts.childErc721.transferFrom(bob, alice, tokenId, { from: bob })
      const { block, blockProof, headerNumber, reference } = await statefulUtils.submitCheckpoint(contracts.rootChain, receipt, accounts)

      const { receipt: r } = await childContracts.childErc721.withdraw(tokenId)
      let exitTx = await web3Child.eth.getTransaction(r.transactionHash)
      exitTx = await buildInFlight(exitTx)

      const startExitTx = await utils.startExit(contracts.ERC721Predicate, headerNumber, blockProof, block.number, block.timestamp, reference, 1, /* logIndex */ exitTx)
      const logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
      // console.log(startExitTx, logs)
      const log = logs[1]
      log.event.should.equal('ExitStarted')
      expect(log.args).to.include({
        exitor: alice,
        token: childContracts.rootERC721.address
      })
      utils.assertBigNumberEquality(log.args.amount, tokenId)
    })

    it('reference: Deposit - exitTx: burn', async function() {
      const { receipt } = await utils.deposit(null, childContracts.childChain, childContracts.rootERC721, alice, tokenId)
      const { block, blockProof, headerNumber, reference } = await statefulUtils.submitCheckpoint(contracts.rootChain, receipt, accounts)

      const { receipt: r } = await childContracts.childErc721.withdraw(tokenId)
      let exitTx = await web3Child.eth.getTransaction(r.transactionHash)
      exitTx = await buildInFlight(exitTx)

      const startExitTx = await utils.startExit(contracts.ERC721Predicate, headerNumber, blockProof, block.number, block.timestamp, reference, 1, /* logIndex */ exitTx)
      const logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
      // console.log(startExitTx, logs)
      const log = logs[1]
      log.event.should.equal('ExitStarted')
      expect(log.args).to.include({
        exitor: alice,
        token: childContracts.rootERC721.address
      })
      utils.assertBigNumberEquality(log.args.amount, tokenId)
    })

    it('reference: counterparty balance (Transfer) - exitTx: incomingTransfer', async function() {
      await utils.deposit(
        contracts.depositManager,
        childContracts.childChain,
        childContracts.rootERC721,
        alice,
        tokenId,
        { rootDeposit: true, erc721: true }
      )

      // proof of counterparty's balance
      const { receipt } = await childContracts.childErc721.transferFrom(alice, bob, tokenId)
      const { block, blockProof, headerNumber, reference } = await statefulUtils.submitCheckpoint(contracts.rootChain, receipt, accounts)

      // treating this as in-flight incomingTransfer
      const { receipt: r } = await childContracts.childErc721.transferFrom(bob, alice, tokenId, { from: bob })
      let exitTx = await web3Child.eth.getTransaction(r.transactionHash)
      exitTx = await buildInFlight(exitTx)

      const startExitTx = await utils.startExit(contracts.ERC721Predicate, headerNumber, blockProof, block.number, block.timestamp, reference, 1, /* logIndex */ exitTx)
      const logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
      // console.log(startExitTx, logs)
      const log = logs[1]
      log.event.should.equal('ExitStarted')
      expect(log.args).to.include({
        exitor: alice,
        token: childContracts.rootERC721.address
      })
      utils.assertBigNumberEquality(log.args.amount, tokenId)

      assert.strictEqual(await childContracts.rootERC721.ownerOf(tokenId), contracts.depositManager.address)
      const processExits = await predicateTestUtils.processExits(contracts.withdrawManager, childContracts.rootERC721.address)
      processExits.logs.forEach(log => {
        log.event.should.equal('Withdraw')
        expect(log.args).to.include({
          token: childContracts.rootERC721.address,
          user: alice
        })
      })
      // assert.strictEqual(await childContracts.rootERC721.ownerOf(tokenId), alice)
    })
  })

  describe('verifyDeprecation', async function() {
    beforeEach(async function() {
      const { rootERC721, childErc721 } = await deployer.deployChildErc721(accounts[0])
      childContracts.rootERC721 = rootERC721
      childContracts.childErc721 = childErc721
      tokenId = '0x' + crypto.randomBytes(32).toString('hex')
    })

    it('Mallory tries to exit a spent output', async function() {
      const alice = accounts[0]
      const mallory = accounts[1]

      // UTXO1A
      const deposit = await utils.deposit(
        contracts.depositManager,
        childContracts.childChain,
        childContracts.rootERC721,
        alice,
        tokenId
      )
      const utxo1a = { checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, deposit.receipt, accounts), logIndex: 1 }

      // Alice spends UTXO1A in tx1 to Mallory, creating UTXO1M
      const tx1 = await childContracts.childErc721.transferFrom(alice, mallory, tokenId, { from: alice })

      // Mallory spends UTXO2M in TX2
      const tx2 = await childContracts.childErc721.transferFrom(mallory, '0x' + crypto.randomBytes(20).toString('hex'), tokenId, { from: mallory })
      const spendUtxo = { checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, tx2.receipt, accounts), logIndex: 1 }

      // Mallory starts an exit from TX1 (from UTXO1M) while referencing UTXO1A and places exit bond
      let startExitTx = await utils.startExitNew(
        contracts.ERC721Predicate,
        [utxo1a].map(predicateTestUtils.buildInputFromCheckpoint), // proof-of-funds of counterparty
        await predicateTestUtils.buildInFlight(await web3Child.eth.getTransaction(tx1.receipt.transactionHash)),
        mallory // exitor
      )
      let logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
      // console.log(startExitTx, logs)
      const ageOfUtxo1a = predicateTestUtils.getAge(utxo1a)
      let exitId = ageOfUtxo1a.shln(1)
      await predicateTestUtils.assertStartExit(logs[1], mallory, childContracts.rootERC721.address, tokenId, false /* isRegularExit */, exitId, contracts.exitNFT)
      predicateTestUtils.assertExitUpdated(logs[2], alice, exitId, ageOfUtxo1a)

      // During the challenge period, the challenger reveals TX2 and receives exit bond
      const challengeData = utils.buildChallengeData(predicateTestUtils.buildInputFromCheckpoint(spendUtxo))
      // This will be used to assert that challenger received the bond amount
      const originalBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[0]))
      const challenge = await contracts.withdrawManager.challengeExit(exitId, ageOfUtxo1a.sub(web3.utils.toBN(1)), challengeData, contracts.ERC721Predicate.address)
      await predicateTestUtils.assertChallengeBondReceived(challenge, originalBalance)
      const log = challenge.logs[0]
      log.event.should.equal('ExitCancelled')
      utils.assertBigNumberEquality(log.args.exitId, exitId)
    })

    it('Alice double spends her input (eager exit fails)', async function() {
      const alice = accounts[0]
      const bob = accounts[1]

      // UTXO1A
      const deposit = await utils.deposit(
        contracts.depositManager,
        childContracts.childChain,
        childContracts.rootERC721,
        alice,
        tokenId
      )
      const utxo1a = { checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, deposit.receipt, accounts), logIndex: 1 }

      // Alice spends UTXO1A in tx1 to Bob
      // Operator begins withholding blocks while TX1 is still in-flight. Neither Alice nor Bob know if the transaction has been included in a block.
      let tx1 = await predicateTestUtils.getRawInflightTx(childContracts.childErc721.transferFrom.bind(null, alice, bob, tokenId), alice /* from */, web3Child)

      // Alice spends UTXO1A in TX2
      const tx2 = await childContracts.childErc721.transferFrom(alice, '0x' + crypto.randomBytes(20).toString('hex'), tokenId, { from: alice })
      const spendUtxo = { checkpoint: await statefulUtils.submitCheckpoint(contracts.rootChain, tx2.receipt, accounts), logIndex: 1 }

      // TX2 is included in a withheld block. TX1 is not included in a block.

      // Bob eagerly starts an exit from TX1, referencing UTXO1A and UTXO1B and places exit bond.
      const startExitTx = await utils.startExitNew(
        contracts.ERC721Predicate,
        [utxo1a].map(predicateTestUtils.buildInputFromCheckpoint), // proof-of-funds of counterparty
        tx1, // inFlightTx
        bob // exitor
      )
      let logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
      let ageOfUtxo1a = predicateTestUtils.getAge(utxo1a)
      let exitId = ageOfUtxo1a.shln(1)
      await predicateTestUtils.assertStartExit(logs[1], bob, childContracts.rootERC721.address, tokenId, false /* isRegularExit */, exitId, contracts.exitNFT)
      predicateTestUtils.assertExitUpdated(logs[2], alice, exitId, ageOfUtxo1a)

      // During the challenge period, the challenger reveals TX2 and receives exit bond
      const challengeData = utils.buildChallengeData(predicateTestUtils.buildInputFromCheckpoint(spendUtxo))
      // This will be used to assert that challenger received the bond amount
      const originalBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[0]))
      const challenge = await contracts.withdrawManager.challengeExit(exitId, ageOfUtxo1a, challengeData, contracts.ERC721Predicate.address)
      await predicateTestUtils.assertChallengeBondReceived(challenge, originalBalance)
      predicateTestUtils.assertExitCancelled(challenge.logs[0], exitId)
    })
  })

  describe('ERC721PlasmaMintable', async function() {
    beforeEach(async function() {
      predicate = await deployer.deployErc721Predicate()
      const { rootERC721, childErc721 } = await deployer.deployChildErc721Mintable()
      // add ERC721Predicate as a minter
      await rootERC721.addMinter(predicate.address)
      childContracts.rootERC721 = rootERC721
      childContracts.childErc721 = childErc721
      tokenId = '0x' + crypto.randomBytes(32).toString('hex')
    })

    it('mint and burn on the side chain', async function() {
      const { receipt: r } = await childContracts.childErc721.mint(alice, tokenId)
      let mintTx = await web3Child.eth.getTransaction(r.transactionHash)
      mintTx = await buildInFlight(mintTx)
      await childContracts.childErc721.transferFrom(alice, bob, tokenId)

      const { receipt } = await childContracts.childErc721.withdraw(tokenId, { from: bob })
      // the token doesnt exist on the root chain as yet
      expect(await childContracts.rootERC721.exists(tokenId)).to.be.false

      let { block, blockProof, headerNumber, reference } = await statefulUtils.submitCheckpoint(contracts.rootChain, receipt, accounts)
      const startExitTx = await startExitWithBurntMintableToken(
        { headerNumber, blockProof, blockNumber: block.number, blockTimestamp: block.timestamp, reference, logIndex: 1 },
        mintTx,
        bob // exitor - account to initiate the exit from
      )
      // console.log(startExitTx)
      expect(await childContracts.rootERC721.exists(tokenId)).to.be.true
      expect((await childContracts.rootERC721.ownerOf(tokenId)).toLowerCase()).to.equal(contracts.depositManager.address.toLowerCase())

      const logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
      const log = logs[1]
      log.event.should.equal('ExitStarted')
      expect(log.args).to.include({
        exitor: bob,
        token: childContracts.rootERC721.address,
        isRegularExit: true
      })
      utils.assertBigNumberEquality(log.args.amount, tokenId)
    })

    it('mint, MoreVP exit with reference: counterparty balance (Transfer) and exitTx: incomingTransfer', async function() {
      const { receipt: mint } = await childContracts.childErc721.mint(alice, tokenId)
      const mintTx = await buildInFlight(await web3Child.eth.getTransaction(mint.transactionHash))

      // proof of counterparty's balance
      const { receipt } = await childContracts.childErc721.transferFrom(alice, bob, tokenId)
      const { block, blockProof, headerNumber, reference } = await statefulUtils.submitCheckpoint(contracts.rootChain, receipt, accounts)

      // treating this as in-flight incomingTransfer
      const { receipt: r } = await childContracts.childErc721.transferFrom(bob, alice, tokenId, { from: bob })
      let exitTx = await buildInFlight(await web3Child.eth.getTransaction(r.transactionHash))

      // the token doesnt exist on the root chain as yet
      expect(await childContracts.rootERC721.exists(tokenId)).to.be.false

      const startExitTx = await startMoreVpExitWithMintableToken(
        headerNumber, blockProof, block.number, block.timestamp, reference, 1, /* logIndex */ exitTx, mintTx, alice)

      expect(await childContracts.rootERC721.exists(tokenId)).to.be.true
      expect((await childContracts.rootERC721.ownerOf(tokenId)).toLowerCase()).to.equal(contracts.depositManager.address.toLowerCase())
      const logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
      // console.log(startExitTx, logs)
      const log = logs[1]
      log.event.should.equal('ExitStarted')
      expect(log.args).to.include({
        exitor: alice,
        token: childContracts.rootERC721.address
      })
      utils.assertBigNumberEquality(log.args.amount, tokenId)
    })
  })

  describe('ERC721PlasmaMetadataMintable', async function() {
    beforeEach(async function() {
      predicate = await deployer.deployErc721Predicate()
      const { rootERC721, childErc721 } = await deployer.deployChildErc721MetadataMintable()
      // add ERC721Predicate as a minter
      await rootERC721.addMinter(predicate.address)
      childContracts.rootERC721 = rootERC721
      childContracts.childErc721 = childErc721
      tokenId = '0x' + crypto.randomBytes(32).toString('hex')
    })

    it('startExitForMintWithTokenURITokens', async function() {
      const uri = `https://tokens.com/${tokenId}`
      const { receipt: r } = await childContracts.childErc721.mintWithTokenURI(alice, tokenId, uri)
      // await utils.writeToFile('child/erc721-mintWithTokenURI.js', r)
      let mintTx = await web3Child.eth.getTransaction(r.transactionHash)
      mintTx = await buildInFlight(mintTx)
      await childContracts.childErc721.transferFrom(alice, bob, tokenId)

      const { receipt } = await childContracts.childErc721.withdraw(tokenId, { from: bob })
      // the token doesnt exist on the root chain as yet
      expect(await childContracts.rootERC721.exists(tokenId)).to.be.false

      let { block, blockProof, headerNumber, reference } = await statefulUtils.submitCheckpoint(contracts.rootChain, receipt, accounts)
      const startExitTx = await startExitForMintWithTokenURITokens(
        { headerNumber, blockProof, blockNumber: block.number, blockTimestamp: block.timestamp, reference, logIndex: 1 },
        mintTx,
        bob // exitor - account to initiate the exit from
      )
      // console.log(startExitTx)
      expect(await childContracts.rootERC721.exists(tokenId)).to.be.true
      console.log(await childContracts.rootERC721.tokenURI(tokenId))
      expect(await childContracts.rootERC721.tokenURI(tokenId)).to.equal(uri)
      expect((await childContracts.rootERC721.ownerOf(tokenId)).toLowerCase()).to.equal(contracts.depositManager.address.toLowerCase())

      const logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
      const log = logs[1]
      log.event.should.equal('ExitStarted')
      expect(log.args).to.include({
        exitor: bob,
        token: childContracts.rootERC721.address,
        isRegularExit: true
      })
      utils.assertBigNumberEquality(log.args.amount, tokenId)

      const processExits = await predicateTestUtils.processExits(contracts.withdrawManager, childContracts.rootERC721.address)
      processExits.logs.forEach(log => {
        log.event.should.equal('Withdraw')
        expect(log.args).to.include({
          token: childContracts.rootERC721.address,
          user: bob
        })
      })
      assert.strictEqual(await childContracts.rootERC721.ownerOf(tokenId), bob)
      expect(await childContracts.rootERC721.tokenURI(tokenId)).to.equal(uri)
    })
  })
})

function startExitWithBurntMintableToken(input, mintTx, from) {
  return predicate.startExitWithBurntTokens(
    ethUtils.bufferToHex(ethUtils.rlp.encode(utils.buildReferenceTxPayload(input))),
    ethUtils.bufferToHex(mintTx),
    { from }
  )
}

function startExitForMintWithTokenURITokens(input, mintTx, from) {
  return predicate.startExitForMintWithTokenURITokens(
    ethUtils.bufferToHex(ethUtils.rlp.encode(utils.buildReferenceTxPayload(input))),
    ethUtils.bufferToHex(mintTx),
    { from }
  )
}

function startMoreVpExitWithMintableToken(
  headerNumber, blockProof, blockNumber, blockTimestamp, reference, logIndex, exitTx, mintTx, from) {
  return predicate.startExitAndMint(
    ethUtils.bufferToHex(
      ethUtils.rlp.encode([
        headerNumber,
        ethUtils.bufferToHex(Buffer.concat(blockProof)),
        blockNumber,
        blockTimestamp,
        ethUtils.bufferToHex(reference.transactionsRoot),
        ethUtils.bufferToHex(reference.receiptsRoot),
        ethUtils.bufferToHex(reference.receipt),
        ethUtils.bufferToHex(ethUtils.rlp.encode(reference.receiptParentNodes)),
        ethUtils.bufferToHex(ethUtils.rlp.encode(reference.path)), // branch mask,
        logIndex
      ])
    ),
    ethUtils.bufferToHex(exitTx),
    ethUtils.bufferToHex(mintTx),
    { from, value: web3.utils.toWei('.1', 'ether') }
  )
}
