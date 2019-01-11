import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBigNumber from 'chai-bignumber'
import utils from 'ethereumjs-util'

import {
  WithdrawManagerMock,
  DepositManagerMock,
  RootChainMock,
  RootToken,
  ChildChain,
  ChildERC20,
  ExitNFT,
  ExitValidator
} from '../helpers/contracts'
import { getHeaders, getBlockHeader } from '../helpers/blocks'
import MerkleTree from '../helpers/merkle-tree'
import { linkLibs, ZeroAddress } from '../helpers/utils'
import LogDecoder from '../helpers/log-decoder'
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
ChildERC20.web3 = web3Child

contract('ExitValidator', async function(accounts) {
  describe('exit validation', async function() {
    let amount
    let logDecoder

    before(async function() {
      // link libs
      await linkLibs()

      // set amount
      amount = web3.toWei(1)

      // log decoder
      logDecoder = new LogDecoder([
        ExitNFT._json.abi,
        WithdrawManagerMock._json.abi,
        RootToken._json.abi,
        ExitNFT._json.abi
      ])
    })

    describe('exit without burn', async function() {
      let withdrawManager
      let rootToken
      let childChain
      let childToken
      let exitNFTContract
      let rootChain
      let depositManager

      let receivedTx
      let exitId
      let exitValidator
      let owner = accounts[0]

      // transfer after exit
      let transferReceipt

      // child block interval
      let childBlockInterval

      before(async function() {
        // withdraw manager

        // root token / child chain / child token
        rootToken = await RootToken.new('Root Token', 'ROOT')
        exitNFTContract = await ExitNFT.new('Matic Exit NFT', 'MATIC-NFT')

        // child chain
        childChain = await ChildChain.new()
        const receipt = await childChain.addToken(
          accounts[0],
          rootToken.address,
          'Token Test',
          'TEST',
          18,
          false
        )
        childToken = ChildERC20.at(receipt.logs[1].args.token)

        // exit validator
        exitValidator = await ExitValidator.new()
        rootChain = await RootChainMock.new()
        depositManager = await DepositManagerMock.new({ from: owner })
        withdrawManager = await WithdrawManagerMock.new({ from: owner })

        await exitValidator.changeRootChain(rootChain.address, { from: owner })

        childBlockInterval = await withdrawManager.CHILD_BLOCK_INTERVAL()

        await depositManager.changeRootChain(rootChain.address, { from: owner })
        await withdrawManager.changeRootChain(rootChain.address, {
          from: owner
        })
        await exitValidator.setWithdrawManager(withdrawManager.address)

        await rootChain.setDepositManager(depositManager.address, {
          from: owner
        })
        await rootChain.setWithdrawManager(withdrawManager.address, {
          from: owner
        })

        await rootChain.addProofValidator(exitValidator.address, {
          from: owner
        })

        // set exit NFT
        await withdrawManager.setExitNFTContract(exitNFTContract.address)
        // set withdraw manager as root chain for exit NFT

        await exitValidator.setDepositManager(depositManager.address)
        // set exit NFT
        await withdrawManager.setDepositManager(depositManager.address)
        // set withdraw manager as root chain for exit NFT

        await exitNFTContract.changeRootChain(withdrawManager.address, {
          from: owner
        })

        // map token
        await rootChain.mapToken(rootToken.address, childToken.address, false, {
          from: owner
        })
      })

      it('should allow user to deposit tokens', async function() {
        // transfer tokens
        await rootToken.mint(accounts[1], amount)
        await rootToken.transfer(rootChain.address, amount, {
          from: accounts[1]
        })

        // deposit tokens
        await childChain.depositTokens(
          rootToken.address,
          accounts[1],
          amount,
          0
        )
      })

      it('should allow user to transfer tokens', async function() {
        // transfer tokens
        receivedTx = await childToken.transfer(accounts[9], amount, {
          from: accounts[1]
        })
      })

      it('should allow user to start exit without burning tokens', async function() {
        const user = accounts[9]

        const receipt = receivedTx.receipt
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
        const headerNumber = +childBlockInterval

        // set header block (mocking header block)
        await rootChain.setHeaderBlock(
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
        const exitReceipt = await withdrawManager.withdrawTokens(
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
        const exitLogs = logDecoder.decodeLogs(exitReceipt.receipt.logs)
        exitLogs.should.have.lengthOf(2)

        // set tokenId
        exitLogs[0].event.should.equal('Transfer')
        exitLogs[0].address.should.equal(exitNFTContract.address)
        exitLogs[0].args.to.toLowerCase().should.equal(user)

        exitId = exitLogs[0].args.tokenId.toString()

        exitLogs[1].event.should.equal('ExitStarted')
        exitLogs[1].address.should.equal(withdrawManager.address)
        exitLogs[1].args.exitor.toLowerCase().should.equal(user)
        exitLogs[1].args.token.toLowerCase().should.equal(rootToken.address)
        exitLogs[1].args.amount.should.be.bignumber.equal(amount)
      })

      it('should allow to transfer after exit', async function() {
        transferReceipt = await childToken.transfer(accounts[1], amount, {
          from: accounts[9]
        })
      })

      it('should allow anyone to challenge after exit and transfer', async function() {
        const receipt = transferReceipt.receipt
        const transferTx = await web3Child.eth.getTransaction(
          receipt.transactionHash
        )
        const transferBlock = await web3Child.eth.getBlock(
          receipt.blockHash,
          true
        )

        const start = transferTx.blockNumber - 1
        const end = transferTx.blockNumber
        const headers = await getHeaders(start, end, web3Child)
        const tree = new MerkleTree(headers)
        const headerRoot = utils.bufferToHex(tree.getRoot())
        const headerNumber = +childBlockInterval * 5

        // set header block (mocking header block)
        await rootChain.setHeaderBlock(
          headerNumber,
          headerRoot,
          start,
          end,
          transferBlock.timestamp
        )

        const blockHeader = getBlockHeader(transferBlock)
        const headerProof = await tree.getProof(blockHeader)
        tree
          .verify(
            blockHeader,
            transferBlock.number - start,
            tree.getRoot(),
            headerProof
          )
          .should.equal(true)

        // validate tx proof
        const txProof = await getTxProof(transferTx, transferBlock)
        assert.isOk(verifyTxProof(txProof), 'Tx proof must be valid')

        // challenge exit
        const challengeReceipt = await exitValidator.challengeExit(
          exitId, // exit id for exit

          headerNumber, // header block
          utils.bufferToHex(Buffer.concat(headerProof)), // header proof

          transferBlock.number, // block number
          transferBlock.timestamp, // block timestamp
          utils.bufferToHex(transferBlock.transactionsRoot), // tx root
          utils.bufferToHex(transferBlock.receiptsRoot), // tx root
          utils.bufferToHex(rlp.encode(txProof.path)), // key for trie (both tx and receipt)

          utils.bufferToHex(getTxBytes(transferTx)), // tx bytes
          utils.bufferToHex(rlp.encode(txProof.parentNodes)), // tx proof nodes,
          {
            from: accounts[2]
          }
        )

        const logs = logDecoder.decodeLogs(challengeReceipt.receipt.logs)
        logs.should.have.lengthOf(1)
        logs[0].args.from.toLowerCase().should.equal(accounts[9])
        logs[0].args.to.should.equal(ZeroAddress)
        logs[0].args.tokenId.should.be.bignumber.equal(exitId)
      })

      it('should pass (added for sanity)', async function() {
        assert.isOk(true)
      })
    })
  })
})
