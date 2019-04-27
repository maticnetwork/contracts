/* global web3 */

import utils from 'ethereumjs-util'
import { Buffer } from 'safe-buffer'
import encode from 'ethereumjs-abi'

import { generateFirstWallets, mnemonics } from './wallets.js'

const BN = utils.BN

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
