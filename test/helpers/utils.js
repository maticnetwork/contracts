/* global web3 */

import utils from 'ethereumjs-util'
import { Buffer } from 'safe-buffer'
import encode from 'ethereumjs-abi'
import fs from 'fs'
import path from 'path'

import { generateFirstWallets, mnemonics } from './wallets.js'

const crypto = require('crypto')
const BN = utils.BN
const rlp = utils.rlp

export const web3Child = new web3.constructor(
  new web3.providers.HttpProvider('http://localhost:8546')
)

export const ZeroAddress = '0x0000000000000000000000000000000000000000'

export function getSigs(wallets, votedata) {
  wallets.sort((w1, w2) => {
    return w1.getAddressString().localeCompare(w2.getAddressString())
  })

  const h = utils.toBuffer(votedata)

  return wallets
    .map(w => {
      const vrs = utils.ecsign(h, w.getPrivateKey())
      return utils.toRpcSig(vrs.v, vrs.r, vrs.s)
    })
    .filter(d => d)
}

export function encodeSigs(sigs = []) {
  return Buffer.concat(sigs.map(s => utils.toBuffer(s)))
}

export function assertBigNumberEquality(num1, num2) {
  if (!BN.isBN(num1)) num1 = web3.utils.toBN(num1.toString())
  if (!BN.isBN(num2)) num2 = web3.utils.toBN(num2)
  expect(num1.eq(num2)).to.be.true
}

export function assertBigNumbergt(num1, num2) {
  expect(num1.gt(web3.utils.toBN(num2))).to.be.true;
  // num1.should.be.bignumber.greaterThan(num2)
}

export function buildSubmitHeaderBlockPaylod(proposer, start, end, root, wallets) {
  if (!root) root = utils.keccak256(encode(start, end)) // dummy root
  // [proposer, start, end, root]
  const extraData = utils.bufferToHex(utils.rlp.encode([proposer, start, end, root]))
  const vote = utils.bufferToHex(
    // [chain, roundType, height, round, voteType, keccak256(bytes20(sha256(extraData)))]
    utils.rlp.encode([
      'test-chain-E5igIA', 'vote', 0, 0, 2,
      utils.bufferToHex(utils.sha256(extraData)).slice(0, 42)
    ])
  )

  if (!wallets) {
    wallets = getWallets()
  }
  const validators = [wallets[1], wallets[2], wallets[3]]

  const sigs = utils.bufferToHex(
    encodeSigs(getSigs(validators, utils.keccak256(vote)))
  )
  return {vote, sigs, extraData, root}
}

export function getWallets() {
  const stakes = {
    1: web3.utils.toWei('101'),
    2: web3.utils.toWei('100'),
    3: web3.utils.toWei('100'),
    4: web3.utils.toWei('100')
  }
  return generateFirstWallets(mnemonics, Object.keys(stakes).length)
}

export async function deposit(depositManager, childChain, rootContract, user, amount, options = { rootDeposit: false }) {
  let depositBlockId
  if (options.rootDeposit) {
    await rootContract.approve(depositManager.address, amount)
    const result = await depositManager.depositERC20ForUser(
      rootContract.address,
      user,
      amount
    )
    const logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    const NewDepositBlockEvent = logs.find(log => log.event === 'NewDepositBlock')
    depositBlockId = NewDepositBlockEvent.args.depositBlockId
  } else {
    depositBlockId = '0x' + crypto.randomBytes(32).toString('hex')
  }
  const deposit = await childChain.depositTokens(rootContract.address, user, amount, depositBlockId)
  if (options.writeToFile) {
    await writeToFile(options.writeToFile, deposit.receipt);
  }
  return deposit
}

