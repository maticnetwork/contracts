import { increaseBlockTime, mineOneBlock } from '../../../helpers/chain.js'
import * as Proofs from '../../../helpers/proofs.js'
import * as utils from '../../../helpers/utils.js'

import * as chai from 'chai'
const assert = chai.assert

const MAX_LOGS = web3.utils.toBN(10)
const BOND_AMOUNT = web3.utils.toBN(10).pow(web3.utils.toBN(17))

// builds the reference tx input payload in the format that utils.startExitNew or utils.buildChallengeData expect
export function buildInputFromCheckpoint(utxo) {
  const { checkpoint, logIndex } = utxo
  return {
    headerNumber: checkpoint.headerNumber,
    blockProof: checkpoint.blockProof,
    blockNumber: checkpoint.block.number,
    blockTimestamp: checkpoint.block.timestamp,
    reference: checkpoint.reference,
    logIndex
  }
}

export function getAge(utxo) {
  // Todo: address the now + 1 Week thing in priority
  // Math.max(createdAt + 2 Week, now + 1 Week);
  return utxo.checkpoint.createdAt
    .add(web3.utils.toBN(7 * 86400)) // createdAt + 1 Weeks
    .shln(127)
    .or(web3.utils.toBN(utxo.checkpoint.block.number).shln(32))
    .or(web3.utils.toBN(parseInt(utxo.checkpoint.reference.path.toString('hex'), 16)))
    .add(web3.utils.toBN(utxo.logIndex).mul(MAX_LOGS))
  // oIndex
}

export async function assertStartExit(log, exitor, token, amount, isRegularExit, exitId, exitNFT) {
  exitor = exitor.toLowerCase()
  token = token.toLowerCase()
  log.event.should.equal('ExitStarted')
  assert.strictEqual(log.args.exitor.toLowerCase(), exitor)
  assert.strictEqual(log.args.token.toLowerCase(), token)
  expect(log.args).to.include({ isRegularExit })
  utils.assertBigNumberEquality(log.args.amount, amount)
  if (exitId) {
    // console.log('in assertStartExit: exitId', log.args.exitId, exitId.toString(16))
    utils.assertBigNumberEquality(log.args.exitId, exitId)
    if (exitNFT) assert.strictEqual((await exitNFT.ownerOf(exitId)).toLowerCase(), exitor)
  }
}

export function assertExitUpdated(log, signer, exitId, ageOfUtxo) {
  log.event.should.equal('ExitUpdated')
  assert.strictEqual(log.args.signer.toLowerCase(), signer.toLowerCase())
  // console.log('in assertExitUpdated: exitId', log.args.exitId, exitId.toString(16))
  utils.assertBigNumberEquality(log.args.exitId, exitId)
  // console.log('in assertExitUpdated: ageOfUtxo', log.args.age, ageOfUtxo.toString(16))
  utils.assertBigNumberEquality(log.args.age, ageOfUtxo)
}

export function assertExitCancelled(log, exitId) {
  log.event.should.equal('ExitCancelled')
  utils.assertBigNumberEquality(log.args.exitId, exitId)
}

export async function assertChallengeBondReceived(challenge, originalBalance) {
  const challenger = challenge.receipt.from
  // Need this to get the gasPrice to assert that challenger received the bond amount
  const tx = await web3.eth.getTransaction(challenge.tx)
  const ethSpent = web3.utils.toBN(challenge.receipt.gasUsed).mul(web3.utils.toBN(tx.gasPrice))
  const expectedBalance = originalBalance.sub(ethSpent).add(BOND_AMOUNT)
  const nowBalance = web3.utils.toBN(await web3.eth.getBalance(challenger))
  assert.ok(expectedBalance.eq(nowBalance), 'Exitor did not receive the bond')
}

export async function processExits(withdrawManager, token) {
  await increaseBlockTime(14 * 86400)
  await mineOneBlock()
  return withdrawManager.processExits(token, { gasLimit: 5000000 })
}
