/* global web3 */

import utils from 'ethereumjs-util'
import { Buffer } from 'safe-buffer'

import * as contracts from './contracts'

const BN = utils.BN

export const ZeroAddress = '0x0000000000000000000000000000000000000000'

export async function mineOneBlock() {
  return web3.currentProvider.send({
    jsonrpc: '2.0',
    method: 'evm_mine',
    id: new Date().getTime()
  })
}

export async function increaseBlockTime(seconds) {
  return web3.currentProvider.send({
    jsonrpc: '2.0',
    method: 'evm_increaseTime',
    params: [seconds],
    id: new Date().getTime()
  })
}

export async function mineToBlockHeight(targetBlockHeight) {
  while (web3.eth.blockNumber < targetBlockHeight) {
    await mineOneBlock()
  }
}

// Link libs
export async function linkLibs(web3Child) {
  const libList = [
    contracts.ECVerify,
    contracts.MerklePatriciaProof,
    contracts.Merkle,
    contracts.RLPEncode,
    contracts.BytesLib,
    contracts.Common
  ]
  const contractList = [
    contracts.StakeManager,
    contracts.RootChain,
    contracts.RootToken,
    contracts.MaticWETH,
    contracts.StakeManagerMock,
    contracts.TokenManagerMock,
    contracts.RootChainMock,
    contracts.DepositManagerMock,
    contracts.WithdrawManagerMock,
    contracts.TxValidator,
    contracts.ExitValidator,
    contracts.ERC20Validator,
    contracts.ERC20ValidatorMock,
    contracts.ERC721ValidatorMock
  ]

  const libAddresses = {}
  for (var i = 0; i < libList.length; i++) {
    const M = libList[i]

    for (var j = 0; j < i; j++) {
      const n = libList[j]._json.contractName
      M.link(n, libAddresses[n])
    }

    const l = await M.new()
    libAddresses[M._json.contractName] = l.address
    contractList.forEach(c => {
      c.link(M._json.contractName, l.address)
    })
  }

  // web3Child
  if (web3Child) {
    const childContractList = [
      contracts.ChildChain,
      contracts.ChildERC20,
      contracts.ChildERC721
    ]
    let i
    for (i = 0; i < libList.length; i++) {
      const M = libList[i]
      const web3 = M.web3 // backup
      M.web3 = web3Child // set for now
      const l = await M.new()
      M.web3 = web3 // recover
      childContractList.forEach(c => {
        c.link(M._json.contractName, l.address)
      })
    }
  }
}

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