export function startExit(predicate, headerNumber, blockProof, blockNumber, blockTimestamp, reference, logIndex, exitTx) {
  return predicate.startExit(
    utils.bufferToHex(
      rlp.encode([
        headerNumber,
        utils.bufferToHex(Buffer.concat(blockProof)),
        blockNumber,
        blockTimestamp,
        utils.bufferToHex(reference.transactionsRoot),
        utils.bufferToHex(reference.receiptsRoot),
        utils.bufferToHex(reference.receipt),
        utils.bufferToHex(rlp.encode(reference.receiptParentNodes)),
        utils.bufferToHex(rlp.encode(reference.path)), // branch mask,
        logIndex
      ])
    ),
    utils.bufferToHex(exitTx)
  )
}

export function startExitWithBurntTokens(predicate, input) {
  return predicate.startExitWithBurntTokens(
    utils.bufferToHex(rlp.encode(buildReferenceTxPayload(input)))
  )
}

export function startExitNew(predicate, inputs, exitTx) {
  let _inputs = []
  inputs.forEach(input => {
    _inputs = _inputs.concat(buildReferenceTxPayload(input))
  })
  return predicate.startExit(
    utils.bufferToHex(rlp.encode(_inputs)),
    utils.bufferToHex(exitTx)
  )
}

export function startExitForMarketplacePredicate(predicate, inputs, exitToken, exitTx) {
  let _inputs = []
  inputs.forEach(input => {
    _inputs.push(
      web3.eth.abi.encodeParameters(
        ['address', 'bytes'],
        [input.predicate, rlp.encode(buildReferenceTxPayload(input))]
      )
    )
  })
  _inputs.push(exitToken)
  return predicate.startExit(
    utils.bufferToHex(rlp.encode(_inputs)),
    utils.bufferToHex(exitTx)
  )
}

export async function verifyDeprecation(withdrawManager, predicate, exitId, inputId, challengeData, options) {
  const exit = await withdrawManager.exits(exitId)
  // console.log('exit', exit, exit.receiptAmountOrNFTId.toString(16))
  const exitData = web3.eth.abi.encodeParameters(
    ['address', 'address', 'uint256', 'bytes32', 'bool'],
    [exit.owner, options.childToken, exit.receiptAmountOrNFTId.toString(16), exit.txHash, exit.burnt]
  )
  // console.log('exitData', exitData)
  const inputUtxoData = web3.eth.abi.encodeParameters(
    ['uint256', 'address'],
    [options.age, options.signer]
  )
  // console.log('inputUtxoData', inputUtxoData)
  return predicate.verifyDeprecation(exitData, inputUtxoData, challengeData)
}

export function buildReferenceTxPayload(input) {
  const res = []
  const { headerNumber, blockProof, blockNumber, blockTimestamp, reference, logIndex, predicate } = input
  // if (predicate) res.push(predicate)
  return res.concat(
    [
      headerNumber,
      utils.bufferToHex(Buffer.concat(blockProof)),
      blockNumber,
      blockTimestamp,
      utils.bufferToHex(reference.transactionsRoot),
      utils.bufferToHex(reference.receiptsRoot),
      utils.bufferToHex(reference.receipt),
      utils.bufferToHex(rlp.encode(reference.receiptParentNodes)),
      utils.bufferToHex(rlp.encode(reference.path)), // branch mask,
      logIndex
    ]
  )
}

export function buildChallengeData(input) {
  const data = buildReferenceTxPayload(input)
  const { reference } = input
  return utils.bufferToHex(rlp.encode(
    data.concat([
      utils.bufferToHex(reference.tx),
      utils.bufferToHex(rlp.encode(reference.txParentNodes))
    ])
  ))
}

export async function writeToFile(file, receipt) {
  const r = {
    tx: await web3Child.eth.getTransaction(receipt.transactionHash),
    receipt: await web3Child.eth.getTransactionReceipt(receipt.transactionHash),
    block: await web3Child.eth.getBlock(receipt.blockHash, true /* returnTransactionObjects */)
  }
  return fs.writeFileSync(
    path.join(__dirname, '..', 'mockResponses', file),
    `module.exports = ${JSON.stringify(r, null, 2)}`
  )
}
