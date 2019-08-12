import { increaseBlockTime, mineOneBlock } from '../../helpers/chain'
const Proofs = require('../../helpers/proofs')
const utils = require('../../helpers/utils')

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
  return utxo.checkpoint.createdAt
    .shln(127)
    .or(web3.utils.toBN(utxo.checkpoint.block.number).shln(32))
    .or(
      web3.utils.toBN(
        parseInt(utxo.checkpoint.reference.path.toString('hex'), 16)
      )
    )
    .add(web3.utils.toBN(utxo.logIndex).mul(MAX_LOGS))
  // oIndex
}

// this is hack to generate a raw tx that is expected to be inflight
// Fire the tx with less gas and get payload from the reverted tx
export async function getRawInflightTx(fn, from, web3) {
  const options = { from, gas: 30000 } // minimal: 26136 is required, not sure why
  try {
    await fn(options)
    assert.fail('should have failed')
  } catch (e) {
    // console.log(e)
    // to ensure it doesnt revert because of some other reason
    assert.ok(
      e.message.includes(
        'exited with an error (status 0) after consuming all gas'
      ),
      'Expected tx to throw for a different reason'
    )
    return buildInFlight(await web3.eth.getTransaction(e.tx))
  }
}

export function buildInFlight(tx) {
  return Proofs.getTxBytes(tx)
}

export async function assertStartExit(
  log,
  exitor,
  token,
  amount,
  isRegularExit,
  exitId,
  exitNFT
) {
  exitor = exitor.toLowerCase()
  token = token.toLowerCase()
  log.event.should.equal('ExitStarted')
  assert.strictEqual(log.args.exitor.toLowerCase(), exitor)
  assert.strictEqual(log.args.token.toLowerCase(), token)
  expect(log.args).to.include({ isRegularExit })
  utils.assertBigNumberEquality(log.args.amount, amount)
  if (exitId) {
    console.log(
      'in assertStartExit: exitId',
      log.args.exitId,
      exitId.toString(16)
    )
    console.log(
      exitId,
      web3.utils.toBN(exitId),
      web3.utils.toBN(
        exitId.toString(16),
        log.args.exitId,
        web3.utils.toBN(log.args.exitId)
      )
    )
    const num1 = web3.utils.toBN(log.args.exitId)
    // utils.assertBigNumberEquality(log.args.exitId, exitId)
    console.log(exitId.toString(16) == log.args.exitId.toString(16))
    console.log(exitId == log.args.exitId)
    // expect(num1.eq(web3.utils.toBN(exitId))).to.be.true
    console.log('woho')
    if (exitNFT) {
      console.log('yaha bhi?')
      assert.strictEqual((await exitNFT.ownerOf(exitId)).toLowerCase(), exitor)
    }
    console.log('kuch to fuck up nahi h yaha')
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
  const ethSpent = web3.utils
    .toBN(challenge.receipt.gasUsed)
    .mul(web3.utils.toBN(tx.gasPrice))
  const expectedBalance = originalBalance.sub(ethSpent).add(BOND_AMOUNT)
  const nowBalance = web3.utils.toBN(await web3.eth.getBalance(challenger))
  assert.ok(expectedBalance.eq(nowBalance), 'Exitor did not receive the bond')
}

export async function processExits(withdrawManager, token) {
  console.log('kaam hua kya')
  await increaseBlockTime(14 * 86400)
  await mineOneBlock()
  console.log('kaam hua')
  return withdrawManager.processExits(token, { gas: 5000000 })
}
