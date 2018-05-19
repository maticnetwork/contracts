import bip39 from 'bip39'
import utils from 'ethereumjs-util'
import {Buffer} from 'safe-buffer'

import assertRevert from './helpers/assertRevert.js'
import {
  getTxBytes,
  getTxProof,
  verifyTxProof,
  getReceiptBytes,
  getReceiptProof,
  verifyReceiptProof
} from './helpers/proofs.js'
import {getHeaders, getBlockHeader} from './helpers/blocks.js'
import {generateFirstWallets} from './helpers/wallets'
import MerkleTree from './helpers/merkle-tree.js'
import {linkLibs, encodeSigs, getSigs} from './helpers/utils'

const web3Child = new web3.constructor(
  new web3.providers.HttpProvider('http://localhost:8546')
)
const BN = utils.BN
const rlp = utils.rlp

import {
  StakeManager,
  RootToken,
  RootChain,
  ChildChain,
  ChildToken,
  MaticWETH
} from './helpers/contracts'

ChildChain.web3 = web3Child
ChildToken.web3 = web3Child

const printReceiptEvents = receipt => {
  receipt.logs.forEach(l => {
    console.log(l.event, JSON.stringify(l.args))
  })
}

const mnemonics =
  'clock radar mass judge dismiss just intact mind resemble fringe diary casino'

