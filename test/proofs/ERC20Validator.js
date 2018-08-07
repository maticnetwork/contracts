/* global artifacts, web3, assert, contract */

import utils from 'ethereumjs-util'
import { Buffer } from 'safe-buffer'

import {
  getTxBytes,
  getTxProof,
  verifyTxProof,
  getReceiptBytes,
  getReceiptProof,
  verifyReceiptProof
} from '../helpers/proofs.js'
import { getHeaders, getBlockHeader } from '../helpers/blocks.js'
import { generateFirstWallets, mnemonics } from '../helpers/wallets'
import MerkleTree from '../helpers/merkle-tree.js'
import { linkLibs, encodeSigs, getSigs } from '../helpers/utils'

import {
  StakeManager,
  RootToken,
  RootChain,
  ERC20Validator
} from '../helpers/contracts'

let ChildChain = artifacts.require('../child/ChildChain.sol')
let ChildToken = artifacts.require('../child/ChildERC20.sol')

const web3Child = new web3.constructor(
  new web3.providers.HttpProvider('http://localhost:8546')
)

ChildChain.web3 = web3Child
ChildToken.web3 = web3Child

const BN = utils.BN
const rlp = utils.rlp

// const printReceiptEvents = receipt => {
//   receipt.logs.forEach(l => {
//     console.log(l.event, JSON.stringify(l.args))
//   })
// }

contract('ERC20Validator', async function(accounts) {
  describe('initialization', async function() {
    let stakeToken
    let rootToken
    let childToken
    let rootChain
    let stakeManager
    let wallets
    let childChain
    let stakes = {
      1: web3.toWei(1),
      2: web3.toWei(10),
      3: web3.toWei(20),
      4: web3.toWei(50)
    }
    let chain
    let sigs
    let user

    before(async function() {
      // link libs
      await linkLibs(web3Child)

      user = accounts[0]
      const amount = web3.toWei(10)

      wallets = generateFirstWallets(mnemonics, Object.keys(stakes).length)
      stakeToken = await RootToken.new('Stake Token', 'STAKE')
      rootToken = await RootToken.new('Test Token', 'TEST', { from: user })
      stakeManager = await StakeManager.new(stakeToken.address)
      rootChain = await RootChain.new(stakeManager.address)
      await stakeManager.setRootChain(rootChain.address)

      // child chain
      childChain = await ChildChain.new({ from: user, gas: 6000000 })
      childToken = await ChildToken.new(rootToken.address, 18)

      let childTokenReceipt = await childChain.addToken(rootToken.address, 18, {
        from: user
      })
      childToken = ChildToken.at(childTokenReceipt.logs[0].args.token)

      // map root token
      await rootChain.mapToken(rootToken.address, childToken.address)

      for (var i = 1; i < wallets.length; i++) {
        const amount = stakes[i]
        const user = wallets[i].getAddressString()

        // get tokens
        await stakeToken.transfer(user, amount)

        // approve transfer
        await stakeToken.approve(stakeManager.address, amount, { from: user })

        // stake
        await stakeManager.stake(amount, '0x0', { from: user })
      }

      // increase threshold to 2
      await stakeManager.updateValidatorThreshold(2)
      chain = await rootChain.chain()

      // deposit amount
      let receipt = await rootToken.approve(rootChain.address, amount, {
        from: user
      })
      receipt = await rootChain.deposit(rootToken.address, user, amount, {
        from: user
      })

      const depositCount = receipt.logs[0].args.depositCount.toString()
      await childChain.depositTokens(
        rootToken.address,
        user,
        amount,
        depositCount,
        {
          from: user
        }
      )
    })

    it('transfer tokens', async function() {
      const amount = web3.toWei(1)

      // transfer receipt
      let obj = await childToken.transfer(user, amount, {
        from: user
      })

      // receipt
      let receipt = obj.receipt
      let transfer = await web3Child.eth.getTransaction(receipt.transactionHash)
      let transferBlock = await web3Child.eth.getBlock(receipt.blockHash, true)
      let transferReceipt = await web3Child.eth.getTransactionReceipt(
        receipt.transactionHash
      )

      const _start = await rootChain.currentChildBlock()
      const start = parseInt(_start, 10) > 0 ? parseInt(_start, 10) + 1 : 0
      const end = transfer.blockNumber
      const headers = await getHeaders(start, end, web3Child)
      const tree = new MerkleTree(headers)
      const v = getBlockHeader(transferBlock)
      assert.isOk(
        tree.verify(
          v,
          transferBlock.number - start,
          tree.getRoot(),
          tree.getProof(v)
        )
      )

      const root = utils.bufferToHex(tree.getRoot())
      sigs = utils.bufferToHex(
        encodeSigs(
          getSigs(wallets.slice(1), chain, root, start, end, [
            await stakeManager.getProposer()
          ])
        )
      )

      // submit header block
      receipt = await rootChain.submitHeaderBlock(
        utils.bufferToHex(tree.getRoot()),
        end,
        sigs
      )

      // validate tx proof
      // transaction proof
      const txProof = await getTxProof(transfer, transferBlock)
      // check if proof is valid
      assert.isOk(verifyTxProof(txProof), 'Tx proof must be valid')

      // validate receipt proof
      const receiptProof = await getReceiptProof(
        transferReceipt,
        transferBlock,
        web3Child
      )
      assert.isOk(
        verifyReceiptProof(receiptProof),
        'Receipt proof must be valid'
      )

      // validate header proof
      const headerProof = await tree.getProof(getBlockHeader(transferBlock))
      const headerNumber = await rootChain.currentHeaderBlock()

      // create  erc20 validator
      const erc20Validator = await ERC20Validator.new()
      await erc20Validator.changeRootChain(rootChain.address)

      // ERC20 validator
      receipt = await erc20Validator.validateERC20TransferTx(
        utils.bufferToHex(
          rlp.encode([
            +headerNumber.sub(new BN(1)).toString(), // header block
            utils.bufferToHex(Buffer.concat(headerProof)), // header proof

            transferBlock.number, // block number
            transferBlock.timestamp, // block timestamp
            utils.bufferToHex(transferBlock.transactionsRoot), // tx root
            utils.bufferToHex(transferBlock.receiptsRoot), // tx root
            utils.bufferToHex(rlp.encode(receiptProof.path)), // key for trie (both tx and receipt)

            utils.bufferToHex(getTxBytes(transfer)), // tx bytes
            utils.bufferToHex(rlp.encode(txProof.parentNodes)), // tx proof nodes

            utils.bufferToHex(getReceiptBytes(transferReceipt)), // receipt bytes
            utils.bufferToHex(rlp.encode(receiptProof.parentNodes)) // reciept proof nodes
          ])
        )
      )
      // printReceiptEvents(receipt)
    })
  })
})
