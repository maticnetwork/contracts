import ethUtils from 'ethereumjs-util'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../../../helpers/deployer.js'
import logDecoder from '../../../helpers/log-decoder.js'
import { buildInFlight } from '../../../mockResponses/utils'
import StatefulUtils from '../../../helpers/StatefulUtils'

const predicateTestUtils = require('./predicateTestUtils')
const crypto = require('crypto')
const utils = require('../../../helpers/utils')
const web3Child = utils.web3Child

chai.use(chaiAsPromised).should()
let contracts, childContracts
let predicate, statefulUtils

contract('MintableERC721Predicate @skip-on-coverage', async function(accounts) {
  let tokenId
  const alice = accounts[0]
  const bob = accounts[1]

  before(async function() {
    contracts = await deployer.freshDeploy(accounts[0])
    predicate = await deployer.deployMintableErc721Predicate()
    childContracts = await deployer.initializeChildChain(accounts[0])
    statefulUtils = new StatefulUtils()
  })

  beforeEach(async function() {
    const { rootERC721, childErc721 } = await deployer.deployChildErc721Mintable()
    // add ERC721Predicate as a minter
    await rootERC721.addMinter(predicate.address)
    childContracts.rootERC721 = rootERC721
    childContracts.childErc721 = childErc721
    tokenId = '0x' + crypto.randomBytes(32).toString('hex')
  })


  it('mint and startExitForMintableBurntTokens', async function() {
    const { receipt: r } = await childContracts.childErc721.mint(alice, tokenId)
    // await utils.writeToFile('child/erc721-mint.js', r)
    let mintTx = await web3Child.eth.getTransaction(r.transactionHash)
    mintTx = await buildInFlight(mintTx)
    await childContracts.childErc721.transferFrom(alice, bob, tokenId)

    const { receipt } = await childContracts.childErc721.withdraw(tokenId, { from: bob })
    // the token doesnt exist on the root chain as yet
    expect(await childContracts.rootERC721.exists(tokenId)).to.be.false

    let { block, blockProof, headerNumber, reference } = await statefulUtils.submitCheckpoint(contracts.rootChain, receipt, accounts)
    const startExitTx = await startExit(
      predicate.startExitForMintableBurntToken.bind(null),
      { headerNumber, blockProof, blockNumber: block.number, blockTimestamp: block.timestamp, reference, logIndex: 1 },
      mintTx,
      bob // exitor - account to initiate the exit from
    )
    let logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
    const log = logs[1]
    log.event.should.equal('ExitStarted')
    expect(log.args).to.include({
      exitor: bob,
      token: childContracts.rootERC721.address,
      isRegularExit: true
    })
    utils.assertBigNumberEquality(log.args.amount, tokenId)

    await predicateTestUtils.processExits(contracts.withdrawManager, childContracts.rootERC721.address)
    expect(await childContracts.rootERC721.exists(tokenId)).to.be.true
    expect((await childContracts.rootERC721.ownerOf(tokenId)).toLowerCase()).to.equal(bob.toLowerCase())
  })

  it('mintWithTokenURI and startExitForMetadataMintableBurntToken', async function() {
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
    const startExitTx = await startExit(
      predicate.startExitForMetadataMintableBurntToken.bind(null),
      { headerNumber, blockProof, blockNumber: block.number, blockTimestamp: block.timestamp, reference, logIndex: 1 },
      mintTx,
      bob // exitor - account to initiate the exit from
    )
    let logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
    const log = logs[1]
    log.event.should.equal('ExitStarted')
    expect(log.args).to.include({
      exitor: bob,
      token: childContracts.rootERC721.address,
      isRegularExit: true
    })
    utils.assertBigNumberEquality(log.args.amount, tokenId)

    await predicateTestUtils.processExits(contracts.withdrawManager, childContracts.rootERC721.address)
    expect(await childContracts.rootERC721.exists(tokenId)).to.be.true
    expect((await childContracts.rootERC721.ownerOf(tokenId)).toLowerCase()).to.equal(bob.toLowerCase())
    expect(await childContracts.rootERC721.tokenURI(tokenId)).to.equal(uri)
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
    // expect(await childContracts.rootERC721.exists(tokenId)).to.be.false
    const startExitTx = await startExitMoreVp(
      predicate.startExitForMintableToken.bind(null),
      { headerNumber, blockProof, blockNumber: block.number, blockTimestamp: block.timestamp, reference, logIndex: 1 },
      mintTx,
      exitTx,
      alice // exitor - account to initiate the exit from
    )

    let logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
    const log = logs[1]
    log.event.should.equal('ExitStarted')
    expect(log.args).to.include({
      exitor: alice,
      token: childContracts.rootERC721.address,
      isRegularExit: false
    })
    utils.assertBigNumberEquality(log.args.amount, tokenId)

    await predicateTestUtils.processExits(contracts.withdrawManager, childContracts.rootERC721.address)
    expect(await childContracts.rootERC721.exists(tokenId)).to.be.true
    expect((await childContracts.rootERC721.ownerOf(tokenId)).toLowerCase()).to.equal(alice.toLowerCase())
  })

  it('mintWithTokenURI, MoreVP exit with reference: counterparty balance (Transfer) and exitTx: incomingTransfer', async function() {
    const uri = `https://tokens.com/${tokenId}`
    const { receipt: mint } = await childContracts.childErc721.mintWithTokenURI(alice, tokenId, uri)
    const mintTx = await buildInFlight(await web3Child.eth.getTransaction(mint.transactionHash))

    // proof of counterparty's balance
    const { receipt } = await childContracts.childErc721.transferFrom(alice, bob, tokenId)
    const { block, blockProof, headerNumber, reference } = await statefulUtils.submitCheckpoint(contracts.rootChain, receipt, accounts)

    // treating this as in-flight incomingTransfer
    const { receipt: r } = await childContracts.childErc721.transferFrom(bob, alice, tokenId, { from: bob })
    let exitTx = await buildInFlight(await web3Child.eth.getTransaction(r.transactionHash))

    // the token doesnt exist on the root chain as yet
    // expect(await childContracts.rootERC721.exists(tokenId)).to.be.false
    const startExitTx = await startExitMoreVp(
      predicate.startExitForMetadataMintableToken.bind(null),
      { headerNumber, blockProof, blockNumber: block.number, blockTimestamp: block.timestamp, reference, logIndex: 1 },
      mintTx,
      exitTx,
      alice // exitor - account to initiate the exit from
    )

    let logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
    const log = logs[1]
    log.event.should.equal('ExitStarted')
    expect(log.args).to.include({
      exitor: alice,
      token: childContracts.rootERC721.address,
      isRegularExit: false
    })
    utils.assertBigNumberEquality(log.args.amount, tokenId)

    await predicateTestUtils.processExits(contracts.withdrawManager, childContracts.rootERC721.address)
    expect(await childContracts.rootERC721.exists(tokenId)).to.be.true
    expect((await childContracts.rootERC721.ownerOf(tokenId)).toLowerCase()).to.equal(alice.toLowerCase())
    expect(await childContracts.rootERC721.tokenURI(tokenId)).to.equal(uri)
  })

  it('mint -> startExitForMintableBurntTokens -> depositERC721 -> startExitWithBurntTokens', async function() {
    const { receipt: r } = await childContracts.childErc721.mint(alice, tokenId)
    let mintTx = await web3Child.eth.getTransaction(r.transactionHash)
    mintTx = await buildInFlight(mintTx)
    await childContracts.childErc721.transferFrom(alice, bob, tokenId)

    let withdraw = await childContracts.childErc721.withdraw(tokenId, { from: bob })
    // the token doesnt exist on the root chain as yet
    expect(await childContracts.rootERC721.exists(tokenId)).to.be.false

    let { block, blockProof, headerNumber, reference } = await statefulUtils.submitCheckpoint(contracts.rootChain, withdraw.receipt, accounts)
    let startExitTx = await startExit(
      predicate.startExitForMintableBurntToken.bind(null),
      { headerNumber, blockProof, blockNumber: block.number, blockTimestamp: block.timestamp, reference, logIndex: 1 },
      mintTx,
      bob // exitor - account to initiate the exit from
    )
    assertStartExit(startExitTx, bob, childContracts.rootERC721.address, true, tokenId)

    await predicateTestUtils.processExits(contracts.withdrawManager, childContracts.rootERC721.address)
    expect(await childContracts.rootERC721.exists(tokenId)).to.be.true
    expect((await childContracts.rootERC721.ownerOf(tokenId)).toLowerCase()).to.equal(bob.toLowerCase())

    // deposit again
    const depositManager = contracts.depositManager
    await childContracts.rootERC721.approve(depositManager.address, tokenId, { from: bob })
    const result = await depositManager.depositERC721(childContracts.rootERC721.address, tokenId, { from: bob })
    const logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    const NewDepositBlockEvent = logs.find(log => log.event === 'NewDepositBlock')
    expect((await childContracts.rootERC721.ownerOf(tokenId))).to.equal(depositManager.address)
    const deposit = await utils.fireDepositFromMainToMatic(
      childContracts.childChain,
      '0xa' /* dummy id */,
      bob,
      childContracts.rootERC721.address,
      tokenId,
      NewDepositBlockEvent.args.depositBlockId._hex
    )
    // burn and withdraw
    withdraw = await childContracts.childErc721.withdraw(tokenId, { from: bob })
    let checkpoint = await statefulUtils.submitCheckpoint(contracts.rootChain, withdraw.receipt, accounts)
    block = checkpoint.block
    startExitTx = await utils.startExitWithBurntTokens(
      await deployer.deployErc721Predicate(),
      { headerNumber: checkpoint.headerNumber, blockProof: checkpoint.blockProof, blockNumber: block.number, blockTimestamp: block.timestamp, reference: checkpoint.reference, logIndex: 1 },
      bob
    )
    assertStartExit(startExitTx, bob, childContracts.rootERC721.address, true, tokenId)
    await predicateTestUtils.processExits(contracts.withdrawManager, childContracts.rootERC721.address)
    expect((await childContracts.rootERC721.ownerOf(tokenId)).toLowerCase()).to.equal(bob.toLowerCase())
  })
})

function startExit(fn, input, mintTx, from) {
  return fn(
    ethUtils.bufferToHex(ethUtils.rlp.encode(utils.buildReferenceTxPayload(input))),
    ethUtils.bufferToHex(mintTx),
    { from }
  )
}

function startExitMoreVp(fn, input, mintTx, exitTx, from) {
  return fn(
    ethUtils.bufferToHex(ethUtils.rlp.encode(utils.buildReferenceTxPayload(input))),
    ethUtils.bufferToHex(mintTx),
    ethUtils.bufferToHex(exitTx),
    { from, value: web3.utils.toWei('.1', 'ether') }
  )
}

function assertStartExit(startExitTx, exitor, token, isRegularExit, tokenId) {
  let logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
  const log = logs[1]
  log.event.should.equal('ExitStarted')
  expect(log.args).to.include({ exitor, token, isRegularExit })
  utils.assertBigNumberEquality(log.args.amount, tokenId)
}
