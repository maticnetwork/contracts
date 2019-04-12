/* global web3 */

import utils from 'ethereumjs-util'
import { Buffer } from 'safe-buffer'
import BigNumber from 'bignumber.js'

import * as contracts from './contracts'

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

export function assertBigNumberEquality(num1, num2, mode='BN') {
    expect(num1.eq(web3.utils.toBN(num2))).to.be.true;
}

export function assertBigNumbergt(num1, num2, mode='BN') {
  expect(num1.gt(web3.utils.toBN(num2))).to.be.true;
  // num1.should.be.bignumber.greaterThan(num2)
}
