import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBigNumber from 'chai-bignumber'
import utils from 'ethereumjs-util'

import {
  WithdrawManagerMock,
  RootToken,
  ChildChain,
  ChildToken,
  ExitNFT
} from '../helpers/contracts'
import { getHeaders, getBlockHeader } from '../helpers/blocks'
import MerkleTree from '../helpers/merkle-tree'
import { linkLibs } from '../helpers/utils'
import LogDecoder from '../helpers/log-decoder'
import EVMRevert from '../helpers/evm-revert'
import {
  getTxBytes,
  getTxProof,
  verifyTxProof,
  getReceiptBytes,
  getReceiptProof,
  verifyReceiptProof
} from '../helpers/proofs'

const rlp = utils.rlp

// add chai pluggin
chai
  .use(chaiAsPromised)
  .use(chaiBigNumber(web3.BigNumber))
  .should()

const web3Child = new web3.constructor(
  new web3.providers.HttpProvider('http://localhost:8546')
)

ChildChain.web3 = web3Child
ChildToken.web3 = web3Child

contract('WithdrawManager', async function(accounts) {
  describe('withdraw', async function() {
    let owner
    let amount
    let withdrawManagerLogDecoder

    before(async function() {
      // link libs
      await linkLibs()

      // get owner out of accounts
      owner = accounts[0]

      // set amount
      amount = web3.toWei(1)

      // log decoder
      withdrawManagerLogDecoder = new LogDecoder([
        ExitNFT._json.abi,
        WithdrawManagerMock._json.abi
      ])
    })

    describe('burn withdraw', async function() {
      let withdrawManager
      let rootToken
      let childChain
      let childToken
      let exitNFTContract

      let exitId

      before(async function() {
        // withdraw manager
        withdrawManager = await WithdrawManagerMock.new()

        // root token / child chain / child token
        rootToken = await RootToken.new('Root Token', 'ROOT')
        exitNFTContract = await ExitNFT.new('Matic Exit NFT', 'MATIC-NFT')

        // child chain
        childChain = await ChildChain.new()
        const receipt = await childChain.addToken(rootToken.address, 18)
        childToken = ChildToken.at(receipt.logs[0].args.token)

        // map token
        await withdrawManager.mapToken(rootToken.address, childToken.address)
        // set exit NFT
        await withdrawManager.setExitNFTContract(exitNFTContract.address)
        // set withdraw manager as root chain for exit NFT
        await exitNFTContract.changeRootChain(withdrawManager.address)
      })

      it('should allow operator to deposit tokens', async function() {
        // deposit tokens
        await childChain.depositTokens(
          rootToken.address,
          accounts[9],
          amount,
          0
        )
      })

      it('should allow user to start exit after burning tokens', async function() {
        const user = accounts[9]

        // withdraw token
        const obj = await childToken.withdraw(amount, {
          from: user
        })

        const receipt = obj.receipt
        const withdraw = await web3Child.eth.getTransaction(
          receipt.transactionHash
        )

        const withdrawBlock = await web3Child.eth.getBlock(
          receipt.blockHash,
          true
        )

        const withdrawReceipt = await web3Child.eth.getTransactionReceipt(
          receipt.transactionHash
        )

        const start = withdraw.blockNumber - 1
        const end = withdraw.blockNumber
        const headers = await getHeaders(start, end, web3Child)
        const tree = new MerkleTree(headers)
        const headerRoot = utils.bufferToHex(tree.getRoot())
        const headerNumber = 0

        // set header block (mocking header block)
        await withdrawManager.setHeaderBlock(
          headerNumber,
          headerRoot,
          start,
          end,
          withdrawBlock.timestamp
        )

        const blockHeader = getBlockHeader(withdrawBlock)
        const headerProof = await tree.getProof(blockHeader)
        tree
          .verify(
            blockHeader,
            withdrawBlock.number - start,
            tree.getRoot(),
            headerProof
          )
          .should.equal(true)

        // validate tx proof
        const txProof = await getTxProof(withdraw, withdrawBlock)
        assert.isOk(verifyTxProof(txProof), 'Tx proof must be valid')

        // validate receipt proof
        const receiptProof = await getReceiptProof(
          withdrawReceipt,
          withdrawBlock,
          web3Child
        )
        assert.isOk(
          verifyReceiptProof(receiptProof),
          'Receipt proof must be valid'
        )

        // withdraw
        const burnWithdrawReceipt = await withdrawManager.withdrawBurntTokens(
          headerNumber, // header block
          utils.bufferToHex(Buffer.concat(headerProof)), // header proof

          withdrawBlock.number, // block number
          withdrawBlock.timestamp, // block timestamp
          utils.bufferToHex(withdrawBlock.transactionsRoot), // tx root
          utils.bufferToHex(withdrawBlock.receiptsRoot), // tx root
          utils.bufferToHex(rlp.encode(receiptProof.path)), // key for trie (both tx and receipt)

          utils.bufferToHex(getTxBytes(withdraw)), // tx bytes
          utils.bufferToHex(rlp.encode(txProof.parentNodes)), // tx proof nodes

          utils.bufferToHex(getReceiptBytes(withdrawReceipt)), // receipt bytes
          utils.bufferToHex(rlp.encode(receiptProof.parentNodes)), // reciept proof nodes
          {
            from: user
          }
        )

        // total logs
        const burnLogs = withdrawManagerLogDecoder.decodeLogs(
          burnWithdrawReceipt.receipt.logs
        )
        burnLogs.should.have.lengthOf(2)

        // set tokenId
        exitId =
          1000000000000 * withdrawBlock.number +
          100000 * withdrawReceipt.transactionIndex

        burnLogs[0].event.should.equal('Transfer')
        burnLogs[0].address.should.equal(exitNFTContract.address)
        burnLogs[0].args._to.toLowerCase().should.equal(user)
        burnLogs[0].args._tokenId.should.be.bignumber.equal(exitId)

        burnLogs[1].event.should.equal('ExitStarted')
        burnLogs[1].address.should.equal(withdrawManager.address)
        burnLogs[1].args.exitor.toLowerCase().should.equal(user)
        burnLogs[1].args.token.toLowerCase().should.equal(rootToken.address)
        burnLogs[1].args.amount.should.be.bignumber.equal(amount)
      })

      it('should mint ExitNFT properly', async function() {
        const totalSupply = await exitNFTContract.totalSupply()
        totalSupply.should.be.bignumber.equal(1)
      })

      it('should have proper data in exitNFT', async function() {
        const tokenId = await exitNFTContract.tokenByIndex(0)
        tokenId.should.be.bignumber.equal(exitId)

        // check owner
        await exitNFTContract
          .ownerOf(tokenId)
          .should.eventually.equal(accounts[9])

        const [exitToken, exitAmount] = await withdrawManager.getExit(exitId)
        exitToken.should.equal(rootToken.address)
        exitAmount.should.be.bignumber.equal(amount)
      })
    })
  })
})
