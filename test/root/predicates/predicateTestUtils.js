const Proofs = require('../../helpers/proofs')
const utils = require('../../helpers/utils')

export const HEADER_BLOCK_NUMBER_WEIGHT = web3.utils.toBN(10).pow(web3.utils.toBN(30))
const CHILD_BLOCK_NUMBER_WEIGHT = web3.utils.toBN(10).pow(web3.utils.toBN(12))
const BRANCH_MASK_WEIGHT = web3.utils.toBN(10).pow(web3.utils.toBN(5))
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
  return web3.utils.toBN(utxo.checkpoint.headerNumber).mul(HEADER_BLOCK_NUMBER_WEIGHT)
    .add(web3.utils.toBN(utxo.checkpoint.block.number, 10).mul(CHILD_BLOCK_NUMBER_WEIGHT))
    .add(web3.utils.toBN(parseInt(utxo.checkpoint.reference.path.toString('hex'), 16)).mul(BRANCH_MASK_WEIGHT))
    .add(web3.utils.toBN(utxo.logIndex).mul(MAX_LOGS))
}

// this is hack to generate a raw tx that is expected to be inflight
// Fire the tx with less gas and get payload from the reverted tx
export async function getRawInflightTx(fn, from, web3) {
  const options = { from, gas: 30000 } // minimal: 26136 is required, not sure why
  try {
    await fn(options)
    assert.fail('should have failed')
  } catch(e) {
    // console.log(e)
    // to ensure it doesnt revert because of some other reason
    assert.ok(
      e.message.includes('exited with an error (status 0) after consuming all gas'),
      'Expected tx to throw for a different reason'
    )
    return buildInFlight(await web3.eth.getTransaction(e.tx))
  }
}

export function buildInFlight(tx) {
  return Proofs.getTxBytes(tx)
}

export function getExitId(exitor, utxoAge) {
  return web3.utils.toBN(web3.utils.soliditySha3(exitor, utxoAge)).shrn(128)
}

export async function assertStartExit(log, exitor, token, amount, isRegularExit, exitId, exitNFT) {
  log.event.should.equal('ExitStarted')
  expect(log.args).to.include({ exitor, token, isRegularExit })
  utils.assertBigNumberEquality(log.args.amount, amount)
  if (exitId) {
    utils.assertBigNumberEquality(log.args.exitId, exitId)
    if (exitNFT) assert.strictEqual(await exitNFT.ownerOf(exitId), exitor)
  }
}

export function assertExitUpdated(log, signer, exitId, ageOfUtxo) {
  log.event.should.equal('ExitUpdated')
  expect(log.args).to.include({ signer })
  // console.log('exitId', log.args.exitId, exitId)
  utils.assertBigNumberEquality(log.args.exitId, exitId)
  // console.log('ageOfUtxo', log.args.age, ageOfUtxo)
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

export async function processExit(withdrawManager, token) {
  // await utils.increaseBlockTime(14 * 86400)
  const receipt = await withdrawManager.processExits(token, { gas: 5000000 })
  console.log(receipt)
}
