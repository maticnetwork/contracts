const Proofs = require('../../helpers/proofs')
const utils = require('../../helpers/utils')

const HEADER_BLOCK_NUMBER_WEIGHT = web3.utils.toBN(10).pow(web3.utils.toBN(30))
const CHILD_BLOCK_NUMBER_WEIGHT = web3.utils.toBN(10).pow(web3.utils.toBN(12))
const BRANCH_MASK_WEIGHT = web3.utils.toBN(10).pow(web3.utils.toBN(5))
const MAX_LOGS = web3.utils.toBN(10)

// builds the reference tx input payload in the format that utils.startExitNew expects
export function buildInputFromCheckpoint(checkpoints) {
  return checkpoints.map(({ checkpoint, logIndex }) => {
    return {
      headerNumber: checkpoint.headerNumber,
      blockProof: checkpoint.blockProof,
      blockNumber: checkpoint.block.number,
      blockTimestamp: checkpoint.block.timestamp,
      reference: checkpoint.reference,
      logIndex
    }
  })
}

export function getAge(utxo) {
  return web3.utils.toBN(utxo.checkpoint.headerNumber).mul(HEADER_BLOCK_NUMBER_WEIGHT)
    .add(web3.utils.toBN(utxo.checkpoint.block.number, 10).mul(CHILD_BLOCK_NUMBER_WEIGHT))
    .add(web3.utils.toBN(parseInt(utxo.checkpoint.reference.path.toString('hex'), 16)).mul(BRANCH_MASK_WEIGHT))
    .add(web3.utils.toBN(utxo.logIndex).mul(MAX_LOGS))
}

// this is hack to generate a raw tx that is expected to be inflight
// Fire the tx with less gas and get payload from the reverted tx
export async function getRawInflightTx(fn, from, web3) {
  const options = { from, gas: 25000 }
  try {
    await fn(options)
    assert.fail('should have failed')
  } catch(e) {
    // console.log(e)
    // to ensure it doesnt revert because of some other reason
    assert.ok(e.message.includes('exited with an error (status 0) after consuming all gas'))
    return buildInFlight(await web3.eth.getTransaction(e.tx))
  }
}

export function buildInFlight(tx) {
  return Proofs.getTxBytes(tx)
}

export function assertStartExit(log, exitor, token, amount, isRegularExit, exitId) {
  log.event.should.equal('ExitStarted')
  expect(log.args).to.include({ exitor, token, isRegularExit })
  utils.assertBigNumberEquality(log.args.amount, amount)
  console.log()
  utils.assertBigNumberEquality(log.args.exitId, exitId)
}

export function assertExitUpdated(log, signer, exitId, age) {
  if (!age) age = exitId
  log.event.should.equal('ExitUpdated')
  expect(log.args).to.include({ signer })
  utils.assertBigNumberEquality(log.args.age, age)
  utils.assertBigNumberEquality(log.args.exitId, exitId)
}
