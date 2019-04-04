import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBigNumber from 'chai-bignumber'
import utils from 'ethereumjs-util'

import {
  WithdrawManagerMock,
  DepositManagerMock,
  RootToken,
  ChildChain,
  ChildERC20,
  RootERC721,
  ChildERC721,
  StakeManager,
  RootChainMock,
  ExitNFT
} from '../helpers/contracts'
import { getHeaders, getBlockHeader } from '../helpers/blocks'
import MerkleTree from '../helpers/merkle-tree'
import { linkLibs, increaseBlockTime, ZeroAddress } from '../helpers/utils'
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
ChildERC721.web3 = web3Child

contract('WithdrawManager', async function(accounts) {
  describe('withdraw', async function() {
    let amount
    let logDecoder

    before(async function() {
      // link libs
      await linkLibs()

      // set amount
      amount = web3.toWei(1)

      // log decoder
      logDecoder = new LogDecoder([
        StakeManager._json.abi,
        RootToken._json.abi,
        RootChainMock._json.abi,
        DepositManagerMock._json.abi,
        WithdrawManagerMock._json.abi,
        ExitNFT._json.abi
      ])
    })

    describe('burn withdraw', async function() {
      let withdrawManager
      let rootToken
      let childChain
      let childToken
      let exitNFTContract
      let rootChain
      let owner = accounts[0]
      let depositManager

      let exitId
      let childBlockInterval

      before(async function() {
        // withdraw manager
        withdrawManager = await WithdrawManagerMock.new()
        childBlockInterval = await withdrawManager.CHILD_BLOCK_INTERVAL()

        // root token / child chain / child token
        rootToken = await RootToken.new('Root Token', 'ROOT')
        exitNFTContract = await ExitNFT.new('Matic Exit NFT', 'MATIC-NFT', {
          from: owner
        })

        rootChain = await RootChainMock.new()

        depositManager = await DepositManagerMock.new({ from: owner })
        withdrawManager = await WithdrawManagerMock.new({ from: owner })

        await depositManager.changeRootChain(rootChain.address, { from: owner })
        await withdrawManager.changeRootChain(rootChain.address, {
          from: owner
        })

        await rootChain.setDepositManager(depositManager.address, {
          from: owner
        })
        await rootChain.setWithdrawManager(withdrawManager.address, {
          from: owner
        })
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
        childToken = ChildERC20.at(receipt.logs[1].args.token.toLowerCase())

        // set exit NFT
        await withdrawManager.setExitNFTContract(exitNFTContract.address)
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
        await rootToken.mint(accounts[9], amount)
        await rootToken.transfer(rootChain.address, amount, {
          from: accounts[9]
        })

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
        assert.isTrue(verifyTxProof(txProof), 'Tx proof must be valid')

        // validate receipt proof
        const receiptProof = await getReceiptProof(
          withdrawReceipt,
          withdrawBlock,
          web3Child
        )
        assert.isTrue(
          verifyReceiptProof(receiptProof),
          'Receipt proof must be valid'
        )

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
        const burnLogs = logDecoder.decodeLogs(burnWithdrawReceipt.receipt.logs)

        burnLogs.should.have.lengthOf(2)

        burnLogs[0].event.should.equal('Transfer')
        burnLogs[0].address.should.equal(exitNFTContract.address)
        burnLogs[0].args.to.toLowerCase().should.equal(user)

        exitId = burnLogs[0].args.tokenId.toString()

        burnLogs[1].event.should.equal('ExitStarted')
        burnLogs[1].address.should.equal(withdrawManager.address)
        burnLogs[1].args.exitor.toLowerCase().should.equal(user)
        burnLogs[1].args.token.toLowerCase().should.equal(rootToken.address)
        burnLogs[1].args.amount.should.be.bignumber.equal(amount)
      })

      it('should have proper exitId for given user', async function() {
        const eId = await withdrawManager.getExitId(
          rootToken.address,
          accounts[9],
          0 // bug in truffle with function overriding
        )
        eId.should.be.bignumber.equal(exitId)
      })

      it('should mint ExitNFT properly', async function() {
        const totalSupply = await exitNFTContract.totalSupply()
        totalSupply.should.be.bignumber.equal(1)
      })

      it('should have proper data in exitNFT', async function() {
        const tokenId = await exitNFTContract.tokenByIndex(0)
        tokenId.should.be.bignumber.equal(exitId)

        // check owner
        let out = await exitNFTContract.ownerOf(tokenId)
        out.toLowerCase().should.be.equal(accounts[9])

        const [
          exitOwner,
          exitToken,
          exitAmount,
          burnt
        ] = await withdrawManager.getExit(exitId)
        exitOwner.should.equal(accounts[9])
        exitToken.should.equal(rootToken.address)
        exitAmount.should.be.bignumber.equal(amount)
        burnt.should.equal(true)
      })

      it('should not burn exit NFT with processExit', async function() {
        const receipt = await withdrawManager.processExits(rootToken.address)
        receipt.logs.should.have.lengthOf(0)

        const [
          exitOwner,
          exitToken,
          exitAmount,
          burnt
        ] = await withdrawManager.getExit(exitId)
        exitOwner.should.equal(accounts[9])
        exitToken.should.equal(rootToken.address)
        exitAmount.should.be.bignumber.equal(amount)
        burnt.should.equal(true)
      })

      it('should burn exit NFT after challenge period', async function() {
        // wait 2 weeks
        await increaseBlockTime(14 * 86400)
        const receipt = await withdrawManager.processExits(rootToken.address)
        const logs = logDecoder.decodeLogs(receipt.receipt.logs)
        logs.should.have.lengthOf(3)

        logs[0].event.should.equal('Transfer')
        logs[0].args.from.toLowerCase().should.equal(accounts[9])
        logs[0].args.to.toLowerCase().should.equal(ZeroAddress)
        logs[0].args.tokenId.should.be.bignumber.equal(exitId)

        logs[1].event.should.equal('Transfer')
        logs[1].args.from.toLowerCase().should.equal(rootChain.address)
        logs[1].args.to.toLowerCase().should.equal(accounts[9])
        logs[1].args.value.should.be.bignumber.equal(amount)

        logs[2].event.should.equal('Withdraw')
        logs[2].args.user.toLowerCase().should.equal(accounts[9])
        logs[2].args.token.toLowerCase().should.equal(rootToken.address)
        logs[2].args.amount.should.be.bignumber.equal(amount)

        // transfer
        const totalSupply = await exitNFTContract.totalSupply()
        totalSupply.should.be.bignumber.equal(0)

        // check owner
        try {
          await exitNFTContract.ownerOf(exitId)
        } catch (error) {
          const invalidOpcode = error.message.search('revert') >= 0
          assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
        }
      })

      it('should have proper 0 exitId for given user', async function() {
        const eId = await withdrawManager.getExitId(
          rootToken.address,
          accounts[9],
          0
        )
        eId.should.be.bignumber.equal(0)
      })
    })

    describe('direct withdraw:ERC20', async function() {
      let withdrawManager
      let rootToken
      let childChain
      let childToken
      let rootChain
      let owner = accounts[0]
      let depositManager
      let exitNFTContract

      let receivedTx
      let exitId

      before(async function() {
        // root token / child chain / child token
        rootToken = await RootToken.new('Root Token', 'ROOT')
        exitNFTContract = await ExitNFT.new('Matic Exit NFT', 'MATIC-NFT')
        rootChain = await RootChainMock.new()
        depositManager = await DepositManagerMock.new({ from: owner })
        withdrawManager = await WithdrawManagerMock.new({ from: owner })
        await depositManager.changeRootChain(rootChain.address, { from: owner })
        await withdrawManager.changeRootChain(rootChain.address, {
          from: owner
        })

        await rootChain.setDepositManager(depositManager.address, {
          from: owner
        })
        await rootChain.setWithdrawManager(withdrawManager.address, {
          from: owner
        })
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

        // set exit NFT
        await withdrawManager.setExitNFTContract(exitNFTContract.address)
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

      it('should have 0 exitId for given user', async function() {
        const eId = await withdrawManager.getExitId(
          rootToken.address,
          accounts[9],
          0
        )
        eId.should.be.bignumber.equal(0)
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
        const headerNumber = 0

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
        assert.isTrue(verifyTxProof(txProof), 'Tx proof must be valid')

        // validate receipt proof
        const receiptProof = await getReceiptProof(
          withdrawReceipt,
          withdrawBlock,
          web3Child
        )
        assert.isTrue(
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
        exitLogs[0].event.should.equal('Transfer')
        exitLogs[0].address.should.equal(exitNFTContract.address)
        exitLogs[0].args.to.toLowerCase().should.equal(user)

        // exit id
        exitId = exitLogs[0].args.tokenId.toString()
        exitLogs[1].event.should.equal('ExitStarted')
        exitLogs[1].address.should.equal(withdrawManager.address)
        exitLogs[1].args.exitor.toLowerCase().should.equal(user)
        exitLogs[1].args.token.toLowerCase().should.equal(rootToken.address)
        exitLogs[1].args.amount.should.be.bignumber.equal(amount)
      })

      it('should have proper exitId for given user', async function() {
        const eId = await withdrawManager.getExitId(
          rootToken.address,
          accounts[9],
          0
        )
        eId.should.be.bignumber.equal(exitId)
      })

      it('should mint ExitNFT properly', async function() {
        const totalSupply = await exitNFTContract.totalSupply()
        totalSupply.should.be.bignumber.equal(1)
      })

      it('should have proper data in exitNFT', async function() {
        const tokenId = await exitNFTContract.tokenByIndex(0)
        tokenId.should.be.bignumber.equal(exitId)

        // check owner
        let out = await exitNFTContract.ownerOf(exitId)

        out.toLowerCase().should.equal(accounts[9])

        const [
          exitOwner,
          exitToken,
          exitAmount,
          burnt
        ] = await withdrawManager.getExit(exitId)
        exitOwner.should.equal(accounts[9])
        exitToken.should.equal(rootToken.address)
        exitAmount.should.be.bignumber.equal(amount)
        burnt.should.equal(false)
      })

      it('should allow transfer exitNFT to another user', async function() {
        // transfer NFT (sell UTXO)
        await exitNFTContract.transferFrom(accounts[9], accounts[1], exitId, {
          from: accounts[9]
        })

        // check owner
        const out = await exitNFTContract.ownerOf(exitId)
        out.toLowerCase().should.equal(accounts[1])
      })

      it('should not burn exit NFT with processExit', async function() {
        const receipt = await withdrawManager.processExits(rootToken.address)
        receipt.logs.should.have.lengthOf(0)
      })

      it('should burn exit NFT after challenge period', async function() {
        // wait 2 weeks
        await increaseBlockTime(14 * 86400)

        const receipt = await withdrawManager.processExits(rootToken.address)
        const logs = logDecoder.decodeLogs(receipt.receipt.logs)

        logs.should.have.lengthOf(3)

        logs[0].event.should.equal('Transfer')
        logs[0].args.from.toLowerCase().should.equal(accounts[1])
        logs[0].args.to.toLowerCase().should.equal(ZeroAddress)
        logs[0].args.tokenId.should.be.bignumber.equal(exitId)

        logs[1].event.should.equal('Transfer')
        logs[1].args.from.toLowerCase().should.equal(rootChain.address)
        logs[1].args.to.toLowerCase().should.equal(accounts[1])
        logs[1].args.value.should.be.bignumber.equal(amount)

        logs[2].event.should.equal('Withdraw')
        logs[2].args.user.toLowerCase().should.equal(accounts[1])
        logs[2].args.token.toLowerCase().should.equal(rootToken.address)
        logs[2].args.amount.should.be.bignumber.equal(amount)

        // transfer
        const totalSupply = await exitNFTContract.totalSupply()
        totalSupply.should.be.bignumber.equal(0)
        // check owner
        try {
          await exitNFTContract.ownerOf(exitId)
        } catch (error) {
          const invalidOpcode = error.message.search('revert') >= 0
          assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
        }
      })

      it('should transfer amount to NFT owner', async function() {
        const userBalance = await rootToken.balanceOf(accounts[1])
        userBalance.should.be.bignumber.equal(amount)
      })

      it('should have proper exitId for given user in case of exit without burn', async function() {
        const eId = await withdrawManager.getExitId(
          rootToken.address,
          accounts[9],
          0
        )
        eId.should.be.bignumber.equal(exitId)
      })

      it('should pass (added for sanity)', async function() {
        assert.isTrue(true)
      })
    })

    describe('direct withdraw:ERC721', async function() {
      let withdrawManager
      let rootToken
      let childChain
      let childToken
      let rootChain
      let owner = accounts[0]
      let depositManager
      let exitNFTContract
      let tokenId

      let receivedTx
      let exitId

      before(async function() {
        // root token / child chain / child token
        rootToken = await RootERC721.new('Root ERC721', 'R721')
        exitNFTContract = await ExitNFT.new('Matic Exit NFT', 'MATIC-NFT')
        rootChain = await RootChainMock.new()
        depositManager = await DepositManagerMock.new({ from: owner })
        withdrawManager = await WithdrawManagerMock.new({ from: owner })
        await depositManager.changeRootChain(rootChain.address, { from: owner })
        await withdrawManager.changeRootChain(rootChain.address, {
          from: owner
        })

        await rootChain.setDepositManager(depositManager.address, {
          from: owner
        })
        await rootChain.setWithdrawManager(withdrawManager.address, {
          from: owner
        })
        // child chain
        childChain = await ChildChain.new()
        const receipt = await childChain.addToken(
          accounts[0],
          rootToken.address,
          'Token Test',
          'TEST',
          18,
          true,
          { from: owner }
        )
        childToken = ChildERC721.at(receipt.logs[1].args.token)

        // set exit NFT
        await withdrawManager.setExitNFTContract(exitNFTContract.address)
        await withdrawManager.setDepositManager(depositManager.address)
        // set withdraw manager as root chain for exit NFT

        await exitNFTContract.changeRootChain(withdrawManager.address, {
          from: owner
        })

        // map token
        await rootChain.mapToken(rootToken.address, childToken.address, true, {
          from: owner
        })
        tokenId = 12
      })

      it('should allow user to deposit tokens', async function() {
        // transfer tokens
        await rootToken.mint(tokenId, { from: owner })
        await rootToken.approve(rootChain.address, tokenId, {
          from: owner
        })
        await rootChain.depositERC721(rootToken.address, owner, tokenId, {
          from: owner
        })
        // deposit tokens
        await childChain.depositTokens(rootToken.address, owner, tokenId, 1)
      })

      it('should allow user to transfer tokens', async function() {
        // transfer tokens
        await childToken.approve(accounts[9], tokenId, {
          from: owner
        })
        receivedTx = await childToken.transferFrom(
          owner,
          accounts[9],
          tokenId,
          {
            from: owner
          }
        )
      })

      it('should have 0 exitId for given user', async function() {
        const eId = await withdrawManager.getExitId(
          rootToken.address,
          accounts[9],
          tokenId
        )
        eId.should.be.bignumber.equal(0)
      })

      it('should allow user to start exit without burning tokens &try to double exit', async function() {
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
        const headerNumber = 0

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
        assert.isTrue(verifyTxProof(txProof), 'Tx proof must be valid')

        // validate receipt proof
        const receiptProof = await getReceiptProof(
          withdrawReceipt,
          withdrawBlock,
          web3Child
        )
        assert.isTrue(
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
        try {
          await withdrawManager.withdrawTokens(
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
        } catch (err) {
          const invalidOpcode = err.message.search('revert') >= 0
          assert(invalidOpcode, "Expected revert, got '" + err + "' instead")
        }
        // total logs
        const exitLogs = logDecoder.decodeLogs(exitReceipt.receipt.logs)

        exitLogs.should.have.lengthOf(2)
        exitLogs[0].event.should.equal('Transfer')
        exitLogs[0].address.should.equal(exitNFTContract.address)
        exitLogs[0].args.to.toLowerCase().should.equal(user)

        // exit id
        exitId = exitLogs[0].args.tokenId.toString()
        exitLogs[1].event.should.equal('ExitStarted')
        exitLogs[1].address.should.equal(withdrawManager.address)
        exitLogs[1].args.exitor.toLowerCase().should.equal(user)
        exitLogs[1].args.token.toLowerCase().should.equal(rootToken.address)
        exitLogs[1].args.amount.should.be.bignumber.equal(tokenId)
      })

      it('should have proper exitId for given user', async function() {
        const eId = await withdrawManager.getExitId(
          rootToken.address,
          accounts[9],
          tokenId
        )
        eId.should.be.bignumber.equal(exitId)
      })

      it('should mint ExitNFT properly', async function() {
        const totalSupply = await exitNFTContract.totalSupply()
        totalSupply.should.be.bignumber.equal(1)
      })

      it('should have proper data in exitNFT', async function() {
        const token = await exitNFTContract.tokenByIndex(0)
        token.should.be.bignumber.equal(exitId)

        // check owner
        let out = await exitNFTContract.ownerOf(exitId)

        out.toLowerCase().should.equal(accounts[9])

        const [
          exitOwner,
          exitToken,
          exitAmount,
          burnt
        ] = await withdrawManager.getExit(exitId)
        exitOwner.should.equal(accounts[9])
        exitToken.should.equal(rootToken.address)
        exitAmount.should.be.bignumber.equal(tokenId)
        burnt.should.equal(false)
      })

      it('should allow transfer exitNFT to another user', async function() {
        // transfer NFT (sell UTXO)
        await exitNFTContract.transferFrom(accounts[9], accounts[1], exitId, {
          from: accounts[9]
        })

        // check owner
        const out = await exitNFTContract.ownerOf(exitId)
        out.toLowerCase().should.equal(accounts[1])
      })

      it('should not burn exit NFT with processExit', async function() {
        const receipt = await withdrawManager.processExits(rootToken.address)
        receipt.logs.should.have.lengthOf(0)
      })

      it('should burn exit NFT after challenge period', async function() {
        // wait 2 weeks
        await increaseBlockTime(14 * 86400)

        const receipt = await withdrawManager.processExits(rootToken.address)
        const logs = logDecoder.decodeLogs(receipt.receipt.logs)

        logs.should.have.lengthOf(3)

        logs[0].event.should.equal('Transfer')
        logs[0].args.from.toLowerCase().should.equal(accounts[1])
        logs[0].args.to.toLowerCase().should.equal(ZeroAddress)
        logs[0].args.tokenId.should.be.bignumber.equal(exitId)

        logs[1].event.should.equal('Transfer')
        logs[1].args.from.toLowerCase().should.equal(rootChain.address)
        logs[1].args.to.toLowerCase().should.equal(accounts[1])
        logs[1].args.tokenId.should.be.bignumber.equal(tokenId)

        logs[2].event.should.equal('Withdraw')
        logs[2].args.user.toLowerCase().should.equal(accounts[1])
        logs[2].args.token.toLowerCase().should.equal(rootToken.address)
        logs[2].args.amount.should.be.bignumber.equal(tokenId)

        // transfer
        const totalSupply = await exitNFTContract.totalSupply()
        totalSupply.should.be.bignumber.equal(0)
        // check owner
        try {
          await exitNFTContract.ownerOf(exitId)
        } catch (error) {
          const invalidOpcode = error.message.search('revert') >= 0
          assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
        }
      })

      it('should transfer amount to NFT owner', async function() {
        const userBalance = await rootToken.balanceOf(accounts[1])
        userBalance.should.be.bignumber.equal(1)
      })

      it('should have proper exitId for given user in case of exit without burn', async function() {
        const eId = await withdrawManager.getExitId(
          rootToken.address,
          accounts[9],
          tokenId
        )
        eId.should.be.bignumber.equal(exitId)
      })

      it('should pass (added for sanity)', async function() {
        assert.isTrue(true)
      })
    })
  })
})