contract('RootChain', async function(accounts) {
  describe('initialization', async function() {
    let stakeToken
    let stakeManager
    let rootChain

    before(async function() {
      // link libs
      await linkLibs(web3Child)

      stakeToken = await RootToken.new('Stake Token', 'STAKE')
      stakeManager = await StakeManager.new(stakeToken.address)
      rootChain = await RootChain.new(stakeManager.address)
      await stakeManager.setRootChain(rootChain.address)
    })

    it('should set stake manager address', async function() {
      assert.equal(await rootChain.stakeManager(), stakeManager.address)
    })

    it('should set owner properly', async function() {
      assert.equal(await rootChain.owner(), accounts[0])
    })

    it('should set root chain properly for stake manager', async function() {
      assert.equal(await stakeManager.rootChain(), rootChain.address)
    })
  })

  describe('Stakers: header block', async function() {
    let stakeToken
    let stakeManager
    let rootChain
    let wallets
    let stakes = {
      1: web3.toWei(1),
      2: web3.toWei(10),
      3: web3.toWei(20),
      4: web3.toWei(50)
    }
    let chain
    let dummyRoot
    let sigs

    before(async function() {
      wallets = generateFirstWallets(mnemonics, Object.keys(stakes).length)
      stakeToken = await RootToken.new('Stake Token', 'STAKE')
      stakeManager = await StakeManager.new(stakeToken.address)
      rootChain = await RootChain.new(stakeManager.address)
      await stakeManager.setRootChain(rootChain.address)

      for (var i = 1; i < wallets.length; i++) {
        const amount = stakes[i]
        const user = wallets[i].getAddressString()

        // get tokens
        await stakeToken.transfer(user, amount)

        // approve transfer
        await stakeToken.approve(stakeManager.address, amount, {from: user})

        // stake
        await stakeManager.stake(amount, '0x0', {from: user})
      }

      // increase threshold to 2
      await stakeManager.updateValidatorThreshold(2)
      chain = await rootChain.chain()
      dummyRoot = utils.bufferToHex(utils.sha3('dummy'))
    })

    it('should create sigs properly', async function() {
      sigs = utils.bufferToHex(
        encodeSigs(
          getSigs(wallets.slice(1), chain, dummyRoot, 0, 10, [
            await stakeManager.getProposer()
          ])
        )
      )

      const signers = await stakeManager.checkSignatures(dummyRoot, 0, 10, sigs)

      // total sigs = wallet.length - proposer - owner
      assert.equal(signers.toNumber(), wallets.length - 2)

      // current header block
      const currentHeaderBlock = await rootChain.currentHeaderBlock()
      assert.equal(+currentHeaderBlock, 0)

      // check current child block
      const currentChildBlock = await rootChain.currentChildBlock()
      assert.equal(+currentChildBlock, 0)
    })

    it('should allow proposer to submit block', async function() {
      const proposer = await stakeManager.getProposer()

      // submit header block
      const receipt = await rootChain.submitHeaderBlock(dummyRoot, 10, sigs, {
        from: proposer
      })

      assert.equal(receipt.logs.length, 1)
      assert.equal(receipt.logs[0].event, 'NewHeaderBlock')
      assert.equal(receipt.logs[0].args.proposer, proposer)
      assert.equal(+receipt.logs[0].args.start, 0)
      assert.equal(+receipt.logs[0].args.end, 10)
      assert.equal(receipt.logs[0].args.root, dummyRoot)

      // current header block
      const currentHeaderBlock = await rootChain.currentHeaderBlock()
      assert.equal(+currentHeaderBlock, 1)

      // current child block
      const currentChildBlock = await rootChain.currentChildBlock()
      assert.equal(+currentChildBlock, 10)
    })
  })

  describe('Token: map tokens', async function() {
    let stakeToken
    let rootToken
    let childToken
    let rootChain
    let stakeManager

    before(async function() {
      stakeToken = await RootToken.new('Stake Token', 'STAKE')
      rootToken = await RootToken.new('Test Token', 'TEST')
      stakeManager = await StakeManager.new(stakeToken.address)
      rootChain = await RootChain.new(stakeManager.address)
      await stakeManager.setRootChain(rootChain.address)
      childToken = await ChildToken.new(rootToken.address, 18)
    })

    it('should allow to map token', async function() {
      // check if child has correct root token
      assert.equal(rootToken.address, await childToken.token())
      const receipt = await rootChain.mapToken(
        rootToken.address,
        childToken.address
      )
      assert.equal(receipt.logs.length, 1)
      assert.equal(receipt.logs[0].event, 'TokenMapped')
      assert.equal(receipt.logs[0].args.rootToken, rootToken.address)
      assert.equal(receipt.logs[0].args.childToken, childToken.address)
    })

    it('should have correct mapping', async function() {
      assert.equal(
        await rootChain.tokens(rootToken.address),
        childToken.address
      )
    })
  })

  describe('Deposit', async function() {
    let stakeToken
    let stakeManager
    let rootToken
    let rootChain
    let wethToken
    let childChain
    let childToken
    let childWethToken
    let user
    let chain
    let sigs

    before(async function() {
      user = accounts[9]
      stakeToken = await RootToken.new('Stake Token', 'STAKE')
      rootToken = await RootToken.new('Test Token', 'TEST', {from: user})
      wethToken = await MaticWETH.new({from: user})
      stakeManager = await StakeManager.new(stakeToken.address)
      rootChain = await RootChain.new(stakeManager.address)
      await stakeManager.setRootChain(rootChain.address)
      await rootChain.setWETHToken(wethToken.address)

      // create child chain
      childChain = await ChildChain.new({
        from: user,
        gas: 6000000
      })

      // check owner
      assert.equal(await childChain.owner(), user)

      let childTokenReceipt = await childChain.addToken(rootToken.address, 18, {
        from: user
      })
      assert.equal(childTokenReceipt.logs.length, 1)
      assert.equal(childTokenReceipt.logs[0].event, 'NewToken')
      assert.equal(childTokenReceipt.logs[0].args.rootToken, rootToken.address)
      assert.equal(
        childTokenReceipt.logs[0].args.token,
        await childChain.tokens(rootToken.address)
      )
      childToken = ChildToken.at(childTokenReceipt.logs[0].args.token)

      // weth token
      childTokenReceipt = await childChain.addToken(wethToken.address, 18, {
        from: user
      })
      childWethToken = ChildToken.at(childTokenReceipt.logs[0].args.token)

      // map tokens
      await rootChain.mapToken(rootToken.address, childToken.address)
      await rootChain.mapToken(wethToken.address, childWethToken.address)

      chain = await rootChain.chain()
    })

    it('should allow anyone to deposit tokens', async function() {
      const beforeBalance = new BN((await rootToken.balanceOf(user)).toString())

      // check if balance > 0
      assert.isOk(beforeBalance.gt(new BN(0)))

      // deposit
      const amount = web3.toWei(10)
      // approve transfer
      await rootToken.approve(rootChain.address, amount, {from: user})
      const receipt = await rootChain.deposit(rootToken.address, amount, {
        from: user
      })
      assert.equal(receipt.logs.length, 1)
      assert.equal(receipt.logs[0].event, 'Deposit')
      assert.equal(receipt.logs[0].args.user, user)
      assert.equal(receipt.logs[0].args.token, rootToken.address)
      assert.equal(receipt.logs[0].args.amount, amount.toString())

      // get depositCount
      const depositCount = await rootChain.depositCount()
      assert.equal(
        depositCount.toNumber() - 1,
        parseInt(receipt.logs[0].args.depositCount)
      )
    })

    it('should allow anyone to deposit ETH', async function() {
      rootToken = wethToken
      childToken = childWethToken

      let _beforeBalance = await web3.eth.getBalance(rootToken.address)
      let beforeBalance = new BN(_beforeBalance.toString())
      const amount = web3.toWei(2)
      await web3.eth.sendTransaction({
        from: user,
        to: rootChain.address,
        value: amount,
        gas: 200000
      })
      let _afterBalance = await web3.eth.getBalance(rootToken.address)
      let afterBalance = new BN(_afterBalance.toString())
      assert.isOk(afterBalance.sub(beforeBalance).eq(new BN(amount.toString())))

      // check root chain token balance (WETH)
      const rootChainETH = await rootToken.balanceOf(rootChain.address)
      assert.isOk(new BN(rootChainETH.toString()).eq(new BN(amount.toString())))

      // check ETH balance on child chain
      beforeBalance = await childToken.balanceOf(user)
      beforeBalance = new BN(beforeBalance.toString())

      // deposit tokens on child chain (will happen through bridge)
      const receipt = await childChain.depositTokens(
        rootToken.address,
        user,
        amount,
        0,
        {
          from: user
        }
      )

      // check ETH after deposit tokens
      afterBalance = await childToken.balanceOf(user)
      afterBalance = new BN(afterBalance.toString())

      // check if child token is updated properly
      assert.isOk(afterBalance.sub(beforeBalance).eq(new BN(amount.toString())))
    })
  })

  describe('Withdraw', async function() {
    let stakeToken
    let rootToken
    let wethToken
    let childWethToken
    let rootChain
    let stakeManager
    let wallets
    let stakes = {
      1: web3.toWei(1),
      2: web3.toWei(10),
      3: web3.toWei(20),
      4: web3.toWei(50)
    }
    let chain
    let tree
    let sigs
    let user
    let privateKey

    let withdraw
    let withdrawBlock
    let withdrawBlockSlim
    let withdrawReceipt

    let childChain
    let childToken

    before(async function() {
      wallets = generateFirstWallets(mnemonics, Object.keys(stakes).length)
      user = accounts[9]
      privateKey = utils.toBuffer(
        generateFirstWallets(mnemonics, 1, 9)[0].privateKey
      )

      stakeToken = await RootToken.new('Stake Token', 'STAKE')
      rootToken = await RootToken.new('Test Token', 'TEST', {from: user})
      wethToken = await MaticWETH.new({from: user})
      stakeManager = await StakeManager.new(stakeToken.address)
      rootChain = await RootChain.new(stakeManager.address)
      await stakeManager.setRootChain(rootChain.address)
      await rootChain.setWETHToken(wethToken.address)

      // create child chain
      childChain = await ChildChain.new({from: user, gas: 6000000})

      // check owner
      assert.equal(await childChain.owner(), user)

      // root token mapping
      let childTokenReceipt = await childChain.addToken(rootToken.address, 18, {
        from: user
      })
      childToken = ChildToken.at(childTokenReceipt.logs[0].args.token)

      // weth token mapping
      childTokenReceipt = await childChain.addToken(wethToken.address, 18, {
        from: user
      })
      childWethToken = ChildToken.at(childTokenReceipt.logs[0].args.token)

      // map root token
      await rootChain.mapToken(rootToken.address, childToken.address)
      // map weth token
      await rootChain.mapToken(wethToken.address, childWethToken.address)

      for (var i = 1; i < wallets.length; i++) {
        const amount = stakes[i]
        const user = wallets[i].getAddressString()

        // get tokens
        await stakeToken.transfer(user, amount)

        // approve transfer
        await stakeToken.approve(stakeManager.address, amount, {from: user})

        // stake
        await stakeManager.stake(amount, '0x0', {from: user})
      }

      // increase threshold to 2
      await stakeManager.updateValidatorThreshold(2)

      chain = await rootChain.chain()
    })

    // ERC20 withdraw
    describe('ERC20', async function() {
      it('should allow to deposit before withdraw', async function() {
        assert.equal(true, true)
        const user = accounts[9]
        const amount = web3.toWei(10)

        // deposit to root & child token
        await rootToken.approve(rootChain.address, amount, {from: user})
        let receipt = await rootChain.deposit(rootToken.address, amount, {
          from: user
        })
        const depositCount = receipt.logs[0].args.depositCount.toString()
        receipt = await childChain.depositTokens(
          rootToken.address,
          user,
          amount,
          depositCount,
          {
            from: user
          }
        )
        assert.equal(
          (await rootToken.balanceOf(rootChain.address)).toString(),
          amount
        )
        assert.equal((await childToken.balanceOf(user)).toString(), amount)
      })

      it('should allow anyone to withdraw tokens from side chain', async function() {
        const user = accounts[9]
        const amount = web3.toWei(10)

        // withdraw
        const obj = await childToken.withdraw(amount, {
          from: user
        })

        const receipt = obj.receipt
        withdraw = await web3Child.eth.getTransaction(receipt.transactionHash)
        withdrawBlock = await web3Child.eth.getBlock(receipt.blockHash, true)
        withdrawBlockSlim = await web3Child.eth.getBlock(
          receipt.blockHash,
          false
        )
        withdrawReceipt = await web3Child.eth.getTransactionReceipt(
          receipt.transactionHash
        )
      })

      it('should allow submit root', async function() {
        const start = 0
        const end = withdraw.blockNumber
        const headers = await getHeaders(start, end, web3Child)
        tree = new MerkleTree(headers)
        const root = utils.bufferToHex(tree.getRoot())

        sigs = utils.bufferToHex(
          encodeSigs(
            getSigs(wallets.slice(1), chain, root, start, end, [
              await stakeManager.getProposer()
            ])
          )
        )

        const signers = await stakeManager.checkSignatures(
          root,
          start,
          end,
          sigs
        )

        // assert for enough signers
        assert.equal(signers.toNumber(), wallets.length - 2)

        // verify block header tree
        const v = getBlockHeader(withdrawBlock)
        assert.isOk(
          tree.verify(
            v,
            withdrawBlock.number - start,
            tree.getRoot(),
            tree.getProof(v)
          )
        )

        const proposer = await stakeManager.getProposer()

        // submit header block
        const receipt = await rootChain.submitHeaderBlock(
          utils.bufferToHex(tree.getRoot()),
          end,
          sigs,
          {
            from: proposer
          }
        )

        assert.equal(receipt.logs.length, 1)
        assert.equal(receipt.logs[0].event, 'NewHeaderBlock')
        assert.equal(receipt.logs[0].args.proposer, proposer)
        assert.equal(+receipt.logs[0].args.start, start)
        assert.equal(+receipt.logs[0].args.end, end)
        assert.equal(
          receipt.logs[0].args.root,
          utils.bufferToHex(tree.getRoot())
        )

        // current header block
        const currentHeaderBlock = await rootChain.currentHeaderBlock()
        assert.equal(+currentHeaderBlock, 1)

        // current child block
        const currentChildBlock = await rootChain.currentChildBlock()
        assert.equal(+currentChildBlock, end)
      })

      it('should allow anyone to withdraw tokens', async function() {
        const user = accounts[9]
        const amount = web3.toWei(10)
        // validate tx proof
        // transaction proof
        const txProof = await getTxProof(withdraw, withdrawBlock)
        // check if proof is valid
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

        // validate header proof
        const start = 0
        const headerProof = await tree.getProof(getBlockHeader(withdrawBlock))

        // let's withdraw from root chain :)
        const headerNumber = await rootChain.currentHeaderBlock()
        const startWithdrawReceipt = await rootChain.withdraw(
          +headerNumber.sub(new BN(1)).toString(), // header block
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

        assert.equal(startWithdrawReceipt.logs.length, 1)
        assert.equal(
          startWithdrawReceipt.logs[0].args.amount,
          amount.toString()
        )
        assert.equal(startWithdrawReceipt.logs[0].args.user, user)
        assert.equal(startWithdrawReceipt.logs[0].args.token, rootToken.address)

        assert.isOk(
          await rootChain.withdraws(
            utils.bufferToHex(withdrawBlock.transactionsRoot)
          )
        )
      })
    })

    // ETH withdraw
    describe('ETH', async function() {
      before(async function() {
        // make weth a root token
        rootToken = wethToken
        childToken = childWethToken

        // deposit ETH to root chain
        const amount = web3.toWei(2)
        await web3.eth.sendTransaction({
          from: user,
          to: rootChain.address,
          value: amount,
          gas: 200000
        })

        // deposit tokens (will be done by bridge)
        await childChain.depositTokens(rootToken.address, user, amount, 1, {
          from: user
        })
      })

      it('should allow anyone to withdraw tokens from side chain', async function() {
        const amount = web3.toWei(1)

        // withdraw 1 ether
        const obj = await childToken.withdraw(amount, {
          from: user
        })

        const receipt = obj.receipt
        withdraw = await web3Child.eth.getTransaction(receipt.transactionHash)
        withdrawBlock = await web3Child.eth.getBlock(receipt.blockHash, true)
        withdrawBlockSlim = await web3Child.eth.getBlock(
          receipt.blockHash,
          false
        )
        withdrawReceipt = await web3Child.eth.getTransactionReceipt(
          receipt.transactionHash
        )
      })

      it('should allow submit root', async function() {
        const _start = await rootChain.currentChildBlock()
        const start = parseInt(_start, 10) + 1
        const end = withdraw.blockNumber
        const headers = await getHeaders(start, end, web3Child)
        tree = new MerkleTree(headers)
        const root = utils.bufferToHex(tree.getRoot())

        sigs = utils.bufferToHex(
          encodeSigs(
            getSigs(wallets.slice(1), chain, root, start, end, [
              await stakeManager.getProposer()
            ])
          )
        )

        const signers = await stakeManager.checkSignatures(
          root,
          start,
          end,
          sigs
        )

        // assert for enough signers
        assert.equal(signers.toNumber(), wallets.length - 2)

        // verify block header tree
        const v = getBlockHeader(withdrawBlock)
        assert.isOk(
          tree.verify(
            v,
            withdrawBlock.number - start,
            tree.getRoot(),
            tree.getProof(v)
          )
        )

        const proposer = await stakeManager.getProposer()

        // submit header block
        const receipt = await rootChain.submitHeaderBlock(
          utils.bufferToHex(tree.getRoot()),
          end,
          sigs,
          {
            from: proposer
          }
        )

        assert.equal(receipt.logs.length, 1)
        assert.equal(receipt.logs[0].event, 'NewHeaderBlock')
        assert.equal(receipt.logs[0].args.proposer, proposer)
        assert.equal(+receipt.logs[0].args.start, start)
        assert.equal(+receipt.logs[0].args.end, end)
        assert.equal(
          receipt.logs[0].args.root,
          utils.bufferToHex(tree.getRoot())
        )

        // current header block
        const currentHeaderBlock = await rootChain.currentHeaderBlock()
        assert.equal(+currentHeaderBlock, 2)

        // current child block
        const currentChildBlock = await rootChain.currentChildBlock()
        assert.equal(+currentChildBlock, end)
      })

      it('should allow anyone to withdraw ETH', async function() {
        const amount = web3.toWei(1)
        // validate tx proof
        // transaction proof
        const txProof = await getTxProof(withdraw, withdrawBlock)
        // check if proof is valid
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

        // validate header proof
        const headerProof = await tree.getProof(getBlockHeader(withdrawBlock))

        // let's withdraw from root chain :)
        const headerNumber = await rootChain.currentHeaderBlock()
        const startWithdrawReceipt = await rootChain.withdraw(
          +headerNumber.sub(new BN(1)).toString(), // header block
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

        assert.equal(startWithdrawReceipt.logs.length, 1)
        assert.equal(
          startWithdrawReceipt.logs[0].args.amount,
          amount.toString()
        )
        assert.equal(startWithdrawReceipt.logs[0].args.user, user)
        assert.equal(startWithdrawReceipt.logs[0].args.token, rootToken.address)

        assert.isOk(
          await rootChain.withdraws(
            utils.bufferToHex(withdrawBlock.transactionsRoot)
          )
        )
      })
    })
  })
})
